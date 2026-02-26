"use client";

import { useState, useEffect, useRef } from 'react';

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

const AGENT_COLORS: Record<string, string> = {
  ned: '#22d3ee',
  gurth: '#f59e0b',
  rex: '#ef4444',
  atlas: '#a78bfa',
  sentinel: '#f87171',
  git: '#34d399',
  scout: '#fbbf24',
  query: '#60a5fa',
  cloud: '#c084fc',
  pip: '#4ade80',
  system: '#94a3b8',
};

const TYPE_STYLES = {
  assignment: {
    bg: '#22d3ee08',
    icon: '📝',
    label: 'Assignment',
  },
  delegation: {
    bg: '#a78bfa08',
    icon: '👉',
    label: 'Delegation',
  },
  completion: {
    bg: '#4ade8008',
    icon: '✅',
    label: 'Completion',
  },
  status: {
    bg: '#94a3b808',
    icon: '📊',
    label: 'Status',
  },
};

const FILTERS = [
  { type: undefined, label: 'All' },
  { type: 'assignment', label: 'Assignments' },
  { type: 'delegation', label: 'Delegations' },
  { type: 'completion', label: 'Completions' },
  { type: 'status', label: 'Status Updates' },
];

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

export default function BulletinPage() {
  const [entries, setEntries] = useState<BulletinEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState<string | undefined>(undefined);
  const [hasMore, setHasMore] = useState(false);
  const offsetRef = useRef(0);
  const newEntryIdsRef = useRef<Set<string>>(new Set());

  const fetchEntries = async (reset = false) => {
    try {
      const offset = reset ? 0 : offsetRef.current;
      const params = new URLSearchParams();
      params.set('limit', '20');
      params.set('offset', offset.toString());
      if (activeFilter) {
        params.set('type', activeFilter);
      }

      const res = await fetch(`/api/bulletin?${params}`);
      const data = await res.json();

      if (reset) {
        setEntries(data.entries);
        offsetRef.current = 20;
      } else {
        setEntries(prev => [...prev, ...data.entries]);
        offsetRef.current += 20;
      }

      setTotal(data.total);
      setHasMore(entries.length + data.entries.length < data.total);
    } catch (error) {
      console.error('Failed to fetch bulletin entries:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    offsetRef.current = 0;
    setLoading(true);
    fetchEntries(true);
  }, [activeFilter]);

  // SSE for live updates
  useEffect(() => {
    const es = new EventSource('/api/sse');
    es.addEventListener('message', (e) => {
      try {
        const eventData = JSON.parse(e.data);
        if (eventData.type === 'task_update') {
          // Fetch new entries on task update
          offsetRef.current = 0;
          fetchEntries(true).then(() => {
            // Mark entries as new with animation
            const firstFewIds = new Set(entries.slice(0, 3).map((_, i) => i.toString()));
            newEntryIdsRef.current = firstFewIds;
            setTimeout(() => {
              newEntryIdsRef.current = new Set();
            }, 1000);
          });
        }
        if (eventData.type === 'new_message') {
          // Fetch new entries on new message
          offsetRef.current = 0;
          fetchEntries(true);
        }
      } catch (err) {
        // Ignore parse errors
      }
    });
    es.addEventListener('connected', () => {
      console.log('SSE connected');
    });

    return () => es.close();
  }, []);

  const loadMore = () => {
    fetchEntries(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">
          📌 Bulletin Board — Team Activity
        </h1>
        <p className="text-gray-400 text-sm">
          Aggregated from tasks and system communications
        </p>
      </div>

      {/* Filter Pills */}
      <div className="flex flex-wrap gap-2 mb-6">
        {FILTERS.map((filter) => (
          <button
            key={filter.label}
            onClick={() => setActiveFilter(filter.type)}
            className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
              activeFilter === filter.type
                ? 'bg-[#22d3ee] text-black font-medium'
                : 'bg-[#1a1a2e] text-gray-400 hover:text-white hover:bg-[#2a2a3e]'
            }`}
          >
            {filter.label}
          </button>
        ))}
      </div>

      {/* Stats */}
      <div className="mb-4 text-sm text-gray-500">
        Showing {entries.length} of {total} entries
      </div>

      {/* Activity Feed */}
      {loading && entries.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">Loading...</div>
        </div>
      ) : entries.length === 0 ? (
        <div className="flex items-center justify-center py-12">
          <div className="text-gray-400">No activity yet</div>
        </div>
      ) : (
        <div className="grid gap-4">
          {entries.map((entry, index) => {
            const agentColor = AGENT_COLORS[entry.agent] || '#94a3b8';
            const typeStyle = TYPE_STYLES[entry.type];
            const rotation = ((index % 5) - 2) * 0.5;
            const isNew = newEntryIdsRef.current.has(index.toString());

            return (
              <div
                key={`${entry.timestamp}-${index}`}
                className="relative p-4 rounded-lg border-l-4 shadow-sm"
                style={{
                  backgroundColor: typeStyle.bg,
                  borderLeftColor: agentColor,
                  transform: `rotate(${rotation}deg)`,
                  animation: isNew ? 'slideDown 0.3s ease-out' : 'none',
                }}
              >
                {/* Card Header */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{typeStyle.icon}</span>
                    <span
                      className="text-sm font-medium"
                      style={{ color: agentColor }}
                    >
                      {entry.agent}
                    </span>
                    <span className="text-gray-500 text-xs">
                      {formatRelativeTime(entry.timestamp)}
                    </span>
                  </div>
                  <span className="text-xs text-gray-500 px-2 py-0.5 rounded bg-[#1a1a2e]">
                    {typeStyle.label}
                  </span>
                </div>

                {/* Message */}
                <p className="text-gray-200 text-sm mb-2">
                  {entry.message}
                </p>

                {/* Related Task */}
                {entry.relatedTask && (
                  <div className="flex items-center gap-2 mt-3 pt-2 border-t border-[#1a1a2e]">
                    <span
                      className="text-xs px-1.5 py-0.5 rounded"
                      style={{
                        backgroundColor:
                          entry.relatedTask.priority === 'high'
                            ? '#ef444420'
                            : entry.relatedTask.priority === 'medium'
                            ? '#f59e0b20'
                            : '#64748b20',
                        color:
                          entry.relatedTask.priority === 'high'
                            ? '#ef4444'
                            : entry.relatedTask.priority === 'medium'
                            ? '#f59e0b'
                            : '#64748b',
                      }}
                    >
                      {entry.relatedTask.priority}
                    </span>
                    <span className="text-xs text-gray-400">
                      #{entry.relatedTask.id} {entry.relatedTask.title}
                    </span>
                  </div>
                )}

                {/* Channel */}
                {entry.channel && (
                  <div className="mt-2 text-xs text-gray-500">
                    via {entry.channel}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Load More */}
      {hasMore && !loading && (
        <div className="flex justify-center mt-6">
          <button
            onClick={loadMore}
            className="px-6 py-2 text-sm bg-[#1a1a2e] text-gray-300 rounded-lg hover:bg-[#2a2a3e] transition-colors"
          >
            Load More
          </button>
        </div>
      )}

      {/* Loading indicator */}
      {loading && entries.length > 0 && (
        <div className="flex justify-center mt-4">
          <div className="text-gray-400 text-sm">Loading more...</div>
        </div>
      )}

      <style jsx>{`
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px) rotate(0deg);
          }
          to {
            opacity: 1;
            transform: translateY(0) rotate(var(--rotation, 0deg));
          }
        }
      `}</style>
    </div>
  );
}
