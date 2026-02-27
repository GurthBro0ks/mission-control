"use client";

import { useState, useEffect, useRef } from 'react';

interface Message {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  timestamp: string;
  channel: string;
  type: string;
}

const AGENT_COLORS: Record<string, string> = {
  'Ned': '#22d3ee',
  'Rex': '#ef4444',
  'Atlas': '#a78bfa',
  'Sentinel': '#f87171',
  'Git': '#34d399',
  'Scout': '#fbbf24',
  'Query': '#60a5fa',
  'Cloud': '#c084fc',
  'Pip': '#4ade80',
  'Gurth': '#f59e0b',
};

const CHANNELS = [
  { id: 'all',         label: 'All',            filter: (_m: Message) => true },
  { id: 'ned',         label: 'Ned',            filter: (m: Message) =>
    (m.to_agent === 'Ned' || m.from_agent === 'Ned') && m.channel !== 'watercooler'
  },
  { id: 'watercooler', label: 'Watercooler',    filter: (m: Message) => m.channel === 'watercooler' },
  { id: 'project',     label: 'Projects',       filter: (m: Message) => m.channel === 'project' },
  { id: 'briefing',    label: 'Daily Briefing', filter: (m: Message) => m.channel === 'briefing' },
  { id: 'notifications', label: 'Notifications', filter: (m: Message) =>
    m.from_agent === 'System' || m.message.includes('merge') || m.message.includes('PR') || m.message.includes('optimize') || m.message.includes('backup')
  },
];

const CHANNEL_SEND: Record<string, string> = {
  all: 'all', ned: 'all', watercooler: 'watercooler', project: 'project', briefing: 'briefing', notifications: 'notifications',
};

function formatDetroitTime(timestamp: string): string {
  const ts = timestamp.endsWith('Z') ? timestamp : timestamp + 'Z';
  return new Date(ts).toLocaleString('en-US', {
    timeZone: 'America/Detroit',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }) + ' ET';
}

function renderMessageText(text: string): React.ReactNode {
  const MENTION_RE = /@(Gurth|Ned|Rex|Atlas|Sentinel|Git|Scout|Query|Cloud|Pip)/g;
  const parts = text.split(MENTION_RE);
  return parts.map((part, i) => {
    if (AGENT_COLORS[part]) {
      return <strong key={i} style={{ color: AGENT_COLORS[part] }}>@{part}</strong>;
    }
    return part;
  });
}

