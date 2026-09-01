# Code Review 통합 보고서

## 전체 위험도
**LOW** — 취소/retry 종결 경로의 관측성·정합성 잔여 결함을 닫는 방어적 리팩터. 기능적 CRITICAL/WARNING 결함은 없으나, 리팩터 과정에서 JSDoc 오귀속(WARNING 3건 중복 지적) 및 관측 로그 미검증(WARNING 2건)이 발견되어 정정 권고.

## Critical 발견사항

없음.

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 문서화/유지보수성/스코프 | `completeRetryExecution` 의 원본 JSDoc("COMPLETED 마감 fallback… `@internal` — `resumeGraphAfterRetry` 의 defensive fallback 에서만 호출")이 신규 헬퍼 `markSpawnedRowFailed`/`prepareSuccessTermination` 삽입으로 인해 46줄 밀려난 실제 함수(:777)로부터 분리되어, 지금은 `markSpawnedRowFailed`(:732, 전혀 다른 FAILED-마킹 목적) 바로 위에 얹혀 있다. 다음 독자가 두 함수의 호출 제약을 서로 바꿔 오독할 위험(documentation·maintainability·scope 3개 리뷰어 독립 중복 지적) | `codebase/backend/src/modules/execution-engine/retry-turn.service.ts:711-731`(orphan JSDoc) / `:732-742`(오귀속 대상 `markSpawnedRowFailed`) / `:777`(무주석 실제 `completeRetryExecution`) | 711-731 JSDoc 블록을 777줄 `completeRetryExecution` 선언 바로 위로 이동. 두 신규 헬퍼는 각자 이미 올바른 JSDoc(732-742, 757-769)을 갖고 있으므로 그대로 둘 것 |
| 2 | 테스트 | `executeSync` timeout catch 의 `persisted` 반환값 소비(이 diff 의 핵심 변경) — `if (!persisted) this.logger.warn(...)` — 를 검증하는 테스트가 없다. 관련 테스트(`execution-engine.service.spec.ts:3782`)가 전제조건(`persisted=false`)은 이미 세팅해 두고도 `logger.warn` 호출 여부는 단언하지 않아, 이 블록을 통째로 지워도 RED 로 안 떨어진다 | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts:4313-4322` / 관련 테스트 `execution-engine.service.spec.ts:3782` | 기존(또는 신규) 테스트에 `jest.spyOn(service['logger'], 'warn')` 추가 후 warn 호출·메시지 내용 단언 |
| 3 | 테스트 | `assertLinkedTransitionApplied` 신규 catch 블록의 `logger.error` 관측 로그(마킹 실패 시 남기는 유일한 신호)가 검증되지 않는다. 신규 테스트는 재throw 여부(`ExecutionCancelledError` 유지)만 확인하고 로그 페이로드(`nodeExec.id`/`phase`/원본 에러 메시지)는 단언하지 않아, `logger.error` 호출부만 지우거나 메시지를 훼손하는 뮤턴트는 잡히지 않는다 | `codebase/backend/src/modules/execution-engine/ai-turn-orchestrator.service.ts:409-432` / 테스트 `ai-turn-orchestrator.service.spec.ts:267-294` | 신규 테스트에 `jest.spyOn(orchestrator['logger'], 'error')` 추가해 로그 페이로드(대상 nodeExec id·원본 에러 메시지) 최소 단언 |
| 4 | 부작용/문서 drift | `Execution.error` 엔티티 필드를 `Record<string, unknown> | null` 로 넓힌 것이, diff 범위 밖 `executions.service.ts` 의 두 JSDoc("엔티티는 `error`/`inputData`/`outputData` 를 `| null` 없이 선언한다"는 전제로 `ResponseExecution` 재선언 이유를 설명)을 `error` 항목에 한해 무효화했다. 기능 영향은 없으나 다음 독자가 틀린 전제로 판단할 수 있음 | `codebase/backend/src/modules/executions/entities/execution.entity.ts:81`(변경) → 무효화 대상 `codebase/backend/src/modules/executions/executions.service.ts:74-89`, `:1052-1060` | `executions.service.ts` 의 해당 JSDoc 을 "`error` 는 이제 엔티티도 `| null` 이지만 `inputData`/`outputData` 는 여전히 아니다" 식으로 갱신하거나 `error` 항목만 표에서 분리 |
| 5 | 문서화 | 이번 fix 커밋(`59dd12869`)이 CHANGELOG.md 를 갱신하지 않음 — 같은 성격(`fix(engine)`, retry-turn 종결 경로 무가드 쓰기 차단)의 선행 커밋들(`92008b21f`, `7d1c8da9b`, `84cc53805`, `4e784a366`)은 모두 CHANGELOG 항목을 추가한 저장소 관행과 어긋남. 이번 fix 3건(성공 retry 의 옛 error 잔류, atomic consume SQL 무방비, 취소의 FAILED 오분류)은 사용자-관측 가능한 행동 변화라 관행상 CHANGELOG 대상으로 보임 | `CHANGELOG.md`(변경분 없음) | 후속 커밋으로 CHANGELOG.md "## Unreleased" 섹션에 이번 fix 요약 3건 추가 |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | DB 예외 메시지(`markNodeCancelled` 실패 시 `err.message`)를 로그에 그대로 삽입 — 클라이언트 미노출, 기존 패턴(`retry-turn.service.ts` `failRetryExecution`)의 연장이라 신규 위험 아님 | `ai-turn-orchestrator.service.ts:426-431` | 로그 싱크 접근 통제가 있으면 조치 불요 |
| 2 | 아키텍처 | `finalizeGuarded` 가 JSDoc 으로 in-place mutation 계약을 문서화했으나 구조적으로는 output-parameter 안티패턴을 고정한 것 — 세 번째 호출부 추가 시 되쓰기 누락 재발 가능 | `retry-turn.service.ts:567-576` | 후속 순수 반환형 전환 시 소비처 3곳(2곳+향후) 동반 마이그레이션 범위로 못박기 |
| 3 | 아키텍처 | `ExecutionEngineService`(timeout catch)와 `RetryTurnService`(`finalizeGuarded`)가 "guarded 종결 + 반환값 소비" 패턴을 서비스 경계를 넘어 독립 재구현 — 이번 diff 자체가 "한쪽만 관측을 맞췄던" 비대칭의 재발 사례 | `execution-engine.service.ts:4313-4322` vs `retry-turn.service.ts:583-709` | plan(`ie-resume-turn-boundary-cancel.md:539-542`)이 `markExecutionFailed` 공용 헬퍼 승격을 이미 추적 중 — 통합 시 `finalizeGuarded` 흡수 여부도 스코프에 포함 권고 |
| 4 | 동시성/DB | `markNodeCancelled` 실패를 흡수하는 처리가 짝 `NodeExecution` row 를 non-terminal 로 영구 잔류시킬 수 있고, BullMQ 재시도를 통한 자가 치유 경로도 닫는다 — plan 에 이미 인지·수용된 트레이드오프(감사 로그 실패와 동일 판단) | `ai-turn-orchestrator.service.ts:409-432` | 배포 후 stalled-job recovery 백스톱이 이 케이스를 커버하는지 관측 권장. 추가 코드 조치 불요 |
| 5 | DB | catch 블록이 DB 쓰기 실패와 비-DB 예외(프로그래밍 오류)를 구분하지 않고 동일 흡수 | `ai-turn-orchestrator.service.ts:416` | 우선순위 낮음. 필요 시 DB 예외로 범위 좁히는 후속 리팩터 검토 |
| 6 | DB(긍정) | `prepareSuccessTermination` 이 성공 종결 시 `execution.error=null` 명시 세팅 — `status='completed'`+`error` non-null 모순 레코드를 실제로 닫은 데이터 정합성 개선. 두 호출부(자연 종결·defensive fallback) 모두 뮤테이션 테스트로 고정 | `retry-turn.service.ts:770-775`, 호출부 `:781`, `:957` | 없음 (개선 확인) |
| 7 | 유지보수성 | 신규 테스트 2건("자연 종결"/"fallback 종결"이 이전 error 를 비운다)이 동일한 10줄 mock-캡처 블록을 인라인 반복 — 이미 알려진 mock 헬퍼 중복 백로그(W6)와 같은 성격 | `retry-turn.service.spec.ts:982-991`, `:1054-1063` | 로컬 헬퍼로 추출 또는 계획된 W6 테스트 위생 정리에 포함. 우선순위 낮음 |
| 8 | 테스트 | `retryLastTurn` atomic-consume 회귀가 mock query-builder 경계 안쪽만 검증(실 Postgres `jsonb_exists`/`-` 연산자 미검증) — plan 에 이미 e2e 인프라 필요로 등재·유예됨 | `retry-turn.service.spec.ts` 신규 "원자 consume…" 테스트 | 새 발견 아님, 참고용 |
| 9 | 요구사항 | spec(`spec/5-system/4-execution-engine.md`, `spec/conventions/node-cancellation.md`)에 이번 구현 세부(마킹 실패 catch 처리, guarded UPDATE 반환값 로깅)를 규정하는 본문 없음 — 회색지대, SPEC-DRIFT 아님. `plan_impact` 가 `spec/` 미변경과 일치 | 해당 없음 | 없음 |
| 10 | DB | `execution.entity.ts` `error` 타입 `| null` 정정은 DB 컬럼(`nullable: true`)과 일치시키는 순수 타입 수정, 마이그레이션 불요. `prepareSuccessTermination` 의 `error=null` 대입이 이 정정 없이는 컴파일 불가했던 의존 관계 | `execution.entity.ts:81` | 없음 |
| 11 | 문서화 | `markSpawnedRowFailed` JSDoc 에 `@param spawnedRow` 태그 누락(다른 두 파라미터는 기재) — 저장소 관행상 위반 아님, 완전성 관점 사소 | `retry-turn.service.ts:732-742` | 선택적, 조치 불요 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | NONE | 인증/인가·인젝션·시크릿 표면 변경 없음. 로그 메시지 노출은 INFO, 기존 패턴 연장 |
| architecture | LOW | 기존에 문서화된 기술부채(output-param 패턴 고정, 서비스 간 패턴 중복) 인지 — 악화 없음 |
| requirement | LOW | 처방 5건 전부 의도대로 구현, 뮤테이션 2건 RED 실측 확인. JSDoc orphan 1건(WARNING) |
| scope | LOW | changeset 이 plan 트래커가 지목한 항목에 정확히 한정. JSDoc 오귀속 1건(WARNING) |
| side_effect | LOW | 핵심 변경 전부 문서화된 의도. `Execution.error` 타입 확장이 타 파일 설계근거 무효화(WARNING) |
| maintainability | LOW | 헬퍼 추출로 DRY 개선. JSDoc 물리적 분리로 오독 위험(WARNING), 테스트 소규모 중복(INFO) |
| testing | LOW | 핵심 분기 뮤테이션 규율 높음. 신규 관측 로그 2건 미검증(WARNING 2건) |
| documentation | MEDIUM | JSDoc 오귀속(WARNING), CHANGELOG 누락(WARNING) — 둘 다 순수 문서 결함 |
| database | LOW | 신규 스키마/마이그레이션 없음. `prepareSuccessTermination` 모순 레코드 방지 개선 확인 |
| concurrency | LOW | 기존 동시성 방어 기전(jsonb_exists 가드, FOR UPDATE, COALESCE ABA 회피) 보존, 신규 위반 없음 |

## 발견 없는 에이전트

없음 — 전원 최소 INFO 이상 기록.

## 권장 조치사항
1. `retry-turn.service.ts` 의 `completeRetryExecution` JSDoc(711-731줄)을 실제 선언(777줄) 바로 위로 이동 — documentation/maintainability/scope 3개 리뷰어가 독립적으로 지적한 최다 중복 결함.
2. `execution-engine.service.ts` timeout catch 의 `logger.warn` 호출과 `ai-turn-orchestrator.service.ts` catch 의 `logger.error` 호출에 대한 spy 기반 단언을 각각 추가해, 이 diff 의 핵심 관측 변경이 실제로 테스트로 고정되도록 한다.
3. `executions.service.ts` 의 `error`/`inputData`/`outputData` 관련 JSDoc 을 갱신해 `Execution.error` 가 이제 엔티티 레벨에서도 `| null` 임을 반영한다.
4. 저장소 CHANGELOG 관행에 맞춰 이번 fix 커밋(`59dd12869`)의 3가지 수정사항을 CHANGELOG.md "## Unreleased" 에 추가한다.
5. (낮은 우선순위) 신규 테스트의 mock-캡처 중복 블록을 로컬 헬퍼로 추출 — 기존 W6 백로그와 함께 처리해도 무방.

## 라우터 결정

- `routing_status=done` (router 가 선별):
  - **실행**: `security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency` (10명)
  - **제외**: 표 (reviewer · 이유, 4명)
  - **강제 포함(router_safety)**: `documentation, maintainability, requirement, scope, security, side_effect, testing` (전원 결과 확보됨)

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | performance | router 판단 — 이번 diff 는 로그 추가·헬퍼 추출 중심으로 성능 표면 없음 |
  | dependency | router 판단 — 신규 의존성 도입 없음 |
  | api_contract | router 판단 — 외부 API 계약(엔드포인트·필드) 변경 없음 |
  | user_guide_sync | router 판단 — 사용자 가이드 대상 표면 변경 없음 |