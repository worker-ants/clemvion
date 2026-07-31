# 테스트(Testing) 리뷰 — engine-driver.interface.ts / retry-turn.service.ts / state-machine.ts

## 발견사항

- **[WARNING]** `tryLockActiveExecutionAndSaveNodeExec` 의 신규 `opts.allowRetryReentry` 가 전용 unit 커버리지에 반영되지 않음 (형제 `updateExecutionStatus` 대비 비대칭)
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:216-227` (`tryLockActiveExecutionAndSaveNodeExec` 선언 + opts JSDoc). 실제 테스트 갭은 리뷰 대상 밖 파일인 `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` 의 `tryLockActiveExecutionAndSaveNodeExec — RUNNING 유지 분기 전용 원자 관측+save` describe(약 5495행, 케이스 4건: 5504/5522/5542/5564행)에 있음.
  - 상세: 같은 PR 이 같은 파일(`engine-driver.interface.ts`)에 동일한 모양의 `opts?: { allowRetryReentry?: boolean }` 를 두 곳(`updateExecutionStatus`, `tryLockActiveExecutionAndSaveNodeExec`)에 추가했다. `updateExecutionStatus` 쪽은 `execution-engine.service.spec.ts:5115`·`:5164` 에 SQL 문자열이 `'failed'` 를 포함/배제하는지 직접 대조하는 전용 unit 테스트가 있는 반면, `tryLockActiveExecutionAndSaveNodeExec` 전용 describe 는 4개 케이스 모두 opts 인자를 아예 전달하지 않는다(`grep`으로 호출부 4곳 전수 확인 — opts 전달 0건). 이 seam 은 `ai-turn-orchestrator.service.ts` 의 `finalizeAiNode` 두 호출부(isFailed 분기, RUNNING 유지 분기)에서 `allowRetryReentry ? { allowRetryReentry: true } : undefined` 로 매번 재구성되는데, 정확히 이 "번역 한 줄" 형태의 배선이 깨지는 사고가 이번 PR 계열의 8R/10R CRITICAL 원인이었다(`ai-turn-orchestrator.service.spec.ts:140` 주석 참조). 현재 유일한 방어선은 `execution-engine.service.spec.ts:16946` 의 통합 테스트 1건("re-failure (retryable again)")뿐이며, `dbExecutionStatus`/`mockTxManagerQuery` 가 SQL 문자열을 실제로 평가하는 mock 이라 이 테스트가 회귀를 잡는 것은 직접 확인했다 — 그러나 형제 함수 대비 방어선이 1단(통합) 뿐이고, 회귀 시 `finalizeAiNode` 의 두 호출부 중 어느 쪽인지 특정할 진단력이 없다.
  - 제안: `updateExecutionStatus` 와 대칭으로 `tryLockActiveExecutionAndSaveNodeExec` 전용 describe 에도 opt-in/no-opt-in 대조 케이스(SQL 이 `'failed'` 를 포함/배제하는지 직접 대조)를 추가. **참고**: 이 항목은 이미 `plan/in-progress/retry-turn-terminal-guard.md` #27(P3, 11R W3 근거)로 추적 중인 기존 defer 항목이다 — 신규 백로그로 중복 등재하지 말고 그 항목을 참조할 것.

- **[WARNING]** `_retryState` 원자 claim/consume JSONB SQL 이 unit·e2e 어느 계층에서도 실제 PostgreSQL 로 검증된 적이 없음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:212-220` (`retryLastTurn` 의 `output_data - '_retryState'` + `jsonb_exists` 조건), `:541-549` (`claimSpawnedRetryRow` 의 `input_data - '_retryState'` + `status = 'running'` + `jsonb_exists` 조건)
  - 상세: 두 SQL 모두 테스트에서는 `createQueryBuilder().execute()` 를 고정 `{ affected: N }` 값으로 되돌리는 mock 으로만 검증된다(`retry-turn.service.spec.ts:69`, `:195` 등). SQL 문자열이 실제로 유효한 Postgres 구문인지, `jsonb_exists`/`-` 연산자가 NULL·타입 불일치·진짜 동시 UPDATE 상황(두 트랜잭션이 동시에 같은 행을 대상)에서 기대한 정확히-1-행 매칭을 반환하는지는 unit·e2e 어느 계층에도 검증이 없다(`retry_last_turn` 관련 `.e2e-spec.ts` 파일 자체가 존재하지 않음, grep 으로 확인). 이번 라운드가 고친 결함(state-machine 의 opt-in 이 DB 가드 SQL 까지 도달하지 못해 8라운드 동안 mock 으로 은폐)과 동일한 "mock 이 실제 DB 의미론과 괴리" 클래스의 마지막 미해소 표면이다.
  - 제안: 최소 1개의 실 Postgres 대상 통합 테스트(testcontainers 또는 기존 e2e 인프라)로 두 원자 claim SQL 의 동시 실행 시나리오(두 트랜잭션 중 정확히 하나만 `affected=1`)를 검증. **참고**: 이미 `plan/in-progress/retry-turn-terminal-guard.md` #3(P2, 5R W6→6R W7 근거)로 추적 중이며, 11R 재확인에서 "3라운드 연속 unit mock 정교화로만 대응돼 온 이력" 을 근거로 우선순위 상향이 이미 권고돼 있다 — 그 권고를 재확인하는 것으로, 신규 발견이 아니다.

