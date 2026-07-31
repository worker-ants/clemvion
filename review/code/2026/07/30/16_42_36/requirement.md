# 요구사항(Requirement) 리뷰 — retry 재진입 DB 가드 수정 이후 10R

리뷰 대상: `state/state-machine.ts`, `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`,
`engine-driver.interface.ts`, `retry-turn.service.ts` (5개 파일). 현재 HEAD(`1838c6fec`)는 직전
두 라운드(8R `review/code/2026/07/30/12_56_04`, 9R `review/code/2026/07/30/15_33_04`)가 지적한
CRITICAL(DB 가드 opts 미전파)과 그 후속 WARNING/SPEC-DRIFT를 이미 커밋 두 개(`2ca44b769`,
`1838c6fec`)로 반영한 상태다.

## 검증 방법 (실측)

- 프롬프트의 "전체 파일 컨텍스트"가 `execution-engine.service.ts`는 1225/8582줄, `ai-turn-orchestrator.service.ts`는
  503/1180줄에서 잘려 있어(후자는 실제로는 1657줄 — 프롬프트 생성 시점 스냅샷과 표시 라인 수 자체가
  다름), 두 파일 모두 `Read`로 전체를 직접 열어 `updateExecutionStatus`/`lockNonTerminalExecutionRow`/
  `tryLockActiveExecutionAndSaveNodeExec`(execution-engine.service.ts:8146-8496)와 `finalizeAiNode`
  전체(ai-turn-orchestrator.service.ts:1399-1656)를 line-level로 확인했다 — 프롬프트만으로는 이번 diff의
  핵심 구현이 아예 보이지 않는다.
- `git merge-base main HEAD` 기준 `git diff --stat`으로 실제 변경 파일 10개(코드 5 + spec 3 + test 2
  카운트 중복)를 확정하고, `state-machine.ts`/`execution-engine.service.ts`/`ai-turn-orchestrator.service.ts`/
  `engine-driver.interface.ts`/`retry-turn.service.ts` 전체 diff를 hunk 단위로 재확인.
- 8R/9R 산출물(`SUMMARY.md`, `requirement.md`, `concurrency.md`)과 `plan/in-progress/retry-turn-terminal-guard.md`
  전문을 읽어, 이전에 open 이었던 항목이 이번 커밋으로 실제로 닫혔는지 코드/스펙 diff와 대조.
- `retryLastTurn`→`applyRetryLastTurn`→`processAiResumeTurn`→`reparkAiResumeTurn`/`finalizeAiNode`→
  `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`→`lockNonTerminalExecutionRow` 전체
  호출 체인을 다시 한번 line-level로 수동 시뮬레이션 — 이번엔 "Execution 이 실제로 FAILED 가 아닌 경우"
  라는 새 축으로 반례를 구성.
- `spec/5-system/4-execution-engine.md` §1.1, `spec/5-system/6-websocket-protocol.md` §4.2,
  `spec/4-nodes/3-ai/1-ai-agent.md` §7.9/§12.8 을 `grep -n`/`Read`로 열어 line-level 대조.
- `state-machine.spec.ts`/`execution-engine.service.spec.ts`(diff 전체)/`ai-turn-orchestrator.service.spec.ts`/
  `retry-turn.service.spec.ts` 를 읽어 새 axis(Execution 상태 불일치)가 실제로 어느 테스트 계층에서도
  구성되지 않음을 확인(각 spec 파일이 `driver`/`processAiResumeTurn`을 mock 하는 경계를 추적).

## 발견사항

