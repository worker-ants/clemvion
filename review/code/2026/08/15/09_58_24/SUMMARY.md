# Code Review 통합 보고서

## 전체 위험도
**HIGH** — `requirement` reviewer 가 CRITICAL 로 지적하고 `database` reviewer 가 독립적으로 같은 근본 원인을 WARNING 으로 재확인한 `duration_ms` INTEGER(int4) 오버플로가 존재한다. 이번 PR 이 처음으로 취소/stalled-실패 raw UPDATE 5곳에 `duration_ms` SQL 계산을 얹으면서, 24.8일 이상 대기(park/idle)한 실행을 취소·실패 처리하려는 시도가 DB 에러로 조용히 실패하고 해당 실행이 영구적으로 상태에 고착되는 신규 회귀다. forced(router_safety) 화이트리스트 7개(documentation, maintainability, requirement, scope, security, side_effect, testing) 는 전원 결과 확보 — 강제 목록 미이행 없음.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | database/requirement | `duration_ms` 컬럼이 `INTEGER`(int4, 최대 ≈24.8일)인데 신규 SQL 식(`TERMINAL_DURATION_MS_SQL`)에 상한 클램프가 없다. 24.8일 이상 대기(특히 공개 웹채팅 idle-wait park)한 실행을 취소/stalled-실패 처리하는 raw UPDATE 5곳(`cancelParkedExecution`·`markWebChatIdleTimeout`·`markExecutionCancelled`·`markQueueWaitTimeout`·`finalizeStalledExhausted`)이 `integer out of range` 로 통째로 실패한다. 트랜잭션 롤백 + 최상위 `try/catch` 가 에러를 로그로만 남기고 삼켜, 호출자에겐 신호 없이 실행이 해당 상태(WAITING_FOR_INPUT/RUNNING)에 영구 고착된다. PR 이전에는 이 5경로가 `durationMs` 를 전혀 계산·영속하지 않았으므로 이 실패 모드가 없었다 — 이번 PR 이 신규로 도입한 회귀. | `codebase/backend/src/shared/utils/terminal-duration.ts:75-79` (`TERMINAL_DURATION_MS_SQL`); 호출부 `execution-engine.service.ts:1036/1171/2829/2900/3353`; 컬럼 정의 `codebase/backend/migrations/V001__initial_schema.sql:223`; 선례 주석 `V083__execution_active_running_ms.sql:17-18` | `TERMINAL_DURATION_MS_SQL` 에 `LEAST(2147483647, GREATEST(0, ...))` 클램프 추가(즉시 적용 가능, 스키마 변경 불요). 근본 해결은 컬럼을 `BIGINT` 로 확장하는 별도 마이그레이션이나 이번 PR 범위를 넘음 — 최소한 "UPDATE 자체 실패"를 "값 saturate 후 취소는 성공"으로 바꿀 것 |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 2 | side_effect/requirement/maintainability | 신규 방어 헬퍼 `resolveTerminalDurationMs` 가 헬퍼 자신이 명시한 회귀 클래스(`startedAt.getTime()` throw → 종결 emit 자체가 사라짐)를 막는 안전 패턴으로 5곳은 전환됐지만, 형제 함수 4곳(`driveCallStackResume`·`finalizeFailedExecution`·`completeRetryExecution`·`failRetryExecution`)은 여전히 가드 없는 `finishedAt.getTime() - startedAt.getTime()` 직접 계산을 쓴다. 이 대입은 guarded UPDATE·emit 보다 먼저 실행돼, emit 쪽에서만 헬퍼를 써도 방어되지 않는다. 세 reviewer 가 독립적으로 동일 4곳을 지적. | `execution-engine.service.ts:2576-2578`(`driveCallStackResume`), `:4943-4944`(`finalizeFailedExecution`); `retry-turn.service.ts:712-714`(`completeRetryExecution`), `:947-949`(`failRetryExecution`) | 4곳 모두 `savedExecution.durationMs = resolveTerminalDurationMs(savedExecution) ?? savedExecution.durationMs;` 패턴으로 통일(이미 5곳에 적용된 패턴 복제, 비용 거의 0) |
| 3 | documentation/api_contract/requirement | chat-channel 소비 타입(`EiaCompletedEvent`/`EiaFailedEvent`/`EiaCancelledEvent`)의 `durationMs?: number` 선언이 실제 wire 계약(이번 PR 이후 항상 present, 값은 `number \| null`)과 어긋난다. 같은 파일의 `error.code: string \| null` 이 정확한 반례(옵셔널 마커 없이 `\| null`)를 이미 보여주는데, `durationMs` 는 옵셔널+non-nullable 로 남았다. dispatcher 의 `as { durationMs?: number }` 캐스팅이 타입 체크를 우회해 컴파일러가 못 잡는다. 3개 reviewer 가 독립적으로 지적. | `spec/conventions/chat-channel-adapter.md:149-151,161`; `codebase/backend/src/modules/chat-channel/types.ts:392,410,423`; `chat-channel.dispatcher.ts:534,571,587` | 타입을 `durationMs: number \| null;`(옵셔널 제거 + `\| null` 추가)로 정정, spec 설명 문구를 `error.code` 와 동일 패턴으로 교체 |
| 4 | api_contract | REST 단발 조회(`GET /api/external/executions/:executionId`, EIA §5.3)의 `ExecutionStatusDto`/`STATUS_PROJECTION_COLUMNS` 는 이번 PR 이 손대지 않아 `durationMs` 가 없다. push 계열(webhook/SSE/WS)만 채워지면서 "이벤트로 받으면 있는데 재조회하면 사라지는" 신규 비대칭이 생겼다 — spec-consistency 라운드는 spec-to-spec 대조만 해 이 갭을 못 잡음. | `execution-status-response.dto.ts:106-173`; `interaction.service.ts:72-79`(`STATUS_PROJECTION_COLUMNS`); `spec/5-system/14-external-interaction-api.md:434-486`(§5.3) | `STATUS_PROJECTION_COLUMNS`/`ExecutionStatusDto` 에 `durationMs` 추가하거나, 의도적 제외라면 §5.3 문서에 사유 명시 |
| 5 | architecture/maintainability | raw UPDATE 5곳에 "SQL 계산 바인딩(`.set`+`.setParameter`) + `RETURNING` 파싱(`toFiniteNumber((result.raw as ...)?.[0]?.duration_ms) ?? null`)" 오케스트레이션이 문자 그대로 복제됐다. 이미 순수 계산부(`resolveTerminalDurationMs`)와 SQL 상수는 추출했으나 호출부의 바인딩+파싱 시퀀스는 추출하지 않았다 — 이 PR 자체가 5곳을 손으로 동시 편집해야 했다는 사실이 비용을 실증. | `execution-engine.service.ts` `cancelParkedExecution`(1045-1049), `markWebChatIdleTimeout`(1180-1184), `markExecutionCancelled`(2860-2864), `markQueueWaitTimeout`(2909-2913), `finalizeStalledExhausted`(3362-3366) | `bindTerminalUpdate(qb, finishedAt)` / `extractDurationMsFromReturning(raw)` 같은 얇은 헬퍼로 겹치는 부분만 추출 |
| 6 | maintainability | `cancelParkedExecution`↔`markWebChatIdleTimeout` — docstring 이 스스로 "완전히 동형"이라 인정한 중복 함수 쌍에 이번 PR 의 신규 8~9줄 블록이 또 한 번씩 손으로 복제됐다. 같은 필드가 하나 더 추가되면 세 번째 복제가 발생할 위험. | `execution-engine.service.ts:1023-1089`(`cancelParkedExecution`), `:1150-1224`(`markWebChatIdleTimeout`) | 두 함수를 `cancelWaitingExecution(executionId, opts)` 헬퍼로 통합하는 것을 다음 리팩터 후보로 남길 것(이번 PR 강제 아님) |
| 7 | architecture | `TERMINAL_DURATION_MS_SQL` 이 `Execution` 엔티티 컬럼명(`started_at`)을 타입 수준 연결 없이 raw SQL 문자열에 하드코딩 — 컬럼 리네임 시 컴파일은 통과하고 런타임 SQL 에러로만 드러난다. `shared/utils` 관습(DB-무관 순수 함수)에 데이터 레이어 지식이 새어 들어간 형태. | `codebase/backend/src/shared/utils/terminal-duration.ts:76` | 컬럼명을 `Execution` 엔티티 메타데이터에서 유도하거나, 유닛 테스트에서 엔티티 메타데이터와 대조하는 assertion 추가 |
| 8 | requirement | 시계 역행(음수 duration) 처리 정책이 SQL 경로(`GREATEST(0, ...)` → `0`)와 JS 경로(`resolveTerminalDurationMs` → `null`)에서 서로 다른 sentinel 을 낸다 — 동일 이상 상황에 소비자가 받는 신호가 "알 수 없음" 과 "0ms 만에 끝남" 으로 갈린다. | `terminal-duration.ts:41`(JS 경로) vs `:76`(SQL 경로 `GREATEST`) | 정책 통일 — SQL 쪽도 `CASE WHEN ... < 0 THEN NULL ELSE ... END` 로 바꾸거나, 다른 이유가 있다면 문서화 |
| 9 | testing | `markWebChatIdleTimeout`/`markQueueWaitTimeout` — 신규 `durationMs` 추출·폴백 로직이 mock 은 준비돼 있음에도(또는 애초에 `raw` 를 안 줌) emit 단언이 `objectContaining` 이라 전혀 검증되지 않는다. `.returning(['id','duration_ms'])` 를 실수로 빼거나 컬럼명을 틀려도 테스트는 GREEN. 자매 경로 `cancelParkedExecution`/`finalizeStalledExhausted` 는 이미 정확 매칭으로 고정된 선례가 있다. | `execution-engine.service.spec.ts:2978,3054-3061`(idle timeout); `:4372-4380,4526-4550`(queue wait) | 두 경로 모두 (a) 추출 성공, (b) `raw` 미제공/폴백 두 분기를 `cancelParkedExecution`/`finalizeStalledExhausted` 처럼 정확 매칭으로 추가 |
| 10 | testing | `TERMINAL_DURATION_MS_SQL` 이 실제 Postgres 에 대해 값 수준으로 한 번도 검증되지 않는다 — 단위 테스트는 문자열 `toContain` 검사뿐이고, 이 SQL 을 실제로 태우는 유일한 e2e(`webchat-idle-reaper.e2e-spec.ts`)도 `duration_ms` 컬럼을 SELECT/assert 하지 않는다. 부호·단위(초 vs ms)·클램프 오류를 잡을 안전망이 없다. | `terminal-duration.spec.ts:97-107`; `test/webchat-idle-reaper.e2e-spec.ts:86-94,118-119` | 최소 한 e2e 에서 `duration_ms` 컬럼을 SELECT 해 `>= 0` sanity 단언 추가 |
| 11 | documentation | 외부 계약 변경(종결 3종 payload 에 신규 필드)인데 `CHANGELOG.md` 항목이 없다. 직전 커밋(`e3825cc2c`, `error` 필드 통일)이 이미 CHANGELOG 에 "`durationMs` 는 후속으로 분리했다" 고 이번 작업을 예고해 뒀고, plan 문서도 "CHANGELOG 가 유일한 통지 경로" 라고 명시. | 저장소 루트 `CHANGELOG.md`(이번 diff 미포함); 예고 항목 `CHANGELOG.md:3-20`; `plan/in-progress/eia-terminal-payload.md:255` | `durationMs` 추가를 알리는 Unreleased 항목 추가 |
| 12 | maintainability | 테스트 파일의 `{ update, set, where, andWhere, execute }` queryBuilder mock 리터럴이 파일 전체 18~23곳에 반복돼, 이번 PR 이 `setParameter`/`returning` 두 메서드를 추가하기 위해 그 지점들을 개별로 손봐야 했다(이번 PR 이 비용을 직접 실증). | `execution-engine.service.spec.ts` 전역(`setParameter` 18곳, `returning` 23곳) | 공유 팩토리(`makeUpdateQueryBuilderMock(overrides?)`) 도입 — 이번 PR 강제 아님, 다음 리팩터 후보 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 13 | performance | `resolveTerminalDurationMs(savedExecution)` 를 같은 함수 안에서 두 번 호출(대입 시점 + emit payload 재계산) — 비용은 무시할 수준이나 첫 결과를 재사용하면 되는 자리. 5곳(engine 4 + retry-turn 1). | `execution-engine.service.ts:2413/2424, 3565/3576, 4755/4768, 4883/4887`; `retry-turn.service.ts:896/907` | `durationMs: savedExecution.durationMs` 직접 참조로 대체(우선순위 낮음) |
| 14 | testing | `markExecutionCancelled` — mock 이 이미 `duration_ms: 1234` 를 주는데 emit 단언은 여전히 `objectContaining` 이라 값 검증이 없다(수정 비용 최소). | `execution-engine.service.spec.ts:14777-14801,14984-14993` | `objectContaining` 에 `durationMs: 1234` 한 줄 추가 |
| 15 | testing | `resolveTerminalDurationMs` 의 "이미 계산된 값 신뢰" 분기(`row.durationMs` 가 이미 유한수)는 `span >= 0` 음수 가드를 거치지 않아, 음수가 이미 세팅돼 있으면 그대로 통과한다 — 실무 도달 가능성은 낮으나 테스트로 의도를 고정해 두지 않음. | `terminal-duration.ts:33-35`(가드 없는 분기) vs `:41`(가드 있는 분기) | 이 비대칭이 설계 의도라면 이를 명시하는 캐너리 테스트 추가 |
| 16 | architecture | `execution-engine.service.ts` 가 8,747줄 단일 `@Injectable` 클래스 — 이번 PR 은 여기에 duration 오케스트레이션 책임을 소폭 더 얹었다. 이 PR 이 새로 만든 문제는 아니며(추가분은 헬퍼 소비 몇 줄), 저장소에 이미 추적 중인 refactor 트랙이 있는 만성 부채. | `execution-engine.service.ts` 전체 | 없음(추적 중 부채, 이번 PR 은 오히려 헬퍼 소비 방향으로 정확히 움직임) |
| 17 | documentation | `chat-channel-adapter.md` 의 `result` optional 표기가 실제 `types.ts` 의 `result:`(필수) 선언과 이미 어긋나 있음 — `durationMs` 건과 같은 성격(옵셔널 vs nullable 혼동)이나 이번 PR 범위 밖의 기존 drift. | `chat-channel-adapter.md:149` vs `types.ts:391` | 급하지 않음 — `durationMs` 타입 정정과 묶어 처리 검토 |
| 18 | database | `finalizeStalledExhausted` 의 부모/자식 UPDATE 가 단일 트랜잭션으로 묶여있지 않음(형제 함수는 트랜잭션화됨) — 이번 diff 가 만든 구조 아니고 함수 docstring 이 이미 인지·수용. | `execution-engine.service.ts`(`finalizeStalledExhausted`) | 없음(PR 범위 밖) |
| 19 | scope | `spec/5-system/14-external-interaction-api.md` 의 `/v1/` Re-run 경로 오탈자 정정이 기능과 무관하게 같은 브랜치에 포함 — 별도 커밋으로 격리돼 있고 의무적 `consistency-check --impl-prep` 이 CRITICAL 로 지적한 항목을 해소한 것이라 절차상 정당. | `spec/5-system/14-external-interaction-api.md` unified diff 마지막 hunk | 없음(정당한 포함, 가능하면 향후 별도 PR 로 선분리하는 편이 이상적) |
| 20 | scope | 테스트 mock 변경 범위(`setParameter`/`returning` 추가)가 프로덕션 diff(5곳)보다 훨씬 넓어 보였으나, 실측 결과 파일 전역 default mock 구조에서 비롯된 필연적 파급으로 확인됨(scope 이탈 아님). | `execution-engine.service.spec.ts` 다수 지점 | 없음(장기적으로 공유 default mock 축소 고려) |
| 21 | maintainability | `TERMINAL_FINISHED_AT_PARAM` 문자열 값이 SQL 리터럴과 상수 선언 두 곳에 하드코딩 중복 — 단위 테스트가 사후 방어만 함. | `terminal-duration.ts:75-79` | 템플릿 리터럴로 상수를 SQL 에 참조시켜 drift 자체를 구조적으로 제거 |
| 22 | api_contract | `durationMs` 를 종결 이벤트 payload 에 추가하는 것은 additive field 라 EIA §12 Rationale 대로 하위 호환성 문제 없음 — `notification-fanout.service.ts` 가 payload 를 그대로 통과시키는 것도 확인. | `notification-fanout.service.ts:134` 등 | 없음(설계 건전성 확인) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| requirement | HIGH | duration_ms int4 오버플로 CRITICAL(#1) 최초 지적 + SQL/JS 이상값 정책 비대칭(#8) + chat-channel 타입 불일치(#3) + 헬퍼 미적용 4곳(#2) |
| database | MEDIUM | 동일 오버플로를 독립 확인(#1, WARNING 등급이었으나 CRITICAL 로 승격 병합) |
| documentation | MEDIUM | chat-channel 타입 nullable 누락(#3) + CHANGELOG 누락(#11) |
| api_contract | MEDIUM | REST/push 표면 불일치(#4) + chat-channel 타입 불일치(#3) |
| testing | MEDIUM | markWebChatIdleTimeout/markQueueWaitTimeout 미검증(#9) + SQL 값 미검증(#10) |
| maintainability | MEDIUM | RETURNING 추출 boilerplate 반복(#5) + 동형 함수쌍 재복제(#6) + mock 반복(#12) |
| side_effect | MEDIUM | resolveTerminalDurationMs 헬퍼 미적용 4곳(#2) — 헬퍼가 스스로 경계한 회귀 클래스 재발 |
| architecture | LOW | 5곳 오케스트레이션 복제(#5) + 컬럼명 하드코딩(#7) |
| scope | LOW | 기능 외 스펙 오탈자 정정 포함(정당), mock 확산 범위 검증(정당) |
| performance | LOW | 중복 함수 호출(#13) 외 실질 이슈 없음 — N+1/캐싱/블로킹 I/O 문제 없음 |
| security | NONE | SQL 인젝션·인가·민감정보 노출 없음 — 발견사항 없음 |

## 발견 없는 에이전트

- **security** — raw SQL 파라미터 바인딩 안전, 방어적 파싱, 민감정보 노출 없음, 인증/인가 경계 변경 없음(모두 INFO 확인만).

## 권장 조치사항

1. **(CRITICAL, 최우선)** `TERMINAL_DURATION_MS_SQL` 에 상한 클램프(`LEAST(2147483647, ...)`) 추가 — 24.8일 이상 대기 실행의 취소/실패 처리가 DB 에러로 조용히 실패하는 회귀를 즉시 차단.
2. `resolveTerminalDurationMs` 안전 패턴을 누락 4곳(`driveCallStackResume`/`finalizeFailedExecution`/`completeRetryExecution`/`failRetryExecution`)에 적용 — 헬퍼가 스스로 경계한 회귀 클래스 재발 방지.
3. chat-channel 소비 타입(`types.ts`, `chat-channel-adapter.md`)의 `durationMs?: number` 를 `durationMs: number | null` 로 정정 — `error.code` 패턴과 통일.
4. `markWebChatIdleTimeout`/`markQueueWaitTimeout` 테스트의 emit 단언을 `objectContaining` → 정확 매칭으로 바꿔 `durationMs` 추출/폴백 로직을 실제로 검증.
5. REST 단발 조회(§5.3/`ExecutionStatusDto`)에 `durationMs` 반영 여부를 결정하고 문서화(반영하지 않는다면 사유 명시).
6. `CHANGELOG.md` 에 `durationMs` 추가를 알리는 Unreleased 항목 작성.
7. (낮은 우선순위) raw UPDATE 5곳의 바인딩+RETURNING 파싱 boilerplate 추출, `cancelParkedExecution`/`markWebChatIdleTimeout` 통합, SQL 컬럼명-엔티티 타입 연결, queryBuilder mock 공유 팩토리 도입 등 유지보수성 개선을 다음 리팩터 후보로 트래킹.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: security, performance, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, api_contract (11명)
  - **제외**: 아래 표 (3명)
  - **강제 포함(router_safety)**: documentation, maintainability, requirement, scope, security, side_effect, testing (7명) — 전원 결과 확보됨, 강제 화이트리스트 미이행 없음

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | router 판단상 이번 변경(내부 로직/SQL/타입 배관)에 신규 패키지 의존성 변경 없음 |
  | concurrency | router 판단상 동시성 제어 로직 변경 없음(기존 트랜잭션/락 구조 유지) |
  | user_guide_sync | router 판단상 사용자 가이드 문서 영향 없음(내부 API/이벤트 payload 변경) |