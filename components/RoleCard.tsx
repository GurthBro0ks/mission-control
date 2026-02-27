"use client";

import { AGENT_ROLES, AgentKey, AGENT_ICONS } from '@/lib/agent-roles';
import { useState, useEffect } from 'react';

interface AgentData {
  status?: string;
  currentTask?: string;
  completedToday?: number;
  failedRecently?: number;
}

interface RoleCardProps {
  agentKey: string;
  agentData?: AgentData;
  onClose: () => void;
}

interface Stats {
  delegation: number;
  execution: number;
  research: number;
  trading: number;
  security: number;
  devops: number;
  gossip: number;
  refactoring: number;
}

interface StatsData {
  agent: string;
  base: Stats;
  current: Stats;
  delta: Stats;
}

function getStatColor(value: number): string {
  if (value < 30) return '#ef4444'; // red
  if (value < 60) return '#f59e0b'; // amber
  if (value < 80) return '#22d3ee'; // cyan
  return '#4ade80'; // green
}

function StatBar({ label, baseValue, currentValue, delta }: { label: string; baseValue: number; currentValue: number; delta: number }) {
  const color = getStatColor(currentValue);
  const baseWidth = (baseValue / 100) * 140;
  const currentWidth = (currentValue / 100) * 140;
  const deltaColor = delta > 0 ? '#4ade80' : delta < 0 ? '#ef4444' : '#6b7280';
  const deltaIcon = delta > 0 ? '▲' : delta < 0 ? '▼' : '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
      <span style={{
        fontSize: '9px',
        color: '#6b7280',
        textTransform: 'uppercase',
        width: '70px',
        letterSpacing: '0.5px'
      }}>
        {label}
      </span>
      <div style={{
        width: '140px',
        height: '10px',
        background: '#1a2030',
        borderRadius: '2px',
        position: 'relative',
        overflow: 'hidden'
      }}>
        {/* Base stat (muted, behind) */}
        <div style={{
          position: 'absolute',
          width: `${baseWidth}px`,
          height: '100%',
          background: '#374151',
          borderRadius: '2px',
          opacity: 0.5
        }} />
        {/* Current stat (bright, in front) */}
        <div style={{
          width: `${currentWidth}px`,
          height: '100%',
          background: `linear-gradient(90deg, ${color}, ${color}cc)`,
          borderRadius: '2px',
          boxShadow: `0 0 4px ${color}30`,
          transition: 'width 0.3s ease-out',
          position: 'relative',
          zIndex: 1
        }} />
      </div>
      <span style={{
        fontSize: '10px',
        color: '#4b5563',
        width: '24px',
        textAlign: 'right'
      }}>
        {currentValue}
      </span>
      {delta !== 0 && (
        <span style={{
          fontSize: '9px',
          color: deltaColor,
          width: '20px'
        }}>
          {deltaIcon}{Math.abs(delta)}
        </span>
      )}
    </div>
  );
}

