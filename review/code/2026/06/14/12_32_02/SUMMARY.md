# Code Review 통합 보고서

## 전체 위험도
**MEDIUM** — 동시성 리뷰에서 OTel async gauge 콜백 계약 위반(실제 메트릭 데이터 공백 가능성)과 테스트 리뷰에서 실행 경로 핵심 메트릭 커버리지 갭이 MEDIUM 위험도를 유발. 나머지 영역은 모두 LOW 이하.

---

## Critical 발견사항

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| — | — | 해당 없음 | — | — |

---

## 경고 (WARNING)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | CONCURRENCY | `observeQueues`가 `async` 함수임에도 OTel `addCallback`에 반환 Promise가 전달되지 않아, gauge 수집 주기가 BullMQ `getJobCounts` 완료 이전에 마감될 수 있다. Prometheus에서 큐 깊이가 항상 0 또는 이전 주기 값으로 보이는 증상 발생 가능. | `business-metrics.service.ts` — `constructor` L74, `observeQueues` L121 | 별도 `setInterval`로 폴링 후 마지막 스냅샷을 캐싱하고 `addCallback`은 동기로 캐시를 읽는 패턴으로 전환. 또는 `@opentelemetry/api` 1.4+ `BatchObservableCallback` API 활용 가능 여부 확인. |
| 2 | CONCURRENCY | `queueProviders` 배열에 iteration 중 push 방어 없음. `for...of`가 스냅샷 이터레이터를 쓰지 않으므로 `await` 양보 시점에 새 provider가 push되면 같은 주기에 즉시 관측될 수 있음(일관성 미보장). | `business-metrics.service.ts` — `registerQueueDepthProvider` L116~118, `observeQueues` L121~137 | `const providers = [...this.queueProviders]`로 스냅샷 찍어 이터레이션. |
| 3 | TESTING | `execution-engine.service.spec.ts`에서 `BusinessMetricsService`가 실제 인스턴스로 주입되어, `emitTerminalExecutionMetrics` / `recordNodeLatencyMetrics` 호출 여부·조건부 skip·오류 swallow 동작을 직접 assertion하는 테스트가 없음. `persisted=false` 시 메트릭 미발생, non-terminal status skip, DB 실패 시 실행 경로 차단 안 됨 등 핵심 보장이 미검증 상태. | `execution-engine.service.spec.ts` — `emitTerminalExecutionMetrics`, `recordNodeLatencyMetrics` 신규 메서드 | `BusinessMetricsService`를 mock으로 제공하는 전용 describe 블록 추가. mock spy로 호출 여부·인자 검증. |
| 4 | TESTING | `continuation-dlq-monitor.service.spec.ts`에서 `registerQueueDepthProvider` mock이 노출되나 실제 호출 여부·`enabled=false` 시에도 등록되는 동작을 검증하는 케이스가 없음. | `continuation-dlq-monitor.service.spec.ts` — `lifecycle` describe 블록 | `onModuleInit` 호출 후 `registerQueueDepthProvider` 1회 호출 확인, `enabled=false` 시에도 호출 확인 케이스 추가. |
| 5 | TESTING | `recordNodeLatencyMetrics`의 `row.node === null` fallback, `durationMs == null` skip, DB `find` 실패 시 catch 동작이 직접 단위 테스트에서 검증되지 않음. | `execution-engine.service.ts` — `recordNodeLatencyMetrics` | mock inject 테스트에서 `nodeExecutionRepository.find` reject 시 예외 미전파 및 `recordNodeDuration` 미호출 확인. |
| 6 | SPEC-DRIFT | [SPEC-DRIFT] `spec/5-system/4-execution-engine.md` §9.3 본문 L1082에 "메트릭 SDK 대신 로그 기반"이라는 구식 설명이 잔류. 실제 구현은 `registerQueueDepthProvider`를 통해 `clemvion.queue.depth` ObservableGauge에 큐 깊이를 노출하고 있음. 코드가 옳고 spec 본문이 낡았음. | `spec/5-system/4-execution-engine.md` — §9.3 L1082 | 코드 유지 + spec §9.3 본문에 "임계 초과 알람은 log 기반, 큐 깊이(waiting/active/delayed/failed)는 `clemvion.queue.depth` ObservableGauge로 NF-OB-07에도 노출" 내용 추가. |
| 7 | CODE-QUALITY | `execution-engine.service.spec.ts` — `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 블록의 `module3` providers 배열에 `BusinessMetricsService`가 두 번 등록되어 있음(copy-paste 오류). NestJS는 마지막 것으로 덮어쓰므로 런타임 오류는 없으나 의도 모호. | `execution-engine.service.spec.ts` L15290~15294 | 중복 `BusinessMetricsService` 한 줄 제거. |
| 8 | MAINTAINABILITY | `continuation-dlq-monitor.service.spec.ts` — `makeService` 내 `{ registerQueueDepthProvider } as never` 타입 우회. 추후 `BusinessMetricsService` 인터페이스 변경 시 컴파일 오류가 잡히지 않아 묵시적 회귀 위험. | `continuation-dlq-monitor.service.spec.ts` — `makeService` 함수 | `as unknown as BusinessMetricsService`로 변경해 최소한 상위 타입 명시. |
| 9 | PERFORMANCE | `recordNodeLatencyMetrics` — 실행 terminal 전이마다 `nodeExecutionRepository.find({ relations: ['node'] })`로 전체 node_execution + node JOIN 전량 조회. 노드 수가 많은 실행이나 고빈도 환경에서 DB/메모리 부하 누적. | `execution-engine.service.ts` — `recordNodeLatencyMetrics` (L9296~) | `select: ['id', 'durationMs', 'status']` 명시 + QueryBuilder로 `node.type`만 projection. 또는 `node_execution`에 `nodeType` 비정규화 칼럼 추가 검토. |
| 10 | ARCHITECTURE | `registerQueueDepthProvider` push-등록 패턴이 암묵적 계약 생성. 새 큐 모듈 추가 시 `onModuleInit`에 등록 호출을 반드시 추가해야 한다는 계약이 문서화되지 않으면 누락되기 쉬움. | `business-metrics.service.ts` — `registerQueueDepthProvider`; `execution-engine.service.ts`, `continuation-dlq-monitor.service.ts` — `onModuleInit` | 중기 개선: `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰 패턴으로 전환하여 등록 로직을 DI 계층으로 이동. 단기는 등록 규약을 주석/문서에 명시. |
| 11 | SIDE-EFFECT | `LlmUsageLogService.record` — `businessMetrics.recordLlmTokens` 호출이 `try` 블록 외부에 위치. OTel 구현 오류 시 예외가 `record` 전체를 throw하여 DB insert도 누락될 수 있음. | `llm-usage-log.service.ts` — `record()` 메서드 L515~518 | `recordLlmTokens` 호출을 `try` 블록 안으로 이동하거나 별도 try/catch로 보호. |
| 12 | ARCHITECTURE | `ExecutionEngineService`에 `emitTerminalExecutionMetrics` / `recordNodeLatencyMetrics` 관측성 코드가 혼합되어 SRP 경계 희석. `recordNodeLatencyMetrics`가 직접 DB 읽기를 담당해 실행 엔진 서비스가 관측성 집계까지 겸함. | `execution-engine.service.ts` — `emitTerminalExecutionMetrics`, `recordNodeLatencyMetrics` | 중기: `ExecutionMetricsCollector` 별도 서비스로 분리 + `ExecutionEventEmitter` 옵저버 패턴 연동 고려. |

