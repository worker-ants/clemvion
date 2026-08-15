# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 없음. `driveCallStackResume` 완료 경로가 형제 5경로와 다르게 `durationMs` 음수(시계 역행) 클램프를 우회하는 side-effect WARNING(MEDIUM)과, raw UPDATE 5경로 중 4곳이 `durationMs` 실값 threading 을 검증하지 못하는 testing WARNING(MEDIUM)이 핵심. 나머지는 문서·주석 drift 급 WARNING/INFO.

forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음. router 가 제외한 `performance, architecture, dependency, concurrency` 는 이번 diff 성격(순수 백엔드 로직 배관, 신규 의존성/아키텍처 변경 없음)과 부합.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | side_effect | `driveCallStackResume` 완료 경로만 `resolveTerminalDurationMs` 의 계산-측 방어(음수/NaN → null)를 우회 — 이미 채워진 `durationMs` 를 재계산 없이 그대로 뺄셈(`finishedAt.getTime() - startedAt.getTime()`)해 시계 역행 시 다른 5경로와 달리 음수를 그대로 wire 로 내보낼 수 있음. 테스트 커버리지도 0건 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2576-2578`(계산부), `:2594`(emit) | 형제 경로와 동일하게 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 로 통일하고, 이 경로의 `durationMs` emit 단언(양수/null) 테스트 추가 |
| 2 | testing | raw UPDATE 엔티티 미로드 5경로 중 4곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markQueueWaitTimeout`·`markExecutionCancelled`)은 `RETURNING duration_ms` 실값이 emit payload 까지 정확히 threading 되는지 검증하는 테스트가 없음(`null`/기본값 경로만 커버되거나, 실값 mock 은 있는데 emit 단언에서 `durationMs` 자체를 검사 안 함) | `execution-engine.service.spec.ts:2978-2986, 3160-3167, 3207-3213, 14915-14994` | 4곳 각각 `execute` mock 이 `{ raw: [{ duration_ms: <숫자> }] }` 반환하는 케이스 추가, emit 단언에 `durationMs: <숫자>` 명시 |
| 3 | testing | `markQueueWaitTimeout`·`failFirstSegmentSetup` 실제 구현 본문이 유닛 테스트에서 한 번도 직접 실행되지 않고 항상 `jest.spyOn(...).mockResolvedValue(...)` 로 대체됨 — 이번 PR 이 추가한 신규 `durationMs` 로직이 두 함수에서 완전 미검증 | `execution-engine.service.spec.ts:1750-1758, 4371-4379, 3800-3802, 3828-3830` | `markWebChatIdleTimeout` 과 동일 패턴(private 캐스팅 직접 호출)으로 최소 1개씩 테스트 추가, emit payload `durationMs` 단언 |
| 4 | testing | `TERMINAL_DURATION_MS_SQL`(직전 라운드 CRITICAL 수정 지점)이 실제 Postgres 실행 결과로 검증된 적 없음 — 유일한 관련 e2e 도 `duration_ms` assert 안 함 (이미 plan 트래커에 미체크 상태로 등재돼 있으나 이번 PR엔 미반영) | `terminal-duration.spec.ts:110-133`(문자열 `toContain` 뿐), `webchat-idle-reaper.e2e-spec.ts`(0건) | 이번 라운드 강제 조치는 아니나, CRITICAL 이력을 고려해 e2e `duration_ms >= 0` sanity 단언 우선순위 상향 권고 |
| 5 | testing | "노드 0개 그래프 → completed emit 시 `durationMs` undefined" 회귀를 막기 위해 계산을 조건 블록 밖으로 옮겼으나, 그 정확한 시나리오를 실제 코드 경로로 검증하는 캐너리 테스트가 없음 | `execution-engine.service.ts:2404-2412`, `execution-engine.service.spec.ts:3505-3537, 7055-7067` | `findBy` 를 빈 배열로 mock 하고 실제 `execute()` 실행 후 `EXECUTION_COMPLETED` payload 의 `durationMs` 가 `expect.any(Number)`(not undefined)인지 단언하는 테스트 추가 |
| 6 | requirement / database / documentation (중복 통합) | `finalizeStalledExhausted` 호출부 인라인 주석이 이미 대체된 옛 SQL(`GREATEST(0, …)`)을 현재형으로 설명 — 실제로는 `CASE WHEN … THEN NULL ELSE LEAST(2147483647, …) END`(음수→NULL, 상한 클램프). 다음 편집자가 방금 고친 CRITICAL 방어를 오해해 되돌릴 위험 | `execution-engine.service.ts:3352` | 주석을 현재 동작(`LEAST(2147483647, …)` + `THEN NULL`)에 맞게 정정하거나 `terminal-duration.ts` JSDoc 링크로 축소 |
| 7 | requirement | spec §6.3/§6.4 "정규 예시" JSON 이 여전히 `JSON.parse` 기준 무효 — 직전 라운드가 지적한 "콤마 누락"을 고치는 과정에서 반대로 "`durationMs` 뒤 trailing comma"라는 새 결함 발생 | `spec/5-system/14-external-interaction-api.md:757`(§6.3), `:779`(§6.4) | 두 곳 모두 `"durationMs": 4242,` → `"durationMs": 4242`(마지막 필드, 콤마 제거) |
| 8 | requirement | `chat-channel.dispatcher.ts` 가 이번 PR 이 넓힌 `durationMs: number \| null` 계약(EiaCompletedEvent 등 3종)을 반영 못 함 — 여전히 `{ durationMs?: number }` 로 좁게 캐스팅. 현재 다운스트림 provider 가 `durationMs` 미소비라 즉시 크래시는 없으나, "null 아님" 이라는 사실과 다른 타입 보장이 남음 | `chat-channel.dispatcher.ts:534, 571, 587` | 캐스트 타입을 `{ durationMs?: number \| null }` 로 정정, 또는 `types.ts` 인터페이스 직접 import |
| 9 | documentation | `plan/in-progress/spec-draft-eia-notification-payload-contract.md` 가 "cancelled 중 DB write 확장 필요 곳 수"를 5로 기재 — 같은 PR 의 자매 plan 표·CHANGELOG·spec §6.5(모두 4)와 불일치(실측: `emitCancellationEvent` 호출부 5곳 중 `finalizeCancelledExecution` 만 엔티티 기로드라 raw UPDATE 불요 = 4가 맞음) | `plan/in-progress/spec-draft-eia-notification-payload-contract.md:188` | "5곳" → "4곳" 정정 |
| 10 | api_contract | push(WS/webhook/SSE) 이벤트에는 `durationMs` 가 실리는데 REST 폴링(`GET /api/external/executions/:id`, `ExecutionStatusDto`)에는 없음 — 신규 스키마 비대칭. 이미 CHANGELOG/plan 에 문서화·유예된 사항이나 계약 관점 실재 불일치 | `execution-status-response.dto.ts`(필드 부재), `spec/5-system/14-external-interaction-api.md` | 후속 PR 에서 `ExecutionStatusDto` 에 `durationMs` 추가 검토 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security | raw SQL 은 상수 리터럴 + 파라미터 바인딩만 사용, SQL 인젝션 표면 없음. `RETURNING` 원본 값은 방어적 파싱(`toFiniteNumber`)으로 비정상 값 wire 유출 차단. 인증/인가 경계·에러 메시지 노출·신규 의존성 변경 없음. 직전 라운드 CRITICAL(int4 상한 미클램프)은 `LEAST(2147483647,…)` 로 실제 해소·테스트 고정 확인 | `terminal-duration.ts`, `execution-engine.service.ts` 5경로 | 없음 |
| 2 | database | 파라미터 바인딩 안전, 트랜잭션 원자성 2곳 정상(park·idle 취소), `finalizeStalledExhausted` 트랜잭션 미포함은 기존 구조(신규 위험 아님). 마이그레이션/인덱스/N+1 해당 없음 | `execution-engine.service.ts` 5경로 | 없음 |
| 3 | api_contract | int4 clamp(saturate) 동작이 §6 캐비엇에 미문서화(우선순위 낮음) | `terminal-duration.ts`, spec §6.5 | 캐비엇 한 줄 추가 권고 |
| 4 | scope | durationMs 와 무관한 spec `/v1/` 오탈자 정정 1줄이 같은 브랜치에 포함됐으나 별도 커밋으로 격리, impl-prep CRITICAL 게이트 해소를 위한 절차상 필수 변경 확인 | `spec/5-system/14-external-interaction-api.md`(커밋 `cdaa4291d`) | 조치 불필요 |
| 5 | scope | 테스트 mock 확장 범위가 실제 프로덕션 SQL 변경 지점(5곳)보다 넓어 보이나, 공유 `beforeEach` 기본 mock 1곳을 넓힌 결과로 실측 확인 | `execution-engine.service.spec.ts` | 조치 불필요 |
| 6 | maintainability | `RETURNING` 파싱 3줄 스니펫이 5곳 반복(직전 라운드에서 "6번째 생기면 재검토"로 이미 보류), `EiaXxxEvent` 3종 인터페이스에 동일 설명 주석 3중복, int4 상한이 SQL 문자열 안 매직넘버, `f(x) ?? x.field` 자기참조 폴백 관용구 10곳 반복 | `types.ts:392-437`, `terminal-duration.ts:88`, 각 서비스 파일 다수 지점 | 전부 낮은 우선순위, 강제 아님(상세 제안은 maintainability.md 참조) |
| 7 | testing | 신규 헬퍼(`resolveTerminalDurationMs`/`toFiniteNumber`) 유닛 커버리지는 모범적(25 케이스, 회귀 재현 케이스 포함), `retry-turn.service.spec.ts` 의 durationMs 단언 4곳도 적절 | `terminal-duration.spec.ts`, `retry-turn.service.spec.ts:691,727,858,894` | 없음 |
| 8 | documentation | CHANGELOG·spec 3개 파일·convention·plan 트래커 전반적으로 높은 동기화 수준. §6.5(cancelled) 는 이 PR 이전부터 JSON 예제 자체가 없는 프로즈-only(신규 갭 아님) | 다수 | 없음 |
| 9 | user_guide_sync | 매트릭스 18개 trigger 전수 순회, 확정 매칭 없음. `run-debug-flow-change` 후보도 실측 결과 UI 가시 동작 불변으로 제외 | 해당 없음 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션 없음, 직전 CRITICAL(int4 상한) 해소 확인 |
| requirement | LOW | dispatcher 타입 drift, 주석-구현 drift, spec JSON 여전히 무효(3건 WARNING) |
| scope | LOW | 무관 변경 없음, mock 확장은 공유 fixture 파급으로 정당 |
| side_effect | MEDIUM | `driveCallStackResume` 만 음수 클램프 우회(신규 발견 핵심) |
| maintainability | LOW | 전부 INFO 급 중복, 다수 이미 보류 결정됨 |
| testing | MEDIUM | raw UPDATE 4/5 경로 실값 threading 미검증, 2개 함수 본문 미실행, SQL 값수준 미검증, 0-node 캐너리 없음 |
| documentation | MEDIUM | 옛 SQL 서술 주석 drift, plan 트래커 수치 불일치(4 vs 5) |
| database | LOW | 파라미터 바인딩/트랜잭션 안전, 동일 주석 drift(WARNING 중복) |
| api_contract | LOW | push/REST 필드 비대칭(이미 유예), saturate 미문서화 |
| user_guide_sync | NONE | 매트릭스 트리거 미매칭, 갱신 대상 없음 |