- **[WARNING]** `retryLastTurn`이 spec이 명시한 두 조건 중 "Execution 이 retry 진입 가능 상태" 검증을
  구현하지 않는다 — Execution 이 실제로는 `cancelled` 인 채 `_retryState`가 살아있는 NodeExecution 에
  대해 retry 를 시도하면, 상태머신 예외가 아니라 spawn 된 NodeExecution 이 영구 `RUNNING` 으로 고아가 된다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:130-148`(`retryLastTurn` —
    `nodeExec.status !== FAILED` 만 검증, `Execution.status` 는 전혀 로드/검증하지 않음), `:373-390`
    (`applyRetryLastTurn` 이 `execution`을 `findOneBy` 로 로드한 뒤에도 존재 여부(`!execution`)만 확인하고
    `execution.status` 값은 검증하지 않음); 메커니즘 소재지는
    `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8360`
    (`updateExecutionStatus`의 `assertTransition(execution.status, newStatus, opts)` — DB 가드보다
    **먼저**, in-memory 값만으로 무조건 호출됨)와
    `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:453-458`
    (`reparkAiResumeTurn`), `:1596-1629`(`finalizeAiNode` COMPLETED 분기의 else — "RUNNING 재claim").
  - 상세: spec은 `INVALID_EXECUTION_STATE`를 "대상 NodeExecution 이 FAILED 상태가 아니거나 **Execution 이
    retry 진입 가능 상태가 아님**" 두 조건의 OR 로 명시한다(`spec/5-system/6-websocket-protocol.md:368`).
    그러나 `retryLastTurn`의 실제 검증 순서(JSDoc "검증 순서" 1~6, `:108-114`)는 NodeExecution 상태만
    확인하고 Execution 자체는 한 번도 조회하지 않는다.
    이 갭이 실제로 열리는 경로: AI multi-turn 노드가 retryable 오류로 실패하면 `finalizeAiNode`의
    `isFailed` 분기가 `tryLockActiveExecutionAndSaveNodeExec`(opts 없음, `NON_TERMINAL_STATUSES_SQL`)로
    Execution 이 아직 RUNNING 임을 확인한 뒤 NodeExecution 을 `FAILED`+`_retryState` 로 커밋하고, 이어서
    `NODE_FAILED` WS emit 을 `await` 한 다음에야 sentinel `Error` 를 throw 한다 — 이 throw 가 호출
    스택을 타고 `runExecution`의 top-level catch(`finalizeFailedExecution`)에 도달해 **Execution 을
    별도 트랜잭션으로** `FAILED` 로 옮기는 것은 이 커밋 두 단계 뒤다(같은 파일 JSDoc, "2026-05-19 —
    FAILED 분기에서 Execution.status 전이 … 는 runExecution top-level catch 에 위임한다"). 즉
    "NodeExecution=FAILED+_retryState 커밋"과 "Execution=FAILED 커밋"은 원자적이지 않은 별개
    트랜잭션이다. 그 사이(WS emit 등 비동기 구간)에 동시 `stop()`(`RUNNING`/`PENDING` 대상 조건부
    UPDATE)이 먼저 도착하면, `finalizeFailedExecution`의 guarded UPDATE 는 0행 매칭으로 조용히
    스킵되고 Execution 은 `cancelled` 로 안착한다 — 반면 NodeExecution 은 이미 `FAILED`+`_retryState`
    로 커밋된 뒤라 그대로 남는다. 이 코드베이스는 "LLM 호출 도중 Stop" 레이스를 전 파일에 걸쳐 반복적으로
    CRITICAL 급으로 취급해 온 전례가 있어(예: 바로 이 PR 이 고친 8R CRITICAL 자체, `finalizeFailedExecution`/
    `finalizeCancelledExecution` JSDoc 등) 이 레이스 자체는 새로 발명한 가정이 아니다.
    이 (NodeExecution=FAILED-with-`_retryState`, Execution=`cancelled`) 조합이 일단 DB 에 안착하면,
    이후의 `retryLastTurn`/`applyRetryLastTurn` 실행은 더 이상 "레이스"가 아니라 **결정적**이다:
    `applyRetryLastTurn`이 로드하는 `execution.status`는 정확히 `'cancelled'`이고, 재진입 턴이 정상
    종료(`finalizeAiNode('COMPLETED', {retryReentry:true})`)되면 `savedExecution.status !== RUNNING`
    이라 else 분기로 진입해 `updateExecutionStatus(savedExecution, RUNNING, nodeExec,
    {allowRetryReentry:true})`를 호출한다. 이 함수의 **첫 줄**이 DB 조회보다 먼저
    `assertTransition('cancelled', 'running', {allowRetryReentry:true})`를 실행하는데,
    `canTransition`의 opt-in 특례는 `from === FAILED` 일 때만 매치하므로(`state-machine.ts:72-77`)
    `cancelled`에는 적용되지 않고 `ALLOWED_TRANSITIONS['cancelled']=[]` 로 **동기적으로 throw**한다.
    이 throw 는 `updateExecutionStatus` 내부(DB 가드 진입 전)에서 발생하므로, 짝
    `assertLinkedTransitionApplied`(nodeExec 를 `CANCELLED`로 재마킹 + `ExecutionCancelledError` 전파)
    호출부에 **도달하지 못한 채** 그대로 위로 전파된다 — `reparkAiResumeTurn`(:453-458, turn 이 계속되는
    경우)도 동일한 구조라 동일하게 영향받는다.
    이 일반 `Error`는 `applyRetryLastTurn`의 catch(`retry-turn.service.ts:477-478`)에서
    `error instanceof ExecutionCancelledError` 가 `false` 로 판정돼 `failRetryExecution`이 `FAILED`
    목표로 `finalizeGuarded`를 호출하지만, 그 안에서 `live.status`(재조회, `'cancelled'`)와
    `target('failed')`이 달라 `canTransition('cancelled','failed')`도 `false` 이므로 저장/emit 없이
    조용히 `false` 를 반환한다(`retry-turn.service.ts:660-666`) — 그 결과 Execution 자체는 (다행히)
    `cancelled` 로 올바르게 남지만, **spawn 된 NodeExecution row 를 terminal 로 마킹하는 코드 경로가
    어디에도 실행되지 않아 그 row 는 영구 `RUNNING`으로 고아가 된다** — UI 타임라인에 종료 없는 노드가
    영구히 남고, `NODE_STARTED` 는 이미 emit 됐으나 이후 아무 이벤트도 오지 않는 "조용히 멈춘" 사용자
    경험이 된다. `failRetryExecution`은 `execution`만 받고 `spawnedRow`를 모르므로 이 함수로도 보완되지
    않는다.
    이 결함 클래스는 `plan/in-progress/retry-turn-terminal-guard.md` #15(`claimSpawnedRetryRow`
    discard 이후의 orphan RUNNING row 백스톱 갭)와 증상은 같지만(orphan RUNNING NodeExecution),
    트리거 지점이 다르다 — #15 는 2차 claim(`claimSpawnedRetryRow`) 실패 시 즉시 discard 하는 경로이고,
    본 항목은 claim 성공 이후 turn 처리가 끝나는 시점에 `assertTransition`이 throw 하며 우회하는
    경로다. 8R/9R 두 라운드가 정확히 이 `assertTransition`-throw-vs-graceful-false 경계를 다뤘지만
    (`from===FAILED`인 케이스만) 다뤘고, `from`이 실제로는 `CANCELLED`인 이 반례는 다루지 않았다 —
    `state-machine.spec.ts`의 "should not let retry opt-in widen other transitions (W5)" 테스트가
    `canTransition(CANCELLED, RUNNING, {allowRetryReentry:true}) === false` 를 검증하지만, 이는
    상태머신 자체가 **올바르게 거부**한다는 것만 확인할 뿐, 그 거부가 **호출부에서 우아하게 처리되는지**는
    아무 테스트도 다루지 않는다(`retry-turn.service.spec.ts`/`ai-turn-orchestrator.service.spec.ts` 는
    `driver.updateExecutionStatus`를 통째로 mock 하므로 실제 `assertTransition` throw 자체가 이 두 spec
    파일에서는 구조적으로 재현될 수 없다).
  - 제안: (1) 가장 값싸고 spec 과 정합적인 수정 — `retryLastTurn`에 `Execution`을 로드해
    `execution.status === ExecutionStatus.FAILED`를 명시적으로 검증하는 단계를 추가(step 1.5),
    위반 시 `InvalidExecutionStateError`(`INVALID_EXECUTION_STATE`)로 스폰 이전에 거부 — spec 문구
    ("Execution 이 retry 진입 가능 상태가 아님")를 코드가 실제로 구현하게 된다. 이렇게 하면 위 레이스가
    지나간 뒤(안착 이후)의 retry 시도는 스폰 자체가 일어나지 않아 고아 row 도 생기지 않는다.
    (2) 방어적 하드닝 — `finalizeAiNode`의 COMPLETED-else 분기와 `reparkAiResumeTurn`이
    `updateExecutionStatus` 호출을 try/catch 로 감싸, `assertTransition`이 던지는 일반 `Error`도
    `shouldProceed===false`와 동일하게 `assertLinkedTransitionApplied` 경로(nodeExec CANCELLED 마킹 +
    `ExecutionCancelledError` 재던지기)로 흡수하도록 통일 — "예상치 못한 시작 상태" 전반에 대한
    일반적 안전망이 된다. (1)이 근본 수정이고 (2)는 방어 심층화.

- **[INFO]** (확인, 결함 아님) 9R `requirement.md`가 지적한 "turn 계속(re-park) 경로의 회귀 테스트
  부재" WARNING — 이번 커밋(`1838c6fec`)에서 **다른 테스트 계층으로 해소**됨을 확인.
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:5115-5211`
    (신규 4건 — opt-in 시 FAILED→WAITING_FOR_INPUT persist / opt-in 없으면 미persist / else 분기
    opt-in 시 `'failed'` 포함 / opt-in 없으면 미포함).
  - 상세: 9R 은 `applyRetryLastTurn` 통합 스위트에 `processReturn: {status:'waiting', ended:false}`
    fixture 를 추가해 전체 경로(handler→...→DB persist)를 통합 레벨로 검증할 것을 권고했으나, 이번
    커밋의 커밋 메시지가 명시하듯 그 통합 재현은 "핸들러 반환 형태를 정확히 맞춰야 해 FOR UPDATE
    잠금에 도달조차 못했다"는 이유로 철회되고, 대신 `updateExecutionStatus`를 직접 호출하는 focused
    단위 테스트로 대체됐다. mutation(`reparkAiResumeTurn`의 opts 전달 제거)으로 신규 테스트 2건 포함
    14건 RED 를 확인했다는 커밋 메시지 근거와, 실제 테스트 내용(`dbExecutionStatus`를 실제 SQL
    `status IN (...)` 문자열과 대조하는 honest mock)을 직접 읽어 확인한 결과, "약한 mock 이 회귀를
    은폐"하던 근본 원인은 해소됐다. 통합 레벨 fixture 부재 자체는 여전하지만(더 이상 신규 결함 아님 —
    이 리스크는 위 WARNING 항목이 지적하는 "Execution 상태 자체가 다른 경우"의 미검증과는 별개 축),
    9R 이 우려한 "회귀를 실제로 못 잡는다"는 문제는 해결됐다고 판단.
  - 제안: 없음(해소 확인). 통합 fixture 추가는 낮은 우선순위로 남겨도 무방.

