# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] `BusinessMetricsService.queueProviders` — 가변 공유 상태에 외부 push 가능
- 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L52, L124-126
- 상세: `queueProviders: QueueDepthProvider[]` 는 `private readonly` 이지만 배열 참조 자체만 불변이고 내용은 가변이다. `registerQueueDepthProvider` 를 통해 어느 서비스든 `onModuleInit` 시점 이후에도 provider 를 추가할 수 있으므로, gauge 콜백 `observeQueues` 가 호출될 때 어떤 provider 가 등록돼 있는지는 런타임 등록 순서에 달린다. 현재는 `observeQueues` 가 스냅샷(`const providers = [...this.queueProviders]`) 으로 이터레이션해 동시 push 로 인한 iteration 오염은 방지했지만, 배열 자체는 `readonly` 가 아니어서 이론상 외부에서 `.splice` 등을 통해 요소를 제거하는 것도 컴파일 타임에는 차단되지 않는다(`private` 이 실질적 방어이나 reflection/any 우회 가능).
- 제안: 현재 `private readonly` + 스냅샷 이터레이션 조합으로 실용적 안전성은 확보됐다. 추가 보강이 필요하면 `ReadonlyArray` 외부 노출을 피하고 등록 후 제거 불가 설계를 JSDoc 에 명시한다.

### [INFO] `ContinuationDlqMonitorService` 시그니처 변경 — 생성자에 `BusinessMetricsService` 추가
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L55
- 상세: 생성자 파라미터가 2개에서 3개로 늘었다. NestJS DI 환경에서는 `@Global MetricsModule` 이 등록돼 있어 자동 주입이 성공하지만, 단위 테스트에서 `new ContinuationDlqMonitorService(queue, config)` 형태로 직접 인스턴스화하던 코드는 모두 컴파일 오류가 된다. 테스트 파일(`continuation-dlq-monitor.service.spec.ts`)은 이미 3번째 인자 mock 을 반영했으나, 외부 기여자가 동일 패턴으로 직접 생성하는 다른 곳이 있다면 영향을 받는다.
- 제안: 이미 테스트 업데이트가 완료됐으므로 추가 조치 불필요. 다만 향후 생성자 주입 변경 시 PR 체크리스트에 "직접 인스턴스화 코드 탐색" 을 포함할 것을 권고한다.

### [INFO] `LlmUsageLogService` 시그니처 변경 — 생성자에 `BusinessMetricsService` 추가
- 위치: `/codebase/backend/src/modules/llm/llm-usage-log.service.ts` L27
- 상세: 위와 동일한 패턴. `LlmUsageLogService` 생성자가 `Repository<LlmUsageLog>` 단독에서 `BusinessMetricsService` 추가 2인자로 변경됐다. 테스트에서 `Test.createTestingModule` 을 사용해 DI 로 해결하므로 기존 테스트에는 영향 없다. 직접 `new` 로 인스턴스화하는 코드가 없음을 확인했다.
- 제안: 조치 불필요.

### [INFO] `ExecutionEngineService.onModuleInit` 에 새 공유 상태 등록 부작용 추가
- 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L896-928
- 상세: `onModuleInit` 에서 `registerQueueDepthProvider` 를 호출해 `BusinessMetricsService.queueProviders` 배열을 변경(push) 한다. 이는 `BusinessMetricsService` 의 전역 공유 상태를 수정하는 부작용이다. NestJS 의 `@Global` 인스턴스는 전체 애플리케이션 수명 동안 동일한 객체이므로, `onModuleInit` 이 두 번 호출될 경우(예: 테스트에서 모듈을 재컴파일해 재생성하지 않는 경우) provider 가 중복 등록될 수 있다. 실제로는 NestJS 앱 인스턴스당 `onModuleInit` 이 한 번만 호출되므로 프로덕션에서는 문제 없다.
- 제안: 중복 등록을 방지하려면 `registerQueueDepthProvider` 내부에서 중복 체크를 할 수 있으나, 현재 패턴도 프로덕션/테스트 환경 모두에서 안전하게 동작한다. 현행 유지 가능.

