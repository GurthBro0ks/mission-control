import { NextResponse } from 'next/server';
import { getSteps } from '@/lib/ops';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const missionId = searchParams.get('mission_id') ? parseInt(searchParams.get('mission_id')!) : undefined;
    const status = searchParams.get('status') || undefined;
    const assignedTo = searchParams.get('assigned_to') || undefined;
    const limit = parseInt(searchParams.get('limit') || '100');
    const offset = parseInt(searchParams.get('offset') || '0');

    const steps = getSteps({ missionId, status, assignedTo, limit, offset });
    return NextResponse.json({ steps });
  } catch (error) {
    console.error('[ops/steps] GET error:', error);
    return NextResponse.json({ error: 'Failed to get steps' }, { status: 500 });
  }
}
