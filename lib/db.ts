import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';

const DB_DIR = '/home/slimy/ned-clawd/comms';
const DB_PATH = `${DB_DIR}/comms.db`;

// Ensure directory exists before opening
mkdirSync(DB_DIR, { recursive: true });

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -4000');
db.pragma('foreign_keys = ON');

// Create comms table
db.exec(`
  CREATE TABLE IF NOT EXISTS comms (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    from_agent TEXT NOT NULL,
    to_agent TEXT NOT NULL DEFAULT 'all',
    message TEXT NOT NULL,
    timestamp TEXT DEFAULT (datetime('now')),
    channel TEXT DEFAULT 'all',
    type TEXT DEFAULT 'message'
  )
`);

// Migrate existing DB: add channel column if it doesn't exist yet
try {
  db.exec("ALTER TABLE comms ADD COLUMN channel TEXT DEFAULT 'all'");
} catch {
  // Column already exists — safe to ignore
}

// Types
export interface CommsMessage {
  id: number;
  from_agent: string;
  to_agent: string;
  message: string;
  timestamp: string;
  channel: string;
  type: string;
}

// Get messages with optional filtering — ordered oldest first (ASC)
export function getMessages(
  limit = 200,
  offset = 0,
  channel?: string,
  agent?: string
): CommsMessage[] {
  if (channel && channel !== 'all' && agent) {
    const stmt = db.prepare(`
      SELECT * FROM comms
      WHERE channel = ? AND (from_agent = ? OR to_agent = ?)
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(channel, agent, agent, limit, offset) as CommsMessage[];
  }
  if (channel && channel !== 'all') {
    const stmt = db.prepare(`
      SELECT * FROM comms
      WHERE channel = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(channel, limit, offset) as CommsMessage[];
  }
  if (agent) {
    const stmt = db.prepare(`
      SELECT * FROM comms
      WHERE from_agent = ? OR to_agent = ?
      ORDER BY timestamp ASC
      LIMIT ? OFFSET ?
    `);
    return stmt.all(agent, agent, limit, offset) as CommsMessage[];
  }
  const stmt = db.prepare(`
    SELECT * FROM comms
    ORDER BY timestamp ASC
    LIMIT ? OFFSET ?
  `);
  return stmt.all(limit, offset) as CommsMessage[];
}

// Add a message
export function addMessage(
  from: string,
  to: string,
  msg: string,
  channel = 'all',
  type = 'message'
): CommsMessage {
  const stmt = db.prepare(`
    INSERT INTO comms (from_agent, to_agent, message, channel, type)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(from, to, msg, channel, type);

  const getStmt = db.prepare('SELECT * FROM comms WHERE id = ?');
  return getStmt.get(result.lastInsertRowid) as CommsMessage;
}

// Get total message count
export function getMessageCount(): number {
  const stmt = db.prepare('SELECT COUNT(*) as count FROM comms');
  const result = stmt.get() as { count: number };
  return result.count;
}

export default db;
