"use client";

import { useState } from 'react';
import { formatSafeDateTime } from '@/lib/date-utils';

interface Step {
  id: number;
  mission_id: number;
  kind: string;
  description: string;
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

interface StepProgressProps {
  step: Step;
  missionId: number;
  onRetry?: (stepId: number) => void;
  onReview?: (stepId: number, action: 'approve' | 'reject', notes?: string) => void;
}

const STATUS_CONFIG = {
  pending: {
    icon: '⭕',
    color: '#6b7280',
    bgColor: 'transparent',
  },
  in_progress: {
    icon: '⏳',
    color: '#3b82f6',
    bgColor: '#3b82f622',
  },
  completed: {
    icon: '✅',
    color: '#22c55e',
    bgColor: '#22c55e22',
  },
  failed: {
    icon: '❌',
    color: '#ef4444',
    bgColor: '#ef444422',
  },
  pending_review: {
    icon: '👀',
    color: '#f59e0b',
    bgColor: '#f59e0b22',
  },
  deliberation: {
    icon: '🏛️',
    color: '#8b5cf6',
    bgColor: '#8b5cf622',
  },
};

export default function StepProgress({ step, missionId, onRetry, onReview }: StepProgressProps) {
  const isDeliberation = step.kind === 'deliberation';
  const statusKey = isDeliberation && step.status === 'pending' ? 'deliberation' : step.status;
  const config = STATUS_CONFIG[statusKey as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
  const [retrying, setRetrying] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectNotes, setRejectNotes] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [deliberating, setDeliberating] = useState(false);
  const [deliberationDone, setDeliberationDone] = useState(false);

  const handleRetry = async () => {
    if (!onRetry) return;
    setRetrying(true);
    try {
      await onRetry(step.id);
    } finally {
      setRetrying(false);
    }
  };

  const handleApprove = async () => {
    if (!onReview) return;
    setReviewing(true);
    try {
      await onReview(step.id, 'approve');
    } finally {
      setReviewing(false);
    }
  };

  const handleReject = async () => {
    if (!onReview) return;
    setReviewing(true);
    try {
      await onReview(step.id, 'reject', rejectNotes);
      setShowRejectModal(false);
      setRejectNotes('');
    } finally {
      setReviewing(false);
    }
  };

  const handleStartDeliberation = async () => {
    setDeliberating(true);
    try {
      const response = await fetch('/mission-control/api/deliberate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId }),
      });
      if (response.ok) {
        setDeliberationDone(true);
        // Trigger page refresh via router or window reload
        window.location.reload();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to start deliberation');
      }
    } catch (error) {
      console.error('Failed to start deliberation:', error);
      alert('Failed to start deliberation');
    } finally {
      setDeliberating(false);
    }
  };

