import { EventEmitter } from 'events';

// Use global to ensure singleton across Next.js hot reloads and route handlers
declare global {
   
  var __appEmitter: EventEmitter | undefined;
}

// Shared event emitter for SSE and webhooks - true singleton
export const appEmitter = global.__appEmitter || new EventEmitter();

if (!global.__appEmitter) {
  global.__appEmitter = appEmitter;
}
