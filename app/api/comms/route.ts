import { NextResponse } from 'next/server';
import { getMessages, addMessage } from '@/lib/db';
// Direct import of broadcast to bypass Next.js module isolation
import { broadcastSSE } from '@/app/api/sse/broadcast';
import { exec } from 'child_process';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '200');
    const offset = parseInt(searchParams.get('offset') || '0');
    const channel = searchParams.get('channel') || undefined;
    const agent = searchParams.get('agent') || undefined;

    const messages = getMessages(limit, offset, channel, agent);
    return NextResponse.json({ messages });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { from, to, message, channel } = body;

    if (!from || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const newMessage = addMessage(from, to || 'all', message, channel || 'all');

    // Broadcast directly to SSE clients
    broadcastSSE({ type: 'new_message', data: newMessage });

    // If from Gurth, notify Ned
    if (from.toLowerCase() === 'gurth') {
      const fs = await import('fs');
      const directivesDir = '/home/slimy/ned-clawd/directives';
      const latestFile = `${directivesDir}/latest.txt`;

      // Ensure directory exists
      if (!fs.existsSync(directivesDir)) {
        fs.mkdirSync(directivesDir, { recursive: true });
      }

      // Write directive
      const directive = {
        from,
        to: to || 'all',
        message,
        timestamp: new Date().toISOString(),
      };

      fs.writeFileSync(latestFile, JSON.stringify(directive, null, 2));

      // Bug 3 fix: Notify Ned via openclaw CLI (HTTP hooks are broken — Ned not in allowedAgentIds)
      try {
        const notifyMsg = `[Directive from Gurth]: ${message}`.replace(/"/g, '\\"').substring(0, 500);
        exec(
          `openclaw agent --agent ned --message "${notifyMsg}"`,
          { timeout: 30000, cwd: '/home/slimy' },
          (error) => {
            if (error) console.error('[comms] Ned notification failed:', error.message);
          }
        );
      } catch (e) {
        console.error('[comms] Ned notification error:', e);
      }
    }

    return NextResponse.json({ success: true, message: newMessage });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create message' }, { status: 500 });
  }
}
