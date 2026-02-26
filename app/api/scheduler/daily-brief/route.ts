import { NextResponse } from 'next/server';
import { createProposalAndMaybeAutoApprove } from '@/lib/proposal-service';
import { getProposals } from '@/lib/ops';

const SCHEDULER_SECRET = process.env.SCHEDULER_SECRET || 'slimyai-mc-2026';

export async function POST(request: Request) {
  try {
    // Verify secret token
    const secret = request.headers.get('X-Scheduler-Secret');
    if (secret !== SCHEDULER_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Generate today's date
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
    const title = `Daily Market Brief - ${dateStr}`;

    // Check for existing proposal (idempotency)
    const existingProposals = getProposals({ source: 'scheduler' });
    const alreadyExists = existingProposals.some(p => p.title === title);

    if (alreadyExists) {
      return NextResponse.json({
        status: 'skipped',
        reason: 'Already exists',
        title,
      });
    }

    // Create the proposal
    const result = await createProposalAndMaybeAutoApprove({
      title,
      description: `Scan markets, identify trends, and generate \`/reports/market-brief-${dateStr}.md\`.`,
      source: 'scheduler',
      agent: 'Pip',
      priority: 'high',
    });

    return NextResponse.json({
      status: 'created',
      proposal_id: result.proposal_id,
      mission_id: result.mission_id,
      title,
    });
  } catch (error) {
    console.error('[scheduler/daily-brief] Error:', error);
    return NextResponse.json({ error: 'Failed to create daily brief' }, { status: 500 });
  }
}

export async function GET() {
  // Return info about the scheduler endpoint
  return NextResponse.json({
    endpoint: '/api/scheduler/daily-brief',
    method: 'POST',
    description: 'Creates a daily market brief proposal for Pip',
    header: 'X-Scheduler-Secret',
  });
}