## 발견 없는 에이전트

없음 — 전 10개 reviewer 모두 최소 1건 이상(WARNING 또는 INFO)을 보고했다.

## 권장 조치사항
1. `driveCallStackResume` 의 durationMs 계산부를 `resolveTerminalDurationMs` 헬퍼 경유로 통일해 음수/NaN 방어를 형제 5경로와 일치시키고, 해당 경로에 emit 단언 테스트를 추가한다 (side_effect WARNING #1 — 가장 실질적 잔여 리스크).
2. raw UPDATE 4경로의 `durationMs` 실값 threading 테스트를 추가하고, `markQueueWaitTimeout`/`failFirstSegmentSetup` 을 직접 호출하는 테스트를 최소 1개씩 추가한다 (testing WARNING #2, #3).
3. `finalizeStalledExhausted` 호출부의 옛 `GREATEST(0, …)` 주석을 현재 SQL 동작에 맞게 정정한다 (documentation/database/requirement 공통 지적 #6) — 향후 CRITICAL 재발 방지 목적으로 우선순위를 낮게 두지 말 것.
4. spec §6.3/§6.4 JSON 예시의 trailing comma 를 제거해 실제로 `JSON.parse` 가능하게 만든다 (requirement WARNING #7).
5. `chat-channel.dispatcher.ts` 의 캐스트 타입을 `durationMs?: number | null` 로 정정한다 (requirement/side_effect/api_contract 공통 지적 #8).
6. `plan/in-progress/spec-draft-eia-notification-payload-contract.md:188` 의 "5곳"을 "4곳"으로 정정한다 (documentation WARNING #9).
7. (낮은 우선순위, 강제 아님) `TERMINAL_DURATION_MS_SQL` 의 Postgres 실값 검증 e2e·0-node completed 캐너리 테스트·`ExecutionStatusDto` durationMs 추가는 이미 plan/CHANGELOG 에 유예 근거와 함께 등재돼 있어 이번 라운드 필수 조치는 아니다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync` (10명)
  - **제외**: 표 (4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(diff 성격상 성능 영향 표면 낮음) |
  | architecture | router 판단(신규 아키텍처/모듈 경계 변경 없음) |
  | dependency | router 판단(신규 의존성 변경 없음, package.json/lockfile diff 없음) |
  | concurrency | router 판단(신규 동시성 프리미티브/락 변경 없음) |