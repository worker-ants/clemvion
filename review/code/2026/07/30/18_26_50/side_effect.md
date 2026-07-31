# 부작용(Side Effect) Review

## 리뷰 범위

`origin/main`(merge-base `71ce6c12b`) 대비 현재 브랜치(HEAD `0f0bdabe8`)까지의 누적 diff 3개 파일:

- `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`
- `codebase/backend/src/modules/execution-engine/state/state-machine.ts`

`retry-turn.service.ts` 의 `finalizeGuarded`/`completeRetryExecution`/`failRetryExecution`/
`resumeGraphAfterRetry` 는 이번 diff 에서 불변(문맥으로만 포함) — 이미 `origin/main` 에 병합된
선행 라운드(1R~7R, PR #1024)의 결과물이라 이번 회차의 부작용 분석 대상에서 제외했다. 실제 diff 는
(1) `RetryEngineDriver`/`AiTurnEngineDriver` 의 `opts` 파라미터 추가 + JSDoc, (2) `state-machine.ts`
의 opt-in 허용 전이 확장(`FAILED→WAITING_FOR_INPUT` 추가), (3) `retry-turn.service.ts` 의 2차 원자
claim(`claimSpawnedRetryRow`) 신설 + 관련 리팩터로 구성된다. `plan/in-progress/retry-turn-terminal-guard.md`
가 11라운드에 걸친 발견·처분 이력을 이미 상세 추적 중이므로, 이번 리뷰는 그 이력과 대조해 **신규**
부작용만 변별하는 데 집중했다.

## 발견사항

- **[INFO]** `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec` 시그니처에 optional
  `opts?: { allowRetryReentry?: boolean }` 파라미터 추가 (각각 4번째/3번째, 맨 끝 위치)
  - 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:88`,
    `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts:226`
  - 상세: 두 메서드 모두 마지막 위치에 optional param 을 추가해 기존 3-arg/2-arg 호출부가 그대로
    컴파일·동작한다. 직접 확인 결과 `allowRetryReentry` 를 실제로 넘기는 곳은
    `ai-turn-orchestrator.service.ts` 의 retry 재진입 전용 경로(`reparkAiResumeTurn` 1곳 +
    `tryLockActiveExecutionAndSaveNodeExec` 호출 2곳)뿐이고, `form-interaction.service.ts:110,325`
    / `button-interaction.service.ts:395,567` 의 `updateExecutionStatus` 호출은 여전히 3-arg 그대로라
    `opts=undefined` → 종전과 동일하게 FAILED 배제. Breaking change 없음.
  - 제안: 없음(현재 상태로 안전, 추가 조치 불필요).

- **[INFO]** `canTransition`/`assertTransition` 의 `allowRetryReentry` opt-in 허용 전이가
  `FAILED→RUNNING` 단일에서 `FAILED→RUNNING ∨ FAILED→WAITING_FOR_INPUT` 로 확장
  - 위치: `codebase/backend/src/modules/execution-engine/state/state-machine.ts:72-77`
    (일반 표는 `state-machine.ts:37` `ALLOWED_TRANSITIONS[FAILED] = []` 로 불변)
  - 상세: opt-in 없는 일반 호출(Form/Button interaction 등)은 `ALLOWED_TRANSITIONS[FAILED]=[]` 가
    그대로 유지돼 영향이 없다. `allowRetryReentry:true` 를 실제로 넘기는 호출부는
    `ai-turn-orchestrator.service.ts` 의 retry 재진입 전용 경로뿐임을 grep 으로 확인해, 확장된 허용
    범위가 의도치 않게 다른 목적의 호출로 새어나가지 않음을 검증했다. `state-machine.spec.ts` 에
    양방향(정방향 허용 + 역방향 과잉개방 차단) mutation 테스트가 존재.
  - 제안: 없음.

- **[INFO]** `claimSpawnedRetryRow` 신설 — `applyRetryLastTurn` 재진입 경로에 새 원자 DB UPDATE
  (2차 claim) 도입
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538-552`
    (호출부 `retry-turn.service.ts:331`)
  - 상세: 이 PR 의 핵심 목적에 해당하는 의도된 신규 DB side effect. `.where('id = :id', …)` 로 대상
    row 를 정확히 1건으로 한정하고, `status='running' AND jsonb_exists(input_data,'_retryState')`
    두 조건을 CAS 로 모두 요구한다. 삽입 위치·in-memory 동기화 관련 CRITICAL 2건이 이미 6R
    (`review/code/2026/07/28/20_32_57`)에서 발견·수정됐고 현재 코드는 그 수정 상태(claim → 손상판정
    → in-memory delete 순서)를 그대로 보존한다. `status` 컬럼 자체는 건드리지 않아 JSDoc 계약과 일치.
  - 제안: 없음.

- **[INFO]** `applyRetryLastTurn` 의 "claim 성공 후 in-memory `_retryState` 부재" 방어 분기 및
  "claim 실패" 분기가, 과거엔 `spawnedRow` 를 FAILED 로 마킹해 `save()` 했으나 현재는 로그만 남기고
  아무 것도 persist 하지 않음 — **제거된 side effect**
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:332-343`(claim 실패
    분기), `:344-355`(in-memory 부재 분기)
  - 상세: "살아있는 row 를 오판해 FAILED 로 죽이던" CRITICAL(6R)을 닫기 위한 의도된 트레이드오프다.
    다만 그 대가로 `claimSpawnedRetryRow` 가 discard 하는 경로는 spawn row 를 어떤 상태로도 전이시키지
    않아, 크래시 등으로 그 row 를 실제로 처리 중이던 delivery 가 사라지면 해당 spawn row 가 RUNNING
    orphan 으로 영구 잔류할 수 있다(타임라인/진행률 집계 오염). 이는 `plan/in-progress/retry-turn-terminal-guard.md`
    §코드 표 #15(P2, 6R 실측)에 "`recoverStuckExecutions` 백스톱이 이 경로엔 닿지 않는다"는 근거와
    함께 이미 등재·추적 중임을 확인했다 — 이번 리뷰에서 발견된 신규 결함이 아니다.
  - 제안: 별도 조치 불필요(이미 등재/추적됨, plan 문서 P2 항목 참조). 향후 이 경로 전용 백스톱을
    신설할 경우 해당 plan 항목과 연계할 것.

- **[INFO]** `NODE_STARTED` WS 이벤트의 `input` 페이로드가 `_retryState` 를 더 이상 포함하지 않음
  (claim 직후 `delete` 로 인한 부수효과) — 공개 이벤트 계약(카테고리 8, 이벤트/콜백) 변경
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:369`(delete 실행),
    `retry-turn.service.ts:435-450`(emitNode 호출, `input: spawnedRow.inputData`)
  - 상세: WS 클라이언트로 나가는 `NODE_STARTED.input` payload shape 이 바뀌었다(이전엔 `_retryState`
    key 가 포함될 수 있었음 → 이제 항상 미포함). spec 의 "internal 필드 비노출" 원칙에 부합하는
    의도된 변경이며, `retry-turn.service.spec.ts:745-764` (`NODE_STARTED emit 의 input payload 는
    _retryState 를 포함하지 않는다 (W6)`) 회귀 테스트로 이미 고정돼 있음을 직접 확인했다.
  - 제안: 없음.

- **[INFO]** 2차 claim 이 entity 조회(`Promise.all([executionRepository.findOneBy, nodeRepository.findOneBy])`)
  · `rehydrateContext` · `buildRetryReentryState` · `setNodeOutput` · `emitNode` 보다 앞으로 이동하면서,
  "claim 성공 후 이 구간에서 예외/크래시가 나면 `_retryState` 는 이미 소비됐는데 어떤 후속 조치도
  없다"는 트레이드오프의 적용 범위가 넓어짐
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:331`(claim) ~ `:452`(try 진입)
  - 상세: 이 재배치 자체는 6R CRITICAL #1 해소에 필수적이었고(claim 이 손상판정보다 먼저 실행돼야
    함), 신규 확인은 아니다 — `plan/in-progress/retry-turn-terminal-guard.md` §코드 표 #17(6R
    side_effect WARNING #4, P3, "claim 전진 배치로 크래시 트레이드오프 실제 적용 범위가 넓어짐")에
    이미 동일 관찰이 등재돼 defer 처리돼 있음을 확인했다.
  - 제안: 없음(이미 등재된 P3 후속 — 이번 라운드에서 추가 조치 불필요).

- **[INFO]** `RETRY_STATE_KEY` 모듈 스코프 `const` 도입
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:42`
  - 상세: export 되지 않는 파일-로컬 불변 상수이며 전역 상태가 아니다. 4곳 이상 흩어져 있던 raw SQL
    리터럴(`'_retryState'`)과 TS 프로퍼티 접근을 단일 진실로 통합하는 순수 리팩터 — 치환 후 SQL
    문자열이 리터럴과 동일함을 확인해 동작 변화 없음을 검증했다.
  - 제안: 없음.

## 요약

이번 회차 diff(`engine-driver.interface.ts` 시그니처 확장, `state-machine.ts` opt-in 범위 확장,
`retry-turn.service.ts` 의 2차 원자 claim 도입)가 유발하는 부작용은 전부 **의도된 것이며 이미 이전
라운드(6R~7R)에서 발견·수정되었거나 `plan/in-progress/retry-turn-terminal-guard.md` 에 근거와 함께
명시적으로 등재·추적 중인 항목**이다. 두 인터페이스 시그니처 변경은 optional/맨-끝-파라미터라 기존
호출부(Form/Button interaction) 전원이 영향받지 않음을 직접 확인했고, `allowRetryReentry` opt-in 확장은
grep 으로 실제 호출부가 retry 재진입 경로로만 좁게 한정됨을 검증했다. 관측 가능한 신규 부작용은
`NODE_STARTED` WS payload shape 변경(회귀 테스트로 고정)과 "claim 실패/이론상 도달 불가능 분기에서
FAILED 마킹을 더 이상 하지 않아 spawn row 가 RUNNING orphan 으로 남을 수 있는 가능성"(plan 에 P2 로
이미 추적) 두 가지인데, 둘 다 신규 발견이 아니라 기존 결정의 재확인이다. 이번 리뷰에서 독자적으로
발견한 신규 CRITICAL/WARNING 급 부작용은 없다.

## 위험도
LOW