---

## 참고 (INFO)

| # | 카테고리 | 발견사항 | 위치 | 제안 |
|---|----------|----------|------|------|
| 1 | SECURITY | 메트릭 라벨(`error_code`, `model`, `node_type`)에 길이/cardinality 제한 없음. 외부 유래 문자열이 OTel 속성에 직접 주입되어 Prometheus 라벨 cardinality 폭발 가능성 미약하게 존재. | `business-metrics.service.ts` — `recordExecutionError`, `recordNodeDuration`, `recordLlmTokens` | allowlist 또는 문자열 최대 길이 클램핑 추가(예: `code.substring(0, 64)`). |
| 2 | SECURITY | `observeQueues` catch 블록이 Redis 연결 실패를 완전히 무시. Redis 장애 시 큐 깊이 메트릭 블라인드 상황을 인지할 수 없음. | `business-metrics.service.ts` L106~109 | `Logger.warn` 최소 로깅 추가. |
| 3 | SECURITY | `registerQueueDepthProvider`에 provider 실행 타임아웃 없음. 느린 provider가 OTel 수집 주기 전체를 블로킹할 수 있음. | `business-metrics.service.ts` — `registerQueueDepthProvider` | `Promise.race([provider(), timeout(5000)])` 패턴으로 타임아웃 추가. |
| 4 | PERFORMANCE | `observeQueues` — provider를 순차 직렬 폴링(`for...of await`). Redis I/O가 느릴 경우 전체 gauge 수집이 provider 수 × 레이턴시만큼 지연. | `business-metrics.service.ts` — `observeQueues` | `Promise.allSettled`로 병렬 호출. |
| 5 | PERFORMANCE | `emitTerminalExecutionMetrics` — `const terminal: ExecutionStatus[] = [...]` 배열이 매 호출마다 재생성. 실행 종료 이벤트 고빈도 시 불필요한 객체 생성 반복. | `execution-engine.service.ts` — `emitTerminalExecutionMetrics` | `private static readonly TERMINAL_STATUSES = new Set([...])` 클래스 상수로 추출. |
| 6 | TESTING | `BusinessMetricsService.spec.ts` — 음수 토큰 입력 시 Counter에 음수 add 여부 미검증. `if (usage.inputTokens)` falsy 체크가 음수를 통과시킴. | `business-metrics.service.spec.ts` — `recordLlmTokens` | 음수 허용/차단 정책 결정 후 명시적 테스트 케이스 추가. |
| 7 | TESTING | 복수 gauge provider 모두 성공 시 합산 관측 케이스 미검증. | `business-metrics.service.spec.ts` | 2개 provider 모두 성공하는 케이스 추가. |
| 8 | TESTING | `MetricsModule` 자체 통합 테스트 없음. `@Global` 설정 오류를 조기에 잡는 smoke test 부재. | `metrics.module.ts` | `metrics.module.spec.ts` 추가: `Test.createTestingModule({ imports: [MetricsModule] })`로 `BusinessMetricsService` inject 가능 확인. |
| 9 | DOCUMENTATION | `recordLlmTokens` 공개 메서드의 `LlmTokenUsage` 파라미터 타입이 export되지 않아 호출부 작성자가 수용 가능한 shape를 모름. | `business-metrics.service.ts` — `LlmTokenUsage` 인터페이스 | export하거나 JSDoc에 `@param usage` 수용 가능한 필드 명시. |
| 10 | DOCUMENTATION | `recordNodeLatencyMetrics` JSDoc에 `durationMs == null` 방어의 전제 조건(미완료·레거시 row) 설명 없어 유지보수자가 방어 코드를 제거하는 실수 가능. | `execution-engine.service.ts` — `recordNodeLatencyMetrics` | `durationMs == null` 체크 옆에 인라인 주석 추가. |
| 11 | DOCUMENTATION | `OTEL_PROMETHEUS_HOST` 환경변수가 spec에 추가되었으나 `.env.example` 또는 운영 가이드 반영 여부 불명확. | `spec/5-system/_product-overview.md` — NF-OB-02 행 | `.env.example`에 `OTEL_PROMETHEUS_HOST=127.0.0.1` 항목 추가 여부 확인 및 필요 시 후속 작업 등록. |
| 12 | CONCURRENCY | `ContinuationDlqMonitorService.checking` 플래그가 단일 프로세스에서는 올바르나, 다중 Pod 배포 시 각 Pod가 독립 cooldown을 가져 알람 중복 발생 가능. | `continuation-dlq-monitor.service.ts` — `private checking`, `checkOnce` | 분산 배포 대응 필요 시 `ContinuationBusService.acquireLock` 패턴을 `lastAlarmAt` 관리에 적용. |
| 13 | DATABASE | `node_executions` 테이블에 `(execution_id, status)` 복합 인덱스 유무 미확인. 고빈도 실행 환경에서 `recordNodeLatencyMetrics` 쿼리의 비중이 증가할 경우 인덱스 부재 시 부하. | 마이그레이션 파일 — `node_executions` 인덱스 정의 | 마이그레이션 파일에서 `(execution_id)` 또는 `(execution_id, status)` 인덱스 존재 확인. |
| 14 | ARCHITECTURE | `LlmTokenUsage` 인터페이스가 `TokenUsage`(llm 모듈)와 구조적으로 동일하나 별도 정의(의도적 격리). 향후 diverge 위험 있음. | `business-metrics.service.ts` — `LlmTokenUsage` | 공통 `packages/`에 공유 타입 배치 또는 `Pick<TokenUsage, ...>`로 정의 검토. |
| 15 | MAINTAINABILITY | `recordLlmTokens`의 `if (usage.inputTokens)` falsy 체크가 `0`과 `undefined`를 구분하지 않아 의미 불명확. | `business-metrics.service.ts` — `recordLlmTokens` | `if (usage.inputTokens != null && usage.inputTokens > 0)` 명시적 표현 또는 JSDoc에 "값이 0이면 계측하지 않는다" 명기. |
| 16 | SCOPE | `spec/5-system/_product-overview.md` NF-OB-02 행의 `OTEL_PROMETHEUS_HOST` 환경변수 추가 및 기본값 수정이 NF-OB-07 PR 범위와 병행 포함. 내용은 이미 구현된 사실의 문서 정정이므로 실질 위험 없음. | `spec/5-system/_product-overview.md` — NF-OB-02 행 | 현행 수용. |