- **[INFO]** (확인, 결함 아님) 9R `requirement.md`의 **[SPEC-DRIFT]** — `FAILED → WAITING_FOR_INPUT`
  opt-in 전이가 spec 3개 문서(상태표·WS 프로토콜·AI Agent 노드 스펙)에 반영되지 않았던 건 — 이번
  커밋(`1838c6fec`)에서 line-level로 정확히 반영됨을 직접 대조 확인.
  - 위치: `spec/5-system/4-execution-engine.md:46-47`(ASCII 다이어그램에 `waiting_for_input` 엣지
    추가), `:80`(전이표에 `failed | waiting_for_input` 행 신설, 동기 throw 실패 양상까지 명시);
    `spec/5-system/6-websocket-protocol.md:376`("재진입한 turn 이 대화를 끝내지 않으면 … re-park"
    문단 추가); `spec/4-nodes/3-ai/1-ai-agent.md:1302-1308`(§12.8 상단에 "재진입 turn 이 계속되는
    경우" 블록쿼트 신설, §1.1 앵커까지 정확히 상호 참조).
  - 상세: 9R 이 요구한 "코드는 유지 + spec 반영" 방향 그대로, 코드 변경 없이 spec 3개 문서만 갱신됐고
    (`git show --stat 1838c6fec` 로 spec 3개 + 코드는 테스트 파일만 확인), 각 문단의 문구가 실제
    코드 주석(`state-machine.ts`의 "turn 즉시 종료"/"turn 계속 — re-park" 표현)과 동일 어휘를 쓴다 —
    spec-코드 어휘 drift 도 없다.
  - 제안: 없음(해소 확인).

- **[TODO/FIXME 점검]** 5개 리뷰 대상 파일 전체 `grep -n "TODO\|FIXME\|HACK\|XXX"` 0건 — 미완성
  작업 마커 없음.

## 정합성 확인 (문제 없음으로 판단된 항목)

- `RetryLastTurnError`(`workflow-errors.ts:147-187`)의 `notFound`/`notRetryable`/`tooEarly` 3개 팩토리가
  `spec/5-system/6-websocket-protocol.md:365-368`의 `RETRY_STATE_NOT_FOUND`/`NODE_NOT_RETRYABLE`/
  `RETRY_TOO_EARLY`/`INVALID_EXECUTION_STATE` 4개 코드와 정확히 1:1 대응.
- `retryLastTurn`의 검증 순서(JSDoc 1~6)가 실제 코드 순서와 정확히 일치(ownership→FAILED→retryable→
  `_retryState`+TTL→`retryAfterSec`→atomic consume+spawn).
- `NON_TERMINAL_OR_FAILED_STATUSES_SQL`이 opt-in 시에도 `COMPLETED`/`CANCELLED`는 여전히 배제함을
  계산식으로 재확인 — "실패 종결 실행의 우발적 부활 차단" 불변식은 유지.
- `handleAiResumeTurn`(일반 §7.5 rehydration, 비-retry)이 `processAiResumeTurn`에 `opts`를 전혀
  전달하지 않음을 재확인 — retry 전용 opt-in 이 일반 재개 경로로 새는 경로는 없음.
- `RETRY_STATE_KEY` 상수화 이후 `_retryState` 리터럴 잔존 여부를 코드베이스 전체 grep 으로 재확인한
  결과, 남은 리터럴은 전부 JSDoc/타입 필드 선언(`_retryState?: unknown`)/dot-notation 프로퍼티 접근뿐
  — 상수가 노리는 "raw SQL 문자열 4곳 이상 중복"에 해당하는 잔존 사례는 없음.

## 요약

이번 HEAD(`1838c6fec`)는 8R CRITICAL(DB 가드가 `allowRetryReentry` opt-in을 반영하지 못해 retry
재진입 짝 전이가 구조적으로 절대 persist 될 수 없던 결함)을 4개 지점(상태머신·`lockNonTerminalExecutionRow`·
`updateExecutionStatus` 두 분기·`tryLockActiveExecutionAndSaveNodeExec`)에서 정확히 수정했고, 9R이
지적한 회귀 테스트 부재와 SPEC-DRIFT도 각각 focused 단위 테스트(mutation 검증됨)와 spec 3개 문서
갱신으로 해소했다 — 두 항목 모두 직접 대조해 확인했다. 다만 이번 라운드에서 새로 발견한 결함이 하나
있다: `retryLastTurn`이 spec이 명시한 "Execution 이 retry 진입 가능 상태" 검증을 구현하지 않아,
NodeExecution 은 FAILED-with-`_retryState` 지만 Execution 은 (그 사이 동시 Stop 레이스로) 실제로는
`cancelled`인 드문 사전 상태에서 retry 를 시도하면 `assertTransition`이 DB 가드 이전에 동기 throw 해
`assertLinkedTransitionApplied`의 우아한 정리 경로를 우회하고, spawn 된 NodeExecution 이 영구
`RUNNING` 고아로 남는다. Execution 자신의 종결 상태는 (다행히) 손상되지 않고 DB 저장/이벤트 발행도
일어나지 않지만(내부 도달 불가 코드 경로), 고아 NodeExecution row 는 실제로 남는다 — 이미 plan 에
등재된 "claim discard 백스톱 갭"(#15)과 증상은 같으나 트리거가 다른, 이번 라운드의 신규 축이다. spec
이 명시한 검증을 코드가 구현하도록 하는 좁은 수정으로 근본적으로 닫을 수 있다.

## 위험도

MEDIUM
