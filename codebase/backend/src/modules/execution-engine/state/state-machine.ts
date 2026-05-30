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
  // FAILED 는 일반 경로에서 종착 상태다. 유일한 예외인 FAILED → RUNNING
  // (execution.retry_last_turn 재진입) 은 ALLOWED_TRANSITIONS 에 넣지 않고
  // `allowRetryReentry` opt-in 으로만 허용한다 (W5 하드닝) — 아래 canTransition 참조.
  [ExecutionStatus.FAILED]: [],
  [ExecutionStatus.CANCELLED]: [],
};

/**
 * 전이 허용 옵션 — 일반 ALLOWED_TRANSITIONS 표 밖의 컨텍스트 한정 전이를 명시적
 * opt-in 으로만 허용한다.
 */
export interface TransitionOptions {
  /**
   * spec/5-system/6-websocket-protocol.md §4.2 / 4-execution-engine.md §1.3 —
   * `execution.retry_last_turn` 재진입 전용. retryable error 로 FAILED 가 된
   * Execution 을, spawn 된 새 NodeExecution turn 구동(WS node.started/completed
   * 발행)을 위해 RUNNING 으로 전이시킨다. 이 전이는 retry 재진입 경로
   * (`applyRetryLastTurn` → `finalizeAiNode`) 에서만 켜져야 하며, 일반
   * updateExecutionStatus 호출은 FAILED Execution 을 RUNNING 으로 되돌릴 수 없다
   * (방어적 — 실패 종결된 실행의 우발적 부활 차단).
   */
  allowRetryReentry?: boolean;
}

/**
 * Check whether a state transition is allowed.
 */
export function canTransition(
  from: string,
  to: string,
  opts?: TransitionOptions,
): boolean {
  // retry 재진입 전용 FAILED → RUNNING — 표 밖 전이를 opt-in 으로만 허용.
  // from/to 는 string 파라미터이므로 enum 멤버를 string 으로 비교한다
  // (@typescript-eslint/no-unsafe-enum-comparison).
  if (
    opts?.allowRetryReentry &&
    from === (ExecutionStatus.FAILED as string) &&
    to === (ExecutionStatus.RUNNING as string)
  ) {
    return true;
  }
  const allowed = ALLOWED_TRANSITIONS[from];
  if (!allowed) return false;
  return allowed.includes(to);
}

/**
 * Assert that a state transition is valid, throwing if not.
 *
 * @param from - Current execution status string.
 * @param to   - Target execution status string.
 * @param opts - TransitionOptions forwarded to canTransition. Allows opt-in
 *               transitions outside the standard ALLOWED_TRANSITIONS table
 *               (예: `allowRetryReentry` for FAILED → RUNNING retry re-entry).
 */
export function assertTransition(
  from: string,
  to: string,
  opts?: TransitionOptions,
): void {
  if (!canTransition(from, to, opts)) {
    throw new Error(
      `Invalid state transition: cannot transition from "${from}" to "${to}"`,
    );
  }
}
