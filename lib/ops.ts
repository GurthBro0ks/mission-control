import Database from 'better-sqlite3';
import { mkdirSync } from 'fs';
import { processReactions } from './reaction-engine';

// Support different databases for different floors via environment variable
const CLAWD_NAME = process.env.CLAWD_NAME || 'ned-clawd';
const DB_DIR = `/home/slimy/${CLAWD_NAME}/ops`;
const DB_PATH = `${DB_DIR}/ops.db`;

// Ensure directory exists before opening
mkdirSync(DB_DIR, { recursive: true });

// Initialize database
const db = new Database(DB_PATH);

// Enable WAL mode
db.pragma('journal_mode = WAL');
db.pragma('busy_timeout = 5000');
db.pragma('synchronous = NORMAL');
db.pragma('cache_size = -8000');
db.pragma('foreign_keys = ON');

// ============================================
// Database Migration - Add Review Columns
// ============================================

try {
  db.exec(`
    ALTER TABLE ops_steps ADD COLUMN review_status TEXT DEFAULT NULL;
    ALTER TABLE ops_steps ADD COLUMN reviewed_by TEXT DEFAULT NULL;
    ALTER TABLE ops_steps ADD COLUMN review_notes TEXT DEFAULT NULL;
  `);
} catch (e: unknown) {
  // Column may already exist, ignore error
  const err = e as Error;
  if (!err.message.includes('duplicate column')) {
    console.log('Migration note:', err.message);
  }
}

// Migration - Add context column for context packets
try {
  db.exec(`ALTER TABLE ops_steps ADD COLUMN context TEXT DEFAULT NULL;`);
} catch (e: unknown) {
  const err = e as Error;
  if (!err.message.includes('duplicate column')) {
    console.log('Migration note:', err.message);
  }
}

// Migration - Add locked_files column for file locking
try {
  db.exec(`ALTER TABLE ops_steps ADD COLUMN locked_files TEXT DEFAULT '[]';`);
} catch (e: unknown) {
  const err = e as Error;
  if (!err.message.includes('duplicate column')) {
    console.log('Migration note:', err.message);
  }
}

// ============================================
// Types
// ============================================

export interface Proposal {
  id: number;
  title: string;
  description: string | null;
  source: string;
  agent: string | null;
  priority: number;
  status: string;
  rejection_reason: string | null;
  policy_check: string | null;
  created_at: string;
  decided_at: string | null;
  mission_id: number | null;
}

export interface Mission {
  id: number;
  proposal_id: number | null;
  title: string;
  status: string;
  assigned_to: string | null;
  delegated_to: string | null;
  priority: number;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
  result: string | null;
}

export interface Step {
  id: number;
  mission_id: number;
  step_order: number;
  kind: string;
  description: string | null;
  status: string;
  assigned_to: string | null;
  started_at: string | null;
  completed_at: string | null;
  result: string | null;
  retry_count: number;
  max_retries: number;
  depends_on: string | null;
  review_status: string | null;
  reviewed_by: string | null;
  review_notes: string | null;
  context: string | null;
  locked_files: string;
}

export interface Policy {
  id: number;
  key: string;
  value: string;
  description: string | null;
  updated_at: string;
}

export interface OpsEvent {
  id: number;
  type: string;
  source: string | null;
  data: string | null;
  created_at: string;
}

export interface Trigger {
  id: number;
  name: string;
  condition_type: string;
  config: string | null;
  cooldown_minutes: number;
  last_fired_at: string | null;
  enabled: number;
}

export interface Reaction {
  id: number;
  source_event: string;
  target_agent: string;
  reaction_type: string;
  probability: number;
  cooldown_minutes: number;
  last_fired_at: string | null;
  enabled: number;
}

// ============================================
// Generic Query Helper
// ============================================

export function queryOps<T>(sql: string, params: unknown[] = []): T[] {
  const stmt = db.prepare(sql);
  return stmt.all(...params) as T[];
}

