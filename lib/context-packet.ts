import { readFileSync, existsSync } from 'fs';
import { getStep } from './ops';

const MAX_CONTEXT_LENGTH = 10000;
const REPORTS_DIR = '/home/slimy/ned-clawd/reports';

/**
 * Assembles a context packet for a step, combining:
 * 1. Design doc from deliberation phase (if exists)
 * 2. Previous step output (from depends_on step result)
 */
export function assembleContextPacket(stepId: number): string {
  const step = getStep(stepId);
  if (!step) return '';

  const sections: string[] = [];

  // 1. Read design doc if it exists
  const designDocPath = `${REPORTS_DIR}/design-mission-${step.mission_id}.md`;
  let designContent = 'No design document found.';
  try {
    if (existsSync(designDocPath)) {
      designContent = readFileSync(designDocPath, 'utf-8');
    }
  } catch {
    designContent = 'Error reading design document.';
  }
  sections.push(`## Design Decisions\n${designContent}`);

  // 2. Fetch previous step output from depends_on
  let previousOutput = 'No previous step output.';
  if (step.depends_on) {
    const depIds = step.depends_on.split(',').map(id => parseInt(id.trim(), 10)).filter(id => !isNaN(id));
    const outputs: string[] = [];
    for (const depId of depIds) {
      const depStep = getStep(depId);
      if (depStep?.result) {
        outputs.push(`### Step #${depId} (${depStep.kind})\n${depStep.result}`);
      }
    }
    if (outputs.length > 0) {
      previousOutput = outputs.join('\n\n');
    }
  }
  sections.push(`## Previous Step Output\n${previousOutput}`);

  const combined = sections.join('\n\n');

  // Truncate if too long
  if (combined.length > MAX_CONTEXT_LENGTH) {
    return combined.slice(0, MAX_CONTEXT_LENGTH) + '\n\n[Truncated - exceeded 10,000 character limit]';
  }

  return combined;
}
