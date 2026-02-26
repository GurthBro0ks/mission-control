import { NextResponse } from 'next/server';
import { createMission, getMissions, getMissionWithSteps, emitEvent } from '@/lib/ops';
import { appEmitter } from '@/lib/events';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const assignedTo = searchParams.get('assigned_to') || undefined;
    const delegatedTo = searchParams.get('delegated_to') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const missions = getMissions({ status, assignedTo, delegatedTo, limit, offset });
    return NextResponse.json({ missions });
  } catch (error) {
    console.error('[ops/missions] GET error:', error);
    return NextResponse.json({ error: 'Failed to get missions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { proposalId, title, assignedTo, delegatedTo, priority, steps } = body;

    if (!title) {
      return NextResponse.json({ error: 'Missing required field: title' }, { status: 400 });
    }

    const mission = createMission({
      proposalId,
      title,
      assignedTo,
      delegatedTo,
      priority,
      steps
    });

    emitEvent('mission_created', 'system', { missionId: mission.id, title: mission.title });
    appEmitter.emit('mission', { id: mission.id, title: mission.title, status: 'started' });

    return NextResponse.json({ success: true, mission });
  } catch (error) {
    console.error('[ops/missions] POST error:', error);
    return NextResponse.json({ error: 'Failed to create mission' }, { status: 500 });
  }
}
