# Code Review 통합 보고서

## 전체 위험도

**MEDIUM** — CRITICAL 은 없다. 이 changeset(EIA 종결 이벤트 `durationMs` 배관)은 이미 이 세션에서 8차례 이상 리뷰·수정을 거쳐 핵심 결함(int4 오버플로, vacuous mock, AVG 집계 오염)은 대부분 조치됐지만, 이번(9차) 라운드에서 (1) 같은 PR 이 새로 추가한 `.setParameter()`/`.returning()` 이 `markExecutionCancelled` 의 `affected=0` 회귀 테스트를 조용히 vacuous 하게 만든 사실(WARNING, testing), (2) 프런트엔드 "Duration" 컬럼이 여전히 대기 시간을 실행 시간처럼 표시하는 부작용이 backend 2/3 만 해소되고 frontend·유저가이드 양쪽 다 미해소인 사실(WARNING×2, side_effect/user_guide_sync)이 새로 확인됐다. forced whitelist(`documentation, maintainability, requirement, scope, security, side_effect, testing`) 전원 결과가 확보돼 있고, 위 발견 누락은 없다.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 테스트 | `markExecutionCancelled` 의 `affected=0`(이미 처리됨) 회귀 테스트가 이 PR 이 추가한 `.setParameter()`/`.returning()` 호출로 인해 vacuous 해졌다. mock 에 이 메서드가 없어 `TypeError` 가 발생하고, 함수 전체를 감싼 `try/catch` 가 이를 흡수해 검증하려는 `affected>0` 가드 분기 자체가 실행되지 않는다(`if ((result.affected ?? 0) > 0)` 를 통째로 지워도 GREEN). `npx jest` 실측으로 콘솔 에러 `setParameter is not a function` 확인. 같은 파일의 유사 mock 블록 17곳은 전부 정정됐는데 이 한 곳만 누락. | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:15019`(테스트), mock override `:15045-15060` 부근; 프로덕션 `execution-engine.service.ts:2810-2878`(`markExecutionCancelled`) | mock 에 `setParameter: jest.fn().mockReturnThis()`, `returning: jest.fn().mockReturnThis()` 추가(다른 17개 블록과 동일 패턴). 추가 후 가드를 뮤테이션해 실제 RED 되는지 판별력까지 확인 |
| 2 | 부작용 | 이 PR 이 취소·타임아웃 5경로에 새로 채우는 `duration_ms`(실은 "대기 경과 시간", park 최대 ≈24.8일)를 프런트엔드 실행 목록 "Duration" 컬럼이 status 분기 없이 그대로 렌더한다. 이번 diff(`f79792621`)는 소비처 3곳 중 `dashboard.service.ts`/`statistics.service.ts` 2곳만 `status = 'completed'` 필터로 고치고 프런트엔드는 미조치로 남았다. `formatDuration` 은 일 단위 포맷도 없어 표시가 비정상적일 수 있다. | 원인: `execution-engine.service.ts` 의 `cancelParkedExecution`/`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`/`finalizeStalledExhausted`. 미수정 확인: `codebase/frontend/src/app/(main)/w/[slug]/workflows/[id]/executions/page.tsx:292`, `.../executions/[executionId]/page.tsx:379`, `.../dashboard/page.tsx:308`, `components/editor/run-results/execution-history-panel.tsx:158` | 근본 수정(frontend status 분기 또는 필드 분리)까지, `plan/in-progress/spec-sync-external-interaction-api-gaps.md` W3 트래커 표를 "backend 2/3 완료, frontend 잔여"로 갱신 |
| 3 | 문서화 | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`(+`.en.mdx`) 가 위 #2 의 행동 변화(취소/타임아웃 실행의 "소요 시간"이 대기 시간을 포함할 수 있음)를 반영하지 못한다. 선행 4개 라운드(`10_18_38`~`11_09_44`)의 `user_guide_sync` 는 "UI 표시값 불변"이라는 전제로 이 항목을 배제했으나, 이번 라운드가 diff 실측으로 그 전제를 반증했다. | `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx:132`(+`.en.mdx:122`) | 근본 수정 전까지 최소 조치로 "취소/타임아웃 종료 실행은 대기 시간을 포함할 수 있다" caveat 문구 추가 |
| 4 | 동시성 | `finalizeCancelledExecution` 에서 재진입 레이스 시(동시 `stop()` 요청과 경합) `updateExecutionStatus` 가 `RETURNING` 없이 boolean 만 반환하는데, emit 되는 `durationMs` 는 로컬로 계산한 값(반환값 미확인, always-emit)이라 실제 DB 영속값과 다를 수 있다. 같은 PR 이 raw-UPDATE 5경로에서는 `RETURNING` 으로 명시적으로 피한 결함 클래스가 이 지점엔 남아 있다. 트래커 등재·유예 근거는 타당하나 실측 결과 여전히 미해소. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4876-4891`(`4883-4884` 로컬 계산, `4885` guarded UPDATE, `4886-4890` always-emit); `updateExecutionStatus` else 분기 `:8609-8640` | `updateExecutionStatus`(또는 내부 raw UPDATE)에 `RETURNING duration_ms, finished_at` 추가해 실제 영속값을 emit 에 사용. 이미 트래커 등재(`spec-sync-external-interaction-api-gaps.md`) |
| 5 | 동시성 / API 계약 | `retry-turn.service.ts` 의 CANCELLED 재진입 분기(`finalizeGuarded`)가 `COALESCE(duration_ms, :new)` 로 DB 에는 먼저 커밋된 T1 값을 의도적으로 보존하지만, `RETURNING` 없이 boolean 만 반환하므로 `failRetryExecution` 은 로컬 T2 값을 그대로 emit 한다 — "retry-turn 처리 중 Stop" 이라는 일반 흐름에서 결정적으로 DB 값과 emit 값이 어긋난다. | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:637-651`(`finalizeGuarded` COALESCE UPDATE), `:947-949`(대입), `:971`(emit) | COALESCE UPDATE 에 `.returning(['duration_ms'])` 추가해 실제 persist 값을 되읽어 emit. 트래커 등재됨(같은 절) |
| 6 | API 계약 | REST 재조회(`GET /api/external/executions/:id`)와 push 이벤트(webhook/SSE/WS) 간 `durationMs` 노출 비대칭 — 이벤트로 받으면 있는데 재조회하면 사라진다. `ExecutionStatusDto` 는 이번 diff 밖(미변경 확인). CHANGELOG·spec·트래커에 이미 고지돼 은폐된 결함은 아니다. | `spec/5-system/14-external-interaction-api.md:575`(필드표); `plan/in-progress/spec-sync-external-interaction-api-gaps.md:245`(W4) | `ExecutionStatusDto`/`STATUS_PROJECTION_COLUMNS` 에 `durationMs` 추가하는 후속 PR, 또는 의도적 제외 시 §5.3 에 사유 명문화 |
| 7 | 요구사항 | 이 PR 이 두 차례(`09_58_24`, `11_09_44`) CRITICAL 로 취급한 결함 클래스(int4 오버플로·시계 역행 무가드 뺄셈)와 **글자 그대로 같은 형태**의 연산이, 이 PR 이 손대지 않은 자매 write 경로(`stop()` REST)에 여전히 남아 있다. 같은 `duration_ms INTEGER` 컬럼에 클램프 없이 쓴다. spec §6 직접 규율 대상은 아니라 CRITICAL 아닌 WARNING. | `codebase/backend/src/modules/executions/executions.service.ts:793`(`finishedAt.getTime() - startedAtMs`) → `:796-801`(UPDATE) | `resolveTerminalDurationMs` 재사용 또는 최소 `Math.min(durationMs, PG_INT4_MAX)` 클램프 추가. `spec-sync-external-interaction-api-gaps.md` 트래커에 병기 권고 |
| 8 | 아키텍처 | 종결 이벤트 emit payload 조립에 타입 초크포인트가 없다(`emitExecution(payload: unknown)`) — 이 PR 자신이 8라운드에 걸쳐 형제 경로 누락·클램프 비대칭·vacuous mock 반복 등 같은 구조적 원인의 여러 증상을 냈다. 이번 라운드에 트래커(`spec-sync-external-interaction-api-gaps.md:227-234`) 등재가 실측 확인됐다 — 비차단, 재론 불요. | `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts:37-40`; 호출부 `execution-engine.service.ts` 6곳 + `retry-turn.service.ts` 3곳 + `emitCancellationEvent` 5곳 | 종결 3종 전용 `emitTerminalExecutionEvent(executionId, type, {status, durationMs, error?})` 타입 파사드 검토(이 PR 범위 밖, 트래커 등재 완료) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 성능 / 유지보수 | `resolveTerminalDurationMs` 를 완료 경로 다수(대입 시 1회, emit 시 1회)에서 동일 인자로 2회 호출. O(1) 순수함수라 실질 영향 없음(성능·아키텍처·유지보수 3개 라운드 공통 확인) | `execution-engine.service.ts` 6곳(`:2415/2426` 등), `retry-turn.service.ts` 3곳 | 강제 아님. 대입 결과를 지역 변수로 재사용하면 중복 제거 가능 |
| 2 | 유지보수 | `toFiniteNumber(...)` 는 항상 `number \| null` 반환(`undefined` 불가)인데 raw-UPDATE 5경로 전부 `?? null` 을 재차 붙여 논리적으로 죽은 코드가 됨 | `execution-engine.service.ts:1045-1049,1182-1186,2861-2865,2910-2914,3363-3367` | 강제 아님. 다음에 이 스니펫을 손댈 때 함께 제거 |
| 3 | 유지보수 / 아키텍처 | `EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent` 3개 인터페이스의 `durationMs` 필드 설명 주석 5줄이 3중 복제(의도적 분리는 옳으나 주석만 중복) | `codebase/backend/src/modules/chat-channel/types.ts:392-397,415-420,433-438` | 강제 아님. 정책 변경 시 mixin/공유 타입 추출 검토 |
| 4 | API 계약 | `durationMs` 가 경로에 따라 "실행 시간"과 "대기 시간" 두 의미를 하나의 필드명에 담음 — spec 문서화는 됐으나 필드명이 구분을 드러내지 않아 외부 수신자가 오독할 여지 | `spec/5-system/14-external-interaction-api.md:575,:806` | 현행 유지(문서 고지로 충분). 향후 필드 재설계 시 `waitMs` 분리 검토 |
| 5 | 부작용 | `plan/in-progress/spec-sync-external-interaction-api-gaps.md` 소비처 표(184-192행)가 같은 커밋(`f79792621`)에서 적용된 backend 부분 수정(2/3)을 반영 못해 여전히 "미해결"로 보임 — 문서-코드 drift | `plan/in-progress/spec-sync-external-interaction-api-gaps.md:184-192` | 표를 "해소(`f79792621`)"로 갱신, 체크박스를 frontend 잔여 전용으로 좁힐 것 |
| 6 | 문서화 | `plan/in-progress/eia-terminal-payload.md` "차단 해제 조건" 절이 이미 해소된 BLOCK 상태를 현재형으로 서술(8라운드째 반복 확인, 비차단 처분 유지) | `plan/in-progress/eia-terminal-payload.md:275` | 다음 plan 편집 시 과거형으로 정정 |
| 7 | 데이터베이스 | raw SQL 컬럼명(`started_at`) 하드코딩에 엔티티 메타데이터 대조 assertion 부재; SQL 식의 값 수준 e2e 검증 부재(현재 문자열 `toContain` 단위 테스트뿐) | `terminal-duration.ts`, `terminal-duration.spec.ts` | 이미 트래커 등재, 위험 낮음, 범위 밖 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 하드코딩 시크릿·SQL 인젝션·인가 경계 변경 없음(전부 INFO 확인) |
| performance | LOW | `resolveTerminalDurationMs` 이중 호출(INFO)만, N+1/캐싱/블로킹 이슈 없음 |
| architecture | LOW | `emitExecution(payload:unknown)` 타입 초크포인트 부재(WARNING, 트래커 등재 확인) + INFO 3건 |
| requirement | LOW | 16개 emit 경로 전수 배관 확인 + 자매 경로(`stop()`) 무가드 오버플로 신규 WARNING |
| scope | LOW | 단일 의도(durationMs 배관) 유지, AVG 집계 필터 추가는 정당한 동반 수정 |
| side_effect | MEDIUM | AVG 집계 오염 backend 2곳 해소, frontend Duration 컬럼 미해소 WARNING + 트래커 drift INFO |
| maintainability | LOW | 죽은 `?? null` 코드, 주석 3중복 등 INFO만, 신규 차단 없음 |
| testing | MEDIUM | `markExecutionCancelled affected=0` 테스트 vacuous화(WARNING, 신규 발견) |
| documentation | NONE | 신규 발견 0건, 기존 INFO 2건 재확인 |
| database | NONE | int4 클램프·AVG 필터·raw UPDATE 파라미터 바인딩 전부 안전 재확인 |
| concurrency | MEDIUM | `finalizeCancelledExecution`/`retry-turn` 재진입 레이스 시 emit≠DB 값 WARNING 2건(기존, 미해소 재확인) |
| api_contract | LOW | REST/push 비대칭 WARNING, retry-turn 재진입 WARNING(concurrency와 병합), 필드 의미 혼재 INFO |
| user_guide_sync | MEDIUM | `run-results.mdx` 미갱신 신규 WARNING(선행 4라운드 전제 반증) |

