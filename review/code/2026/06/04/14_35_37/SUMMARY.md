# Code Review 통합 보고서

> 대상: PR2a — 단일 Execution active-running 누적 타임아웃 구현
> 생성: 2026-06-04

---

## 전체 위험도

**MEDIUM** — 기능 구현은 완전하고 핵심 설계는 적절하나, 테스트 타이밍 비결정성(fake timer 미사용), Graceful Shutdown 시 세그먼트 flush 미보장, 사용자 대면 ko 번역 누락, spec 갱신 미완료(SPEC-DRIFT 3건) 등 후속 조치가 필요한 WARNING 항목이 다수 존재한다.

---

## Critical 발견사항

해당 없음.

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SPEC-DRIFT | [SPEC-DRIFT] 에러코드 불일치: spec §8은 `EXECUTION_TIMEOUT`, 구현은 `EXECUTION_TIME_LIMIT_EXCEEDED`. 코드가 올바르고 spec이 낡음 — 재사용 시 classifier 충돌 방지 목적의 의도적 분리. | `codebase/backend/src/nodes/core/error-codes.ts`, `spec/5-system/4-execution-engine.md §8` | spec §8 line 937 `EXECUTION_TIMEOUT` → `EXECUTION_TIME_LIMIT_EXCEEDED` 로 교체; `spec/5-system/3-error-handling.md §1.4` 에 신규 행 추가; `spec/conventions/chat-channel-adapter.md §3.1` 분류 표에 행 추가 |
| 2 | SPEC-DRIFT | [SPEC-DRIFT] 측정 기준 불일치: spec §8은 암묵적 wall-clock, 구현은 active-running 누적(`waiting_for_input` 제외). 합리적이고 의도적인 설계 개선. | `spec/5-system/4-execution-engine.md §8`, `codebase/backend/src/modules/execution-engine/execution-engine.service.ts`, `codebase/backend/migrations/V073__execution_active_running_ms.sql` | spec §8 해당 행에 "(active-running 누적 시간 기준; waiting_for_input park 시간 제외)" 보충 설명 추가 |
| 3 | SPEC-DRIFT | [SPEC-DRIFT] 한도 출처 불일치: spec §8은 `Workflow.settings`, 구현은 env 전역 상수. 단계적 구현임이 JSDoc과 plan에 명시됨. | `spec/5-system/4-execution-engine.md §8`, `codebase/backend/src/modules/execution-engine/execution-limits.ts` | spec §8 표 해당 행을 "(1단계) env `EXECUTION_MAX_ACTIVE_RUNNING_MS`(기본 30분); per-workflow 설정은 후속"으로 갱신 |
| 4 | 동시성 | Graceful Shutdown 시 `segmentStartMs` 인-플라이트 세그먼트 flush 미보장. SIGTERM 후 job이 다른 worker로 이관될 때 해당 세그먼트 active 시간이 DB에 누적되지 않아 타임아웃이 silent under-count될 수 있음. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `segmentStartMs`, `updateExecutionStatus` | Graceful Shutdown 훅에서 인-플라이트 세그먼트를 DB에 flush하거나, 설계 의도("over-count보다 under-count 허용")를 주석에 명시 |
| 5 | 동시성 | `assertActiveTimeWithinLimit` + `updateExecutionStatus` 간 비원자적 read-check-then-act. continuation worker concurrency > 1이고 동일 Execution에 복수 continuation job이 동시 실행되면 `segmentStartMs` key 충돌로 세그먼트 시간 소실 가능. 설계 불변식(Execution 직렬화) 보장 여부 확인 필요. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 단일 Execution에 대해 `segmentStartMs.set/delete` 쌍이 상호 배제됨을 invariant 주석으로 명시 |
| 6 | 테스팅 | 테스트 코드에서 `Date.now()` 직접 사용으로 타이밍 민감 어서션 2건 — CI 환경 부하에 따라 flaky 가능성. `jest.useFakeTimers()` 미사용. | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 라인 1422–1455, 1398–1409 | `jest.useFakeTimers()` + `jest.setSystemTime()` 적용, 또는 `nowFn: () => number = Date.now` 주입으로 결정론적 제어 |
| 7 | 테스팅 | private 멤버 직접 접근(`priv()` 헬퍼) 패턴이 구현 세부사항에 강결합. 리팩토링 시 컴파일 에러 없이 런타임 `undefined`로 조용히 깨질 수 있음. | `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `priv()` 헬퍼 정의부 | 장기적으로 `ActiveRunningTracker` 등 독립 클래스로 추출해 public API로 테스트 가능하도록 구조 개선 검토. 단기에는 현행 유지 가능 |
| 8 | 문서화 | spec 큐 카탈로그 미갱신: `execution-run` 큐가 `MONITORED_QUEUES`에 추가됐으나 `spec/data-flow/0-overview.md §4` 카탈로그와 `spec/data-flow/3-execution.md §1.1` 다이어그램이 미갱신. `system-status.constants.ts` 주석의 갱신 절차 미준수. | `spec/data-flow/0-overview.md §4`, `spec/data-flow/3-execution.md §1.1` | `spec/data-flow/0-overview.md §4`에 `execution-run` 행 추가 + `spec/data-flow/3-execution.md §1.1` 다이어그램 갱신 |
| 9 | 문서화 | `spec/5-system/14-external-interaction-api.md §5.2` EIA notification payload 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 에러코드 미반영. consistency-check SUMMARY W2와 동일 이슈. | `spec/5-system/14-external-interaction-api.md §5.2` | notification `code` 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 |
| 10 | 사용자 가이드 동기화 | 신규 `ErrorCode.EXECUTION_TIME_LIMIT_EXCEEDED` 추가 시 `backend-labels.ts` ERROR_KO 매핑 누락. ko 로케일 실행 이력 detail에서 영문 fallback 노출 가능. | `codebase/frontend/src/lib/i18n/backend-labels.ts` | `ERROR_KO` 테이블에 `EXECUTION_TIME_LIMIT_EXCEEDED: "실행 시간 한도(최대 active 실행 누적 시간)를 초과했어요."` 추가 |
| 11 | 사용자 가이드 동기화 | 실행 엔진 active-running 타임아웃 신규 실패 모드가 `05-run-and-debug/error-handling.mdx` 및 `.en.mdx`에 미문서화. 사용자가 30분 active 시간 초과 실패 원인을 이해하지 못할 수 있음. | `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx`, `.en.mdx` | "실행 시간 한도 초과" 섹션 추가 (active-running 기준, waiting_for_input 제외, 30분 기본값, env 조정법, EXECUTION_TIMEOUT과의 차이) |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | 보안 | `ExecutionTimeLimitError` 메시지에 내부 수치(`activeRunningMs`, `limitMs`) 포함. 채널 어댑터 경로에서는 노출 안 되나 REST 등 다른 경로 확인 필요. | `codebase/backend/src/modules/execution-engine/workflow-errors.ts` — `ExecutionTimeLimitError` constructor | run 실패 빌더에서 message 원문 누출 여부 검증; 또는 수치를 로그에만 기록하고 메시지는 고정 문자열로 단순화 |
| 2 | 아키텍처 | `EXECUTION_TIME_LIMIT_EXCEEDED`가 `nodes/core/error-codes.ts`에 추가됐으나 엔진 인프라 에러를 노드 코어 파일에 두는 것은 계층 오염. consistency-check W4 인지 항목. | `codebase/backend/src/nodes/core/error-codes.ts` | `// Execution Engine / Infrastructure` 섹션 그루핑 또는 별도 `execution-engine-error-codes.ts` 신설 후 re-export. PR2b 범위 등재 항목 |
| 3 | 아키텍처 | `assertActiveTimeWithinLimit` 메서드가 정책 결정 + 상태 접근을 동시 수행. 8000+ 라인 대형 서비스에 추가 책임 집중. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 장기적으로 `ExecutionLimitsGuard` 별도 클래스로 분리 검토 |
| 4 | 아키텍처 | `execution-limits.ts` 모듈 경계 미명시 — 향후 PR2b·per-workflow 설정 추가 시 수렴/분화 기준 부재. | `codebase/backend/src/modules/execution-engine/execution-limits.ts` | 역할 범위 주석 명시("env 파싱·기본값만; 판정 로직은 service 또는 별도 guard") |
| 5 | 아키텍처 | `system-status.constants.ts`에서 `continuationConcurrency`는 인라인 파싱, `executionRunConcurrency`는 함수 위임으로 두 패턴 혼재. | `codebase/backend/src/modules/system-status/system-status.constants.ts` | 장기적으로 모든 worker concurrency 해석을 `execution-limits.ts` 또는 단일 config 모듈로 통합 |
| 6 | 유지보수성 | `resolveMaxActiveRunningMs`의 정규식 선검증 후 `Number.isInteger` 이중 검증 — 이론적 중복. 주석이 독자 혼란 유발 가능. | `codebase/backend/src/modules/execution-engine/execution-limits.ts` 라인 20–27 | 정규식 통과 후 단순 `Number(raw)` 반환으로 단순화, 또는 이중 검증 의도 주석 명시 |
| 7 | 유지보수성 | `assertActiveTimeWithinLimit` 인자 타입이 `Execution` 전체이나 실제 사용 필드는 `id`·`activeRunningMs` 두 개뿐. 테스트의 `priv()` 타입 선언이 더 정확. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | 인자 타입을 `Pick<Execution, 'id' \| 'activeRunningMs'>` 로 축소 |
| 8 | 유지보수성 | `maxActiveRunningMs` 모듈 초기화 시 1회 평가 — 런타임 env 변경 시 재시작 필요하나 미문서화. | `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` | JSDoc 및 `.env.example`에 "재시작 필요" 주석 추가 |
| 9 | 테스팅 | `execution-failure-classifier.ts`에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가 시 대응 유닛 테스트 신규 케이스 추가 여부 확인 불가. | `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.spec.ts` (또는 유사) | `code: 'EXECUTION_TIME_LIMIT_EXCEEDED'` → `key: 'executionFailedTimeout'` 반환 케이스 추가 |
| 10 | 테스팅 | `ExecutionTimeLimitError` 클래스 자체(메시지 포맷, `.code` 값)에 대한 독립 단위 테스트 부재. | `codebase/backend/src/modules/execution-engine/workflow-errors.ts` | `workflow-errors.spec.ts` 또는 `execution-limits.spec.ts`에 생성자 파라미터 → `message`/`.code` 검증 테스트 추가 |
| 11 | 테스팅 | e2e 테스트 `it('인증 시 12개 큐의 집계 상태를 반환한다', ...)` 설명 문자열 stale — 실제 큐는 13개. 기능 오류는 아님. | `codebase/backend/test/system-status.e2e-spec.ts` 라인 81 | 설명 문자열을 "13개 큐"로 수정 |
| 12 | 문서화 | `resolveMaxActiveRunningMs` JSDoc에 `@returns` 미기재. "0=무제한/양수=ms 한도" 의미 구분이 IDE hover에서 미노출. | `codebase/backend/src/modules/execution-engine/execution-limits.ts` | `@returns 0 if unlimited; positive integer = limit in milliseconds.` 한 줄 추가 |
| 13 | 문서화 | `ExecutionTimeLimitError` constructor `@param` 누락. 숫자 두 개의 순서 혼동 가능. | `codebase/backend/src/modules/execution-engine/workflow-errors.ts` | `@param activeRunningMs`/`@param limitMs` 추가 (기존 관행과 일치시켜 생략도 허용) |
| 14 | 문서화 | `.env.example` 주석에 내부 PR 추적 식별자(`PR2a`)와 spec 참조(`§8`) 포함. 기존 패턴 일치이나 외부 공개 시 혼란 가능. | `codebase/backend/.env.example` 라인 35 | 외부 공개 시 `PR2a — §8` 제거하고 설명만 유지 |
| 15 | 데이터베이스 | `active_running_ms` 컬럼 `INTEGER` 타입 — `maxActiveRunningMs=0`(무제한) 운용 시 이론적 int4 범위 초과 가능(24일+). 실질적 발생 가능성 낮음. | `codebase/backend/migrations/V073__execution_active_running_ms.sql`, `codebase/backend/src/modules/executions/entities/execution.entity.ts` | 현행 유지. 무제한 운용 정책 명시 시 재검토 |
| 16 | 부수효과 | `activeRunningMs` 엔티티 필드가 API 응답 DTO에 포함되는지 미확인. 내부 계측 필드이므로 외부 노출 의도 없음. | `codebase/backend/src/modules/executions/entities/execution.entity.ts`, ExecutionsService DTO 경로 | `findById` 등 DTO 생성 경로에서 `activeRunningMs` 외부 노출 여부 확인 후 필요 시 exclusion 처리 |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 에러 메시지 내부 수치 포함(INFO), segmentStartMs 단일 인스턴스 전제(INFO), 정규식 이중 검증(INFO). 실질 취약점 없음 |
| architecture | LOW | segmentStartMs PR3 stalled-job 재배달 시 인스턴스 전제 붕괴 위험(INFO), 에러코드 계층 오염(INFO), assertActiveTimeWithinLimit SRP 경계(INFO) |
| requirement | LOW | SPEC-DRIFT 3건(에러코드명·측정기준·한도출처) — 코드 정상, spec 갱신 필요. e2e 설명 문자열 stale(INFO) |
| scope | NONE | 14개 변경 파일 모두 PR2a 범위 내. 불필요한 리팩토링·무관 기능 없음 |
| side_effect | LOW | segmentStartMs 멀티 워커 누락(WARNING), maxActiveRunningMs 1회 고정(WARNING). 실질 운영 위험 낮음 |
| maintainability | LOW | 이중 검증 중복(INFO), concurrency 파싱 패턴 불일치(INFO), 인자 타입 과대(INFO) |
| testing | MEDIUM | Date.now() 타이밍 민감 어서션 2건(WARNING), private 멤버 직접 접근(WARNING), classifier 신규 케이스 미확인(INFO) |
| documentation | LOW | 큐 카탈로그 미갱신(WARNING), EIA spec 예시 미반영(WARNING), e2e 큐 개수 불일치(INFO) |
| database | NONE | NOT NULL DEFAULT 0 안전한 마이그레이션, entity 선언 일치, 별도 쿼리 오버헤드 없음 |
| concurrency | MEDIUM | Graceful Shutdown flush 미보장(WARNING), read-check-then-act 비원자성(WARNING) |
| user_guide_sync | MEDIUM | ERROR_KO ko 번역 누락(WARNING), error-handling docs 신규 실패 모드 미문서화(WARNING) |

