# 동시성(Concurrency) 코드 리뷰

## 컨텍스트

리뷰 대상 5개 파일은 diff 가 아니라 전체 파일 컨텍스트로 제공됐다. `git diff
71ce6c12b..HEAD`(origin/main 대비 merge-base)로 실제 변경분을 확인한 결과, 이번
누적 diff(8R~10R)의 실질 코드 변경은 `execution.retry_last_turn` 재진입의 짝 전이
(`FAILED → RUNNING` / `FAILED → WAITING_FOR_INPUT`)가 상태머신(`allowRetryReentry`
opt-in)에서는 허용되는데 DB 가드(`lockNonTerminalExecutionRow` FOR UPDATE 조회 +
`updateExecutionStatus` else 분기 guarded UPDATE)가 그 opt-in 을 SQL 상수까지
반영하지 못해 **항상 0행**이었던 결함(8R CRITICAL)과, 그 opt-in 전파 배선 자체가
무검증이었던 잔여(9R/10R CRITICAL, `reparkAiResumeTurn` seam)를 닫는 작업이다.
`retry-turn.service.ts` 는 이 구간에서 `RETRY_STATE_KEY` 상수화·`claimSpawnedRetryRow`
원자 claim(이전 6R/7R 라운드 산물)만 컨텍스트로 포함돼 있고 이번 8R~10R diff 자체의
신규 변경은 아니다.

## 발견사항

- **[WARNING]** `retry_last_turn` 재진입이 아직 활성 중인 형제 `Parallel` 브랜치와
  **동일한 live `ExecutionContext` 객체**를 공유·mutate 할 수 있는 경로가 이번 opts
  전파 완성으로 실제로 도달 가능해졌다 — `finalizeAiNode` "RUNNING 유지" 분기의
  `allowRetryReentry` 전파(계층 배선 자체는 정상)가 전제로 삼는 "이 분기는 도달
  불가능한 방어 코드"라는 가정이 깨질 수 있는 구체적 시나리오.
  - 위치: `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:1596-1601`
    (`if (savedExecution.status === ExecutionStatus.RUNNING)` 분기의
    `tryLockActiveExecutionAndSaveNodeExec(executionId, nodeExec, allowRetryReentry ? {...} : undefined)`)
    / `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:1468-1476`
    (`rehydrateContext` — `this.contextService.getContext(execution.id)` 가 존재하면
    그대로 반환) / `codebase/backend/src/modules/execution-engine/context/execution-context.service.ts:81,199`
    (`contexts = new Map<string, ExecutionContext>()`, `getContext` 는 같은 참조 반환) /
    `codebase/backend/src/modules/execution-engine/containers/parallel-executor.ts:9-37`
    (`ParallelErrorPolicy = 'continue'`, branch-local `nodeOutputCache` 는 **shallow
    copy** 라 top-level 키는 격리돼도 값 객체는 부모와 참조 공유 — M-5 JSDoc 이 이미
    "위반 시 last-write-wins 비결정성" 을 경고).
  - 상세: `retryLastTurn`(WS 커맨드)은 개별 `NodeExecution.status===FAILED` 만 보고
    부모 `Execution.status` 를 검증하지 않는다(이미 `plan/in-progress/retry-turn-terminal-guard.md`
    #20 에 P2 defer 로 추적 중 — CANCELLED 케이스의 "spawn row 영구 orphan" 결과로
    기록됨). 같은 검증 공백의 **또 다른 갈래**가 있다: `ParallelErrorPolicy: 'continue'`
    로 실행되는 Parallel 노드의 한 브랜치 안 multi-turn AI Agent 노드가 retryable
    오류로 실패해 `_retryState` 를 보존한 채 종결돼도, 다른 브랜치들이 계속
    실행 중이면 부모 `Execution.status` 는 `running` 으로 남는다. 이 상태에서 사용자가
    `execution.retry_last_turn` 을 그 실패한 브랜치 노드에 호출하면:
    (1) `applyRetryLastTurn` → `rehydrateContext` 가 "live" 검사에서 `existing` 을
    그대로 반환 — 이 실행의 `ExecutionContext` 는 다른 브랜치들이 **바로 이 순간에도**
    참조·mutate 하고 있는 동일 객체다. (2) `resumeGraphAfterRetry` 가 이 공유 context 의
    `_executedNodes`/`nodeOutputCache`/`reachable` 을 직접 mutate 하며 downstream 을
    dispatch 한다 — Parallel 브랜치가 (M-5 JSDoc 이 명시하는) 공유 값 객체를 동시에
    mutate 하는 것과 동형의 race 다. (3) `finalizeAiNode` 는 `savedExecution.status
    === RUNNING` 이므로 정확히 리뷰 대상인 "RUNNING 유지" 분기(else 가 아님)로 들어가
    이번 PR 이 새로 스레딩한 `allowRetryReentry` 를 그 분기까지 전달한다 — 즉 이 PR 의
    opts 배선이 "도달 불가능해 보이는 방어 코드" 로 서술된 지점을 실제로 여는 구체적
    통로다. dev/test 에서는 `FREEZE_BRANCH_CACHE` 의 deep-freeze 가 공유 값 객체 mutate
    를 `TypeError` 로 표면화하지만(`parallel-executor.ts:36-37` — `NODE_ENV` allowlist),
    production 은 freeze 미적용이라 조용한 last-write-wins 만 남는다. **직접 재현하지는
    못했다** — multi-turn AI Agent 노드가 Parallel 브랜치 안에 배치된 실사용 케이스가
    존재하는지, retry 명령이 형제 브랜치 진행 중에 실제로 도달할 타이밍 창이 실무상
    얼마나 넓은지는 미검증이다. 다만 `retryLastTurn`/`finalizeAiNode` 코드 자체에는
    이를 막는 가드가 없고, `parallel-executor.ts` 자신의 M-5 JSDoc 이 "이 클래스의
    non-determinism 은 기계 강제가 없다" 고 이미 인정하고 있어 개연성은 낮지 않다.
  - 제안: 근본 조치는 `plan/in-progress/retry-turn-terminal-guard.md` #20 이 이미
    제안한 "`retryLastTurn` 1.5단계 — spawn 이전 `Execution.status === RUNNING/FAILED`
    등 명시 검증"과 **동일한 수정**으로 이 갈래도 함께 닫힌다(Parallel 형제가 살아있어
    `Execution.status==='running'` 인 경우도 그 검증에서 자연히 차단된다) — 별도
    수정이 필요하지 않다. 다만 #20 의 현재 서술(CANCELLED → 고아 NodeExecution 행)은
    이 "RUNNING(Parallel 형제 활성) → 공유 live context 동시 mutate" 갈래를 명시하지
    않으므로, 그 항목의 근거/우선순위 재검토 시 이 소비-사례를 함께 등재해 P2 우선순위
    산정에 반영할 것을 권고한다. 검증 방법으로는 "multi-turn AI Agent 노드를 Parallel
    브랜치 안에 두고, 한 브랜치는 retryable 오류로 종결시키고 나머지는 지연시킨 뒤
    `retry_last_turn` 을 호출 → `Execution.status` 실측" 통합 테스트 1건을 우선 추가해
    재현 가능성 자체를 먼저 확정할 것을 제안한다.

