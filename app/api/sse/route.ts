import { NextResponse } from 'next/server';
import { sseClients, broadcastSSE } from './broadcast';
import { appEmitter } from '@/lib/events';

export { broadcastSSE };

// Bug 2 fix: Capture controller and keepAlive in outer scope for cancel() access
let ctrl: ReadableStreamDefaultController | undefined;
let keepAlive: ReturnType<typeof setInterval> | undefined;

export async function GET() {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      ctrl = controller;
      sseClients.add(controller);
      console.log('[SSE] Client connected. Total:', sseClients.size);

      // Send initial connection
      controller.enqueue(encoder.encode('data: {"type":"connected","status":"ok"}\n\n'));

      // Keep-alive ping every 15 seconds
      keepAlive = setInterval(() => {
        try {
          if (ctrl) {
            ctrl.enqueue(encoder.encode('data: {"type":"ping"}\n\n'));
          }
        } catch {
          if (keepAlive) clearInterval(keepAlive);
          if (ctrl) sseClients.delete(ctrl);
          console.log('[SSE] Client disconnected. Total:', sseClients.size);
        }
      }, 15000);
    },
    cancel() {
      // Bug 2 fix: Now properly accessible from outer scope
      if (keepAlive) clearInterval(keepAlive);
      if (ctrl) sseClients.delete(ctrl);
      console.log('[SSE] Client disconnected (cancel). Total:', sseClients.size);
    }
  });

  return new NextResponse(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}

// Bug 1 fix: Register listeners for all event types emitted by routes
// This bridges appEmitter events to SSE broadcast
appEmitter.on('task_update', (data) => {
  broadcastSSE({ type: 'task_update', data });
});

appEmitter.on('message', (data) => {
  broadcastSSE({ type: 'new_message', data });
});

appEmitter.on('calendar_update', (data) => {
  broadcastSSE({ type: 'calendar_update', data });
});

appEmitter.on('agent_update', (data) => {
  broadcastSSE({ type: 'agent_update', data });
});

appEmitter.on('bulletin_update', (data) => {
  broadcastSSE({ type: 'bulletin_update', data });
});

appEmitter.on('proposal', (data) => {
  broadcastSSE({ type: 'proposal', data });
});

appEmitter.on('mission', (data) => {
  broadcastSSE({ type: 'mission', data });
});

appEmitter.on('step', (data) => {
  broadcastSSE({ type: 'step', data });
});