---

## 발견 없는 에이전트

- **scope**: 범위 이탈 없음 — 14개 변경 파일 전부 PR2a plan 범위 내 정상
- **database**: DB 관점 위험 사항 없음 — 무중단 마이그레이션, 정합 entity, 안전한 쿼리 패턴

---

## 권장 조치사항

1. **(즉시)** `codebase/frontend/src/lib/i18n/backend-labels.ts` — `EXECUTION_TIME_LIMIT_EXCEEDED` ko 번역 추가 (`실행 시간 한도(최대 active 실행 누적 시간)를 초과했어요.`)
2. **(즉시)** `spec/5-system/4-execution-engine.md §8` — SPEC-DRIFT 3건 일괄 갱신 (에러코드명 교체, 측정기준 보충, 한도출처 1단계/후속 분리)
3. **(즉시)** `spec/5-system/3-error-handling.md §1.4`, `spec/conventions/chat-channel-adapter.md §3.1` — `EXECUTION_TIME_LIMIT_EXCEEDED` 행 추가
4. **(즉시)** `spec/data-flow/0-overview.md §4` — `execution-run` 큐 행 추가; `spec/data-flow/3-execution.md §1.1` 다이어그램 갱신
5. **(즉시)** `spec/5-system/14-external-interaction-api.md §5.2` — EIA notification 예시에 `EXECUTION_TIME_LIMIT_EXCEEDED` 추가
6. **(단기)** `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `jest.useFakeTimers()` 적용으로 타이밍 민감 테스트 2건 결정론화
7. **(단기)** `codebase/frontend/src/content/docs/05-run-and-debug/error-handling.mdx` 및 `.en.mdx` — "실행 시간 한도 초과" 섹션 신설
8. **(단기)** `execution-failure-classifier.spec.ts` — `EXECUTION_TIME_LIMIT_EXCEEDED` → `executionFailedTimeout` 분류 케이스 추가
9. **(단기)** `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — Graceful Shutdown 훅에서 인-플라이트 세그먼트 flush 또는 설계 주석 명시
10. **(단기)** `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `assertActiveTimeWithinLimit` 인자 타입을 `Pick<Execution, 'id' | 'activeRunningMs'>` 로 축소
11. **(후속/PR2b)** `codebase/backend/src/nodes/core/error-codes.ts` — 엔진 인프라 에러코드 섹션 분리 또는 별도 모듈로 추출 (consistency-check W4)
12. **(후속)** `codebase/backend/test/system-status.e2e-spec.ts` 라인 81 — 설명 문자열 "12개 큐" → "13개 큐" 수정

---

## 라우터 결정

라우터 선별 실행.

**실행** (11명): security, architecture, requirement, scope, side_effect, maintainability, testing, documentation, database, concurrency, user_guide_sync

**제외** (3명):

| 제외된 reviewer | 이유 |
|-----------------|------|
| performance | 라우터 선택 제외 |
| dependency | 라우터 선택 제외 |
| api_contract | 라우터 선택 제외 |

**강제 포함 (router_safety)**: database, documentation, maintainability, requirement, scope, security, side_effect, testing