export function queryOpsOne<T>(sql: string, params: unknown[] = []): T | undefined {
  const stmt = db.prepare(sql);
  return stmt.get(...params) as T | undefined;
}

export function runOps(sql: string, params: unknown[] = []): { changes: number; lastInsertRowid: number } {
  const stmt = db.prepare(sql);
  const result = stmt.run(...params);
  return { changes: result.changes, lastInsertRowid: Number(result.lastInsertRowid) };
}

// ============================================
// Proposals
// ============================================

export interface CreateProposalData {
  title: string;
  description?: string;
  source: string;
  agent?: string;
  priority?: number;
}

export function createProposal(data: CreateProposalData): Proposal {
  const stmt = db.prepare(`
    INSERT INTO ops_proposals (title, description, source, agent, priority, status)
    VALUES (?, ?, ?, ?, ?, 'pending')
  `);
  const result = stmt.run(
    data.title,
    data.description || null,
    data.source,
    data.agent || null,
    data.priority || 0
  );
  return getProposal(result.lastInsertRowid as number)!;
}

export function getProposal(id: number): Proposal | undefined {
  return queryOpsOne<Proposal>('SELECT * FROM ops_proposals WHERE id = ?', [id]);
}

export interface ProposalFilters {
  status?: string;
  source?: string;
  agent?: string;
  limit?: number;
  offset?: number;
}

