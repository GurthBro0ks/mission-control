import { getStep, updateStep, queryOps, Step } from './ops';

export interface LockResult {
  success: boolean;
  blockedBy?: number;
  message?: string;
}

/**
 * Extract file paths from step description using heuristic regex
 */
export function extractFilePaths(description: string): string[] {
  if (!description) return [];
  const regex = /([\w/.-]+\.(ts|tsx|js|jsx|json|md|sql|sh))/g;
  const matches = description.match(regex);
  return matches ? [...new Set(matches)] : [];
}

/**
 * Acquire locks for a step's files
 * Returns { success: true } if locks acquired, { success: false, blockedBy, message } if blocked
 */
export function acquireLocks(stepId: number, files: string[]): LockResult {
  // If no files to lock, allow through
  if (files.length === 0) {
    return { success: true };
  }

  // Get current step
  const step = getStep(stepId);
  if (!step) {
    return { success: false, message: 'Step not found' };
  }

  // Query all steps with in_progress status (they hold locks)
  const activeSteps = queryOps<Step>(
    "SELECT id, locked_files FROM ops_steps WHERE status = 'in_progress'"
  );

  // Check for conflicts
  for (const activeStep of activeSteps) {
    // Skip the current step
    if (activeStep.id === stepId) continue;

    let lockedFiles: string[] = [];
    try {
      lockedFiles = JSON.parse(activeStep.locked_files || '[]');
    } catch {
      // Invalid JSON, treat as empty
      lockedFiles = [];
    }

    // Check for overlap
    for (const file of files) {
      if (lockedFiles.includes(file)) {
        return {
          success: false,
          blockedBy: activeStep.id,
          message: `Waiting for file lock: ${file}`,
        };
      }
    }
  }

  // No conflicts, acquire locks
  const lockedFilesJson = JSON.stringify(files);
  updateStep(stepId, { lockedFiles: lockedFilesJson });

  return { success: true };
}

/**
 * Release locks for a step (call when step completes/fails)
 */
export function releaseLocks(stepId: number): void {
  updateStep(stepId, { lockedFiles: '[]' });
}

/**
 * Get currently locked files for a step
 */
export function getLockedFiles(stepId: number): string[] {
  const step = getStep(stepId);
  if (!step) return [];

  try {
    return JSON.parse(step.locked_files || '[]');
  } catch {
    return [];
  }
}
