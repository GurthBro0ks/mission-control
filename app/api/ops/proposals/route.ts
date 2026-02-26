import { NextResponse } from 'next/server';
import { getProposals } from '@/lib/ops';
import { createProposalAndMaybeAutoApprove } from '@/lib/proposal-service';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || undefined;
    const source = searchParams.get('source') || undefined;
    const agent = searchParams.get('agent') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const proposals = getProposals({ status, source, agent, limit, offset });
    return NextResponse.json({ proposals });
  } catch (error) {
    console.error('[ops/proposals] GET error:', error);
    return NextResponse.json({ error: 'Failed to get proposals' }, { status: 500 });
  }
}

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
    console.error('[ops/proposals] POST error:', error);
    return NextResponse.json({ error: 'Failed to create proposal' }, { status: 500 });
  }
}
