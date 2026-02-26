import { NextResponse } from 'next/server';
import { fileStore } from '@/lib/fileStore';
import { addMessage } from '@/lib/db';
import { appEmitter } from '@/lib/events';
import { exec } from 'child_process';

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);
    const body = await request.json();

    const board = fileStore.readTasks();
    const taskIndex = board.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    const task = board.tasks[taskIndex];
    const oldStatus = task.status;

    // Update fields
    if (body.title !== undefined) task.title = body.title;
    if (body.description !== undefined) task.description = body.description;
    if (body.status !== undefined) task.status = body.status;
    if (body.assignee !== undefined) task.assignee = body.assignee;
    if (body.priority !== undefined) task.priority = body.priority;
    if (body.delegated_to !== undefined) task.delegated_to = body.delegated_to;
    if (body.progress !== undefined) task.progress = Math.max(0, Math.min(100, body.progress));
    if (body.notes !== undefined) task.notes = body.notes;

    task.updated_at = new Date().toISOString();
    board.last_updated = task.updated_at;

    // Status-change side effects
    if (body.status && body.status !== oldStatus) {
      const detroitTime = new Date().toLocaleString('en-US', {
        timeZone: 'America/Detroit',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      }) + ' ET';

      if (body.status === 'in_progress') {
        task.notes.unshift(`Task started — assigned to ${task.assignee} at ${detroitTime}`);
        addMessage('System', 'all', `📌 ${task.assignee} picked up: ${task.title}`, 'all');
        // Bug 3b fix: Notify Ned via openclaw CLI
        try {
          const notifyMsg = `TASK STARTED: ${task.title} — Assigned: ${task.assignee}, Priority: ${task.priority}`.replace(/"/g, '\\"').substring(0, 500);
          exec(
            `openclaw agent --agent ned --message "${notifyMsg}"`,
            { timeout: 30000, cwd: '/home/slimy' },
            (error) => {
              if (error) console.error('[tasks] Ned notification failed:', error.message);
            }
          );
        } catch (e) {
          console.error('[tasks] Ned notification error:', e);
        }
      } else if (body.status === 'done') {
        task.progress = 100;
        task.notes.unshift(`Task completed by ${task.assignee} at ${detroitTime}`);
        addMessage('System', 'all', `✅ ${task.assignee} completed: ${task.title}`, 'all');
        // Bug 3b fix: Notify Ned via openclaw CLI
        try {
          const notifyMsg = `TASK COMPLETE: ${task.title} by ${task.assignee}`.replace(/"/g, '\\"').substring(0, 500);
          exec(
            `openclaw agent --agent ned --message "${notifyMsg}"`,
            { timeout: 30000, cwd: '/home/slimy' },
            (error) => {
              if (error) console.error('[tasks] Ned notification failed:', error.message);
            }
          );
        } catch (e) {
          console.error('[tasks] Ned notification error:', e);
        }
      }
    }

    fileStore.writeTasks(board);
    appEmitter.emit('task_update', board);

    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update task' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const taskId = parseInt(id);

    const board = fileStore.readTasks();
    const taskIndex = board.tasks.findIndex(t => t.id === taskId);

    if (taskIndex === -1) {
      return NextResponse.json({ error: 'Task not found' }, { status: 404 });
    }

    board.tasks.splice(taskIndex, 1);
    board.last_updated = new Date().toISOString();

    fileStore.writeTasks(board);

    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete task' }, { status: 500 });
  }
}
