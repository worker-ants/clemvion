/**
 * Park **return-signal** 1차 — turn 처리기/대기 메서드가 segment 종료를 호출 루프에
 * **반환값**으로 알리는 sentinel + 그 통일 반환 타입.
 *
 * 두 가지 park 전파 채널이 있다 (혼동 주의):
 * - **return 기반** (이 파일): top-level park 은 `waitForX` / `processAiResumeTurn` 이
 *   `PARK_RELEASED` 심볼을 **반환**하고, caller(`runExecution` 메인 루프 /
 *   `runNodeDispatchLoop` / `driveResumeAwaited` / `driveResumeFrame`)가 그 값으로
 *   세그먼트를 즉시 종료(코루틴 unwind)한다. 재개는 §7.5 rehydration(slow-path) 단일
 *   경로로 일원화 — in-process resolver 미등록.
 * - **throw 기반** ([`./park-release-signal`](./park-release-signal) 의 `ParkReleaseSignal`):
 *   중첩 sub-workflow(`executeInline`) blocking 노드는 여러 핸들러 계층을 거쳐
 *   올라와야 하는데 `NodeHandlerOutput` 으로 심볼을 표현할 수 없어 sentinel 을
 *   **throw** 해 unwind 한다.
 *
 * `parkMode='await'`(입력 전달 재진입) 호출은 `PARK_RELEASED` 를 반환하지 않고 입력을
 * 처리한 뒤 `void` 를 반환한다.
 *
 * spec: 5-system/4-execution-engine.md §4.x("park = 세그먼트 종료") · §7.5(rehydration)
 * · §Rationale(단계적 롤아웃 / exec-park D4·B3).
 */
export const PARK_RELEASED = Symbol('park_released');

/** `waitForX` / `processX` 가 fresh top-level park 시 반환하는 sentinel 의 타입. */
export type ParkSignal = typeof PARK_RELEASED;

/**
 * park 신호를 반환할 수 있는 처리기/대기 메서드의 통일 반환 타입.
 * `void` = 정상 진행(종료/완료) · `ParkSignal`(`PARK_RELEASED`) = park 로 세그먼트 종료.
 * `waitForFormSubmission`/`waitForButtonInteraction`/`waitForAiConversation`(park-only)
 * 와 `processAiResumeTurn`(turn 처리 후 계속 시 re-park) 이 사용한다. (ai-review W11 —
 * 인라인 `void | ParkSignal` 혼용을 named alias 로 통일해 처리기 추가 시 계약을 명시.)
 */
export type ProcessTurnResult = void | ParkSignal;