- **[INFO]** `retryLastTurn` 의 `retryAfterSec` 폴백 분기·타임스탬프 부재 분기·경계값 미검증
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:182-197`
  - 상세: `retryAfterSec` 산출은 `errorObj.details?.retryAfterSec` → (없으면) `retryState.retryAfterSec` → (둘 다 없으면) `undefined` 3항 연쇄인데, 두 번째 폴백(`retryState.retryAfterSec`)은 어떤 테스트도 값을 설정하지 않는다 — `retry-turn.service.spec.ts` 전체에서 `retryAfterSec` 리터럴은 `:306`(`errorObj.details.retryAfterSec: 120`, RETRY_TOO_EARLY 케이스) 단 1곳뿐이다. 같은 이유로 (a) `nodeExec.finishedAt`/`startedAt` 둘 다 없어 `finishedAtMs` 가 `undefined`인 방어 분기, (b) `retryAfterSec` 카운트다운이 정상적으로 **경과해** 통과하는 케이스(현재 유일한 happy-path 테스트 `:208`은 애초에 fixture 에 `retryAfterSec` 을 넣지 않아 조건 자체를 우회), (c) `retryAfterSec === 0` 경계값도 미검증이다.
  - 제안: (a) `retryState.retryAfterSec` 폴백 성공, (b) 카운트다운 경과 후 정상 spawn, (c) 타임스탬프 부재 시 카운트다운 스킵 각각의 케이스 추가. **참고**: 이미 `plan/in-progress/retry-turn-terminal-guard.md` #7(P3, 2R INFO 14 = 5R W7)로 추적 중.

- **[INFO]** `RetryLastTurnError`/`InvalidExecutionStateError` 회귀 테스트가 `code` 만 단언하고 메시지 문자열은 단언하지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:236, 250, 258, 277, 286-287, 293-294, 313`
  - 상세: 전부 `.rejects.toMatchObject({ code: '...' })` 형태다. `retryLastTurn` 의 사전 검증 단계별 에러 메시지가 다른 에러 클래스의 고정 문구를 잘못 재사용하거나 카피-붙여넣기로 뒤바뀌어도 `code` 가 같으면 회귀로 잡히지 않는다.
  - 제안: 최소 스모크 수준으로 message 에 `nodeExecutionId` 등 핵심 토큰이 포함되는지 정도는 함께 단언. **참고**: 이미 `plan/in-progress/retry-turn-terminal-guard.md` #28(P3, 11R W9)로 추적 중.

