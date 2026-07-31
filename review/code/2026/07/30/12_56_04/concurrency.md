# 동시성(Concurrency) 리뷰 — retry-turn.service.ts / retry-turn.service.spec.ts

## 발견사항

- **[CRITICAL]** `retry_last_turn` 재진입의 `FAILED→RUNNING`(및 `FAILED→WAITING_FOR_INPUT`) 짝 전이가, 실 Postgres 대비 **원자성 가드의 조건 범위가 상태머신의 opt-in 예외를 반영하지 못해** 구조적으로 절대 persist 될 수 없다.
  - 위치(리뷰 대상 파일, 이 파일이 의존하는 불변식의 진술):
    - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:273-277` — JSDoc "재진입 절차" 5번: "Execution FAILED → RUNNING 전이는 `finalizeAiNode` 의 COMPLETED 분기가 담당한다".
    - `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:430-434` — `applyRetryLastTurn` 호출부 주석: "여기서 미리 RUNNING 으로 옮기면 `finalizeAiNode` 의 RUNNING → RUNNING 전이가 invalid 가 되므로 전이를 finalize 단계로 미룬다." → 즉 `processAiResumeTurn` 호출 시점에 `execution.status` 는 여전히 `FAILED` 임을 이 파일 스스로 확정한다(`retryLastTurn`/`applyRetryLastTurn` 어디에도 `execution.status = RUNNING` 대입이 없음 — grep 확인).
  - 위치(실제로 그 불변식을 무너뜨리는 의존 파일 — Read 로 직접 확인한 실 줄번호):
    - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1562,1580-1585` — `finalizeAiNode` 의 else 분기가 `updateExecutionStatus(savedExecution, RUNNING, nodeExec, {allowRetryReentry:true})` 호출.
    - `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:421-425` — `reparkAiResumeTurn` 이 **opts 없이** `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, nodeExec)` 호출(대화가 끝나지 않고 계속되는, 가장 흔한 multi-turn 케이스에서 실행됨 — `handleAiMessageTurn` 의 `ended:false` 반환, 동파일 997행).
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:499-503` — `TERMINAL_STATUSES = {COMPLETED, FAILED, CANCELLED}`.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-518` — `NON_TERMINAL_STATUSES_SQL`(위 집합의 여집합, **FAILED 배제**).
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8138-8150` — `lockNonTerminalExecutionRow`: `SELECT id FROM execution WHERE id=$1 AND status IN (${NON_TERMINAL_STATUSES_SQL}) FOR UPDATE`. `opts`/`allowRetryReentry` 파라미터 자체가 없음.
    - `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8312-8393` — `updateExecutionStatus`: `opts`(`allowRetryReentry`)는 최상단 `assertTransition(execution.status, newStatus, opts)` 한 줄에서만 쓰이고, 이어지는 `linkedNodeExec` 분기(`:8346`)의 실제 원자성 잠금(`lockNonTerminalExecutionRow`)에는 전달되지 않는다.
    - `codebase/backend/src/modules/execution-engine/state/state-machine.ts:30-36` — `ALLOWED_TRANSITIONS[FAILED] = []`(FAILED→WAITING_FOR_INPUT 은 opt-in 조차 정의돼 있지 않음), `:58-76` — `canTransition` 의 `allowRetryReentry` 예외는 `FAILED→RUNNING` 한 쌍에만 한정.
  - 상세:
    1. **상태머신-가드 불일치.** `canTransition`(추상 레벨)은 `FAILED→RUNNING` 을 `allowRetryReentry` opt-in 으로 허용하지만, 그 전이를 실제로 안전하게 수행하는 동시성 가드(`lockNonTerminalExecutionRow`, `updateExecutionStatus`의 else 분기 guarded UPDATE 둘 다 동일한 `NON_TERMINAL_STATUSES_SQL` 상수를 참조)는 `opts` 를 전혀 받지 않고 `FAILED` 를 무조건 "이미 종결됨" 으로 배제한다. 즉 `assertTransition` 은 통과하는데 실제 잠금/UPDATE 는 항상 실패한다.
    2. **재실행 turn 이 즉시 끝나는 경우(성공/재실패)**: `finalizeAiNode` 의 `updateExecutionStatus(...,{allowRetryReentry:true})` 호출이 `lockNonTerminalExecutionRow` 에서 항상 0행(`isNonTerminal=false`)을 반환 → `persisted=false` → `assertLinkedTransitionApplied(false,...)` 가 방금 spawn 된 살아있는 NodeExecution 을 CANCELLED 로 마킹하고 `ExecutionCancelledError` 를 던진다. 실제 동시 Stop 이 전혀 없는데도 "동시 취소로 선점당함" 으로 오판된다. 이 예외는 `applyRetryLastTurn`(retry-turn.service.ts) 의 catch → `failRetryExecution` 로 흐르지만, DB 의 Execution 은 여전히 `FAILED` 라 `finalizeGuarded` 가 `FAILED→CANCELLED` 도 상태머신상 불허(`ALLOWED_TRANSITIONS[FAILED]=[]`)로 판단해 조용히 skip 한다 — 결국 아무 종결 이벤트도 나가지 않는다.
    3. **재실행 turn 이 계속되는(가장 흔한 multi-turn) 경우**: `reparkAiResumeTurn` 이 opts 없이 `updateExecutionStatus(execution, WAITING_FOR_INPUT, nodeExec)` 를 호출하므로 `assertTransition('failed','waiting_for_input', undefined)` 이 **동기적으로 throw** 한다(`Invalid state transition: cannot transition from "failed" to "waiting_for_input"`). 이 일반 Error 가 그대로 `failRetryExecution` 에 도달해 그 내부 문자열이 `EXECUTION_FAILED` 페이로드의 `error` 로 클라이언트에 노출된다.
    4. 두 경로 모두 **동시성 없이, 매 단일 호출마다 결정적으로** 재현되는 결함이라 겉보기엔 순수 로직 버그처럼 보이지만, 근본 원인은 "동시 Stop 이 이미 마감한 실행을 덮어쓰지 않기 위한" 동시성 안전장치(FOR UPDATE 잠금 가드)의 조건 범위가 상태머신이 명시적으로 허용한 opt-in 예외를 반영하지 못한 **동기화 설계 결함**이다 — concurrency 관점의 원자성/동기화 체크리스트 항목에 정확히 해당한다.
    5. **은폐 경로(왜 7 라운드 리뷰에서 안 걸렸는가)**: 실측 결과 관련된 3개 spec 파일이 전부 "허용됨"을 하드코딩 기본값으로 가정한다.
       - `retry-turn.service.spec.ts` 는 `AiTurnOrchestrator`/`RetryEngineDriver` 를 통째로 mock — 이 상호작용 자체가 노출되지 않음(파일 자체의 설계 의도이며 정상).
       - `ai-turn-orchestrator.service.spec.ts:418-436`("대조: RUNNING 재claim 이 적용되면(true)...")이 override 없이 `driver.updateExecutionStatus` 기본 mock(`true`)에 의존.
       - `execution-engine.service.spec.ts:249-251,269` — `mockTxManagerQuery = jest.fn().mockResolvedValue([{id: executionId}])` 주석: "기본은 '행 잠금 성공(비-terminal)' 이라 기존 테스트가 그대로 통과". 이 mock 은 실제 SQL 조건(및 Execution 의 실제 mocked status)과 무관하게 항상 성공을 흉내낸다. 실측: `cd codebase/backend && npx jest execution-engine.service.spec.ts -t "applyRetryLastTurn"` → 8/8 PASS(모두 이 하드코딩된 mock 덕분).
       - `grep -rl "retry_last_turn" codebase/backend/test/` 0건 — 실 Postgres 대상 e2e 커버리지 전무.
       - 추가로, `execution-engine.service.spec.ts` 의 `applyRetryLastTurn` describe 블록(16667행~) 안의 모든 `processReturn` fixture 가 `status:'ended'` 로 고정돼 있어(16755/16780/17051/17115/17127/17265/17517/17569행), "재실행 turn 이 계속됨"(§상세 3) 시나리오 자체가 어느 테스트에도 구성돼 있지 않다.
  - 제안:
    1. `lockNonTerminalExecutionRow`/`updateExecutionStatus` 의 linkedNodeExec 분기·else 분기 guarded SQL 이 `opts.allowRetryReentry` 를 실제로 전달받아, "FAILED 이면서 목표가 RUNNING(retry 재진입)" 케이스를 조건에 포함하도록 SQL 자체를 확장한다(예: `status IN (...) OR (status = 'failed' AND $allowRetryReentry)`, 파라미터 바인딩).
    2. `reparkAiResumeTurn` 의 재-park 경로도 retry 재진입 중 대화가 계속되는 경우를 위해 상태머신에 `FAILED→WAITING_FOR_INPUT` opt-in 전이를 추가하고 그 opts 를 실제로 전파해야 한다(현재는 opt-in 자체가 없음).
    3. 위 수정 후 **실 Postgres(testcontainers 등) 기반 e2e** 로 "retry 재진입이 실제로 RUNNING 으로 persist 되는지" + "재실행 turn 이 계속되는 경우 재-park 가 정상 동작하는지" 둘 다 검증할 것 — 이번 조사로 mock 기반 단위 테스트 3종 전부가 이 클래스의 결함을 구조적으로 검출할 수 없음이 확인됐다.
    4. 본 리뷰 대상 파일(`retry-turn.service.ts`)만으로는 고칠 수 없는 결함이다(근본 수정은 `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`state/state-machine.ts`) — 다만 `applyRetryLastTurn`/`retryLastTurn` 이 그 위에 쌓은 2차 원자 claim·guarded finalize 전체가 이 전이의 성공을 전제하므로, 이 파일의 "재진입 구현 완료" 서술(§JSDoc)이 현재 정확하지 않을 가능성이 높다.

