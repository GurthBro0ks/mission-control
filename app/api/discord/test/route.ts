import { NextResponse } from 'next/server';
import { sendDiscordMessage } from '@/lib/discord';

export async function POST() {
  try {
    await sendDiscordMessage('🟢 Mission Control reporting live!');
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[discord/test] Error:', error);
    return NextResponse.json({ error: 'Failed to send test message' }, { status: 500 });
  }
}
