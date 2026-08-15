# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 0건. WARNING 5건(신규 실측 재확인 포함) 중 두 축이 특히 주목: (1) 종결 이벤트 payload 타입 초크포인트 부재 + "별건 등재" 주장이 3차례 연속 실측되지 않음(architecture), (2) 이 PR이 트리거하는 대시보드/통계 AVG 집계 오염이 diff 시점 기준 미해소(side_effect·requirement 동일 지적). forced 화이트리스트(documentation/maintainability/requirement/scope/security/side_effect/testing) 전원 결과 확보 확인 — 강제 목록 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 아키텍처 | `emitExecution(payload: unknown)`이 종결 이벤트 payload 형태를 타입으로 강제하지 않아 16개 호출부에 필드를 손으로 스레딩 — 이 구조적 원인이 이 PR 8라운드에 걸친 반복 결함(형제 경로 누락·grep 미검출·JS/SQL 클램프 비대칭·vacuous mock)의 근본. 추가로 "별건 등재" 주장이 `11_29_02`·`11_44_10`·최신 커밋 메시지 3차례 반복됐으나 `plan/in-progress/**` 전체 grep 결과 해당 체크박스가 어디에도 없음 | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts` `emitExecution`; 호출부 16곳 (`execution-engine.service.ts`, `retry-turn.service.ts`) | 종결 3종 전용 `emitTerminalExecutionEvent(...)` 타입 파사드는 이번 PR 범위 밖으로 유예 가능하나, 그 유예 근거인 "등재"를 실제로 `spec-sync-external-interaction-api-gaps.md`에 체크박스로 기록할 것 |
| 2 | 사이드이펙트 / 요구사항(SPEC-TRACKED) | 이 PR이 5경로(`cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`)에서 새로 채우는 `duration_ms`(대기·타임아웃 경과 시간)가 status 필터 없는 대시보드·통계 모듈의 AVG 집계를 오염시킴 — 트래커에 등재돼 있으나 diff 시점 기준 여전히 미해소된 살아있는 부작용 | 쓰기: `execution-engine.service.ts` 5경로. 읽기(오염 대상): `dashboard.service.ts:131-132`(`avgExecutionTime`), `statistics.service.ts:95,221`(`avgDurationMs`) | 트래커(`plan/in-progress/spec-sync-external-interaction-api-gaps.md:177-191`) 방향대로 두 집계 쿼리에 `status = 'completed'` 필터 추가 |
| 3 | 테스트 | `cancelParkedExecution`의 `RETURNING duration_ms` 추출 로직만 유일하게 vacuous 테스트 — 자매 4경로(`markWebChatIdleTimeout`/`markQueueWaitTimeout`/`markExecutionCancelled`/`finalizeStalledExhausted`)는 이번 라운드까지 전부 실값 mock+정확매칭으로 고정됐으나 이 경로는 mock이 `raw`를 아예 주지 않아 초기값 `null`과 우연히 일치하는 assertion만 존재(추출 로직 회귀를 잡지 못함) | `execution-engine.service.spec.ts` `makeCancelQb` 헬퍼(`cancelParkedExecution — durable WAITING cancel (W10)` describe) | mock에 `raw: affected > 0 ? [{ id, duration_ms: <값> }] : []` 부여, `durationMs: <같은 값>` 정확 매칭으로 형제 4경로와 동형으로 고정 |
| 4 | 테스트 | plan 트래커가 이미 해소된 `markQueueWaitTimeout` 테스트 갭을 여전히 미해결("3라운드 이월")로 기재 — 커밋 `777698bbe`가 실제로 해소했으나(mock `duration_ms: 600000` + 정확매칭 확인) 트래커 항목만 갱신 누락 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:217` | 해당 항목 `[x]`로 갱신, 완료 커밋(`777698bbe`) 인용. 위 #3(신규 `cancelParkedExecution` 갭)과 혼동되지 않게 별개로 명시 |
| 5 | API 계약(SPEC-TRACKED) | REST 재조회(`GET /api/external/executions/:id`) 응답(`ExecutionStatusDto`)에 `durationMs` 필드 자체가 없음 — push 계열(webhook/SSE/WS/chat-channel)과 응답 스키마 비대칭. 신규 결함 아니며 CHANGELOG·spec·트래커에 이미 문서화, breaking change 아님(필드 부재일 뿐 기존 계약 위반 없음) | `codebase/backend/src/modules/external-interaction/dto/responses/execution-status-response.dto.ts` `ExecutionStatusDto` | 다음 편집에서 `durationMs` 필드+projection 컬럼 추가, 또는 spec §5.3에 의도적 제외 사유 명시(트래커 이미 방향 기재) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 / 아키텍처 | `resolveTerminalDurationMs`를 완료 경로 8곳(대입 시 1회 + emit 조립 시 1회)에서 동일 인자로 중복 호출 — O(1) 순수함수라 실질 영향 무시 가능, 여러 라운드 전부터 이월 | `execution-engine.service.ts` 다수 라인, `retry-turn.service.ts` | 로컬 변수 재사용으로 단순화(스타일, 우선순위 낮음) |
| 2 | 유지보수성 | `terminal-duration.ts` JSDoc 산문이 `PG_INT4_MAX` 상수 값을 리터럴 `2147483647`로 하드코딩 — SQL/테스트 쪽은 이미 상수 보간으로 통일됐으나 문서 산문만 잔여 drift (신규 발견, 저비용) | `terminal-duration.ts:89` | 산문에서도 `PG_INT4_MAX` 상수명 언급 또는 값과 병기 |
| 3 | 테스트 | `retry-turn.service.spec.ts`의 `durationMs` 단언 다수가 `expect.any(Number)` 사용 — `NaN`도 통과하는 약한 단언(헬퍼 자체 NaN 방어는 별도로 견고히 커버됨, 실무 위험 낮음) | `retry-turn.service.spec.ts:691,727,858,894` | 강제 아님. 여유 있으면 같은 파일의 관계식 단언 패턴(`:1113-1116` 등)으로 통일 |
| 4 | 사이드이펙트 / API 계약(SPEC-TRACKED) | `durationMs` 값의 의미가 상태별로 다름(실행 시간 vs 대기/타임아웃 경과 시간, 특히 `markQueueWaitTimeout`) — spec §6.5에 캐비엇 명시돼 사양 위반은 아니나 필드명만으로 오독 소지, 수신자가 구분할 표지는 없음 | `terminal-duration.ts` 사용처, `spec/5-system/14-external-interaction-api.md` §6.5 | 장기적으로 별도 필드(`waitMs` 등) 분리 검토(트래커 이미 후속 등재) |
| 5 | API 계약 / DB(SPEC-TRACKED) | retry-turn 재진입 시 DB(`COALESCE(duration_ms, :new)`로 T1 보존)와 emit(T2 재계산) `durationMs`가 어긋나는 알려진 예외 1건 — spec §6.5·트래커에 이미 문서화 | `retry-turn.service.ts` `finalizeGuarded`(CANCELLED 분기) | 트래커 등재된 회귀 테스트(emit 값 자체 단언, `RETURNING` 사용) 항목 처리 시 함께 |
| 6 | 문서화 | `plan/in-progress/eia-terminal-payload.md` "차단 해제 조건" 절이 이미 해소된 BLOCK 상태를 여전히 현재형으로 서술 — 6개 라운드째 재확인, 비차단 | `eia-terminal-payload.md` | 다음 편집 시 과거형으로 정정(저비용) |
| 7 | 문서화 / 유지보수성 | `chat-channel/types.ts`의 `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 앞 5줄 설명 주석이 문구 그대로 3중 복제 — 여러 라운드째 이월, 향후 정책 변경 시 drift 위험만 있는 수준 | `types.ts:392-397,415-420,433-438` | 공통 참조/JSDoc 통합 검토(비강제, 저비용) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | Critical/Warning 없음. Raw SQL 인젝션 표면 없음, RETURNING 값 방어적 파싱, 인증/인가 경계 불변 재확인 |
| performance | LOW | 신규 프로덕션 변경 없음(직전 라운드 이후). 이중 호출 INFO 1건 외 N+1/복잡도/블로킹 I/O 이슈 없음 |
| architecture | MEDIUM | 타입 초크포인트 부재 WARNING(#1) — "별건 등재" 주장이 실측 반증됨. 신규 헬퍼 SRP/ISP는 양호 |
| requirement | LOW | 기능(16개 emit 경로) 완전, int4 클램프 CRITICAL 해소 확인. AVG 오염 WARNING 재확인 |
| scope | LOW | 신규 scope 이탈 없음. 실질 변경 16파일 전부 durationMs 단일 의도로 수렴 |
| side_effect | MEDIUM | AVG 집계 오염 WARNING(#2, 신규 재확인) — 살아있는 크로스모듈 부작용 |
| maintainability | LOW | 직전 라운드 지적 전부 해소 확인. JSDoc 리터럴 drift INFO 1건 신규 |
| testing | LOW | `cancelParkedExecution` vacuous 테스트 WARNING(#3) + 트래커 stale WARNING(#4) — 자매 4경로는 이미 견고 |
| documentation | NONE | 신규 Critical/Warning 0건. 직전 라운드 지적 2건 모두 실측 해소 확인 |
| database | NONE | DB 표면(SQL/트랜잭션/스키마) 변경 없음. 이전 CRITICAL(int4 오버플로) 해소 유지 재확인 |
| api_contract | LOW | REST 비대칭 WARNING(#5, 기존 트래킹) 외 additive-only 하위호환 설계 양호 |

## 발견 없는 에이전트

- security — Critical/Warning 없음(NONE)
- documentation — Critical/Warning 없음(NONE), 직전 라운드 결함 전부 해소 확인
- database — Critical/Warning 없음(NONE), DB 표면 변경 자체 없음

## 권장 조치사항

1. (WARNING #2) `dashboard.service.ts`/`statistics.service.ts`의 `avgExecutionTime`/`avgDurationMs` 집계 쿼리에 `status = 'completed'` 필터 추가 — 이 PR이 실제로 트리거한 데이터 품질 오염을 차단.
2. (WARNING #3) `cancelParkedExecution` 테스트의 `makeCancelQb` mock에 실값 `raw`를 부여하고 정확 매칭으로 고정 — 유일하게 vacuous한 자매 경로를 형제 4곳과 동형화.
3. (WARNING #5) `ExecutionStatusDto`에 `durationMs` 필드 추가(또는 spec §5.3에 의도적 제외 사유 명문화) — push/REST 스키마 비대칭 해소.
4. (WARNING #4) `spec-sync-external-interaction-api-gaps.md:217` 체크박스를 `[x]`로 갱신, 완료 커밋 인용 — 트래커·코드 상태 재동기화.
5. (WARNING #1) 종결 이벤트 payload 타입 파사드 도입은 이번 PR 범위 밖으로 유예 가능하나, "별건 등재"라는 근거 자체를 실제로 트래커에 기록할 것 — 근거 없는 유예 반복 인용을 차단.
6. (INFO 일괄) JSDoc 리터럴 drift(#2), 이중 호출(#1), 약한 `expect.any(Number)` 단언(#3), stale 문서 서술(#6, #7)은 강제 아님 — 다음 편집 시 저비용으로 함께 정리.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract` (11명)
  - **제외**: 표 (3명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명) — 전원 결과 확보됨(강제 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 diff 와 무관(신규 npm 패키지 없음) |
  | concurrency | router 판단상 이번 diff 와 무관(신규 동시성 제어 로직 없음) |
  | user_guide_sync | router 판단상 이번 diff 와 무관(사용자 가이드 문서 대상 변경 없음) |