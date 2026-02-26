import { NextResponse } from 'next/server';
import { getMission, getMissionWithSteps, updateMissionStatus, emitEvent } from '@/lib/ops';
import { appEmitter } from '@/lib/events';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const withSteps = new URL(request.url).searchParams.get('with_steps') === 'true';

    if (withSteps) {
      const missionWithSteps = getMissionWithSteps(parseInt(id));
      if (!missionWithSteps) {
        return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
      }
      return NextResponse.json(missionWithSteps);
    }

    const mission = getMission(parseInt(id));
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    return NextResponse.json({ mission });
  } catch (error) {
    console.error('[ops/missions/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to get mission' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, result } = body;

    if (!status) {
      return NextResponse.json({ error: 'Missing required field: status' }, { status: 400 });
    }

    if (!['pending', 'in_progress', 'completed', 'failed'].includes(status)) {
      return NextResponse.json(
        { error: 'Invalid status. Must be: pending, in_progress, completed, or failed' },
        { status: 400 }
      );
    }

    const mission = updateMissionStatus(parseInt(id), status, result);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    emitEvent(`mission_${status}`, 'system', { missionId: mission.id, title: mission.title });
    appEmitter.emit('mission', { id: mission.id, title: mission.title, status });

    return NextResponse.json({ success: true, mission });
  } catch (error) {
    console.error('[ops/missions/[id]] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update mission' }, { status: 500 });
  }
}
