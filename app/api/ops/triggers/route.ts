import { NextResponse } from 'next/server';
import { getTriggers, createTrigger, updateTrigger } from '@/lib/ops';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get('name') || undefined;
    const enabledOnly = searchParams.get('enabled') === 'true';

    let triggers = getTriggers(enabledOnly);

    if (name) {
      triggers = triggers.filter(t => t.name === name);
    }

    return NextResponse.json(triggers);
  } catch (error) {
    console.error('[ops/triggers] GET error:', error);
    return NextResponse.json({ error: 'Failed to get triggers' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, condition_type, config, cooldown_minutes, enabled } = body;

    if (!name || !condition_type) {
      return NextResponse.json({ error: 'Missing required fields: name, condition_type' }, { status: 400 });
    }

    const trigger = createTrigger(
      name,
      condition_type,
      config || null,
      cooldown_minutes || 5
    );

    return NextResponse.json(trigger, { status: 201 });
  } catch (error) {
    console.error('[ops/triggers] POST error:', error);
    return NextResponse.json({ error: 'Failed to create trigger' }, { status: 500 });
  }
}