- **[INFO]** `finalizeAiNode` "RUNNING 유지" 분기와 `retryReentry:true` 조합의 도달 가능성이 미확정인 채 미문서·미테스트
  - 위치(참고용, 리뷰 대상 파일 내 근거): `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:227-232`(`tryLockActiveExecutionAndSaveNodeExec` JSDoc 의 "세 번째 잠금 소비처" 서술). 실제 소비부는 리뷰 대상 밖의 `ai-turn-orchestrator.service.ts:1596-1601`.
  - 상세: retry 재진입은 호출당 단일 turn 만 처리하고, 그 turn 이 끝날 때까지 `savedExecution.status` 는 FAILED 로 유지된다(전이 자체가 `finalizeAiNode`/`reparkAiResumeTurn` 의 책임이므로). 따라서 `finalizeAiNode` 의 `savedExecution.status === RUNNING` 분기가 `retryReentry:true` 와 함께 실행되는 경로가 실제로 존재하는지 불분명하다 — 도달 불가능이 맞다면 이 조합은 영구히 테스트되지 않는 방어 코드인데 그 사실이 JSDoc 에 명시돼 있지 않다.
  - 제안: 호출 그래프를 재확인해 도달 불가능이 확정되면 JSDoc 에 "isFailed 분기와 달리 retry 재진입에서는 도달하지 않음" 을 명시하고, 도달 가능하면 isFailed 분기와 대칭 테스트를 추가. **참고**: 이미 `plan/in-progress/retry-turn-terminal-guard.md` #24(P3, 10R W3)로 추적 중.

## 요약

이번 라운드가 실제로 고친 CRITICAL(retry 재진입 짝 전이가 상태머신 opt-in 은 통과하고도 DB 가드 SQL 에서 항상 0행이 되던 결함)의 핵심 choke point 인 `state-machine.ts`(`canTransition`/`assertTransition` 의 `allowRetryReentry` 분기)와 `updateExecutionStatus`(`engine-driver.interface.ts` 계약, `execution-engine.service.ts` 구현)는 경계값 매트릭스(FAILED→RUNNING/WAITING_FOR_INPUT with/without opt-in, opt-in 이 다른 전이를 넓히지 않음)와 SQL 문자열을 실제로 평가하는 mock(`mockTxManagerQuery`, `dbExecutionStatus` 대조)으로 견고하게 잠겨 있다 — 8R 결함을 은폐했던 "항상 success 반환 mock" 문제를 정확히 인지하고 교정한 흔적이 보인다. `retry-turn.service.ts` 의 종결 2경로(`finalizeGuarded`/`completeRetryExecution`/`failRetryExecution`) 도 멱등 분기·COALESCE 보존·guarded UPDATE 0행 선점 등 각 분기마다 긍정/부정 대조 테스트가 쌍으로 존재해 vacuous 하지 않다. 두 스펙 파일(`retry-turn.service.spec.ts`, `state-machine.spec.ts`, 66 테스트)을 직접 실행해 현재 소스와 100% 정합함을 확인했다. 다만 형제 함수 `tryLockActiveExecutionAndSaveNodeExec` 는 동일 PR 이 추가한 동일 모양의 `opts` 를 전용 unit 테스트가 반영하지 못해 통합 테스트 1건에만 의존하는 비대칭이 있고, atomic JSONB claim SQL 은 실 Postgres 검증이 전무하다 — 다만 이 두 항목과 나머지 INFO 3건은 전부 `plan/in-progress/retry-turn-terminal-guard.md` (#3, #7, #24, #27, #28)에 이미 추적·근거 기록된 defer 항목이며 이번 리뷰가 독립적으로 재확인한 것일 뿐 신규 발견이 아니다 — 오케스트레이터는 이를 별도 신규 백로그로 중복 등재하지 않도록 유의할 것.

## 위험도

LOW
