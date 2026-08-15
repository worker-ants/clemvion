# Code Review 통합 보고서

## 전체 위험도
**CRITICAL** — architecture reviewer 가 신규 CRITICAL 1건을 확인: 이 PR 이 스스로 고쳤다고 선언한 "int4 오버플로 → UPDATE 실패 → 실행 영구 고착" 실패 클래스가, SQL 경로(`TERMINAL_DURATION_MS_SQL`)만 클램프됐고 JS 경로(`resolveTerminalDurationMs`)는 클램프 없이 **같은 `duration_ms INTEGER` 컬럼**에 쓰여 엔티티 로드 완료/재시도 경로(8+3곳)에서 재발할 수 있다. 이 항목은 4차례 선행 라운드 어디에도 없던 신규 지적이며(RESOLUTION.md/plan grep 확인됨), push 전 반드시 조치 필요.

**forced(router_safety) 화이트리스트**: `documentation, maintainability, requirement, scope, security, side_effect, testing` 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | architecture | 신규 헬퍼가 선언한 int4 상한 saturate 불변식이 SQL 쌍둥이(`TERMINAL_DURATION_MS_SQL`)에만 있고 JS 쌍둥이(`resolveTerminalDurationMs`)엔 없음. 둘 다 같은 `duration_ms INTEGER` 컬럼에 씀. `startedAt` 은 생성 시 1회만 세팅되고 폼/버튼/AI 에이전트 대기엔 시간 기반 강제취소가 없어, 24.8일 초과 대기 후 정상 완료 시 완료 처리 자체가 raw UPDATE 실패로 영구 고착될 수 있음(이 PR 이 이미 "고쳤다"고 주장한 바로 그 실패 클래스가 절반 경로에서 재발) | `codebase/backend/src/shared/utils/terminal-duration.ts:28-42`(클램프 없음) vs `:74-79,87-90`(클램프 있음); 영향 대입 지점 `execution-engine.service.ts:2413,2577,3564,4294,4754,4882,4943`, `retry-turn.service.ts:714,896,949`; 실제 쓰기 지점 `execution-engine.service.ts:8617`(`updateExecutionStatus`) | `resolveTerminalDurationMs` 에도 동일 `Math.min(span, 2147483647)` saturate 추가. `2147483647` 을 named export(예: `PG_INT4_MAX`)로 한 번만 선언해 JS/SQL 양쪽이 참조하게 할 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | concurrency | `finalizeCancelledExecution`: guarded UPDATE 가 가드 실패(0행, 이미 terminal)해도 emit 은 무조건 발행되는 기존 설계 위에, DB 미영속(로컬 계산) `durationMs` 값이 그대로 wire 로 나갈 수 있음 — 동시 `stop()` 경합 시 emit 값과 실제 DB 값이 어긋남 (신규 지적, concurrency 전용 첫 패스) | `execution-engine.service.ts:4878-4888`(특히 `:4882` 대입, `:4886` emit); 근본 원인은 `updateExecutionStatus`(`:8620` 부근)가 `RETURNING duration_ms` 없이 boolean 만 반환 | `updateExecutionStatus`(내부 raw UPDATE)에 `RETURNING duration_ms, finished_at` 추가, 실제 영속값을 emit 에 사용 |
| 2 | concurrency + side_effect (중복 통합) | `retry-turn` 재진입: `finalizeGuarded` 의 `COALESCE(duration_ms, :newDurationMs)` 가 먼저 커밋된 `stop()` 값(T1)을 DB 에 보존하는데, `failRetryExecution` 의 emit 은 로컬 `execution` 객체(재진입 시점 T2)를 그대로 실어 DB≠wire 값 불일치 발생 | `retry-turn.service.ts:637-651`(COALESCE 분기), `:947-949`(대입)/`:971`(emit) | COALESCE UPDATE 에도 `RETURNING duration_ms` 추가해 실제 영속값을 emit. 이미 `plan/in-progress/spec-sync-external-interaction-api-gaps.md:204-216`(W1)에 등재·유예됐으나 여전히 미조치 — 후속 PR 우선순위 상향 권고 |
| 3 | side_effect | 이 PR 이 새로 채우는 `duration_ms`(그중 다수가 "대기 시간")가 status 필터 없는 평균 집계 3곳(대시보드/통계)을 오염시킬 수 있음 | `dashboard.service.ts:96`, `statistics.service.ts:95,221` | 집계 쿼리에 `status='completed'` 필터 추가(또는 대기-시간 구분 신호 도입). `spec-sync-external-interaction-api-gaps.md:175-190`(W3)에 이미 등재, 이 PR 범위 밖 확인 — 후속 PR 필요 |
| 4 | testing | raw-UPDATE 5경로 중 `markQueueWaitTimeout` 은 직접 실행하는 단위 테스트가 전무(유일한 호출 테스트가 `admitExecutionOrDefer` 를 mock 해 본문 미실행) — 이 경로는 값의 의미가 "큐 대기 시간"이라 다른 4경로로 대체 증명 안 됨. `markWebChatIdleTimeout` 은 호출은 되나 emit 단언이 `objectContaining` 이라 `durationMs` 미검증. 3라운드 연속 이월, 미조치 | `execution-engine.service.ts:2884`(정의); `execution-engine.service.spec.ts:5112`(admit mock), `:3030-3061`(objectContaining) | `markQueueWaitTimeout` 직접 호출 단위 테스트 1건 추가, `markWebChatIdleTimeout` 단언에 `durationMs` 키 추가. `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 독립 체크박스로 등재(review/** 는 SoT 아님) |
| 5 | testing | `terminal-duration.spec.ts:65-68` 테스트 제목이 "NaN/Infinity" 를 주장하나 `Infinity` 입력 케이스가 없음. `10_52_08` 라운드가 "다음 편집 때 우선 처리"라 명시했으나 이번 편집(`bd611be81`, 테스트 2건 추가)에도 미반영 | `codebase/backend/src/shared/utils/terminal-duration.spec.ts:65` | `it.each([['NaN', NaN], ['Infinity', Number.POSITIVE_INFINITY]])` 로 전환 |
| 6 | documentation | 이번 diff 로 신규 추가된 `emitCancellationEvent` `durationMs` 파라미터 JSDoc 이 실제 호출부 동작과 모순 — "생략한다"고 적었지만 호출부 4곳 전부 명시적으로 계산된 값을 넘김 | `execution-engine.service.ts:1107-1110`(신규 diff) | "호출부가 값을 갖고 있으면 넘기고, raw UPDATE 4경로는 SQL 계산값을 RETURNING 으로 되받아 넘긴다. 계산 실패 시 null 폴백" 으로 정정 |
| 7 | documentation | spec §6.5·CHANGELOG 의 "대기 시간" 캐비엇이 `markQueueWaitTimeout` 만 명명하는데, `cancelParkedExecution`/`markWebChatIdleTimeout` 도 동일 특성(오히려 더 김: park 무기한, 위젯 idle grace 1시간)을 가짐이 같은 PR 의 트래커에 이미 실측돼 있음 | `spec/5-system/14-external-interaction-api.md:816-818`(§6.5) vs `plan/in-progress/spec-sync-external-interaction-api-gaps.md`(W3) | 캐비엇을 `cancelParkedExecution`/`markWebChatIdleTimeout` 까지 포함하도록 확장 (문서 수정만으로 가능, 이 PR 범위 내) |
| 8 | api_contract | REST 단발 조회(`GET /api/external/executions/:id`)와 push 계열(webhook/SSE/WS) 응답 스키마 비대칭 — `durationMs` 가 push 에만 있고 REST 재조회 시 사라짐. 4라운드 연속 이월, CHANGELOG·plan 트래커에 등재된 의도적 유예 상태이나 §5.3 JSON 예시에는 여전히 caveat 부재 | `spec/5-system/14-external-interaction-api.md:434-486`(§5.3), `execution-status-response.dto.ts`(`durationMs` 0건) | 후속 PR(`ExecutionStatusDto`+projection 확장) 우선 진행. 그 전까지 §5.3 JSON 예시 옆에 한 줄 caveat 추가 권고 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | security/database | raw SQL 의 유일 가변 입력(`terminalFinishedAt`)이 5곳 전부 서버 생성 `Date` 로 파라미터 바인딩 — SQL 인젝션 표면 없음 | `terminal-duration.ts:87-90`, 사용처 5곳 | 없음 |
| 2 | security/database/performance | 직전 라운드(`09_58_24`) CRITICAL(SQL 경로 int4 미클램프)이 `LEAST(2147483647,…)` 로 이미 수정·테스트 고정됨을 재확인. 단, JS 경로는 미클램프 — 위 CRITICAL #1 참조 | `terminal-duration.ts:88-89`, `terminal-duration.spec.ts:125-133` | 없음(위 CRITICAL 항목으로 통합 처리) |
| 3 | maintainability | `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 세 인터페이스에 동일 5줄 설명 주석이 문자 그대로 3중 복제. 형제 필드 `error` 는 이미 공유 인터페이스로 추출된 선례가 있음 | `chat-channel/types.ts:392-396,415-419,433-437` | named type alias 로 추출해 주석 1회만 작성 (강제 아님) |
| 4 | maintainability/performance | `RETURNING` 값 추출 스니펫(5곳)·`resolveTerminalDurationMs` 자기참조 재호출 패턴(9곳)이 반복 — 실질 비용/버그 없음, 3~4라운드째 동일 판단 유지 | `execution-engine.service.ts` 다수, `retry-turn.service.ts` 다수 | 낮은 우선순위, 조치 불요 |
| 5 | scope | Re-run 경로 `/v1/` 세그먼트 정정(별도 커밋 `cdaa4291d`)은 impl-prep 게이트가 발견한 CRITICAL 의 즉시 해소로, 절차상 정당한 예외 | 커밋 `cdaa4291d` | 없음 |
| 6 | scope/requirement | `NodeExecution.durationMs` 8곳(과거 라운드가 지적한 스코프 이탈)이 커밋 `8a0c2348b` 로 전량 원복돼 현재 diff 에 없음을 재확인 | (부재 확인) | 없음 |
| 7 | requirement | 종결 emit 16경로(completed 6+failed 4+cancelled 6) 전수가 `durationMs` 를 실제로 싣는지 카운트 검증 — spec/plan 서술과 정확히 일치 | `execution-engine.service.ts`/`retry-turn.service.ts` | 없음 |
| 8 | api_contract | 같은 필드명(`durationMs`)이 경로별로 "실행 시간"/"대기 시간"이라는 다른 의미를 실음 — 스키마 레벨 구분자 없음(문서화·트래커 등재 확인됨) | `terminal-duration.ts:65-90` | 트래커 항목대로 진행 |
| 9 | user_guide_sync | doc-sync-matrix 21개 trigger 전수 대입 결과 확정 매칭 0건(frontend/channel-web-chat 변경 0건). `02-nodes/triggers.mdx` 는 원래도 payload 필드 단위 예시를 다루지 않아 stale 아님 | `.claude/config/doc-sync-matrix.json`, `02-nodes/triggers.mdx` | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| architecture | **CRITICAL** | JS 경로(`resolveTerminalDurationMs`) int4 클램프 누락 — SQL 경로만 고친 결함이 절반 경로에서 재발 가능 |
| concurrency | MEDIUM | emit 값이 DB 실제 영속값과 다를 수 있는 재진입 레이스 2곳 |
| performance | LOW | `resolveTerminalDurationMs` 중복 호출(9곳, O(1) 무시 가능) 외 문제 없음 |
| scope | LOW | 스코프 이탈 없음, 부수 커밋은 전부 절차상 정당 |
| testing | LOW | `markQueueWaitTimeout` 테스트 부재 등 2건 WARNING, 3라운드 이월·미조치 |
| documentation | LOW | 신규 JSDoc 모순 1건 + caveat 범위 협소 1건, 둘 다 WARNING |
| api_contract | LOW | REST/push 스키마 비대칭 이월, 그 외 additive/하위호환 양호 |
| security | NONE | 인젝션·인가·시크릿 노출 없음, CRITICAL 수정 반영 확인 |
| requirement | NONE | 16경로 전수 구현 확인, spec/plan 정합 |
| maintainability | LOW | 스타일성 INFO 다수, 4~5라운드째 변동 없음 |
| database | LOW | 스키마 변경 없음, SQL 인젝션/트랜잭션/인덱스 문제 없음 |
| side_effect | LOW | WARNING 2건 모두 이미 등재·유예된 항목 재확인 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 미스매치, 갱신 누락 없음 |