export function getProposals(filters: ProposalFilters = {}): Proposal[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.source) {
    conditions.push('source = ?');
    params.push(filters.source);
  }
  if (filters.agent) {
    conditions.push('agent = ?');
    params.push(filters.agent);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  return queryOps<Proposal>(
    `SELECT * FROM ops_proposals ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export function updateProposalStatus(
  id: number,
  status: 'approved' | 'rejected' | 'pending',
  rejectionReason?: string,
  missionId?: number
): Proposal | undefined {
  const decidedAt = status !== 'pending' ? new Date().toISOString() : null;

  // Build update query dynamically to include mission_id if provided
  if (missionId !== undefined) {
    const stmt = db.prepare(`
      UPDATE ops_proposals
      SET status = ?, rejection_reason = ?, decided_at = ?, mission_id = ?
      WHERE id = ?
    `);
    stmt.run(status, rejectionReason || null, decidedAt, missionId, id);
  } else {
    const stmt = db.prepare(`
      UPDATE ops_proposals
      SET status = ?, rejection_reason = ?, decided_at = ?
      WHERE id = ?
    `);
    stmt.run(status, rejectionReason || null, decidedAt, id);
  }

  return getProposal(id);
}

export function deleteProposal(id: number): boolean {
  const stmt = db.prepare('DELETE FROM ops_proposals WHERE id = ?');
  const result = stmt.run(id);
  return result.changes > 0;
}

// ============================================
// Missions
// ============================================

export interface CreateMissionData {
  proposalId?: number;
  title: string;
  assignedTo?: string;
  delegatedTo?: string;
  priority?: number;
  steps?: Array<{
    kind: string;
    description?: string;
    assignedTo?: string;
  }>;
}

export function createMission(data: CreateMissionData): Mission {
  const transaction = db.transaction(() => {
    // Insert mission
    const missionStmt = db.prepare(`
      INSERT INTO ops_missions (proposal_id, title, status, assigned_to, delegated_to, priority)
      VALUES (?, ?, 'pending', ?, ?, ?)
    `);
    const missionResult = missionStmt.run(
      data.proposalId || null,
      data.title,
      data.assignedTo || null,
      data.delegatedTo || null,
      data.priority || 0
    );
    const missionId = missionResult.lastInsertRowid as number;

    // Check if mission is complex (needs deliberation step)
    const titleKeywords = ['build', 'create', 'architect', 'implement'];
    const isComplex = (data.steps && data.steps.length > 2) ||
                     (data.title && titleKeywords.some(kw => data.title.toLowerCase().includes(kw)));

    // Insert deliberation step first if complex
    let deliberationStepId: number | null = null;
    if (isComplex) {
      const deliberationStmt = db.prepare(`
        INSERT INTO ops_steps (mission_id, step_order, kind, description, status, assigned_to)
        VALUES (?, 0, 'deliberation', 'Board Meeting: Define architecture & constraints', 'pending', NULL)
      `);
      const deliberationResult = deliberationStmt.run(missionId);
      deliberationStepId = deliberationResult.lastInsertRowid as number;
    }

    // Insert steps if provided
    if (data.steps && data.steps.length > 0) {
      const stepStmt = db.prepare(`
        INSERT INTO ops_steps (mission_id, step_order, kind, description, status, assigned_to, depends_on)
        VALUES (?, ?, ?, ?, 'pending', ?, ?)
      `);

      // Track step IDs by kind for dependency resolution
      const stepIdsByKind: Record<string, number> = {};
      const previousStepId: { value: number | null } = { value: null };

      data.steps.forEach((step, index) => {
        // Determine dependencies based on step kind
        let dependsOn: string | null = '';

        if (deliberationStepId) {
          // Complex missions: all depend on deliberation first
          dependsOn = String(deliberationStepId);
        } else {
          // Non-complex missions: use kind-based dependencies
          switch (step.kind) {
            case 'research':
            case 'security_audit':
            case 'repo_setup':
              // Independent steps - no dependencies
              dependsOn = '';
              break;
            case 'schema_design':
              // Depends on research if exists
              dependsOn = stepIdsByKind['research'] ? String(stepIdsByKind['research']) : '';
              break;
            case 'implement':
              // Depends on schema_design OR research
              if (stepIdsByKind['schema_design']) {
                dependsOn = String(stepIdsByKind['schema_design']);
              } else if (stepIdsByKind['research']) {
                dependsOn = String(stepIdsByKind['research']);
              } else {
                dependsOn = previousStepId.value ? String(previousStepId.value) : '';
              }
              break;
            case 'api_test':
            case 'ui_test':
              // Depends on implement
              dependsOn = stepIdsByKind['implement'] ? String(stepIdsByKind['implement']) : (previousStepId.value ? String(previousStepId.value) : '');
              break;
            case 'deploy':
              // Depends on api_test or implement
              if (stepIdsByKind['api_test']) {
                dependsOn = String(stepIdsByKind['api_test']);
              } else if (stepIdsByKind['implement']) {
                dependsOn = String(stepIdsByKind['implement']);
              } else {
                dependsOn = previousStepId.value ? String(previousStepId.value) : '';
              }
              break;
            default:
              // Default: depend on previous step (sequential)
              dependsOn = previousStepId.value ? String(previousStepId.value) : '';
          }
        }

        // Insert step and track its ID
        const result = stepStmt.run(missionId, index + 1, step.kind, step.description || null, step.assignedTo || null, dependsOn);
        const stepId = result.lastInsertRowid as number;

        // Track by kind for future dependencies
        stepIdsByKind[step.kind] = stepId;
        previousStepId.value = stepId;
      });
    }

    // Update proposal to link to mission if provided
    if (data.proposalId) {
      const updateProposal = db.prepare('UPDATE ops_proposals SET mission_id = ? WHERE id = ?');
      updateProposal.run(missionId, data.proposalId);
    }

    return getMission(missionId);
  });

  return transaction() as Mission;
}

export function getMission(id: number): Mission | undefined {
  return queryOpsOne<Mission>('SELECT * FROM ops_missions WHERE id = ?', [id]);
}

export function getMissionWithSteps(id: number): { mission: Mission; steps: Step[] } | undefined {
  const mission = getMission(id);
  if (!mission) return undefined;

  const steps = getSteps({ missionId: id });
  return { mission, steps };
}

export interface MissionFilters {
  status?: string;
  assignedTo?: string;
  delegatedTo?: string;
  limit?: number;
  offset?: number;
}

export function getMissions(filters: MissionFilters = {}): Mission[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }
  if (filters.assignedTo) {
    conditions.push('assigned_to = ?');
    params.push(filters.assignedTo);
  }
  if (filters.delegatedTo) {
    conditions.push('delegated_to = ?');
    params.push(filters.delegatedTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  return queryOps<Mission>(
    `SELECT * FROM ops_missions ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export function updateMissionStatus(
  id: number,
  status: 'pending' | 'in_progress' | 'completed' | 'failed',
  result?: string
): Mission | undefined {
  const now = new Date().toISOString();
  const startedAt = status === 'in_progress' ? `, started_at = '${now}'` : '';
  const completedAt = (status === 'completed' || status === 'failed') ? `, completed_at = '${now}'` : '';

  const stmt = db.prepare(`
    UPDATE ops_missions
    SET status = ?, result = ?${startedAt}${completedAt}
    WHERE id = ?
  `);
  stmt.run(status, result || null, id);

  // Send Discord notification for mission completion (fire-and-forget)
  if (status === 'completed') {
    const mission = getMission(id);
    import('./discord').then(({ sendDiscordMessage }) => {
      sendDiscordMessage(`🚀 Mission Complete: ${mission?.title}`).catch((err) => console.error('[discord] Failed to send notification:', err));
    }).catch((err) => console.error('[discord] Failed to import:', err));
  }

  return getMission(id);
}

// ============================================
// Steps
// ============================================

export interface StepFilters {
  missionId?: number;
  status?: string;
  assignedTo?: string;
  limit?: number;
  offset?: number;
}

export function getSteps(filters: StepFilters = {}): Step[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.missionId) {
    conditions.push('mission_id = ?');
    params.push(filters.missionId);
  }
  if (filters.status) {
    // Support comma-separated statuses (e.g., "pending,in_progress")
    if (filters.status.includes(',')) {
      const statusList = filters.status.split(',').map(s => s.trim());
      const placeholders = statusList.map(() => '?').join(', ');
      conditions.push(`status IN (${placeholders})`);
      params.push(...statusList);
    } else {
      conditions.push('status = ?');
      params.push(filters.status);
    }
  }
  if (filters.assignedTo) {
    conditions.push('assigned_to = ?');
    params.push(filters.assignedTo);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  return queryOps<Step>(
    `SELECT * FROM ops_steps ${where} ORDER BY step_order ASC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

export function getStep(id: number): Step | undefined {
  return queryOpsOne<Step>('SELECT * FROM ops_steps WHERE id = ?', [id]);
}

export interface UpdateStepData {
  status?: string;
  assignedTo?: string;
  result?: string;
  retryCount?: number;
  reviewStatus?: string;
  reviewedBy?: string;
  reviewNotes?: string;
  skipReviewGate?: boolean;
  context?: string;
  lockedFiles?: string;
}

export function updateStep(id: number, data: UpdateStepData): Step | undefined {
  const updates: string[] = [];
  const params: unknown[] = [];

  // Get the current step to check its kind
  const currentStep = getStep(id);
  const requiresReview = currentStep && ['implement', 'deploy', 'refactor'].includes(currentStep.kind) && currentStep.kind !== 'deliberation';

  if (data.status) {
    // For steps that require review, change completed to pending_review
    // Skip this check if skipReviewGate is true (e.g., for explicit approvals)
    let newStatus = data.status;
    if (requiresReview && data.status === 'completed' && !data.skipReviewGate) {
      newStatus = 'pending_review';
    }
    updates.push('status = ?');
    params.push(newStatus);
    if (newStatus === 'in_progress') {
      updates.push(`started_at = '${new Date().toISOString()}'`);
    }
    if (newStatus === 'completed' || newStatus === 'failed') {
      updates.push(`completed_at = '${new Date().toISOString()}'`);
    }
    if (newStatus === 'failed') {
      // Send Discord notification (fire-and-forget)
      const step = getStep(id);
      import('./discord').then(({ sendDiscordMessage }) => {
        sendDiscordMessage(`🔥 Step Failed: ${step?.kind} in Mission #${step?.mission_id}`).catch((err) => console.error('[discord] Failed to send notification:', err));
      }).catch((err) => console.error('[discord] Failed to import:', err));
    }
  }
  if (data.assignedTo !== undefined) {
    updates.push('assigned_to = ?');
    params.push(data.assignedTo);
  }
  if (data.result !== undefined) {
    updates.push('result = ?');
    params.push(data.result);
  }
  if (data.retryCount !== undefined) {
    updates.push('retry_count = ?');
    params.push(data.retryCount);
  }
  if (data.reviewStatus !== undefined) {
    updates.push('review_status = ?');
    params.push(data.reviewStatus);
  }
  if (data.reviewedBy !== undefined) {
    updates.push('reviewed_by = ?');
    params.push(data.reviewedBy);
  }
  if (data.reviewNotes !== undefined) {
    updates.push('review_notes = ?');
    params.push(data.reviewNotes);
  }
  if (data.context !== undefined) {
    updates.push('context = ?');
    params.push(data.context);
  }
  if (data.lockedFiles !== undefined) {
    updates.push('locked_files = ?');
    params.push(data.lockedFiles);
  }

  if (updates.length === 0) return getStep(id);

  params.push(id);
  const stmt = db.prepare(`UPDATE ops_steps SET ${updates.join(', ')} WHERE id = ?`);
  stmt.run(...params);

  return getStep(id);
}

