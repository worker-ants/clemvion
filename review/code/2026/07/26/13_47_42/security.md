# 보안(Security) Review — linear-cancel-mechanism (W9 재검증 포함)

대상: `assertExecutionNotCancelled` §2.3 노드 경계 cancel 가드 확장(C1/C3/C5) + `ExecutionCancelledError`
message 파라미터화(`workflow-errors.ts`) + 관련 spec/e2e/plan 갱신.

## 사전 확인 — W9(직전 라운드) 원 지적 사항은 해소됨

원 W9: `runContainer` 의 catch-all(컨테이너 ForEach/Loop/Map 자신의 NodeExecution)이
`ExecutionCancelledError` 를 instanceof 분기 없이 일반 실패로 처리해 (a) 컨테이너 노드를
FAILED 로 영속, (b) 내부 전용 message(`Execution ${executionId} cancelled externally`,
executionId 포함)를 실어 `NODE_FAILED` 를 WS 로 방출하던 결함.

`codebase/backend/src/modules/execution-engine/execution-engine.service.ts` 의 `runContainer`
catch (실제 소스 라인 7565-7576) 를 직접 열어 확인: `catch (err)` 진입 직후
`if (err instanceof ExecutionCancelledError) { throw err; }` 가 FAILED 마킹/`NODE_FAILED`
emit 코드(라인 7577-7613)보다 먼저 실행되도록 재throw 가드가 배치돼 있다 — 취소는 더 이상 이
catch-all 에 도달하지 못한다. `execution-engine.service.spec.ts:10110`
("아이템 경계 취소가 컨테이너 노드를 FAILED 로 오분류하거나 NODE_FAILED 를 emit 하지 않는다 (W9)")
가 `nodeExecutionRepository.save`/`emitNode` 인자 미호출을 직접 단언하는 회귀 테스트로
고정돼 있다. **원 W9 지적 범위(컨테이너 catch-all)는 해소 확인.**

## 발견사항 — W9 와 동일 결함 클래스의 잔존 노출 경로 2건 (신규)

이번 라운드에서 지시된 "message 에 executionId 가 박히는 문제의 잔존 노출 경로 전수 확인"을
`new ExecutionCancelledError(...)` 유일한 throw 지점(`assertExecutionNotCancelled`,
`execution-engine.service.ts:7929-7931`, `throw new ExecutionCancelledError(`Execution
${executionId} cancelled externally`)`)에서 시작해 모든 `instanceof ExecutionCancelledError`
소비 지점(`grep` 9곳)과 그 사이 모든 호출 스택을 추적한 결과, `runContainer` 외에 **동일한
misclassification + message 노출 패턴이 두 곳 더** 확인됐다. 둘 다 이번 PR 의 diff 파일
목록(`review/code/.../_prompts/security.md` 파일 1-21)에는 없지만, 이번 PR 이 `ExecutionCancelledError`
의 message 를 "항상 고정된 무해한 문자열"에서 "executionId 를 담는 파라미터화된 문자열"로
바꾼 계약 변경(`workflow-errors.ts` 생성자 diff) 의 직접적 결과로 새로 노출되는 경로다.

