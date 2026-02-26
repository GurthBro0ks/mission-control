import { exec } from 'child_process';
import { promises as fs } from 'fs';
import {
  createProposal,
  getProposal,
  updateProposalStatus,
  createMission,
  getMissions,
  emitEvent,
  checkPolicy,
  queryOps,
} from './ops';
import { appEmitter } from '@/lib/events';

export interface ProposalStep {
  kind: string;
  description: string;
  assigned_to?: string;
}

export interface CreateProposalInput {
  title: string;
  description?: string;
  source: string;
  agent?: string;
  priority?: string;
  steps?: ProposalStep[];
  requiresHumanApproval?: boolean;
}

export interface CreateProposalResult {
  proposal_id: number;
  status: 'approved' | 'rejected' | 'pending_review';
  mission_id?: number;
  rejection_reason?: string;
}

/**
 * Log Ned decisions to file
 */
async function logNedDecision(proposalId: number | undefined, action: string): Promise<void> {
  try {
    const logDir = '/home/slimy/ned-clawd/logs';
    const logFile = `${logDir}/ned-decisions.log`;

    // Ensure directory exists
    await fs.mkdir(logDir, { recursive: true });

    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] [PROPOSAL_ID: ${proposalId || 'N/A'}] - Decision: ${action}\n`;

    // Append to log file
    await fs.appendFile(logFile, logEntry);
  } catch (error) {
    console.error('[proposal-service] Failed to log Ned decision:', error);
  }
}

/**
 * Notify Ned via OpenClaw webhook (non-blocking)
 */
async function notifyNed(type: string, data: Record<string, unknown>): Promise<void> {
  try {
    const hookTokenPath = '/home/slimy/ned-clawd/.hook-token';
    const hookUrl = 'http://127.0.0.1:18789/hooks/agent';

    // Read token from file
    const token = (await fs.readFile(hookTokenPath, 'utf-8')).trim();

    const payload = JSON.stringify({ type, ...data });

    // Log the decision
    const proposalId = data.proposal_id as number | undefined;
    await logNedDecision(proposalId, `Notified Ned: ${type}`);

    // Use curl to POST to the webhook endpoint
    exec(
      `curl -s -X POST "${hookUrl}" -H "Content-Type: application/json" -H "Authorization: Bearer ${token}" -d '${payload.replace(/'/g, "'\\''")}'`,
      { timeout: 15000 },
      (err, stdout, stderr) => {
        if (err) {
          console.error('[proposal-service] Failed to notify Ned:', err.message);
          if (stderr) console.error('[proposal-service] curl stderr:', stderr);
        } else if (stdout) {
          console.log('[proposal-service] Ned notified:', stdout);
        }
      }
    );
  } catch (error) {
    console.error('[proposal-service] Failed to notify Ned:', error);
  }
}

/**
 * Check daily proposal limit from policy
 */
function checkDailyProposalLimit(): boolean {
  const policy = checkPolicy('daily_proposal_limit');
  if (!policy || typeof policy !== 'object') return true;

  const limit = (policy as { limit?: number }).limit;
  if (!limit) return true;

  // Count proposals created today
  const today = new Date().toISOString().split('T')[0];
  const countResult = queryOps<{ count: number }>(
    `SELECT COUNT(*) as count FROM ops_proposals WHERE date(created_at) = ?`,
    [today]
  );

  const count = countResult[0]?.count || 0;
  return count < limit;
}

/**
 * Check max concurrent missions from policy
 */
function checkMaxConcurrentMissions(): boolean {
  const policy = checkPolicy('max_concurrent_missions');
  if (!policy || typeof policy !== 'object') return true;

  const limit = (policy as { limit?: number }).limit;
  if (!limit) return true;

  // Count active missions (not completed or failed)
  const activeMissions = getMissions({ status: 'in_progress' });
  const activeCount = activeMissions.length;

  return activeCount < limit;
}

/**
 * Check if approval requires human review
 */
function requiresHumanReview(
  source: string,
  requiresHumanApproval?: boolean,
  steps?: ProposalStep[]
): boolean {
  // If explicitly requested, require human approval
  if (requiresHumanApproval === true) return true;

  // Check policy for sources/types that require human approval
  const policy = checkPolicy('human_approval_required');
  if (policy && typeof policy === 'object') {
    const types = (policy as { types?: string[] }).types || [];

    // Check if source matches any required types
    for (const type of types) {
      if (source.toLowerCase().includes(type.toLowerCase())) {
        return true;
      }
    }

    // Check if any step kinds match required types
    if (steps) {
      for (const step of steps) {
        for (const type of types) {
          if (step.kind.toLowerCase().includes(type.toLowerCase())) {
            return true;
          }
        }
      }
    }
  }

  return false;
}

/**
 * Main function: create a proposal and maybe auto-approve it
 */
export async function createProposalAndMaybeAutoApprove(
  input: CreateProposalInput
): Promise<CreateProposalResult> {
  const { title, description, source, agent, priority, steps, requiresHumanApproval } = input;

  // Step 1: Check daily proposal limit
  if (!checkDailyProposalLimit()) {
    return {
      proposal_id: 0,
      status: 'rejected',
      rejection_reason: 'Daily proposal limit exceeded',
    };
  }

  // Step 2: Check max concurrent missions
  if (!checkMaxConcurrentMissions()) {
    return {
      proposal_id: 0,
      status: 'rejected',
      rejection_reason: 'Max concurrent missions limit exceeded',
    };
  }

  // Step 3: Insert proposal with pending status
  const priorityNum = priority ? parseInt(priority, 10) : 0;
  const proposal = createProposal({
    title,
    description,
    source,
    agent,
    priority: priorityNum,
  });

  // Step 4: Auto-approve and create mission with steps
  // This is the core fix - create mission WITH STEPS when proposal is created
  const { createMission } = await import('./ops');
  const missionSteps = steps && steps.length > 0 ? steps : [
    { kind: 'research', description: 'Research requirements and context', assigned_to: 'Atlas' },
    { kind: 'implement', description: 'Implement the solution', assigned_to: 'Rex' },
  ];

  const mission = createMission({
    proposalId: proposal.id,
    title: proposal.title,
    assignedTo: agent || undefined,
    delegatedTo: undefined,
    priority: priorityNum,
    steps: missionSteps,
  });

  // Update proposal status to approved with mission_id
  const { updateProposalStatus } = await import('./ops');
  updateProposalStatus(proposal.id, 'approved', undefined, mission.id);

  // Step 5: Emit events
  emitEvent('proposal_created', source, { proposalId: proposal.id, title: proposal.title, missionId: mission.id });
  emitEvent('mission_created', source, { missionId: mission.id, proposalId: proposal.id, title: mission.title });

  // Emit to SSE for toast notifications
  appEmitter.emit('proposal', { id: proposal.id, title: proposal.title, status: 'approved', mission_id: mission.id });
  appEmitter.emit('mission', { id: mission.id, title: mission.title, status: 'started' });

  // Send Discord notification (fire-and-forget)
  const { sendDiscordMessage } = await import('./discord');
  sendDiscordMessage(`📋 New Proposal: ${mission.title}`);

  // Notify Ned about the new mission (optional, for visibility)
  notifyNed('mission_created', {
    mission_id: mission.id,
    proposal_id: proposal.id,
    title: mission.title,
    source,
    step_count: missionSteps.length,
  }).catch((err) => console.error('[proposal-service] Failed to notify Ned:', err));

  return {
    proposal_id: proposal.id,
    status: 'approved',
    mission_id: mission.id,
  };
}
