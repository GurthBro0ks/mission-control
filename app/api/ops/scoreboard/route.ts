import { queryOps } from '@/lib/ops';
import { AGENT_LIST, AGENT_ICONS, AgentKey } from '@/lib/agent-roles';
import { NextResponse } from 'next/server';

interface ScoreboardEntry {
  agent: AgentKey;
  icon: string;
  completed: number;
  streak: number;
}

function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;

  // Get unique dates sorted descending (most recent first)
  const uniqueDates = [...new Set(dates.map(d => d.split('T')[0]))].sort().reverse();

  let maxStreak = 0;
  let currentStreak = 1;

  for (let i = 0; i < uniqueDates.length - 1; i++) {
    const current = new Date(uniqueDates[i]);
    const next = new Date(uniqueDates[i + 1]);
    const diffDays = (current.getTime() - next.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays === 1) {
      currentStreak++;
    } else {
      maxStreak = Math.max(maxStreak, currentStreak);
      currentStreak = 1;
    }
  }

  maxStreak = Math.max(maxStreak, currentStreak);
  return maxStreak;
}

export async function GET() {
  try {
    // Get completed steps in last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysAgoStr = sevenDaysAgo.toISOString();

    // Query completed steps with assigned_to and completed_at
    const completedSteps = queryOps<{ assigned_to: string; completed_at: string }>(
      `SELECT assigned_to, completed_at FROM ops_steps
       WHERE status = 'completed'
         AND completed_at IS NOT NULL
         AND completed_at >= ?
       ORDER BY completed_at DESC`,
      [sevenDaysAgoStr]
    );

    // Group by agent and collect completion dates
    const agentCompletions: Record<string, string[]> = {};

    // Initialize all agents with empty arrays
    AGENT_LIST.forEach(agent => {
      agentCompletions[agent] = [];
    });

    // Fill in actual completions
    completedSteps.forEach(step => {
      if (step.assigned_to && AGENT_LIST.includes(step.assigned_to as AgentKey)) {
        agentCompletions[step.assigned_to].push(step.completed_at);
      }
    });

    // Build scoreboard entries
    const scoreboard: ScoreboardEntry[] = AGENT_LIST.map(agent => {
      const dates = agentCompletions[agent];
      const completed = dates.length;
      const streak = calculateStreak(dates);

      return {
        agent,
        icon: AGENT_ICONS[agent],
        completed,
        streak: streak >= 3 ? streak : 0, // Only show streak if 3+
      };
    });

    // Sort by completed tasks descending
    scoreboard.sort((a, b) => b.completed - a.completed);

    // Calculate summary stats
    const totalTasks = scoreboard.reduce((sum, entry) => sum + entry.completed, 0);
    const avgPerAgent = Math.round(totalTasks / AGENT_LIST.length);
    const mvp = scoreboard.length > 0 ? scoreboard[0].agent : null;

    return NextResponse.json({
      scoreboard,
      summary: {
        totalTasks,
        avgPerAgent,
        mvp,
      },
    });
  } catch (error) {
    console.error('Scoreboard API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch scoreboard data' },
      { status: 500 }
    );
  }
}
