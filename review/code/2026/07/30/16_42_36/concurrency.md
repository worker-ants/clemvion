# 동시성(Concurrency) 리뷰 — retry_last_turn 짝 전이 DB 가드 수정 (8R/9R)

## 리뷰 범위 확인

`meta.json` 의 5개 파일은 전부 `change_type: Review`(전체 파일 컨텍스트, diff 아님)로 제공됐다.
실제 변경분을 정확히 특정하기 위해 `git diff <merge-base 71ce6c12b> HEAD` 로 직접 대조한 결과,
콘텐츠 변경은 커밋 `2ca44b769`("retry 재진입 짝 전이가 DB 가드에 막혀 절대 persist 되지
않던 결함, 8R CRITICAL") 1건에 집중되어 있고, 후속 `1838c6fec`(9R)는 테스트(`.spec.ts`)와
`spec/*.md` 만 추가했다(앱 코드 diff 0). 본 리뷰는 8R 이 도입한 실제 코드 변경을 중심으로,
5개 파일 전체에서 그 변경이 만드는 새로운 동시성 표면을 점검했다.

**배경**: `execution.retry_last_turn` 재진입은 FAILED 상태의 Execution 을 opt-in
(`allowRetryReentry`)으로 RUNNING(turn 즉시 종료) 또는 WAITING_FOR_INPUT(turn 계속, re-park)
으로 되돌린다. state-machine 의 `canTransition` 은 이 opt-in 을 이미 반영했으나, DB 레벨
가드(`lockNonTerminalExecutionRow` 의 `FOR UPDATE` 조회 + `updateExecutionStatus` else 분기의
guarded UPDATE)는 여전히 `NON_TERMINAL_STATUSES_SQL`(FAILED 무조건 배제)만 사용해 재진입의
짝 전이가 구조적으로 항상 0행이었다 — in-memory 상태머신은 허용하는데 DB 쓰기는 절대
반영되지 않는 비대칭이 8R 이전의 실제 결함이었다.

## 검증한 것

`allowRetryReentry`/`retryReentry` 플래그의 전체 호출 체인을 코드베이스 전수 grep(`opts?:
{ allowRetryReentry?: boolean }` 및 `updateExecutionStatus(`/`tryLockActiveExecutionAndSaveNodeExec(`
전 호출부)으로 추적했다:

- `retry-turn.service.ts:288` `applyRetryLastTurn` → `processAiResumeTurn(..., { retryReentry: true })` 가 유일한 진입점.
- `ai-turn-orchestrator.service.ts:1426` `finalizeAiNode` — COMPLETED 분기 2곳(`:1508` isFailed,
  `:1619` RUNNING 재claim)이 `allowRetryReentry ? { allowRetryReentry: true } : undefined` 로
  조건부 전달.
- `ai-turn-orchestrator.service.ts:430` `reparkAiResumeTurn` — 신규 5번째 파라미터로
  opts 를 받아 `:457` 에서 동일 패턴으로 `driver.updateExecutionStatus` 에 전달. 4개 호출부
  (`processAiResumeTurn` 내 malformed/continue/button_click/unknown 4개 분기) 전부 갱신됨.
- `execution-engine.service.ts:8168` `lockNonTerminalExecutionRow`, `:8224`
  `tryLockActiveExecutionAndSaveNodeExec`, `:8354` `updateExecutionStatus` — opts 를 받아
  `NON_TERMINAL_OR_FAILED_STATUSES_SQL`(`:534`, FAILED 포함) vs 기존
  `NON_TERMINAL_STATUSES_SQL`(FAILED 배제) 를 선택.
- **다른 호출부 전부 미전달 확인** — `updateExecutionStatus`/`tryLockActiveExecutionAndSaveNodeExec`
  의 나머지 호출부(`execution-engine.service.ts` 내 12곳, `form-interaction.service.ts`,
  `button-interaction.service.ts` 각 2곳)는 opts 없이 호출돼 기본값(FAILED 배제)을 그대로
  쓴다 — retry 경로 밖에서 "FAILED 부활 차단" 방어가 약화되지 않았음을 확인.
- REST/WS "stop" 경로(`executions.service.ts:789` `status IN (RUNNING, PENDING)`)와
  `cancelWaitingExecution`(`WAITING_FOR_INPUT` 전용)는 FAILED 상태 Execution 을 대상으로
  하지 않음을 확인 — retry 재진입이 FAILED 행을 잠그는 동안 그 행을 두고 경합할 수 있는
  다른 writer 가 없다(단일 writer 불변식이 여러 계층에서 성립).
- `claimSpawnedRetryRow`(`retry-turn.service.ts:538`, `_retryState` 원자 제거 + `status='running'`
  CAS)가 `applyRetryLastTurn` 의 "손상 판정"(`:344`)보다 **먼저** 호출됨(`:331`)을 재확인 —
  claim 실패/성공 판정 순서 결함(6R CRITICAL #1/#2)이 이번 diff 로 재도입되지 않았다.
- 잠금 순서(Execution row `FOR UPDATE` → 같은 트랜잭션에서 NodeExecution `save`)가 이
  파일의 모든 형제 분기에서 일관되어(역순 조합 없음) lock-order-inversion 데드락 표면을
  만들지 않는다.

이 경로들을 종합하면 8R 수정은 (a) 원래 결함을 정확히 닫고, (b) 새 opt-in 을 retry 재진입
호출 체인에만 정확히 한정하며, (c) 기존에 이미 성립해 있던 "FAILED Execution 은 retry 외
누구도 건드릴 수 없다"는 단일-writer 불변식을 유지한다. 새로운 CRITICAL/WARNING 급 결함은
발견하지 못했다.

## 발견사항

- **[INFO]** `allowRetryReentry`/`retryReentry` opt-in 이 타입 레벨이 아니라 관례(주석)로만
  scope 제한된다
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:8354`
    (`updateExecutionStatus` 의 `opts?: { allowRetryReentry?: boolean }`), `:8224`
    (`tryLockActiveExecutionAndSaveNodeExec`); `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:430`
    (`reparkAiResumeTurn`), `:1426`(`finalizeAiNode`)
  - 상세: "실패 종결된 실행은 부활할 수 없다"는 이 코드베이스의 핵심 방어적 동시성 불변식이,
    `public`/모듈 내부에서 자유롭게 호출 가능한 메서드의 평범한 optional boolean 파라미터
    하나로 열고 닫힌다. 오늘 시점 전수 grep 으로는 실제 호출부가 retry 재진입 체인 4곳으로
    정확히 한정돼 있어 활성 결함은 아니다. 다만 이 이름(`allowRetryReentry: true`)을 아는
    사람이 향후 다른 재개/복구 기능에서 무심코 재사용하면, DB 가드가 "동시 cancel 로 이미
    terminal" 케이스와 "의도적 FAILED 부활" 케이스를 구분하지 못해 이번에 고친 것과 같은
    클래스의 문제가 조용히 재발할 수 있다 — 컴파일러도 린트도 이를 막지 않는다.
  - 제안: 이 옵션을 받는 시그니처를 `RetryEngineDriver` ISP slice 전용 narrow 타입으로
    분리하거나, 옵션 객체를 `retry-turn.service.ts` 가 소유하는 단일 상수/브랜드 타입으로
    바꿔 다른 파일에서 리터럴로 `{ allowRetryReentry: true }` 를 즉석에서 만들 수 없게 하는
    구조적 강제를 검토. 최소한 이 두 SQL 상수(`NON_TERMINAL_STATUSES_SQL` /
    `NON_TERMINAL_OR_FAILED_STATUSES_SQL`) 선택 지점에 "새 호출부 추가 전 이 문서를 반드시
    읽으라"는 린트 주석 앵커(예: `@sealed-for` 태그)를 추가하는 것도 저비용 대안.

- **[INFO]** (pre-existing, 이미 `plan/in-progress/retry-turn-terminal-guard.md` #15 로 추적 중)
  `claimSpawnedRetryRow` discard 시 RUNNING `NodeExecution` orphan 잔류 가능
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:538`
    (`claimSpawnedRetryRow`), JSDoc `:486-531`
  - 상세: 2차 claim(`jsonb_exists(input_data,'_retryState') AND status='running'`)이 실패해
    ack-and-discard 하면, 그 spawn 된 NodeExecution row 는 `status=RUNNING` 인 채로 영구
    남을 수 있다 — 부모 Execution 은 이미 `failed`(terminal)라 `recoverStuckExecutions` /
    `failOrphanRunningNodeExecutions` 의 stale-RUNNING-Execution 재구동 경로 대상이 아니기
    때문. 이번 8R/9R diff 가 새로 만든 문제가 아니라 6R(`b351731f0`)에서 이미 식별·문서화되고
    plan 에 P2 로 등재된 알려진 트레이드오프다(살아있는 작업을 오판해 죽이는 것보다
    이론적 orphan row 가 낫다는 의도적 선택). 이번 라운드에서 재확인만 하며 추가 조치는
    제안하지 않는다 — 기존 plan 항목을 그대로 따를 것.

- **[INFO]** (pre-existing, 이미 plan #3/#18 로 추적 중) atomic-consume SQL 의 실제
  Postgres 레벨 CAS 동작이 어느 테스트 계층에서도 실행되지 않음
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:205-227`
    (`retryLastTurn` 의 `jsonb_exists`/JSONB `-` atomic consume), `:538-551`
    (`claimSpawnedRetryRow`)
  - 상세: 단위 테스트는 `createQueryBuilder` 체이너를 mock 하므로, "동시 UPDATE 상황에서
    `jsonb_exists` + `status` 조건이 정확히 1/0 을 반환하는가"라는 이 기능의 핵심 동시성
    불변식은 실제 Postgres 로 검증된 적이 없다(정적 근거뿐). 새로 도입된 결함은 아니고
    plan 표 #3/#18 에 이미 등재되어 있다.

## 요약

이번 리뷰 대상 diff(8R CRITICAL, `2ca44b769`)는 `execution.retry_last_turn` 재진입의 짝
전이(FAILED→RUNNING / FAILED→WAITING_FOR_INPUT)가 state-machine 의 opt-in 허용에도
불구하고 DB 잠금/guarded UPDATE 가드에 opt-in 이 전파되지 않아 항상 0행으로 실패하던
구조적 결함을 닫는다. 전체 호출 체인(`applyRetryLastTurn` → `finalizeAiNode`/
`reparkAiResumeTurn` → `tryLockActiveExecutionAndSaveNodeExec`/`updateExecutionStatus` →
`lockNonTerminalExecutionRow`)을 직접 추적한 결과 opt-in 전파가 정확하고, 이 opt-in 이
retry 재진입 경로 밖으로 새지 않으며(다른 호출부 전수 확인), 기존에 성립해 있던 "FAILED
Execution 은 retry 재진입 외 누구도 건드릴 수 없다"는 단일-writer 불변식(REST stop 가드가
FAILED 를 애초에 대상에서 제외)도 그대로 유지된다. 락 획득 순서(Execution row → 같은
트랜잭션의 NodeExecution save)도 일관되어 신규 데드락 표면이 없다. 새로 발견한 CRITICAL/
WARNING 급 결함은 없으며, 남은 항목은 (1) opt-in 플래그가 타입 레벨이 아닌 관례로만
scope 제한된다는 신규 INFO 관찰 1건과 (2) 이미 코드/plan 에 정확히 문서화·추적 중인
pre-existing 트레이드오프 2건(orphan RUNNING row, atomic-consume SQL 의 실 DB 미검증)
뿐이다. 이 코드는 이미 9라운드의 다관점 리뷰를 거친 상태로, 이번 회차에서 추가로
차단할 사항은 없다.

## 위험도

LOW
