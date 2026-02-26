import { NextResponse } from 'next/server';
import { createProposalAndMaybeAutoApprove } from '@/lib/proposal-service';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { title, description, source, agent, priority, steps, requiresHumanApproval } = body;

    if (!title || !source) {
      return NextResponse.json({ error: 'Missing required fields: title, source' }, { status: 400 });
    }

    const result = await createProposalAndMaybeAutoApprove({
      title,
      description,
      source,
      agent,
      priority,
      steps,
      requiresHumanApproval,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('[proposals/submit] POST error:', error);
    return NextResponse.json({ error: 'Failed to submit proposal' }, { status: 500 });
  }
}
