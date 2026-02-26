import { NextResponse } from 'next/server';
import { fileStore, Team } from '@/lib/fileStore';
import { getSteps, getMissions } from '@/lib/ops';

export async function GET() {
  try {
    const team = fileStore.readTeam();

    // Get ops data for each agent
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();
    const todayStart = now.toISOString().split('T')[0] + 'T00:00:00';

    // Enhance agents with ops status
    const allAgents = [team.lead, ...team.subagents];

    const enhancedAgents = allAgents.map((agent) => {
      const agentName = agent.name.toLowerCase();

      // Get running steps for this agent
      const runningSteps = getSteps({
        assignedTo: agentName,
        status: 'in_progress',
        limit: 1,
      });

      // Get completed steps today
      const completedSteps = getSteps({
        assignedTo: agentName,
        status: 'completed',
        limit: 100,
      });
      const completedToday = completedSteps.filter(
        (s) => s.completed_at && s.completed_at >= todayStart
      ).length;

      // Get failed steps in last hour
      const failedSteps = getSteps({
        assignedTo: agentName,
        status: 'failed',
        limit: 100,
      });
      const failedRecently = failedSteps.filter(
        (s) => s.completed_at && s.completed_at >= oneHourAgo
      ).length;

      return {
        ...agent,
        currentTask: runningSteps.length > 0 ? runningSteps[0].description : null,
        completedToday,
        failedRecently,
      };
    });

    const response = {
      lead: enhancedAgents[0],
      subagents: enhancedAgents.slice(1),
      last_updated: team.last_updated,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in /api/agents:', error);
    return NextResponse.json({ error: 'Failed to read team' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { agentId, status, task, location } = body;

    const team = fileStore.readTeam();

    // Update subagent
    const agent = team.subagents.find(a => a.id === agentId);
    if (agent) {
      if (status) agent.status = status;
      if (task) agent.currentTask = task;
      if (location) agent.location = location;
    }

    // Update lead
    if (agentId === 0) {
      if (status) team.lead.status = status;
      if (task) team.lead.currentTask = task;
      if (location) team.lead.location = location;
    }

    team.last_updated = new Date().toISOString();
    fileStore.writeTeam(team);

    return NextResponse.json(team);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update agent' }, { status: 500 });
  }
}
