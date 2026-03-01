"use client";

import { useState, useEffect, useCallback } from 'react';
import ProposalCard from '@/components/ProposalCard';
import MissionCard from '@/components/MissionCard';
import EventLog from '@/components/EventLog';

type Tab = 'proposals' | 'missions' | 'events' | 'policy';

// Types
interface Proposal {
  id: number;
  title: string;
  description: string | null;
  source: string;
  agent: string | null;
  status: 'pending' | 'approved' | 'rejected';
  priority: string;
  requires_human_approval: boolean;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  mission_id: number | null;
}

interface Mission {
  id: number;
  proposal_id: number | null;
  title: string;
  status: 'pending' | 'in_progress' | 'active' | 'queued' | 'completed' | 'failed';
  priority: string;
  assigned_to: string | null;
  delegated_to: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
  steps?: any[];
}

interface Event {
  id: number;
  type: string;
  source: string;
  data: Record<string, unknown> | null;
  created_at: string;
}

interface Policy {
  key: string;
  value: unknown;
  description?: string;
}

// Policy Configuration - maps policy keys to human-readable names, icons, and formatting
// Handles nested JSON format like {"limit": 30} - extracts the inner value
const POLICY_CONFIG: Record<string, { label: string; icon: string; description: string; format: (v: unknown) => string; parse: (v: string) => unknown; getValue: (v: unknown) => unknown }> = {
  daily_proposal_limit: {
    label: 'Daily Proposal Limit',
    icon: '📊',
    description: 'Maximum number of proposals that can be submitted per day',
    format: (v) => String(v),
    parse: (v) => ({ limit: parseInt(v, 10) }),
    getValue: (v) => (v as { limit?: number })?.limit ?? v,
  },
  max_concurrent_missions: {
    label: 'Max Concurrent Missions',
    icon: '🚦',
    description: 'Maximum number of missions that can run simultaneously',
    format: (v) => String(v),
    parse: (v) => ({ limit: parseInt(v, 10) }),
    getValue: (v) => (v as { limit?: number })?.limit ?? v,
  },
  trade_edge_minimum: {
    label: 'Trade Edge Minimum',
    icon: '📈',
    description: 'Minimum edge required for trade execution (percentage)',
    format: (v) => `${v}%`,
    parse: (v) => ({ threshold: parseFloat(v) }),
    getValue: (v) => (v as { threshold?: number })?.threshold ?? v,
  },
  trade_position_max: {
    label: 'Max Position Size',
    icon: '💰',
    description: 'Maximum allowed position size for trades',
    format: (v) => `$${Number(v).toLocaleString()}`,
    parse: (v) => ({ limit: parseFloat(v) }),
    getValue: (v) => (v as { limit?: number })?.limit ?? v,
  },
  stale_task_timeout: {
    label: 'Stale Task Timeout',
    icon: '⏱️',
    description: 'Minutes before a task is considered stale',
    format: (v) => `${v} minutes`,
    parse: (v) => ({ minutes: parseInt(v, 10) }),
    getValue: (v) => (v as { minutes?: number })?.minutes ?? v,
  },
  human_approval_required: {
    label: 'Human Approval Required',
    icon: '🔒',
    description: 'Operations that require human approval before execution',
    format: (v) => Array.isArray(v) ? v.join(', ') : String(v),
    parse: (v) => ({ types: v.split(',').map(s => s.trim()) }),
    getValue: (v) => (v as { types?: string[] })?.types ?? v,
  },
  max_concurrent_tasks: {
    label: 'Max Concurrent Tasks',
    icon: '👥',
    description: 'Maximum number of tasks that can run in parallel',
    format: (v) => String(v),
    parse: (v) => ({ limit: parseInt(v, 10) }),
    getValue: (v) => (v as { limit?: number })?.limit ?? v,
  },
};

// SSE listener
function useSSE() {
  const [event, setEvent] = useState<{ type: string; data?: unknown } | null>(null);

  useEffect(() => {
    const es = new EventSource('/mission-control/api/sse');
    es.addEventListener('message', (e) => {
      try {
        const d = JSON.parse(e.data);
        setEvent(d);
      } catch {}
    });
    return () => es.close();
  }, []);

  return event;
}

// Toast notification system
function useToast() {
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  return { toast, showToast, setToast };
}

