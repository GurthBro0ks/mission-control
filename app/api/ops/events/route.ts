import { NextResponse } from 'next/server';
import { getEvents, emitEvent } from '@/lib/ops';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || undefined;
    const source = searchParams.get('source') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const events = getEvents({ type, source, limit, offset });
    return NextResponse.json({ events });
  } catch (error) {
    console.error('[ops/events] GET error:', error);
    return NextResponse.json({ error: 'Failed to get events' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { type, source, data } = body;

    if (!type) {
      return NextResponse.json({ error: 'type is required' }, { status: 400 });
    }

    const event = emitEvent(type, source || 'api', data || {});
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error('[ops/events] POST error:', error);
    return NextResponse.json({ error: 'Failed to emit event' }, { status: 500 });
  }
}
