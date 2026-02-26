import { NextResponse } from 'next/server';
import { getMission, getSteps, updateMissionStatus, emitEvent } from '@/lib/ops';
import { appEmitter } from '@/lib/events';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ missionId: string }> }
) {
  try {
    const { missionId } = await params;
    const missionIdNum = parseInt(missionId);

    // Get the mission
    const mission = getMission(missionIdNum);
    if (!mission) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Get all steps for this mission
    const steps = getSteps({ missionId: missionIdNum });

    if (steps.length === 0) {
      return NextResponse.json({
        mission,
        status: 'no_steps',
        message: 'Mission has no steps'
      });
    }

    // Check step statuses
    const completedSteps = steps.filter(s => s.status === 'completed');
    const failedSteps = steps.filter(s => s.status === 'failed');
    const pendingSteps = steps.filter(s => s.status === 'pending');
    const inProgressSteps = steps.filter(s => s.status === 'in_progress');

    let missionStatus = mission.status;
    let emitType = null;

    // If any step failed, mark mission as failed
    if (failedSteps.length > 0) {
      missionStatus = 'failed';
      emitType = 'mission_failed';
    }
    // If all steps completed, mark mission as completed
    else if (completedSteps.length === steps.length) {
      missionStatus = 'completed';
      emitType = 'mission_completed';
    }
    // If mission is still pending and has in_progress steps, mark as in_progress
    else if (inProgressSteps.length > 0 && mission.status !== 'in_progress') {
      missionStatus = 'in_progress';
    }

    // Update mission status if changed
    if (missionStatus !== mission.status) {
      const updatedMission = updateMissionStatus(
        missionIdNum,
        missionStatus as 'pending' | 'in_progress' | 'completed' | 'failed'
      );

      if (emitType) {
        emitEvent(emitType, 'system', {
          missionId: missionIdNum,
          title: mission.title,
          completedSteps: completedSteps.length,
          totalSteps: steps.length
        });
        // Extract status from emitType (e.g., "mission_completed" -> "completed")
        const status = emitType.replace('mission_', '');
        appEmitter.emit('mission', { id: missionIdNum, title: mission.title, status });
      }

      return NextResponse.json({
        mission: updatedMission,
        status: missionStatus,
        steps_summary: {
          total: steps.length,
          completed: completedSteps.length,
          failed: failedSteps.length,
          pending: pendingSteps.length,
          in_progress: inProgressSteps.length
        }
      });
    }

    // Mission status unchanged
    return NextResponse.json({
      mission,
      status: missionStatus,
      steps_summary: {
        total: steps.length,
        completed: completedSteps.length,
        failed: failedSteps.length,
        pending: pendingSteps.length,
        in_progress: inProgressSteps.length
      }
    });
  } catch (error) {
    console.error('[ops/finalize] POST error:', error);
    return NextResponse.json({ error: 'Failed to finalize mission' }, { status: 500 });
  }
}
