# Code Review 통합 보고서

## 전체 위험도

**LOW** — 14개 reviewer 전원 CRITICAL 0. 이번 라운드(18:26:50)의 실질 diff는 사실상
`engine-driver.interface.ts`의 `updateExecutionStatus` JSDoc 7줄 추가(형제 메서드
`tryLockActiveExecutionAndSaveNodeExec`와의 문서 비대칭 정정) 및 사용자 가이드
`run-results.mdx`/`.en.mdx` 미세 정정뿐이며, `retry-turn.service.ts`/`state-machine.ts`
소스 로직은 8R(`2ca44b769`) 이후 무변경이다. 신규 WARNING 중 2건(documentation)은 이번
라운드 자신의 선행 커밋이 도입한 순수 문서 자기모순이고, 1건(architecture)은 5라운드째
"실측 필요"로 defer되던 DI 주석 모순을 이번에 실측으로 확정한 것이다. 나머지 WARNING
6건은 `plan/in-progress/retry-turn-terminal-guard.md`에 이미 P2/P3로 추적 중인 기존
항목의 독립 재확인이며 신규 악화는 없다.

**강제 화이트리스트(router_safety) 확인**: forced 6명(maintainability, requirement,
scope, security, side_effect, testing) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음 — 14개 reviewer 전원 CRITICAL 0.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture | `RetryTurnService` 생성자의 `forwardRef(() => AiTurnOrchestrator)` 근거 주석("엔진→RetryTurnService 역방향 주입이 있어 transitive 순환 DI")이 현재 배선과 모순 — 실측 결과 `AiTurnOrchestrator`도 엔진도 `RetryTurnService`를 주입받지 않음(1R~7R간 5회 "모듈 레벨 import 순환 실측 필요"로 defer되던 의문을 이번에 grep+생성자 확인으로 확정, plan #8) | `retry-turn.service.ts:88-91`(생성자 주석), `:61-64`(클래스 docstring) | 주석을 현재 배선(순환 없음, forwardRef는 과거 엔진 thin-delegator 시대의 잔재)에 맞게 정정. 선택: boot 테스트로 안전성 검증 후 forwardRef 제거 검토 |
| 2 | Requirement | `retryLastTurn`이 대상 `NodeExecution.status`만 검증하고 그 `NodeExecution`이 속한 `Execution.status===FAILED`는 검증하지 않음 — 동시 취소 레이스(예: 노드는 FAILED 종결 직후 Execution만 CANCELLED)에서 spawn된 `NodeExecution`이 아무도 terminal로 마킹하지 않아 영구 RUNNING 고아로 잔류 가능(Execution 최종 상태 자체는 올바름, blast radius는 고아 row 한정)(plan #20 P2, 기존 추적 재확인) | `retry-turn.service.ts:130-252` | spawn 이전 `Execution.status===FAILED` 명시 검증 추가, 또는 `updateExecutionStatus`의 동기 throw를 흡수하는 방어 try/catch로 짝 NodeExecution 정리 경로 유도 |
| 3 | Requirement | `InvalidExecutionStateError`의 고정 문구("Execution is not waiting for input.")가 원래 `waiting_for_input` 기대 명령(submit_form 등)용으로 설계된 것을 retry_last_turn(기대 상태=`failed`)이 그대로 재사용 — client가 받는 실패 사유가 실제 원인과 무관해짐(`code`는 spec과 일치, `message` 문구만 부정확)(plan #28 P3, 기존 추적 재확인) | `retry-turn.service.ts:138-142, 144-148`; 근본원인 `workflow-errors.ts:113-119` | `RetryLastTurnError`가 이미 쓰는 정적 팩토리 패턴(`notFound`/`notRetryable`/`tooEarly`)과 동일하게 `notFailed(detail)` 등을 추가해 문구 분리 |
| 4 | Maintainability | `opts.allowRetryReentry` 계약이 타입(`{ allowRetryReentry?: boolean }`, 5곳 이상 인라인 재선언, plan #22)뿐 아니라 이번 라운드 추가된 JSDoc 산문까지 두 메서드에 사실상 동일 문장으로 중복 — "일부 소비처만 갱신되고 나머지는 stale로 남는" 8R·10R CRITICAL 유발 결함 클래스와 동일한 모양의 문서 중복이 한 겹 더 쌓임 | `engine-driver.interface.ts:76-82,88`(신규 문단) vs `:216-222,226`(기존 문단) | 불변식을 인터페이스 상단 1곳 또는 이름있는 옵션 타입(`RetryReentryOptions`)으로 통합하고, 각 메서드 JSDoc은 참조 + 메서드 고유 한 줄만 남길 것 |
| 5 | Maintainability | `applyRetryLastTurn`이 not-found 가드 → 멱등 fast-path → 원자 claim → 방어적 invariant 체크 → in-memory 동기화 → execution/node 조회+실패 마킹 → context rehydrate → `_resumeState` 구성 → emit → turn 위임 → 그래프 재개/실패 처리까지 8개 이상 책임을 약 196행 한 메서드에 보유(plan #19, 3라운드째 미해소) | `retry-turn.service.ts:288-483` | "fast-path 확인 → 원자 claim → 방어체크 → in-memory sync" 구간(약 301-369행)을 `private claimAndLoadRetryState(...)` 류 헬퍼로 추출 |
| 6 | Testing | `tryLockActiveExecutionAndSaveNodeExec`의 신규 `opts.allowRetryReentry`가 전용 unit 커버리지에 반영 안 됨 — 형제 `updateExecutionStatus`는 SQL 문자열의 `'failed'` 포함/배제를 직접 대조하는 전용 테스트가 있는 반면, 이쪽은 4개 케이스 모두 opts 미전달이고 유일한 방어선은 통합 테스트 1건뿐이라 회귀 시 `finalizeAiNode`의 어느 호출부가 원인인지 특정할 진단력이 없음(plan #27 P3, 11R 근거) | `engine-driver.interface.ts:216-227`; 갭은 `execution-engine.service.spec.ts` 약 5495-5564행(케이스 4건) | `updateExecutionStatus`와 대칭으로 opt-in/no-opt-in SQL 대조 unit 케이스 추가 |
| 7 | Testing | `_retryState` 원자 claim/consume JSONB SQL(`jsonb_exists`, `-` 연산자)이 unit·e2e 어느 계층에서도 실 PostgreSQL로 검증된 적 없음 — 전부 고정 `{affected:N}` mock. `retry_last_turn` 전용 `.e2e-spec.ts` 파일 자체가 없음. 이번 라운드가 고친 결함(mock이 실제 DB 의미론과 괴리)과 동일 클래스의 마지막 미해소 표면(plan #3 P2, 5R→6R→11R 3라운드 연속 지적, 우선순위 상향 이미 권고됨) | `retry-turn.service.ts:212-220`(retryLastTurn), `:541-549`(claimSpawnedRetryRow) | testcontainers 등 실 Postgres 대상 통합 테스트로 동시 실행 시나리오(두 트랜잭션 중 정확히 하나만 `affected=1`) 검증 |
| 8 | Documentation | `retryLastTurn` JSDoc이 몇 주 전부터 이미 구현·테스트로 잠긴 downstream graph traversal(`resumeGraphAfterRetry`, "WARNING #10 해소"로 이미 명시됨)을 "남은 문서화된 갭"으로 서술 — **이번 브랜치 자신의 오늘 커밋**(`7a05c6ec8`, "retry-turn JSDoc 3건 정정")이 다른 stale 참조를 고치면서 새로 도입한 자기모순이며, 이후 8R~11R 4개 문서화 라운드가 놓침 | `retry-turn.service.ts:122-128` vs `applyRetryLastTurn` docstring `:265-287, 282-283`, 구현 `resumeGraphAfterRetry:761-899`, 회귀테스트 `retry-turn.service.spec.ts:777` | 122-128행의 "남은 문서화된 갭 …" 문장을 삭제하거나 "downstream graph traversal은 `resumeGraphAfterRetry`(WARNING #10)로 이미 구현됨"으로 정정. 기능 영향 없음(순수 문서 정정) |
| 9 | Documentation | `engine-driver.interface.ts` 최상단 docblock이 "spec 수치가 아직 12/7로 stale, 정정 위임 중"이라 서술하나 그 위임은 이미 **2026-07-27** 완료됨(spec 커밋 `72e3193f7`이 15/10으로 갱신, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` 프론트매터도 종결 처리) — 10R이 "별도 project-planner 위임으로 추적 중"이라 넘겼던 전제 자체가 이미 하루 전 허물어져 있었음. 코드 쪽 수치(15/10) 자체는 재계산 결과 정확함 | `engine-driver.interface.ts:41-44` | "spec `execution-engine.md`도 2026-07-27자 15/10 갱신 완료(커밋 `72e3193f7`)"로 정정하거나 이력이 된 위임 경로 인용 제거 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security / Database | `RETRY_STATE_KEY`(`'_retryState'`) 상수가 파라미터 바인딩 대신 raw SQL 문자열로 4곳에 직접 삽입됨(`output_data - '...'`, `jsonb_exists(...)` 등) — 현재는 컴파일타임 상수(사용자 입력과 무관)라 익스플로잇 불가하나, 향후 이 키가 동적/설정 가능 값으로 바뀌거나 유사 헬퍼가 복제될 경우 인젝션 벡터화될 수 있는 코드 냄새. security·database 두 reviewer가 독립적으로 동일 발견 | `retry-turn.service.ts:213,220,544,549`(상수 정의 `:42`) | `jsonb_exists(output_data, :key)` + `setParameter('key', RETRY_STATE_KEY)` 형태로 파라미터 바인딩 전환(방어적 습관, 필수 아님) |
| 2 | Security | `failRetryExecution`이 타입 미구분 예외의 원본 `.message`를 그대로 client에 노출 — 이 파일의 다른 에러 클래스(`InvalidExecutionStateError`/`RetryLastTurnError`)가 이미 확립한 "client-safe message vs serverDetail 분리" 정책이 이 경로엔 미적용(기존 코드, 이번 라운드 신규 아님, 교차 테넌트 노출은 아니라 심각도 낮음) | `retry-turn.service.ts:926,933,959` | 동일 분리 정책 적용 검토 |
| 3 | Architecture / Concurrency / Requirement / Documentation | `opts.allowRetryReentry` 신규 JSDoc 서술("상태머신 opt-in과 DB 가드 양쪽에 함께 적용돼야 하며 하나만 반영하면 전이가 항상 0행", "opt-in 시에도 COMPLETED/CANCELLED는 배제")이 실제 구현(`state-machine.ts`의 `canTransition`, `execution-engine.service.ts`의 `NON_TERMINAL_OR_FAILED_STATUSES_SQL`)과 정확히 일치함을 4개 reviewer가 각각 독립적으로 교차검증 — 불일치 없음 | `engine-driver.interface.ts:76-83, 216-222` | 없음(확인 완료) |
| 4 | Architecture | 이중 진실 소스(상태전이 정당성이 `state-machine.ts` TS 규칙과 엔진 SQL allow-list 두 곳에 존재, plan #21) · `opts` 인라인 타입 중복(plan #22) · `finalizeAiNode` "RUNNING 유지" 분기의 opts 전파 도달가능성 미검증(plan #24) — 소스 로직이 8R 이후 문자 그대로 무변경임을 재확인, 신규 악화 없음 | `state-machine.ts:63-79`, `engine-driver.interface.ts:76-83/216-222` | 없음(기존 defer 유지) |
| 5 | Side Effect | claim 실패 분기·"claim 성공 후 in-memory `_retryState` 부재" 방어 분기 모두 이제 spawn row를 FAILED로 마킹하지 않음(과거엔 마킹했음) — "살아있는 row를 오판해 FAILED로 죽이던" 6R CRITICAL 해소를 위한 의도된 트레이드오프이나, 그 대가로 크래시 등으로 처리 중이던 delivery가 사라지면 해당 spawn row가 RUNNING 고아로 영구 잔류 가능(plan #15 P2, 6R 실측 근거와 함께 기존 추적) | `retry-turn.service.ts:332-343`(claim 실패), `:344-355`(in-memory 부재) | 별도 조치 불필요(이미 등재/추적됨). 향후 이 경로 전용 백스톱 신설 시 plan #15와 연계 |
| 6 | Side Effect | `NODE_STARTED` WS 이벤트의 `input` payload가 더는 `_retryState`를 포함하지 않음(claim 직후 delete로 인한 부수효과) — 공개 이벤트 계약(카테고리 8) 변경이나 "internal 필드 비노출" 원칙에 부합하는 의도된 변경이며 회귀 테스트로 고정됨 | `retry-turn.service.ts:369`(delete), `:435-450`(emitNode); 회귀 테스트 `retry-turn.service.spec.ts:745-764` | 없음 |
| 7 | Side Effect | 2차 claim이 entity 조회·`rehydrateContext`·`buildRetryReentryState`·`setNodeOutput`·`emitNode`보다 앞으로 이동 — "claim 성공 후 이 구간에서 예외/크래시가 나면 `_retryState`는 이미 소비됐는데 후속 조치 없음" 트레이드오프의 적용 범위가 넓어짐(6R CRITICAL 해소에 필수였던 재배치, plan #17 P3 기존 추적) | `retry-turn.service.ts:331`(claim) ~ `:452`(try 진입) | 없음(이미 등재된 P3 후속) |
| 8 | Maintainability | "not-found → spawn row FAILED 마킹" 블록이 execution not found·node not found 두 경우에 걸쳐 대입 순서·구조가 완전히 동일하게 중복(엔티티 이름과 메시지 문자열만 다름) | `retry-turn.service.ts:377-388, 389-400` | `markSpawnedRowFailedAndDiscard(spawnedRow, reason)` 헬퍼로 통합 |
| 9 | Maintainability | `retryLastTurn`은 JSDoc의 번호 매긴 6단계 절차와 본문 인라인 주석 번호가 정확히 1:1 대응하는데, `applyRetryLastTurn`은 JSDoc에 동일 형식의 8단계 목록을 두고도 본문 주석은 번호 없는 산문 레이블만 사용 — 같은 클래스 두 형제 public 메서드 간 문서화 관례 불일치 | `retry-turn.service.ts:108-114` vs `:265-286` | `applyRetryLastTurn` 본문에도 매칭되는 JSDoc 단계 번호 주석 추가 |
| 10 | Maintainability | `canTransition`의 retry 재진입 예외가 `to === RUNNING \|\| to === WAITING_FOR_INPUT` 개별 비교 나열인데 바로 위 `ALLOWED_TRANSITIONS` 표 조회는 `.includes()` — 허용 대상이 1개(RUNNING)에서 2개로 늘며 처음 드러난 스타일 불일치(기존 추적, 3번째 대상 추가 시 가독성 더 저하) | `state-machine.ts:72-77` vs `:82` | `RETRY_REENTRY_TARGETS` 배열 선언 후 `.includes()`로 파일 내 관용구 통일 |
| 11 | Testing | `retryAfterSec` 산출의 2번째 폴백(`retryState.retryAfterSec`), 카운트다운 경과 후 정상 spawn 케이스, 타임스탬프 부재 방어 분기, `retryAfterSec===0` 경계값 — 전부 어떤 테스트도 커버하지 않음(plan #7 P3) | `retry-turn.service.ts:182-197` | 폴백 성공/카운트다운 경과/타임스탬프 부재 각각의 케이스 추가 |
| 12 | Testing | `RetryLastTurnError`/`InvalidExecutionStateError` 회귀 테스트가 전부 `code`만 단언(`toMatchObject({code:...})`)하고 message 문자열은 단언하지 않음 — 메시지가 카피-붙여넣기로 뒤바뀌어도 회귀로 안 잡힘(plan #28 P3 연계) | `retry-turn.service.spec.ts:236,250,258,277,286-287,293-294,313` | message에 `nodeExecutionId` 등 핵심 토큰 포함 여부 스모크 단언 추가 |
| 13 | Testing | `finalizeAiNode`의 "RUNNING 유지" 분기와 `retryReentry:true` 조합의 도달가능성이 미확정인 채 미문서·미테스트 — 도달 불가능이 맞다면 영구히 테스트되지 않는 방어 코드인데 그 사실이 JSDoc에 명시돼 있지 않음(plan #24 P3) | 참고: `engine-driver.interface.ts:227-232`(JSDoc); 실제 소비부(범위 밖) `ai-turn-orchestrator.service.ts:1596-1601` | 호출그래프 재확인 후 도달불가 확정 시 JSDoc 명시, 도달가능 시 isFailed 분기와 대칭 테스트 추가 |
| 14 | Documentation | `claimSpawnedRetryRow` 재진입 순서 불변식의 핵심 논거가 호출부 인라인 주석과 헬퍼 자신의 JSDoc에 문장 단위로 거의 그대로 중복(8R부터 알려진 관찰, 현재 두 사본 일치 유지, 4라운드 동안 drift 재발 없음) | `retry-turn.service.ts:322-330` vs `:486-531` | 저비용 정리 후보로 계속 보류(차단 사유 아님) |
| 15 | Database | 동일한 "terminal 상태 CAS guarded UPDATE" 불변식이 `finalizeGuarded`(멱등 분기, raw QueryBuilder)와 `updateExecutionStatus`(엔진 구현체, else 분기 guarded UPDATE) 두 독립 구현 경로로 유지됨 — 향후 가드 조건이 바뀔 때(이번 라운드의 FAILED→WAITING_FOR_INPUT 확장처럼) 한쪽만 갱신되고 누락될 구조적 위험(이 PR의 8R 자체가 "잠금 소비처가 리뷰어 지목 2곳이 아니라 실측 3곳"이었던 유사 drift 이력 보유) | `retry-turn.service.ts:573, 630-658` vs `execution-engine.service.ts`(범위 밖) | 두 guarded-update 구현을 공유 헬퍼로 합치는 리팩터를 후속 과제로 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | raw SQL 상수 삽입 경화 여지(INFO#1, database와 공동), `failRetryExecution` 메시지 노출(INFO#2, 기존) |
| performance | NONE | 이번 라운드 실질 diff는 JSDoc뿐 — 런타임 영향 없음 |
| architecture | LOW | forwardRef 주석-배선 모순을 실측으로 확정(WARNING#1, plan #8, 5라운드째 defer 해소) |
| requirement | LOW | `Execution.status` 미검증(WARNING#2, plan #20), 에러 문구 불일치(WARNING#3, plan #28) — 둘 다 기존 추적 재확인 |
| scope | NONE | 브랜치 전체 변경이 명시된 작업 범위(retry 재진입 DB 가드+2차 원자 claim)에 전부 대응, 무관 변경 없음 |
| side_effect | LOW | spawn row FAILED 마킹 제거로 orphan 가능성(INFO#5, plan #15), WS payload 계약 변경(INFO#6, 의도·테스트로 고정) |
| maintainability | LOW | `opts` 계약 JSDoc 산문 중복 신규 추가(WARNING#4), `applyRetryLastTurn` 8+ 책임 미해소(WARNING#5) |
| testing | LOW | `tryLockActiveExecutionAndSaveNodeExec` opts 전용테스트 부재(WARNING#6), atomic claim SQL 실 Postgres 미검증(WARNING#7, 우선순위 상향 기존 권고) |
| documentation | LOW | 신규 문서 자기모순 2건(WARNING#8, #9) — 이미 해소/완료된 항목을 "남은 갭"/"미완료"로 오기술 |
| dependency | NONE | 신규 외부 의존성 없음, 확장된 내부 계약이 전 소비자에 동기화됨을 확인 |
| database | LOW | raw SQL 상수 삽입(INFO#1, security와 공동), 이중 구현 CAS 불변식(INFO#15) |
| concurrency | LOW | 신규 JSDoc-구현 일치 교차검증(INFO#3), 잔여 항목은 plan #20/#21로 기존 추적 중 |
| api_contract | NONE | 세 파일 모두 REST/WS 외부 표면이 아닌 엔진 내부 전용 계약 — 이번 diff 영향 없음 |
| user_guide_sync | NONE | 매칭 트리거 1건(`run-debug-flow-change`)의 동반 갱신이 이미 반영·검증 완료 |

## 발견 없는 에이전트

- **performance** — 이번 라운드 실제 diff는 JSDoc 주석 7줄 추가뿐(컴파일 시 완전 제거), `retry-turn.service.ts`/`state-machine.ts`는 8R 이후 바이트 단위 무변경. 이전 NONE 판정 유지.
- **scope** — 브랜치 시작점(`71ce6c12b`) 대비 전체 diff(+196/-38)를 전수 대조한 결과 모든 추가/수정 라인이 명시된 작업 범위에 직접 대응, 무관 파일·미사용 임포트·포맷팅-only·설정 변경 없음.
- **dependency** — `package.json`/lockfile diff 0, `import` 추가·삭제 0. 확장된 인터페이스 계약(`opts.allowRetryReentry`)이 구현체·모든 소비자(`AiTurnOrchestrator` 등)에 실제로 threading 되어 있음을 grep 대조로 확인.
- **api_contract** — REST 컨트롤러·WS 게이트웨이 핸들러·DTO 데코레이터 전무, 세 파일은 `ENGINE_DRIVER` 토큰 경유 엔진 내부 전용 계약. 이번 diff(JSDoc뿐)로 인한 하위호환성 영향 없음.
- **user_guide_sync** — 매트릭스 20개 행 중 매칭 1건(`run-debug-flow-change`)의 필수 동반 갱신(`run-results.mdx`/`.en.mdx`)이 선행 라운드에서 이미 작성됐고, 이번 HEAD가 직전 라운드의 KO/EN 구조·조건문 결함까지 해소했음을 diff로 직접 확인.

## 권장 조치사항

1. (P2, plan #3) `_retryState` 원자 claim/consume JSONB SQL을 testcontainers 등 실 PostgreSQL 대상 통합 테스트로 검증 — 3라운드째 mock으로만 방어돼 온 마지막 미해소 표면, 우선순위 상향이 이미 권고됨.
2. (P2, plan #20) `retryLastTurn`에 spawn 이전 `Execution.status===FAILED` 명시 검증 추가 — 동시-취소 레이스에서의 `NodeExecution` 고아 잔류 가능성 차단.
3. (신규, documentation, 저비용) `retry-turn.service.ts:122-128`의 "남은 문서화된 갭" 자기모순 문장을 삭제/정정 — downstream graph traversal은 이미 구현·테스트로 잠긴 기능.
4. (신규, documentation, 저비용) `engine-driver.interface.ts:41-44`의 spec 정정 위임 서술을 "2026-07-27 완료(커밋 `72e3193f7`)"로 갱신.
5. (신규 확정, architecture, plan #8) `retry-turn.service.ts:88-91`의 forwardRef 근거 주석을 현재 DI 배선(순환 없음)에 맞게 정정.
6. (P3, plan #27) `tryLockActiveExecutionAndSaveNodeExec`의 `opts.allowRetryReentry` 전용 unit 대조 케이스를 형제 메서드와 대칭으로 추가.
7. (P3, plan #28) `InvalidExecutionStateError`에 retry_last_turn 전용 정적 팩토리(`notFailed` 등)를 추가해 메시지 정확도 개선.
8. (P3, plan #19) `applyRetryLastTurn`의 claim+방어체크+in-memory sync 구간을 헬퍼로 추출해 책임 분리.
9. (P3, plan #22) `opts.allowRetryReentry` 계약 설명(타입+JSDoc)을 인터페이스 상단 또는 이름있는 옵션 타입으로 1곳 통합.
10. (선택) `_retryState` raw SQL 문자열 삽입 4곳을 파라미터 바인딩으로 경화(현재 익스플로잇 불가, 방어적 습관 차원).

## 라우터 결정

- `routing=skipped` — 라우터 미사용. 전체 14개 reviewer 실행.
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 성공)
  - **제외**: 없음
  - **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명) — 전원 결과 확보 확인됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | (없음) | — |