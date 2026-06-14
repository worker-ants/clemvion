# Code Review 통합 보고서

## 전체 위험도
**LOW** — NF-OB-07 비즈니스 메트릭 파이프라인 구현은 전반적으로 안전하게 완성됐다. 이전 리뷰(12_32_02)에서 제기된 CRITICAL/WARNING 항목이 모두 해소된 상태이며, 이번 2차 리뷰에서 신규 CRITICAL 항목은 없다. 아키텍처·성능 관점의 WARNING 2건은 이미 plan 후속(W-10, W-12)으로 기록된 기술부채 항목이다.

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 없음 | — | — |

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Architecture / Side Effect | `registerQueueDepthProvider` push 등록 패턴이 암묵적 계약 생성 — DIP/OCP 위반. 가변 배열에 외부 push 가능, 큐 모듈 추가 시 등록 누락 위험 | `business-metrics.service.ts` L52, L124-126; `execution-engine.service.ts` onModuleInit L900; `continuation-dlq-monitor.service.ts` onModuleInit L61 | 중기 개선: `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰 패턴으로 전환해 push 등록 제거. 현재는 실용적 안전성 확보(스냅샷 이터레이션 + private readonly) — 단기 차단 아님 (plan W-10) |
| 2 | Architecture / Performance | `ExecutionEngineService`에 관측성 코드 혼재 — SRP 약화. `recordNodeLatencyMetrics`가 실행 종료마다 전체 node_execution JOIN SELECT 수행 | `execution-engine.service.ts` `emitTerminalExecutionMetrics` L9359, `recordNodeLatencyMetrics` L9387, onModuleInit L900 | 중기: `ExecutionMetricsCollector` 분리 + 옵저버 패턴 전환. 단기: `(execution_id, status)` 복합 인덱스 마이그레이션 파일 확인 (plan W-12) |

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | Security | `recordLlmTokens`의 `model`, `recordNodeDuration`의 `nodeType`·`status` 라벨에 길이 클램핑 없음 (cardinality 방어 부재) | `business-metrics.service.ts` `recordLlmTokens`, `recordNodeDuration` | 출처가 bounded-cardinality enum이면 주석 명시; 외부 입력 경로라면 `substring(0,64)` 클램핑 추가 |
| 2 | Security / Performance | `recordLlmTokens` falsy 체크(`if (usage.inputTokens)`)가 음수를 허용 — OTel Counter 음수 누적은 undefined behavior | `business-metrics.service.ts` L97-105 | `if (usage.inputTokens > 0)` 으로 명시적 양수 검증 |
| 3 | Security / Concurrency | `observeQueues` provider 타임아웃 부재 — Redis hang 시 수집 주기 전체 지연 가능 | `business-metrics.service.ts` L133-153 | `Promise.race([provider(), timeout(5000)])` 패턴 도입 (plan I-3, 후속 PR) |
| 4 | Architecture | `LlmTokenUsage` 내부 인터페이스가 `TokenUsage`와 구조적 중복 — 향후 diverge 시 조용히 계측 누락 위험 | `business-metrics.service.ts` L25-29 | 중기: `Pick<TokenUsage, ...>` 또는 공유 패키지 타입으로 통합 |
| 5 | Architecture | `leftJoin` + `addSelect` 패턴에서 삭제된 node 레거시 row의 `node_type='unknown'` 집계 — Grafana에서 의미 불명확 | `execution-engine.service.ts` `recordNodeLatencyMetrics` L9389-9413 | spec에 `node_type='unknown'` 의미 명시 (코드 변경 불필요) |
| 6 | Performance | `observeQueues` — 큐 증가 시 Redis I/O 선형 증가. 현재 병렬 `Promise.allSettled` 적용됨 | `business-metrics.service.ts` L133-153 | 큐 수 증가 시 Redis 파이프라인(`pipeline()`) 고려 |
| 7 | Maintainability | `recordLlmTokens` falsy 체크의 명시성 부족 (`undefined`·`null`·`0` 동일 처리) | `business-metrics.service.ts` L97-105 | `if (usage.inputTokens != null && usage.inputTokens > 0)` 또는 JSDoc 명기 |
| 8 | Maintainability | `onModuleInit` 내 핸들러 등록 + gauge 등록 책임 혼재 | `execution-engine.service.ts` L896-928 | `private registerQueueDepthProviders(): void` 전용 메서드로 추출 (선택적 리팩토링) |
| 9 | Maintainability | `QueueDepthProvider` 타입 JSDoc에 throw 시 에러 처리 계약 미명시 | `business-metrics.service.ts` L23 | JSDoc에 "throw 시 해당 수집 주기 건너뜀, warn 로그" 한 줄 추가 |
| 10 | Maintainability | `app.module.ts` import 선언 위치와 모듈 배열 위치 불일치 | `app.module.ts` import 섹션 | import 선언을 다른 `modules/` 블록으로 이동 (사소) |
| 11 | Testing | `llm-usage-log.service.spec.ts` — insert 실패 케이스에서 예외 비전파 assertion 누락 | `llm-usage-log.service.spec.ts` L42-51 | `await expect(service.record(...)).resolves.toBeUndefined()` 추가 |
| 12 | Testing | `business-metrics.service.spec.ts` — 복수 provider 모두 성공 시 합산 관측 케이스 없음 | `business-metrics.service.spec.ts` L89-126 | 두 provider 모두 성공 케이스 추가해 `Promise.allSettled` 집계 정확성 검증 |
| 13 | Testing | `continuation-dlq-monitor.service.spec.ts` — 큐 이름 `expect.any(String)` 단언으로 잘못된 큐 이름 미검출 | `continuation-dlq-monitor.service.spec.ts` L130-158 | `queue: CONTINUATION_EXECUTION_QUEUE` 로 구체적 값 단언 |
| 14 | Testing | `execution-engine.service.spec.ts` — `onModuleInit`에서 `registerQueueDepthProvider` 1회 호출 검증 케이스 없음 | `execution-engine.service.spec.ts` L15627+ | `onModuleInit 시 registerQueueDepthProvider 를 1회 호출한다` 케이스 추가 |
| 15 | Testing | `business-metrics.service.spec.ts` — 음수 토큰 입력에 대한 테스트 케이스 없음 | `business-metrics.service.spec.ts` L62-77 | 음수 정책(skip vs. clamp) 결정 후 케이스 추가 |
| 16 | Documentation | `recordLlmTokens` JSDoc에 `LlmTokenUsage` ↔ `TokenUsage` 구조적 호환 관계 미설명 | `business-metrics.service.ts` L25-29, L96 | JSDoc에 "metrics 모듈 결합도 최소화를 위해 로컬 interface 별도 정의, TokenUsage 호환" 명기 |
| 17 | Documentation | `checkOnce` JSDoc이 gauge provider 등록과의 역할 분리 미언급 | `continuation-dlq-monitor.service.ts` L102-115 | JSDoc에 "gauge 관측은 onModuleInit provider 담당; 본 메서드는 알람(log) 전용" 한 줄 추가 |
| 18 | Documentation | `emitTerminalExecutionMetrics`의 `persisted` 파라미터 JSDoc 미설명 | `execution-engine.service.ts` L9353-9358 | `@param persisted - DB 저장 성공 여부; false 이면 메트릭 기록 건너뜀` 추가 |
| 19 | Documentation | `recordNodeLatencyMetrics` `durationMs == null` 인라인 주석 부재 | `execution-engine.service.ts` L9404 | `// 미완료·레거시 row — finishedAt 미기록 시 null` 인라인 주석 추가 |
| 20 | Documentation | `metrics.module.ts` JSDoc에 독립 모듈 분리 근거 미기술 | `metrics.module.ts` L4-7 | "(여러 feature 모듈 계측 지점 분산 — 단일 feature 모듈 귀속 불가)" 한 줄 추가 |
| 21 | Documentation | `spec/_product-overview.md` `clemvion.node.duration` histogram bucket 정책 미명시 | `spec/5-system/_product-overview.md` L87 | 카탈로그 표에 "기본 OTel bucket 사용; 세분화 필요 시 ExplicitBucketHistogramAggregation 재구성 가능" 주석 추가 |
| 22 | Documentation | `.env.example` — NF-OB-07 도메인 메트릭 5종 노출 사실 미반영 | `codebase/backend/.env.example` L312-316 | OTel 주석 블록에 NF-OB-07 도메인 메트릭 5종 언급 추가 |
| 23 | Security | DLQ 알람 로그에 내부 임계값(`thresholdJobs`) 노출 | `continuation-dlq-monitor.service.ts` DLQ ALARM 로그 | 로그 파이프라인 외부 노출 여부 운영 설정 점검 |

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| security | LOW | 모든 항목 INFO 수준. SQL 인젝션·하드코딩 시크릿 없음. cardinality 클램핑 일부 누락, 음수 토큰 방어 부재 |
| performance | LOW | `recordNodeLatencyMetrics` 실행 종료마다 JOIN SELECT (누적 부하 위험). `observeQueues` 병렬화 적용 완료 |
| architecture | LOW | `registerQueueDepthProvider` push 패턴(W-10), `ExecutionEngineService` SRP 약화(W-12) — 이미 plan 후속 등록 |
| requirement | NONE | NF-OB-07 5종 instrument 모두 구현. 이전 CRITICAL/WARNING 전부 해소. 신규 이슈 없음 |
| scope | NONE | 변경 범위 NF-OB-07 목적에 응집. 의도치 않은 이탈 없음 |
| side_effect | LOW | 생성자 시그니처 변경(테스트 반영 완료), queueProviders 가변 배열 push 부작용(스냅샷 이터레이션으로 안전) |
| maintainability | LOW | falsy 체크 명시성 부족, onModuleInit 책임 혼재 등 INFO 수준 가독성 개선 항목 |
| testing | LOW | 기본 커버리지 양호. 복수 provider 합산 관측 케이스 누락, 큐 이름 구체적 단언 누락, registerQueueDepthProvider 호출 검증 누락 등 |
| documentation | LOW | 전반적 양호. 이전 리뷰 지적 INFO 항목 미조치 다수. emitTerminalExecutionMetrics `persisted` 파라미터 신규 발견 |
| concurrency | LOW | 실질적 동시성 위험 없음. queueProviders 스냅샷 이터레이션 조치 완료. 타임아웃 미적용(I-3, plan 후속) |