export default function CommsPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [activeChannel, setActiveChannel] = useState('all');
  const [onlineAgents, setOnlineAgents] = useState<string[]>(['Ned']);
  const [liveTime, setLiveTime] = useState('');
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Live Detroit clock
  useEffect(() => {
    const tick = () => {
      const now = new Date();
      setLiveTime(now.toLocaleString('en-US', {
        timeZone: 'America/Detroit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: true,
      }) + ' ET');
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);

  // Fetch messages on load
  useEffect(() => {
    fetch('/mission-control/api/comms?limit=200')
      .then(res => res.json())
      .then(data => setMessages(data.messages || []));
  }, []);

  // SSE connection for real-time updates
  useEffect(() => {
    const eventSource = new EventSource('/mission-control/api/sse');

    eventSource.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data);
        if (d.type === 'new_message' && d.data) {
          setMessages(prev => [...prev, d.data]);
        }
      } catch {
        // ignore parse errors (ping frames etc.)
      }
    });

    return () => {
      eventSource.close();
    };
  }, []);

  // Auto-scroll to bottom whenever messages change or channel switches
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, activeChannel]);

  // Recompute unread counts whenever messages change
  useEffect(() => {
    const counts: Record<string, number> = {};
    for (const ch of CHANNELS) {
      const raw = typeof window !== 'undefined' ? localStorage.getItem(`lastRead_${ch.id}`) : null;
      const lastRead = raw ? new Date(raw) : new Date(0);
      counts[ch.id] = messages.filter(m => {
        if (!ch.filter(m)) return false;
        const ts = m.timestamp.endsWith('Z') ? m.timestamp : m.timestamp + 'Z';
        return new Date(ts) > lastRead;
      }).length;
    }
    setUnreadCounts(counts);
  }, [messages]);

  const switchChannel = (id: string) => {
    setActiveChannel(id);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`lastRead_${id}`, new Date().toISOString());
    }
    setUnreadCounts(prev => ({ ...prev, [id]: 0 }));
  };

  const activeCh = CHANNELS.find(c => c.id === activeChannel)!;
  const filteredMessages = messages.filter(activeCh.filter);

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {/* AIM Window Frame */}
      <div style={{
        background: '#0a0f0a',
        borderRadius: '8px',
        overflow: 'hidden',
        border: '3px solid #0d1f0d',
      }}>
        {/* Title Bar */}
        <div style={{
          background: 'linear-gradient(180deg, #5ae67a 0%, #2cb84c 50%, #1a8a38 100%)',
          padding: '8px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}>
          {/* Traffic Lights */}
          <div style={{ display: 'flex', gap: '6px' }}>
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ff5f56' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#ffbd2e' }} />
            <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: '#27c93f' }} />
          </div>
          <div style={{
            flex: 1,
            textAlign: 'center',
            color: '#fff',
            fontWeight: 'bold',
            fontSize: '14px',
            textShadow: '1px 1px 2px rgba(0,0,0,0.5)',
          }}>
            🧪 SlimyAI Messenger — Agent Comms
          </div>
          <div style={{ width: '36px' }} />
        </div>

        {/* Buddy List Bar */}
        <div style={{
          background: 'linear-gradient(180deg, #1a3a1a 0%, #0d1f0d 100%)',
          padding: '6px 12px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          overflowX: 'auto',
          borderBottom: '2px solid #0d1f0d',
        }}>
          {onlineAgents.map(agent => (
            <div key={agent} style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              background: '#2a4a2a',
              padding: '2px 8px',
              borderRadius: '10px',
              fontSize: '11px',
              color: '#5ae67a',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#5ae67a' }} />
              {agent}
            </div>
          ))}
          <div style={{ marginLeft: 'auto', fontSize: '11px', color: '#5ae67a' }}>
            {onlineAgents.length} online
          </div>
        </div>

        {/* Channel Tabs */}
        <div style={{ background: '#0d1f0d', display: 'flex', gap: '0', borderBottom: '1px solid #0a1a0a' }}>
          {CHANNELS.map(ch => {
            const isActive = activeChannel === ch.id;
            const unread = unreadCounts[ch.id] || 0;
            return (
              <button key={ch.id} onClick={() => switchChannel(ch.id)} style={{
                background: isActive ? '#1a4a1a' : 'transparent',
                border: 'none',
                borderBottom: isActive ? '2px solid #4ade80' : '2px solid transparent',
                color: isActive ? '#4ade80' : '#2a5a2a',
                padding: '6px 10px',
                fontSize: '11px',
                cursor: 'pointer',
                position: 'relative',
                fontFamily: 'monospace',
              }}>
                {ch.label}
                {unread > 0 && <span style={{
                  position: 'absolute', top: '2px', right: '2px',
                  background: '#ef4444', color: '#fff',
                  borderRadius: '50%', width: '12px', height: '12px',
                  fontSize: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{unread > 9 ? '9+' : unread}</span>}
              </button>
            );
          })}
        </div>

        {/* Slime Drips */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          padding: '4px 20px',
          background: '#0d1f0d',
        }}>
          {[...Array(8)].map((_, i) => (
            <div key={i} style={{
              width: '8px',
              height: '20px',
              background: `linear-gradient(180deg, #5ae67a ${20 + i * 5}%, #2cb84c ${60 + i * 5}%, transparent 100%)`,
              borderRadius: '0 0 4px 4px',
              animation: `slimeDrip 2s ease-in-out infinite`,
              animationDelay: `${i * 0.2}s`,
            }} />
          ))}
        </div>

        <style>{`
          @keyframes slimeDrip {
            0% { transform: translateY(-8px) scaleY(0.3); opacity: 0; }
            20% { transform: translateY(0) scaleY(1); opacity: 1; }
            80% { transform: scaleY(1.1); opacity: 1; }
            100% { transform: translateY(20px) scaleY(0.5); opacity: 0; }
          }
          @keyframes gurthPulse {
            0%,100% { box-shadow: 0 0 4px #f59e0b44; }
            50%      { box-shadow: 0 0 12px #f59e0b88; }
          }
        `}</style>

        {/* Chat Area */}
        <div style={{
          height: '400px',
          overflowY: 'auto',
          background: 'linear-gradient(180deg, #0a0f0a 0%, #080d08 100%)',
          borderLeft: '3px solid #0d1f0d',
          borderRight: '3px solid #0d1f0d',
          padding: '12px',
        }}>
          {filteredMessages.length === 0 ? (
            <div style={{ color: '#2a5a2a', textAlign: 'center', marginTop: '100px' }}>
              No messages yet. Start chatting!
            </div>
          ) : (
            filteredMessages.map(msg => {
              const isGurth = msg.from_agent === 'Gurth';
              const hasGurthMention = msg.message.includes('@Gurth');
              return (
                <div key={msg.id} style={{
                  marginBottom: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: isGurth ? 'flex-end' : 'flex-start',
                  animation: hasGurthMention ? 'gurthPulse 2s infinite' : undefined,
                }}>
                  {/* Header: name + timestamp */}
                  <div style={{
                    display: 'flex',
                    alignItems: 'baseline',
                    gap: '8px',
                    marginBottom: '4px',
                    flexDirection: isGurth ? 'row-reverse' : 'row',
                  }}>
                    <span style={{ fontWeight: 'bold', color: AGENT_COLORS[msg.from_agent] || '#5ae67a', fontSize: '12px' }}>
                      {msg.from_agent}
                    </span>
                    <span style={{ color: '#2a5a2a', fontSize: '10px' }}>{formatDetroitTime(msg.timestamp)}</span>
                  </div>
                  {/* Body */}
                  <div style={{
                    borderLeft: isGurth ? 'none' : `3px solid ${AGENT_COLORS[msg.from_agent] || '#5ae67a'}`,
                    borderRight: isGurth ? `3px solid ${AGENT_COLORS['Gurth']}` : 'none',
                    background: isGurth ? '#22d3ee10' : 'transparent',
                    borderRadius: isGurth ? '8px 0 0 8px' : '0 8px 8px 0',
                    color: '#e2e8f0',
                    fontSize: '13px',
                    maxWidth: '90%',
                    padding: '6px 10px',
                    ...(hasGurthMention ? { border: '1px solid #f59e0b', borderRadius: '6px' } : {}),
                  }}>
                    {renderMessageText(msg.message)}
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar - Read-only mode */}
        <div style={{
          background: 'linear-gradient(180deg, #0d1f0d 0%, #1a3a1a 100%)',
          padding: '12px',
          borderTop: '1px solid #2a5a2a',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}>
          <span style={{ color: '#2a5a2a', fontSize: '11px', fontStyle: 'italic' }}>
            📖 Comms feed is read-only — agents post automatically
          </span>
        </div>

        {/* Status Bar */}
        <div style={{
          background: '#0d1f0d',
          padding: '4px 12px',
          fontSize: '9px',
          color: '#2a5a2a',
          display: 'flex',
          justifyContent: 'space-between',
        }}>
          <span>🧪 SlimyAI Messenger v2.0</span>
          <span>Channel: {CHANNELS.find(c => c.id === activeChannel)?.label}</span>
          <span>Detroit: {liveTime}</span>
        </div>
      </div>
    </div>
  );
}