- **[WARNING]** `executeNode` 의 generic catch 가 `ExecutionCancelledError` 를 특별
  분류하지 않아, 동기(sync) Sub-Workflow 노드 자신이 취소를 "노드 실패"로 오분류 + 내부
  전용 message 를 `NODE_FAILED` 로 WS 방출한다 — `runContainer` 가 이번 PR 에서 막은 것과
  **동형의 결함이 WorkflowHandler 경로에는 여전히 열려 있다**.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` —
    `executeNode` catch 블록(실제 소스 라인 5758). `isAbortError(err)` 분기(5765-5793)와
    `err instanceof ParkReleaseSignal` 분기(5801-5803)만 있고 `ExecutionCancelledError`
    분기가 없다 — 그대로 `errorPolicyHandler.handleError()`(5805-5811)로 떨어진다.
    노드에 `errorHandling` 설정이 없으면(가장 흔한 기본값) `getErrorPolicyConfig`(5806)가
    `{ policy: 'stop_workflow' }` 를 반환해 `case 'stop': default:` 분기(5878-5905)로
    가고, `errorHandling.policy === 'skip_node'` 여도 `case 'skip'`(5814-5841)으로 가서
    둘 다 `nodeExecution.error = { message: err.message }` 를 저장한다. `'stop'` 분기는
    추가로 `NODE_FAILED` 를 `error: err.message` 로 WS emit(5889-5904)한다.
  - 재현 경로: `codebase/backend/src/nodes/flow/workflow/workflow.handler.ts` 의 C1 재throw
    (라인 195-197, `if (err instanceof ExecutionCancelledError) { throw err; }`)는 이 PR 이
    "SUB_WORKFLOW_FAILED 오분류 + error 포트 흡수"를 막기 위해 도입한 수정이다. 그러나 이
    핸들러(`WorkflowHandler.execute`)는 부모 그래프의 `executeNode` 가 그 노드(=Sub-Workflow
    노드 자신)에 대해 호출하는 `handler.execute(...)`(경유:
    `executeWithRetry`(`execution-engine.service.ts:6105`) → `errorHandling.policy !== 'retry'`
    이면 `return handler.execute(...)`, 로컬 catch 없음)의 본체이므로, 재throw 된
    `ExecutionCancelledError` 는 `executeNode` 의 try 블록 **안**에서 발생한 예외로 취급돼
    바로 위 catch 로 떨어진다. `workflow.handler.ts:181-183` 의 주석("재throw 해
    엔진(executeNode→runExecution/runNodeDispatchLoop)이 세그먼트를 종료")은 `executeNode`
    가 이 예외를 그대로 통과시킨다고 서술하지만, 실제로는 `executeNode` 자신의 catch 가
    가로채 위 오분류 처리를 수행한 **뒤** 최종적으로 `throw err`(5905, `case 'stop'`)로
    재던진다 — 그래서 상위 루프가 결국 Execution 을 `cancelled` 로 마감하는 것 자체는
    맞지만, 그 전에 Sub-Workflow 노드 자신의 `NodeExecution` 이 FAILED 로 영속되고
    `NODE_FAILED` 가 이미 WS 로 나간 뒤다. "Execution 은 cancelled 인데 그 안의 노드는
    failed" 라는, `runContainer`(W9)가 정확히 막았던 상태·감사로그 불일치가 Sub-Workflow
    노드 경로에는 재현된다. 컨테이너/Parallel 은 `runContainer`/`executeParallelBranchBody`
    가 `executeNode` **밖**에서(노드 자신의 dispatch 완료 후 별도 후처리 단계로) 호출되므로
    이 catch 를 거치지 않지만, Sub-Workflow 는 자기 자신의 `handler.execute()` 안에서
    재귀적으로 같은 executionId 의 하위 루프를 돌리는 유일한 노드 타입이라 구조적으로
    `executeNode` catch 를 통과한다.
  - 회귀 테스트 공백 확인: `workflow.handler.spec.ts` 의 신규 C1 테스트(2건, gate
    732-777)는 `WorkflowHandler.execute()` 를 mock executor 로 단독 실행해 "re-throw 하는지"
    만 검증하고, `execution-engine.service.spec.ts` 의 신규 테스트들(`executeInline` C2,
    W9 컨테이너 케이스 등)도 `service.executeInline(...)` 을 직접 호출하거나 컨테이너
    시나리오만 다뤄, "실제 그래프에서 workflow 타입 노드를 통해 dispatch 했을 때
    `executeNode` 가 그 노드를 어떻게 마감하는지"를 단언하는 테스트는 없다 — 이번 PR 의
    mutation-verified 7개 지점(`RESOLUTION.md` 표) 목록에도 이 지점은 포함돼 있지 않다.
  - 제안: `executeNode` catch 상단(5765 `isAbortError` 분기 옆)에
    `if (err instanceof ExecutionCancelledError) { throw err; }` 를 `ParkReleaseSignal`
    과 대칭으로 추가해, Sub-Workflow 노드 자신도 FAILED 마킹/NODE_FAILED emit 이전에
    우회하도록 한다(`runContainer`/`ForEachExecutor`/`ParallelExecutor` 가 이미 쓰는
    동일 패턴). 회귀 테스트로 "workflow 타입 노드를 정상 그래프 dispatch 로 통과시키고
    executeInline 내부에서 외부 cancel 을 관측시켰을 때, Sub-Workflow 노드 자신의
    `NodeExecution` 이 FAILED 로 저장되지 않고 `NODE_FAILED` 가 emit 되지 않는다"를
    mutation 검증까지 고정할 것 — 정확히 W9 테스트가 컨테이너에 대해 했던 것과 동형.

- **[WARNING]** `RetryTurnService.failRetryExecution` 이 취소(`isCancelled`)여도
  `Execution.error` 필드를 무조건 채워 저장 — DB 영속 + REST `GET /executions/:id` 응답에
  내부 전용 message(executionId 포함)가 노출될 수 있다. 이 파일은 이번 PR 의 diff 에
  없지만, 이번 PR 이 `ExecutionCancelledError` message 를 executionId 를 담는 동적 문자열로
  바꾼 계약 변경의 직접적 하류 영향을 받는다(변경 전에는 이 sentinel 이 항상 고정 문자열
  `'Execution cancelled while waiting for input'`이라 노출돼도 무해했다).
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:636-651`
    (`failRetryExecution`). `line 642`: `const isCancelled = error instanceof
    ExecutionCancelledError;` → `line 646-647`: `const errMessage = ...; execution.error =
    { message: errMessage };` — `isCancelled` 분기 없이 **항상** 실행. `line 651`:
    `await this.executionRepository.save(execution);` 로 그대로 영속.
  - 재현 경로: `RetryTurnService.applyRetryLastTurn`(catch, `retry-turn.service.ts:409`)
    → `failRetryExecution`. `resumeGraphAfterRetry`(라인 575)가 `this.driver.
    runNodeDispatchLoop({...})` 를 호출하는데, 이는 이번 PR 이 §2.3 가드를 추가한 바로 그
    `ExecutionEngineService.runNodeDispatchLoop`(`execution-engine.service.ts:1663` 의
    `assertExecutionNotCancelled` 호출)다. AI 턴 재시도 중 사용자가 Stop 을 누르면 이
    가드가 `Execution ${executionId} cancelled externally` 를 담은 `ExecutionCancelledError`
    를 던지고, 그대로 `applyRetryLastTurn` catch 까지 전파돼 `failRetryExecution` 이 이
    message 를 `execution.error.message` 에 저장한다.
  - WS emit 자체는 안전함을 확인: 같은 함수의 `line 652-661`(`emitExecution(...,
    isCancelled ? EXECUTION_CANCELLED : EXECUTION_FAILED, { status, ...(!isCancelled ?
    {error: errMessage} : {}) })`)은 `isCancelled` 일 때 `error` 필드를 payload 에서
    명시적으로 제외한다 — `retry-turn.service.spec.ts:476-495` 의 기존 회귀 테스트("emits
    EXECUTION_CANCELLED (not FAILED) when re-entry throws ExecutionCancelledError")가
    `toHaveBeenCalledWith(EXEC, EXECUTION_CANCELLED, { status: CANCELLED })` 로 이를
    고정하고 있다. **다만 이 테스트는 `new ExecutionCancelledError()`(인자 없음, 무해한
    고정 문구)만 쓰고 `execution.error`(DB 저장 필드) 자체는 단언하지 않는다** — 그래서
    `line 647` 의 무조건 대입이 회귀망에 걸리지 않은 채 남아 있다. `execution.error` 는
    `executions.service.ts:840`(`toExecutionDto` 의 `error: execution.error ?? null`)를
    통해 REST 응답에 그대로 노출된다.
  - 실질 위험은 낮음: 노출되는 executionId 는 호출자가 이미 URL 로 알고 있는 자기 자신의
    executionId 라 제3자 정보 노출은 아니다. 그러나 (a) `@internal` 로 명시된
    "모듈 외부 직접 참조 금지" sentinel 의 raw 문자열이 사용자향 API 응답 필드에 그대로
    실리고, (b) `finalizeCancelledExecution`(이번 PR 이 C4/W12 로 확립한 패턴,
    `execution-engine.service.ts:4568-4581`)은 취소 종결 시 **의도적으로 `error` 필드를
    설정하지 않는데**, 같은 클래스의 종결 처리(AI 재시도 취소)만 이 규약 밖에 남아
    불일치가 생긴다.
  - 제안: `failRetryExecution` 의 `execution.error` 대입을 `!isCancelled` 조건으로 감싸
    (WS emit 과 동일 조건), 취소 종결 시 error 필드를 아예 쓰지 않도록
    `finalizeCancelledExecution` 패턴과 통일한다. 회귀 테스트로 "ExecutionCancelledError
    (executionId 포함 message) 로 재시도가 취소될 때 `execution.error` 가 `null`/`undefined`
    로 유지된다"를 `execution.error` 자체에 대해 직접 단언(현재 테스트는 이벤트 payload만
    단언).

