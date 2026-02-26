"use client";

import Link from "next/link";
import { JetBrains_Mono } from "next/font/google";
import { useState, useEffect } from "react";
import RoleCard from "@/components/RoleCard";
import ToastProvider from "@/components/ToastProvider";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: '--font-jetbrains',
});

interface HealthData {
  cpu: number;
  ram: number;
  disk: number;
  activeMissions?: number;
  queuedSteps?: number;
  pendingProposals?: number;
  runningSteps?: number;
  completedToday?: number;
  workerAlive?: boolean;
  heartbeatAlive?: boolean;
}

interface AgentInsight {
  name: string;
  status: string;
  currentTask?: string;
  completedToday?: number;
  icon?: string;
}

function HealthPill({ label, value }: { label: string; value: number }) {
  const color = value < 50 ? '#22c55e' : value < 80 ? '#f59e0b' : '#ef4444';
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '6px',
      padding: '4px 10px',
      background: '#0a0a0f',
      borderRadius: '12px',
      border: `1px solid ${color}44`,
    }}>
      <span style={{ color: '#6b7280', fontSize: '10px', fontWeight: 600 }}>{label}</span>
      <span style={{ color, fontSize: '11px', fontWeight: 700 }}>{value}%</span>
    </div>
  );
}

function StatusIndicator({ type, alive }: { type: 'worker' | 'heartbeat'; alive: boolean }) {
  const icon = type === 'worker' ? '⚙️' : '❤️';
  const color = alive ? '#22c55e' : '#ef4444';
  const label = type === 'worker' ? 'Worker' : 'Heartbeat';
  return (
    <div
      title={`${label} ${alive ? 'running' : 'not running'}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '4px',
        padding: '4px 8px',
        background: '#0a0a0f',
        borderRadius: '12px',
        border: `1px solid ${color}44`,
        cursor: 'help',
      }}
    >
      <span style={{ fontSize: '12px' }}>{icon}</span>
      <span style={{ color, fontSize: '10px', fontWeight: 600 }}>{alive ? '✓' : '✗'}</span>
    </div>
  );
}

export default function Shell({
  children,
}: {
  children: React.ReactNode;
}) {
  const [health, setHealth] = useState<HealthData>({ cpu: 0, ram: 0, disk: 0, workerAlive: false, heartbeatAlive: false });
  const [opsCounts, setOpsCounts] = useState({ active: 0, queued: 0, pending: 0 });
  const [insightsExpanded, setInsightsExpanded] = useState(false);
  const [systemStatus, setSystemStatus] = useState<'OPERATIONAL' | 'DEGRADED' | 'DOWN'>('OPERATIONAL');
  const [insightsData, setInsightsData] = useState<AgentInsight[]>([]);
  const [insightsCounts, setInsightsCounts] = useState({ missions: 0, insights: 0, events: 0 });
  const [selectedAgentKey, setSelectedAgentKey] = useState<string | null>(null);

  useEffect(() => {
    // Initial fetch
    fetch('/api/health')
      .then(r => r.json())
      .then(data => {
        setHealth({
          cpu: data.cpu || 0,
          ram: data.ram || 0,
          disk: data.disk || 0,
          workerAlive: data.workerAlive ?? false,
          heartbeatAlive: data.heartbeatAlive ?? false,
        });
        setOpsCounts({
          active: data.runningSteps || data.activeMissions || 0,
          queued: data.queuedSteps || 0,
          pending: data.pendingProposals || 0,
        });
      })
      .catch(console.error);

    // Refresh every 30 seconds
    const interval = setInterval(() => {
      fetch('/api/health')
        .then(r => r.json())
        .then(data => {
          setHealth({
            cpu: data.cpu || 0,
            ram: data.ram || 0,
            disk: data.disk || 0,
            workerAlive: data.workerAlive ?? false,
            heartbeatAlive: data.heartbeatAlive ?? false,
          });
          setOpsCounts({
            active: data.runningSteps || data.activeMissions || 0,
            queued: data.queuedSteps || 0,
            pending: data.pendingProposals || 0,
          });
        })
        .catch(console.error);
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  // Fetch insights data
  useEffect(() => {
    // Skip if not in browser
    if (typeof window === 'undefined') return;

    const fetchInsights = async () => {
      try {
        // Get agents
        const agentsRes = await fetch('/api/agents');
        if (!agentsRes.ok) return;
        const agentsData = await agentsRes.json();
        if (!agentsData) return;

        // Get today's events
        const today = new Date().toISOString().split('T')[0];
        const eventsRes = await fetch(`/api/ops/events?limit=100&offset=0`);
        if (!eventsRes.ok) return;
        const eventsData = await eventsRes.json();

        const todayEvents = ((eventsData?.events) || []).filter((e: { created_at?: string }) =>
          e.created_at && e.created_at.startsWith(today)
        );

        // Get missions
        const missionsRes = await fetch('/api/ops/missions');
        if (!missionsRes.ok) return;
        const missionsData = await missionsRes.json();
        const activeMissions = ((missionsData?.missions) || []).filter((m: { status: string }) =>
          m.status === 'in_progress'
        ).length;

        // Build agent insights
        const allAgents = [agentsData?.lead, ...(agentsData?.subagents || [])].filter(Boolean);
        const agentInsights: AgentInsight[] = allAgents.map((agent: { name: string; status: string; currentTask?: string; completedToday?: number; icon?: string }) => ({
          name: agent.name,
          status: agent.status || 'idle',
          currentTask: agent.currentTask,
          completedToday: agent.completedToday || 0,
          icon: agent.icon,
        }));

        setInsightsData(agentInsights);
        setInsightsCounts({
          missions: activeMissions,
          insights: agentInsights.filter(a => a.currentTask).length,
          events: todayEvents.length,
        });

        // Determine system status based on failed events and agents
        const hasFailed = todayEvents.some((e: { type: string }) => e.type === 'error' || e.type === 'failed');
        const hasDegraded = todayEvents.some((e: { type: string }) => e.type === 'warning');
        if (hasFailed) {
          setSystemStatus('DOWN');
        } else if (hasDegraded) {
          setSystemStatus('DEGRADED');
        } else {
          setSystemStatus('OPERATIONAL');
        }
      } catch (err) {
        console.error('Failed to fetch insights:', err);
      }
    };

    fetchInsights();
    // Refresh every 60 seconds
    const interval = setInterval(fetchInsights, 60000);
    return () => clearInterval(interval);
  }, []);

  return (
    <html lang="en">
      <body className={`${jetbrainsMono.variable} font-mono`}>
        <div className="min-h-screen bg-[#050508] text-gray-200">
          {/* Header - Centered, bigger */}
          <header className="sticky top-0 z-50 border-b border-[#1e3a4a] bg-[#0a0a0f]/95 backdrop-blur">
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              padding: '1rem 1rem 0.5rem',
              gap: '12px',
            }}>
              {/* Title with glow */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>🧪</span>
                <span style={{
                  fontSize: '20px',
                  fontWeight: 700,
                  color: '#22d3ee',
                  letterSpacing: '0.5px',
                  textShadow: '0 0 12px #22d3ee60',
                }}>
                  SLIMYAI MISSION CONTROL
                </span>
                {/* Live pulse dot */}
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: '#22c55e',
                  boxShadow: '0 0 8px #22c55e',
                  animation: 'pulse 2s infinite',
                }} />
              </div>

              {/* Health pills */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <HealthPill label="CPU" value={health.cpu} />
                <HealthPill label="RAM" value={health.ram} />
                <HealthPill label="DISK" value={health.disk} />
                <StatusIndicator type="worker" alive={health.workerAlive ?? false} />
                <StatusIndicator type="heartbeat" alive={health.heartbeatAlive ?? false} />
              </div>

              {/* System status */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6b7280', fontSize: '12px' }}>
                <span>NED × NUC1</span>
                <span style={{ color: '#22c55e', fontSize: '10px' }}>●</span>
                <span style={{ color: '#22c55e' }}>online</span>
              </div>
            </div>

            {/* Nav Tabs - Centered */}
            <nav style={{ display: 'flex', gap: '1.5rem', padding: '0.5rem 1rem', height: '36px', alignItems: 'center', justifyContent: 'center' }}>
              {[
                { href: '/', label: 'Office', icon: '🏢', count: 0 },
                { href: '/ops', label: 'Ops', icon: '⚙️', count: opsCounts.pending },
                { href: '/feed', label: 'Feed', icon: '📡', count: 0 },
                { href: '/memory', label: 'Memory', icon: '🧠', count: 0 },
              ].map((tab) => (
                <Link
                  key={tab.href}
                  href={tab.href}
                  style={{
                    padding: '0 16px',
                    fontSize: '12px',
                    color: '#6b7280',
                    textDecoration: 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    borderBottom: '2px solid transparent',
                    transition: 'all 0.15s',
                    position: 'relative',
                  }}
                  className="nav-tab"
                >
                  {tab.icon} {tab.label}
                  {tab.count > 0 && (
                    <span style={{
                      position: 'absolute',
                      top: '-4px',
                      right: '4px',
                      minWidth: '16px',
                      height: '16px',
                      background: '#ef4444',
                      borderRadius: '8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#fff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      boxShadow: '0 0 8px rgba(239, 68, 68, 0.5)',
                    }}>
                      {tab.count > 9 ? '9+' : tab.count}
                    </span>
                  )}
                </Link>
              ))}
            </nav>

            {/* Ops Status Bar - Centered, counts only */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0.5rem 1rem',
              background: '#0a0a0f',
              borderTop: '1px solid #1e3a4a',
              borderBottom: '1px solid #1e3a4a',
              height: '32px',
            }}>
              <div style={{
                fontSize: '13px',
                color: '#6b7280',
                textShadow: '0 0 8px #22d3ee20',
              }}>
                <span style={{ color: '#22c55e' }}>{opsCounts.active} active</span>
                <span style={{ margin: '0 8px', color: '#3a3a4a' }}>·</span>
                <span style={{ color: '#f59e0b' }}>{opsCounts.queued} queued</span>
                <span style={{ margin: '0 8px', color: '#3a3a4a' }}>·</span>
                <span style={{ color: '#6b7280' }}>{opsCounts.pending} pending approval</span>
              </div>
            </div>

            {/* Insights Bar - Collapsible */}
            <div style={{
              background: '#0a0a0f',
              borderBottom: '1px solid #1e3a4a',
              overflow: 'hidden',
              transition: 'max-height 0.3s ease-out',
              maxHeight: insightsExpanded ? '320px' : '40px',
            }}>
              {/* Collapsed/Expanded Header */}
              <div
                onClick={() => setInsightsExpanded(!insightsExpanded)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '0.5rem 1rem',
                  height: '40px',
                  cursor: 'pointer',
                  userSelect: 'none',
                }}
              >
                {/* Pipeline Dots */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  {['Triggers', 'Proposals', 'Missions', 'Events'].map((stage, i) => (
                    <div key={stage} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        width: '8px',
                        height: '8px',
                        borderRadius: '50%',
                        background: i < 3 ? '#22c55e' : '#3b82f6',
                        boxShadow: `0 0 6px ${i < 3 ? '#22c55e' : '#3b82f6'}60`,
                      }} />
                      {i < 3 && (
                        <div style={{
                          width: '20px',
                          height: '2px',
                          background: '#1e3a4a',
                          marginLeft: '2px',
                        }} />
                      )}
                    </div>
                  ))}
                </div>

                {/* Status Word */}
                <div style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  color: systemStatus === 'OPERATIONAL' ? '#22c55e' : systemStatus === 'DEGRADED' ? '#f59e0b' : '#ef4444',
                  textShadow: `0 0 8px ${systemStatus === 'OPERATIONAL' ? '#22c55e' : systemStatus === 'DEGRADED' ? '#f59e0b' : '#ef4444'}40`,
                }}>
                  {systemStatus}
                </div>

                {/* Quick Counts + Expand */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '11px', color: '#6b7280' }}>
                  <span><span style={{ color: '#22d3ee' }}>{insightsCounts.missions}</span> missions</span>
                  <span><span style={{ color: '#a78bfa' }}>{insightsCounts.insights}</span> insights</span>
                  <span><span style={{ color: '#fbbf24' }}>{insightsCounts.events}</span> events</span>
                  <span style={{ color: '#4b5563' }}>·</span>
                  <Link
                    href="/feed"
                    style={{ color: '#6b7280', textDecoration: 'none', transition: 'color 0.15s' }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    Read latest <span style={{ color: '#22d3ee' }}>→</span>
                  </Link>
                  <span style={{
                    color: '#4b5563',
                    transition: 'transform 0.2s',
                    transform: insightsExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
                  }}>▼</span>
                </div>
              </div>

              {/* Expanded Content - Agent Activity */}
              {insightsExpanded && (
                <div style={{
                  padding: '0 1rem 1rem',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                }}>
                  <div style={{ fontSize: '10px', color: '#4b5563', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '4px' }}>
                    Today's Agent Activity
                  </div>
                  {insightsData.map((agent) => (
                    <div key={agent.name} onClick={() => setSelectedAgentKey(agent.name.toLowerCase())} style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '8px 12px',
                      background: '#111827',
                      borderRadius: '6px',
                      border: '1px solid #1e3a4a',
                      cursor: 'pointer',
                      transition: 'background 0.15s',
                    }} onMouseEnter={e => e.currentTarget.style.background = '#1a2535'}
                      onMouseLeave={e => e.currentTarget.style.background = '#111827'}>
                      {/* Agent Icon */}
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '6px',
                        background: '#0a1a2a',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '14px',
                      }}>
                        {agent.icon || '🤖'}
                      </div>

                      {/* Agent Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: '#e2e8f0' }}>
                            {agent.name}
                          </span>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: agent.status === 'active' ? '#22c55e' : agent.status === 'idle' ? '#6b7280' : '#f59e0b',
                          }} />
                        </div>
                        <div style={{
                          fontSize: '11px',
                          color: '#6b7280',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          maxWidth: '300px',
                        }}>
                          {agent.currentTask || 'No active task'}
                        </div>
                      </div>

                      {/* Completed Count */}
                      <div style={{
                        fontSize: '11px',
                        color: '#22c55e',
                        fontWeight: 600,
                      }}>
                        +{agent.completedToday || 0} today
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Role Card Modal */}
            {selectedAgentKey && (
              <RoleCard
                agentKey={selectedAgentKey}
                agentData={{
                  status: insightsData.find(a => a.name.toLowerCase() === selectedAgentKey)?.status,
                  currentTask: insightsData.find(a => a.name.toLowerCase() === selectedAgentKey)?.currentTask,
                  completedToday: insightsData.find(a => a.name.toLowerCase() === selectedAgentKey)?.completedToday,
                }}
                onClose={() => setSelectedAgentKey(null)}
              />
            )}
          </header>

          {/* CSS for nav tab active state */}
          <style>{`
            .nav-tab:hover {
              color: #e2e8f0 !important;
              background: #1a2a3a;
            }
            @keyframes pulse {
              0%, 100% { opacity: 1; }
              50% { opacity: 0.5; }
            }
          `}</style>

          {/* Page Content */}
          <main style={{ padding: '16px', minHeight: 'calc(100vh - 200px)' }}>
            {children}
          </main>

          {/* Toast Notifications */}
          <ToastProvider />
        </div>
      </body>
    </html>
  );
}
