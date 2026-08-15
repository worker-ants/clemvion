# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 은 0건(1차 라운드가 잡은 int4 오버플로 CRITICAL 은 클램프+테스트로 확실히 해소됨을 이번 라운드 전원이 재확인). 다만 `testing` 리뷰어가 MEDIUM 으로 판정한 두 회귀-테스트 공백(driveCallStackResume emit 미검증, raw UPDATE RETURNING threading 미검증)이 실질적 안전망 갭으로 남아 있고, 그 외 6개 리뷰어가 각각 LOW 로 판정한 WARNING(값 불일치·집계 오염·API 비대칭·계층 관례 위반)이 누적돼 있어 전체 위험도를 MEDIUM 으로 집계한다. forced(router_safety) 화이트리스트 7명 전원 결과가 확보돼 있어 강제 항목 누락은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Testing | `driveCallStackResume` 완료 경로의 `durationMs` emit 을 검증하는 회귀 테스트가 두 라운드째 요청되고도 미이행. 코드 방어는 형제 5경로와 동형으로 이미 맞춰졌으나(계산부/emit부 모두 `resolveTerminalDurationMs` 경유), 이를 고정하는 `EXECUTION_COMPLETED` payload 단언이 없다 | `execution-engine.service.ts` `driveCallStackResume` (계산 :2576-2577, emit :2593) / 테스트 `execution-engine.service.spec.ts` `driveCallStackResume ... (CRITICAL #1)` 블록(:16185~:16800, Case1 :16279, Case2 :16393) | Case1/Case2 완료 테스트에 `eventEmitter.emitExecution`(또는 `mockWebsocketService.emitExecutionEvent`) 스파이 추가, `durationMs` 최소 1건(`expect.any(Number)`) 단언 |
| 2 | Testing | raw UPDATE 취소 경로 5곳 중 4곳(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled`/`cancelParkedExecution`)이 `durationMs` 의 DB→wire threading 을 실제로 단언하지 않음. 특히 `markExecutionCancelled` 는 mock 이 이미 `raw: [{ duration_ms: 1234 }]` 를 갖고 있는데도 emit 단언이 빠져 있어 비용이 거의 0인데 미이행 | `execution-engine.service.spec.ts` — `markWebChatIdleTimeout`(:2978/:3054-3061), `markQueueWaitTimeout`(:4372/:4537-4546), `markExecutionCancelled`(:14770-14801/:14984-14993), `cancelParkedExecution`(:3160-3167/:3193-3213) | `markExecutionCancelled` 는 `durationMs: 1234` 단언 한 줄 추가로 즉시 해소 가능. 나머지는 이미 트래커 등재된 사안 |
| 3 | Requirement / Side Effect / Database | retry-turn CANCELLED 재진입 시 DB(`COALESCE` 로 보존된 T1)와 emit payload(in-memory T2)의 `durationMs` 가 어긋날 수 있음 — "DB=wire" 불변식의 잔여 예외. 이 PR 자신이 3차 라운드에서 발견해 트래커에 등재·이연했고, 이번 4차 라운드가 소스 재확인으로 여전히 미수정임을 재확인 | `retry-turn.service.ts` `finalizeGuarded` CANCELLED 분기(:637-651, `COALESCE(duration_ms, :newDurationMs)`) + `failRetryExecution` emit(:964-977, `resolveTerminalDurationMs(execution)`) | `finalizeGuarded` CANCELLED 분기에 `.returning(['duration_ms'])` 추가해 실제 persist 값을 되읽어 emit 전 갱신. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` (10_34_51 W1) 등재, 후속 PR 처리 |
| 4 | Side Effect / Database | 새로 채워지는 `duration_ms` 가 "대기 시간"(park 무기한, 위젯 idle-wait grace 1시간)까지 담게 되어, status 필터 없는 AVG 집계 3곳(대시보드 `avgExecutionTime`, 통계 `avgDurationMs` 요약+workflow 랭킹)을 오염시킴 | `dashboard.service.ts:96`, `statistics.service.ts:95,221` (소비처, 이 PR diff 밖) | 이미 `spec-sync-external-interaction-api-gaps.md`(10_34_51 W3) 등재. 후속 PR 에서 집계 쿼리에 `status='completed'` 필터 추가 또는 대기-시간/실행-시간 신호 분리 |
| 5 | API Contract | REST 단발 조회(`GET /api/external/executions/:id`, `ExecutionStatusDto`)엔 `durationMs` 가 없어 push 계열(webhook/SSE/WS)과 응답 스키마가 비대칭 — SSE replay_unavailable 이후 `getStatus` 로 보정 시 필드를 다시 잃음 | `execution-status-response.dto.ts`(grep 0건), `spec/5-system/14-external-interaction-api.md` §5.3 | CHANGELOG·plan 트래커(:211)에 이미 등재된 후속(`ExecutionStatusDto` 확장)을 서두를 것. 그 전까지 §5.3 에 "durationMs 는 push 전용" caveat 추가 고려 |
| 6 | Architecture | 신설 `TERMINAL_DURATION_MS_SQL` 이 `shared/utils/` 의 "DB-엔진 비의존 순수 유틸" 관례를 이 PR 이 처음으로 깨뜨림 — Postgres 전용 문법·컬럼명이 문자열 상수로 포함됨 | `codebase/backend/src/shared/utils/terminal-duration.ts:87-90` | 강제 아님. `shared/persistence/` 로 분리하거나 파일 상단에 "이 파일은 예외적으로 Postgres SQL 조각을 포함한다" 한 줄 명시 |
| 7 | Architecture | 동일 도메인 규칙(음수→null, int4 상한 클램프)이 TS 와 SQL 두 곳에 독립적으로 수기 구현돼 있어 "한 곳에서 결정한다"는 JSDoc 선언과 달리 SSOT 가 갈라져 있음. 동기화 안전망은 문자열 `toContain` 뿐, 값 수준 통합 테스트 없음 | `terminal-duration.ts:39-41`(JS 분기) vs `:87-90`(SQL CASE) | 이 PR 범위에서 강제 아님(원자성상 SQL 표현 불가피). 값 수준 e2e/통합 테스트를 이 drift 위험을 메우는 유일한 실질 방어로 우선순위화 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Documentation | `plan/in-progress/eia-terminal-payload.md` "차단 해제 조건" 절이 이미 해소된 BLOCK 상태를 현재형으로 서술해 바로 아래 체크리스트("차단이 풀렸다")와 모순되어 보임. 직전 consistency 라운드가 이미 지적·비차단 처분했으나 아직 미반영 | `plan/in-progress/eia-terminal-payload.md:275-281` | 절 머리에 "(해소됨 — 아래 체크리스트 참조)" 한 줄 추가 |
| 2 | Documentation / Maintainability | `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스의 5줄 설명 주석이 글자 그대로 3중 복제 — 향후 한 곳만 갱신되고 나머지가 stale 로 남을 drift 표면 | `codebase/backend/src/modules/chat-channel/types.ts:392-396, 415-419, 433-437` | 한 곳(예: `EiaCompletedEvent`)에 canonical 설명, 나머지는 짧은 포인터로 축약 |
| 3 | Documentation | `durationMs` 변경을 "breaking" 으로 부르는 테스트 주석/RESOLUTION 서술이 CHANGELOG 본문의 자기 선언("제거·변경 아님")과 어긋남 | `chat-channel.dispatcher.spec.ts:372-373` vs `CHANGELOG.md:17` | 표현을 "null 방어가 필요한 계약"으로 통일하거나 절충 문구 채택 |
| 4 | Maintainability | 신규 `chat-channel.dispatcher.spec.ts` `mk` 헬퍼가 이 파일의 지배적 컨벤션(캐스트 없는 직접 타입 리터럴)과 달리 `as unknown as ExecutionChannelEvent` 캐스트를 사용 | `chat-channel.dispatcher.spec.ts` `mk` 헬퍼(신규 describe 블록 상단) | 필수 아님. `Partial<ExecutionChannelEvent>` 로 좁히거나 캐스트 사용 이유를 주석으로 남김 |
| 5 | Testing | `terminal-duration.spec.ts` "NaN/Infinity" 테스트 제목이 실제로는 NaN 케이스만 실행 — 커버리지를 실제보다 넓게 주장 | `terminal-duration.spec.ts:65-73` | `it.each(['NaN','Infinity'])` 로 분리하거나 제목을 좁힘 |
| 6 | Testing | `chat-channel.dispatcher.spec.ts` 신규 `null`/키부재 케이스가 `completed` 상태로만 검증되고 `failed`/`cancelled` 로는 반복되지 않음 (분기 3곳이 동형이라 실질 위험은 낮음) | `chat-channel.dispatcher.spec.ts` `describe('toChatChannelEvent — durationMs 전파')`(:374-416) | 강제 아님. `it.each` 매트릭스에 편입하면 더 촘촘해짐 |
| 7 | Architecture | "엔티티에 durationMs 대입 → 몇 줄 뒤 emit payload 재계산" 관용구가 16개 종결 지점에 동형 반복 — 다음 필드(`result.outputs`) 추가 시 같은 grep-audit-재수정 사이클 재발 소지 | `execution-engine.service.ts` 다수 지점, `retry-turn.service.ts` 다수 지점 | 다음 필드 추가 전 `stampAndBuildTerminalFields(entity, extra?)` 류 단일 진입점 리팩터 고려 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션 표면 없음(하드코딩 상수+파라미터 바인딩), 1차 라운드 CRITICAL(int4 클램프) 해소 재확인, 인증/인가·시크릿 노출 없음 |
| architecture | LOW | `shared/utils` DB 비의존 관례를 이 PR 이 처음 위반, TS/SQL 규칙 이중구현으로 SSOT drift 위험 (WARNING 2건) |
| requirement | LOW | 16 emit 경로 전수 검증 완료, 잔여 WARNING 2건(retry-turn 값 불일치, driveCallStackResume 테스트 공백) 모두 이미 트래커 등재분 재확인 |
| scope | LOW | 직전 라운드 지적 과잉 스코프(NodeExecution 8곳) 완전 되돌림 확인, 신규 스코프 이탈 없음 |
| side_effect | LOW | AVG 집계 오염 재확인(WARNING), retry-turn 값 불일치 재확인(INFO), driveCallStackResume/NodeExecution 회귀 모두 해소 확인 |
| maintainability | LOW | W2 되돌림 확인, `mk` 헬퍼 캐스트 컨벤션 이탈(INFO) 외 신규 CRITICAL/WARNING 없음 |
| testing | MEDIUM | driveCallStackResume emit 테스트 부재, raw UPDATE RETURNING threading 미검증 4/5경로 (WARNING 2건) |
| documentation | LOW | plan stale 서술·주석 3중복·"breaking" 표현 불일치 (INFO 3건), 실질 결함 없음 |
| database | LOW | AVG 집계 오염(WARNING), retry-turn 값 불일치(INFO) 재확인. CRITICAL 해소·트랜잭션 원자성·인덱스 모두 견고 |
| api_contract | LOW | REST/push `durationMs` 스키마 비대칭(WARNING), 순수 additive 하위호환 유지, URL 버전 위반 이미 정정 확인 |
| user_guide_sync | NONE | 매트릭스 21행 전수 대조 결과 매칭 trigger 없음, frontend 변경 0건 |

## 발견 없는 에이전트

- user_guide_sync (매칭되는 doc-sync-matrix trigger 없음, frontend/i18n 변경 0건)

## 권장 조치사항

1. `markExecutionCancelled` 에 `durationMs` emit 단언 한 줄 추가 (비용 거의 0, WARNING #2 일부 즉시 해소).
2. `driveCallStackResume` 완료 경로에 `EXECUTION_COMPLETED` emit 스파이 + `durationMs` 단언 추가 (WARNING #1, 두 라운드째 요청됨).
3. 후속 PR 에서 retry-turn CANCELLED 재진입 `finalizeGuarded` 에 `.returning(['duration_ms'])` 추가해 DB/wire 값 불일치 해소 (WARNING #3, 이미 트래커 등재).
4. 후속 PR 에서 대시보드/통계 AVG 집계 쿼리에 `status='completed'` 필터 추가해 대기-시간 오염 제거 (WARNING #4, 이미 트래커 등재).
5. `ExecutionStatusDto` 에 `durationMs` 확장해 REST/push 스키마 비대칭 해소 (WARNING #5, 이미 트래커 등재).
6. 나머지 raw UPDATE 3경로(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`cancelParkedExecution`)에도 실값 threading 단언 추가 검토.
7. INFO 항목(주석 3중복, plan stale 서술, mk 헬퍼 캐스트)은 급하지 않음 — 다음 편집 시 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — **forced 전원 결과 확보됨, 누락 없음**

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단(이번 changeset 은 신규 쿼리·N+1·핫패스 성능 영향 없다고 분류) |
  | dependency | router 판단(신규 의존성 패키지 추가 없음) |
  | concurrency | router 판단(신규 동시성 프리미티브·락 변경 없음) |