## 발견 없는 에이전트

security, database, documentation — 세 에이전트 모두 CRITICAL/WARNING 없이 전부 INFO(안전성 재확인) 또는 "신규 발견 0건"으로 수렴.

## 권장 조치사항

1. `markExecutionCancelled` 의 `affected=0` 회귀 테스트 mock 에 `setParameter`/`returning` 을 추가해 vacuous 상태를 해소하고, 가드 뮤테이션으로 판별력을 확인한다(WARNING #1, 이번 PR 이 직접 유발한 회귀).
2. 프런트엔드 실행 목록 "Duration" 컬럼과 유저 가이드(`run-results.mdx`+`.en.mdx`)에 대기 시간 표시 caveat 를 반영하거나 근본적으로 status 분기를 추가한다(WARNING #2, #3). `spec-sync-external-interaction-api-gaps.md` W3 트래커 표를 실제 진행 상태(backend 2/3)로 갱신한다.
3. `finalizeCancelledExecution`/`retry-turn.service.ts` 재진입 레이스의 DB≠emit `durationMs` 불일치는 이미 트래커에 등재·유예 근거가 타당하므로 이번 PR 을 막을 필요는 없으나, 다음 반복에서 `RETURNING` 추가로 반드시 닫을 것(WARNING #4, #5).
4. 자매 경로 `executions.service.ts` `stop()` 의 무가드 오버플로 연산에 최소 클램프를 추가하는 후속 항목을 트래커에 병기한다(WARNING #7).
5. REST 재조회 비대칭(WARNING #6)과 타입 초크포인트 부재(WARNING #8)는 이미 문서화·트래커 등재된 범위 밖 후속 과제로 유지한다.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, api_contract, user_guide_sync` (13명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 라우터가 이 changeset(EIA 종결 이벤트 `durationMs` 배관 — 패키지 의존성 변경 없음)에 대해 해당 관점과 무관하다고 판정(상세 사유는 라우터 출력에 미포함) |