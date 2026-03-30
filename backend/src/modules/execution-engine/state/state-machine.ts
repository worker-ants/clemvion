import { ExecutionStatus } from '../../executions/entities/execution.entity';

/**
 * Valid state transitions for Execution status.
 * Based on spec: §1.1 Execution 상태
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [ExecutionStatus.PENDING]: [ExecutionStatus.RUNNING, ExecutionStatus.CANCELLED],
  [ExecutionStatus.RUNNING]: [
    ExecutionStatus.COMPLETED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.WAITING_FOR_INPUT,
  ],
  [ExecutionStatus.WAITING_FOR_INPUT]: [
    ExecutionStatus.RUNNING,
    ExecutionStatus.CANCELLED,
  ],
  [ExecutionStatus.COMPLETED]: [],
  [ExecutionStatus.FAILED]: [],
  [ExecutionStatus.CANCELLED]: [],
};

/**
 * Check whether a state transition is allowed.
 */
export function canTransition(from: string, to: string): boolean {
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Assert that a state transition is valid, throwing if not.
 */
export function assertTransition(from: string, to: string): void {
  if (!canTransition(from, to)) {
    throw new Error(
      `Invalid state transition: cannot transition from "${from}" to "${to}"`,
    );
  }
}