## 그 외 확인 — 추가 노출 경로 없음

`ExecutionCancelledError` 를 소비하는 나머지 지점은 모두 안전함을 코드 확인:
- `runExecution`/`finalizeResumedExecutionOutcome`(`execution-engine.service.ts:4529`,
  `:2643`) → `finalizeCancelledExecution` 공유 헬퍼(4568-4581): `error` 필드 미설정,
  `EXECUTION_CANCELLED` 만 emit — 안전(C4/W3 로 이미 검증 완료된 범위).
- `executeBackgroundSubgraph`(`:6916-6926`, W2): graceful swallow, `logger.debug` 로만
  기록(서버 로그, WS/API 미노출) — 안전.
- `ForEachExecutor`(`foreach-executor.ts:99-101`)/`ParallelExecutor`
  (`parallel-executor.ts:279-284`): errorPolicy 우회 재throw만 하고 자체적으로 어떤
  message 도 저장/emit 하지 않음 — 안전(단, 재throw 된 값이 위 두 발견사항의 경로로
  들어갈 수 있다는 것이 이번 리포트의 핵심).
- Rehydration defensive 분기(`:1332`): `logger.log('Rehydration cancelled mid-flight',
  { executionId })` — 구조화 로깅으로 executionId 만 필드로 기록(원문 message 미포함),
  서버 로그 전용 — 안전.

