import { NextResponse } from 'next/server';
import { getPolicies, setPolicy, checkPolicy } from '@/lib/ops';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key') || undefined;

    if (key) {
      const value = checkPolicy(key);
      return NextResponse.json({ key, value });
    }

    const policies = getPolicies();
    return NextResponse.json({ policies });
  } catch (error) {
    console.error('[ops/policy] GET error:', error);
    return NextResponse.json({ error: 'Failed to get policy' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { key, value, description } = body;

    if (!key || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields: key, value' }, { status: 400 });
    }

    const policy = setPolicy(key, value, description);
    return NextResponse.json({ success: true, policy });
  } catch (error) {
    console.error('[ops/policy] POST error:', error);
    return NextResponse.json({ error: 'Failed to set policy' }, { status: 500 });
  }
}