- **[INFO]** 전이 허용 여부의 이중 진실 소스(TS `state-machine.ts` 의
  `ALLOWED_TRANSITIONS`/`canTransition` vs SQL 문자열 상수
  `NON_TERMINAL_STATUSES_SQL`/`NON_TERMINAL_OR_FAILED_STATUSES_SQL`)가 동시성 가드
  자체의 정확성을 두 계층의 수동 동기화에 의존하게 만드는 구조는 이번 수정 이후에도
  구조적으로 남아 있다.
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:63-83`
    vs `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:513-543`.
  - 상세: 8R CRITICAL 자체가 "상태머신 계층은 opt-in 을 확장했는데 DB 가드 SQL 계층은
    안 따라갔다" 는 이 이중 소스 불일치였다 — 즉 **동시성 가드(FOR UPDATE 조회의 대상
    행 집합)의 정확성이 두 파일의 수동 동기화 없이는 깨질 수 있다는 사실이 이 PR
    자체로 실증됐다.** 이번 수정으로 재정합됐고(직접 계산 검증: `NON_TERMINAL_OR_FAILED_STATUSES_SQL`
    = `{pending, running, waiting_for_input, failed}`, `completed`/`cancelled` 는 opt-in
    여부와 무관하게 계속 제외) `database`/`architecture` 리뷰어도 독립적으로 동일하게
    확인했으나, 구조 자체(3rd opt-in 전이 추가 시 SQL 상수도 손으로 갱신해야 함)는
    `plan/in-progress/retry-turn-terminal-guard.md` #21 로 이미 P2 defer 추적 중이라
    신규 조치를 요구하지 않는다 — 동시성 관점에서 "가드의 정확성이 리팩터 규율에만
    의존" 한다는 리스크로 기록만 한다.

## 점검한 항목 중 이상 없음

- **opts 전파 완결성**: `applyRetryLastTurn({retryReentry:true})` →
  `processAiResumeTurn` → 4개 `reparkAiResumeTurn` 호출부 + `finalizeAiNode` 의
  `isFailed`/RUNNING-유지/else(RUNNING 재claim) 3개 분기 → `updateExecutionStatus`/
  `tryLockActiveExecutionAndSaveNodeExec` → `lockNonTerminalExecutionRow` 까지 직접
  코드 추적으로 전량 확인했다. 정상(비-retry) 경로(`handleAiResumeTurn`,
  `emitAiWaitingForInput`, 다른 `updateExecutionStatus` 호출부 10여 곳)는 모두
  `opts` 를 전달하지 않아 기존 FAILED 배제 동작이 그대로 유지된다 — 새 opt-in 이
  의도치 않게 넓어진 곳은 없다.
- **원자성(claim 순서)**: `claimSpawnedRetryRow`(`retry-turn.service.ts:538-552`)의
  `jsonb_exists(input_data, '_retryState') AND status='running'` 조건부 UPDATE 가
  "손상 판정" 보다 먼저 실행되도록 유지되고 있음을 확인(6R CRITICAL #1 재발 없음),
  claim 직후 `delete spawnedRow.inputData[RETRY_STATE_KEY]`(`:369`)로 in-memory ↔ DB
  동기화도 유지(6R CRITICAL #2 재발 없음). `retryState` 는 claim **이전**에 읽어
  두므로(값 복사, 참조 아님) 이후 delete 의 영향을 받지 않는다.
- **락 순서/데드락**: `updateExecutionStatus` 의 linkedNodeExec 분기(Execution FOR
  UPDATE → NodeExecution save)와 `claimResumeEntry`(NodeExecution UPDATE →
  Execution UPDATE, 별도 함수)가 명목상 반대 순서지만, 두 경로가 같은 (Execution,
  NodeExecution) 행 쌍을 겨냥하는 시점은 그 행의 라이프사이클상 항상 배타적이다
  (park 커밋 후에만 continuation 이 도착해 claim 이 가능하고, claim 커밋 후에만 다음
  park 가 가능) — 실제 동시 보유로 인한 순환 대기 경로를 찾지 못했다.
  `claimSpawnedRetryRow` 는 단일 UPDATE 문(암묵적 자동커밋)이라 이후 별도 트랜잭션과
  락을 동시에 보유하지 않는다.
- **assertTransition 의 fail-fast 특성**: DB 가드 이전에 실행되는
  `assertTransition`(in-memory `execution.status` 기준 동기 throw)은 stale 값을 볼 수
  있으나, 실제 동시성 결정은 항상 그 뒤의 조건부 UPDATE/FOR UPDATE 가 담당하므로
  in-memory 값의 신선도는 correctness 에 영향이 없다 — `finalizeGuarded`(변경
  없음, out of scope)가 이 패턴을 이미 문서화하고 있다.

## 요약

이번 diff(누적 8R~10R, HEAD `3c306d593`)가 고친 CRITICAL — retry 재진입 짝 전이가
DB 가드에서 opt-in 을 반영 못해 절대 persist 되지 않던 결함, 그리고 그 opt-in 배선
자체가 `reparkAiResumeTurn` seam 에서 무검증이던 잔여 — 은 직접 코드 추적 결과 4개
소비 지점(재-park, `finalizeAiNode` 의 세 분기) 전부에서 정확히 닫혔고, mutation
테스트로 그 배선이 잠겨 있음을 확인했다. 원자 claim(`claimSpawnedRetryRow`)의 순서·
in-memory 동기화도 이전 라운드 수정이 유지되고 있다. 다만 이 PR 이 완성한 opts 배선은
`finalizeAiNode` 의 "RUNNING 유지" 분기(자체 JSDoc 상 "도달 불가능해 보이는 방어
코드")를 실제로 열 수 있는 구체적 통로 하나를 남긴다 — `ParallelErrorPolicy: 'continue'`
로 형제 브랜치가 살아있는 동안 그 중 한 브랜치의 multi-turn AI 노드에 `retry_last_turn`
이 호출되면, `rehydrateContext` 가 형제 브랜치와 동일한 live `ExecutionContext` 를
재사용해 공유 가변 상태를 동시에 mutate 하게 된다. 재현하지는 못했으나 이는 이미
P2 로 추적 중인 `retryLastTurn` 의 "부모 Execution.status 미검증" 갭(#20)과 뿌리가
같고 같은 수정으로 함께 닫히므로, 별도 신규 조치보다는 그 defer 항목의 근거를
보강하는 형태로 반영을 권고한다. 그 외 opts 전파 완결성·claim 원자성·락 순서는
모두 이상 없음을 확인했다.

## 위험도

LOW
