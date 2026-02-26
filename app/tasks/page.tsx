"use client";

import { useState, useEffect, useRef } from 'react';

interface Task {
  id: number;
  title: string;
  description: string;
  status: 'todo' | 'in_progress' | 'done';
  assignee: string;
  priority: 'low' | 'medium' | 'high';
  created_at: string;
  updated_at: string;
  delegated_to: string | null;
  progress: number;
  notes: string[];
}

interface TaskBoard {
  board_name: string;
  tasks: Task[];
}

const AGENTS = [
  { id: 'ned', name: 'Ned' },
  { id: 'rex', name: 'Rex' },
  { id: 'atlas', name: 'Atlas' },
  { id: 'sentinel', name: 'Sentinel' },
  { id: 'git', name: 'Git' },
  { id: 'scout', name: 'Scout' },
  { id: 'query', name: 'Query' },
  { id: 'cloud', name: 'Cloud' },
  { id: 'pip', name: 'Pip' },
];

const AGENT_COLORS: Record<string, string> = {
  ned: '#22d3ee',
  rex: '#ef4444',
  atlas: '#a78bfa',
  sentinel: '#f87171',
  git: '#34d399',
  scout: '#fbbf24',
  query: '#60a5fa',
  cloud: '#c084fc',
  pip: '#4ade80',
};

const PRIORITY_COLORS = {
  high: '#ef4444',
  medium: '#f59e0b',
  low: '#64748b',
};

const STATUS_ORDER = ['todo', 'in_progress', 'done'];

