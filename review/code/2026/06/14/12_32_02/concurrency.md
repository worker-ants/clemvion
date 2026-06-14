# 동시성(Concurrency) 리뷰 결과

## 발견사항

### [WARNING] queueProviders 배열에 동시성 보호 없음

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `registerQueueDepthProvider` (line 116~118) 및 `observeQueues` (line 121~137)
- **상세**: `queueProviders: QueueDepthProvider[] = []` 배열에 대해 쓰기(`push`)와 읽기(iteration in `observeQueues`) 가 상호 배제 없이 병행 가능하다. Node.js 의 단일 이벤트 루프 특성상 순수 JS 코드에서는 실제 동시 메모리 접근 경쟁은 발생하지 않으나, `observeQueues` 는 `async` 함수이며 `await provider()` 마다 이벤트 루프를 양보한다. OTel 수집 콜백(gauge)이 `await` 포인트 사이에 호출되는 도중 추가 `registerQueueDepthProvider` 가 들어오면 iteration 중 배열 크기가 변한다. `for...of` 는 배열 스냅샷 이터레이터를 쓰지 않으므로 새로 push된 provider 가 같은 수집 주기에 즉시 관측될 수도 있다(일관성 미보장, 실무 위험도는 낮음). 더 중요한 점은, OTel Observable 콜백 계약상 `addCallback` 에 넘기는 콜백은 동기여야 하는데 여기서 `async` 함수를 전달해 반환 `Promise` 가 무시된다(아래 별도 항목).
- **제안**: 수집 주기 동안 배열 스냅샷을 찍어 이터레이션한다: `const providers = [...this.queueProviders]`. 이를 통해 iteration 도중 push의 영향을 격리한다.

---

### [WARNING] async observeQueues 반환 Promise 가 OTel 에 의해 무시됨 (fire-and-forget gauge 콜백)

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `constructor` line 74, `observeQueues` line 121
- **상세**: `this.queueDepth.addCallback((result) => this.observeQueues(result))` — `addCallback` 에 전달되는 콜백이 `async` 함수(`observeQueues`)를 호출하고 반환 Promise를 반환하지 않는다(람다가 `void` 반환). OTel API 의 Observable 콜백 규약은 동기 완료를 전제하며, `Promise`를 인식하지 않는다. 그 결과 수집 주기가 trigger 될 때 BullMQ `getJobCounts` 호출이 완료되기 전에 OTel이 `result.observe` 값 수집을 마감할 수 있다 — 실제로는 각 수집 주기에 빈 관측이 전달될 가능성이 있다. 이는 gauge 메트릭이 Prometheus 에서 항상 0 또는 전 주기 값으로 보이는 증상으로 나타날 수 있다.
- **제안**: OTel SDK 버전이 async 콜백을 지원하는지 확인한다(`@opentelemetry/api` 1.4+ 는 `BatchObservableCallback`을 별도 API로 제공). 지원하지 않으면 gauge 콜백 내에서 async 폴링을 수행하는 대신, 별도 interval에서 폴링하고 마지막 스냅샷을 캐싱해 동기 콜백이 해당 캐시를 읽는 패턴으로 전환한다:

  ```ts
  private lastSnapshots: QueueDepthSnapshot[] = [];

  // onModuleInit 에 setInterval 로 주기적 폴링:
  setInterval(() => void this.refreshSnapshots(), this.pollIntervalMs);

  private async refreshSnapshots(): Promise<void> { ... }

  // addCallback 은 동기로:
  this.queueDepth.addCallback((result) => {
    for (const s of this.lastSnapshots) { ... }
  });
  ```

---

