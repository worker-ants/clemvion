# Code Review 통합 보고서

대상: `fix(engine): retry_last_turn 재진입의 비원자 가드 — 조건부 UPDATE claim 으로 교체 (#10 동반)` (commit `b351731f0`)

## 전체 위험도

**CRITICAL** — `applyRetryLastTurn` 에 신설된 원자 claim 자체의 SQL/설계는 견고하지만, **삽입 위치**때문에 이 PR이 없애려는 바로 그 결함 클래스(동시 배달 시 충돌하는 종결 쓰기)가 **두 개의 서로 다른 경로로 재도입**된다 — (1) claim보다 먼저 실행되는 기존 "`_retryState` 부재→FAILED" 판정이 정상적인 "이미 다른 delivery가 claim함"을 손상으로 오판(3개 reviewer: architecture·requirement·concurrency 독립 수렴), (2) claim 성공 후 execution/node not-found 분기의 stale in-memory `save()` 가 TypeORM jsonb diff 메커니즘으로 claim이 지운 `_retryState` 를 되살림(side_effect). 두 결함 모두 이 PR 자신이 명시한 트리거(BullMQ stalled 재배달·`CONTINUATION_WORKER_CONCURRENCY` 상향·멀티 인스턴스) 안에 있고, concurrency reviewer는 진짜 동시성 없이 BullMQ 기본 `attempts` 재시도만으로도 결정적 재현이 가능함을 코드 경로로 논증했다. **forced(router_safety) 화이트리스트 6명 전원 결과 확보됨 — 강제 목록 미이행 없음.**

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Concurrency / Architecture / Requirement | 신규 원자 claim(`:310-339`)보다 **먼저** 실행되는 기존 "`_retryState` 부재 → 무조건 FAILED" 판정(`:293-308`, 이 diff가 손질하지 않은 코드)이, claim이 정상적으로 만들어내는 상태("다른 delivery가 이미 claim해 `_retryState`는 사라졌지만 `status`는 여전히 RUNNING")를 "복구 불가능한 손상"과 구분하지 못한다. `_retryState` 를 지우는 유일한 코드 경로가 이 claim 자신뿐이므로(스폰 시점엔 항상 seed됨), RUNNING 상태에서 `_retryState` 가 없다는 것은 실질적으로 100% "이미 다른/이전 delivery가 claim함"을 의미하는데도, 무가드 full-entity `save()` 로 **아직 처리 중인 row 를 즉시 FAILED 로 덮어쓴다**. concurrency reviewer는 추가로, claim~try 진입 전 구간(`:341-418`, `Promise.all`/`rehydrateContext`/`buildRetryReentryState`/`setNodeOutput`/`emitNode`)이 try/catch 밖에 있어 **진짜 동시성 없이도** BullMQ 기본 `attempts=3` 재시도만으로 결정적으로 재현됨을 논증했다(1차 시도가 claim 성공 후 이 구간에서 일시적 예외로 실패 → BullMQ가 같은 job 재배달 → 재배달된 시도의 fresh `findOneBy` 는 이미 claim이 지운 `_retryState` 를 관측 → `:293-308` 진입 → 원래는 회복 가능했을 일시 오류가 영구 FAILED 로 오확정). | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:293-308` (문제의 기존 분기) 및 `:310-339` (신규 claim), 상호작용 범위 `:268-451` | (3개 reviewer 공통 권고) claim을 `:293-308` 판정보다 **앞으로** 옮기거나, claim 실패(`affected!==1`)를 원인 구분 없이 **항상** ack-and-discard(로그만, `save()` 없음)로 통일해 별도의 "손상→FAILED" 종결 분기 자체를 제거한다. `retryState` 값은 claim 이전에 이미 확보한 in-memory `spawnedRow.inputData._retryState` 를 그대로 재사용하면 되므로 순서를 바꿔도 후속 로직에 영향 없다. "한 번도 seed되지 않은 진짜 corruption" 방어가 필요하면 `recoverStuckExecutions` 류 backstop에 위임. 회귀 테스트: (i) 선행 claim 성공 직후(status 여전히 RUNNING) 재배달되는 케이스, (ii) claim 성공 후 해당 구간에서 throw → BullMQ 재시도 케이스 — 둘 다 FAILED 오마킹 없이 discard 됨을 고정. |
| 2 | Side Effect | 신규 claim(`:323-332`)은 DB의 `input_data` 컬럼에서만 `_retryState` 를 원자 제거하고 in-memory `spawnedRow` 엔티티는 갱신하지 않는다. claim 성공 직후 execution 또는 node 조회가 실패하면(`:347-358`, `:359-370`) `nodeExecutionRepository.save(spawnedRow)`(full-entity save, `:356`/`:368`)가 호출되는데, TypeORM 0.3.30의 jsonb 컬럼 diff 계산이 DB를 재-SELECT해 stale in-memory 값(`_retryState` 있음)과 비교 후 다르면 그 옛 값을 다시 써 **claim이 방금 지운 `_retryState` 를 부활**시킨다. 결과 상태는 `status=FAILED` 인데 `_retryState` 가 되살아난 모순 row. mock 기반 유닛 테스트(`(d)`/`(e)`, `save` pass-through mock)로는 이 Postgres 재-SELECT 상호작용을 구조적으로 검출할 수 없다. | `retry-turn.service.ts:323-332`(claim) ↔ `:347-358`, `:359-370`(not-found 분기), 특히 `save()` 호출부 `:356`/`:368` | not-found 두 분기에서 `save(spawnedRow)` 대신 이미 파일 내 `finalizeGuarded`/`completeRetryExecution` 이 쓰는 targeted `createQueryBuilder().update().set({status, error, finishedAt})` 패턴을 쓰거나, `save()` 호출 전 in-memory `spawnedRow.inputData` 에서 `_retryState` 를 명시적으로 delete해 DB 상태와 맞춘다. |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / Concurrency | 위 Critical #1과 직결된 테스트 공백 — 신규 테스트 (b2)/(b3)는 "이 delivery 자신의 claim이 affected:0을 반환"하는 경우만, (c)는 "애초에 `_retryState`가 없던" 손상 케이스만 시뮬레이션한다. "다른/이전 delivery가 이미 claim해 이 delivery의 최초 조회 시점에 이미 `_retryState`가 없는"(=실제 레이스 진입점) 경로와 "claim 성공 후 예외→BullMQ 재시도" 경로는 어떤 계층에서도 검증되지 않는다. | `retry-turn.service.spec.ts:386-447` ((b2)/(b3)/(c)) | `findOneBy` mock이 `status:RUNNING`+`inputData:{}`(이미 소비된 것처럼)를 반환하도록 구성하고 이때 `save()`가 호출되지 **않아야** 함을 고정하는 케이스, 그리고 claim 성공 후 예외 발생 시 재시도가 안전한지 검증하는 케이스를 추가. |
| 2 | Architecture | `continuation-execution.processor.ts`가 `retry_last_turn`을 공용 원자 claim(`claimResumeEntry`)에서 제외하는 결정이 오직 "`applyRetryLastTurn`이 자체 원자 claim을 수행한다"는 사실 하나에 의존하는데, 이 의존관계가 두 파일의 프로즈 주석으로만 연결돼 있고 타입 시스템/공유 상수로 강제되지 않는다. 이 정확한 결합이 이미 한 번(5R) CRITICAL로 깨진 이력이 있다. | `continuation-execution.processor.ts:93` (`type !== 'cancel' && type !== 'retry_last_turn'`) | "타입별 claim 전략"을 한 곳(공유 상수/테이블)에 명시하고 양쪽이 참조하게 하거나, `applyRetryLastTurn`의 claim이 제거되면 실패하는 통합 회귀 테스트를 두 파일이 공유하는 불변식으로 명시적으로 문서화. |
| 3 | Architecture / Maintainability | JSONB 키-제거 원자 claim 패턴(`input_data - '_retryState'`, `jsonb_exists(...)`)이 동일 파일 내 4곳(신규 2 + 기존 2, `retryLastTurn`의 `output_data` 소비 포함)에 raw SQL 문자열 리터럴로 중복돼 있다. 컬럼/키 이름이 TypeORM 엔티티 메타데이터를 우회해 컴파일 타임 검증이 없고, 한쪽만 리네임되면 조용히 drift한다. | `retry-turn.service.ts:195-208`(기존), `:323-332`(신규) | `const RETRY_STATE_KEY = '_retryState'` 상수화 또는 `jsonbKeyRemoval(column, key)` 타입 헬퍼로 추출해 단일 진실 지점 확보. |
| 4 | Side Effect | claim을 `Promise.all`/`rehydrateContext`/`emitNode`보다 앞으로 당기면서, 커밋 메시지가 명시한 "크래시 트레이드오프"의 실제 적용 범위가 서술보다 넓어졌다 — 프로세스 크래시뿐 아니라 이 구간(try/catch 밖)의 **일반 예외**(DB 커넥션 오류, WS emit 실패 등)에도 동일하게 적용돼, 일시적 오류였음에도 row가 RUNNING으로 영구 잔류할 수 있다. `rehydrateContext` 성공 후 실패하면 in-memory `ExecutionContext` 항목도 함께 누수된다. | `retry-turn.service.ts:323-332`(claim)~`:420`(try 시작) 사이 구간, 특히 `:343-418` | `recoverStuckExecutions`가 이 시나리오(원본 Execution이 아니라 retry 재진입 특유의 spawn row)까지 실제로 복구하는지 별도 검증·문서화. 최소한 이 구간 실패 시 `spawnedRow`를 FAILED로 마감하는 방어 처리 고려. (※ Critical #1 수정 방향에 따라 이 WARNING의 잔여 범위가 달라질 수 있음 — 두 항목을 함께 검토할 것.) |
| 5 | Scope | 이 fix와 무관한 backlog 항목(#11 GraphRAG "노드/엣지" 명명 회피 규칙, harness impl-prep 게이트 관측)이 같은 커밋에 plan 문서 신규 섹션으로 추가됨. 문서 전용(`plan/**`)이라 런타임 리스크는 없고 "발견 즉시 plan 기록" 관례에는 부합하나, 커밋 단위 단일 관심사 원칙에서 벗어난다. | `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md:576-583`, `plan/in-progress/harness-consistency-summary-downgrade-rule.md:135-156` | 별도 커밋(또는 project-planner 턴)으로 분리 권장. 리스크 낮음. |
| 6 | Maintainability | `applyRetryLastTurn`이 이번 diff로 더 길어지고(총 184줄) 분기점이 9~10개로 늘었다. 신규 ATOMIC CLAIM 블록(31줄)은 "claim 성공 여부(boolean) 반환"이라는 성격이 명확해 독립 추출이 자연스럽다. backend eslint에 `max-lines-per-function`/`complexity` 룰이 없어 정적 게이트가 없다. | `retry-turn.service.ts:268-451`(메서드 전체), 신규 블록 `:310-339` | `private async claimSpawnedRetryRow(spawnedNodeExecutionId): Promise<boolean>` 로 분리, `claimResumeEntry`/`finalizeGuarded` 네이밍 관례와 정합. |
| 7 | Testing / Database | 신규 claim SQL(`applyRetryLastTurn`)이 실 Postgres로 검증된 테스트가 전무 — mock 쿼리빌더 문자열 비교(`(b3)`)만 존재하고, `jsonb_exists`/`-` 연산자가 실제 DB에서 동시 UPDATE 상황에 정확히 1/0을 반환하는지는 unit도 e2e도 검증하지 않는다(`grep -rl "retry_last_turn" test/` 0건). 자매 메서드 `retryLastTurn`의 동일 패턴에 대해 plan이 이미 이 갭을 P2로 추적 중이나, 그 항목 문구는 이번 신규 claim을 언급하지 않는다. | `retry-turn.service.ts:323-332`, `retry-turn.service.spec.ts:406-434` | `plan/in-progress/retry-turn-terminal-guard.md` 백로그 #3/#4 범위를 이번 claim까지 넓히거나 별도 항목 신설. `test/execution-stalled-redelivery.e2e-spec.ts` 패턴을 재사용해 실 Postgres 대상 동시 UPDATE e2e 추가. |
| 8 | Testing | 실제 handler/orchestrator를 구동하는 integration-level engine spec(`execution-engine.service.spec.ts`)이 claim 실패(`affected=0`) 분기를 단 한 번도 실행하지 않는다 — `retryClaimQb.execute`가 스펙 전체에서 `{affected:1}`로 한 번만 설정되고 override되지 않는다. 현재는 코드 순서상 안전하나 향후 가드 순서 변경 시 이 레이어는 회귀를 못 잡는다. | `execution-engine.service.spec.ts:369-381`, describe `applyRetryLastTurn (multi-turn loop re-entry)` (~16667행) | `retryClaimQb.execute.mockResolvedValueOnce({affected:0})` override 케이스 1개 추가해 통합 레벨에서도 조기 discard 고정. |
| 9 | Documentation | 클래스/메서드 최상위 docstring이 이번 PR의 핵심 추가사항(`applyRetryLastTurn`의 2차 원자 claim)을 반영하지 않는다 — "책임" 문단은 atomic-consume을 `retryLastTurn`에만 귀속시키고, "재진입 절차" 1~7 목록에도 claim 단계가 없다. | `retry-turn.service.ts:39-43`(클래스 docstring), `:252-266`(재진입 절차 목록) | "책임" 문단에 claim 존재를 한 줄 추가하고, 절차 목록에 claim 단계를 번호 매겨 삽입. |
| 10 | Documentation | (pre-existing, 이번 PR 도입 아님이나 수정 대상 메서드 바로 안에 위치) `retryLastTurn`/`applyRetryLastTurn` docstring이 이미 제거된 `runAiConversationLoop`를 재진입 구동 메서드로 계속 인용한다 — 실제 호출부는 `processAiResumeTurn`. | `retry-turn.service.ts:113`, `:259` | 두 인용을 `processAiResumeTurn`(`:426-435`)으로 정정. |
| 11 | Documentation | (pre-existing) `ContinuationExecutionProcessor` 클래스 docstring의 "처리 흐름"이 이미 제거된 `pendingContinuations` fast-path 2-경로 모델을 서술 — 실제 `process()` 본문엔 해당 로직이 없고, spec/engine 주석 모두 "slow-path(rehydration)로 일원화됨"을 확정한다. 이번 PR이 바로 아래 추가한 claim 설명과 인접해 오해를 유발할 수 있다. | `continuation-execution.processor.ts:28-37` | "처리 흐름" 절을 spec 서술과 일치하도록 정정하거나 "레거시/제거됨" 표시 추가. |
| 12 | Documentation | CHANGELOG.md 미갱신 — 같은 파일을 다룬 직전 커밋(`771801e3e`)은 Unreleased 절에 항목을 등재했는데, 실질 데이터 무결성/과금 버그를 닫는 이번 커밋은 대응 항목이 없다. | `CHANGELOG.md` (변경 없음) | Unreleased 절에 "retry_last_turn 재진입 중복 배달 방지(원자 claim)" 항목 추가. |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | TOCTOU 레이스(CWE-362)를 원자 UPDATE로 닫은 정상적 보안/무결성 개선 — 락 없는 인스턴스-로컬 컨텍스트 공유·중복 LLM 과금·downstream 도구 중복 실행을 방지하는 방향의 수정임을 확인. | `retry-turn.service.ts:323-339` | 조치 불필요. |
| 2 | Security / Database / Dependency | 신규 SQL의 인젝션 표면 없음 확인 — 가변 값은 전부 TypeORM 바인드 파라미터(`:id`, `:running`), raw 문자열(`input_data - '_retryState'`, `jsonb_exists(...)`)은 사용자 입력이 섞이지 않는 고정 리터럴. | `retry-turn.service.ts:326-331` | 조치 불필요. |
| 3 | Security | 크래시-중단 턴 재배달 차단의 트레이드오프는 문서화됐고 실재하는 백스톱(`recoverStuckExecutions`, `execution-engine.service.ts:3040`)으로 완화됨을 확인. | `retry-turn.service.ts:320-322` | 조치 불필요. |
| 4 | Security | 진입점(`retryLastTurn`)의 인증/인가(WS 게이트웨이 소유권 검증, NOT_FOUND 통일로 IDOR 추론 차단)는 diff 범위 밖에서 정상 작동 중이며 새로운 우회 경로 없음. | `websocket.gateway.ts:806-841` (참고용, diff 밖) | 조치 불필요. |
| 5 | Dependency | 새 외부 패키지 의존성 없음 — 기존 `nodeExecutionRepository.createQueryBuilder()` API만 재사용, `package.json`/lockfile 변경 없음. | `retry-turn.service.ts:323-332` | 조치 불필요. |
| 6 | Dependency | `continuation-execution.processor.ts` ↔ `retry-turn.service.ts` 간 "서술적 의존성"(자기모순 주석, 5R CRITICAL 원인)이 이번 커밋으로 실제 원자 보장이 채워지고 양쪽 주석이 정합돼 해소됨. | `continuation-execution.processor.ts:83-92` ↔ `retry-turn.service.ts:310-322` | 향후 `claimResumeEntry` 대상 타입 목록 변경 시 두 주석 동반 갱신 필요. |
| 7 | Performance | 원자 claim 추가로 `applyRetryLastTurn` 호출당 DB round-trip 1회 순증하지만, job당 1회만 실행되는 저빈도 경로 + PK 등치 단일 행 UPDATE라 영향 미미. claim 실패 시 이후 `Promise.all` 조회를 건너뛰는 순서 배치는 오히려 긍정적. | `retry-turn.service.ts:323-346` | 조치 불필요. `CONTINUATION_WORKER_CONCURRENCY` 대폭 상향 시 재확인 권장. |
| 8 | Architecture | (diff 범위 밖, 사전 존재) `RetryTurnService` 생성자의 순환 DI 주석("엔진이 본 서비스를 주입받으므로")이 클래스 docstring("엔진→Retry 역방향 주입 제거") 및 실제 배선(엔진이 더 이상 주입 안 받음)과 불일치. | `retry-turn.service.ts:78-80` vs `:51-57` | 주석을 현재 배선에 맞게 갱신하거나 forwardRef의 실제 필요 근거로 교체. |
| 9 | Maintainability | 주석의 조건 순서(`jsonb_exists` 먼저 설명)와 실제 `.andWhere()` 체이닝 순서(`status` 먼저)가 어긋남 — SQL `AND`는 교환 법칙이 성립해 동작엔 무영향. | `retry-turn.service.ts:314-318`(주석) vs `:328-331`(코드) | 순서를 맞추면 대조가 쉬워짐(선택). |
| 10 | Documentation | 신규 ATOMIC CLAIM 주석이 동반 신설된 spec Rationale(§7.5 "retry 재진입의 원자 claim")을 인용하지 않음. | `retry-turn.service.ts:310-322` | 주석 말미에 spec §7.5 참조 한 줄 추가. |
| 11 | Documentation (참고, 리뷰 대상 외) | 관련 plan 체크리스트 2건이 이번 커밋의 완료 사실을 반영하지 않음(`- [ ]` 잔존). | `plan/in-progress/retry-turn-terminal-guard.md`, `plan/in-progress/spec-update-node-cancellation-shutdown-classification.md` | 해당 항목 체크 + 커밋 해시(`b351731f0`) 기록. |
| 12 | User Guide Sync | "실행·디버깅 흐름 변경" semantic trigger 그레이존 직접 검증 — `05-run-and-debug/run-results.mdx`(+en)의 기존 재시도 서술(에러 코드 3종·60분 윈도우·downstream 계속 진행)은 이번 원자성 버그 수정으로 전혀 달라지지 않음을 대조 확인. 동반 갱신 갭 없음. | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` | 조치 불필요. |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | CRITICAL | claim이 기존 "_retryState 부재→FAILED" 판정 뒤에 삽입돼 정상 동시 배달을 손상으로 오분류·무가드 종결 |
| concurrency | CRITICAL | 위와 동일 결함 + BullMQ 기본 재시도만으로 진짜 동시성 없이 결정적 재현 가능함을 논증 |
| requirement | HIGH | 위와 동일 결함(요구사항 관점: "이중 실행 0" 불변식이 좁은 창에서 미성립) + 테스트 공백 |
| side_effect | HIGH | claim 성공 후 not-found 분기의 stale save()가 TypeORM jsonb diff로 `_retryState` 되살림 (별개 CRITICAL) + 크래시 트레이드오프 범위 확대 |
| testing | LOW | 신규 claim SQL 실DB 미검증, 통합 스펙이 claim 실패 분기 미실행 — 둘 다 방어심도 이슈 |
| database | LOW | 신규 claim SQL 실 Postgres 동시성 검증 없음(테스트 리뷰어와 동일 갭) |
| documentation | LOW | 핵심 docstring 미반영, pre-existing stale 참조 2건, CHANGELOG 누락 |
| maintainability | LOW | 함수 비대화(helper 추출 권장), JSONB 키 리터럴 중복, 히스토리 서사 3파일 반복 |
| scope | LOW | 무관한 plan 문서 편집 2건이 같은 커밋에 동반(문서 전용, 런타임 무영향) |
| performance | LOW | round-trip 1회 순증, 저빈도 경로라 무시할 수준 |
| security | NONE | TOCTOU 개선 확인, 인젝션 없음, 인가 경로 정상 |
| dependency | NONE | 신규 의존성 없음, 서술적 의존성 불일치 오히려 해소 |
| api_contract | NONE | 공개 API/WS 계약 변경 없음(내부 동시성 로직) |
| user_guide_sync | NONE | 유저가이드 동반 갱신 갭 없음(그레이존 직접 검증 완료) |

## 발견 없는 에이전트

- **api_contract** — REST/WS 요청·응답 스키마, 에러 코드, URL 설계, 인증/인가 어느 것도 변경 없음. "발견사항: 없음" 명시.

## 권장 조치사항

1. **(최우선, 병합 전 필수)** `applyRetryLastTurn` 의 "`_retryState` 부재→FAILED" 판정(`:293-308`)을 신규 원자 claim(`:310-339`) **이후**로 옮기거나, claim 실패(`affected!==1`)를 원인 구분 없이 항상 ack-and-discard로 통일해 별도의 파괴적 "손상→FAILED" 분기를 제거한다(architecture·requirement·concurrency 공통 CRITICAL #1).
2. **(최우선, 병합 전 필수)** claim 성공 후 execution/node not-found 분기(`:347-358`, `:359-370`)에서 stale in-memory `spawnedRow` 를 `save()` 하기 전에 `_retryState` 를 명시적으로 제거하거나, targeted column update(`finalizeGuarded` 패턴)로 교체해 claim이 지운 값이 되살아나지 않게 한다(side_effect CRITICAL #2).
3. 위 두 수정에 대한 회귀 테스트 추가 — (a) 선행 claim 성공 직후(status 여전히 RUNNING) 재배달/재시도되는 케이스가 FAILED 오마킹 없이 안전하게 discard되는지, (b) not-found 분기 이후 DB에 `_retryState` 가 재생되지 않는지(WARNING #1과 짝).
4. claim ~ try 진입 전 구간(Promise.all/rehydrateContext/buildRetryReentryState/setNodeOutput/emitNode)의 예외 처리 범위를 재검토하고, "크래시 트레이드오프" 문서화를 실제 적용 범위(일반 예외 포함)에 맞게 갱신, `recoverStuckExecutions` 가 이 특유의 spawn-row 시나리오까지 복구하는지 검증(WARNING #4).
5. `applyRetryLastTurn` 을 `claimResumeEntry` 공용 claim에서 제외하는 결정을 코드 차원의 명시적 계약(공유 상수/테이블 또는 통합 회귀 테스트)으로 강제해 향후 재발(이미 5R에서 1회 발생)을 구조적으로 방지(WARNING #2).
6. 신규 claim SQL 에 대한 실 Postgres 기반 동시성 e2e 테스트 추가(plan 백로그 #3/#4 범위 확장, WARNING #7) + 통합 레벨 engine spec에 claim 실패 분기 케이스 추가(WARNING #8).
7. (낮은 우선순위, 점진 개선) `applyRetryLastTurn` helper 추출(WARNING #6), `_retryState` 키 리터럴 상수화(WARNING #3), 클래스/메서드 docstring에 2차 claim 반영 및 pre-existing stale 참조(`runAiConversationLoop`, `pendingContinuations`) 정정, CHANGELOG 항목 추가(WARNING #9~12), 무관 plan 문서 편집은 별도 커밋으로 분리(WARNING #5).

## 라우터 결정

- `routing_status=skipped` — 라우터 미사용, 전체 14명 reviewer 실행(prompt에 별도 `routing_skip_reason` 문자열 없음).
- **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, dependency, database, concurrency, api_contract, user_guide_sync (14명, 전원 success)
- **제외**: 없음
- **강제 포함(router_safety)**: maintainability, requirement, scope, security, side_effect, testing (6명) — 라우터가 스킵되어 사실상 전원 실행에 포함됐으며, **forced 전원 결과 확보 확인됨**(강제 화이트리스트 미이행 없음).