export default function TasksPage() {
  const [board, setBoard] = useState<TaskBoard | null>(null);
  const [activeTab, setActiveTab] = useState<'todo' | 'in_progress' | 'done'>('todo');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [flashIds, setFlashIds] = useState<Set<number>>(new Set());
  const prevTasksRef = useRef<Task[]>([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignee: 'ned',
    priority: 'medium' as 'low' | 'medium' | 'high',
  });

  useEffect(() => {
    fetchTasks();
  }, []);

  // SSE listener for real-time updates
  useEffect(() => {
    const es = new EventSource('/api/sse');
    es.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'task_update') fetchTasks();
      } catch {}
    });
    return () => es.close();
  }, []);

  const fetchTasks = async () => {
    try {
      const res = await fetch('/api/tasks');
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      // Detect changed tasks for flash highlight
      const prev = prevTasksRef.current;
      if (prev.length > 0 && data.tasks) {
        const changedIds = new Set<number>();
        data.tasks.forEach((t: Task) => {
          const old = prev.find(p => p.id === t.id);
          if (!old || old.updated_at !== t.updated_at) changedIds.add(t.id);
        });
        if (changedIds.size > 0) {
          setFlashIds(changedIds);
          setTimeout(() => setFlashIds(new Set()), 1500);
        }
      }
      prevTasksRef.current = data.tasks || [];
      setBoard(data);
    } catch (err) {
      console.error('Error fetching tasks:', err);
    }
  };

  const getCounts = () => {
    if (!board) return { todo: 0, in_progress: 0, done: 0 };
    return {
      todo: board.tasks.filter(t => t.status === 'todo').length,
      in_progress: board.tasks.filter(t => t.status === 'in_progress').length,
      done: board.tasks.filter(t => t.status === 'done').length,
    };
  };

  const cycleStatus = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextStatus = STATUS_ORDER[(currentIndex + 1) % STATUS_ORDER.length];

    // Post to comms when task moves to in_progress or done
    if (nextStatus === 'in_progress' || nextStatus === 'done') {
      const msg = nextStatus === 'in_progress'
        ? `Task started — ${task.title} assigned to ${task.assignee}`
        : `Task completed — ${task.title}`;
      fetch('/api/comms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: 'System',
          to: 'all',
          message: msg,
          channel: 'notifications',
        }),
      }).catch(() => {});
    }

    await fetch(`/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    fetchTasks();
  };

  const deleteTask = async (taskId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!window.confirm('Delete this task?')) return;
    await fetch(`/api/tasks/${taskId}`, { method: 'DELETE' });
    fetchTasks();
  };

  const handleSave = async () => {
    if (!editingTask) return;

    await fetch(`/api/tasks/${editingTask.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: editingTask.title,
        description: editingTask.description,
        assignee: editingTask.assignee,
        priority: editingTask.priority,
        status: editingTask.status,
        delegated_to: editingTask.delegated_to,
        progress: editingTask.progress,
        notes: editingTask.notes,
      }),
    });
    setEditingTask(null);
    fetchTasks();
  };

  const handleCreate = async () => {
    await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    });
    setShowNewModal(false);
    setFormData({ title: '', description: '', assignee: 'ned', priority: 'medium' });
    fetchTasks();
  };

  const agentColor = (name: string) => AGENT_COLORS[name.toLowerCase()] || '#6b7280';

  const counts = getCounts();
  const filteredTasks = board?.tasks.filter(t => t.status === activeTab) || [];

  return (
    <div>
      <style>{`
        @keyframes shimmer {
          0% { background-position: -200px 0; }
          100% { background-position: 200px 0; }
        }
        .shimmer-bar {
          background: linear-gradient(90deg, #1a1a2e 25%, #22d3ee44 50%, #1a1a2e 75%);
          background-size: 400px 100%;
          animation: shimmer 1.5s infinite;
        }
        select option { background: #0a0a0f; }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#22d3ee', margin: 0 }}>
            📋 Task Board
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            {counts.todo} queued · {counts.in_progress} active · {counts.done} complete
          </p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          style={{
            background: '#22d3ee',
            border: 'none',
            color: '#000',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontWeight: 'bold',
          }}
        >
          + New Task
        </button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #1a1a2e', paddingBottom: '8px' }}>
        {(['todo', 'in_progress', 'done'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              background: activeTab === tab ? '#1a1a2e' : 'transparent',
              border: 'none',
              color: activeTab === tab ? '#22d3ee' : '#6b7280',
              padding: '8px 16px',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              borderBottom: activeTab === tab ? '2px solid #22d3ee' : '2px solid transparent',
            }}
          >
            {tab === 'todo' ? 'Queued' : tab === 'in_progress' ? 'In Progress' : 'Complete'} ({counts[tab]})
          </button>
        ))}
      </div>

      {/* Task Cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {filteredTasks.length === 0 ? (
          <div style={{ color: '#6b7280', textAlign: 'center', padding: '40px' }}>
            No tasks in this stage
          </div>
        ) : (
          filteredTasks.map(task => {
            const aColor = agentColor(task.assignee);
            const isFlashing = flashIds.has(task.id);
            const isShimmer = isFlashing && task.status === 'in_progress';
            return (
              <div
                key={task.id}
                onClick={() => setEditingTask({ ...task })}
                style={{
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '8px',
                  padding: '14px 16px 10px',
                  cursor: 'pointer',
                  outline: isFlashing ? '1px solid #22d3ee' : 'none',
                  transition: 'outline 0.3s',
                }}
              >
                {/* Top row */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                  {/* Priority dot */}
                  <div style={{
                    width: '10px', height: '10px', borderRadius: '50%', flexShrink: 0,
                    background: PRIORITY_COLORS[task.priority],
                    boxShadow: `0 0 8px ${PRIORITY_COLORS[task.priority]}66`,
                  }} />

                  {/* Title */}
                  <div style={{
                    flex: 1,
                    fontWeight: 'bold',
                    color: task.status === 'done' ? '#6b7280' : '#e2e8f0',
                    textDecoration: task.status === 'done' ? 'line-through' : 'none',
                    fontSize: '14px',
                  }}>
                    {task.title}
                  </div>

                  {/* Assignee pill */}
                  <span style={{
                    background: aColor + '22',
                    color: aColor,
                    border: `1px solid ${aColor}44`,
                    borderRadius: '12px',
                    padding: '2px 8px',
                    fontSize: '11px',
                    fontWeight: 600,
                    flexShrink: 0,
                  }}>
                    {task.assignee}
                  </span>

                  {/* Delegated-to pill */}
                  {task.delegated_to && (
                    <span style={{
                      background: agentColor(task.delegated_to) + '22',
                      color: agentColor(task.delegated_to),
                      border: `1px solid ${agentColor(task.delegated_to)}44`,
                      borderRadius: '12px',
                      padding: '2px 8px',
                      fontSize: '11px',
                      flexShrink: 0,
                    }}>
                      → {task.delegated_to}
                    </span>
                  )}

                  {/* Cycle status button */}
                  <button
                    onClick={(e) => cycleStatus(task, e)}
                    style={{
                      background: '#1a1a2e', border: 'none', color: '#22d3ee',
                      width: '28px', height: '28px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '14px', flexShrink: 0,
                    }}
                    title="Cycle status"
                  >
                    →
                  </button>
                  <button
                    onClick={(e) => deleteTask(task.id, e)}
                    style={{
                      background: '#1a1a2e', border: 'none', color: '#ef4444',
                      width: '28px', height: '28px', borderRadius: '6px',
                      cursor: 'pointer', fontSize: '12px', flexShrink: 0,
                    }}
                    title="Delete"
                  >
                    ✕
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ height: '4px', borderRadius: '2px', background: '#1a1a2e', marginBottom: '8px', overflow: 'hidden' }}>
                  {isShimmer ? (
                    <div className="shimmer-bar" style={{ height: '100%', width: '100%' }} />
                  ) : (
                    <div style={{
                      height: '100%',
                      width: `${task.progress}%`,
                      background: aColor,
                      borderRadius: '2px',
                      transition: 'width 0.4s ease',
                    }} />
                  )}
                </div>

                {/* Bottom: date + latest note */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '11px', color: '#6b7280', flexShrink: 0 }}>
                    {new Date(task.created_at).toLocaleDateString()}
                  </span>
                  {task.notes.length > 0 && (
                    <span style={{
                      fontSize: '11px', color: '#4b5563', fontStyle: 'italic',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {task.notes[0]}
                    </span>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Detail Modal */}
      {editingTask && (
        <div
          onClick={() => setEditingTask(null)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0a0f',
              border: '1px solid #1a1a2e',
              borderRadius: '8px',
              padding: '24px',
              width: '480px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <h2 style={{ color: '#22d3ee', marginBottom: '20px', marginTop: 0 }}>Task Detail</h2>

            {/* Title */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Title</label>
              <input
                type="text"
                value={editingTask.title}
                onChange={e => setEditingTask({ ...editingTask, title: e.target.value })}
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>

            {/* Description */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Description</label>
              <textarea
                value={editingTask.description}
                onChange={e => setEditingTask({ ...editingTask, description: e.target.value })}
                rows={3}
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            {/* Assignee + Priority */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Assignee</label>
                <select
                  value={editingTask.assignee}
                  onChange={e => setEditingTask({ ...editingTask, assignee: e.target.value })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Priority</label>
                <select
                  value={editingTask.priority}
                  onChange={e => setEditingTask({ ...editingTask, priority: e.target.value as any })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
            </div>

            {/* Status + Delegated To */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Status</label>
                <select
                  value={editingTask.status}
                  onChange={e => setEditingTask({ ...editingTask, status: e.target.value as any })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  <option value="todo">Queued</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Complete</option>
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Delegated To</label>
                <select
                  value={editingTask.delegated_to || ''}
                  onChange={e => setEditingTask({ ...editingTask, delegated_to: e.target.value || null })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  <option value="">None</option>
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
            </div>

            {/* Progress slider */}
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                Progress — <span style={{ color: agentColor(editingTask.assignee) }}>{editingTask.progress}%</span>
              </label>
              <div style={{ height: '6px', borderRadius: '3px', background: '#1a1a2e', width: '100%' }}>
                <div style={{
                  height: '100%',
                  width: `${editingTask.progress}%`,
                  background: agentColor(editingTask.assignee),
                  borderRadius: '3px',
                }} />
              </div>
            </div>

            {/* Activity log */}
            {editingTask.notes.length > 0 && (
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '6px' }}>Activity Log</label>
                <div style={{
                  background: '#0d0d16', border: '1px solid #1a1a2e', borderRadius: '4px',
                  padding: '8px 10px', maxHeight: '120px', overflowY: 'auto',
                }}>
                  {editingTask.notes.map((note, i) => (
                    <div key={i} style={{
                      fontSize: '11px', fontFamily: 'monospace', color: '#4b5563',
                      paddingBottom: i < editingTask.notes.length - 1 ? '4px' : 0,
                      borderBottom: i < editingTask.notes.length - 1 ? '1px solid #1a1a2e' : 'none',
                      marginBottom: i < editingTask.notes.length - 1 ? '4px' : 0,
                    }}>
                      {note}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buttons */}
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleSave}
                style={{
                  flex: 1, background: '#22d3ee', border: 'none', color: '#000',
                  padding: '10px', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold',
                }}
              >
                Save
              </button>
              <button
                onClick={() => setEditingTask(null)}
                style={{
                  flex: 1, background: '#1a1a2e', border: 'none', color: '#e2e8f0',
                  padding: '10px', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Delete this task?')) return;
                  await fetch(`/api/tasks/${editingTask.id}`, { method: 'DELETE' });
                  setEditingTask(null);
                  fetchTasks();
                }}
                style={{
                  background: '#ef444422', border: '1px solid #ef444444', color: '#ef4444',
                  padding: '10px 16px', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Task Modal */}
      {showNewModal && (
        <div
          onClick={() => setShowNewModal(false)}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            zIndex: 100,
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#0a0a0f', border: '1px solid #1a1a2e',
              borderRadius: '8px', padding: '24px', width: '400px',
            }}
          >
            <h2 style={{ color: '#22d3ee', marginBottom: '20px', marginTop: 0 }}>New Task</h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Title</label>
              <input
                type="text"
                autoFocus
                value={formData.title}
                onChange={e => setFormData({ ...formData, title: e.target.value })}
                onKeyDown={e => e.key === 'Enter' && formData.title && handleCreate()}
                placeholder="Task title..."
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Assignee</label>
                <select
                  value={formData.assignee}
                  onChange={e => setFormData({ ...formData, assignee: e.target.value })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  {AGENTS.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Priority</label>
                <select
                  value={formData.priority}
                  onChange={e => setFormData({ ...formData, priority: e.target.value as any })}
                  style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px' }}
                >
                  <option value="high">🔴 High</option>
                  <option value="medium">🟡 Medium</option>
                  <option value="low">⚪ Low</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>Description (optional)</label>
              <textarea
                value={formData.description}
                onChange={e => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                placeholder="Task description..."
                style={{ width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0', padding: '8px 12px', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreate}
                disabled={!formData.title}
                style={{
                  flex: 1,
                  background: formData.title ? '#22d3ee' : '#1a1a2e',
                  border: 'none',
                  color: formData.title ? '#000' : '#6b7280',
                  padding: '10px', borderRadius: '6px',
                  cursor: formData.title ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Add Task
              </button>
              <button
                onClick={() => setShowNewModal(false)}
                style={{
                  flex: 1, background: '#1a1a2e', border: 'none', color: '#e2e8f0',
                  padding: '10px', borderRadius: '6px', cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
