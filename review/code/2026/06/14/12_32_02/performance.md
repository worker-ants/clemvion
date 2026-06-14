# 성능(Performance) 코드 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `recordNodeLatencyMetrics` — 실행 종료마다 전체 `node_execution` 행을 relations 포함 full-load
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recordNodeLatencyMetrics` 메서드 (diff 추가 라인 `+2239~+2263`)
  - 상세: 실행이 terminal 상태로 전이할 때마다 해당 실행의 완료된 `node_execution` 전체를 `find({ relations: ['node'] })`로 조회한다. N개의 노드가 있으면 TypeORM은 `node_execution` JOIN `node` 쿼리를 발행하고 모든 행을 메모리에 적재한다. 실행당 노드 수가 많아지면(복잡한 워크플로) 불필요한 데이터 전송이 누적된다. 더불어 `node.type`만 필요한데 `node` 전체 관계를 로드한다(`select` 절 미지정). 이 호출은 fire-and-forget(`void`)으로 실행 경로를 막지는 않지만, 고빈도 실행 환경에서 DB 쿼리 수와 메모리 부하를 증가시킨다.
  - 제안:
    1. `select`를 명시해 필요한 컬럼만 가져오거나, `queryBuilder`로 `node_type`·`duration_ms`·`status`만 SELECT한다.
    2. `relations: ['node']` 대신 서브쿼리나 JOIN으로 `node.type`만 projection한다.
    3. 실행 도중 각 노드가 완료될 때 인라인으로 `recordNodeDuration`을 호출하는 방식으로 설계 변경 시 이 추가 쿼리 자체를 제거할 수 있다(단, 이 경우 "terminal 전이 시 1회" 단일 지점 보장이 깨짐).

---

### 발견사항 2
- **[WARNING]** `observeQueues` — 큐 provider를 순차 직렬 폴링 (Promise.all 미사용)
  - 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` — `observeQueues` 메서드 (라인 3101~3116)
  - 상세: `for...of` 루프 안에서 각 `provider()`를 `await`하므로 provider 들이 직렬로 실행된다. 현재 3개의 큐(execution-run, background, continuation)가 등록될 수 있으며, 각 `provider`는 BullMQ `getJobCounts` — 즉 Redis I/O를 수행한다. OTel gauge 콜백은 수집 주기(보통 수 초~수십 초)마다 호출되므로 직접적 처리량 병목은 아니지만, Redis 응답이 느릴 경우 전체 gauge 수집이 provider 수 × 레이턴시만큼 직렬 지연된다.
  - 제안: `Promise.allSettled`로 모든 provider를 병렬 호출하고 rejected 항목만 건너뛰도록 변경한다. 현재의 `try/catch + continue` 로직은 `allSettled`의 `status === 'rejected'` 체크로 동일하게 구현 가능하다.

---

### 발견사항 3
- **[WARNING]** `emitTerminalExecutionMetrics` — `terminal` 배열을 매 호출 시 재생성
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `emitTerminalExecutionMetrics` 메서드 (diff 추가 라인 `+9316~+9232`)
  - 상세: `const terminal: ExecutionStatus[] = [...]`이 메서드 호출마다 새 배열 인스턴스를 생성하고 `terminal.includes(newStatus)`로 선형 탐색한다. 배열 크기는 3이라 실질 비용은 미미하지만, 실행 종료 이벤트는 고빈도로 발생할 수 있으므로 불필요한 객체 생성이 반복된다.
  - 제안: `terminal` 배열을 `Set` + 클래스 상수(static readonly)로 추출해 `O(1)` 탐색 + 단일 인스턴스로 변경한다. 예: `private static readonly TERMINAL_STATUSES = new Set([ExecutionStatus.COMPLETED, ExecutionStatus.FAILED, ExecutionStatus.CANCELLED])`.

---