---

## 에이전트별 위험도 요약

| 에이전트 | 위험도 | 핵심 발견 |
|----------|--------|-----------|
| concurrency | MEDIUM | OTel async gauge 콜백 계약 위반으로 큐 깊이 메트릭 실제 공백 가능; queueProviders 배열 iteration 중 방어 부재 |
| testing | MEDIUM | emitTerminalExecutionMetrics / recordNodeLatencyMetrics 직접 단위 테스트 부재; registerQueueDepthProvider 콜백 미검증 |
| performance | LOW | recordNodeLatencyMetrics의 node_execution 전량 JOIN 조회; observeQueues 직렬 폴링 |
| architecture | LOW | push-등록 패턴 암묵적 계약; ExecutionEngineService SRP 희석 |
| security | LOW | 메트릭 라벨 cardinality 제한 없음; provider 타임아웃 부재 |
| requirement | LOW | SPEC-DRIFT: spec §9.3 본문 구식 설명 잔류; 테스트 중복 provider 등록 |
| maintainability | LOW | as never 타입 우회; BusinessMetricsService 중복 등록 |
| side_effect | LOW | LlmUsageLogService.record의 메트릭 호출 try 블록 외부 위치 |
| database | LOW | recordNodeLatencyMetrics 전량 조회; 인덱스 미확인 |
| scope | LOW | NF-OB-07 단일 목적 집중; NF-OB-02 문서 정정 경미 병행 |
| documentation | LOW | LlmTokenUsage 타입 JSDoc 부재; durationMs null 조건 설명 누락 |
| dependency | LOW | 신규 외부 패키지 없음; BusinessMetricsService 중복 등록 복붙 오류 |
| api_contract | NONE | 신규 HTTP 엔드포인트 없음; 기존 API 계약 영향 없음 |
| user_guide_sync | NONE | doc-sync-matrix 19개 trigger 전체 미매칭; 유저 가이드 동반 갱신 의무 없음 |