export default function RoleCard({ agentKey, agentData, onClose }: RoleCardProps) {
  const role = AGENT_ROLES[agentKey as AgentKey];
  const icon = AGENT_ICONS[agentKey as AgentKey] || '🤖';
  const [statsData, setStatsData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!agentKey) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await fetch(`/mission-control/api/ops/agent-stats/${agentKey}`);
        const data = await response.json();
        setStatsData(data);
      } catch (error) {
        console.error('Failed to fetch agent stats:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [agentKey]);

  if (!role) {
    return null;
  }

  const accentColor = role.accent;
  const hasLiveStats = statsData && (
    statsData.delta.execution !== 0 ||
    statsData.delta.research !== 0 ||
    statsData.delta.trading !== 0 ||
    statsData.delta.security !== 0 ||
    statsData.delta.devops !== 0 ||
    statsData.delta.refactoring !== 0
  );

  const displayStats = statsData ? statsData.current : role.stats;
  const displayBase = statsData ? statsData.base : role.stats;
  const displayDelta = statsData ? statsData.delta : {
    delegation: 0,
    execution: 0,
    research: 0,
    trading: 0,
    security: 0,
    devops: 0,
    gossip: 0,
    refactoring: 0,
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        background: '#000000aa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        animation: 'fadeIn 150ms ease-out',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: '#0f1520',
          borderRadius: '12px',
          border: `2px solid ${accentColor}`,
          boxShadow: `0 0 30px ${accentColor}40, 0 0 60px ${accentColor}20`,
          padding: '16px',
          maxWidth: '520px',
          width: '90%',
          animation: 'scaleIn 150ms ease-out',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '10px',
          borderBottom: '1px solid #1e3a4a',
          paddingBottom: '8px'
        }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '6px',
              background: `${accentColor}22`,
              border: `2px solid ${accentColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '20px',
              boxShadow: `0 0 10px ${accentColor}40`
            }}>
              {icon}
            </div>
            <div>
              <div style={{
                fontSize: '16px',
                fontWeight: 700,
                color: accentColor,
                textShadow: `0 0 6px ${accentColor}40`
              }}>
                {role.name}
              </div>
              <div style={{
                fontSize: '10px',
                color: '#6b7280',
                textTransform: 'uppercase',
                letterSpacing: '1px'
              }}>
                {role.title}
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#4b5563',
              fontSize: '20px',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '4px',
            }}
            onMouseEnter={e => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={e => e.currentTarget.style.color = '#4b5563'}
          >
            ×
          </button>
        </div>

        {/* Tagline */}
        <div style={{
          fontSize: '12px',
          color: '#9ca3af',
          marginBottom: '10px',
          fontStyle: 'italic',
          lineHeight: 1.4
        }}>
          {role.tagline}
        </div>

        {/* Two-column: Domain + Hard Bans */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '10px'
        }}>
          {/* Domain */}
          <div style={{
            background: '#111827',
            borderRadius: '6px',
            border: '1px solid #1e3a4a',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: '#4b5563',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              Domain
            </div>
            {role.domain.map((item, i) => (
              <div key={i} style={{
                fontSize: '10px',
                color: '#9ca3af',
                marginBottom: '2px'
              }}>
                • {item}
              </div>
            ))}
          </div>

          {/* Hard Bans */}
          <div style={{
            background: '#111827',
            borderRadius: '6px',
            border: '1px solid #1e3a4a',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              Hard Bans
            </div>
            {role.hardBans.map((item, i) => (
              <div key={i} style={{
                fontSize: '10px',
                color: '#fca5a5',
                marginBottom: '2px'
              }}>
                ✕ {item}
              </div>
            ))}
          </div>
        </div>

        {/* Two-column: Inputs + Outputs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '8px',
          marginBottom: '10px'
        }}>
          {/* Inputs */}
          <div style={{
            background: '#111827',
            borderRadius: '6px',
            border: '1px solid #1e3a4a',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: '#4b5563',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              ← Inputs
            </div>
            {role.inputs.map((item, i) => (
              <div key={i} style={{
                fontSize: '10px',
                color: '#9ca3af',
                marginBottom: '2px'
              }}>
                • {item}
              </div>
            ))}
          </div>

          {/* Outputs */}
          <div style={{
            background: '#111827',
            borderRadius: '6px',
            border: '1px solid #1e3a4a',
            padding: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: '#4b5563',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              Outputs →
            </div>
            {role.outputs.map((item, i) => (
              <div key={i} style={{
                fontSize: '10px',
                color: '#9ca3af',
                marginBottom: '2px'
              }}>
                • {item}
              </div>
            ))}
          </div>
        </div>

        {/* Stats Section */}
        <div style={{
          borderTop: '1px solid #1e3a4a',
          paddingTop: '8px',
          marginBottom: '8px'
        }}>
          <div style={{
            fontSize: '9px',
            color: hasLiveStats ? '#4ade80' : '#4b5563',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            marginBottom: '6px',
            textAlign: 'center'
          }}>
            {loading ? '═══ LOADING... ═══' : hasLiveStats ? '═══ STATS (LIVE) ═══' : '═══ STATS ═══'}
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '2px 8px'
          }}>
            <StatBar label="Delegation" baseValue={displayBase.delegation} currentValue={displayStats.delegation} delta={displayDelta.delegation} />
            <StatBar label="Execution" baseValue={displayBase.execution} currentValue={displayStats.execution} delta={displayDelta.execution} />
            <StatBar label="Research" baseValue={displayBase.research} currentValue={displayStats.research} delta={displayDelta.research} />
            <StatBar label="Trading" baseValue={displayBase.trading} currentValue={displayStats.trading} delta={displayDelta.trading} />
            <StatBar label="Security" baseValue={displayBase.security} currentValue={displayStats.security} delta={displayDelta.security} />
            <StatBar label="DevOps" baseValue={displayBase.devops} currentValue={displayStats.devops} delta={displayDelta.devops} />
            <StatBar label="Gossip" baseValue={displayBase.gossip} currentValue={displayStats.gossip} delta={displayDelta.gossip} />
            <StatBar label="Refactoring" baseValue={displayBase.refactoring} currentValue={displayStats.refactoring} delta={displayDelta.refactoring} />
          </div>
        </div>

        {/* Live Metrics */}
        {agentData && (
          <div style={{
            borderTop: '1px solid #1e3a4a',
            paddingTop: '8px',
            marginBottom: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: '#4b5563',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '6px',
              textAlign: 'center'
            }}>
              ═══ METRICS ═══
            </div>

            <div style={{
              display: 'flex',
              justifyContent: 'space-around',
              fontSize: '11px'
            }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: '#4ade80', fontWeight: 600 }}>
                  {agentData.completedToday ?? 0}
                </div>
                <div style={{ color: '#6b7280', fontSize: '9px' }}>Today</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{ color: accentColor, fontWeight: 600 }}>
                  {agentData.status === 'working' ? 'Active' : 'Idle'}
                </div>
                <div style={{ color: '#6b7280', fontSize: '9px' }}>Status</div>
              </div>
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  color: agentData.failedRecently && agentData.failedRecently > 0 ? '#ef4444' : '#6b7280',
                  fontWeight: 600
                }}>
                  {agentData.failedRecently ?? 0}
                </div>
                <div style={{ color: '#6b7280', fontSize: '9px' }}>Failed</div>
              </div>
            </div>
          </div>
        )}

        {/* Current Mission Panel */}
        {(agentData?.currentTask || agentData?.status === 'working') && (
          <div style={{
            background: '#111827',
            borderRadius: '6px',
            border: `1px solid ${accentColor}60`,
            padding: '8px'
          }}>
            <div style={{
              fontSize: '9px',
              color: accentColor,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              marginBottom: '4px'
            }}>
              ← Current Mission
            </div>
            <div style={{
              fontSize: '11px',
              color: '#e2e8f0',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span>📌</span>
              <span style={{ fontStyle: 'italic' }}>
                {agentData.currentTask || 'Processing task...'}
              </span>
            </div>
            <div style={{
              fontSize: '10px',
              color: '#4b5563',
              marginTop: '4px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <span style={{
                display: 'inline-block',
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                background: '#22c55e'
              }} />
              Running
            </div>
          </div>
        )}
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes scaleIn {
          from {
            opacity: 0;
            transform: scale(0.9);
          }
          to {
            opacity: 1;
            transform: scale(1);
          }
        }
      `}</style>
    </div>
  );
}