## 요약

직전 라운드 W9(컨테이너 `runContainer` catch-all 이 취소를 실패로 오분류 + 내부 message
누출)는 재throw 가드 + 전용 회귀 테스트로 정확히 해소됐다. 다만 이번 PR 이 `ExecutionCancelledError`
의 message 를 고정 문자열에서 executionId 포함 동적 문자열로 확장한 계약 변경은, 같은
결함 클래스(취소를 실패로 오분류 + 내부 sentinel message 를 사용자향 채널로 노출)가
발생할 수 있는 소비 지점 전부에 대칭적으로 방어되지 않았다. `executeNode` 의 generic
catch 는 Sub-Workflow(동기) 노드가 자기 자신의 취소를 노드 FAILED + `NODE_FAILED` WS
emit 으로 오분류하도록 방치하며, 이는 `WorkflowHandler` 의 C1 재throw 수정이 "엔진이
그대로 통과시킨다"고 가정한 것과 실제 동작이 어긋나는 지점이다. `RetryTurnService.
failRetryExecution` (diff 밖의 기존 코드)도 취소 종결 시 `execution.error` 를 무조건
채워 REST 응답에 내부 message 를 실어 보낸다. 두 경로 모두 노출되는 정보 자체는
호출자가 이미 아는 자신의 executionId 라 실질적 정보 노출 위험은 낮지만, `@internal`
sentinel 계약 위반과 상태·감사로그 불일치는 W9 가 막으려던 것과 동일한 결함이며 이번
PR 의 회귀 테스트/mutation 검증 범위(7개 지점) 밖에 있다.

## 위험도

MEDIUM