### [WARNING] in-flight 가드(`checking` 플래그)가 단일 인스턴스 가정에 의존

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `private checking = false` (line 616), `checkOnce` (line 677~723)
- **상세**: `this.checking` 은 인스턴스 필드로 단일 Node.js 프로세스 내에서는 효과적인 in-flight 가드다. 다만 `if (this.checking) { return ... }` 이후 `this.checking = true` 사이에 논리적 비원자성이 존재한다. Node.js 단일 스레드에서는 `await` 없이 두 라인이 연속 실행되므로 실질적 경쟁은 없다. 현 코드는 올바르다. 단, 분산 배포(다수 프로세스/Pod)에서는 프로세스 간 가드가 없으며, 큐 depth 관측 자체는 멱등이므로 중복 관측은 해롭지 않다. 알람 cooldown(`lastAlarmAt`)도 인스턴스 필드이므로 다중 Pod 시 각 Pod가 독립적으로 cooldown을 가진다. 현재 명세에서 단일 인스턴스 운영을 가정한다면 허용 범위이나, 스케일아웃 시 주의가 필요하다.
- **제안**: 분산 배포 대응이 필요할 경우 Redis 기반 분산 lock(이미 `ContinuationBusService.acquireLock` 패턴이 있음)을 `lastAlarmAt` 관리에 적용하는 것을 검토한다.

---

### [INFO] `void this.recordNodeLatencyMetrics(execution.id)` fire-and-forget — 오류 swallow 확인

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `emitTerminalExecutionMetrics` (line 9232)
- **상세**: `void this.recordNodeLatencyMetrics(...)` 호출이 반환된 Promise를 의도적으로 무시한다. `recordNodeLatencyMetrics` 내부는 try/catch로 모든 예외를 삼키므로 미처리 rejection은 없다. 이벤트 루프를 블로킹하지 않고 실행 마감 경로에 영향을 주지 않는 올바른 패턴이다. 다만 DB 쿼리 실패 시 계측이 조용히 누락된다는 점을 인지해야 한다 (현재 warn 로그도 없음).
- **제안**: 필수 사항은 아니나 메트릭 수집 실패 시 `this.logger.debug(...)` 정도를 추가해 관측 공백을 인지할 수 있게 하는 것을 고려할 수 있다.

---

### [INFO] `execution-engine.service.spec.ts` — `BusinessMetricsService` 이중 등록

- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` providers (line 15290~15291, diff)
- **상세**: `BusinessMetricsService` 가 `providers` 배열에 두 번 등록되어 있다(`BusinessMetricsService, BusinessMetricsService`). NestJS TestingModule은 동일 클래스가 두 번 등록될 때 마지막 등록을 우선하거나 경고 없이 중복 인스턴스를 생성할 수 있다. 현재는 기능상 무해하지만 의도치 않은 중복이다.
- **제안**: 중복 `BusinessMetricsService` 항목 한 개를 제거한다.

---

## 요약

이번 변경의 핵심은 `BusinessMetricsService`를 신규 `@Global` 모듈로 도입하고, `ExecutionEngineService`, `ContinuationDlqMonitorService`, `LlmUsageLogService`에서 OTel 계측 지점을 연결한 것이다. 동시성 관점에서 가장 주목할 이슈는 `observeQueues` 콜백이 `async` 함수임에도 OTel `addCallback` 에 반환 Promise가 전달되지 않아 gauge 수집이 비동기 완료 이전에 마감될 수 있다는 점(WARNING)과, `queueProviders` 배열을 iteration 도중 수정 가능성에 대한 방어 부재(WARNING)다. `ContinuationDlqMonitorService`의 `checking` 플래그 기반 in-flight 가드는 Node.js 단일 스레드 모델에서 올바르게 동작하며, `emitTerminalExecutionMetrics`의 fire-and-forget 패턴은 의도적이고 오류 격리도 적절하다. 테스트 파일의 중복 provider 등록은 기능 무해하나 정리가 필요하다. 전체적으로 OTel async 콜백 계약 미스매치가 메트릭 데이터 공백으로 나타날 수 있어 운영 전 확인이 권장된다.

## 위험도

MEDIUM
