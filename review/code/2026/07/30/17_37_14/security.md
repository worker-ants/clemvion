# 보안(Security) 코드 리뷰

## 검토 범위

`main...HEAD` diff 중 아래 5개 파일 — `execution.retry_last_turn` 재진입의 짝 상태전이(FAILED→RUNNING /
FAILED→WAITING_FOR_INPUT)가 상태머신 opt-in(`allowRetryReentry`)에서는 허용되면서도 DB 레벨 가드
(`lockNonTerminalExecutionRow`/`updateExecutionStatus`)에는 그 opts 가 전달되지 않아 **항상 0행**으로
막히던 결함(8R CRITICAL)과 그 배선을 나머지 호출부(`reparkAiResumeTurn` 등, 9R/10R)까지 완결한 변경.

- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`
- `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`
- `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`
- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`

`git diff main...HEAD --stat`(해당 5개 파일)로 실제 변경 라인을 확인했고, `allowRetryReentry`/
`retryReentry` 플래그의 전체 참조처(`grep -rn`, backend 전역)와 `execution.retry_last_turn` WS 진입점
(`websocket.gateway.ts`)의 인증/소유권 검증까지 추적해 opt-in 게이트가 외부 입력으로 위조될 수 있는지
확인했다.

## 발견사항

- **[WARNING]** 내부 상태머신 어설션 예외가 client-safe 매핑 없이 `EXECUTION_FAILED` WS 이벤트로 그대로 노출될 수 있는 경로
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:100-104`(`assertTransition` 이 `throw new Error(...)` 로 원문 메시지를 그대로 던짐), `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:439`(신규 JSDoc — "그 일반 예외 메시지가 EXECUTION_FAILED payload 로 노출된다"), `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:926`·`956`·`959`(`failRetryExecution` 이 `error.message` 를 그대로 `EXECUTION_FAILED`/`EXECUTION_CANCELLED` payload 의 `error` 필드에 실어 emit)
  - 상세: `reparkAiResumeTurn`/`finalizeAiNode` 가 retry 재진입 시 `allowRetryReentry`/`retryReentry` opt-in 을 끝까지 전파하지 못하면 `assertTransition('failed', 'running'|'waiting_for_input', opts)` 이 DB 왕복 전에 **동기 throw** 한다. 이 예외는 `applyRetryLastTurn` 의 catch → `failRetryExecution` 로 흘러가는데, 이 경로는 `error instanceof Error ? error.message : String(error)` 를 그대로 client-facing WS payload 에 싣는다. 같은 파일이 `retryLastTurn()`(WS 게이트웨이 동기 ack 경로)의 `RetryLastTurnError`/`InvalidExecutionStateError` 에는 "message 는 고정 client-safe 문자열"이라는 명시적 규약을 두고 있는데(websocket.gateway.ts 주석 "보안 — … message 는 고정 client-safe 문자열"), 상태머신 어설션 예외는 그 규약 밖에 있어 대칭이 깨진다. 이번 diff 는 정확히 이 배선이 3라운드(8R/9R/10R) 연속으로 깨져 있었던 이력이 있는 지점이라(plan/in-progress/retry-turn-terminal-guard.md 10차 라운드 참조), 향후 유사 배선 누락이 재발하면 이 노출 경로가 다시 열린다. 노출되는 문자열 자체는 `ExecutionStatus` enum 값(pending/running/waiting_for_input/…)뿐이라 민감도는 낮지만, "내부 구현 예외를 그대로 사용자에게 전달하지 않는다"는 코드베이스 자체 규약과 불일치한다.
  - 제안: `failRetryExecution`(및 형제 `finalizeGuarded` 소비처)에서 state-machine `Error`(및 기타 미분류 예외)를 `RetryLastTurnError`/`InvalidExecutionStateError` 와 동일하게 client-safe 고정 문구로 매핑한 뒤 원본 메시지는 로그로만 남기는 방식을 검토. 최소한 이번 PR 이 추가한 wiring 테스트(10R)를 상시 회귀 가드로 유지.

- **[WARNING]** `retryLastTurn` 이 부모 Execution 상태를 검증하지 않아, CANCELLED 경합 시 스폰된 NodeExecution 이 영구 RUNNING 고아로 남을 수 있음 (팀 자체 추적 defer #20 과 일치 — 독립 확인)
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `retryLastTurn`(NodeExecution.status===FAILED 만 검증, 부모 Execution.status 미검증) → `applyRetryLastTurn` → `finalizeAiNode`(`ai-turn-orchestrator.service.ts:1596-1620`, else 분기 `updateExecutionStatus(execution, RUNNING, …, {allowRetryReentry:true})`) → `state-machine.ts:72-77`(`from !== 'failed'`면 opt-in 무관하게 즉시 false → `assertTransition` throw)
  - 상세: retryable 실패 직후 부모 Execution 이 (Stop 등 경합으로) 이미 `CANCELLED` 로 먼저 마감된 상태에서도 `retryLastTurn()`은 NodeExecution 레벨 검증만 통과하면 spawn(새 RUNNING NodeExecution row 생성)까지 진행한다. 이후 `applyRetryLastTurn`의 `finalizeAiNode`가 `updateExecutionStatus('cancelled'→'running', opts)`를 호출하면 `assertTransition`이 DB 가드 진입 **전에** 동기 throw 하므로, `assertLinkedTransitionApplied`의 "짝 NodeExecution 을 CANCELLED 로 재마킹" 정리 경로를 거치지 않는다. `failRetryExecution`→`finalizeGuarded`가 Execution 을 재조회해 이미 CANCELLED 임을 확인하고 조용히 skip 하므로 **Execution 자체는 안전하게 보존**되지만(재현 확인: `canTransition('cancelled','failed')`=false 이므로 상태 덮어쓰기는 없음), 스폰된 NodeExecution row 는 어떤 save 도 받지 못한 채 DB 상 RUNNING 으로 영구 고아가 된다(타임라인/진행률 집계 오염). WS 게이트웨이의 인증(`getCommandAuthContext`)·소유권(`verifyExecutionOwnership`) 검증이 살아 있어 제3자가 타인의 실행을 대상으로 이 경로를 유발할 수는 없으므로 크로스테넌트 노출은 아니지만, 사용자가 자신의 실행에 대해 Stop↔Retry 경합을 의도적으로 반복하면 orphan RUNNING row 를 누적시킬 수 있다.
  - 제안: (팀이 이미 P2 로 등재·추적 중 — `plan/in-progress/retry-turn-terminal-guard.md` 10차 라운드 defer #20) `retryLastTurn` 1.5단계로 부모 Execution.status===FAILED 사전 검증 추가, 또는 `finalizeAiNode`/`reparkAiResumeTurn`의 `updateExecutionStatus` 호출을 try/catch 로 감싸 실패 시 스폰 row 를 명시적으로 종결.

- **[INFO]** 상태 전이 허용 여부가 두 개의 독립된 소스(상태머신 TS opt-in ↔ 엔진 SQL 허용목록 상수)로 이중 관리되어 배선 누락이 구조적으로 재발 가능 (팀 자체 추적 defer #21/#22 와 동일 뿌리)
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:72-77`(`canTransition` opt-in 판정) ↔ `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-543`(`NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`), `:8168-8184`(`lockNonTerminalExecutionRow`), `:8354-8473`(`updateExecutionStatus` 두 분기)
  - 상세: "이 전이는 opt-in 으로만 허용" 이라는 하나의 정책이 (a) TypeScript 상태머신의 `allowRetryReentry` 분기, (b) 엔진의 SQL 허용목록 상수 선택(`opts?.allowRetryReentry ? A : B`) 두 곳에 독립적으로 구현돼 있고 서로를 참조하지 않는다. 이번 PR 의 헤드라인 결함(8R CRITICAL) 자체가 바로 이 이중 소스 불일치(상태머신은 허용, DB 가드는 opts 미반영)였고, 수정 후에도 구조는 그대로 남아 9R/10R 에서 또 다른 호출부(`reparkAiResumeTurn`)의 배선 누락이 재발견됐다(3라운드 연속 같은 근본원인). `{ allowRetryReentry?: boolean }` 구조적 타입도 `TransitionOptions` 를 재사용하지 않고 5곳에 인라인 중복돼 있어, 컴파일러가 필드 추가/rename 시 나머지 호출부 불일치를 강제 검출하지 못한다. 인가/상태 가드 로직이 여러 계층에 손 동기화로 흩어지는 패턴은 이 클래스의 결함(과소 허용이든 과다 허용이든)이 반복될 구조적 위험을 남긴다.
  - 제안: 팀이 이미 P2/P3 로 등재(defer #21, #22, #23) — SQL 허용목록을 상태머신 표에서 파생 생성하거나 상호 참조 상수화, `TransitionOptions` 재사용, 매 신규 opt-in 소비처에 "상태머신 허용 ↔ DB 가드 허용" 동시 검증 통합 테스트를 관례화.

- **[INFO]** JSONB 원자 연산 SQL 조립에 문자열 템플릿 리터럴 사용 — 현재는 컴파일타임 상수만 삽입되어 인젝션 벡터 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(`RETRY_STATE_KEY` 상수를 `output_data - '${RETRY_STATE_KEY}'`/`jsonb_exists(output_data, '${RETRY_STATE_KEY}')`/`input_data - '${RETRY_STATE_KEY}'` 형태로 raw SQL 조각에 보간하는 `retryLastTurn`·`claimSpawnedRetryRow`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-543`(`NON_TERMINAL_*_SQL` 상수를 `status IN (${…})` 에 보간)
  - 상세: 보간되는 값은 모두 모듈 스코프 `const`(`'_retryState'`) 또는 `ExecutionStatus` enum 값으로 고정돼 있고, 사용자 식별자(`executionId`/`nodeExecutionId`)는 별도로 `$1`/`:id` 파라미터 바인딩을 쓰고 있어 현재 SQL 인젝션 취약점은 없다. 다만 문자열 보간으로 SQL 조각을 조립하는 패턴 자체는 향후 리팩터링에서 실수로 사용자 입력이 섞여 들어갈 여지를 구조적으로 열어 두므로 정적 스캐너 오탐 및 유지보수 리스크의 소지가 있다.
  - 제안: 조치 불요(현행 유지) — 이 상수들이 절대 요청 입력에서 파생되지 않도록 코드 리뷰 관례로 계속 확인.

## 확인된 안전 사항 (참고)

- `execution.retry_last_turn` WS 진입점(`websocket.gateway.ts` `handleRetryLastTurn`)은 인증(`getCommandAuthContext`)과 소유권 검증(`verifyExecutionOwnership`, 실패 시 Forbidden 이 아닌 NotFound 로 통일해 존재 여부 추론 차단)을 이 diff 이전과 동일하게 유지한다 — 이번 변경이 인가 경계를 건드리지 않았다.
- `allowRetryReentry`/`retryReentry` 플래그는 backend 전역에서 `retry-turn.service.ts` 의 `{ retryReentry: true }` 리터럴(오직 `applyRetryLastTurn` 성공 경로)에서만 기원하며, 그 외 모든 호출부(`form-interaction.service.ts`/`button-interaction.service.ts`/`ai-turn-orchestrator.service.ts` 의 첫-turn park 등)는 opts 를 아예 전달하지 않아 fail-closed 기본값을 유지한다. 즉 이 opt-in 게이트는 외부 요청 바디로 위조될 수 없다.
- `canTransition` 의 opt-in 조건은 `from==='failed' && to∈{'running','waiting_for_input'}` 로 정확히 좁혀져 있고 `CANCELLED`/`COMPLETED` 로의 전이는 opt-in 대상에 없다 — 의도한 두 케이스(즉시 종료/재-park) 밖으로 새지 않는다.
- 이번 PR 이 스레딩한 `opts` 는 트랜잭션 내 `FOR UPDATE` 행 잠금으로 보호되는 기존 concurrency-guard 구조를 그대로 재사용하므로 새로운 race window 를 만들지 않는다.

## 요약

이번 diff 는 신규 공격 표면을 추가하지 않는 좁게 스코프된 동시성 버그 수정이다 — 상태머신에서는 이미 허용된 retry 재진입 짝 전이(FAILED→RUNNING/WAITING_FOR_INPUT)가 DB 레벨 가드에 opts 가 전달되지 않아 구조적으로 0행에 막히던 결함을 고쳤다. `allowRetryReentry` 게이트는 WS 게이트웨이의 인증·소유권 검증을 통과한 내부 retry 서비스 호출 체인에서만 리터럴로 기원해 외부 입력으로 위조 불가능함을 확인했고, 대상 전이 집합도 의도한 두 케이스로 정확히 좁혀져 있다. 다만 (1) 배선 실패 시 내부 상태머신 예외 메시지가 client-safe 매핑 없이 `EXECUTION_FAILED` WS 이벤트로 노출될 수 있는 경로, (2) `retryLastTurn` 이 부모 Execution 상태를 검증하지 않아 CANCELLED 경합에서 스폰 row 가 orphan RUNNING 으로 남는 경로, (3) 상태 허용 정책이 TS 상태머신과 엔진 SQL 허용목록 두 곳에 이중 관리되어 이번 결함급 배선 누락이 구조적으로 재발 가능한 점을 확인했다 — 세 항목 모두 팀이 자체 리뷰 라운드(7R/10R)에서 이미 defer #20/#21/#22 로 문서화·추적 중인 항목과 일치하며, 크로스테넌트 노출이나 인가 우회로 이어지지는 않는다. 하드코딩된 시크릿, 인젝션 벡터(파라미터 바인딩 정상 사용), 안전하지 않은 암호화는 발견되지 않았다.

## 위험도

LOW