---

## 발견 없는 에이전트

**api_contract**, **user_guide_sync** — 실질 발견사항 없음. API 계약 변경 없음, 유저 가이드 동반 갱신 대상 없음.

---

## 권장 조치사항

1. **[즉시 — MEDIUM]** `observeQueues`를 OTel async 콜백 계약에 맞게 수정. 별도 `setInterval` 폴링 + 캐시 스냅샷 패턴으로 전환하거나 `BatchObservableCallback` API 사용 여부 확인. (WARNING #1)
2. **[즉시 — CODE-QUALITY]** `execution-engine.service.spec.ts` `BusinessMetricsService` 중복 등록 한 줄 제거. (WARNING #7)
3. **[즉시 — MAINTAINABILITY]** `continuation-dlq-monitor.service.spec.ts` — `as never` → `as unknown as BusinessMetricsService` 수정. (WARNING #8)
4. **[단기 — TESTING]** `execution-engine.service.spec.ts`에 `BusinessMetricsService` mock 사용 describe 블록 추가 — `emitTerminalExecutionMetrics` / `recordNodeLatencyMetrics` 조건부 동작 assertion. (WARNING #3, #5)
5. **[단기 — TESTING]** `continuation-dlq-monitor.service.spec.ts` `lifecycle` describe에 `registerQueueDepthProvider` 호출 검증 + `enabled=false` 시에도 호출되는 케이스 추가. (WARNING #4)
6. **[단기 — SPEC-DRIFT]** `spec/5-system/4-execution-engine.md` §9.3 L1082 본문 갱신: "임계 초과 알람은 log 기반, 큐 깊이는 `clemvion.queue.depth` ObservableGauge로 NF-OB-07에도 노출" 명시. (WARNING #6)
7. **[단기 — SIDE-EFFECT]** `LlmUsageLogService.record` — `recordLlmTokens` 호출을 `try` 블록 안으로 이동 또는 별도 try/catch 보호. (WARNING #11)
8. **[단기 — CONCURRENCY]** `observeQueues`의 `for...of` 이터레이션을 `const providers = [...this.queueProviders]` 스냅샷으로 변경. (WARNING #2)
9. **[중기 — PERFORMANCE]** `recordNodeLatencyMetrics` — `select` 옵션으로 필요 컬럼만 조회, 또는 `node_type` 비정규화 칼럼 추가로 JOIN 제거. (WARNING #9)
10. **[중기 — ARCHITECTURE]** `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰 패턴 도입으로 push-등록 암묵적 계약 해소. (WARNING #10)

---

## 라우터 결정

`routing_status=done` (라우터가 선별):

- **실행**: `performance`, `architecture`, `database`, `concurrency`, `api_contract`, `user_guide_sync`, `dependency` (7명, 라우터 선별) + 강제 포함 7명 = 총 14명
- **강제 포함(router_safety)**: `documentation`, `maintainability`, `requirement`, `scope`, `security`, `side_effect`, `testing` (7명)
- **제외**: 없음 (skipped: none)