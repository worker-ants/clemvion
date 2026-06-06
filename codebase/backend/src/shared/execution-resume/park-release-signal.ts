/**
 * 중첩 sub-workflow(`executeInline`) 안의 blocking 노드가 **release park**(코루틴
 * 해제) 할 때 deep call stack 을 unwind 하기 위해 던지는 sentinel.
 *
 * top-level park 은 `waitForX` 가 `PARK_RELEASED` 심볼을 **반환**하고 호출 루프
 * (`runExecution` / `runNodeDispatchLoop`)가 그 반환값으로 세그먼트를 종료한다.
 * 그러나 중첩 park 은 `executeInline` → `WorkflowHandler.execute` →
 * `executeNode` 의 여러 계층을 거쳐 올라와야 하는데, 그 사이 `WorkflowHandler` 가
 * 반환하는 `NodeHandlerOutput` 으로는 심볼을 표현할 수 없다. 따라서 중첩 park 은
 * 본 sentinel 을 **throw** 해 `ExecutionCancelledError` 와 동일한 전파 패턴으로
 * unwind 한다 — 각 계층의 catch 는 이 타입을 error-port 라우팅/error-policy 대상이
 * 아닌 **park 신호**로 식별해 re-throw 하고, 최상위(`runExecution` /
 * `runNodeDispatchLoop`)가 받아 세그먼트를 깨끗이 종료한다(Execution 은 이미
 * `waitForX` 가 WAITING_FOR_INPUT + `resume_call_stack` durable 영속).
 *
 * spec: 5-system/4-execution-engine.md §4.x(park = 세그먼트 종료) · §7.5(중첩 재개)
 * · §Rationale(exec-park D6). plan: exec-park-durable-resume.md §PR-B2 구현 설계 8.
 */
export class ParkReleaseSignal extends Error {
  constructor() {
    super('Nested sub-workflow blocking node parked (durable release)');
    this.name = 'ParkReleaseSignal';
  }
}

/** `unknown` catch 변수를 ParkReleaseSignal 로 좁히는 타입 가드. */
export function isParkReleaseSignal(err: unknown): err is ParkReleaseSignal {
  return err instanceof ParkReleaseSignal;
}
