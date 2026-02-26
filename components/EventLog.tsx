"use client";

import { useState } from 'react';
import { formatSafeDateTime } from '@/lib/date-utils';

interface Event {
  id: number;
  type: string;
  source: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface EventLogProps {
  events: Event[];
}

const TYPE_COLORS: Record<string, string> = {
  mission_created: '#22c55e',
  mission_in_progress: '#3b82f6',
  mission_completed: '#22c55e',
  mission_failed: '#ef4444',
  proposal_created: '#fbbf24',
  proposal_approved: '#22c55e',
  proposal_rejected: '#ef4444',
  step_completed: '#22c55e',
  step_failed: '#ef4444',
  reaction: '#a78bfa',
  heartbeat: '#6b7280',
  default: '#9ca3af',
};

export default function EventLog({ events }: EventLogProps) {
  const [filterType, setFilterType] = useState('');
  const [filterSource, setFilterSource] = useState('');
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filteredEvents = events.filter(event => {
    if (filterType && !event.type.toLowerCase().includes(filterType.toLowerCase())) {
      return false;
    }
    if (filterSource && !event.source.toLowerCase().includes(filterSource.toLowerCase())) {
      return false;
    }
    return true;
  });

  const uniqueTypes = [...new Set(events.map(e => e.type))];
  const uniqueSources = [...new Set(events.map(e => e.source))];

  return (
    <div>
      {/* Filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '16px',
        }}
      >
        <input
          type="text"
          placeholder="Filter by type..."
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#1a1a2e',
            border: '1px solid #1a1a2e',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '12px',
            outline: 'none',
          }}
        />
        <input
          type="text"
          placeholder="Filter by source..."
          value={filterSource}
          onChange={(e) => setFilterSource(e.target.value)}
          style={{
            flex: 1,
            padding: '8px 12px',
            background: '#1a1a2e',
            border: '1px solid #1a1a2e',
            borderRadius: '6px',
            color: '#e2e8f0',
            fontSize: '12px',
            outline: 'none',
          }}
        />
      </div>

      {/* Event list */}
      <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
        {filteredEvents.length === 0 ? (
          <div
            style={{
              textAlign: 'center',
              padding: '40px',
              color: '#6b7280',
              fontSize: '14px',
            }}
          >
            No events found
          </div>
        ) : (
          filteredEvents.map(event => {
            const typeColor = TYPE_COLORS[event.type] || TYPE_COLORS.default;
            const isExpanded = expandedId === event.id;

            return (
              <div
                key={event.id}
                style={{
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '6px',
                  marginBottom: '8px',
                  overflow: 'hidden',
                }}
              >
                {/* Event header - clickable */}
                <div
                  onClick={() => setExpandedId(isExpanded ? null : event.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    padding: '10px 12px',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.background = '#0c0c14';
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.background = 'transparent';
                  }}
                >
                  {/* Type badge */}
                  <span
                    style={{
                      display: 'inline-flex',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: `${typeColor}22`,
                      color: typeColor,
                      fontSize: '10px',
                      fontWeight: 600,
                      textTransform: 'uppercase',
                      flexShrink: 0,
                    }}
                  >
                    {event.type}
                  </span>

                  {/* Source */}
                  <span
                    style={{
                      fontSize: '11px',
                      color: '#9ca3af',
                      flexShrink: 0,
                    }}
                  >
                    from {event.source}
                  </span>

                  {/* Timestamp */}
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      marginLeft: 'auto',
                      flexShrink: 0,
                    }}
                  >
                    {formatSafeDateTime(event.created_at)}
                  </span>

                  {/* Expand indicator */}
                  <span
                    style={{
                      fontSize: '10px',
                      color: '#6b7280',
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? '▼' : '▶'}
                  </span>
                </div>

                {/* Expanded JSON data */}
                {isExpanded && event.data && (
                  <div
                    style={{
                      padding: '12px',
                      background: '#050508',
                      borderTop: '1px solid #1a1a2e',
                    }}
                  >
                    <pre
                      style={{
                        margin: 0,
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#9ca3af',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                      }}
                    >
                      {JSON.stringify(event.data, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
