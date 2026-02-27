import { NextResponse } from 'next/server';
import { fileStore } from '@/lib/fileStore';
import { getMessages } from '@/lib/db';

interface BulletinEntry {
  type: 'assignment' | 'delegation' | 'completion' | 'status';
  agent: string;
  message: string;
  timestamp: string;
  relatedTask?: {
    id: number;
    title: string;
    priority: string;
  };
  channel?: string;
}

// Parse type from task note content
function parseNoteType(note: string): BulletinEntry['type'] {
  const lowerNote = note.toLowerCase();
  if (lowerNote.includes('assigned to') || lowerNote.includes('new task')) {
    return 'assignment';
  }
  if (lowerNote.includes('delegated') || lowerNote.includes('delegation')) {
    return 'delegation';
  }
  if (lowerNote.includes('completed') || lowerNote.includes('done') || lowerNote.includes('finished')) {
    return 'completion';
  }
  return 'status';
}

// Extract agent from note or message
function extractAgent(content: string): string {
  const lowerContent = content.toLowerCase();

  // Check for explicit agent mentions
  if (lowerContent.includes('ned')) return 'ned';
  if (lowerContent.includes('gurth')) return 'gurth';
  if (lowerContent.includes('kieran')) return 'kieran';
  if (lowerContent.includes('garth')) return 'garth';

  // Default to system if no specific agent found
  return 'system';
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '30');
    const offset = parseInt(searchParams.get('offset') || '0');
    const typeFilter = searchParams.get('type') || undefined;

    const entries: BulletinEntry[] = [];

    // 1. Get task notes from fileStore
    const taskBoard = fileStore.readTasks();

    for (const task of taskBoard.tasks) {
      // Process task notes
      for (const note of task.notes) {
        const entryType = parseNoteType(note);

        // Skip if type filter is applied and doesn't match
        if (typeFilter && entryType !== typeFilter) {
          continue;
        }

        const agent = extractAgent(note);

        // Clean up message: remove raw ISO timestamp prefix like "[2026-02-26T20:16:35.906954+00:00]"
        const cleanMessage = note.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}\]\s*/, '');
        console.log(`[bulletin] Note cleanup: "${note.substring(0, 60)}" -> "${cleanMessage.substring(0, 60)}"`);

        entries.push({
          type: entryType,
          agent,
          message: cleanMessage,
          timestamp: task.updated_at,
          relatedTask: {
            id: task.id,
            title: task.title,
            priority: task.priority,
          },
        });
      }

      // Also create entries for delegations
      if (task.delegated_to && task.delegated_to !== task.assignee) {
        if (!typeFilter || typeFilter === 'delegation') {
          entries.push({
            type: 'delegation',
            agent: task.assignee.toLowerCase(),
            message: `Delegated "${task.title}" to ${task.delegated_to}`,
            timestamp: task.updated_at,
            relatedTask: {
              id: task.id,
              title: task.title,
              priority: task.priority,
            },
          });
        }
      }

      // Create entries for completions
      if (task.status === 'done') {
        if (!typeFilter || typeFilter === 'completion') {
          entries.push({
            type: 'completion',
            agent: task.assignee.toLowerCase(),
            message: `Completed "${task.title}"`,
            timestamp: task.updated_at,
            relatedTask: {
              id: task.id,
              title: task.title,
              priority: task.priority,
            },
          });
        }
      }

      // Create entries for assignments
      if (task.status === 'todo' && !task.delegated_to) {
        if (!typeFilter || typeFilter === 'assignment') {
          entries.push({
            type: 'assignment',
            agent: 'system',
            message: `New task assigned to ${task.assignee}: "${task.title}"`,
            timestamp: task.created_at,
            relatedTask: {
              id: task.id,
              title: task.title,
              priority: task.priority,
            },
          });
        }
      }
    }

    // 2. Get system comms from database
    // Filter: from_agent = 'System' OR channel = 'project' OR channel = 'briefing'
    const allMessages = getMessages(1000, 0);

    for (const msg of allMessages) {
      const isSystem = msg.from_agent.toLowerCase() === 'system';
      const isProject = msg.channel === 'project';
      const isBriefing = msg.channel === 'briefing';

      if (!isSystem && !isProject && !isBriefing) {
        continue;
      }

      const entryType = isSystem ? 'status' : (isProject ? 'delegation' : 'status');

      if (typeFilter && entryType !== typeFilter) {
        continue;
      }

      // Clean up message: remove raw ISO timestamp prefix like "[2026-02-26T20:16:35.906954+00:00]"
      const cleanMessage = msg.message.replace(/^\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d+\+\d{2}:\d{2}\]\s*/, '');

      entries.push({
        type: entryType,
        agent: msg.from_agent.toLowerCase(),
        message: cleanMessage,
        timestamp: msg.timestamp,
        channel: msg.channel,
      });
    }

    // Sort all entries by timestamp DESC (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const total = entries.length;
    const paginatedEntries = entries.slice(offset, offset + limit);

    return NextResponse.json({
      entries: paginatedEntries,
      total,
    });
  } catch (error) {
    console.error('Bulletin API error:', error);
    return NextResponse.json({ error: 'Failed to get bulletin entries' }, { status: 500 });
  }
}
