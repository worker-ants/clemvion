# 보안(Security) Review — linear-cancel-mechanism (4R, W15/W16 재검증 + ExecutionCancelledError message 노출 경로 전수 확인)

대상: 직전 라운드(`review/code/2026/07/26/13_47_42/security.md`)가 낸 WARNING 2건
(W15: `executeNode` generic catch 의 취소 오분류, W16: `RetryTurnService.failRetryExecution`
의 `execution.error` 무조건 저장)의 해소 여부 검증 + `ExecutionCancelledError` message
(executionId 포함)가 client(WS/REST)에 도달하는 잔존 경로 전수 재확인.

이번 라운드의 diff 파일 목록 자체는 `review/code/2026/07/26/13_47_42/*.md`(직전 라운드 리뷰
산출물이 커밋된 것)뿐이라, 검증은 프롬프트 diff 가 아니라 실제 소스(`Read`/`Bash grep`)를
직접 열어 수행했다.

## (a) W15 재검증 — 해소 확인

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `executeNode`
catch 블록을 직접 열어 확인:

- `isAbortError(err)` 분기(5765-5793) → `err instanceof ParkReleaseSignal` 분기(5801-5803)
  다음에, **`if (err instanceof ExecutionCancelledError) { throw err; }`가 5812-5814 에
  배치**돼 있다.
- 이 재throw 는 errorPolicy 적용 코드(`getErrorPolicyConfig`/`errorPolicyHandler.handleError`,
  5817-5822)보다, 그리고 `NodeExecution.status = FAILED` 마킹·`nodeExecutionRepository.save`
  (5891-5899)·`NODE_FAILED` WS emit(5900-5915)보다 **앞서** 실행된다. `ParkReleaseSignal` 과
  대칭인 구조로, 취소는 FAILED 마킹/이벤트 방출에 도달하지 못한다.
- 주석(5805-5811)도 "W15(2026-07-26) — W9(runContainer)와 동형 결함... ParkReleaseSignal 과
  대칭으로 FAILED 마킹/NODE_FAILED emit 이전에 우회 재throw 한다"고 정확히 서술한다.
