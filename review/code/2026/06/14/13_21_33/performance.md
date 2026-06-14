# 성능(Performance) 리뷰

## 발견사항

### [WARNING] recordNodeLatencyMetrics — 실행 종료마다 N개 node_execution + JOIN 전체 로드
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recordNodeLatencyMetrics()` (line 9387~9414)
- **상세**: 실행이 terminal 상태로 전이할 때마다 `nodeExecutionRepository.createQueryBuilder` 로 해당 실행의 **모든 종료된 node_execution 행**을 SELECT 한다. QueryBuilder 로 4컬럼 projection 은 이전 `find({relations:['node']})` 전체 로드 대비 개선됐으나, `leftJoin('ne.node', 'n')` 은 여전히 JOIN 을 포함하며 실행 종료마다 이 쿼리가 무조건 실행된다. 복잡한 워크플로(node 수십~수백 개)의 빈번한 실행 환경에서는 이 SELECT 부하가 누적된다. 또한 fire-and-forget(`void`) 처리라 호출 횟수 제한이 없다.
- **제안**:
  1. `node_executions` 테이블에 `node_type` 칼럼을 비정규화해 저장하면 JOIN 자체를 제거할 수 있다 (근본 해결책).
  2. 단기 대안: 이미 QueryBuilder 로 전환됐으므로 `(execution_id, status)` 복합 인덱스 존재를 마이그레이션 파일에서 확인한다. `execution_id` 단독 인덱스만 있으면 status 조건은 후처리이므로 대규모 실행에서 스캔 범위가 불필요하게 넓어진다.
  3. 장기 대안: 노드 완료 시점에 `recordNodeDuration` 을 개별 호출하면 terminal 시 집계 쿼리 자체가 불필요해진다 (단, `ExecutionEngineService` 의 SRP 부담이 증가하므로 `ExecutionMetricsCollector` 분리와 함께 검토).

### [WARNING] observeQueues — gauge 수집 주기마다 각 큐에 Redis I/O 3회 발생
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` `observeQueues()` (line 133~153), `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `onModuleInit` provider (line 900~922), `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` provider (line 211~227)
- **상세**: 현재 3개의 큐(`execution-run`, `background-execution`, `continuation-execution`)가 각각 별도 provider 로 등록된다. gauge 수집 주기(OTel 기본 60초)마다 `Promise.allSettled` 로 3개 provider 를 병렬 호출하고 각 provider 는 `queue.getJobCounts(...)` 로 Redis I/O 를 수행한다. `execution-engine` provider 내부에서는 2개 큐를 `Promise.all` 로 추가 병렬 호출하므로 수집 주기당 총 Redis 왕복은 3회다. 병렬화가 이미 적용된 점은 양호하지만, 큐가 추가될수록 선형으로 증가한다.
- **제안**: 현재 구조(병렬 `Promise.allSettled` + 개별 provider 내 `Promise.all`)는 적절하다. 추가 최적화가 필요하다면 I-3(타임아웃 Promise.race 패턴)을 적용해 느린 Redis 응답이 수집 주기를 블록하지 않도록 한다. 큐 수가 늘어나면 단일 Redis 파이프라인(`pipeline()`) 으로 묶는 것도 고려한다.

### [INFO] observeQueues provider 타임아웃 부재 — 느린 Redis 가 수집 주기 전체를 지연
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` `observeQueues()` (line 133~153)
- **상세**: `Promise.allSettled` 로 병렬 폴링하지만 각 provider 호출에 타임아웃이 없다. Redis 일시 장애 시 OTel SDK 의 수집 주기가 provider 완료를 기다리다 지연될 수 있다. 이는 plan 후속 항목(I-3)으로 이미 기록된 사항이다.
- **제안**: `Promise.race([provider(), timeout(5000)])` 패턴을 도입한다. plan 에 기록된 대로 후속 PR 범위로 처리해도 무방하다.

