// Shared SSE broadcaster - works across Next.js route boundaries
// Uses global to persist clients Set

declare global {
  // eslint-disable-next-line no-var
  var __sseClients: Set<ReadableStreamDefaultController> | undefined;
}

// Use global to persist clients across hot reloads
export const sseClients = global.__sseClients || new Set<ReadableStreamDefaultController>();
if (!global.__sseClients) {
  global.__sseClients = sseClients;
}

// Broadcast to all connected SSE clients
export function broadcastSSE(data: any) {
  const message = `data: ${JSON.stringify(data)}\n\n`;
  console.log('[SSE Broadcast]', data.type, 'to', sseClients.size, 'clients');
  sseClients.forEach(controller => {
    try {
      const encoder = new TextEncoder();
      controller.enqueue(encoder.encode(message));
    } catch {
      sseClients.delete(controller);
    }
  });
}
