import { NextResponse } from 'next/server';
import { fileStore, Task, TaskBoard } from '@/lib/fileStore';
import { exec } from 'child_process';

export async function GET() {
  try {
    const board = fileStore.readTasks();
    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to read tasks' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, assignee, priority } = body;
    
    const board = fileStore.readTasks();
    
    // Generate new ID
    const newId = board.tasks.length > 0 
      ? Math.max(...board.tasks.map(t => t.id)) + 1 
      : 1;
    
    const now = new Date().toISOString();
    
    const newTask: Task = {
      id: newId,
      title,
      description: description || '',
      status: 'todo',
      assignee: assignee || 'ned',
      priority: priority || 'medium',
      created_at: now,
      updated_at: now,
      delegated_to: null,
      progress: 0,
      notes: [],
    };
    
    board.tasks.push(newTask);
    board.last_updated = now;
    fileStore.writeTasks(board);

    // Bug 3b fix: Notify Ned via openclaw CLI (HTTP hooks are broken)
    try {
      const notifyMsg = `NEW TASK: ${newTask.title} — Assigned: ${newTask.assignee}, Priority: ${newTask.priority}`.replace(/"/g, '\\"').substring(0, 500);
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

    return NextResponse.json(board);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create task' }, { status: 500 });
  }
}