// ============================================
// Events
// ============================================

export function emitEvent(type: string, source?: string, data?: unknown): OpsEvent {
  const dataStr = data ? JSON.stringify(data) : null;

  const stmt = db.prepare(`
    INSERT INTO ops_events (type, source, data)
    VALUES (?, ?, ?)
  `);
  const result = stmt.run(type, source || null, dataStr);

  const event = queryOpsOne<OpsEvent>('SELECT * FROM ops_events WHERE id = ?', [result.lastInsertRowid as number])!;

  // Process reactions asynchronously (fire and forget)
  processReactions(type, data).catch(err => console.error('Reaction processing error:', err));

  return event;
}

export interface EventFilters {
  type?: string;
  source?: string;
  limit?: number;
  offset?: number;
}

export function getEvents(filters: EventFilters = {}): OpsEvent[] {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.type) {
    conditions.push('type = ?');
    params.push(filters.type);
  }
  if (filters.source) {
    conditions.push('source = ?');
    params.push(filters.source);
  }

  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const limit = filters.limit || 100;
  const offset = filters.offset || 0;

  return queryOps<OpsEvent>(
    `SELECT * FROM ops_events ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
}

// ============================================
// Policy
// ============================================

export function checkPolicy(key: string): unknown | undefined {
  const policy = queryOpsOne<Policy>('SELECT value FROM ops_policy WHERE key = ?', [key]);
  if (!policy) return undefined;
  try {
    return JSON.parse(policy.value);
  } catch {
    return policy.value;
  }
}

export function getPolicies(): Policy[] {
  return queryOps<Policy>('SELECT * FROM ops_policy ORDER BY key ASC');
}

export function setPolicy(key: string, value: unknown, description?: string): Policy {
  const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

  const stmt = db.prepare(`
    INSERT INTO ops_policy (key, value, description)
    VALUES (?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')
  `);
  stmt.run(key, valueStr, description || null);

  return queryOpsOne<Policy>('SELECT * FROM ops_policy WHERE key = ?', [key])!;
}

// ============================================
// Triggers
// ============================================

export function getTriggers(enabledOnly = false): Trigger[] {
  const sql = enabledOnly
    ? 'SELECT * FROM ops_triggers WHERE enabled = 1 ORDER BY name ASC'
    : 'SELECT * FROM ops_triggers ORDER BY name ASC';
  return queryOps<Trigger>(sql);
}

export function createTrigger(
  name: string,
  conditionType: string,
  config?: unknown,
  cooldownMinutes = 5
): Trigger {
  const configStr = config ? JSON.stringify(config) : null;

  const stmt = db.prepare(`
    INSERT INTO ops_triggers (name, condition_type, config, cooldown_minutes)
    VALUES (?, ?, ?, ?)
  `);
  const result = stmt.run(name, conditionType, configStr, cooldownMinutes);

  return queryOpsOne<Trigger>('SELECT * FROM ops_triggers WHERE id = ?', [result.lastInsertRowid as number])!;
}

export function updateTriggerLastFired(id: number): void {
  const stmt = db.prepare(`UPDATE ops_triggers SET last_fired_at = datetime('now') WHERE id = ?`);
  stmt.run(id);
}

export function updateTrigger(id: number, updates: Partial<Trigger>): Trigger | null {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) {
    fields.push('name = ?');
    values.push(updates.name);
  }
  if (updates.condition_type !== undefined) {
    fields.push('condition_type = ?');
    values.push(updates.condition_type);
  }
  if (updates.config !== undefined) {
    fields.push('config = ?');
    values.push(updates.config);
  }
  if (updates.cooldown_minutes !== undefined) {
    fields.push('cooldown_minutes = ?');
    values.push(updates.cooldown_minutes);
  }
  if (updates.last_fired_at !== undefined) {
    fields.push('last_fired_at = ?');
    values.push(updates.last_fired_at);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled);
  }

  if (fields.length === 0) {
    return queryOpsOne<Trigger>('SELECT * FROM ops_triggers WHERE id = ?', [id]) ?? null;
  }

  values.push(id);
  const stmt = db.prepare(`UPDATE ops_triggers SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return queryOpsOne<Trigger>('SELECT * FROM ops_triggers WHERE id = ?', [id]) ?? null;
}

// ============================================
// Reactions
// ============================================

export function getReactions(enabledOnly = false): Reaction[] {
  const sql = enabledOnly
    ? 'SELECT * FROM ops_reactions WHERE enabled = 1 ORDER BY source_event ASC'
    : 'SELECT * FROM ops_reactions ORDER BY source_event ASC';
  return queryOps<Reaction>(sql);
}

export function createReaction(
  sourceEvent: string,
  targetAgent: string,
  reactionType: string,
  probability = 1.0,
  cooldownMinutes = 5
): Reaction {
  const stmt = db.prepare(`
    INSERT INTO ops_reactions (source_event, target_agent, reaction_type, probability, cooldown_minutes)
    VALUES (?, ?, ?, ?, ?)
  `);
  const result = stmt.run(sourceEvent, targetAgent, reactionType, probability, cooldownMinutes);

  return queryOpsOne<Reaction>('SELECT * FROM ops_reactions WHERE id = ?', [result.lastInsertRowid as number])!;
}

export function updateReaction(id: number, updates: Partial<Reaction>): Reaction | null {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.source_event !== undefined) {
    fields.push('source_event = ?');
    values.push(updates.source_event);
  }
  if (updates.target_agent !== undefined) {
    fields.push('target_agent = ?');
    values.push(updates.target_agent);
  }
  if (updates.reaction_type !== undefined) {
    fields.push('reaction_type = ?');
    values.push(updates.reaction_type);
  }
  if (updates.probability !== undefined) {
    fields.push('probability = ?');
    values.push(updates.probability);
  }
  if (updates.cooldown_minutes !== undefined) {
    fields.push('cooldown_minutes = ?');
    values.push(updates.cooldown_minutes);
  }
  if (updates.last_fired_at !== undefined) {
    fields.push('last_fired_at = ?');
    values.push(updates.last_fired_at);
  }
  if (updates.enabled !== undefined) {
    fields.push('enabled = ?');
    values.push(updates.enabled);
  }

  if (fields.length === 0) {
    return queryOpsOne<Reaction>('SELECT * FROM ops_reactions WHERE id = ?', [id]) ?? null;
  }

  values.push(id);
  const stmt = db.prepare(`UPDATE ops_reactions SET ${fields.join(', ')} WHERE id = ?`);
  stmt.run(...values);

  return queryOpsOne<Reaction>('SELECT * FROM ops_reactions WHERE id = ?', [id]) ?? null;
}

export default db;
