import { NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import { getMissionWithSteps, updateStep } from '@/lib/ops';

export async function POST(request: Request) {
  try {
    const { missionId } = await request.json();

    if (!missionId) {
      return NextResponse.json({ error: 'missionId is required' }, { status: 400 });
    }

    // Get mission with steps
    const missionData = getMissionWithSteps(missionId);
    if (!missionData) {
      return NextResponse.json({ error: 'Mission not found' }, { status: 404 });
    }

    // Find the deliberation step
    const deliberationStep = missionData.steps.find(s => s.kind === 'deliberation');
    if (!deliberationStep) {
      return NextResponse.json({ error: 'No deliberation step found for this mission' }, { status: 404 });
    }

    if (deliberationStep.status === 'completed') {
      return NextResponse.json({ error: 'Deliberation already completed' }, { status: 400 });
    }

    // Create design document directory if it doesn't exist
    const reportsDir = '/home/slimy/ned-clawd/reports';
    await fs.mkdir(reportsDir, { recursive: true });

    // Create design document
    const filePath = `${reportsDir}/design-mission-${missionId}.md`;
    const content = `# Design Decision Document - Mission ${missionId}

**Mission:** ${missionData.mission.title}
**Created:** ${new Date().toISOString()}

---

## Architecture Decisions
*(To be filled by the board)*

## Security Constraints
*(To be filled by the board)*

## Database Schema
*(To be filled by the board)*

## Infrastructure Needs
*(To be filled by the board)*

## Action Items
- [ ] Review architecture proposal
- [ ] Approve security constraints
- [ ] Validate schema design
- [ ] Confirm infrastructure requirements
`;

    await fs.writeFile(filePath, content, 'utf-8');

    // Update deliberation step to completed
    updateStep(deliberationStep.id, {
      status: 'completed',
      skipReviewGate: true,
    });

    return NextResponse.json({
      success: true,
      filePath,
      stepId: deliberationStep.id,
    });
  } catch (error) {
    console.error('[deliberate] Error:', error);
    return NextResponse.json({ error: 'Failed to run deliberation' }, { status: 500 });
  }
}
