"use client";

import { useMemo } from 'react';

interface Step {
  id: number;
  mission_id: number;
  kind: string;
  description: string;
  status: 'pending' | 'in_progress' | 'active' | 'queued' | 'completed' | 'failed' | 'pending_review';
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

interface MissionDAGProps {
  steps: Step[];
}

const STATUS_CONFIG = {
  pending: {
    borderColor: '#6b7280',
    bgColor: '#1a1a2e',
    textColor: '#9ca3af',
  },
  in_progress: {
    borderColor: '#fbbf24',
    bgColor: '#fbbf2422',
    textColor: '#fbbf24',
  },
  active: {
    borderColor: '#3b82f6',
    bgColor: '#3b82f622',
    textColor: '#3b82f6',
  },
  queued: {
    borderColor: '#8b5cf6',
    bgColor: '#8b5cf622',
    textColor: '#8b5cf6',
  },
  completed: {
    borderColor: '#22c55e',
    bgColor: '#22c55e22',
    textColor: '#22c55e',
  },
  failed: {
    borderColor: '#ef4444',
    bgColor: '#ef444422',
    textColor: '#ef4444',
  },
  pending_review: {
    borderColor: '#f59e0b',
    bgColor: '#f59e0b22',
    textColor: '#f59e0b',
  },
};

// Parse depends_on from string to array of numbers
function parseDependsOn(dependsOn: string | null): number[] {
  if (!dependsOn) return [];
  try {
    const parsed = JSON.parse(dependsOn);
    return Array.isArray(parsed) ? parsed.map(Number) : [Number(parsed)];
  } catch {
    // Try comma-separated
    if (dependsOn.includes(',')) {
      return dependsOn.split(',').map(s => Number(s.trim())).filter(n => !isNaN(n));
    }
    // Single ID
    const num = Number(dependsOn);
    return isNaN(num) ? [] : [num];
  }
}

// Calculate depth (distance from root) for each step
function calculateDepths(steps: Step[]): Map<number, number> {
  const depths = new Map<number, number>();
  const stepMap = new Map(steps.map(s => [s.id, s]));

  // First pass: calculate depths recursively
  function getDepth(stepId: number, visited: Set<number> = new Set()): number {
    if (visited.has(stepId)) return 0; // Circular dependency protection
    const step = stepMap.get(stepId);
    if (!step) return 0;

    const deps = parseDependsOn(step.depends_on);
    if (deps.length === 0) return 0;

    visited.add(stepId);
    let maxDepDepth = 0;
    for (const depId of deps) {
      maxDepDepth = Math.max(maxDepDepth, getDepth(depId, new Set(visited)));
    }
    return maxDepDepth + 1;
  }

  for (const step of steps) {
    depths.set(step.id, getDepth(step.id));
  }

  return depths;
}

// Check if a step is blocked (has dependencies that aren't complete)
function isStepBlocked(step: Step, steps: Step[]): boolean {
  const deps = parseDependsOn(step.depends_on);
  if (deps.length === 0) return false;

  const stepMap = new Map(steps.map(s => [s.id, s]));
  for (const depId of deps) {
    const depStep = stepMap.get(depId);
    if (!depStep || depStep.status !== 'completed') {
      return true;
    }
  }
  return false;
}

// Get all edges (connections) between steps
function getEdges(steps: Step[]): [number, number][] {
  const edges: [number, number][] = [];
  for (const step of steps) {
    const deps = parseDependsOn(step.depends_on);
    for (const depId of deps) {
      edges.push([depId, step.id]);
    }
  }
  return edges;
}

export default function MissionDAG({ steps }: MissionDAGProps) {
  const depths = useMemo(() => calculateDepths(steps), [steps]);
  const edges = useMemo(() => getEdges(steps), [steps]);

  // Group steps by depth for column layout
  const stepsByDepth = useMemo(() => {
    const grouped = new Map<number, Step[]>();
    for (const step of steps) {
      const depth = depths.get(step.id) || 0;
      if (!grouped.has(depth)) {
        grouped.set(depth, []);
      }
      grouped.get(depth)!.push(step);
    }
    return grouped;
  }, [steps, depths]);

  const maxDepth = Math.max(...Array.from(stepsByDepth.keys()), 0);

  // Calculate positions for nodes
  const nodePositions = useMemo(() => {
    const positions = new Map<number, { x: number; y: number; width: number; height: number }>();
    const nodeWidth = 180;
    const nodeHeight = 70;
    const horizontalGap = 60;
    const verticalGap = 20;

    for (const [depth, depthSteps] of stepsByDepth) {
      const x = depth * (nodeWidth + horizontalGap);
      depthSteps.forEach((step, index) => {
        const y = index * (nodeHeight + verticalGap);
        positions.set(step.id, { x, y, width: nodeWidth, height: nodeHeight });
      });
    }

    return positions;
  }, [stepsByDepth]);

  // Calculate SVG dimensions
  const svgWidth = (maxDepth + 1) * 240 + 40;
  const svgHeight = Math.max(...Array.from(nodePositions.values()).map(p => p.y + p.height), 0) + 40;

  return (
    <div
      style={{
        overflowX: 'auto',
        overflowY: 'auto',
        padding: '16px',
        background: '#0a0a0f',
        borderRadius: '6px',
        border: '1px solid #1a1a2e',
        minHeight: '200px',
      }}
    >
      <svg
        width={svgWidth}
        height={svgHeight}
        style={{ display: 'block', minWidth: '400px' }}
      >
        {/* Draw edges as arrows */}
        {edges.map(([fromId, toId]) => {
          const fromPos = nodePositions.get(fromId);
          const toPos = nodePositions.get(toId);
          if (!fromPos || !toPos) return null;

          const fromX = fromPos.x + fromPos.width;
          const fromY = fromPos.y + fromPos.height / 2;
          const toX = toPos.x;
          const toY = toPos.y + toPos.height / 2;

          // Curved path
          const midX = (fromX + toX) / 2;
          const path = `M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`;

          return (
            <g key={`${fromId}-${toId}`}>
              <path
                d={path}
                fill="none"
                stroke="#4b5563"
                strokeWidth="2"
                markerEnd="url(#arrowhead)"
              />
            </g>
          );
        })}

        {/* Arrow marker definition */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#4b5563" />
          </marker>
        </defs>
      </svg>

      {/* Render nodes as HTML overlay */}
      <div
        style={{
          position: 'relative',
          marginTop: -svgHeight,
        }}
      >
        {steps.map(step => {
          const pos = nodePositions.get(step.id);
          if (!pos) return null;

          const blocked = isStepBlocked(step, steps);
          const config = STATUS_CONFIG[step.status] || STATUS_CONFIG.pending;
          const borderColor = blocked ? '#ef4444' : config.borderColor;

          return (
            <div
              key={step.id}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: pos.width,
                height: pos.height,
                background: config.bgColor,
                border: `2px solid ${borderColor}`,
                borderRadius: '6px',
                padding: '8px',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
              }}
            >
              {/* Status indicator */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  marginBottom: '4px',
                }}
              >
                <span
                  style={{
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    background: borderColor,
                    ...(step.status === 'in_progress' ? { animation: 'pulse 1s infinite' } : {}),
                  }}
                />
                <span
                  style={{
                    fontSize: '9px',
                    color: '#6b7280',
                    textTransform: 'uppercase',
                    fontWeight: 600,
                  }}
                >
                  #{step.id}
                </span>
                {blocked && (
                  <span style={{ color: '#ef4444', fontSize: '10px' }}>🔒</span>
                )}
              </div>

              {/* Kind badge */}
              <div
                style={{
                  fontSize: '9px',
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  fontWeight: 600,
                  marginBottom: '2px',
                }}
              >
                {step.kind}
              </div>

              {/* Description */}
              <div
                style={{
                  fontSize: '11px',
                  color: config.textColor,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
                title={step.description || ''}
              >
                {step.description || '(no description)'}
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div
        style={{
          display: 'flex',
          gap: '16px',
          marginTop: '12px',
          paddingTop: '12px',
          borderTop: '1px solid #1a1a2e',
          fontSize: '10px',
          color: '#6b7280',
          flexWrap: 'wrap',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#22c55e' }} />
          Complete
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#fbbf24' }} />
          In Progress
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#f59e0b' }} />
          Pending Review
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#6b7280' }} />
          Pending
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444' }} />
          Blocked
        </span>
      </div>

      <style jsx>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
