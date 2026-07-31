STATUS=success reviewer=architecture

===REPORT_MARKDOWN_BELOW===

# Architecture Review — `RetryTurnService` (retry_last_turn 2차 원자 claim)

## 사전 확인 사항

`codebase/backend/src/modules/execution-engine/retry-turn.service.ts` /
`retry-turn.service.spec.ts` 는 현재 HEAD(`025aedd0f`) 기준으로 uncommitted diff 가
없다(`git diff HEAD` 빈 결과) — 즉 prompt 의 "전체 파일 컨텍스트" 는 곧 리뷰 대상의
최종 상태다. 이 branch(`claude/retry-atomic-claim-4d9e77`)는 이미 7 라운드
(`review/code/2026/07/27/...` ~ `review/code/2026/07/30/11_41_20`) ai-review 를
거쳤고, 매 라운드의 발견·처분이 `plan/in-progress/retry-turn-terminal-guard.md`
"§코드 표"(#1~#19, 우선순위 P1~P3)에 단일 진실로 통합돼 있다. 아래 분석은 이
누적 이력과 **독립적으로 코드를 직접 재검토**한 결과이며, 교차 검증을 위해
`plan/in-progress/retry-turn-terminal-guard.md` 와 7R RESOLUTION(`review/code/2026/07/30/11_41_20/RESOLUTION.md`)
도 함께 열람했다. 결론을 먼저 밝히면: **독립 분석 결과가 기존 P2/P3 백로그와
정확히 수렴**하며, 이 diff 가 새로 도입한 아키텍처 결함은 발견되지 않았다.

## 발견사항

### 양호한 설계 (INFO)

- **[INFO]** SRP 준수 — `RetryTurnService` 는 god-class(`ExecutionEngineService`)에서
  분리된 `execution.retry_last_turn` lifecycle 전담 서비스로, 책임 범위가 클래스
  JSDoc(파일 상단, 44~71줄)에 정확히 기술된 대로 lookup/검증/atomic-consume,
  2차 claim, 재진입, downstream graph 진행, 종결까지 하나의 기능 축에 집중돼 있다.
- **[INFO]** ISP 준수 — `RetryEngineDriver`(`engine-driver.interface.ts:221-277`)는
  `RetryTurnService` 가 실제로 호출하는 5개 멤버(+ `CoreEngineDriver`/`ReentryStateDriver`
  상속분)만 노출한다. `AiTurnEngineDriver`/`InteractionEngineDriver` 와 동일한
  소비자별 분해 패턴을 일관되게 따른다.
- **[INFO]** 순환 의존성 정리 검증 완료 — 클래스 JSDoc(61~64줄)이 주장하는
  "engine→Retry 역방향 주입 제거, 단방향(Retry→engine) 정리"를 직접 확인했다:
  `execution-engine.service.ts` 는 더 이상 `RetryTurnService` 를 import/inject 하지
  않고(주석 참조만 남음), `execution-engine.module.ts` 의 `RetryTurnService` 는
  `exports`에 등재돼 WS gateway/continuation processor 가 엔진의 thin delegator 없이
  직접 호출한다. 실제로 개선된 결합도이다.
- **[INFO]** OCP 친화적 상태전이 확장 — `FAILED→RUNNING`(retry 재진입 전용) 전이를
  `state-machine.ts` 의 `ALLOWED_TRANSITIONS` 표에 넣지 않고 `allowRetryReentry`
  opt-in 파라미터(`canTransition`)로만 허용한다. 일반 호출자의 기존 동작을 건드리지
  않고 특수 케이스만 추가하는 방식으로 OCP 를 잘 지켰다.
- **[INFO]** `RETRY_STATE_KEY` 상수화(42줄) — raw SQL 리터럴과 TS 프로퍼티 접근에
  흩어져 있던 `'_retryState'` 문자열을 단일 상수로 통합해 drift 위험을 줄인
  선례(WARNING #3 해소)로, 이번 2차 claim(`claimSpawnedRetryRow`)에도 일관 적용됐다.

### 잔여 아키텍처 부채 — 기존 추적·defer 확정 항목 (신규 아님)

아래 항목들은 이번 검토에서 코드를 직접 읽고 독립적으로 도출한 것이나, 교차 확인
결과 전부 `plan/in-progress/retry-turn-terminal-guard.md` §코드 표에 이미 등재돼
있고, 가장 최근인 7R(`review/code/2026/07/30/11_41_20`)에서 "구조 변경 없음" 원칙
하에 **명시적으로 defer 결정**된 것이 `RESOLUTION.md` 에 기록돼 있다(0 Critical,
14개 reviewer 7라운드 수렴 확인). 이번 diff 는 그 이후 JSDoc/테스트 전용 커밋
(`7a05c6ec8`, `886ca9395`) + spec 문서 커밋(`025aedd0f`)만 추가했을 뿐 해당 코드
구조를 바꾸지 않았으므로, 아래는 **새 결함이 아니라 이미 팀이 알고 우선순위를
매겨 미룬 항목의 재확인**이다. 그래서 CRITICAL/WARNING 이 아닌 INFO 로 분류한다 —
동일 발견을 매 라운드 WARNING 으로 재상정하면 이미 합의된 defer 결정을 무효화하고
불필요한 재작업 루프를 유발한다.

- **[INFO]** (가장 우선순위 높은 잔여 항목, plan #18/P2) `claimSpawnedRetryRow` ↔
  `spawnedRow.inputData` 동기화가 타입/캡슐화가 아니라 주석 규약에만 의존한다.
  - 위치: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:369`
    (`delete spawnedRow.inputData[RETRY_STATE_KEY];`), 정의부 `:538-552`
    (`claimSpawnedRetryRow`).
  - 상세: `claimSpawnedRetryRow` 는 DB 의 `input_data` 에서만 원자적으로 키를
    지운다. 호출자(`applyRetryLastTurn`)가 369줄의 `delete` 를 "잊지 않고" 별도
    실행해야 in-memory 엔티티가 DB 와 일치하는데, 이 불변식은 함수 시그니처가
    아니라 JSDoc 프로즈("이 delete 줄을 지우거나 순서를 바꾸지 말 것")로만
    유지된다. 정확히 이 결함 형태(청구 후 stale in-memory 엔티티가 이미 지워진
    JSONB 키를 되살림)가 이미 CRITICAL #2(2026-07-28)로 한 차례 실제 발생했던
    전력이 있어, 구조적으로 재발 가능한 통로가 여전히 열려 있다.
  - 제안: `claimSpawnedRetryRow` 가 `spawnedRow`(또는 그 `inputData`)를 인자로
    받아 성공 시 직접 mutate 하거나, `{claimed, retryState?}` 형태로 이미
    동기화된 결과를 반환하도록 캡슐화하면 이 불변식이 구조적으로 보장된다.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:343`(#18, P2, "7R WARNING
    #5(architecture)"), 7R `RESOLUTION.md:15,50-51` 에 defer 로 명시 기록.

- **[INFO]** (plan #14/#10, P3) `finalizeGuarded` 의 멱등(no-op) 분기가 "단일
  choke point" 로 문서화된 `updateExecutionStatus` 를 우회하고, 인자로 받은
  `execution` 을 시그니처에 드러나지 않게 in-place mutate 한다.
  - 위치: `retry-turn.service.ts:573`(`finalizeGuarded` 정의) 중 멱등 분기
    `:629-659`(직접 `executionRepository.createQueryBuilder()` 로 COALESCE/무조건
    덮어쓰기 raw UPDATE), 대조 `:707-710`(실제 전이 분기는 `this.driver.
    updateExecutionStatus` 경유). in-place mutation 은 `:624`(`execution.status =
    live.status;`). choke point 선언은 `engine-driver.interface.ts:48-54`
    (`updateExecutionStatus` JSDoc "Execution 상태 전이의 단일 choke point").
  - 상세: `live.status === target`(자기 전이) 케이스는 `assertTransition` 이
    self-transition 을 금지(`state-machine.ts:34`)하므로 choke point 를 그대로
    쓸 수 없다는 사정 자체는 타당하다. 다만 그 결과 Execution lifecycle 컬럼에
    대한 두 번째 독립 쓰기 경로가 생겼고, engine 내부에서만 호출되는
    `emitTerminalExecutionMetrics` 를 경유하지 않아 retry 재실패의 멱등 분기에서는
    `clemvion.execution.total{status}`/`errors{code}` 비즈니스 메트릭이 누락된다.
    부수적으로 `finalizeGuarded(execution, ...)` 가 인자 `execution` 을 반환값 없이
    직접 변경하는 것도 함수 시그니처만으로는 드러나지 않는다.
  - 제안: self-transition-with-lifecycle-refresh 를 choke point 자체의 capability
    로 승격하거나, 최소한 메트릭 호출을 `finalizeGuarded` 경로에도 명시 위임.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:339`(#14, P3, "4R W2 =
    5R W2"), `:335`(#10, P3, "1R INFO 2 = 2R W3").

- **[INFO]** (plan #9, P3) `applyRetryLastTurn` 의 두 not-found 분기(부모 Execution
  없음 / Node 정의 없음)가 status/error/finishedAt 대입 + save 4줄을 그대로 복제.
  - 위치: `retry-turn.service.ts:377-388`(execution not-found), `:390-400`
    (node not-found) — 로그·에러 메시지 문자열만 다르다.
  - 제안: `markSpawnedRowFailed(spawnedRow, message)` private helper 로 추출.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:334`(#9, P3, "1R W3 =
    5R W5 = 7R W8 재지적").

- **[INFO]** (plan #11, P3) `resumeGraphAfterRetry` 의 자연 종결 경로는
  `finalizeGuarded` 를 거치지 않고 `this.driver.updateExecutionStatus` 를 직접
  호출한다.
  - 위치: `retry-turn.service.ts:888-898`. 대조: `:701`(`completeRetryExecution`),
    `:913`(`failRetryExecution`) 은 둘 다 `:573` `finalizeGuarded` 경유.
  - 상세: 같은 클래스 안에 "terminal 쓰기" 를 처리하는 서로 다른 엄격도의 경로
    (재-SELECT 후 판정 vs 참조 그대로 위임)가 공존한다. `savedExecution` 참조가
    이 경로에서는 재진입 시작 시점부터 stale 해질 기회가 없다는 불변식에 기대는
    의도된 설계이나, 두 헬퍼가 겉보기엔 대칭적(모두 "Execution 종결")이라 향후
    유지보수자가 안전성 전제 차이를 놓치기 쉽다.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:336`(#11, P3, "2R INFO 2").

- **[INFO]** (plan #8, P3, 4회 재지적) `AiTurnOrchestrator` forwardRef 주석이
  이미 제거된 반대 방향 의존을 근거로 인용 — 클래스 JSDoc 과 자기모순.
  - 위치: `retry-turn.service.ts:88-89`(생성자 주석 "엔진은 본 서비스를
    주입받으므로 transitive 순환 DI") vs `:61-64`(클래스 JSDoc "engine→Retry
    역방향 주입을 없애... 단방향(Retry→engine)으로 정리했다").
  - 상세: 실제로 `execution-engine.service.ts`/`ai-turn-orchestrator.service.ts`
    어디에도 `RetryTurnService` 값 import 가 없음을 직접 확인했다(주석 참조만
    존재) — 현재 그래프에서 `AiTurnOrchestrator` 가 `RetryTurnService` 로 되돌아가는
    경로는 없다. 이 comment 가 자기모순 상태로 남으면, 이 코드베이스가 이미 한 번
    겪은 "폐기된 전제가 새 결함의 근거로 재인용" 패턴(`continuation-execution.
    processor.ts` 의 "자체 멱등 가드" 서술이 5R CRITICAL 의 원인이 됐던 사례)을
    반복할 소지가 있다.
  - 제안: 모듈 순환 실측 후 forwardRef 존속 필요성 확인 → 불필요하면 제거, 필요
    하면 실제 근거로 주석 교체.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:333`(#8, P3, "1R INFO 1 =
    2R W2 = 3R W3 = 5R W3").

- **[INFO]** (plan #16, P3, 파일 범위 밖이나 module 경계 점검을 위해 교차 확인)
  `continuation-execution.processor.ts` 의 `retry_last_turn` 제외 목록이 타입/공유
  상수가 아닌 프로즈 주석에만 의존.
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/
    continuation-execution.processor.ts:93`(`type !== 'cancel' && type !==
    'retry_last_turn'`) — 이 파일은 이번 리뷰 prompt 의 파일 목록엔 없으나 동일
    branch diff(`main..HEAD`)에 포함돼 있어 module 경계 점검 차 교차 확인함.
  - 상세: 이 exclusion 목록은 "`RetryTurnService` 가 자체 원자 claim 을 수행한다"
    는 사실에 암묵적으로 의존하는데, 그 결합은 두 파일에 나뉜 prose 주석으로만
    존재한다(공유 상수/타입 없음). 정확히 이 결합 형태(한쪽 주석이 다른 쪽 상태의
    근거로 인용되는 구조)가 이미 5R CRITICAL 의 원인이었다.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:341`(#16, P3, "6R
    side_effect/architecture WARNING #2, 구조 변경이라 defer").

- **[INFO]** (plan #19, P3) `applyRetryLastTurn` 이 claim 블록 추출 이후에도
  순 길이/분기 수가 증가(184→188줄, early-return 가드 7개).
  - 위치: `retry-turn.service.ts:308-370`(claim 호출 `:371`, "이론상 도달 불가능"
    방어 분기 `:384-395`, in-memory 동기화 `delete` `:369`).
  - 제안: `claimAndSyncRetryState(spawnedRow): Promise<RetryState | null>` 로
    추출해 호출부를 "null 이면 discard, 아니면 계속" 한 줄로 축약.
  - 근거: `plan/in-progress/retry-turn-terminal-guard.md:344`(#19, P3, "7R
    WARNING #7(maintainability)").

## 요약

`RetryTurnService`/`retry-turn.service.spec.ts` 는 god-class 분해(C-1 step4) 이후
`execution.retry_last_turn` lifecycle 에 책임이 잘 응집돼 있고, `RetryEngineDriver`
ISP slice·`useExisting` 기반 DIP·`allowRetryReentry` opt-in 을 통한 OCP 적용이
일관되게 유지된다. 이번 검토의 핵심인 "read-then-branch 재진입 가드 → 조건부
UPDATE 원자 claim(`claimSpawnedRetryRow`)" 전환은 기존 `retryLastTurn` 의 atomic
consume 과 동일한 패턴(JSONB `-` + `jsonb_exists` guard)을 재사용해 일관성 있게
구현됐고, 엔진→Retry 역방향 주입 제거로 순환 DI 가 실제로 단방향화됐음을 직접
확인했다. 독립적으로 도출한 잔여 관찰(claim↔in-memory 동기화의 캡슐화 부재,
`finalizeGuarded` 의 choke-point 우회 및 은닉 mutation, 중복 FAILED-marking 블록,
`resumeGraphAfterRetry` 의 비대칭 종결 경로, stale forwardRef 근거 주석, continuation
processor 의 prose-only 결합, `applyRetryLastTurn` 복잡도)은 전부 이 branch 자체의
7 라운드 ai-review 백로그(`plan/in-progress/retry-turn-terminal-guard.md` §코드 표
#8/#9/#10/#11/#14/#16/#18/#19)와 정확히 수렴하며, 가장 최근 라운드(7R)에서 "구조
변경 없음" 원칙 하에 이미 명시적으로 defer 결정되고 P2/P3 로 우선순위가 매겨져
있다. 이번 diff(JSDoc 정정·회귀 테스트 추가·spec 문서 정정)는 그 구조를 바꾸지
않았으므로 새로 도입된 아키텍처 결함은 없다. 유일하게 눈여겨볼 가치가 있는
항목은 P2 인 claim↔in-memory 동기화 캡슐화 부재(CRITICAL #2 와 동일 결함 클래스의
재발 통로)이며, 다음 구조 변경 라운드에서 최우선으로 다룰 것을 권장한다.

## 위험도

LOW
