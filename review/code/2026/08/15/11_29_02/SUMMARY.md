# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 은 0건. 다만 이번(6~7차 누적) 라운드에서 새로 확보된 발견 3건(architecture 구조적 초크포인트 부재, maintainability/documentation 이 중복 발견한 JSDoc 귀속 결함, testing 이 잡은 "검증됐다" 주장과 실제 커버리지 불일치 2건)이 각기 다른 관점에서 "고쳤다고 선언한 것이 실제로는 부분 집행"이라는 이 PR 의 반복 패턴을 다시 드러내, 개별 위험도 자체는 낮아도 종합적으로 MEDIUM 유지가 타당하다. forced(router_safety) whitelist 7명(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 종결 이벤트 payload 조립을 강제하는 단일 초크포인트가 없다(`emitExecution(payload: unknown)`). `durationMs` 필드 하나를 16곳에 손으로 스레딩해야 했고, 이 PR 자체가 두 라운드에 걸쳐 같은 클래스의 누락 결함(형제 경로 미적용·정규식이 멀티라인 놓침)을 냈다 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:40` | 종결 3종 전용 `emitTerminalExecutionEvent(...)` 파사드로 `{status, durationMs, error?}` 형태를 타입 레벨에서 강제 (다음 필드 추가 시점에 재검토) |
| 2 | requirement | `CHANGELOG.md` 가 최신 CRITICAL 수정(JS 경로 int4 클램프 누락)의 확장된 실제 영향 범위를 반영하지 않는다 — 여전히 "클램프 없으면 **취소 UPDATE** 가 실패"라고만 적혀 있으나, 실제 수정 커밋 메시지는 도달 경로가 "**정상 완료**"임을 명시한다 | `CHANGELOG.md:14`, 커밋 `2c9b490fd` | "SQL 식" 한정을 걷어내고 "JS/SQL 두 경로 모두, 완료 경로도 같은 상한 공유" 로 서술 확장 |
| 3 | maintainability + documentation (중복 발견) | `resolveTerminalDurationMs` 를 설명하는 JSDoc 블록이 뒤에 삽입된 `PG_INT4_MAX` 상수 JSDoc 에 자리를 뺏겨 함수 선언 어디에도 귀속되지 않는다 — IDE hover/TypeDoc 에서 문서가 사라짐. 이 PR 이 두 차례 CRITICAL(조건문 밖 `startedAt` throw, int4 오버플로)을 겪고 남긴 안전 근거 문서라 유실 비용이 크다 | `codebase/backend/src/shared/utils/terminal-duration.ts:1-36`(커밋 `2c9b490fd` 가 생성) | 1~27행(`resolveTerminalDurationMs` JSDoc) 블록을 36행 함수 선언 바로 위로 재배치(순수 주석 이동, 로직 변경 없음) |
| 4 | testing | `emitCancellationEvent` 신규 JSDoc 이 "호출부 4곳 모두 명시적으로 값을 넘긴다"고 검증을 선언했으나 실제 호출부는 **5곳**이고, 누락된 5번째(`finalizeCancelledExecution`)를 실행하는 기존 테스트 어디도 `durationMs` 키를 검사하지 않는다 | `execution-engine.service.ts:1107-1112`(JSDoc), 호출부 `:1077,:1210,:2860,:2909,:4886` / 테스트 `execution-engine.service.spec.ts:6794,7353,11276,11374,11648,13513` | JSDoc 을 "5곳"으로 정정 + 해당 테스트 중 하나에 `durationMs: expect.any(Number)` 추가 |
| 5 | testing | `markWebChatIdleTimeout` 의 `EXECUTION_CANCELLED` emit 단언이 `durationMs` 키를 검사하지 않는다 — 2라운드 전(`11_09_44`)이 구체적 수정법까지 제시했음에도 이번 커밋에서도 드롭됨 | `execution-engine.service.spec.ts:3054-3061` | `:3057` 의 `objectContaining` 에 `durationMs: expect.any(Number)` 추가 |
| 6 | side_effect + api_contract (동일 근본원인, 두 관점) | retry-turn 재진입 시 DB 에 영속된 `durationMs`(T1, `COALESCE` 로 보존)와 emit 값(T2, 재진입 시점 재계산)이 갈릴 수 있다 — 희귀 레이스가 아니라 "retry-turn 처리 중 Stop" 일반 흐름에서 결정적으로 재현. 이번 PR 이 `durationMs` 를 emit 에 처음 실으면서 기존 불일치를 wire 로 처음 노출 | `retry-turn.service.ts:947-949`(계산)/`:968-971`(emit); spec §6.5 "알려진 예외 1건" | 이미 트래커에 등재된 처방대로 `CANCELLED` 분기에 `.returning(['duration_ms'])` 추가해 persist 값을 되읽어 emit(후속 PR) |
| 7 | side_effect | 이 PR 이 새로 채우는 `duration_ms`(대기시간 포함)가 `status='completed'` 필터 없는 대시보드/통계 `AVG(duration_ms)` 집계 3곳을 오염시킬 수 있다 | `dashboard.service.ts`, `statistics.service.ts` (PR 범위 밖) | 후속 PR 에서 집계 쿼리에 `status='completed'` 필터 추가 |
| 8 | api_contract | REST 단발 조회(`GET /api/external/executions/:id`)와 push(webhook/SSE/WS) 간 스키마 비대칭 — `durationMs` 가 재조회 시 사라진다 (4라운드째 이월, 의도적 유예) | `spec/5-system/14-external-interaction-api.md` §5.3, `execution-status-response.dto.ts` | §5.3 JSON 예시 옆에 비대칭 caveat 한 줄 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | performance | `resolveTerminalDurationMs` 를 같은 종결 흐름에서 동일 인자로 2회 호출(10개소) — O(1) 순수함수라 영향 무시 가능 | `execution-engine.service.ts` 6곳, `retry-turn.service.ts` 3곳 | 확정 필드를 emit 시점에 직접 참조하거나 대입 시 지역변수 재사용 (우선순위 낮음) |
| 2 | architecture / maintainability | raw `RETURNING` 파싱 블록이 5개 함수에 verbatim 반복 — 이미 근거 있게 보류(`09_58_24` W5, "6번째 생기면 재검토") | `execution-engine.service.ts` 5곳 | 재론 불필요 |
| 3 | architecture / maintainability | `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 3개 인터페이스에 동일 5줄 주석 3중 복제 — 지금까지 실제 drift 없음 | `chat-channel/types.ts:392-397,415-420,433-438` | 공유 타입 별칭으로 통합 가능(강제 아님) |
| 4 | architecture / database | `durationMs` 필드가 경로별로 "실행 소요시간"과 "큐 대기시간" 두 물리량을 겸함 — 의도된 설계, spec/CHANGELOG 에 명시 | `markQueueWaitTimeout`, spec §6.5 | 없음(이미 문서화됨) |
| 5 | testing | `terminal-duration.spec.ts` 가 int4 상한 값을 상수 참조/리터럴 하드코딩 두 경로로 중복 검증 | `terminal-duration.spec.ts:76-79,144-146` | 리터럴을 `PG_INT4_MAX` 보간으로 교체해 drift 표면 축소 |
| 6 | testing | `markQueueWaitTimeout` 직접 호출 단위 테스트 부재 — plan 트래커로 이관되어 유실 위험은 닫힘, 조치는 미완 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:215` | 후속 과제 |
| 7 | scope | `spec/5-system/14-external-interaction-api.md` §12 `/v1/` 오탈자 정정 1줄이 별도 커밋으로 격리 — impl-prep 의무(consistency-check CRITICAL) 해소 목적, 기능과 무관 | 별도 커밋 `cdaa4291d` | 없음(향후 무관 spec 오탈자는 가능하면 별도 PR 선행 권장) |
| 8 | security | `spec/5-system/14-external-interaction-api.md` §8.2 HMAC 화이트리스트 서술이 실제 코드(sha256+sha512 허용)보다 좁게 문서화됨 — 런타임은 더 넓어 안전, 문서만 뒤처짐, 이 PR 범위 밖 | `spec/5-system/14-external-interaction-api.md` §8.2, `notification-signature.util.ts` | 별도 후속에서 §8.2 본문을 코드/§3.1/§R12 와 일치시킬 것 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션/인가 표면 없음. HMAC 화이트리스트 문서 drift 는 PR 범위 밖(INFO) |
| performance | LOW | N+1/알고리즘 문제 없음. 중복 호출 1건(INFO) |
| architecture | MEDIUM | 종결 이벤트 payload 조립 초크포인트 부재(WARNING) — 구조적 재발 리스크 |
| requirement | LOW | CHANGELOG 영향범위 서술 갭(WARNING) 외 spec fidelity 전부 정합 |
| scope | LOW | 신규 scope 이탈 없음. 전 changeset 이 단일 의도로 수렴 |
| side_effect | LOW | 기존 트래킹 WARNING 2건 재확인(신규 회귀 아님), 신규 JSDoc 분리는 INFO |
| maintainability | LOW | JSDoc 귀속 결함 신규 발견(WARNING) 외 핵심 로직 응집도 양호 |
| testing | MEDIUM | 핵심 CRITICAL 회귀 테스트는 유효(뮤테이션 실측). JSDoc 주장-실제 불일치 + durationMs 미검증 2곳(WARNING) |
| documentation | MEDIUM | JSDoc 귀속 결함(WARNING, maintainability 와 동일 근본원인). 나머지는 5라운드째 정합 유지 |
| database | LOW | CRITICAL 2건(SQL/JS int4 클램프) 재검증 완료, 신규 결함 없음 |
| concurrency | NONE | 원자적 UPDATE·트랜잭션 경계·happens-before 전부 기존 패턴 유지, 신규 결함 없음 |
| api_contract | LOW | 기존 WARNING 2건 이월(REST/push 비대칭, retry-turn DB=wire 불일치), 신규 breaking change 없음 |

