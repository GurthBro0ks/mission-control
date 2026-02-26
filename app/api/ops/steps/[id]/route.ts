import { NextResponse } from 'next/server';
import { getStep, updateStep, emitEvent } from '@/lib/ops';
import { appEmitter } from '@/lib/events';
import { assembleContextPacket } from '@/lib/context-packet';
import { acquireLocks, releaseLocks, extractFilePaths } from '@/lib/file-lock';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const step = getStep(parseInt(id));

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    return NextResponse.json({ step });
  } catch (error) {
    console.error('[ops/steps/[id]] GET error:', error);
    return NextResponse.json({ error: 'Failed to get step' }, { status: 500 });
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { status, assignedTo, result, retryCount, reviewAction, reviewedBy, reviewNotes } = body;

    let step;

    // Handle review actions
    if (reviewAction === 'approve') {
      step = updateStep(parseInt(id), {
        status: 'completed',
        reviewStatus: 'approved',
        reviewedBy: reviewedBy || 'reviewer',
        reviewNotes: reviewNotes || null,
        skipReviewGate: true,
      });
      // Release locks on approval
      if (step) {
        releaseLocks(step.id);
      }
    } else if (reviewAction === 'reject') {
      step = updateStep(parseInt(id), {
        status: 'pending',
        reviewStatus: 'rejected',
        reviewedBy: reviewedBy || 'reviewer',
        reviewNotes: reviewNotes || null,
      });
      // Release locks on rejection
      if (step) {
        releaseLocks(step.id);
      }
    } else {
      // Check for file locks when moving to in_progress
      if (status === 'in_progress') {
        const currentStep = getStep(parseInt(id));
        if (currentStep) {
          const files = extractFilePaths(currentStep.description || '');
          const lockResult = acquireLocks(parseInt(id), files);
          if (!lockResult.success) {
            // Set to pending with lock message in context
            step = updateStep(parseInt(id), {
              status: 'pending',
              context: lockResult.message || 'Waiting for file lock',
            });
            return NextResponse.json({
              success: true,
              step,
              blocked: true,
              message: lockResult.message,
            });
          }
        }
      }

      step = updateStep(parseInt(id), { status, assignedTo, result, retryCount });

      // Release locks on completion or failure
      if ((status === 'completed' || status === 'failed') && step) {
        releaseLocks(step.id);
      }

      // Assemble and store context packet when step moves to in_progress
      if (status === 'in_progress' && step) {
        const context = assembleContextPacket(step.id);
        if (context) {
          step = updateStep(step.id, { context });
        }
      }
    }

    if (!step) {
      return NextResponse.json({ error: 'Step not found' }, { status: 404 });
    }

    const emitStatus = reviewAction === 'approve' ? 'completed' : (reviewAction === 'reject' ? 'pending' : status);
    if (emitStatus) {
      emitEvent(`step_${emitStatus}`, 'system', { stepId: step.id, missionId: step.mission_id });
      appEmitter.emit('step', { id: step.id, missionId: step.mission_id, status: emitStatus, title: step.description });
    }

    return NextResponse.json({ success: true, step });
  } catch (error) {
    console.error('[ops/steps/[id]] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update step' }, { status: 500 });
  }
}