## 발견 없는 에이전트

security, requirement, user_guide_sync — CRITICAL/WARNING 없음(NONE 로 수렴, INFO 만 존재).

## 권장 조치사항

1. **[최우선/차단]** `resolveTerminalDurationMs` 에 `TERMINAL_DURATION_MS_SQL` 과 동일한 int4 saturate(`Math.min(span, 2147483647)`) 추가 — SQL/JS 양쪽이 참조할 named 상수(`PG_INT4_MAX`) 도입. (architecture CRITICAL #1)
2. 재진입 레이스 2곳(`finalizeCancelledExecution`, `retry-turn` `finalizeGuarded`/`failRetryExecution`)에 `RETURNING duration_ms`(또는 `finished_at`) 을 추가해 emit 이 실제 DB 영속값을 싣도록 수정. 후자는 이미 트래커에 있으나 우선순위 상향 필요. (WARNING #1, #2)
3. `markQueueWaitTimeout` 직접 호출 단위 테스트 추가, `markWebChatIdleTimeout` emit 단언에 `durationMs` 포함, 둘 다 `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 에 독립 체크박스로 등재. (WARNING #4)
4. `emitCancellationEvent` JSDoc 을 실제 동작과 일치하도록 정정. (WARNING #6)
5. spec §6.5 "대기 시간" 캐비엇 범위를 `cancelParkedExecution`/`markWebChatIdleTimeout` 까지 확장. (WARNING #7)
6. `terminal-duration.spec.ts` 의 "NaN/Infinity" 테스트 제목에 실제 `Infinity` 케이스 추가. (WARNING #5)
7. (후속 PR, 이 PR 비차단) 대시보드/통계 평균 집계에 `status='completed'` 필터 추가, REST `getStatus()` 에 `durationMs` projection 확장 — 둘 다 이미 트래커 등재됨. (WARNING #3, #8)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **제외**: 표 (1명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨 — 화이트리스트 미이행 없음)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단(신규/변경 외부 패키지 의존성 없음 — `package.json` 등 미변경) |