### 발견사항 4
- **[INFO]** `continuation-dlq-monitor.service.ts` — `onModuleInit`에서 gauge provider 등록과 알람 인터벌이 같은 메서드 내에 혼재, `enabled=false`여도 Redis I/O provider가 등록됨
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `onModuleInit` (diff 추가 라인 `+537~+555`)
  - 상세: 코드 주석에 "알람이 비활성이어도 깊이 관측은 유효하므로 enabled 체크 이전에 등록"이라고 명시되어 있어 의도적 설계다. 그러나 `enabled=false` 환경에서도 OTel gauge 수집 주기마다 `queue.getJobCounts('waiting','active','delayed','failed')` Redis 쿼리가 발행된다. 알람 억제와 메트릭 수집을 같은 플래그로 제어할 의도라면 아니므로 큰 문제는 아니나, 의도를 명시적 설정(`OTEL_ENABLED` 등)으로 분리할 여지가 있다. 현재 구조에서 Redis가 완전히 비가용한 환경이면 gauge 콜백 오류가 `continue`(오류 무시)로 처리되므로 실질 부작용은 없다.
  - 제안: 현재 설계를 수용 가능. 단, 장기적으로 gauge provider 등록을 `OTEL_ENABLED` 플래그로도 게이팅하는 옵션을 고려할 수 있다.

---

### 발견사항 5
- **[INFO]** `execution-engine.service.spec.ts` — `BusinessMetricsService` 중복 등록
  - 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — diff 라인 `+15290~+15292` 영역
  - 상세: `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 의 `Test.createTestingModule` providers 배열에 `BusinessMetricsService`가 두 번 등록되어 있다(`+BusinessMetricsService`, `+BusinessMetricsService`). NestJS 테스트 컨텍스트는 중복 provider를 덮어쓰기로 처리하므로 런타임 오류는 발생하지 않지만, 불필요한 서비스 인스턴스화가 1회 더 발생한다.
  - 제안: 중복 항목을 제거한다.

---

### 발견사항 6
- **[INFO]** `ContinuationDlqMonitorService` — `checkOnce`와 `registerQueueDepthProvider` 콜백이 별도 `getJobCounts` 호출을 중복 발행할 수 있음
  - 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts`
  - 상세: `checkOnce`는 `getJobCounts('failed', 'delayed')`를 호출하고, `registerQueueDepthProvider` 콜백은 `getJobCounts('waiting','active','delayed','failed')`를 호출한다. 두 호출은 독립 주기(알람 인터벌 vs OTel 수집 주기)로 실행되므로 중복 Redis 쿼리가 발생한다. 단, 두 목적(알람 vs 게이지 관측)이 명확히 다른 주기로 실행되고 Redis `getJobCounts`는 경량 O(1)이므로 현 규모에서 실질 부하는 낮다.
  - 제안: 현 상태 수용 가능. 최적화 필요 시 공유 캐시(짧은 TTL, 수백ms)로 두 호출을 통합할 수 있으나, 복잡도 대비 이득이 크지 않다.

---

## 요약

이 변경의 핵심은 `BusinessMetricsService`(@Global)를 신설해 OTel MeterProvider 위에 5개의 도메인 메트릭을 계측하는 것이다. 전반적으로 카운터/히스토그램은 동기 no-op에 가까워 성능 부담이 없고, 큐 깊이 관측은 OTel의 pull 모델(observable gauge)을 올바르게 활용해 수집 주기 동안만 Redis를 조회한다. 주요 성능 우려는 `recordNodeLatencyMetrics`가 실행 종료마다 발행하는 `node_execution JOIN node` full-load 쿼리이며, 실행당 노드 수가 많거나 실행 빈도가 높을 때 불필요한 DB/메모리 부하를 유발한다. `observeQueues`의 직렬 provider 폴링과 `emitTerminalExecutionMetrics`의 매 호출 배열 생성은 부차적 개선 여지다.

## 위험도

**LOW**

> 핵심 실행 경로의 메트릭 계측은 모두 동기·무거운 연산 없이 설계되어 있으며, 가장 무거운 `recordNodeLatencyMetrics`도 `void` fire-and-forget으로 실행 결과에 영향을 주지 않는다. 단, 고부하 환경(다수의 복잡한 동시 실행)에서 해당 쿼리 패턴이 DB 연결 풀을 지속적으로 소모할 가능성이 있어 LOW로 평가한다.
