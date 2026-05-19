import { ExecutionStatus } from '../../executions/entities/execution.entity';

/**
 * Valid state transitions for Execution status.
 * Based on spec: §1.1 Execution 상태
 */
const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  [ExecutionStatus.PENDING]: [
    ExecutionStatus.RUNNING,
    ExecutionStatus.CANCELLED,
  ],
  [ExecutionStatus.RUNNING]: [
    ExecutionStatus.COMPLETED,
    ExecutionStatus.FAILED,
    ExecutionStatus.CANCELLED,
    ExecutionStatus.WAITING_FOR_INPUT,
  ],
  [ExecutionStatus.WAITING_FOR_INPUT]: [
    ExecutionStatus.RUNNING,
    ExecutionStatus.CANCELLED,
    // 2026-05-19 — spec/4-nodes/3-ai/1-ai-agent.md §7.9 (Multi Turn 모드 — 오류
    // `error` 포트). AI Agent multi-turn 의 turn 처리가 LLM 429/timeout/
    // connection 으로 throw 한 경우 `handleAiTurnError` → `finalizeAiNode` 가
    // 직접 FAILED 로 마무리한다. 옛 정책은 waiting_for_input 종료를 RUNNING
    // 으로 강제 전이시킨 뒤 다음 노드 실행으로 진행하는 가정이라 본 전이가
    // 누락되어 있었다. spec/5-system/4-execution-engine.md §1.2 상태머신
    // 다이어그램 갱신은 별도 project-planner follow-up.
    ExecutionStatus.FAILED,
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
