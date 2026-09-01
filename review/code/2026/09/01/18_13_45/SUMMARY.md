# Code Review 통합 보고서

## 전체 위험도
**LOW** — CRITICAL 없음. WARNING 1건(문서/plan 트래커 정합성 — 이 PR 자신의 수정으로 다른 plan 항목의 근거가 거짓이 됐는데 미처분). 나머지는 전부 INFO 이며, 대다수는 이미 plan 에 인지·수용된 트레이드오프이거나 직전 라운드(`17_55_50`) WARNING 5건의 정상 조치 확인이다. forced 화이트리스트(documentation·maintainability·requirement·scope·security·side_effect·testing) 전원 결과 확보 완료 — 강제 미이행 없음.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | documentation | `retry-turn-terminal-guard.md` 의 "1차 라운드 잔여" INFO 2 항목이, 바로 이 PR 이 같은 파일의 W3 항목(`:219`, 2026-09-01 C-4 완료)에서 적용한 JSDoc `@param execution` 추가로 인해 그 실측 근거("JSDoc 에 `@param` 없음")가 지금 거짓이 됐는데도 `[ ]` 미체크·C-4 처분 표에 미편입 상태로 방치됨. 부수로 "남긴 7건"(`:64`) 서술과 처분 표 6행이 실측(`grep '^- \[ \]'` = 7건)과 어긋남. | `plan/in-progress/retry-turn-terminal-guard.md:199-211`(대상 항목), `:219-225`(W3), `:64`·`:67-72`(처분 표); 대조: `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:567-576` | `:199-211` 항목을 W3 와 상호 참조해 "duplicate — W3 로 해소"로 닫거나, 낡은 "실측" 문장을 취소선 처리. C-4 처분 표에 7번째 행으로 편입해 "남긴 7건" 수치와 표 행수 일치시킬 것 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 동시성/DB/보안/부작용 (5개 reviewer 공통) | `markNodeCancelled` DB 쓰기 실패를 흡수(catch)해 `ExecutionCancelledError` 로 결정론적 재분류 — 저장소 전역에서 취소/실패 분기 판정에 쓰이는 예외 타입이 바뀌어, BullMQ 재시도를 통한 자가 치유 경로가 닫히고 짝 `NodeExecution` row 가 non-terminal(RUNNING)로 잔류할 수 있음. plan(C-4)에 이미 인지·수용된 트레이드오프 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432` | 배포 후 마킹 실패 로그 빈도·잔류 non-terminal row 관측 유지, stalled-job recovery 백스톱이 이 케이스를 커버하는지 확인 권장 |
| 2 | 동시성/DB/부작용 | 같은 catch 블록이 DB 쓰기 실패와 비-DB(프로그래밍 오류) 예외를 구분하지 않고 동일 흡수 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:416` | 우선순위 낮음. 필요 시 DB 관련 예외로 범위를 좁히는 후속 리팩터만 검토 |
| 3 | 아키텍처/유지보수성 | `finalizeGuarded` 의 in-place mutation 계약(JSDoc `@param execution` 으로 이번에 문서화됨)이 여전히 output-parameter 패턴 — 컴파일러가 강제 못함, 세 번째 호출부 추가 시 되쓰기 누락 재발 가능 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:567-576` | 후속에서 순수 반환형(`{ persisted, live }`)으로 전환할 때 소비처(현재 2곳) 동반 마이그레이션 범위를 못박아 둘 것 |
| 4 | 아키텍처 | "guarded 종결 + 반환값 소비" 패턴이 `ExecutionEngineService`/`RetryTurnService` 서비스 경계를 넘어 독립 재구현되는 중복 — 정확히 이런 비대칭이 이번 changeset 이 닫으려는 결함의 근원이었음 | `execution-engine.service.ts:4308-4322` vs `retry-turn.service.ts:583-709` | 공용 헬퍼 승격(plan 추적 중, `markExecutionFailed`) 시 `finalizeGuarded` 도 같은 추상화로 흡수할지 스코프에 명시 |
| 5 | 유지보수성 | `ResponseExecution` 타입의 `error` 재선언이 엔티티 타입 정정(`| null`) 이후 완전히 동일 타입이 되어 이제 불필요한 간접화 | `codebase/backend/src/modules/executions/executions.service.ts:95-103` | 급하지 않음. 후속 정리 시 `Omit` 목록에서 `error` 제거 고려 |
| 6 | 유지보수성/요구사항 | `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그 누락(다른 두 파라미터는 기재) — 직전 라운드부터 이월 | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:718-721` | 선택적, 한 줄 추가 |
| 7 | 유지보수성 | `markSpawnedRowFailed` 의 인접 `string` 매개변수(`logContext`, `errorMessage`) 순서 실수를 타입 시스템이 못 잡음(현재 호출부 2곳은 정확) | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(선언부) | 급하지 않음. 호출부가 늘어나면 `{ logContext, errorMessage }` 객체 인자로 전환 고려 |
| 8 | 테스트/유지보수성 | 신규 테스트 2건이 mock-capture 블록(`NOT_CALLED` sentinel + `updateExecutionStatus` mockImplementation ~10줄)을 그대로 복제 — 이미 W6 테스트 위생 백로그 대상, 범위만 확대 | `codebase/backend/src/modules/execution-engine/retry-turn.service.spec.ts:982-991, 1054-1063` | 로컬 헬퍼(`captureErrorAtCompletion`)로 추출하거나 W6 정리 항목에 포함 |
| 9 | 테스트 | `warnSpy` 가 형제 spy(`runExecutionSpy`)와 달리 명시적 `mockRestore()` 없음 — `beforeEach` 마다 서비스 재생성되어 실질 누출은 없음 | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts:3791-3835` | 스타일 일관성을 위해 추가 고려(필수 아님) |
| 10 | 테스트 | 신규 회귀 테스트의 로그 페이로드 단언이 `phase` 필드는 포함하지 않음 — `phase=` 부분만 깨뜨리는 뮤턴트는 미검출 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.spec.ts:308-311` | 낮은 우선순위. `expect.stringContaining('AI turn — re-park')` 류로 phase 도 함께 고정 가능 |
| 11 | 문서화 | `assertLinkedTransitionApplied` 메서드 레벨 JSDoc(계약 문서)이 신규 마킹-실패 흡수(try/catch) 동작을 반영하지 않음 — 인라인 주석은 정확하나 상단 계약 문서 관행과 불일치 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:350-391`(JSDoc) vs `:409-432`(실제 신규 동작) | 메서드 JSDoc `shouldProceed === false` 절에 "`markNodeCancelled` 가 reject 해도 분류는 유지, 실패는 로그로만 관측(C-4)" 한 줄 추가 |
| 12 | 보안 | 내부 DB 예외 메시지를 서버 로그에 그대로 삽입 — 클라이언트 노출 경로는 아니나 로그 파이프라인이 외부로 export 되거나 낮은 권한자가 열람 가능하면 간접 데이터 노출 경로 가능(기존 패턴의 연장) | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts`(catch 블록) | 로그 싱크 접근통제가 이미 있다면 조치 불요 |
| 13 | 범위 | 하나의 changeset 에 독립적 결함 처방 3건(성공 retry `error` 잔류 정리·원자 consume SQL 하드닝·취소 마킹 실패 오분류 방지) + 리팩터 2건 + 엔티티 타입 정정이 함께 묶임 — 전부 plan 체크리스트로 추적되어 범위 이탈은 아니나 향후 revert/bisect 단위가 굵어짐 | `retry-turn.service.ts`, `ai-turn-orchestrator.service.ts`, `execution-engine.service.ts`, `execution.entity.ts` | 조치 불요. 다음 유사 라운드는 기능 결함군과 순수 리팩터 그룹을 별도 커밋으로 분리하면 bisect 에 유리 |
| 14 | 동시성 | `RetryTurnService` 자연 종결 경로가 `finalizeGuarded` 를 우회하고 `driver.updateExecutionStatus` 를 직접 호출 — 참조 동일성 불변식에 의존한다는 사실이 이번에 신규 주석으로 처음 문서화됨(로직 자체는 무변경) | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts`(`resumeGraphAfterRetry` 자연 종결 분기) | 조치 불요. 향후 orchestrator 가 엔티티를 재조회하는 형태로 바뀌면 이 호출도 `finalizeGuarded` 로 통일(주석에 이미 명시) |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가·인젝션·시크릿 취급 표면 변화 없음. `error` null 초기화는 오히려 스테일 에러 노출 감소 |
| architecture | LOW | 신규 아키텍처 결함 없음. `finalizeGuarded` mutation 계약·guarded 종결 패턴 중복은 기존에 인지된 부채, 악화 없음 |
| requirement | NONE | 이전 라운드 WARNING 5건 해소를 코드 대조+테스트 실행+독립 뮤테이션 재현으로 확인. spec 불일치 없음 |
| scope | NONE | 코드 변경 전량이 plan 체크리스트 항목에 1:1 대응. 무관한 수정·기능 확장 없음 |
| side_effect | LOW | `markNodeCancelled` 예외 재분류가 실질적 이벤트 라우팅 변화이나 문서화·수용된 트레이드오프. 신규 헬퍼는 동작 동치성 유지 |
| maintainability | LOW | 헬퍼 추출로 실질 DRY 개선. 신규 결함 없음, 잔여는 전부 INFO(테스트 중복·JSDoc 태그 누락 등) |
| testing | NONE | 직전 라운드 testing WARNING 2건(관측 로그 미검증)을 스파이 단언+premise 체크+뮤테이션 재현으로 실제 해소 확인 |
| documentation | LOW | 직전 라운드 WARNING 5건 조치 정확성 확인. 신규로 plan 트래커 자기모순 1건(WARNING) 발견 |
| database | LOW | 신규 스키마/쿼리 변경 없음. `prepareSuccessTermination` 이 모순 레코드(`status=completed`+`error` non-null) 실제 방지 확인 |
| concurrency | LOW | 기존 동시성 방어 기전(FOR UPDATE, guarded CAS, jsonb_exists, COALESCE ABA 회피) 전부 보존. 신규 레이스/원자성 위반 없음 |