- 회귀 테스트 확인: `execution-engine.service.spec.ts:5745` (`Sub-Workflow(workflow) 노드에서
  ExecutionCancelledError 가 발생하면 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다
  (W15)`) — 직전 라운드가 지적했던 테스트 갭("실제 그래프에서 workflow 타입 노드를 통해
  dispatch 했을 때 `executeNode` 가 그 노드를 어떻게 마감하는지 단언하는 테스트가 없다")이
  이번에 정확히 메워졌다. 이 테스트는 mock handler 단독 실행이 아니라 `service.execute(...)`
  로 실제 그래프 dispatch 를 통과시키고(`mockNodeRepo.findBy` 로 `type: 'workflow'` 노드를
  등록), handler 자신이 `ExecutionCancelledError` 를 throw 하도록 해 `executeNode` catch
  경로를 실제로 관통시킨다 — `ne?.status).not.toBe(FAILED)`, `emitNodeEvent` 로
  `execution.node.failed` 미호출을 직접 단언. **W15 완전 해소 확인.**

## (b) W16 재검증 — 해소 확인

`codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `failRetryExecution`
(636-669행)을 직접 열어 확인:

- `const isCancelled = error instanceof ExecutionCancelledError;`(642)를 상단에서 한 번만
  평가.
- `if (!isCancelled) { execution.error = { message: errMessage }; }`(652-654) — 취소일
  때는 `execution.error` 대입 자체가 스킵된다(기존에는 무조건 대입).
- WS emit(659-668)은 기존과 동일하게 `!isCancelled` 조건으로 `error` 필드를 payload 에서
  제외.
- 주석(647-651)이 "취소 시 execution.error 를 DB 에 저장하지 않는다... REST
  `GET /executions/:id` 로 내부 message 가 노출되고 `finalizeCancelledExecution` 과도
  불일치했다"고 정확히 배경을 설명.
- 회귀 테스트 확인: `retry-turn.service.spec.ts:476-519` — 취소 케이스는
  `expect(execution.error).toBeUndefined()`(500)로 DB 저장 필드 자체를 직접 단언(직전
  라운드가 지적한 "이벤트 payload만 단언하고 `execution.error` 는 검증 안 됨" 갭이 메워짐),
  대조군(일반 실패)은 `expect(execution.error).toEqual({ message: 'boom' })`(519)로 양쪽을
  대칭 검증.
- REST 노출 경로 확인: `executions.service.ts:840` `toExecutionDto` 의
  `error: execution.error ?? null` — 취소 시 `execution.error` 가 `undefined` 이므로 응답은
  `null`. **W16 완전 해소 확인.**

## (c) `ExecutionCancelledError` message 도달 잔존 경로 — 전수 확인 (신규 발견 없음)

유일한 `throw new ExecutionCancelledError(...)` 지점(`assertExecutionNotCancelled`,
`execution-engine.service.ts:7947-7949`, `Execution ${executionId} cancelled externally`)에서
시작해 `grep -rn "ExecutionCancelledError" codebase/backend/src`(스펙 제외)로 나온 모든
`instanceof` 소비 지점을 전부 직접 열어 대조했다:

| 소비 지점 | 파일:라인 | 상태 |
| --- | --- | --- |
| `executeNode` catch | `execution-engine.service.ts:5812` | 안전 (W15, FAILED/emit 이전 재throw) |
| `runContainer` catch | `execution-engine.service.ts:7592` | 안전 (W9, 이전 라운드 확인·재확인) |
| `runExecution` catch → `finalizeCancelledExecution` | `execution-engine.service.ts:4529`→`4568-4581` | 안전 — `error` 필드 미설정, `EXECUTION_CANCELLED` 만 emit |
| `finalizeResumedExecutionOutcome` → `finalizeCancelledExecution` | `execution-engine.service.ts:2643`→`4568-4581` | 안전 — 동일 헬퍼 공유 |
| `RetryTurnService.failRetryExecution` | `retry-turn.service.ts:642` | 안전 (W16, 이번 라운드 확인) |
| `executeBackgroundSubgraph` catch | `execution-engine.service.ts:6927-6937` | 안전 — `logger.debug` 서버 로그만, WS/DB 미노출 (graceful swallow, no retry) |
| Rehydration 방어적 분기 | `execution-engine.service.ts:1332-1334` | 안전 — `logger.log('Rehydration cancelled mid-flight', { executionId })` 구조화 필드만, raw message 미포함 |
| `ForEachExecutor` 아이템 루프 | `foreach-executor.ts:99-101` | 안전 — 재throw만, message 저장/emit 없음 |
| `ParallelExecutor` 취소 우선 재throw | `parallel-executor.ts:279-284` | 안전 — 재throw만 (C5, `Promise.allSettled` 이후 동기 처리라 경쟁 없음, 별도 concurrency.md 가 이미 검증) |
| `WorkflowHandler.execute` 재throw 가드 | `workflow.handler.ts:195-197` | 안전 — 재throw만 (C1) |

추가로 architecture 레벨에서 HTTP 동기 노출 경로도 점검했다: `ExecutionsService.reRun`
등이 `executionEngineService.execute(...)`(비동기 dispatch, executionId 즉시 반환)를
호출할 뿐 그래프 실행 완료까지 await 하지 않으므로, `ExecutionCancelledError` 가 컨트롤러의
전역 예외 필터까지 uncaught 상태로 버블링해 500 응답에 raw message 가 실리는 경로는 없다.
`RetryTurnService.applyRetryLastTurn` 도 HTTP 컨트롤러가 아니라 BullMQ worker
(`continuation-execution.processor.ts:146`)에서만 호출된다.

**결론: message 노출 잔존 경로 신규 발견 없음.** 이전 라운드가 "그 외 확인 — 추가 노출 경로
없음"으로 정리한 4개 지점(`finalizeCancelledExecution` 2곳, `executeBackgroundSubgraph`,
rehydration 방어적 분기)과 이번에 재확인한 `foreach-executor`/`parallel-executor`/
`workflow.handler` 재throw-only 지점을 합쳐 전수 소비 지점을 모두 열어본 결과, W15/W16
해소 후 남은 안전하지 않은 경로는 없다.

## 참고 (비-보안, 정보성) — 스코프 밖

- `containerCancelCheckedAtMs` 스로틀 Map 이 `executeBackgroundSubgraph` 경로에서 정리되지
  않는 문제는 이번 라운드 concurrency.md/side_effect.md 가 이미 WARNING(MEDIUM/LOW)으로
  독립 보고했다. 메모리 누수이지 취소 오분류나 message 노출과 무관해 본 보안 리뷰의 발견
  사항에는 포함하지 않는다(중복 방지).

## 요약

직전 라운드(3R)가 낸 두 WARNING — (a) `executeNode` generic catch 의 취소 오분류
(W15), (b) `RetryTurnService.failRetryExecution` 의 취소 시 `execution.error` 무조건 저장
(W16) — 모두 이번 커밋에서 완전히 해소됐다. W15 는 `ParkReleaseSignal` 과 대칭인 우회
재throw 로 FAILED 마킹/`NODE_FAILED` emit 이전에 취소를 가로채도록 고쳤고, 직전 라운드가
지적한 "실제 그래프 dispatch 를 통한 검증 부재" 테스트 갭도 신규 회귀 테스트로 메워졌다.
W16 은 `isCancelled` 조건으로 `execution.error` DB 저장을 WS emit 과 대칭시켰고, 회귀
테스트가 `execution.error` 필드 자체(이벤트 payload 아닌)를 취소/실패 양쪽 대조군으로
직접 단언한다. `ExecutionCancelledError` 의 유일한 throw 지점에서 시작해 모든
`instanceof` 소비 지점(10곳)을 전수 재확인한 결과, message(executionId 포함)가 WS 이벤트나
REST 응답, 서버 로그의 비구조화 필드로 노출되는 잔존 경로는 발견되지 않았다. HTTP 동기
경로를 통한 uncaught 버블링 가능성도 아키텍처(비동기 fire-and-forget dispatch, BullMQ
worker 전용 재진입)상 없음을 확인했다. 신규 CRITICAL/WARNING 없음.

## 위험도

NONE