### [INFO] `ContinuationDlqMonitorService.onModuleInit` 에 공유 상태 등록 부작용 추가 (enabled=false 분기와 무관)
- 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L58-227
- 상세: `registerQueueDepthProvider` 호출이 `if (!this.config.enabled)` 체크 **이전** 에 위치해, DLQ 알람이 비활성화돼 있어도 gauge provider 는 항상 등록된다. 이는 주석("알람 활성 여부와 무관하게 항상 등록")과 테스트("enabled=false 에도 1회 호출")로 의도가 명확히 표현됐다. 의도된 설계이므로 버그는 아니지만, `enabled=false` 시 `setInterval` 이 생성되지 않는 반면 gauge provider 는 등록된다는 비대칭 동작이 처음 읽는 사람에게는 놀라울 수 있다.
- 제안: 현재 인라인 주석이 충분히 설명하고 있으므로 추가 조치 불필요.

### [INFO] `LlmUsageLogService.record` — 메트릭 기록이 DB insert 실패 후에도 발생하는 의도적 부작용
- 위치: `/codebase/backend/src/modules/llm/llm-usage-log.service.ts` L32-42
- 상세: `recordLlmTokens` 가 DB insert `try` 블록 **이전** 에 별도 `try/catch` 로 호출돼, DB insert 가 실패해도 메트릭은 이미 기록된다. 이는 "DB insert 성패와 무관한 계측" 이라는 명시적 설계 의도이며 테스트로 검증됐다. 반면 DB insert 에 성공하고 메트릭 기록이 실패하면 logger.warn 만 남기고 DB 기록은 유지된다. 두 채널(DB·OTel) 사이의 일관성 불일치는 spec NF-OB-07 이원화 정책에서 허용된 트레이드오프다.
- 제안: 조치 불필요. 의도된 설계.

### [INFO] `BusinessMetricsService` constructor 에서 OTel `metrics.getMeter` 전역 호출
- 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L55
- 상세: 생성자에서 `metrics.getMeter('clemvion.business')` 를 호출해 OTel 전역 `MeterProvider` 에 접근한다. `OTEL_ENABLED` 미설정 시 no-op MeterProvider 가 반환돼 안전하다. 그러나 OTel SDK 초기화(`instrumentation.ts`)가 `BusinessMetricsService` 생성자보다 먼저 실행돼야 실제 meter 가 등록된다. NestJS 앱은 `instrumentation.ts` 를 `main.ts` 에서 최상단 import 로 먼저 실행하므로 순서가 보장된다. 만약 `BusinessMetricsService` 가 unit test 에서 직접 생성된다면 OTel SDK 없이 no-op meter 를 사용하게 되어 테스트가 격리된다(의도적으로 `jest.spyOn(metrics, 'getMeter')` 로 mock).
- 제안: 조치 불필요.

### [INFO] `@Global MetricsModule` 등록이 NestJS DI 그래프 전역에 미치는 영향
- 위치: `/codebase/backend/src/app.module.ts` L44, `/codebase/backend/src/modules/metrics/metrics.module.ts`
- 상세: `MetricsModule` 을 `@Global` 로 `AppModule` 에 등록함으로써 `BusinessMetricsService` 가 모든 모듈에 자동 노출된다. 이는 의도된 설계이나, 기존의 다른 `@Global` 모듈(`RedisModule`)과 동일하게 "인프라 서비스는 @Global 허용" 규약의 범위 내다. 새로운 외부 엔드포인트 노출·환경 변수 변경·네트워크 호출·이벤트 발생 등의 부작용은 없다.
- 제안: 조치 불필요.

---

## 요약

이번 변경(NF-OB-07 도메인 메트릭 파이프라인)에서 가장 주목할 부작용은 두 가지다. 첫째, `ContinuationDlqMonitorService` 와 `LlmUsageLogService` 의 생성자 시그니처에 `BusinessMetricsService` 가 추가됐으며, 기존 직접 인스턴스화 코드가 있다면 컴파일 오류가 발생한다 — 테스트는 모두 갱신됐고 직접 `new` 사용처가 확인되지 않아 실질적 영향 없음. 둘째, `onModuleInit` 에서 `BusinessMetricsService.queueProviders` 전역 가변 배열을 변경(push)하는 부작용이 추가됐는데, 스냅샷 이터레이션으로 동시성 오염을 방지하고 `private readonly` 로 외부 임의 접근을 차단해 안전하게 처리됐다. `LlmUsageLogService.record` 에서 메트릭 기록이 DB insert 성패와 독립적으로 발생하는 것은 spec 이원화 정책의 의도된 트레이드오프이며, 모든 메트릭 호출이 자체 `try/catch` 또는 OTel no-op 으로 실행 경로를 보호하고 있어 의도치 않은 상태 오염·파일시스템 부작용·네트워크 호출·환경 변수 조작은 없다.

## 위험도

LOW

---

STATUS: SUCCESS
