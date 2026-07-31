# Code Review 통합 보고서

## 전체 위험도

**CRITICAL** — `retry_last_turn` 2차 원자 claim(`claimSpawnedRetryRow`) 자체는 6~7 라운드에 걸쳐
견고하게 하드닝돼 있으나, concurrency 리뷰어가 새로 발견하고 본 요약 에이전트가 아래 4개 파일의
실제 코드를 직접 Read 로 재확인한 CRITICAL 1건 — **재진입이 의존하는 `Execution FAILED→RUNNING`
/ `FAILED→WAITING_FOR_INPUT` 짝 전이가 구조적으로 절대 persist 될 수 없다** — 로 인해 전체 위험도를
CRITICAL 로 판정한다. 이 결함은 `retry-turn.service.ts` 자체가 아니라 그 파일이 호출하는
`ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`state/state-machine.ts` 에
있으나, `retry_last_turn` 기능 전체(7 라운드에 걸쳐 하드닝된 이번 diff 포함)가 이 전이의 성공을
전제하므로 이번 리뷰 스코프와 직결된다. router_safety 강제 화이트리스트
(`maintainability, requirement, scope, security, side_effect, testing`) 결과는 전원 확보됨 —
누락 없음.

**검증 노트**: 본 요약 에이전트가 concurrency 리뷰어의 인용을 신뢰하지 않고 `state-machine.ts`,
`execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`(2개 함수)를 직접 Read 로
재대조한 결과 인용된 모든 라인 번호·로직이 정확히 일치함을 확인했다(아래 Critical #1 상세 참조).

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성(concurrency) | `retry_last_turn` 재진입이 의존하는 `Execution FAILED→RUNNING`(turn 종료 시) / `FAILED→WAITING_FOR_INPUT`(turn 계속 시) 짝 전이가, 상태머신의 opt-in 예외(`allowRetryReentry`)를 실제 동시성 가드가 반영하지 못해 **구조적으로 절대 persist 될 수 없다**. (a) turn 이 즉시 끝나는 경우: `finalizeAiNode` 의 else 분기가 `updateExecutionStatus(savedExecution, RUNNING, nodeExec, {allowRetryReentry:true})` 를 호출하지만, 그 `linkedNodeExec` 분기가 실제 잠금에 쓰는 `lockNonTerminalExecutionRow(manager, executionId)` 는 `opts` 파라미터 자체를 받지 않고 `NON_TERMINAL_STATUSES_SQL`(={PENDING,RUNNING,WAITING_FOR_INPUT}, FAILED 무조건 배제)로만 `FOR UPDATE` 잠금 조회 → DB 의 실제 status 는 FAILED 이므로 항상 0행 → `isNonTerminal=false` → `persisted=false` 반환. 방금 spawn 된 살아있는 NodeExecution 이 "동시 취소로 오판"돼 CANCELLED 로 마킹되고 `ExecutionCancelledError` 가 throw 되는데, Execution 은 여전히 FAILED 라 `finalizeGuarded` 도 `FAILED→CANCELLED` 를 상태머신상 불허(`ALLOWED_TRANSITIONS[FAILED]=[]`)로 판단해 조용히 skip — 결국 아무 종결 이벤트도 나가지 않는다. (b) turn 이 계속되는(가장 흔한 multi-turn) 경우: `reparkAiResumeTurn` 이 opts 없이 `updateExecutionStatus(savedExecution, WAITING_FOR_INPUT, nodeExec)` 를 호출 → `assertTransition('failed','waiting_for_input', undefined)` 이 `canTransition` 내부에서 `allowed=ALLOWED_TRANSITIONS['failed']=[]` 이므로 **동기적으로 `Error` throw** — 그 일반 예외 메시지가 그대로 `EXECUTION_FAILED` WS payload 로 클라이언트에 노출된다. 두 경로 모두 실제 동시성 없이 매 단일 호출마다 결정적으로 재현된다. 3개 spec 파일(`retry-turn.service.spec.ts`/`ai-turn-orchestrator.service.spec.ts`/`execution-engine.service.spec.ts`) 전부가 이 가드를 "기본 성공"으로 하드코딩 mock 해 은폐 — `execution-engine.service.spec.ts:249-251,269` 는 `mockTxManagerQuery` 를 "행 잠금 성공" 으로 고정 주석까지 남겼고, `npx jest execution-engine.service.spec.ts -t "applyRetryLastTurn"` 실행 결과 8/8 PASS(전부 이 하드코딩 mock 덕분). `applyRetryLastTurn` describe 블록의 모든 `processReturn` fixture(16755/16780/17051/17115/17127/17265/17517/17569행)가 `status:'ended'` 로 고정돼 "turn 계속" 시나리오(§b) 자체가 어느 테스트에도 구성돼 있지 않다. | `ai-turn-orchestrator.service.ts:421-425`(`reparkAiResumeTurn`), `:1562,1580-1585`(`finalizeAiNode` else 분기); `execution-engine.service.ts:499-503`(`TERMINAL_STATUSES`), `:513-518`(`NON_TERMINAL_STATUSES_SQL`), `:8138-8150`(`lockNonTerminalExecutionRow`, opts 파라미터 부재), `:8312-8393`(`updateExecutionStatus`, `linkedNodeExec` 분기가 opts 미전파); `state/state-machine.ts:30-36`(`ALLOWED_TRANSITIONS[FAILED]=[]`), `:58-76`(`canTransition` 의 `allowRetryReentry` 예외는 FAILED→RUNNING 한 쌍에만 한정) | (1) `lockNonTerminalExecutionRow`/`updateExecutionStatus`의 `linkedNodeExec`·else 분기 guarded SQL 이 `opts.allowRetryReentry` 를 실제로 전달받아 "FAILED 이면서 목표가 RUNNING(retry 재진입)" 케이스를 조건에 포함하도록 확장(예: `status IN (...) OR (status='failed' AND $allowRetryReentry)`). (2) `reparkAiResumeTurn` 경로를 위해 상태머신에 `FAILED→WAITING_FOR_INPUT` opt-in 전이를 추가하고 그 opts 를 실제로 전파. (3) 수정 후 실 Postgres(testcontainers 등) 기반 e2e 로 "retry 재진입이 실제로 RUNNING/WAITING_FOR_INPUT 으로 persist" + "turn 계속 시 재-park 정상 동작" 을 검증 — mock 기반 단위 테스트 3종 전부가 이 결함 클래스를 구조적으로 검출할 수 없음이 확인됨. (4) 본 리뷰 대상 파일(`retry-turn.service.ts`)만으로는 고칠 수 없다(근본 수정은 `ai-turn-orchestrator.service.ts`/`execution-engine.service.ts`/`state/state-machine.ts`) — 다만 이 파일의 "재진입 구현 완료" JSDoc 서술이 현재 정확하지 않을 가능성이 높다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/테스트(concurrency) | 위 CRITICAL 을 은폐한 근본 원인 — `ai-turn-orchestrator.service.spec.ts`/`execution-engine.service.spec.ts` 가 `updateExecutionStatus`/`lockNonTerminalExecutionRow` 의 FOR UPDATE 잠금을 실제 SQL WHERE 조건(및 mocked Execution 의 실제 status)과 무관하게 항상 "성공" 으로 하드코딩 mock. 기존 mutation 검증("가드를 항상 통과시키면 RED")은 "가드가 없으면 걸린다"는 반대 방향만 검증할 뿐 "가드가 정당한 예외 케이스까지 과잉 차단하는가"는 검출하지 못하는 종류다. | `ai-turn-orchestrator.service.spec.ts:418-436`, `execution-engine.service.spec.ts:249-251,269,16667-17569` | CRITICAL #1 근본 수정과 함께 (1) retry 재진입 turn 이 `ended:false` 로 계속되는 통합 테스트, (2) 잠금 조건이 실제 status 값을 평가하는 fake DataSource 또는 실 Postgres 기반 e2e 추가. |
| 2 | 테스트(testing) | `retryLastTurn`(1차 lookup/atomic consume)의 4개 방어·엣지 분기가 어떤 테스트로도 커버되지 않음 — 각각 mutation 으로 실측(대상 제거·무력화해도 43/43 GREEN 유지): `!nodeExec` not-found 좌변, malformed `expiresAt` 의 `Number.isFinite` NaN 가드(제거 시 만료 판정이 조용히 통과), `retryAfterSec` 의 `_retryState` fallback 소스, atomic consume 후 `spawned` null invariant 방어(`if(false)`로 무력화해도 GREEN 유지). 앞의 3개는 이미 plan #7(P3)로 defer 등재돼 있으나, `spawned` null invariant(4번째)는 이 파일이 이미 겪은 "이론상 불가능하다고 서술된 방어 분기가 실제로는 미검증" 패턴과 동일 클래스 위험(정확히 이 형태로 CRITICAL #1/#2 가 발생했었음)이라 defer 가 부적절하다고 판단. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:138`, `:169-177`, `:182-187`, `:244-250` | 처음 3개는 plan #7 우선순위 판단 유지 가능. `:244-250` 은 `manager.save` mock 이 null/undefined 를 반환하는 케이스 1개만 추가(테스트 `(f)`와 동일 템플릿)해 `RetryLastTurnError.notFound` 가 실제로 throw 되는지 잠글 것. |
| 3 | 테스트(testing) | 1차 원자 claim(`retryLastTurn` 의 consume)은 2차 claim(`claimSpawnedRetryRow`)과 달리 SQL 절의 문자열 형태 자체가 테스트로 잠겨 있지 않다 — 컬럼명(`output_data`→`input_data` 등 오변경)을 mutation 으로 바꿔도 43/43 GREEN 유지. `RETRY_STATE_KEY` 상수는 "키 리터럴" 만 보호할 뿐 컬럼명 자체의 오타는 보호 범위 밖. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:207-221` (대조: `:541-551`, `retry-turn.service.spec.ts:409` 의 `(b3)`) | `(b3)` 과 동일 패턴으로 `retryLastTurn` 의 consume QueryBuilder 에도 `set`/`andWhere` spy 를 심어 `output_data - '_retryState'` / `jsonb_exists(output_data, '_retryState')` 문자열을 `toMatch` 로 잠그는 테스트 1개 추가. |
| 4 | 문서화(documentation) | claim 순서 불변식("claim 은 손상 판정보다 먼저 실행돼야 한다")의 핵심 논거(~9줄)가 호출부 인라인 주석과 `claimSpawnedRetryRow` JSDoc 두 곳에 거의 축약 없이 중복 서술돼 있다. 이 파일은 정확히 이 클래스의 실패(7R 이 고친 WARNING — "백스톱 커버리지" 문단이 JSDoc **안에서조차** 신·구 두 버전이 자기모순으로 공존)를 이미 한 번 겪었다. 현재는 두 사본이 일치하나, 다음 라운드가 세부(백스톱 갭 범위 등)를 한쪽만 손보면 같은 실패가 세 번째로 재발할 토대가 마련돼 있다. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:322-330`(호출부 주석) vs `:507-518`(JSDoc) | 호출부 주석을 "claim 은 반드시 손상 판정보다 먼저 실행돼야 한다 — 상세 근거는 `claimSpawnedRetryRow` JSDoc 참조" 수준의 1~2줄 pointer 로 축약하고, 전체 논증은 JSDoc 한 곳(단일 진실 지점)에만 유지. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처(architecture) | (잔여 항목 중 최우선순위, plan #18 P2) `claimSpawnedRetryRow`↔`spawnedRow.inputData` in-memory 동기화가 타입/캡슐화가 아닌 주석 규약("이 delete 줄을 지우지 말 것")에만 의존 — 정확히 이 결함 형태가 이미 CRITICAL #2(2026-07-28)로 한 차례 실제 발생한 전력이 있어 재발 통로가 구조적으로 열려 있다. | `retry-turn.service.ts:369`(delete), `:538-552`(claimSpawnedRetryRow 정의) | `claimSpawnedRetryRow` 가 `spawnedRow`(또는 `inputData`)를 인자로 받아 성공 시 직접 mutate 하거나 `{claimed, retryState?}` 형태로 캡슐화. |
| 2 | 아키텍처·DB·부작용(architecture·database·side_effect) | claim discard(원인 불문 ack-and-discard) 이후 RUNNING NodeExecution row 가 영구 orphan 으로 잔류할 수 있다(plan #15 P2) — `failOrphanRunningNodeExecutions` 는 부모 Execution 이 이미 FAILED(terminal)라 닿지 않는다. discard 선택 자체는 "살아있는 작업을 죽이지 않는다"는 더 중요한 안전 속성을 지키는 의도된 트레이드오프로 3개 리뷰어 모두 타당하다고 판단. | `retry-turn.service.ts:520-531`(JSDoc "알려진 백스톱 갭") | 이미 추적 중 — 후속으로 "부모 terminal + 자식 RUNNING" 조합 주기 스캔 또는 모니터링 지표 추가 고려. |
| 3 | 아키텍처(architecture) | `finalizeGuarded` 멱등 분기가 choke point(`updateExecutionStatus`)를 우회해 raw UPDATE 를 직접 수행하고, 인자 `execution` 을 시그니처에 드러나지 않게 in-place mutate. 부수적으로 멱등 분기에서는 `clemvion.execution.total{status}`/`errors{code}` 비즈니스 메트릭이 누락(plan #14/#10 P3). | `retry-turn.service.ts:573`(정의), `:624`, `:629-659`, `:707-710`; `engine-driver.interface.ts:48-54`(choke point 선언) | self-transition-with-lifecycle-refresh 를 choke point capability 로 승격하거나, 최소한 메트릭 호출을 명시 위임. |
| 4 | 아키텍처·DB(architecture·database) | `applyRetryLastTurn` 의 execution/node not-found 두 분기가 status/error/finishedAt 대입 + save 4줄을 그대로 복제(plan #9 P3, 1R→7R 3회 재지적) — 무가드 full-entity `save()` 사용도 database 리뷰어가 별도 재확인(원자 claim 이 이미 배타 선점해 실 위험은 낮음). | `retry-turn.service.ts:377-388`(execution not-found), `:389-400`(node not-found) | `markSpawnedRowFailed(spawnedRow, message)` private helper 로 추출. 후속 정리 시 `id + status='running'` 조건부 UPDATE 로 통일하면 이 잔여 갭도 닫힘. |
| 5 | 아키텍처(architecture) | `resumeGraphAfterRetry` 의 자연 종결 경로가 `finalizeGuarded` 를 거치지 않고 `driver.updateExecutionStatus` 를 직접 호출 — 서로 다른 엄격도의 종결 경로가 공존(plan #11 P3). | `retry-turn.service.ts:888-898`(대조 `:701`, `:913`) | 통일 적용 또는 안전성 전제 차이(참조 stale 불가 불변식)를 명시 주석으로 남길 것. |
| 6 | 아키텍처(architecture) | `AiTurnOrchestrator` forwardRef 주석이 이미 제거된 반대 방향 의존을 근거로 인용 — 클래스 JSDoc("단방향 정리 완료")과 자기모순(plan #8 P3, 1R→2R→3R→5R 4회 재지적). 실제로 `execution-engine.service.ts`/`ai-turn-orchestrator.service.ts` 어디에도 `RetryTurnService` 값 import 없음을 확인. | `retry-turn.service.ts:88-89` vs `:61-64` | 모듈 순환 실측 후 forwardRef 존속 필요성 확인 → 불필요하면 제거, 필요하면 실제 근거로 주석 교체. |
| 7 | 아키텍처(architecture) | `continuation-execution.processor.ts` 의 `retry_last_turn` 제외 목록이 공유 타입/상수가 아닌 프로즈 주석에만 의존(plan #16 P3) — 5R CRITICAL 원인과 동일한 "한쪽 주석이 다른 쪽 상태의 근거로 인용" 결합 형태. | `continuation-execution.processor.ts:93`(이번 diff 범위 밖, module 경계 교차 확인) | 공유 상수/타입으로 결합을 명시화. |
| 8 | 아키텍처·유지보수성(architecture·maintainability) | `applyRetryLastTurn` 이 claim 블록 추출 이후에도 순 길이/분기 수 증가(184→188줄, early-return 가드 7개, plan #19 P3). | `retry-turn.service.ts:308-370`(claim 호출 `:371`) | `claimAndSyncRetryState(spawnedRow): Promise<RetryState | null>` 로 추출해 호출부를 한 줄로 축약. |
| 9 | 보안(security) | `_retryState` 키 리터럴(`RETRY_STATE_KEY`)을 raw SQL 문자열 보간에 사용 — 컴파일타임 상수라 현재 인젝션 위험 없음(가변 입력은 전부 바인드 파라미터 처리 확인). 향후 이 키가 동적/사용자 입력으로 일반화되면 즉시 인젝션 벡터가 된다. | `retry-turn.service.ts:213,220,544,549` | 향후 일반화 시 허용목록(allowlist) 또는 `/^[A-Za-z0-9_]+$/` 검증 추가. |
| 10 | 보안(security) | 비취소 실패 시 원본 예외 메시지가 REST(`GET /executions/:id`)로 그대로 노출될 수 있음(기존 동작, 이번 diff 범위 밖 — WS gateway 에는 일반화 계층이 있으나 REST 재조회 경로엔 동일 계층 없음). | `retry-turn.service.ts` `failRetryExecution` | 후속으로 "알려진 도메인 에러만 raw message 노출, 그 외는 일반화" 원칙을 REST 경로에도 적용 고려. |
| 11 | 보안(security) | 리뷰 중 대상 파일이 동시 실행 중인 것으로 보이는 mutation-testing 하네스에 의해 일시적으로 변형된 상태(null-guard/invariant 체크 일부 결여)로 두 차례 관측됨 — `git diff HEAD` 로 작업 트리가 HEAD 와 완전 일치함을 확인했고 이후 재확인에서도 두 가드 모두 안정적으로 존재. 실제 코드 결함 아님, 은폐 지시가 있었으나 따르지 않고 투명하게 기록. | `retry-turn.service.ts` (`!nodeExec ||` null-guard, `if (!spawnedId)` invariant 부근) | 조치 불필요(정보 제공 목적). |
| 12 | 부작용(side_effect) | claim UPDATE(존재성 검증보다 먼저 실행되도록 재정렬)의 null-safety 확인 완료 — `NodeExecution.inputData` 컬럼이 `nullable` 아닌 `default:{}` 라 무가드 `delete` 가 런타임 TypeError 를 낼 가능성 없음. | `retry-turn.service.ts:369` | 조치 불필요 — 회귀 테스트로 이미 잠김. |
| 13 | 부작용(side_effect) | `NODE_STARTED` WS 이벤트 payload 에서 `_retryState` 가 조용히 비노출 — 의도된 변경(내부 필드 비노출 원칙), 회귀 테스트로 고정, `websocket-protocol.md` 의 문서화된 계약 밖이라 破 아님, 알려진 소비자(frontend) 없음. | `retry-turn.service.ts:364-369` | 조치 불필요. |
| 14 | 부작용(side_effect) | `RETRY_STATE_KEY` 모듈 상수 도입 — 모듈-프라이빗 불변 상수로 다른 모듈에 영향 없음. 단, 동일 리터럴이 `execution-engine.service.ts`/`ai-turn-executor.ts`/`handler-output.adapter.ts` 등 타 파일엔 여전히 하드코딩(이번 diff 범위 밖). | `retry-turn.service.ts:42` | 조치 불필요(참고용 기록). |
| 15 | 유지보수성(maintainability) | 테스트 케이스 문자 라벨(`(a)`~`(f)`) 순서가 파일 내 실제 위치와 어긋남(이번 라운드 신규 발생, 실행/커버리지 영향 없는 스캔 가독성 이슈). | `retry-turn.service.spec.ts` — `(c)`→`(f)`→무라벨→`(d)`→`(e)` 순서 | 다음 편집 기회에 `(f)` 를 코드 순서에 맞는 라벨(예: `(c2)`)로 재정렬하거나 무라벨 테스트에도 라벨 부여. |
| 16 | 유지보수성(maintainability) | 테스트 query-builder mock 보일러플레이트 반복이 12곳으로 증가(7R 이 9곳으로 이미 "우선순위 낮음" 판정, 이번 라운드 신규 테스트가 1곳 추가). | `retry-turn.service.spec.ts` 12곳(예: 64,76,392,417,451,479,528,1067,1118,1149,1225,1285행) | 조치 불요. 반복 지점이 계속 늘면 공유 팩토리(`mockQueryBuilder`) 추출 재고. |
| 17 | 유지보수성(maintainability) | `claimSpawnedRetryRow` JSDoc 의 조건 서술 순서가 실제 `.andWhere()` 체이닝 순서와 다름(6R·7R 지적, SQL `AND` 교환법칙상 동작 영향 없음, 3회째 재확인·미변경). | `retry-turn.service.ts:491-497` vs `:546-549` | 사소함 — 다음 편집 시 서술 순서를 코드 순서에 맞추는 것을 권장, 별도 커밋 불필요. |
| 18 | 유지보수성(maintainability) | 신규/확장된 JSDoc·인라인 주석 분량이 실제 로직 대비 큼(JSDoc ~53줄 vs 본문 15줄) — 각 문단이 실제 결함 근거를 담고 있어 무관한 주석은 아니나, review-round 서사 누적으로 신규 합류자의 "현재 유효 계약" 파악이 점점 어려워짐(기존 tracked 패턴 §12 의 연장). | `retry-turn.service.ts:301-368`(claim 삽입 주석), `:485-537`(JSDoc) | 지금 조치 불필요. 코드 안정화 후(CRITICAL #1 근본 수정 포함) `finalizeGuarded`(#12)와 함께 일괄 정리 대상으로 편입, review-round 서사는 plan/rationale 문서로 이관. |
| 19 | 문서화(documentation) | 라운드별 축약 라벨(`W3`,`W6`)이 서로 다른 발견사항에 재사용돼 grep 기반 교차참조 시 혼동 소지(기능적 결함 아님). | `retry-turn.service.ts:371`(W3, 라운드 표시 없음) vs `:125,279`(W3, `(ai-review 7R)`); `:486`(W6, 표시 없음) vs `:364,445`(W6, `(ai-review 7R)`) | 필수 아님 — 향후 라벨 추가 시 기존 라벨도 점진적으로 라운드 표시(`(6R)`/`(7R)`) 보강. |
| 20 | 문서화(documentation) | `claimSpawnedRetryRow` 에 자매 종결 헬퍼(`completeRetryExecution`/`failRetryExecution`)가 쓰는 `@internal` 태그가 없음(7R 이 "선택 사항"으로 제안, 여전히 미반영). | `retry-turn.service.ts:485-537` vs `:698,:911`(`@internal`) | 선택 사항 — 태그 추가로 문서 관례 일관화. |
| 21 | 문서화(documentation) | `CHANGELOG.md` 가 이번 원자 claim 연작(`b351731f0`/`414550a1d`/`7a05c6ec8`/`886ca9395`)을 반영하지 않음 — 6R·7R 이 이미 지적했고 팀이 "다음 문서-정리 턴"으로 명시 이월(W12, `plan/in-progress/retry-turn-terminal-guard.md:457-459`). formal 강제 규약은 없어 차단 사유 아님. | 루트 `CHANGELOG.md` | 지시대로 문서-정리 턴에서 일괄 반영. 우선순위 표(§코드 표)에 번호 항목으로 승격하면 산문 이월 항목의 재유실 방지. |
| 22 | 의존성(dependency) | `claimSpawnedRetryRow` 방어 로직 주석이 TypeORM 0.3.30 특정 패치 버전에서 관측된 jsonb diff 동작을 근거로 들지만 `package.json` 은 caret 범위(`^0.3.28`)로 고정 — 다만 주석 스스로 이 delete 를 "버전-불문 방어"로 명시해 실질 위험은 낮음. | `retry-turn.service.ts:359`; `package.json:88`(`"typeorm": "^0.3.28"`); `pnpm-lock.yaml:9304`(실제 해석 버전 0.3.30) | 현상 유지 충분. 차후 TypeORM 패치 업데이트 시 회귀 스펙(369/560/583행 부근 `_retryState` 부활 방지 단언)이 여전히 유효한지만 확인. |
| 23 | 의존성(dependency) | `retry-turn.service.spec.ts` 의 신규 `NodeEventType` import 는 이미 로드되던 `websocket.service` 모듈의 기존 export 활용 범위 확장 — 신규 외부/내부 모듈 의존 아님. | `retry-turn.service.spec.ts:10-11` | 조치 불필요(정보성 기록). |
| 24 | 데이터베이스(database) | JSONB 원자 claim/consume 의 실 Postgres 통합 검증이 여전히 부재 — 이번 커밋의 신규 유닛 테스트는 SQL 형태 회귀만 강화할 뿐, mock 계층에서는 3중 조건(CAS)의 실제 DB 동시 UPDATE 경합 시맨틱을 검증할 수 없다(plan #3/#15 로 이미 추적). | `retry-turn.service.ts:538-552`, `:202-236`; `retry-turn.service.spec.ts:409-437`((b3)) | 별도 조치 불요(이미 추적 중). 후속 e2e/통합 스위트에 실 Postgres 대상 동시 claim 경합 시나리오 1건 추가 권장. |
| 25 | 요구사항(requirement) | `delete spawnedRow.inputData[RETRY_STATE_KEY]` 가 두 줄 위 `seededInput = spawnedRow.inputData ?? {}` 와 달리 nullish 가드 없이 직접 역참조하나, 도달 직전 `if (!retryState) return` 가드가 존재하고 `retryState` 는 `seededInput` 에서 읽으므로 이 위치의 null 역참조는 제어흐름상 구조적으로 도달 불가능함을 재확인(7R 지적, 이번 라운드 재검증 결과 risk 낮음 유지). | `retry-turn.service.ts` `applyRetryLastTurn` — claim 성공 직후 `if(!retryState)` 가드 다음 줄 | 유지 가능(현행과 동일 판단). 굳이 개선한다면 `seededInput` 참조 재사용으로 스타일만 통일. |
| 26 | 유저가이드 동반갱신(user_guide_sync) | `run-debug-flow-change` semantic trigger 근접 후보 심층 검토 — `retry_last_turn` 기능은 이미 `run-results.mdx` §"멀티턴 대화 중 오류 발생 시 재시도"(TTL 60분·재시도 가능 분류·3개 에러코드 표 포함)에 상세 문서화돼 있으나, 이번 diff 는 그 사용자 가시 계약을 하나도 바꾸지 않는다(내부 동시성 정합성 버그 수정 + 내부 전용 필드 비노출 강화뿐). 제거된 유일한 사용자 가시 문자열(구 "Retry re-entry failed: missing _retryState")은 문서·i18n 어디에도 참조되지 않음을 확인(grep 0건). | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:97-110,179-184` | 별도 조치 불요. 향후 이 서비스에 사용자 관찰 가능한 변경(TTL 값·신규 에러코드·downstream 동작)이 생기면 `run-results.mdx`+`.en.mdx` 동반 갱신 필수 — 다음 PR 에서 재확인 권장. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 신규 취약점 없음. raw SQL 리터럴 상수화·`_retryState` WS 노출 차단은 오히려 개선. 리뷰 중 mutation-testing 하네스로 인한 파일 일시 변형 관측(결함 아님, 투명 기록) |
| performance | NONE | 이번 라운드 신규 diff(JSDoc 3건·테스트 2건)는 프로덕션 로직 변경 전무. 기존 DB 왕복 증가는 이미 2차례 검토·정당화됨 |
| architecture | LOW | 신규 구조 결함 없음. INFO 8건 전부 6R/7R 에 이미 등재·defer 확정된 P2/P3 백로그의 재확인(가장 우선순위 높은 것은 #18 claim↔in-memory 캡슐화 부재) |
| requirement | LOW | 신규 Critical/Warning 없음. 7R WARNING 2건(spec drift, 방어분기 테스트 갭) 모두 해소 확인. 유닛(43/43)·통합(436/436) 재실행 GREEN, lint 0 errors |
| scope | NONE | 8개 점검관점 위반 없음. 전체 diff(4개 코드 커밋)가 plan 승인 항목·RESOLUTION 처분표와 hunk 단위로 완전 대응 |
| side_effect | LOW | 신규 미인지 부작용 없음. claim 순서 재배치·NODE_STARTED payload 변경·orphan row 잔류 모두 의도됨/회귀 테스트·plan 으로 이미 다뤄짐 |
| maintainability | LOW | 구조 변경 없음(JSDoc 정정·테스트 추가뿐). 테스트 라벨 비단조·mock 보일러플레이트 증가 등 저비용 INFO만 신규 |
| testing | LOW | 핵심 동시성 로직(2차 claim)은 mutation 검증으로 견고, 직전 라운드 테스트 갭 2건도 해소 확인. `retryLastTurn` 1차 lookup 4분기 미검증 + 1차 claim SQL 미잠금 — WARNING 2건 |
| documentation | LOW | 7R WARNING 3건(자기모순 JSDoc·stale 참조·spec drift) 전부 해소 확인. claim 순서 논거 중복 서술(동일 실패 유형 재발 토대) WARNING 1건 신규 |
| dependency | NONE | 신규 외부 패키지 0건(package.json/lockfile diff 없음). TypeORM 특정 패치 근거 주석 vs caret 범위 INFO 1건(위험 낮음) |
| database | LOW | 신규 스키마/마이그레이션 없음, SQL 인젝션 벡터 없음. orphan row·무가드 save()·실 Postgres 검증 부재 모두 기존 추적 항목의 재확인 |
| **concurrency** | **CRITICAL** | **재진입이 의존하는 `Execution FAILED→RUNNING`/`FAILED→WAITING_FOR_INPUT` 짝 전이가 구조적으로 절대 persist 되지 않음 — 3개 spec 파일 전부 하드코딩 mock 으로 은폐(8/8 PASS 는 mock 덕분). 본 요약 에이전트가 4개 파일 직접 재확인, 인용 100% 일치. 리뷰 대상 두 파일 자체(claim/finalizeGuarded)는 견고함(INFO)** |
| api_contract | NONE | 이번 라운드 실질 diff(JSDoc 정정·테스트 추가)는 API 요청/응답/에러코드/URL/인증 등 어떤 계약 요소에도 관측 가능한 변경 없음 — 발견사항 0건 |
| user_guide_sync | NONE | 매트릭스 20개 trigger 중 확정 매칭 없음. 근접 후보(`run-debug-flow-change`) 심층 검토 후 문서 갱신 불요로 기각(INFO 1건) |

## 발견 없는 에이전트

- **api_contract** — 이번 라운드 실질 diff(JSDoc 정정 3건 + 회귀 테스트 2건)가 시그니처·응답 스키마·에러 코드·URL 설계·페이지네이션·인증/인가·버전 관리 어느 축에도 관측 가능한 변경을 만들지 않아 CRITICAL/WARNING/INFO 모두 없음(완전 NONE, "발견사항: 없음"으로 명시).

## 권장 조치사항

1. **[최우선, CRITICAL]** `lockNonTerminalExecutionRow`/`updateExecutionStatus` 의 `linkedNodeExec`·else 분기 guarded SQL 이 `opts.allowRetryReentry` 를 실제로 전달받아 "FAILED 이면서 목표가 RUNNING(retry 재진입)" 케이스를 조건에 포함하도록 확장하고, `reparkAiResumeTurn` 경로를 위해 상태머신에 `FAILED→WAITING_FOR_INPUT` opt-in 전이를 추가 + opts 전파. 수정 파일: `execution-engine.service.ts`, `ai-turn-orchestrator.service.ts`, `state/state-machine.ts` (본 리뷰 대상 `retry-turn.service.ts` 자체는 이 수정의 스코프 밖).
2. 위 수정 후 **실 Postgres(testcontainers) 기반 e2e** 로 "retry 재진입이 실제 RUNNING/WAITING_FOR_INPUT 으로 persist" + "turn 이 `ended:false` 로 계속되는 재-park 시나리오" 둘 다 검증. 동시에 `ai-turn-orchestrator.service.spec.ts`/`execution-engine.service.spec.ts` 의 하드코딩 성공 mock 을 실제 status 값을 평가하는 fake 로 교체해 재발 방지.
3. `retryLastTurn` 의 `spawned` null invariant 방어 분기(`:244-250`)에 mutation 실측으로 확인된 테스트 갭을 닫을 것 — CRITICAL #1/#2 와 동일 클래스 위험이라 다른 P3 항목처럼 defer 하지 말 것.
4. `retryLastTurn` consume 의 SQL 문자열 회귀 테스트를 `(b3)` 패턴으로 추가해 1차/2차 claim 간 검증 비대칭 해소.
5. 문서화 WARNING(claim 순서 불변식 중복 서술) — 호출부 인라인 주석을 JSDoc 을 가리키는 1~2줄 pointer 로 축약해 향후 drift 재발 경로를 닫을 것.
6. 잔여 P2 백로그(#18 claim↔in-memory 동기화 캡슐화, #15 orphan row 백스톱)는 다음 구조 변경 라운드에서 최우선 처리.
7. 나머지 P3 백로그(#8/#9/#11/#14/#16/#19)·CHANGELOG 미반영은 기존 계획대로 안정화 후 일괄 정리 라운드에서 처리(이번 라운드 fix 강제 사유 아님).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용(prompt 에 skip 사유 문자열 미기재). 전체 14개 reviewer(security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync) 무조건 실행.
- 제외된 reviewer: 없음(0명).
- **강제 포함(router_safety)**: `maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보됨. 라우터가 이번 라운드에 사용되지 않았으므로 이 강제 목록은 실질적으로 "전체 실행"에 포함된 부분집합이며, 결과 손실 없음(누락 0건).