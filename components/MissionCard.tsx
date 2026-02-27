"use client";

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import StepProgress from './StepProgress';
import MissionDAG from './MissionDAG';
import { formatSafeDate } from '@/lib/date-utils';

export interface Step {
  id: number;
  mission_id: number;
  step_order: number;
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
}

interface MissionCardProps {
  mission: Mission;
  steps?: Step[];
}

const STATUS_CONFIG = {
  pending: {
    bgColor: '#fbbf2422',
    borderColor: '#fbbf2444',
    textColor: '#fbbf24',
    label: 'Pending',
  },
  in_progress: {
    bgColor: '#3b82f622',
    borderColor: '#3b82f644',
    textColor: '#3b82f6',
    label: 'In Progress',
  },
  active: {
    bgColor: '#3b82f622',
    borderColor: '#3b82f644',
    textColor: '#3b82f6',
    label: 'Active',
  },
  queued: {
    bgColor: '#8b5cf622',
    borderColor: '#8b5cf644',
    textColor: '#8b5cf6',
    label: 'Queued',
  },
  completed: {
    bgColor: '#22c55e22',
    borderColor: '#22c55e44',
    textColor: '#22c55e',
    label: 'Completed',
  },
  failed: {
    bgColor: '#ef444422',
    borderColor: '#ef444444',
    textColor: '#ef4444',
    label: 'Failed',
  },
};

export default function MissionCard({ mission, steps = [] }: MissionCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'dag'>('list');
  const router = useRouter();
  const config = STATUS_CONFIG[mission.status] || STATUS_CONFIG.pending;

  const handleRetryStep = async (stepId: number) => {
    try {
      await fetch(`/mission-control/api/ops/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'pending', result: null }),
      });
      // Refresh the page to show updated status
      router.refresh();
    } catch (error) {
      console.error('Failed to retry step:', error);
    }
  };

  const handleReviewStep = async (stepId: number, action: 'approve' | 'reject', notes?: string) => {
    try {
      await fetch(`/mission-control/api/ops/steps/${stepId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reviewAction: action, reviewedBy: 'user', reviewNotes: notes }),
      });
      router.refresh();
    } catch (error) {
      console.error('Failed to review step:', error);
    }
  };

  const completedSteps = steps.filter(s => s.status === 'completed').length;
  const totalSteps = steps.length || 1;
  const progressPercent = Math.round((completedSteps / totalSteps) * 100);

  return (
    <div
      style={{
        background: '#0a0a0f',
        border: `2px solid ${config.borderColor}`,
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '12px',
        cursor: 'pointer',
        transition: 'all 0.2s',
      }}
      onClick={() => setExpanded(!expanded)}
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

        {/* Mission ID */}
        <span
          style={{
            fontSize: '10px',
            color: '#6b7280',
            fontFamily: 'monospace',
          }}
        >
          #{mission.id}
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
        {mission.title}
      </h3>

      {/* Meta info */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '16px',
          fontSize: '11px',
          color: '#6b7280',
          marginBottom: '12px',
        }}
      >
        {mission.assigned_to && (
          <span>
            <span style={{ color: '#9ca3af' }}>Assigned:</span>{' '}
            <span style={{ color: '#22d3ee' }}>{mission.assigned_to}</span>
          </span>
        )}
        {mission.delegated_to && (
          <span>
            <span style={{ color: '#9ca3af' }}>Delegated:</span>{' '}
            <span style={{ color: '#a78bfa' }}>{mission.delegated_to}</span>
          </span>
        )}
        <span>
          {formatSafeDate(mission.created_at)}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{ marginBottom: expanded ? '12px' : '0' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            fontSize: '10px',
            color: '#6b7280',
            marginBottom: '4px',
          }}
        >
          <span>Progress</span>
          <span>{completedSteps}/{totalSteps} steps ({progressPercent}%)</span>
        </div>
        <div
          style={{
            height: '6px',
            borderRadius: '3px',
            background: '#1a1a2e',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              height: '100%',
              width: `${progressPercent}%`,
              background: config.textColor,
              borderRadius: '3px',
              transition: 'width 0.3s ease',
            }}
          />
        </div>
      </div>

      {/* Expandable steps */}
      {expanded && steps.length > 0 && (
        <div
          style={{
            marginTop: '12px',
            paddingTop: '12px',
            borderTop: '1px solid #1a1a2e',
          }}
        >
          {/* View toggle */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '12px',
            }}
          >
            <div
              style={{
                fontSize: '11px',
                color: '#9ca3af',
                fontWeight: 600,
              }}
            >
              Steps
            </div>
            <div
              style={{
                display: 'flex',
                gap: '4px',
              }}
            >
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('list');
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  background: viewMode === 'list' ? '#7c3aed22' : 'transparent',
                  border: `1px solid ${viewMode === 'list' ? '#7c3aed44' : '#374151'}`,
                  borderRadius: '4px',
                  color: viewMode === 'list' ? '#a78bfa' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                List
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setViewMode('dag');
                }}
                style={{
                  padding: '4px 8px',
                  fontSize: '10px',
                  background: viewMode === 'dag' ? '#7c3aed22' : 'transparent',
                  border: `1px solid ${viewMode === 'dag' ? '#7c3aed44' : '#374151'}`,
                  borderRadius: '4px',
                  color: viewMode === 'dag' ? '#a78bfa' : '#6b7280',
                  cursor: 'pointer',
                }}
              >
                DAG
              </button>
            </div>
          </div>

          {/* Render based on view mode */}
          {viewMode === 'dag' ? (
            <MissionDAG steps={steps} />
          ) : (
            steps.map(step => (
              <StepProgress key={step.id} step={step} missionId={mission.id} onRetry={handleRetryStep} onReview={handleReviewStep} />
            ))
          )}
        </div>
      )}

      {/* Result if failed or completed */}
      {mission.result && (
        <div
          style={{
            marginTop: expanded ? '12px' : '0',
            paddingTop: expanded ? '12px' : '0',
            borderTop: expanded ? '1px solid #1a1a2e' : 'none',
          }}
        >
          <div
            style={{
              padding: '8px',
              background: '#0d0d16',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'monospace',
              color: mission.status === 'failed' ? '#ef4444' : '#9ca3af',
              maxHeight: expanded ? '120px' : '40px',
              overflow: 'auto',
            }}
          >
            {mission.result}
          </div>
        </div>
      )}
    </div>
  );
}