  const isPendingReview = step.status === 'pending_review';
  const isRejected = step.review_status === 'rejected';
  const isBlocked = step.context?.includes('Waiting for file lock');

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '12px',
        padding: '10px 12px',
        background: config.bgColor,
        borderRadius: '6px',
        border: `1px solid ${config.color}33`,
        borderColor: isPendingReview ? `${config.color}88` : undefined,
        boxShadow: isPendingReview ? `0 0 8px ${config.color}44` : undefined,
        marginBottom: '8px',
      }}
    >
      {/* Status icon */}
      <div
        style={{
          fontSize: '14px',
          width: '20px',
          height: '20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {step.status === 'in_progress' ? (
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: `2px solid ${config.color}`,
              borderTopColor: 'transparent',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }}
          />
        ) : step.status === 'pending_review' ? (
          <span
            style={{
              display: 'inline-block',
              width: '14px',
              height: '14px',
              border: `2px solid ${config.color}`,
              borderRadius: '50%',
              opacity: 0.7,
            }}
          />
        ) : (
          config.icon
        )}
      </div>

      {/* Step content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Kind badge */}
        <div
          style={{
            display: 'inline-block',
            fontSize: '10px',
            padding: '2px 6px',
            borderRadius: '4px',
            background: '#1a1a2e',
            color: '#9ca3af',
            marginBottom: '4px',
            fontWeight: 600,
            textTransform: 'uppercase',
          }}
        >
          {step.kind}
        </div>

        {/* Blocked indicator */}
        {isBlocked && (
          <span
            style={{
              display: 'inline-block',
              fontSize: '10px',
              padding: '2px 6px',
              borderRadius: '4px',
              background: '#f59e0b22',
              color: '#f59e0b',
              marginBottom: '4px',
              marginLeft: '8px',
              fontWeight: 600,
            }}
          >
            🔒 Locked
          </span>
        )}

        {/* Description */}
        <div
          style={{
            fontSize: '13px',
            color: step.status === 'failed' ? '#ef4444' : '#e2e8f0',
            marginBottom: '4px',
            wordBreak: 'break-word',
          }}
        >
          {step.description}
        </div>

        {/* Assignee and timestamp */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            fontSize: '11px',
            color: '#6b7280',
          }}
        >
          {step.assigned_to && (
            <span>
              <span style={{ color: '#9ca3af' }}>Assigned:</span> {step.assigned_to}
            </span>
          )}
          <span>
            {formatSafeDateTime(step.updated_at)}
          </span>
        </div>

        {/* Result if failed or completed */}
        {step.result && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              background: '#0d0d16',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: step.status === 'failed' ? '#ef4444' : '#9ca3af',
              maxHeight: '80px',
              overflow: 'auto',
            }}
          >
            {step.result}
          </div>
        )}

        {/* Context packet */}
        {step.context && (
          <details style={{ marginTop: '8px' }}>
            <summary style={{
              fontSize: '11px',
              color: '#8b5cf6',
              cursor: 'pointer',
              fontWeight: 600,
            }}>
              Context Packet
            </summary>
            <div style={{
              marginTop: '4px',
              padding: '8px',
              background: '#0d0d16',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: '#9ca3af',
              maxHeight: '120px',
              overflow: 'auto',
              whiteSpace: 'pre-wrap',
            }}>
              {step.context}
            </div>
          </details>
        )}

        {/* Retry button for failed steps */}
        {step.status === 'failed' && onRetry && (
          <button
            onClick={handleRetry}
            disabled={retrying}
            style={{
              marginTop: '8px',
              padding: '6px 12px',
              background: retrying ? '#7c3aed44' : '#7c3aed22',
              border: '1px solid #7c3aed44',
              borderRadius: '4px',
              color: retrying ? '#a78bfa' : '#a78bfa',
              fontSize: '11px',
              fontWeight: 600,
              cursor: retrying ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            {retrying ? '↻ Retrying...' : '↻ Retry'}
          </button>
        )}

        {/* Start Board Meeting button for deliberation steps */}
        {isDeliberation && step.status === 'pending' && !deliberationDone && (
          <button
            onClick={handleStartDeliberation}
            disabled={deliberating}
            style={{
              marginTop: '8px',
              padding: '8px 16px',
              background: deliberating ? '#8b5cf644' : '#8b5cf622',
              border: '1px solid #8b5cf644',
              borderRadius: '4px',
              color: deliberating ? '#a78bfa' : '#8b5cf6',
              fontSize: '12px',
              fontWeight: 600,
              cursor: deliberating ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            {deliberating ? '🏛️ Running Board Meeting...' : '🏛️ Start Board Meeting'}
          </button>
        )}

        {/* Review buttons for pending_review steps */}
        {isPendingReview && onReview && (
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button
              onClick={handleApprove}
              disabled={reviewing}
              style={{
                padding: '6px 12px',
                background: reviewing ? '#22c55e44' : '#22c55e22',
                border: '1px solid #22c55e44',
                borderRadius: '4px',
                color: reviewing ? '#4ade80' : '#22c55e',
                fontSize: '11px',
                fontWeight: 600,
                cursor: reviewing ? 'wait' : 'pointer',
              }}
            >
              {reviewing ? 'Approving...' : '✓ Approve'}
            </button>
            <button
              onClick={() => setShowRejectModal(true)}
              disabled={reviewing}
              style={{
                padding: '6px 12px',
                background: reviewing ? '#ef444444' : '#ef444422',
                border: '1px solid #ef444444',
                borderRadius: '4px',
                color: reviewing ? '#f87171' : '#ef4444',
                fontSize: '11px',
                fontWeight: 600,
                cursor: reviewing ? 'wait' : 'pointer',
              }}
            >
              ✗ Reject
            </button>
          </div>
        )}

        {/* Review notes for rejected steps */}
        {isRejected && step.review_notes && (
          <div
            style={{
              marginTop: '8px',
              padding: '8px',
              background: '#ef444422',
              borderRadius: '4px',
              border: '1px solid #ef444444',
              fontSize: '11px',
              color: '#f87171',
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: '4px' }}>Rejection Notes:</div>
            {step.review_notes}
            {step.reviewed_by && (
              <div style={{ marginTop: '4px', color: '#6b7280', fontSize: '10px' }}>
                — {step.reviewed_by}
              </div>
            )}
          </div>
        )}

        {/* Reject modal */}
        {showRejectModal && (
          <div
            style={{
              marginTop: '8px',
              padding: '12px',
              background: '#1a1a2e',
              borderRadius: '4px',
              border: '1px solid #ef444444',
            }}
          >
            <div style={{ fontSize: '11px', color: '#9ca3af', marginBottom: '8px' }}>
              Enter rejection notes:
            </div>
            <textarea
              value={rejectNotes}
              onChange={(e) => setRejectNotes(e.target.value)}
              placeholder="Reason for rejection..."
              style={{
                width: '100%',
                padding: '8px',
                background: '#0d0d16',
                border: '1px solid #374151',
                borderRadius: '4px',
                color: '#e2e8f0',
                fontSize: '11px',
                fontFamily: 'inherit',
                resize: 'vertical',
                minHeight: '60px',
                marginBottom: '8px',
              }}
            />
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleReject}
                disabled={reviewing}
                style={{
                  padding: '6px 12px',
                  background: '#ef4444',
                  border: 'none',
                  borderRadius: '4px',
                  color: 'white',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: reviewing ? 'wait' : 'pointer',
                }}
              >
                {reviewing ? 'Rejecting...' : 'Confirm Reject'}
              </button>
              <button
                onClick={() => { setShowRejectModal(false); setRejectNotes(''); }}
                style={{
                  padding: '6px 12px',
                  background: 'transparent',
                  border: '1px solid #374151',
                  borderRadius: '4px',
                  color: '#9ca3af',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
