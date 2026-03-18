'use client';

import { useState, useEffect } from 'react';
import PixelOffice from '@/components/PixelOffice';
import { AGENT_ICONS, AGENT_ROLES, AgentKey } from '@/lib/agent-roles';

interface ScoreboardEntry {
  agent: AgentKey;
  icon: string;
  completed: number;
  streak: number;
}

interface ScoreboardResponse {
  scoreboard: ScoreboardEntry[];
  summary: {
    totalTasks: number;
    avgPerAgent: number;
    mvp: AgentKey | null;
  };
}

function getRankColor(rank: number): string {
  return rank <= 3 ? '#f59e0b' : '#6b7280';
}

function getRankEmoji(rank: number): string {
  if (rank === 1) return '🥇';
  if (rank === 2) return '🥈';
  if (rank === 3) return '🥉';
  return `#${rank}`;
}

export default function OfficePage() {
  const [scoreboard, setScoreboard] = useState<ScoreboardEntry[]>([]);
  const [summary, setSummary] = useState<{ totalTasks: number; avgPerAgent: number; mvp: AgentKey | null }>({
    totalTasks: 0,
    avgPerAgent: 0,
    mvp: null,
  });
  const [loading, setLoading] = useState(true);

  const fetchScoreboard = async () => {
    try {
      const res = await fetch('/mission-control/api/ops/scoreboard');
      const data: ScoreboardResponse = await res.json();
      setScoreboard(data.scoreboard);
      setSummary(data.summary);
    } catch (error) {
      console.error('Failed to fetch scoreboard:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchScoreboard();
    const interval = setInterval(fetchScoreboard, 60000);
    return () => clearInterval(interval);
  }, []);

  const maxCompleted = Math.max(...scoreboard.map(s => s.completed), 1);

  // Split agents into active (tasks > 0) and idle (tasks === 0)
  const activeAgents = scoreboard.filter(entry => entry.completed > 0);
  const idleAgents = scoreboard.filter(entry => entry.completed === 0);
  const hasActiveAgents = activeAgents.length > 0;

  return (
    <div className="main-container" style={{
      display: 'flex',
      flexDirection: 'row',
      minHeight: '100vh',
      backgroundColor: '#0f172a',
      gap: '1rem',
      padding: '1rem'
    }}>
      {/* Left: Pixel Office Canvas */}
      <div className="office-canvas" style={{ flex: '1', minWidth: 0 }}>
        <PixelOffice />
      </div>

      {/* Right: Scoreboard Panel */}
      <div
        className="scoreboard"
        style={{
          width: '340px',
          backgroundColor: '#1e293b',
          borderRadius: '12px',
          padding: '1.25rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
          border: '1px solid #334155',
          maxHeight: 'calc(100vh - 2rem)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div style={{ textAlign: 'center', borderBottom: '1px solid #334155', paddingBottom: '0.75rem' }}>
          <h2 className="scoreboard-title" style={{ color: '#f59e0b', fontSize: '1.1rem', fontWeight: 'bold', margin: 0 }}>
            🏆 SCOREBOARD
          </h2>
        </div>

        {/* Agent Rows */}
        <div style={{ flex: '1', maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {loading ? (
            <div style={{ color: '#94a3b8', textAlign: 'center', padding: '2rem' }}>Loading...</div>
          ) : hasActiveAgents ? (
            activeAgents.map((entry, index) => {
              const rank = index + 1;
              const progress = (entry.completed / maxCompleted) * 100;
              const rankColor = getRankColor(rank);
              const agentName = AGENT_ROLES[entry.agent]?.name || entry.agent;

              return (
                <div
                  key={entry.agent}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.5rem',
                    padding: '0.5rem',
                    borderRadius: '8px',
                    backgroundColor: rank <= 3 ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                    border: rank <= 3 ? '1px solid rgba(245, 158, 11, 0.3)' : '1px solid transparent',
                  }}
                >
                  {/* Rank */}
                  <span style={{ fontSize: '0.9rem', width: '24px', textAlign: 'center', color: rankColor }}>
                    {getRankEmoji(rank)}
                  </span>

                  {/* Icon */}
                  <span style={{ fontSize: '1.1rem', width: '28px', textAlign: 'center' }}>
                    {entry.icon}
                  </span>

                  {/* Agent Name */}
                  <span style={{ color: '#e2e8f0', fontSize: '0.8rem', width: '70px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {agentName}
                  </span>

                  {/* Progress Bar */}
                  <div style={{ flex: '1', height: '12px', backgroundColor: '#334155', borderRadius: '6px', overflow: 'hidden' }}>
                    <div
                      style={{
                        height: '100%',
                        width: `${progress}%`,
                        backgroundColor: rank <= 3 ? '#f59e0b' : '#64748b',
                        borderRadius: '6px',
                        transition: 'width 0.3s ease',
                      }}
                    />
                  </div>

                  {/* Task Count */}
                  <span style={{ color: '#e2e8f0', fontSize: '0.8rem', width: '32px', textAlign: 'right', fontWeight: 'bold' }}>
                    {entry.completed}
                  </span>

                  {/* Streak Indicator */}
                  {entry.streak >= 3 && (
                    <span style={{ color: '#ef4444', fontSize: '0.9rem' }} title={`${entry.streak} day streak`}>
                      🔥
                    </span>
                  )}
                </div>
              );
            })
          ) : (
            <div style={{ color: '#6b7280', textAlign: 'center', padding: '2rem', fontSize: '14px' }}>
              ☕ No tasks this week
            </div>
          )}

          {/* Idle Agents Indicator */}
          {idleAgents.length > 0 && hasActiveAgents && (
            <div style={{ color: '#6b7280', fontSize: '12px', textAlign: 'center', padding: '0.5rem', borderTop: '1px solid #334155', marginTop: '0.5rem' }}>
              💤 {idleAgents.length} agent{idleAgents.length > 1 ? 's' : ''} idle
            </div>
          )}
        </div>

        {/* Footer Summary */}
        <div style={{ borderTop: '1px solid #334155', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
            <div>Total: <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{summary.totalTasks}</span> tasks</div>
            <div>Avg: <span style={{ color: '#e2e8f0', fontWeight: 'bold' }}>{summary.avgPerAgent}</span>/agent</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: '#94a3b8', fontSize: '0.75rem' }}>MVP</div>
            {summary.mvp && (
              <div style={{ color: '#f59e0b', fontSize: '0.9rem', fontWeight: 'bold' }}>
                {AGENT_ICONS[summary.mvp]} {AGENT_ROLES[summary.mvp]?.name}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
