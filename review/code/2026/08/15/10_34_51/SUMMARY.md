# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — Critical 없음. 그러나 서로 다른 4개 관점(requirement/scope/side_effect/testing)이 독립적으로 발견한 실질 결함이 수렴한다: (1) retry-turn 취소 재진입 경로에서 DB 에 영속된 값과 emit 되는 `durationMs` 가 어긋나 이 PR 이 세운 "DB=wire" 불변식을 위반, (2) 직전 라운드 지적을 조치한 fix 커밋이 요청 범위(1곳)를 훨씬 넘어 무관한 `NodeExecution` 계산 8곳까지 동작을 바꿔놓고 문서화·테스트가 없음, (3) 신규로 채워지는 `duration_ms` 값이 실제로는 "대기 시간"인 5개 경로가 기존 대시보드/통계 평균·실행 목록 표시를 조용히 오염시킴, (4) 이벤트 wire 계약의 실제 변환 경계(`chat-channel.dispatcher.ts`)에 대응하는 회귀 테스트가 없음. forced reviewer 7명(documentation, maintainability, requirement, scope, security, side_effect, testing) 전원 결과 확보됨 — 강제 화이트리스트 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Requirement / 정합성 | retry-turn 의 CANCELLED 재진입(멱등) 분기에서 DB 에는 `stop()` 이 커밋한 T1 시각 기준 `durationMs` 가 올바르게 보존되지만, in-memory `execution.durationMs` 는 갱신되지 않아 emit 되는 값은 재진입 시점(T2, 더 큰 값)으로 어긋난다. 희귀 레이스가 아니라 "retry-turn 처리 중 Stop" 이라는 일반 흐름에서 결정적으로 발생. 기존 테스트는 SQL 형태만 단언하고 emit 값은 미검사(43/43 통과, 미검출). | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts` — `finalizeGuarded` CANCELLED COALESCE 분기, `failRetryExecution` | `finalizeGuarded` CANCELLED 분기에 `.returning(['finished_at','duration_ms'])` 추가해 실제 persist 값을 되읽고 emit 전 `execution.durationMs` 갱신. 회귀 테스트는 emit 값 자체를 단언 |
| 2 | Scope | 직전 라운드가 `savedExecution`(Execution 엔티티) **1곳**만 지적했는데, 이를 조치한 fix 커밋(`6bedc7e3c`)이 전혀 다른 엔티티(`NodeExecution`, 워크플로 에디터 노드별 실행시간 표시용, EIA 외부 종결 payload 와 무관)의 계산 **8곳**까지 같은 헬퍼로 바꿔치기했다. 순수 리팩토링이 아니라 동작이 바뀜(무가드 뺄셈→음수/NaN 조용히 null). CHANGELOG·plan·커밋 메시지 어디에도 이 8곳 언급 없고 신규 테스트도 0건. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `runExecution`(:4833-4834), `executeNode` 5곳(:6042-6043,:6161-6163,:6194-6196,:6212-6214,:6226-6228), `finalizeErrorPortNode`(:6302-6303), 컨테이너 재조회 실패(:7941-7942) | 8곳을 이번 PR 범위에서 제외해 별도 후속으로 분리하거나, 유지 시 CHANGELOG/plan 에 명시 + 노드 레벨 회귀 테스트(음수/Invalid Date/startedAt 부재) 추가 |
| 3 | Side Effect / 데이터 정합성 | 이번 PR 이 처음으로 `duration_ms` 를 채우는 5개 취소/실패 경로(park 취소·위젯 idle 취소·rehydration 실패 취소·큐 대기 타임아웃·stalled 소진) 중 다수의 값은 "실행 시간"이 아니라 "대기 시간"(idle-timeout 기본 grace 1시간)이다. 이 컬럼을 status 필터 없이 소비하는 대시보드 `avgExecutionTime`, 통계 `avgDurationMs`(요약/Top workflows, 프론트에 렌더됨), 실행 목록 "Duration" 컬럼이 조용히 오염된다. `alerts-evaluator.service.ts` 만 `status='completed'` 필터가 있어 우연히 안전. plan/CHANGELOG 어디에도 이 영향 미기재, 두 이전 라운드도 미포착. | 쓰기측: `execution-engine.service.ts:1036,1171,2828,2899,3352`. 읽기측: `dashboard.service.ts:96`, `statistics.service.ts:95,221`, `frontend/.../executions/page.tsx:292` | 대기-시간 생성 경로를 집계 쿼리에서 status/error.code 로 제외하거나, 순수 실행시간과 wall-clock 대기시간을 별도 필드로 분리. 최소한 `spec-sync-external-interaction-api-gaps.md` 에 신규 항목 등재 |
| 4 | Testing | `chat-channel.dispatcher.ts` 의 `durationMs` nullable 캐스트 확장(3곳)에 대응하는 `chat-channel.dispatcher.spec.ts` 가 이 PR 의 diff 에 전혀 등장하지 않는다. `execution.completed` describe 자체가 없고, `execution.failed`/`execution.cancelled` 도 `durationMs` 를 단언하는 `it` 이 하나도 없다. 이 지점은 CHANGELOG 가 "외부 수신자 breaking change" 로 명시한 계약의 실제 wire 변환 경계인데 회귀 안전망이 없음. | `codebase/backend/src/modules/chat-channel/chat-channel.dispatcher.ts:534,571,587` / 대응 spec 파일: `chat-channel.dispatcher.spec.ts` | `execution.failed`/`execution.cancelled` describe 에 `durationMs` 정상값·`null`·키 없음(레거시) 3케이스 추가, `execution.completed` describe 신설 |
| 5 | Documentation | 이번 PR 이 spec §6.5 에 `durationMs`/`EXECUTION_QUEUE_WAIT_TIMEOUT` 설명용 blockquote 를 추가하면서, 그와 무관한 기존 `cancelledBy`/`error.code` disclaimer 문장 앞부분을 blockquote 안으로 이어 붙이고 나머지 두 줄은 `>` 마커 없이 방치 — CommonMark lazy-continuation 으로 여전히 흡수돼, `durationMs` 콜아웃 안에 무관 disclaimer 가 섞인 것처럼 렌더링됨. | `spec/5-system/14-external-interaction-api.md:806-814` (§6.5) | `>` blockquote 를 `EXECUTION_QUEUE_WAIT_TIMEOUT` 설명에서 닫고, `cancelledBy`/`error.code` 문장을 독립 문단으로 복원 |
| 6 | API Contract | REST 폴링(`GET /api/external/executions/:id`)에는 `durationMs` 가 없고 push 이벤트(webhook/SSE/WS)에만 실린다 — 외부 통합자가 push 이벤트를 놓쳐 REST 로 상태를 복구하는 경로에서 `durationMs` 를 영영 받지 못함. 절차적으로는 CHANGELOG·spec·plan 트래커에 이미 일관되게 고지된 의도적 유예이나, 실재하는 계약 갭이라 등급 유지. | `execution-status-response.dto.ts`(`ExecutionStatusDto` — `durationMs` 부재), `CHANGELOG.md:20` | 후속 PR 에서 `ExecutionStatusDto`+projection 에 `durationMs` 추가(이미 트래커 등재, 재발 확인 목적) |
| 7 | Architecture | `durationMs` 불변식(음수→null, int4 상한 saturate)이 TS 함수(`resolveTerminalDurationMs`)와 Postgres SQL 상수(`TERMINAL_DURATION_MS_SQL`) 두 곳에 독립 재구현돼 있고, 동등성을 보장하는 장치가 `toContain` 문자열 부분일치 테스트뿐 — 실 Postgres 값 수준 검증 없음(팀도 W10 으로 인지·등재). | `codebase/backend/src/shared/utils/terminal-duration.ts` — `resolveTerminalDurationMs`(28-42) vs `TERMINAL_DURATION_MS_SQL`(87-90) | 등재된 e2e `duration_ms` 값 검증(W10) 우선순위 상향, 또는 클램프 상수(`2147483647`)를 JS 쪽에도 동일 이름 export 로 공유 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Maintainability/Doc/Arch | `EiaCompletedEvent`/`FailedEvent`/`CancelledEvent` 3개 인터페이스에 동일 5줄 설명 주석이 글자 그대로 3중 복제(공유 베이스로 올리면 비종결 이벤트까지 필드가 새어 오히려 LSP 위반이므로 필드 자체 복제는 정당, 주석만 중복) | `chat-channel/types.ts:392-396,415-419,433-437` | 종결 3종 전용 중간 인터페이스(`EiaTerminalEventBase`) 도입해 필드+주석 1곳으로 축약(저위험 순수 추가 리팩터), 또는 canonical 참조로 축약 |
| 2 | Maintainability | raw `RETURNING` 에서 `duration_ms` 추출하는 3~4줄 스니펫이 5곳에 verbatim 반복 — 직전 라운드가 이미 "6번째 생기면 재검토"로 명시 보류, 지금도 5곳으로 동일 | `execution-engine.service.ts:1045-1049,1180-1184,2858-2862,2908-2912,3361-3365` | 재론 불필요, 6번째 경로 추가 시 헬퍼 승격 재검토 |
| 3 | Maintainability | `TERMINAL_DURATION_MS_SQL` 의 int4 상한(`2147483647`)이 SQL 문자열 리터럴 안 매직 넘버 | `terminal-duration.ts:89` | `PG_INT4_MAX` 이름 부여(강제 아님) |
| 4 | Maintainability/Architecture | `compute→assign→emit` 2줄 관용구(자기참조 폴백 `f(x) ?? x.durationMs`)가 16개 종결 emit 지점에 손으로 반복 배치돼 있어 신규 종결 필드 추가 시 16곳을 또 손으로 고쳐야 함(이미 비대한 god-service 경향 강화, 이 PR 이 만든 부채는 아님) | `execution-engine.service.ts` 다수, `retry-turn.service.ts` 4곳 | 다음 종결 필드 추가 시 `buildTerminalPayload()` 파사드 고려(이번 범위 밖) |
| 5 | Security/Database | (재확인) 직전 라운드 CRITICAL(`duration_ms` int4 오버플로로 취소 영구 고착)이 `LEAST(2147483647,…)` 클램프 + 시계역행 NULL 처리로 해소돼 있고 회귀 테스트로 고정됨 | `terminal-duration.ts:87-90`, `terminal-duration.spec.ts:125-133` | 없음 |
| 6 | Security | raw SQL `SET` 절 삽입은 하드코딩 모듈 상수 + 유일 가변값(`terminalFinishedAt`)이 전부 `setParameter` 바인딩이라 SQL 인젝션 표면 없음 | `terminal-duration.ts:87-90`, 사용처 5곳 | 없음 |
| 7 | Testing | (이월, 재확인) raw UPDATE 5경로 중 3곳(`markWebChatIdleTimeout`/`markExecutionCancelled`/`markQueueWaitTimeout`)은 emit 단언이 `objectContaining` 이라 `durationMs` 실값 threading 미검증 — 대표 2경로가 양쪽 분기를 정확 매칭으로 고정해 근거 있는 이월로 재차단 안 함 | `execution-engine.service.ts` 해당 함수들 | 후속 트래커 실행 시 3경로도 정확 매칭 보강 권장 |
| 8 | Testing | `resolveTerminalDurationMs` 의 "이미 계산된 값 신뢰" 분기가 음수 가드를 우회하는 비대칭(의도된 설계로 보이나 미고정) | `terminal-duration.ts:33-35` | 의도를 고정하는 캐너리 테스트 1건 추가 권장(강제 아님) |
| 9 | Documentation | REST §5.3 JSON 예제에 `durationMs` 부재가 인라인 self-documenting 되어 있지 않음(이 문서의 다른 gap 은 인라인 주석 컨벤션을 씀) — CHANGELOG/plan 에는 있어 재차단 사유 아님 | `spec/5-system/14-external-interaction-api.md:454-473` | §5.3 예제에 `// durationMs 는 아직 없음 — §6 표 참조` 한 줄 추가 권장 |
| 10 | API Contract | int4 saturate 클램프 동작이 공개 spec 문서(§6.5)에 캐비엇으로 없음 — REST 비대칭과 달리 공식 트래커에도 미등재 | `terminal-duration.ts:88`, `spec/5-system/14-external-interaction-api.md` §6.5 | §6 필드 표에 saturate 캐비엇 추가 또는 트래커 등재 |
| 11 | Scope | `NodeExecution` 관련 항목(WARNING #2)과 별개로, spec 오탈자(`/api/v1/executions` → `/api/executions`) 1줄 정정은 별도 커밋으로 격리·impl-prep 게이트로 이미 의무 해소 확인 | `spec/5-system/14-external-interaction-api.md` | 없음 |
| 12 | Database | 후속 트래커(`spec-sync-external-interaction-api-gaps.md`)에 이미 등재된 2건(SQL 이 실 Postgres 값 수준 검증 없음, 컬럼명 `started_at` 하드코딩) — 이번 PR 신규 발견 아님, 우선순위 유지 권고 | `terminal-duration.ts` | 조치 불필요(상태 확인 기록) |
| 13 | User Guide Sync | 외부 EIA 종결 payload 확장이 `02-nodes/triggers.mdx` 에 반영 안 됨 — 이 문서는 애초에 payload 필드 단위 shape 를 다룬 적 없고(자매 PR `e3825cc2c` 도 미갱신 선례), spec 이 SoT 라 관례상 정상 | `codebase/frontend/src/content/docs/02-nodes/triggers.mdx` | 조치 불필요 |
| 14 | 여러 관점 | (재확인) 직전 두 라운드 지적사항(`driveCallStackResume` 계산부 미전환, dispatcher 타입 nullable 불일치, stale SQL 주석, plan 수치 4 vs 5) 전부 현재 소스에서 해소 확인 | 다수 | 없음 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | SQL 인젝션 없음, int4 오버플로 CRITICAL 해소 확인, 신규 취약 표면 없음 |
| architecture | LOW | TS/SQL 이원화된 불변식(SoT 부재), types.ts 3중 주석 복제(정당한 필드 중복), god-service 로 관용구 확산 |
| requirement | MEDIUM | retry-turn CANCELLED 재진입 시 DB≠emit durationMs 어긋남(신규 발견, 미검출) |
| scope | MEDIUM | fix 커밋이 요청 범위(1곳)를 넘어 무관 NodeExecution 8곳까지 동작 변경, 미문서화·미테스트 |
| side_effect | MEDIUM | 대기-시간 값이 대시보드/통계 평균·실행 목록에 조용히 섞여 들어감 |
| maintainability | LOW | INFO 급 세부 중복(주석 3중복·raw-returning 추출 5중복·매직넘버·자기참조 관용구), 이전 라운드 조치 전부 반영 확인 |
| testing | MEDIUM | dispatcher wire 경계 회귀 테스트 부재(신규 발견), raw UPDATE 3경로 근사 단언(근거있는 이월) |
| documentation | LOW | spec §6.5 blockquote 마크다운 병합 결함(신규 발견) |
| database | LOW | 트랜잭션·인젝션·인덱스 문제 없음, 이전 CRITICAL/WARNING 해소 확인 |
| api_contract | LOW | REST/push 필드 비대칭(기지정 유예), saturate 캐비엇 spec 미기재 |
| user_guide_sync | NONE | 매트릭스 21개 trigger 전수 미스매치, triggers.mdx 미갱신은 기존 관례 |

## 발견 없는 에이전트

- **security** — Critical/Warning 없음. 모든 발견은 확인성 INFO(방어 확인, 인젝션 없음).
- **user_guide_sync** — Critical/Warning 없음. 매트릭스 대상 표면(frontend/i18n/backend-labels/locale/README) 변경 0건, INFO 1건은 관례상 정상 판정.

## 권장 조치사항

1. `retry-turn.service.ts` 의 CANCELLED 재진입(멱등) 분기에서 `.returning()` 으로 실제 persist 된 `duration_ms` 를 되읽고 emit 전 `execution.durationMs` 를 갱신 — "DB=wire" 불변식을 깨는 유일한 경로, 기존 테스트로 미검출 (Requirement WARNING #1)
2. fix 커밋(`6bedc7e3c`)이 건드린 `NodeExecution` 8곳(요청 범위 밖)을 이번 PR 에서 제외하거나, 유지 시 CHANGELOG/plan 에 명시하고 음수/Invalid Date/startedAt 부재 케이스 회귀 테스트 추가 (Scope WARNING #2)
3. `duration_ms` 를 새로 채우는 5개 취소/타임아웃 경로가 대기-시간 값을 담는다는 사실을 대시보드 `avgExecutionTime`·통계 `avgDurationMs`·실행 목록 "Duration" 컬럼에 반영 — 집계 쿼리 상태 필터링 또는 필드 분리 (Side Effect WARNING #3)
4. `chat-channel.dispatcher.spec.ts` 에 `durationMs` 정상/null/키부재 케이스 추가, `execution.completed` describe 신설 — 외부 wire 계약 breaking change 의 실제 검증 지점 (Testing WARNING #4)
5. `spec/5-system/14-external-interaction-api.md:806-814` 의 blockquote 마크다운 결함 정정 — `cancelledBy`/`error.code` disclaimer 를 durationMs 콜아웃에서 분리 (Documentation WARNING #5)
6. (이미 트래커에 있음, 재확인) 후속 PR 에서 `ExecutionStatusDto` 에 `durationMs` 추가해 REST/push 비대칭 해소 (API Contract WARNING #6)
7. int4 saturate 클램프의 e2e 실값 검증(W10, 트래커 등재됨)을 우선순위로 당기거나 클램프 상수를 JS/SQL 양쪽에서 공유 (Architecture WARNING #7)

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract, user_guide_sync (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(순수 계산 추출 + raw UPDATE 값 threading, 신규 루프/N+1 없음)에 해당 없음으로 제외 |
  | dependency | 신규 패키지/lock 파일 변경 없음으로 제외 |
  | concurrency | 신규 동시성 프리미티브(락/트랜잭션 경계) 변경 없음으로 제외 |