### [INFO] recordLlmTokens — 음수·NaN 입력 시 counter 에 잘못된 값 누적 가능
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` `recordLlmTokens()` (line 96~106)
- **상세**: `if (usage.inputTokens)` 는 0 과 undefined 를 건너뛰나, 음수(-1)나 NaN 은 통과해 OTel Counter 에 전달된다. OTel Counter 의 명세상 음수 누적은 undefined behavior(SDK 구현에 따라 경고 또는 무시)이며 Prometheus 게이지가 아닌 단조 증가 Counter 에 음수를 기록하면 스크레이프 오류 또는 순간 감소 이상치가 발생할 수 있다. 현재 호출부(`LlmUsageLogService.record`)는 외부 LLM 응답 파싱값을 전달하므로 예외적 음수 값이 들어올 가능성이 낮지 않다.
- **제안**: `if (usage.inputTokens > 0)` 로 변경해 0 이하 값을 명시적으로 차단한다. `maintainability.md` 발견사항 4와 일치하는 방향이다.

### [INFO] emitTerminalExecutionMetrics 내 TERMINAL_STATUSES Set 조회는 O(1) — 현행 유지
- **위치**: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` line 701, 9365
- **상세**: `private static readonly TERMINAL_STATUSES = new Set<ExecutionStatus>([...])` 로 이미 클래스 정적 상수로 추출되어 매 호출마다 재생성되지 않는다(I-5 조치 완료). `Set.has()` 는 O(1)이므로 문제 없다.
- **제안**: 현행 유지. 추가 조치 불필요.

### [INFO] recordLlmTokens — 토큰 type별 최대 3회 Counter.add 호출 (구조적 상한)
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` `recordLlmTokens()` (line 96~106)
- **상세**: input/output/thinking 3개 분기가 각각 독립 `if` 로 처리된다. 호출당 최대 3회 `counter.add` 가 발생하며, OTel Counter.add 는 in-memory 누적이므로 성능 영향은 무시할 수준이다. LLM 호출이 매우 빈번한 환경에서도 이 경로가 병목이 될 가능성은 없다.
- **제안**: 현행 유지.

### [INFO] BusinessMetricsService 생성자 — 서비스 시작 시 5개 instrument 즉시 생성
- **위치**: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` constructor (line 54~79)
- **상세**: 서비스 인스턴스화 시 `metrics.getMeter()`를 1회 호출하고 counter 2개·histogram 1개·gauge 1개를 즉시 생성한다. `OTEL_ENABLED=false`(no-op meter) 환경에서도 동일한 생성자 경로를 거치나 no-op meter 의 instrument 생성 비용은 무시할 수준이다. 애플리케이션 기동 시 1회 실행이므로 핫 경로 성능 문제가 아니다.
- **제안**: 현행 유지. 지연 초기화 필요 없음.

## 요약

이번 변경(NF-OB-07 도메인 메트릭 파이프라인)의 성능 관점 핵심 위험은 `recordNodeLatencyMetrics` 의 실행 종료마다 발생하는 DB SELECT 쿼리다. QueryBuilder 로 필요한 4컬럼만 projection 하는 W-9 조치로 전체 엔티티 로드 대비 개선됐으나, leftJoin 과 실행 종료마다 무조건 실행되는 구조는 빈번한 실행 환경에서 누적 부하 요인이다. 나머지 경로(LLM 토큰 Counter, terminal 카운터, gauge 콜백)는 모두 in-memory 누적 또는 병렬 비동기 I/O 로 처리되며 실행 경로를 블록하지 않는다. `observeQueues` 는 이미 `Promise.allSettled` 병렬 폴링을 적용해 Redis I/O 직렬 지연을 회피하고 있다. 전반적으로 단기 차단 수준의 성능 위험은 없으며, `recordNodeLatencyMetrics` 의 노드 타입 비정규화 또는 개별 계측 전환이 중기 개선 과제다.

## 위험도

LOW

STATUS: SUCCESS
