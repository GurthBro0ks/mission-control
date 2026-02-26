import { NextResponse } from 'next/server';
import { updateReaction } from '@/lib/ops';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const reactionId = parseInt(id);
    if (isNaN(reactionId)) {
      return NextResponse.json({ error: 'Invalid reaction ID' }, { status: 400 });
    }

    const body = await request.json();
    const reaction = updateReaction(reactionId, body);

    if (!reaction) {
      return NextResponse.json({ error: 'Reaction not found' }, { status: 404 });
    }

    return NextResponse.json(reaction);
  } catch (error) {
    console.error('[ops/reactions/[id]] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update reaction' }, { status: 500 });
  }
}