## 발견 없는 에이전트

- **concurrency** — "발견사항: 없음"으로 명시. 경쟁조건/트랜잭션/async 누락 전 항목 문제 없음.

## 권장 조치사항

1. `terminal-duration.ts` 의 `resolveTerminalDurationMs` JSDoc 블록을 함수 선언 바로 위로 재배치(순수 주석 이동, maintainability+documentation 중복 발견 — 비용 최소, PR 이 두 차례 CRITICAL 을 겪고 남긴 안전 근거 문서라 우선순위 높임).
2. `emitCancellationEvent` JSDoc 의 "호출부 4곳" 을 "5곳"으로 정정하고, `finalizeCancelledExecution`/`markWebChatIdleTimeout` 두 경로의 기존 테스트에 `durationMs` 단언 추가(testing WARNING 2건, 저비용).
3. `CHANGELOG.md` 의 durationMs 관련 불릿을 "SQL 식" 한정에서 "JS/SQL 두 경로 모두, 완료 경로도 보호 대상"으로 확장(requirement WARNING, 순수 문서 수정).
4. 종결 이벤트 payload 조립용 좁은 파사드(`emitTerminalExecutionEvent`) 도입은 이번 PR 범위 밖 구조 개선 과제로 백로그 등재 — 다음에 종결 이벤트 필드가 추가될 때 같은 실패 모드 재발 방지(architecture WARNING).
5. retry-turn 재진입 DB/emit 불일치, 대시보드 AVG 집계 오염, REST/push 비대칭 — 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 근거와 함께 등재된 기존 갭이므로 이번 PR 을 막을 사유는 아니나 후속 PR 착수 순서에 반영.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract` (12명)
  - **제외**: 아래 표 (2명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(누락 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 changeset(계산 로직 배관)과 무관 — 신규 의존성 추가 없음 |
  | user_guide_sync | 사용자 가이드 문서 변경 대상 아님 — 내부 API/DB 계층 변경 |