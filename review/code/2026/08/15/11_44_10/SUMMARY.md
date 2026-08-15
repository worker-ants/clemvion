# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — CRITICAL 0건. `testing`(MEDIUM)이 `markQueueWaitTimeout` 경로의 `durationMs` threading 무방비를 뮤테이션으로 실증했고, `architecture`(MEDIUM)는 종결 이벤트 emit 에 컴파일러 강제 초크포인트가 없어 같은 결함 클래스가 6라운드째 반복 재발한다고 지적한다. 나머지는 이미 여러 라운드를 거치며 수렴된 기지 갭의 재확인(INFO/LOW)이다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보 확인됨 — 누락 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | testing | `markQueueWaitTimeout` 의 `durationMs` RETURNING-threading 이 테스트로 전혀 검증되지 않음 — `toFiniteNumber` 추출부를 통째로 깨는 뮤테이션(`?.duration_ms` → `undefined`)을 넣어도 관련 테스트가 여전히 GREEN. 형제 4경로(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·`finalizeStalledExhausted`)는 이번 라운드에 정확 매칭으로 고정됐으나 이 경로만 3라운드째 트래커로 이월 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:2886-2918`(구현, 특히 `:2910-2914`); 테스트 `execution-engine.service.spec.ts:4380`(`mkQb`, `raw: []` 고정)/`:4534` | `mkQb(1)` 이 `raw: [{ id: 'e3', duration_ms: <N> }]` 반환하게 하고 `:4534` 단언에 `durationMs: <N>` 정확 매칭 추가 (추정 5줄 내외) |
| 2 | architecture | 종결 이벤트 emit(`emitExecution(payload: unknown)`)에 payload 형태를 강제하는 컴파일러 초크포인트가 없음 — 같은 근본 원인(필드 하나를 N곳에 손으로 스레딩)의 결함이 6라운드에 걸쳐 반복 재발(W2 형제 4곳 맨손, W1 grep 미검출, JS 클램프 누락, vacuous mock 등). 백로그 등재 위치도 재확인되지 않음 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`(`emitExecution`), 호출부 16곳(`execution-engine.service.ts`/`retry-turn.service.ts`) | 종결 3종 전용 타입 파사드(`emitTerminalExecutionEvent`) 도입을 백로그에 명시적으로 등재 |
| 3 | documentation | `terminal-duration.ts` 자신의 "왜 헬퍼인가" 설명이 "`emitCancellationEvent` 호출부 4곳"이라 적혀 있으나 실측은 5곳 — 같은 사실을 정정한 `execution-engine.service.ts` 쪽 JSDoc(방금 5로 정정됨)과 이 파일 자신의 서술이 어긋남(자매 문서 미적용 패턴의 3번째 재발) | `codebase/backend/src/shared/utils/terminal-duration.ts:20` | `4곳은` → `5곳은` 한 단어 정정 |
| 4 | documentation | `[x]` 완료 체크된 plan 항목(`durationMs emit`)의 본문 절반이 취소선 없이 미완료 상태를 현재형·미래형으로 서술 — "구현되면 flip 한다"는 이미 `0dce2a83f`로 완료된 flip을 미래형으로 남겨둠. 다음 편집자가 "아직 payload 에 안 실린다"로 오독할 소지 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:22-30` | 잔여 원문 취소선 처리 또는 "(해소 — 아래 재판정 참조)"로 닫고, "구현되면 flip" → "flip 했다(§6 표 참조)"로 과거형 정정 |
| 5 | api_contract | (5라운드째 이월, 미해소) REST 단발 조회(`GET /api/external/executions/:id`)와 push 계열(webhook/SSE/WS) 간 응답 스키마 비대칭 — `durationMs` 가 재조회 시 사라짐. CHANGELOG·plan 트래커에 명시적으로 등재된 의도적 유예이며 이 PR 의 신규 회귀는 아님 | `spec/5-system/14-external-interaction-api.md` §5.3; `execution-status-response.dto.ts`(`durationMs`/`duration_ms` 0건) | 후속 PR(`ExecutionStatusDto` + `getStatus()` projection 확장) 진행. 그 전까지 §5.3 예시 옆에 "push 전용, REST 재조회엔 아직 없음" caveat 한 줄 추가 |
| 6 | side_effect (기존 등재 재확인) | `retry-turn.service.ts` `failRetryExecution` 재진입 시 DB(COALESCE 보존값 T1)와 in-memory emit 값(T2)이 갈릴 수 있음 — PR 신규 회귀 아님, 이미 트래커 등재 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` `finalizeGuarded`(CANCELLED 분기) | 트래커 유지, 신규 조치 불요(참고: spec §6.5 "알려진 예외 1건" 콜아웃) |
| 7 | side_effect / database (기존 등재 재확인) | status 필터 없는 평균 집계(대시보드/통계/실행목록 3곳)가 `duration_ms` 의미 혼재(실행시간 vs 대기시간)로 오염될 수 있음 — PR 범위 밖, 이미 트래커 유예 | `duration_ms` 컬럼 소비처 3곳(대시보드/통계/실행목록) | 트래커 유지, 신규 조치 불요 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `resolveTerminalDurationMs` 를 동일 종결 흐름 안에서 두 번(대입 후 재호출) 호출 — 헬퍼가 첫 호출로 채워진 값을 즉시 반환하므로 결과는 항상 동일, 호출만 중복. O(1)·실행 1건당 1회 경로라 영향 무시 가능 (4라운드째 동일 판단 유지) | `execution-engine.service.ts:639/668`, `:2415/2426`, `:2579/2595`, `:3566/3577`, `:4756/4769`, `:4884/4888`, `:4945/4967`; `retry-turn.service.ts:714/730`, `:896/907`, `:949/971` | `durationMs: x.durationMs` 직접 참조 또는 대입 시점 반환값 지역 변수 재사용 (우선순위 낮음) |
| 2 | maintainability | `terminal-duration.spec.ts` 가 int4 상한을 상수 참조(`:78`, `PG_INT4_MAX` 보간)와 리터럴 하드코딩(`:145`, `'LEAST(2147483647'`) 두 경로로 중복 검증 — 상수 값이 바뀌면 `:145` 만 거짓 GREEN 을 낼 수 있음 | `codebase/backend/src/shared/utils/terminal-duration.spec.ts:78, 145` | `` `LEAST(${PG_INT4_MAX}` `` 로 보간 통일 (저비용) |
| 3 | maintainability / documentation | `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일한 5줄 설명 주석 3중 복제 — 이전 라운드부터 이월, 신규 아님 | `codebase/backend/src/modules/chat-channel/types.ts:392-397, 415-420, 433-438` | 이미 보류 결정. 필드가 갈라질 조짐 보이면 공유 타입/템플릿 리터럴 타입 재검토 |
| 4 | testing | `cancelParkedExecution` 은 `durationMs` null 분기만 테스트, RETURNING 이 값을 돌려주는 분기는 미검증(공용 헬퍼 레벨에서 커버되어 회귀 위험은 낮음) | `execution-engine.service.ts:1023-1049`; 테스트 `execution-engine.service.spec.ts:3168, 3192` | 우선순위 낮음. `makeCancelQb(1)` 에 `raw` 채우는 변형 추가 검토 |
| 5 | testing | `TERMINAL_DURATION_MS_SQL` 은 문자열 `toContain` 단언뿐, 실제 Postgres 값 검증 없음 — 이미 트래커 등재(W10) | `terminal-duration.spec.ts` `describe('TERMINAL_DURATION_MS_SQL', ...)` | 기존 트래커 유지(e2e `duration_ms >= 0` sanity 단언 추가), 이번 PR 범위 밖 |
| 6 | testing | `chat-channel.dispatcher.spec.ts` 의 null/레거시-키 테스트가 `'completed'` 상태만 커버(숫자 값은 3상태 `it.each` 커버) | `chat-channel.dispatcher.spec.ts`(`toChatChannelEvent — durationMs 전파`) | `it.each` 를 status 축으로도 파라미터화 (낮은 우선순위) |
| 7 | documentation | `plan/in-progress/eia-terminal-payload.md:275` "차단 해제 조건"이 이미 풀린 BLOCK 상태를 현재형으로 서술 — 5라운드째 재확인, 매번 비차단 처분 | `plan/in-progress/eia-terminal-payload.md:275` | 재차단 사유 아님, 기록 목적 |
| 8 | documentation | `chat-channel.dispatcher.spec.ts:372` "CHANGELOG 가 breaking 으로 고지" 주석 문구가 CHANGELOG 본문 표현과 다소 어긋남 — 실질 모순 아님, 비차단 유지 | `chat-channel.dispatcher.spec.ts:372` | 조치 불요 |
| 9 | api_contract | `durationMs` 가 경로에 따라 "실행 시간"과 "대기 시간"이라는 다른 의미를 실어 나름 — §6.5 콜아웃에 산문으로만 고지, 스키마 레벨 구분자 없음 | spec §6.5 | Wire 스키마 변경은 이 PR 범위 밖, INFO 유지 |
| 10 | security/architecture/scope/requirement/database (다수, 확인 항목) | SQL 인젝션 표면 없음, 트랜잭션 경계 변경 없음, N+1 없음, scope 이탈 없음, JSDoc orphan 해소, `it.each` NaN/Infinity 분리 해소 등 — 6~9라운드에 걸쳐 실측 재확인된 clean 판정 다수 | 각 리포트 참조 | 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션·시크릿·인증 우회 없음. int4 오버플로 CRITICAL 은 이미 JS/SQL 양쪽 해소 재확인 |
| performance | LOW | `resolveTerminalDurationMs` 중복 호출(INFO) 외 N+1/복잡도/캐싱 문제 없음 |
| architecture | MEDIUM | emit payload 컴파일러 강제 초크포인트 부재 — 6라운드 반복 재발 결함 클래스의 구조적 원인, 백로그 등재 위치 미확인 |
| requirement | LOW | 기지 갭 3건(재진입 DB↔emit, 집계 오염, REST 비대칭) 투명 트래킹 재확인. 신규 CRITICAL/WARNING 없음 |
| scope | NONE | 프로덕션 diff 10개 파일 전부 `durationMs` 단일 의도로 수렴, 무관 변경 없음 |
| side_effect | LOW | 신규 전역/env/fs/네트워크 부작용 없음. 기존 WARNING 2건 재확인(신규 아님) |
| maintainability | LOW | JSDoc/매직넘버/호출부 오기 등 이전 결함 전부 해소 확인. `terminal-duration.spec.ts` 상수-리터럴 중복(INFO) 잔존 |
| testing | MEDIUM | `markQueueWaitTimeout` threading 무방비를 뮤테이션으로 실증(WARNING). 나머지는 양호 |
| documentation | LOW | 신규 WARNING 2건(호출부 개수 자매 문서 미적용, plan 취소선 절반 처리) 발견. 나머지는 기지 항목 재확인 |
| database | LOW | int4 클램프 JS/SQL 공유 재확인, SQL 인젝션/트랜잭션/N+1 문제 없음. 기지 갭 재확인만 |
| api_contract | LOW | REST/push 스키마 비대칭 5라운드째 이월(WARNING, 의도적 유예). 신규 breaking change 없음 |

## 발견 없는 에이전트

없음 (11개 reviewer 전원이 최소 1건 이상의 INFO/WARNING 을 보고했으며, security/scope 는 위험도 NONE 이나 확인 항목을 기록함).

## 권장 조치사항

1. `markQueueWaitTimeout` 의 `durationMs` RETURNING-threading 테스트 보강 — 형제 4경로와 동일 패턴으로 mock에 `raw` 값을 채우고 정확 매칭 단언 추가 (testing WARNING #1, 추정 5줄).
2. `terminal-duration.ts:20` 의 "호출부 4곳" → "5곳" 정정 (documentation WARNING #3, 1단어).
3. `spec-sync-external-interaction-api-gaps.md:22-30` 의 `durationMs emit` 항목 잔여 미완료 서술을 취소선 처리하고 flip 완료를 과거형으로 정정 (documentation WARNING #4).
4. 종결 이벤트 emit 컴파일러 강제 초크포인트(`emitTerminalExecutionEvent` 타입 파사드) 도입을 백로그에 명시적으로 재등재 — 6라운드째 같은 결함 클래스가 재발한 구조적 원인 (architecture WARNING #2, 이 PR 범위 밖이나 후속 필수).
5. REST `GET /api/external/executions/:id` 응답에 `durationMs` 추가하는 후속 PR 진행, 또는 그 전까지 spec §5.3 예시에 caveat 한 줄 추가 (api_contract WARNING #5, 5라운드째 이월).
6. (낮은 우선순위) `terminal-duration.spec.ts:145` 리터럴을 `PG_INT4_MAX` 보간으로 통일, `chat-channel.dispatcher.spec.ts` null/레거시 테스트를 status 축으로 파라미터화.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` — 전원 결과 확보 확인됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단 — 이 changeset 은 신규/변경 의존성 없음 |
  | concurrency | router 판단 — 신규 동시성 표면(락/큐/병렬 처리) 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 문서 영향 없는 backend 내부 배관 변경 |