## 발견 없는 에이전트

- **requirement**: NONE (NF-OB-07 요구사항 100% 충족, 이전 CRITICAL/WARNING 전부 해소)
- **scope**: NONE (의도치 않은 범위 이탈 없음)

## 권장 조치사항

1. **[즉각/선택적] 음수 토큰 방어 강화**: `recordLlmTokens`에서 `if (usage.inputTokens > 0)` 명시적 양수 검증으로 교체 — OTel Counter 음수 누적 undefined behavior 방지 (INFO #2, 성능·보안·유지보수 3개 리뷰어 동일 지적)
2. **[즉각/선택적] 테스트 보강 3종**: (a) `onModuleInit → registerQueueDepthProvider` 1회 호출 검증 케이스, (b) 복수 provider 합산 관측 케이스, (c) `CONTINUATION_EXECUTION_QUEUE` 구체적 큐 이름 단언 — 회귀 방지 강도 향상
3. **[중기] provider 타임아웃 적용(I-3)**: `Promise.race([provider(), timeout(5000)])` 패턴으로 Redis hang 시 수집 주기 차단 방지 — plan 후속 PR 범위
4. **[중기] `registerQueueDepthProvider` DI 토큰 패턴 전환(W-10)**: `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰으로 암묵적 등록 계약 제거 — plan 후속 기술부채
5. **[중기] `ExecutionMetricsCollector` 분리(W-12)**: `ExecutionEngineService`에서 관측성 DB 쿼리 분리 + `ExecutionEventEmitter` 옵저버 패턴 전환 — SRP 회복 및 `recordNodeLatencyMetrics` JOIN 부하 구조적 해결
6. **[선택적] Documentation 개선**: `emitTerminalExecutionMetrics` `persisted` 파라미터 JSDoc 추가, `durationMs == null` 인라인 주석, `checkOnce` JSDoc 역할 분리 언급 — 코드 이해도 향상

## 라우터 결정

라우터 선별 실행됨 (`routing_status=done`).

- **실행**: `security`, `performance`, `architecture`, `requirement`, `scope`, `side_effect`, `maintainability`, `testing`, `documentation`, `concurrency` (10명)
- **제외**: 4명

  | 제외된 reviewer | 이유 |
  |------------------|------|
  | dependency | 신규 npm 패키지 추가 없음 — 의존성 변경 없어 생략 |
  | database | 마이그레이션 파일 변경 없음 — DB 스키마 변경 없어 생략 |
  | api_contract | 신규 HTTP 엔드포인트 없음 — API 계약 변경 없어 생략 |
  | user_guide_sync | 사용자 가이드 관련 변경 없음 — 생략 |

- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)