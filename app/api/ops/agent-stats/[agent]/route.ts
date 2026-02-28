import { NextRequest, NextResponse } from 'next/server';
import { AGENT_ROLES, AgentKey } from '@/lib/agent-roles';
import sqlite3 from 'better-sqlite3';

const db = new sqlite3('/home/slimy/ned-clawd/ops/ops.db');

export type Stats = {
  delegation: number;
  execution: number;
  research: number;
  trading: number;
  security: number;
  devops: number;
  gossip: number;
  refactoring: number;
};

type StatsResponse = {
  agent: string;
  base: Stats;
  current: Stats;
  delta: Stats;
};

// Map task kinds to stat categories
const TASK_KIND_MAP: Record<string, (keyof Stats)[]> = {
  // Research-related tasks
  analyze_trade: ['research'],
  research: ['research'],
  analyze: ['research'],
  evaluate_trade: ['trading', 'research'],
  verify: ['research'],
  // Security-related tasks
  security_audit: ['security'],
  vulnerability_scan: ['security'],
  // DevOps-related tasks
  deploy: ['devops'],
  test: ['devops'],
  // Refactoring-related tasks
  fix: ['refactoring'],
  refactor: ['refactoring'],
  diagnose_failure: ['refactoring'],
  // Execution - catch-all for completed tasks
  plan_sprint: ['execution'],
  daily_briefing: ['execution'],
  verify_database: ['execution'],
  verify_api: ['execution'],
};

// Calculate boosted stats based on task completions
function calculateStats(base: Stats, completions: Record<string, number>): { current: Stats; delta: Stats } {
  const current = { ...base };

  // Execution: +1 per completed task (max +15)
  const totalCompleted = Object.values(completions).reduce((sum, count) => sum + count, 0);
  current.execution = Math.min(100, base.execution + Math.min(15, totalCompleted));

  // Research: completed analyze, evaluate_trade, verify, research tasks
  const researchTasks = ['analyze_trade', 'research', 'analyze', 'evaluate_trade', 'verify'];
  const researchCompleted = researchTasks.reduce((sum, task) => sum + (completions[task] || 0), 0);
  current.research = Math.min(100, base.research + Math.min(20, researchCompleted * 3));

  // Trading: evaluate_trade completions
  current.trading = Math.min(100, base.trading + Math.min(25, (completions['evaluate_trade'] || 0) * 5));

  // Security: security-related task completions
  const securityTasks = ['security_audit', 'vulnerability_scan'];
  const securityCompleted = securityTasks.reduce((sum, task) => sum + (completions[task] || 0), 0);
  current.security = Math.min(100, base.security + Math.min(20, securityCompleted * 5));

  // DevOps: deploy, test task completions
  const devopsTasks = ['deploy', 'test'];
  const devopsCompleted = devopsTasks.reduce((sum, task) => sum + (completions[task] || 0), 0);
  current.devops = Math.min(100, base.devops + Math.min(25, devopsCompleted * 4));

  // Refactoring: fix, refactor, diagnose_failure completions
  const refactorTasks = ['fix', 'refactor', 'diagnose_failure'];
  const refactorCompleted = refactorTasks.reduce((sum, task) => sum + (completions[task] || 0), 0);
  current.refactoring = Math.min(100, base.refactoring + Math.min(20, refactorCompleted * 4));

  // Calculate delta
  const delta: Stats = {
    delegation: 0, // Delegation doesn't change from task completions
    execution: current.execution - base.execution,
    research: current.research - base.research,
    trading: current.trading - base.trading,
    security: current.security - base.security,
    devops: current.devops - base.devops,
    gossip: 0, // Gossip doesn't change from task completions
    refactoring: current.refactoring - base.refactoring,
  };

  return { current, delta };
}

// Helper to find agent key by key or display name
function findAgentKey(agent: string): AgentKey | null {
  const normalized = agent.toLowerCase().replace(/%20/g, ' ');
  // Check if it's a key
  if (normalized in AGENT_ROLES) return normalized as AgentKey;
  // Check if it's a display name
  for (const [key, role] of Object.entries(AGENT_ROLES)) {
    if (role.name.toLowerCase() === normalized) return key as AgentKey;
  }
  return null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ agent: string }> }
) {
  const { agent } = await params;

  // Validate agent exists (supports both key and display name)
  const agentKey = findAgentKey(agent);
  if (!agentKey) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
  }

  const baseStats = AGENT_ROLES[agentKey].stats;

  // Use agentKey for response (works for both key and display name inputs)
  const responseAgent = agentKey;

  try {
    // Query completed tasks for this agent
    const stmt = db.prepare(`
      SELECT kind, COUNT(*) as count
      FROM ops_steps
      WHERE assigned_to = ? AND status = 'completed'
      GROUP BY kind
    `);

    const rows = stmt.all(agentKey) as { kind: string; count: number }[];

    const completions: Record<string, number> = {};
    rows.forEach(row => {
      completions[row.kind] = row.count;
    });

    const { current, delta } = calculateStats(baseStats, completions);

    const response: StatsResponse = {
      agent: responseAgent,
      base: baseStats,
      current,
      delta,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error fetching agent stats:', error);
    // Return base stats on error
    return NextResponse.json({
      agent: responseAgent,
      base: baseStats,
      current: baseStats,
      delta: {
        delegation: 0,
        execution: 0,
        research: 0,
        trading: 0,
        security: 0,
        devops: 0,
        gossip: 0,
        refactoring: 0,
      },
    });
  }
}
