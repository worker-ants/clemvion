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
  // FAILED 는 일반 경로에서 종착 상태다. 유일한 예외 쌍인 FAILED → RUNNING
  // (execution.retry_last_turn 재진입, turn 즉시 종료) / FAILED → WAITING_FOR_INPUT
  // (execution.retry_last_turn 재진입, turn 계속 — re-park) 은 ALLOWED_TRANSITIONS
  // 에 넣지 않고 `allowRetryReentry` opt-in 으로만 허용한다 (W5 하드닝, 2026-07-30
  // ai-review CRITICAL #1 후속으로 WAITING_FOR_INPUT 대상 추가) — 아래 canTransition
  // 참조.
  [ExecutionStatus.FAILED]: [],
  [ExecutionStatus.CANCELLED]: [],
};

/**
 * 전이 허용 옵션 — 일반 ALLOWED_TRANSITIONS 표 밖의 컨텍스트 한정 전이를 명시적
 * opt-in 으로만 허용한다. 상태 머신(`canTransition`)과 DB 가드(엔진의 짝 전이
 * `FOR UPDATE` 잠금 · else 분기 조건부 UPDATE · `tryLockActiveExecutionAndSaveNodeExec`)
 * 가 이 타입 하나를 함께 받는다. 계층마다 이름이나 구조 타입을 따로 두면 한 계층만
 * 조용히 어긋난다(옛 orchestrator 의 `retryReentry` → `allowRetryReentry` 번역 줄이
 * 무검증으로 남았던 결함, CLE-T-9WG82W).
 */
export interface TransitionOptions {
  /**
   * `execution.retry_last_turn` 재진입 전용. 재시도 가능한 에러로 `failed` 가 된
   * 실행을 재진입 턴 끝에 `running`(턴 종료) 또는 `waiting_for_input`(턴 계속,
   * re-park)으로 옮긴다. 재진입 경로(`applyRetryLastTurn` → `processAiResumeTurn`
   * → `finalizeAiNode` / `reparkAiResumeTurn`)에서만 켠다.
   *
   * 불변식 (CLE-EXEC-STATE §원자성 보장 6):
   * - 상태 머신과 DB 가드에 **함께** 전달해야 한다. DB 가드는
   *   {@link nonTerminalStatuses} 로 「비종결」 목록을 정하므로 opt-in 이면 `failed`
   *   행도 잠금 · 갱신 대상이 된다. 한쪽에만 반영하면 재진입 짝 전이가 늘 0행이다.
   * - opt-in 이어도 `completed` · `cancelled` 는 대상에서 빠진다. 진짜 동시 취소는
   *   계속 막힌다.
   * - 기본(미전달 · `false`)에서는 `failed` 를 되살릴 수 없다. 실패로 끝난 실행이 일반
   *   `updateExecutionStatus` 경로로 우연히 부활하는 것을 막는다.
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
  // retry 재진입 전용 FAILED → RUNNING(turn 즉시 종료) / FAILED → WAITING_FOR_INPUT
  // (turn 계속, re-park) — 표 밖 전이를 opt-in 으로만 허용. from/to 는 string
  // 파라미터이므로 enum 멤버를 string 으로 비교한다
  // (@typescript-eslint/no-unsafe-enum-comparison).
  if (
    opts?.allowRetryReentry &&
    from === (ExecutionStatus.FAILED as string) &&
    (to === (ExecutionStatus.RUNNING as string) ||
      to === (ExecutionStatus.WAITING_FOR_INPUT as string))
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
 *               (예: `allowRetryReentry` for FAILED → RUNNING / FAILED →
 *               WAITING_FOR_INPUT retry re-entry).
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

/**
 * DB 가드가 「아직 살아 있는」 실행으로 보는 상태 목록 — 이 상태 중 하나여야 엔진의
 * 짝 전이 잠금 · 조건부 UPDATE · `tryLockActiveExecutionAndSaveNodeExec` 가 행을
 * 잡는다.
 *
 * 정의: `opts` 아래에서 나가는 전이가 하나라도 허용되는 상태. {@link canTransition}
 * 으로 계산하므로 전이 표와 DB 가드가 같은 진실 소스를 쓴다(CLE-T-9WG82W, 8R CRITICAL
 * 이 둘의 불일치였다). 기본은 `pending` · `running` · `waiting_for_input` 이고 재진입
 * opt-in 이면 `failed` 가 더해진다. 순서는 `ExecutionStatus` 선언 순서다.
 */
export function nonTerminalStatuses(
  opts?: TransitionOptions,
): ExecutionStatus[] {
  const all = Object.values(ExecutionStatus);
  return all.filter((from) => all.some((to) => canTransition(from, to, opts)));
}
