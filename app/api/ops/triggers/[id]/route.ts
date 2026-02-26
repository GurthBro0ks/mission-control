import { NextResponse } from 'next/server';
import { updateTrigger } from '@/lib/ops';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const triggerId = parseInt(id);
    if (isNaN(triggerId)) {
      return NextResponse.json({ error: 'Invalid trigger ID' }, { status: 400 });
    }

    const body = await request.json();
    const trigger = updateTrigger(triggerId, body);

    if (!trigger) {
      return NextResponse.json({ error: 'Trigger not found' }, { status: 404 });
    }

    return NextResponse.json(trigger);
  } catch (error) {
    console.error('[ops/triggers/[id]] PATCH error:', error);
    return NextResponse.json({ error: 'Failed to update trigger' }, { status: 500 });
  }
}
