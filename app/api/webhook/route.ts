import { NextResponse } from 'next/server';
import { fileStore } from '@/lib/fileStore';
import type { Task } from '@/lib/fileStore';
import { addMessage } from '@/lib/db';
import { appEmitter } from '@/lib/events';

const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET || 'slimyai-mc-2026';

export async function POST(request: Request) {
  try {
    const secret = request.headers.get('X-Webhook-Secret');

    if (secret !== WEBHOOK_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { type, agent, data } = body;

    switch (type) {
      case 'comms': {
        // Store message in SQLite
        if (data?.from && data?.message) {
          const newMsg = addMessage(data.from, data.to || 'all', data.message, data.channel || 'all');
          // Emit SSE event
          appEmitter.emit('message', newMsg);
        }
        break;
      }

      case 'agent_status': {
        // Update team.json via fileStore
        if (agent && data?.status) {
          const team = fileStore.readTeam();
          const subAgent = team.subagents.find(a => a.name.toLowerCase() === agent.toLowerCase());
          if (subAgent) {
            subAgent.status = data.status;
            if (data.currentTask) subAgent.currentTask = data.currentTask;
            team.last_updated = new Date().toISOString();
            fileStore.writeTeam(team);
          }
        }
        break;
      }

      case 'task_update': {
        // Update taskboard.json via fileStore
        if (data?.taskId && data?.status) {
          const board = fileStore.readTasks();
          const task = board.tasks.find(t => t.id === data.taskId);
          if (task) {
            task.status = data.status;
            if (data.assignee) task.assignee = data.assignee;
            board.last_updated = new Date().toISOString();
            fileStore.writeTasks(board);
          }
        }
        break;
      }

      case 'task_create': {
        if (data?.title) {
          const board = fileStore.readTasks();
          const newId = board.tasks.length > 0 ? Math.max(...board.tasks.map(t => t.id)) + 1 : 1;
          const now = new Date().toISOString();
          const newTask: Task = {
            id: newId,
            title: data.title,
            description: data.description || '',
            status: 'todo',
            assignee: data.assignee || 'ned',
            priority: data.priority || 'medium',
            created_at: now,
            updated_at: now,
            delegated_to: null,
            progress: 0,
            notes: [],
          };
          board.tasks.push(newTask);
          board.last_updated = now;
          fileStore.writeTasks(board);
          addMessage('System', 'all', `New task created: ${newTask.title} — assigned to ${newTask.assignee}`, 'all');
          appEmitter.emit('task_update', board);
        }
        break;
      }

      case 'task_delegate': {
        if (data?.task_id && data?.delegated_to) {
          const board = fileStore.readTasks();
          const task = board.tasks.find(t => t.id === data.task_id);
          if (task) {
            task.delegated_to = data.delegated_to;
            const note = `Ned delegated to ${data.delegated_to}${data.reason ? ': ' + data.reason : ''}`;
            task.notes.unshift(note);
            task.updated_at = new Date().toISOString();
            board.last_updated = task.updated_at;
            fileStore.writeTasks(board);
            addMessage('System', 'all', `Ned delegated '${task.title}' to ${data.delegated_to}`, 'all');
            appEmitter.emit('task_update', board);
            // Notify Ned about delegation
            const { exec } = await import('child_process');
            const notifyMsg = `🔄 TASK DELEGATED: ${task.title}\nFrom: ${task.assignee}\nTo: ${data.delegated_to}\nReason: ${data.reason || 'No reason provided'}`;
            exec(
              `/home/slimy/.npm-global/bin/openclaw agent --agent ned --message ${JSON.stringify(notifyMsg)}`,
              (err) => { if (err) console.error('[Webhook] Ned notify failed:', err); }
            );
          }
        }
        break;
      }

      case 'task_progress': {
        if (data?.task_id !== undefined && data?.progress !== undefined) {
          const board = fileStore.readTasks();
          const task = board.tasks.find(t => t.id === data.task_id);
          if (task) {
            const oldProgress = task.progress;
            task.progress = Math.max(0, Math.min(100, data.progress));
            const thresholds = [25, 50, 75, 100];
            for (const t of thresholds) {
              if (oldProgress < t && task.progress >= t) {
                task.notes.unshift(`Progress reached ${t}%`);
              }
            }
            task.updated_at = new Date().toISOString();
            board.last_updated = task.updated_at;
            fileStore.writeTasks(board);
            appEmitter.emit('task_update', board);
          }
        }
        break;
      }

      case 'system': {
        // Log system metrics (could store in SQLite if needed)
        console.log('[Webhook] System metrics:', data);
        break;
      }

      default:
        console.log('[Webhook] Unknown type:', type);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
