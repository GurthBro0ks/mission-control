"use client";

import { formatSafeDate } from '@/lib/date-utils';

interface Step {
  id: number;
  mission_id: number;
  step_order: number;
  kind: string;
  description: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'pending_review';
  assigned_to: string | null;
  result: string | null;
  created_at: string;
  updated_at: string;
  depends_on: string | null;
  review_status: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  context: string | null;
  locked_files: string;
}

interface Mission {
  id: number;
  title: string;
  status: string;
  result: string | null;
}

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

interface ProposalCardProps {
  proposal: Proposal;
  mission?: Mission;
  steps?: Step[];
  onApprove?: (id: number) => void;
  onReject?: (id: number) => void;
}

const STATUS_CONFIG = {
  pending: {
    bgColor: '#fbbf2422',
    borderColor: '#fbbf2444',
    textColor: '#fbbf24',
    label: 'Pending',
  },
  approved: {
    bgColor: '#22c55e22',
    borderColor: '#22c55e44',
    textColor: '#22c55e',
    label: 'Approved',
  },
  rejected: {
    bgColor: '#ef444422',
    borderColor: '#ef444444',
    textColor: '#ef4444',
    label: 'Rejected',
  },
};

export default function ProposalCard({ proposal, mission, steps, onApprove, onReject }: ProposalCardProps) {
  const config = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.pending;
  const isPending = proposal.status === 'pending';

  // Calculate pipeline progress
  const completedSteps = steps?.filter(s => s.status === 'completed').length || 0;
  const totalSteps = steps?.length || 0;
  const progress = totalSteps > 0 ? (completedSteps / totalSteps) * 100 : 0;
  const isOrphaned = proposal.status === 'approved' && proposal.mission_id && !mission;

  return (
    <div
      style={{
        background: '#0a0a0f',
        border: `1px solid ${config.borderColor}`,
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '12px',
      }}
    >
      {/* Header row */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '10px',
        }}
      >
        {/* Status badge */}
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            padding: '3px 8px',
            borderRadius: '4px',
            background: config.bgColor,
            color: config.textColor,
            fontSize: '11px',
            fontWeight: 600,
          }}
        >
          <span
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: config.textColor,
            }}
          />
          {config.label}
        </span>

        {/* Priority */}
        <span
          style={{
            fontSize: '10px',
            color: '#6b7280',
            textTransform: 'uppercase',
          }}
        >
          {proposal.priority || 'normal'} priority
        </span>
      </div>

      {/* Title */}
      <h3
        style={{
          fontSize: '14px',
          fontWeight: 'bold',
          color: '#e2e8f0',
          margin: '0 0 8px 0',
        }}
      >
        {proposal.title}
      </h3>

      {/* Description */}
      {proposal.description && (
        <p
          style={{
            fontSize: '12px',
            color: '#9ca3af',
            margin: '0 0 10px 0',
            lineHeight: 1.5,
          }}
        >
          {proposal.description}
        </p>
      )}

      {/* Meta info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: isPending ? '12px' : '0',
        }}
      >
        <span>
          <span style={{ color: '#9ca3af' }}>Source:</span> {proposal.source}
        </span>
        {proposal.agent && (
          <span>
            <span style={{ color: '#9ca3af' }}>Agent:</span> {proposal.agent}
          </span>
        )}
        <span>
          {formatSafeDate(proposal.created_at)}
        </span>
        {proposal.requires_human_approval && (
          <span
            style={{
              color: '#f59e0b',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '2px',
            }}
          >
            🔒 Requires approval
          </span>
        )}
      </div>

      {/* Pipeline Status - for approved proposals */}
      {proposal.status === 'approved' && (
        <div style={{ marginTop: '12px' }}>
          {isOrphaned ? (
            <div style={{
              padding: '8px 12px',
              background: '#f59e0b22',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}>
              ⚠️ Approved — No mission created (orphaned)
            </div>
          ) : mission ? (
            <div>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#22c55e',
                marginBottom: '6px',
              }}>
                <span>✓ Approved</span>
                <span style={{ color: '#6b7280' }}>→</span>
                <span>Mission #{mission.id}</span>
                <span style={{ color: '#6b7280' }}>→</span>
                <span>{completedSteps}/{totalSteps} steps complete</span>
              </div>
              {/* Progress bar */}
              <div style={{
                height: '4px',
                background: '#1a1a2e',
                borderRadius: '2px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  width: `${progress}%`,
                  background: mission.status === 'completed' ? '#22c55e'
                    : mission.status === 'failed' ? '#ef4444'
                    : '#22d3ee',
                  borderRadius: '2px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
          ) : (
            <div style={{
              padding: '8px 12px',
              background: '#22c55e22',
              borderRadius: '6px',
              fontSize: '12px',
              color: '#22c55e',
            }}>
              ✓ Approved — Mission pending creation
            </div>
          )}
        </div>
      )}

      {/* Rejection reason */}
      {proposal.status === 'rejected' && proposal.rejection_reason && (
        <div
          style={{
            marginTop: '10px',
            padding: '8px',
            background: '#ef444422',
            borderRadius: '4px',
            fontSize: '11px',
            color: '#ef4444',
          }}
        >
          <strong>Reason:</strong> {proposal.rejection_reason}
        </div>
      )}

      {/* Action buttons for pending proposals */}
      {isPending && (
        <div
          style={{
            display: 'flex',
            gap: '8px',
            marginTop: '12px',
          }}
        >
          <button
            onClick={() => onApprove?.(proposal.id)}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: '#22c55e22',
              border: '1px solid #22c55e44',
              borderRadius: '6px',
              color: '#22c55e',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#22c55e33';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#22c55e22';
            }}
          >
            ✅ Approve
          </button>
          <button
            onClick={() => onReject?.(proposal.id)}
            style={{
              flex: 1,
              padding: '8px 16px',
              background: '#ef444422',
              border: '1px solid #ef444444',
              borderRadius: '6px',
              color: '#ef4444',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#ef444433';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#ef444422';
            }}
          >
            ❌ Reject
          </button>
        </div>
      )}
    </div>
  );
}