## 발견 없는 에이전트

없음 — 10개 reviewer 전원이 최소 1건 이상의 INFO/WARNING 관찰을 남겼다(대부분 기존에 인지된 트레이드오프의 재확인 또는 사소한 완성도 여지).

## 권장 조치사항

1. `plan/in-progress/retry-turn-terminal-guard.md:199-211` 의 "1차 라운드 INFO 2" 항목을 W3(`:219`)과 상호 참조해 정리하고, C-4 처분 표의 "남긴 N건" 수치를 실제 미체크 항목 수(7건)와 일치시킨다 (WARNING #1, 유일한 액션 아이템).
2. (선택) `assertLinkedTransitionApplied` 메서드 JSDoc 에 신규 마킹-실패 흡수 계약 한 줄 추가, `markSpawnedRowFailed` JSDoc `@param spawnedRow` 보강 — 둘 다 저비용 문서 정리.
3. 나머지 INFO 는 전부 plan 에 이미 추적 중이거나(공용 헬퍼 승격, `finalizeGuarded` 반환형 전환) 이미 처분 완료(W6 테스트 위생 백로그)로 확인된 항목이라 이번 라운드에서 추가 조치 불요.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (10명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (7명, 전원 결과 확보됨)
  - **제외**: 4명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단상 이번 diff 범위(취소/retry 종결 경로 관측성 리팩터)와 무관 |
  | dependency | 신규 의존성 도입 없음 |
  | api_contract | 외부 API 계약 변화 없음(`ResponseExecution.error` 는 변경 전부터 `| null`) |
  | user_guide_sync | 사용자 대면 문서 변경 대상 아님(내부 종결 로직) |