- **[WARNING]** 위 CRITICAL 을 가리는 테스트 가정 — 3개 spec 파일 모두 "허용됨" 을 검증 없는 기본값으로 mock.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:418-436`, `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:249-251,269,16955-16966`.
  - 상세: `updateExecutionStatus`/`lockNonTerminalExecutionRow` 의 FOR UPDATE 잠금 mock 이 실제 SQL WHERE 조건(`status IN (...)`)을 전혀 평가하지 않고 항상 "성공"을 반환하도록 하드코딩돼 있다. mutation 검증(`review/code/2026/07/27/03_14_01/RESOLUTION.md`)은 "가드를 항상 통과시키면 RED" 는 확인했지만, 이는 "가드가 있어야 할 곳에서 없으면 걸린다"는 반대 방향만 검증할 뿐 "가드가 정당한 예외 케이스까지 과잉 차단하는가"는 검출하지 못하는 종류의 mutation 이다.
  - 제안: 근본 수정과 함께 (1) retry 재진입의 replay turn 이 `ended:false` 로 계속되는 시나리오의 통합 테스트, (2) 잠금 조건이 실제 status 값을 평가하는 좀 더 사실적인 fake DataSource(또는 실 Postgres 기반 e2e)를 추가해 재발을 방지할 것.

- **[INFO]** 리뷰 대상 두 파일 자체가 새로 도입한 동시성 프리미티브는 견고하며 데드락 위험도 없음.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538-552`(`claimSpawnedRetryRow`), `:573-678`(`finalizeGuarded`).
  - 상세: `claimSpawnedRetryRow`(`jsonb_exists(input_data,'_retryState') AND status='running'` 조건부 UPDATE)와 `finalizeGuarded`(재조회 후 관측 상태를 조건으로 건 guarded UPDATE, CANCELLED 타깃은 `COALESCE` 로 SELECT~UPDATE 창을 재평가)는 각각 정상적인 CAS/OCC 패턴이다. 매 트랜잭션이 단일 행에 대해서만 조건부로 잠그거나 쓰며, 여러 락을 중첩·역순으로 취득하는 경로가 없어 데드락 가능성은 발견되지 않았다. claim 실패/guarded UPDATE 0행 매칭을 원인 불문 discard(또는 skip)로 통일한 설계도 "살아있는 작업을 죽이는 능동적 피해" 보다 "이론적 orphan row" 를 택한다는 트레이드오프가 JSDoc 에 일관되게 명시돼 있다(`plan/in-progress/retry-turn-terminal-guard.md` 코드 표 #15 로 이미 추적 중).
  - 제안: 없음(참고용 확인 — 조치 불요).

## 요약

리뷰 대상 두 파일(`retry-turn.service.ts`/`.spec.ts`) 자체가 6~7 라운드에 걸쳐 하드닝한 2차 원자 claim(`claimSpawnedRetryRow`)과 guarded terminal 전이(`finalizeGuarded`)는 CAS/OCC 관점에서 견고하고 데드락 위험도 없다. 그러나 이 파일이 재진입의 핵심으로 전제하는 "Execution FAILED→RUNNING 전이는 `finalizeAiNode` 가 담당한다"는 불변식을, 그 실제 구현(`ai-turn-orchestrator.service.ts` → `execution-engine.service.ts` 의 `updateExecutionStatus`/`lockNonTerminalExecutionRow`)이 지키지 못한다 — 원자성 가드가 참조하는 `NON_TERMINAL_STATUSES_SQL` 상수가 `FAILED` 를 무조건 배제해, 상태머신이 명시적으로 허용한 `allowRetryReentry` opt-in 예외를 SQL 레벨에서 절대 통과시키지 못한다. 그 결과 재실행 turn 이 즉시 끝나면 "동시 취소로 오판"돼 spawn 된 NodeExecution 이 CANCELLED 로 마킹되고, turn 이 계속되면(가장 흔한 케이스) 상태머신이 동기적으로 throw 한다. 두 경로 모두 실제 동시성 없이 매번 재현되는 결정적 결함이며, 세 spec 파일(`retry-turn.service.spec.ts`/`ai-turn-orchestrator.service.spec.ts`/`execution-engine.service.spec.ts`) 전부가 이 가드를 "기본 성공"으로 하드코딩 mock 해 은폐하고 있음을 실행 확인했다(`npx jest execution-engine.service.spec.ts -t "applyRetryLastTurn"` 8/8 PASS). 근본 수정은 이 두 파일 밖(`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`state/state-machine.ts`)에서 필요하지만, 그 수정 없이는 이 리뷰가 검증한 원자적 claim·guarded finalize 전체가 "성공적으로 도달하지 못하는 코드 경로"를 보호하고 있을 가능성이 높다.

## 위험도

CRITICAL
