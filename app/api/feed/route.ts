import { NextResponse } from 'next/server';
import { getMessages } from '@/lib/db';
import { getEvents } from '@/lib/ops';
import { fileStore } from '@/lib/fileStore';

interface FeedEntry {
  id: string;
  type: 'chat' | 'pulse' | 'ops' | 'incident' | 'story';
  agent: string;
  icon: string;
  tags: string[];
  message: string;
  timestamp: string;
  expandable?: boolean;
  childCount?: number;
}

// Map agent names to icons
const agentIcons: Record<string, string> = {
  ned: '🤖',
  rex: '💻',
  atlas: '📊',
  sentinel: '🛡️',
  git: '🔧',
  scout: '⚡',
  query: '🗄️',
  cloud: '☁️',
  pip: '📈',
  gurth: '🧙',
  garth: '🧝',
  kieran: '👤',
  system: '⚙️',
};

function getAgentIcon(agent: string): string {
  return agentIcons[agent.toLowerCase()] || '🤖';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'all';
    const agent = searchParams.get('agent') || undefined;
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    const entries: FeedEntry[] = [];
    const today = new Date().toISOString().split('T')[0];
    const todayStart = today + 'T00:00:00';

    // 1. Get chat messages from comms
    const messages = getMessages(1000, 0);
    for (const msg of messages) {
      const agentName = msg.from_agent.toLowerCase();

      // Filter by agent if specified
      if (agent && !agentName.includes(agent.toLowerCase())) {
        continue;
      }

      // Determine message type
      let msgType: FeedEntry['type'] = 'chat';
      if (msg.channel === 'pulse') {
        msgType = 'pulse';
      } else if (msg.channel === 'incident') {
        msgType = 'incident';
      } else if (msg.channel === 'story') {
        msgType = 'story';
      }

      // Filter by type if specified
      if (type !== 'all' && msgType !== type) {
        continue;
      }

      entries.push({
        id: `msg-${msg.id}`,
        type: msgType,
        agent: agentName,
        icon: getAgentIcon(agentName),
        tags: msg.channel ? [msg.channel] : [],
        message: msg.message,
        timestamp: msg.timestamp,
      });
    }

    // 2. Get ops events
    const events = getEvents({ limit: 200 });
    for (const event of events) {
      // Only include today's events or recent ones
      const eventDate = event.created_at ? event.created_at.split('T')[0] : '';
      if (eventDate && eventDate < today) {
        continue;
      }

      const eventAgent = (event.source || 'system').toLowerCase();

      // Filter by agent if specified
      if (agent && !eventAgent.includes(agent.toLowerCase())) {
        continue;
      }

      // Determine event type
      let eventType: FeedEntry['type'] = 'ops';
      if (event.type === 'error' || event.type === 'failed') {
        eventType = 'incident';
      } else if (event.type === 'mission_complete') {
        eventType = 'story';
      }

      // Filter by type if specified
      if (type !== 'all' && eventType !== type) {
        continue;
      }

      entries.push({
        id: `event-${event.id}`,
        type: eventType,
        agent: eventAgent,
        icon: getAgentIcon(eventAgent),
        tags: event.type ? [event.type] : [],
        message: typeof event.data === 'object' && event.data !== null && 'message' in event.data
          ? (event.data as { message: string }).message
          : `Event: ${event.type}`,
        timestamp: event.created_at,
        expandable: true,
      });
    }

    // 3. Get bulletin entries (tasks, delegations, completions)
    try {
      const taskBoard = fileStore.readTasks();

      for (const task of taskBoard.tasks) {
        // Only include recent tasks
        if (task.updated_at && task.updated_at < todayStart) {
          continue;
        }

        const assignee = (task.assignee || 'system').toLowerCase();

        // Filter by agent if specified
        if (agent && !assignee.includes(agent.toLowerCase())) {
          continue;
        }

        // Create entry for task creation
        if (task.status === 'todo' && !task.delegated_to) {
          // Filter by type - skip story for bulletin
          if (type === 'all' || type === 'chat') {
            entries.push({
              id: `task-create-${task.id}`,
              type: 'chat',
              agent: 'system',
              icon: getAgentIcon('system'),
              tags: ['task', 'assignment'],
              message: `New task assigned to ${task.assignee}: "${task.title}"`,
              timestamp: task.created_at,
            });
          }
        }

        // Create entry for delegation
        if (task.delegated_to && task.delegated_to !== task.assignee) {
          if (type === 'all' || type === 'chat') {
            entries.push({
              id: `task-deleg-${task.id}`,
              type: 'chat',
              agent: assignee,
              icon: getAgentIcon(assignee),
              tags: ['task', 'delegation'],
              message: `Delegated "${task.title}" to ${task.delegated_to}`,
              timestamp: task.updated_at,
            });
          }
        }

        // Create entry for completion
        if (task.status === 'done') {
          if (type === 'all' || type === 'story') {
            entries.push({
              id: `task-done-${task.id}`,
              type: 'story',
              agent: assignee,
              icon: getAgentIcon(assignee),
              tags: ['task', 'completion'],
              message: `Completed "${task.title}"`,
              timestamp: task.updated_at,
            });
          }
        }
      }
    } catch (err) {
      console.error('[feed] Error reading bulletin:', err);
    }

    // Sort all entries by timestamp DESC (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Calculate counts
    const total = entries.length;
    const chatCount = entries.filter(e => e.type === 'chat').length;
    const pulseCount = entries.filter(e => e.type === 'pulse').length;
    const opsCount = entries.filter(e => e.type === 'ops').length;
    const incidentCount = entries.filter(e => e.type === 'incident').length;
    const storyCount = entries.filter(e => e.type === 'story').length;

    // Apply pagination
    const paginatedEntries = entries.slice(offset, offset + limit);

    return NextResponse.json({
      entries: paginatedEntries,
      total,
      counts: {
        all: total,
        chat: chatCount,
        pulse: pulseCount,
        ops: opsCount,
        incident: incidentCount,
        story: storyCount,
      },
    });
  } catch (error) {
    console.error('[feed] Error:', error);
    return NextResponse.json({ error: 'Failed to get feed' }, { status: 500 });
  }
}
