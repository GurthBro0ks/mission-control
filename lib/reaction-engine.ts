import { queryOps, queryOpsOne } from './ops';

export interface OpsReaction {
  id: number;
  source_event: string;
  target_agent: string;
  reaction_type: string;
  probability: number;
  cooldown_minutes: number;
  last_fired_at: string | null;
  enabled: number;
  created_at: string;
}

interface ProposalPayload {
  title: string;
  source: string;
  agent: string;
  description?: string;
  priority?: string;
  steps?: Array<{
    kind: string;
    description: string;
    assigned_to: string;
  }>;
}

/**
 * Process reactions for a given event type
 * Queries ops_reactions where source_event = eventType AND enabled = 1
 * For each matching reaction:
 * - Check cooldown (last_fired_at + cooldown_minutes < now)
 * - Roll dice: Math.random() < probability
 * - If hit: create proposal and update last_fired_at
 *
 * @param eventType - The type of event that triggered this processing
 * @param eventData - The data associated with the event
 * @param depth - Current recursion depth (default 0), used to prevent infinite loops
 */
export async function processReactions(eventType: string, eventData: Record<string, unknown>, depth: number = 0): Promise<void> {
  // Prevent infinite loops - max depth of 2
  if (depth >= 2) {
    console.log(`Reaction depth limit reached (${depth}), skipping`);
    return;
  }

  // Skip if source starts with 'reaction:' to prevent reaction loops
  if (typeof eventData?.source === 'string' && eventData.source.startsWith('reaction:')) {
    console.log(`Skipping reaction for event from reaction source: ${eventType}`);
    return;
  }

  // Query reactions for this event type that are enabled
  const reactions = queryOps<OpsReaction>(
    'SELECT * FROM ops_reactions WHERE source_event = ? AND enabled = 1',
    [eventType]
  );

  if (reactions.length === 0) {
    return;
  }

  const now = new Date();

  for (const reaction of reactions) {
    // Check cooldown
    if (reaction.last_fired_at) {
      const lastFired = new Date(reaction.last_fired_at);
      const cooldownMs = reaction.cooldown_minutes * 60 * 1000;
      if (now.getTime() - lastFired.getTime() < cooldownMs) {
        console.log(`Reaction ${reaction.reaction_type} for ${eventType} still in cooldown`);
        continue;
      }
    }

    // Roll dice
    if (Math.random() >= reaction.probability) {
      console.log(`Reaction ${reaction.reaction_type} for ${eventType} did not trigger (probability: ${reaction.probability})`);
      continue;
    }

    // Create proposal
    const proposal: ProposalPayload = {
      title: `Reaction: ${reaction.reaction_type} for ${eventType}`,
      source: `reaction:${reaction.target_agent}`,
      agent: reaction.target_agent,
      description: `Automated reaction to event: ${eventType}`,
      priority: 'medium',
      steps: [
        {
          kind: reaction.reaction_type,
          description: `Execute ${reaction.reaction_type} reaction`,
          assigned_to: reaction.target_agent
        }
      ]
    };

    try {
      const response = await fetch('http://localhost:3838/mission-control/api/proposals/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(proposal),
        signal: AbortSignal.timeout(10000)
      });

      if (response.ok) {
        console.log(`Reaction ${reaction.reaction_type} fired for ${eventType}`);

        // Update reaction last_fired_at
        queryOps(
          'UPDATE ops_reactions SET last_fired_at = ? WHERE id = ?',
          [now.toISOString(), reaction.id]
        );
      }
    } catch (error) {
      console.error(`Failed to process reaction ${reaction.reaction_type}:`, error);
    }
  }
}
