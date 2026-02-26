import { NextResponse } from 'next/server';
import { getReactions, createReaction } from '@/lib/ops';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const sourceEvent = searchParams.get('source_event') || undefined;
    const enabledOnly = searchParams.get('enabled') === 'true';

    let reactions = getReactions(enabledOnly);

    if (sourceEvent) {
      reactions = reactions.filter(r => r.source_event === sourceEvent);
    }

    return NextResponse.json(reactions);
  } catch (error) {
    console.error('[ops/reactions] GET error:', error);
    return NextResponse.json({ error: 'Failed to get reactions' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { source_event, target_agent, reaction_type, probability, cooldown_minutes, enabled } = body;

    if (!source_event || !target_agent || !reaction_type) {
      return NextResponse.json({ error: 'Missing required fields: source_event, target_agent, reaction_type' }, { status: 400 });
    }

    const reaction = createReaction(
      source_event,
      target_agent,
      reaction_type,
      probability ?? 1.0,
      cooldown_minutes ?? 5
    );

    return NextResponse.json(reaction, { status: 201 });
  } catch (error) {
    console.error('[ops/reactions] POST error:', error);
    return NextResponse.json({ error: 'Failed to create reaction' }, { status: 500 });
  }
}