export default function OpsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('proposals');
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [missions, setMissions] = useState<Mission[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showNewProposal, setShowNewProposal] = useState(false);
  const [approvingId, setApprovingId] = useState<number | null>(null);
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [newProposal, setNewProposal] = useState({
    title: '',
    description: '',
    priority: 'normal',
  });

  const sseEvent = useSSE();
  const { toast, showToast } = useToast();

  const fetchProposals = useCallback(async () => {
    try {
      const res = await fetch('/mission-control/api/ops/proposals');
      const data = await res.json();
      setProposals(data.proposals || []);
    } catch (err) {
      console.error('Failed to fetch proposals:', err);
    }
  }, []);

  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/mission-control/api/ops/missions');
      const data = await res.json();
      const missionsWithSteps: Mission[] = await Promise.all(
        (data.missions || []).map(async (mission: Mission) => {
          try {
            const stepsRes = await fetch(`/mission-control/api/ops/steps?mission_id=${mission.id}`);
            const stepsData = await stepsRes.json();
            return { ...mission, steps: stepsData.steps || [] };
          } catch {
            return { ...mission, steps: [] };
          }
        })
      );
      setMissions(missionsWithSteps);
    } catch (err) {
      console.error('Failed to fetch missions:', err);
    }
  }, []);

  const fetchEvents = useCallback(async () => {
    try {
      const res = await fetch('/mission-control/api/ops/events?limit=100');
      const data = await res.json();
      setEvents(data.events || []);
    } catch (err) {
      console.error('Failed to fetch events:', err);
    }
  }, []);

  const fetchPolicies = useCallback(async () => {
    try {
      const res = await fetch('/mission-control/api/ops/policy');
      const data = await res.json();
      // Handle array response format from API
      const policyList: Policy[] = (data.policies || []).map((p: { key: string; value: string; description?: string }) => ({
        key: p.key,
        value: (() => { try { return JSON.parse(p.value); } catch { return p.value; } })(),
        description: p.description,
      }));
      setPolicies(policyList);
    } catch (err) {
      console.error('Failed to fetch policies:', err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProposals(), fetchMissions(), fetchEvents(), fetchPolicies()]);
    setLoading(false);
  }, [fetchProposals, fetchMissions, fetchEvents, fetchPolicies]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Auto-refresh every 10 seconds
  useEffect(() => {
    const interval = setInterval(() => { if (!document.hidden) fetchAll(); }, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  // Auto-refresh on SSE events
  useEffect(() => {
    if (!sseEvent) return;
    if (sseEvent.type?.includes('proposal')) {
      fetchProposals();
    } else if (sseEvent.type?.includes('mission') || sseEvent.type?.includes('step')) {
      fetchMissions();
    } else if (sseEvent.type) {
      fetchEvents();
    }
  }, [sseEvent, fetchProposals, fetchMissions, fetchEvents]);

  const handleApprove = async (id: number) => {
    setApprovingId(id);
    try {
      const res = await fetch(`/mission-control/api/ops/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'approved' }),
      });
      const data = await res.json();
      fetchProposals();
      fetchMissions();
      fetchEvents();
      // Show toast with mission title if created
      const proposal = proposals.find(p => p.id === id);
      if (proposal) {
        showToast(`Mission created: ${proposal.title}`, 'success');
      }
    } finally {
      setApprovingId(null);
    }
  };

  const handleReject = async (id: number) => {
    setRejectingId(id);
    try {
      const reason = prompt('Rejection reason (optional):');
      await fetch(`/mission-control/api/ops/proposals/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'rejected', rejectionReason: reason || null }),
      });
      fetchProposals();
      fetchEvents();
      showToast('Proposal rejected', 'error');
    } finally {
      setRejectingId(null);
    }
  };

  const handleCreateProposal = async () => {
    if (!newProposal.title) return;
    try {
      const res = await fetch('/mission-control/api/proposals/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: newProposal.title,
          description: newProposal.description,
          source: 'gurth',
          agent: 'Ned',
          priority: newProposal.priority,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        showToast(data.error || 'Failed to create task', 'error');
        return;
      }

      // Show success toast
      if (data.status === 'approved' && data.mission_id) {
        showToast(`Task approved! Mission #${data.mission_id} created`, 'success');
      } else if (data.status === 'pending_review') {
        showToast('Task submitted for review', 'success');
      } else {
        showToast('Task created successfully', 'success');
      }

      setShowNewProposal(false);
      setNewProposal({
        title: '',
        description: '',
        priority: 'normal',
      });
      fetchProposals();
      fetchMissions();
      fetchEvents();
    } catch (error) {
      showToast('Failed to create task', 'error');
    }
  };

  const handleSavePolicy = async (key: string, value: unknown) => {
    await fetch('/mission-control/api/ops/policy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value }),
    });
    fetchPolicies();
  };

  const handleWakeNed = async () => {
    try {
      const res = await fetch('/mission-control/api/wake-ned', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        showToast('Ned Notified', 'success');
      } else {
        showToast('Failed to notify Ned', 'error');
      }
    } catch (error) {
      console.error('Failed to wake Ned:', error);
      showToast('Failed to notify Ned', 'error');
    }
  };

  const handleTriggerDailyBrief = async () => {
    try {
      const res = await fetch('/mission-control/api/scheduler/daily-brief', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Scheduler-Secret': 'slimyai-mc-2026',
        },
      });
      const data = await res.json();
      if (res.ok && data.status === 'created') {
        showToast(`Daily Brief created: ${data.title}`, 'success');
        fetchProposals();
        fetchMissions();
      } else if (data.status === 'skipped') {
        showToast(`Already exists: ${data.title}`, 'success');
      } else {
        showToast(data.error || 'Failed to create daily brief', 'error');
      }
    } catch (error) {
      console.error('Failed to trigger daily brief:', error);
      showToast('Failed to create daily brief', 'error');
    }
  };

  const handleTestDiscord = async () => {
    try {
      const res = await fetch('/mission-control/api/discord/test', { method: 'POST' });
      if (res.ok) {
        showToast('Test message sent!', 'success');
      } else {
        showToast('Failed to send test message', 'error');
      }
    } catch (error) {
      console.error('Failed to test Discord:', error);
      showToast('Failed to send test message', 'error');
    }
  };

  const tabs: { id: Tab; label: string; icon: string }[] = [
    { id: 'proposals', label: 'Proposals', icon: '📝' },
    { id: 'missions', label: 'Missions', icon: '🚀' },
    { id: 'events', label: 'Events', icon: '📋' },
    { id: 'policy', label: 'Policy', icon: '⚙️' },
  ];

  const pendingCount = proposals.filter(p => p.status === 'pending').length;
  const activeMissions = missions.filter(m => m.status === 'in_progress' || m.status === 'active').length;
  const pendingProposals = proposals.filter(p => p.status === 'pending');

  return (
    <div>
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
          50% { box-shadow: 0 0 20px 4px rgba(245, 158, 11, 0.2); }
        }
        @keyframes slide-out {
          from { opacity: 1; transform: translateY(0); }
          to { opacity: 0; transform: translateY(-20px); }
        }
        select option { background: #0a0a0f; }
      `}</style>

      {/* Toast notification */}
      {toast && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '20px',
          zIndex: 1000,
          padding: '12px 20px',
          background: toast.type === 'success' ? '#22c55e22' : '#ef444422',
          border: `1px solid ${toast.type === 'success' ? '#22c55e44' : '#ef444444'}`,
          borderRadius: '8px',
          color: toast.type === 'success' ? '#22c55e' : '#ef4444',
          fontSize: '13px',
          fontWeight: 500,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
          animation: 'slide-out 0.3s ease-out reverse',
        }}>
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', color: '#22d3ee', margin: 0 }}>
            🎯 Ops Command Center
          </h1>
          <p style={{ color: '#6b7280', fontSize: '14px', marginTop: '4px' }}>
            {pendingCount} pending proposals · {activeMissions} active missions
          </p>
        </div>
        {activeTab === 'proposals' && (
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleTriggerDailyBrief}
              style={{
                background: '#f59e0b22',
                border: '1px solid #f59e0b44',
                color: '#fbbf24',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              📊 Daily Brief
            </button>
            <button
              onClick={handleWakeNed}
              style={{
                background: '#7c3aed22',
                border: '1px solid #7c3aed44',
                color: '#a78bfa',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              ⚡ Wake Ned
            </button>
            <button
              onClick={handleTestDiscord}
              style={{
                background: '#5865F222',
                border: '1px solid #5865F244',
                color: '#5865F2',
                padding: '10px 16px',
                borderRadius: '6px',
                cursor: 'pointer',
                fontWeight: 'bold',
                fontSize: '13px',
              }}
            >
              🔵 Test Discord
            </button>
            <button
              onClick={() => setShowNewProposal(true)}
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
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', borderBottom: '1px solid #1a1a2e', paddingBottom: '8px' }}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              background: activeTab === tab.id ? '#1a1a2e' : 'transparent',
              border: 'none',
              color: activeTab === tab.id ? '#22d3ee' : '#6b7280',
              padding: '8px 16px',
              borderRadius: '6px 6px 0 0',
              cursor: 'pointer',
              borderBottom: activeTab === tab.id ? '2px solid #22d3ee' : '2px solid transparent',
              fontSize: '13px',
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* ⚡️ PENDING APPROVAL Section - Only visible when pending proposals exist */}
      {pendingProposals.length > 0 && (
        <div style={{ marginBottom: '24px' }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '12px',
          }}>
            <span style={{ fontSize: '16px' }}>⚡️</span>
            <h2 style={{
              fontSize: '14px',
              fontWeight: 700,
              color: '#f59e0b',
              textTransform: 'uppercase',
              letterSpacing: '1px',
              margin: 0,
            }}>
              Pending Approval ({pendingProposals.length})
            </h2>
          </div>
          
          {pendingProposals.map(proposal => (
            <div
              key={proposal.id}
              style={{
                background: '#0a0a0f',
                border: '1px solid #1a1a2e',
                borderLeft: '4px solid #f59e0b',
                borderRadius: '8px',
                padding: '16px',
                marginBottom: '12px',
                animation: approvingId === proposal.id || rejectingId === proposal.id 
                  ? 'slide-out 0.3s ease-out forwards' 
                  : 'pulse-glow 2s ease-in-out infinite',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px' }}>
                <div style={{ flex: 1 }}>
                  {/* Title & Priority */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: proposal.priority === 'critical' ? '#ef4444' 
                        : proposal.priority === 'high' ? '#f59e0b' 
                        : proposal.priority === 'normal' ? '#22c55e' : '#6b7280',
                    }} />
                    <h3 style={{
                      fontSize: '15px',
                      fontWeight: 600,
                      color: '#e2e8f0',
                      margin: 0,
                    }}>
                      {proposal.title}
                    </h3>
                    {proposal.priority === 'critical' && (
                      <span style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#ef4444',
                        textTransform: 'uppercase',
                        letterSpacing: '0.5px',
                      }}>
                        CRITICAL
                      </span>
                    )}
                  </div>
                  
                  {/* Description */}
                  {proposal.description && (
                    <p style={{
                      fontSize: '13px',
                      color: '#9ca3af',
                      margin: '0 0 8px 0',
                      lineHeight: 1.5,
                    }}>
                      {proposal.description}
                    </p>
                  )}
                  
                  {/* Source & Agent */}
                  <div style={{
                    display: 'flex',
                    gap: '16px',
                    fontSize: '11px',
                    color: '#6b7280',
                  }}>
                    <span>Source: <span style={{ color: '#9ca3af' }}>{proposal.source}</span></span>
                    {proposal.agent && (
                      <span>Agent: <span style={{ color: '#9ca3af' }}>{proposal.agent}</span></span>
                    )}
                  </div>
                </div>
                
                {/* Action Buttons */}
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button
                    onClick={() => handleApprove(proposal.id)}
                    disabled={approvingId === proposal.id}
                    style={{
                      background: '#22c55e22',
                      border: '1px solid #22c55e44',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      color: '#22c55e',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: approvingId === proposal.id ? 'wait' : 'pointer',
                      opacity: approvingId === proposal.id ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleReject(proposal.id)}
                    disabled={rejectingId === proposal.id}
                    style={{
                      background: '#ef444422',
                      border: '1px solid #ef444444',
                      borderRadius: '6px',
                      padding: '8px 16px',
                      color: '#ef4444',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: rejectingId === proposal.id ? 'wait' : 'pointer',
                      opacity: rejectingId === proposal.id ? 0.5 : 1,
                      transition: 'all 0.15s',
                    }}
                  >
                    ✗ Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
          <span
            style={{
              display: 'inline-block',
              width: '24px',
              height: '24px',
              border: '2px solid #1a1a2e',
              borderTopColor: '#22d3ee',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
          <p>Loading...</p>
        </div>
      ) : (
        <>
          {/* Proposals Tab */}
          {activeTab === 'proposals' && (
            <div>
              {proposals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  No proposals yet. Create one to get started!
                </div>
              ) : (
                proposals.map(proposal => {
                  // Find mission and steps for this proposal
                  const mission = proposal.mission_id
                    ? missions.find(m => m.id === proposal.mission_id)
                    : undefined;
                  const steps = mission?.steps;

                  return (
                    <ProposalCard
                      key={proposal.id}
                      proposal={proposal}
                      mission={mission ? { id: mission.id, title: mission.title, status: mission.status, result: mission.result } : undefined}
                      steps={steps}
                      onApprove={handleApprove}
                      onReject={handleReject}
                    />
                  );
                })
              )}
            </div>
          )}

          {/* Missions Tab */}
          {activeTab === 'missions' && (
            <div>
              {missions.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  No missions yet. Approve a proposal to create one!
                </div>
              ) : (
                missions.map(mission => (
                  <MissionCard
                    key={mission.id}
                    mission={mission}
                    steps={mission.steps || []}
                  />
                ))
              )}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div>
              <EventLog events={events} />
            </div>
          )}

          {/* Policy Tab */}
          {activeTab === 'policy' && (
            <div>
              <div
                style={{
                  background: '#0a0a0f',
                  border: '1px solid #1a1a2e',
                  borderRadius: '8px',
                  padding: '16px',
                }}
              >
                <h3 style={{ color: '#9ca3af', fontSize: '12px', marginBottom: '16px' }}>
                  Policy Settings
                </h3>
                {policies.length === 0 ? (
                  <div style={{ color: '#6b7280', textAlign: 'center', padding: '20px' }}>
                    No policies configured
                  </div>
                ) : (
                  policies.map(policy => (
                    <PolicyRow
                      key={policy.key}
                      policy={policy}
                      onSave={handleSavePolicy}
                    />
                  ))
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* New Task Modal */}
      {showNewProposal && (
        <div
          onClick={() => setShowNewProposal(false)}
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
              borderRadius: '8px', padding: '24px', width: '450px',
            }}
          >
            <h2 style={{ color: '#22d3ee', marginBottom: '20px', marginTop: 0 }}>
              New Task
            </h2>

            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                Title *
              </label>
              <input
                type="text"
                autoFocus
                value={newProposal.title}
                onChange={e => setNewProposal({ ...newProposal, title: e.target.value })}
                placeholder="e.g. Run security scan on NUC2"
                style={{
                  width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0',
                  padding: '8px 12px', borderRadius: '4px', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '4px' }}>
                Description (optional)
              </label>
              <textarea
                value={newProposal.description}
                onChange={e => setNewProposal({ ...newProposal, description: e.target.value })}
                rows={3}
                placeholder="What should happen..."
                style={{
                  width: '100%', background: '#1a1a2e', border: 'none', color: '#e2e8f0',
                  padding: '8px 12px', borderRadius: '4px', resize: 'vertical', boxSizing: 'border-box',
                }}
              />
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ display: 'block', color: '#6b7280', fontSize: '12px', marginBottom: '8px' }}>
                Priority
              </label>
              <div style={{ display: 'flex', gap: '16px' }}>
                {['low', 'normal', 'high', 'urgent'].map((p) => (
                  <label
                    key={p}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      color: newProposal.priority === p ? '#e2e8f0' : '#6b7280',
                      fontSize: '13px',
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="radio"
                      name="priority"
                      value={p}
                      checked={newProposal.priority === p}
                      onChange={e => setNewProposal({ ...newProposal, priority: e.target.value })}
                      style={{ accentColor: '#22d3ee' }}
                    />
                    {p.charAt(0).toUpperCase() + p.slice(1)}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={handleCreateProposal}
                disabled={!newProposal.title}
                style={{
                  flex: 1,
                  background: newProposal.title ? '#22d3ee' : '#1a1a2e',
                  border: 'none',
                  color: newProposal.title ? '#000' : '#6b7280',
                  padding: '10px', borderRadius: '6px',
                  cursor: newProposal.title ? 'pointer' : 'not-allowed',
                  fontWeight: 'bold',
                }}
              >
                Create Task
              </button>
              <button
                onClick={() => setShowNewProposal(false)}
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

// Policy row component - Human-readable card style
function PolicyRow({
  policy,
  onSave,
}: {
  policy: Policy;
  onSave: (key: string, value: unknown) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const config = POLICY_CONFIG[policy.key];

  // Get the inner value from nested JSON (e.g., {"limit": 30} -> 30)
  const innerValue = config ? config.getValue(policy.value) : policy.value;

  // Initialize edit value when entering edit mode or when policy changes
  useEffect(() => {
    if (config) {
      // For known policies, use the inner value for editing
      setValue(String(innerValue));
    } else {
      // For unknown policies, use JSON
      setValue(JSON.stringify(policy.value));
    }
  }, [innerValue, policy.key, config]);

  const handleSave = () => {
    try {
      let parsed: unknown;
      if (config) {
        // Use the config's parse function for known policies
        parsed = config.parse(value);
      } else {
        // Fall back to JSON parse for unknown policies
        parsed = (() => { try { return JSON.parse(value); } catch { return value; } })();
      }
      onSave(policy.key, parsed);
      setEditing(false);
    } catch {
      alert('Invalid value');
    }
  };

  const formattedValue = config ? config.format(innerValue) : JSON.stringify(policy.value);

  if (config) {
    // Known policy - display as human-readable card
    return (
      <div
        style={{
          background: '#0d0d16',
          borderRadius: '8px',
          marginBottom: '12px',
          borderLeft: '4px solid #22d3ee',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '16px' }}>
          {/* Header: Icon + Label */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
            <span style={{ fontSize: '18px' }}>{config.icon}</span>
            <span style={{ fontSize: '14px', fontWeight: 600, color: '#e2e8f0' }}>
              {config.label}
            </span>
          </div>

          {/* Description */}
          <p style={{
            fontSize: '12px',
            color: '#6b7280',
            margin: '0 0 12px 28px',
            lineHeight: 1.4,
          }}>
            {config.description}
          </p>

          {/* Current Value */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            marginLeft: '28px',
          }}>
            <span style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#22d3ee',
              fontFamily: 'monospace',
            }}>
              {formattedValue}
            </span>

            {editing ? (
              <>
                <input
                  type={policy.key === 'trade_edge_minimum' || policy.key === 'trade_position_max' ? 'text' : 'text'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={config.label}
                  style={{
                    flex: 1,
                    maxWidth: '200px',
                    padding: '8px 12px',
                    background: '#1a1a2e',
                    border: '1px solid #22d3ee44',
                    borderRadius: '4px',
                    color: '#e2e8f0',
                    fontSize: '14px',
                    fontFamily: 'monospace',
                  }}
                />
                <button
                  onClick={handleSave}
                  style={{
                    padding: '8px 16px',
                    background: '#22c55e22',
                    border: '1px solid #22c55e44',
                    borderRadius: '4px',
                    color: '#22c55e',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Save
                </button>
                <button
                  onClick={() => setEditing(false)}
                  style={{
                    padding: '8px 16px',
                    background: 'transparent',
                    border: '1px solid #6b7280',
                    borderRadius: '4px',
                    color: '#6b7280',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                style={{
                  padding: '6px 14px',
                  background: 'transparent',
                  border: '1px solid #6b7280',
                  borderRadius: '4px',
                  color: '#9ca3af',
                  fontSize: '12px',
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Edit
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Unknown policy - display as generic row with raw value
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '12px',
        background: '#0d0d16',
        borderRadius: '6px',
        marginBottom: '8px',
        borderLeft: '4px solid #6b7280',
      }}
    >
      <span
        style={{
          fontSize: '12px',
          fontWeight: 600,
          color: '#9ca3af',
          fontFamily: 'monospace',
          minWidth: '150px',
        }}
      >
        {policy.key}
      </span>

      {editing ? (
        <>
          <input
            type="text"
            value={value}
            onChange={e => setValue(e.target.value)}
            style={{
              flex: 1,
              padding: '6px 10px',
              background: '#1a1a2e',
              border: '1px solid #6b728044',
              borderRadius: '4px',
              color: '#e2e8f0',
              fontSize: '12px',
              fontFamily: 'monospace',
            }}
          />
          <button
            onClick={handleSave}
            style={{
              padding: '6px 12px',
              background: '#22c55e22',
              border: '1px solid #22c55e44',
              borderRadius: '4px',
              color: '#22c55e',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
          <button
            onClick={() => setEditing(false)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #6b7280',
              borderRadius: '4px',
              color: '#6b7280',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
        </>
      ) : (
        <>
          <span
            style={{
              flex: 1,
              fontSize: '12px',
              color: '#9ca3af',
              fontFamily: 'monospace',
            }}
          >
            {JSON.stringify(policy.value)}
          </span>
          <button
            onClick={() => setEditing(true)}
            style={{
              padding: '6px 12px',
              background: 'transparent',
              border: '1px solid #6b7280',
              borderRadius: '4px',
              color: '#6b7280',
              fontSize: '11px',
              cursor: 'pointer',
            }}
          >
            Edit
          </button>
        </>
      )}
    </div>
  );
}
