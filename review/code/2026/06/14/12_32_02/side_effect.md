# 부작용(Side Effect) 리뷰 결과

## 발견사항

### [WARNING] BusinessMetricsService.queueProviders 배열 — 모듈 재초기화 시 provider 중복 등록 위험
- 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` L88 (`queueProviders: QueueDepthProvider[] = []`), `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `onModuleInit`, `continuation-dlq-monitor.service.ts` `onModuleInit`
- 상세: `queueProviders`는 인스턴스 수준 배열이다. `@Global` + `@Injectable` 싱글턴이므로 정상 운영에서는 문제 없다. 그러나 테스트에서 `BusinessMetricsService`를 실제 구현체(mock 없이)로 주입하는 경우(`execution-engine.service.spec.ts` 등), 여러 `describe` 블록이 같은 싱글턴을 재사용하면 `onModuleInit` 이 반복 호출되어 provider 가 누적 등록될 수 있다. 테스트에서 `BusinessMetricsService`를 직접 `providers`에 추가하는 방식이므로 각 `Test.createTestingModule` 호출마다 새 인스턴스가 만들어지나, provider 등록 순서(DI 초기화)에 따라 `onModuleInit` 타이밍이 달라질 경우 누적이 발생할 수 있다.
- 제안: `registerQueueDepthProvider`에 중복 등록 방지 체크(동일 provider 함수 참조 비교)를 추가하거나, `onModuleDestroy`에서 `queueProviders` 배열을 비우는 정리 로직을 추가한다.

### [WARNING] execution-engine.service.spec.ts — BusinessMetricsService 이중 등록 (duplicate provider)
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` diff 라인 `+          BusinessMetricsService,` + `+          BusinessMetricsService,` (SUMMARY W3/W5/W6/W7 describe 블록)
- 상세: 동일 describe 블록의 `createTestingModule`에서 `BusinessMetricsService`가 두 번 중복 선언되어 있다. NestJS의 `Test.createTestingModule`은 중복 provider를 마지막 것으로 덮어쓰므로 런타임 에러는 발생하지 않으나, 의도치 않은 상태(어느 인스턴스가 실제 사용되는지 모호)를 만들고 코드 가독성을 해친다.
- 제안: 중복된 `BusinessMetricsService` 선언 중 하나를 제거한다.

### [INFO] ContinuationDlqMonitorService.onModuleInit — enabled=false 여부와 무관하게 queueDepthProvider 항상 등록
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` L622–641
- 상세: 서비스가 `enabled=false`로 설정된 경우에도 `registerQueueDepthProvider` 는 항상 실행된다. 이는 주석에 명시된 의도적 동작이며("알람이 비활성이어도 깊이 관측은 유효"), 부작용이 아닌 의도된 설계다. 다만 외부에서는 "disabled 서비스가 여전히 게이지에 기여한다"는 점이 비직관적일 수 있다.
- 제안: 현행 설계 유지. 단, 문서화(주석)는 충분히 되어 있으므로 추가 조치 불필요.

### [INFO] ExecutionEngineService.onModuleInit — 기존 registerHandlers 이후 queueDepthProvider 등록 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` diff `onModuleInit` 블록
- 상세: `onModuleInit` 에 새 부작용(queue provider 등록)이 추가됐다. 이는 `BusinessMetricsService`(Global 싱글턴)의 내부 배열에 클로저를 추가하는 부작용이며 의도된 것이다. provider 클로저 내부에서 `this.executionRunQueue`와 `this.backgroundQueue`에 접근하므로, 해당 큐 mock 이 제공되지 않은 테스트에서 런타임 에러가 발생할 수 있다. 그러나 실제 gauge 콜백은 수집 주기에만 호출되므로 단위 테스트 실행 중에는 호출되지 않아 문제가 없다.
- 제안: 현행 설계 허용. 단, 향후 테스트에서 gauge 콜백을 직접 호출하는 경우를 위해 큐 mock을 적절히 제공해야 함을 주의한다.

### [INFO] LlmUsageLogService.record — recordLlmTokens가 try 블록 외부(DB insert 이전)에 위치
- 위치: `codebase/backend/src/modules/llm/llm-usage-log.service.ts` L515–518
- 상세: `this.businessMetrics.recordLlmTokens(...)` 호출이 `try` 블록 바깥에 위치한다. OTel no-op meter 환경에서는 무동작이므로 안전하다. 그러나 `recordLlmTokens` 내부에서 예외가 발생할 경우(예: 커스텀 MeterProvider 버그) `record` 메서드 전체가 throw되어 LLM 호출 결과가 누락될 수 있다. 기존 DB insert는 `try/catch`로 보호되어 있으나 메트릭 계측은 그렇지 않다.
- 제안: `recordLlmTokens` 호출도 `try/catch`로 보호하거나, `try` 블록 안으로 이동시켜 일관성 있는 에러 격리 패턴을 적용한다.

### [INFO] BusinessMetricsService constructor — OTel getMeter 전역 싱글턴 접근 (모듈 로드 시 부작용)
- 위치: `codebase/backend/src/modules/metrics/business-metrics.service.ts` L891 (`metrics.getMeter`)
- 상세: 생성자에서 `metrics.getMeter('clemvion.business')`를 호출하여 OTel 전역 MeterProvider에 접근한다. OTel MeterProvider 미설정 시 no-op meter를 반환하므로 안전하다. 테스트에서는 `jest.spyOn(metrics, 'getMeter')`로 mock 처리되어 있어 전역 오염을 방지한다. 추가적인 부작용은 없다.

### [INFO] MetricsModule @Global 선언 — 전체 앱 컨텍스트에서 BusinessMetricsService 싱글턴 공유
- 위치: `codebase/backend/src/modules/metrics/metrics.module.ts`
- 상세: `@Global()` 데코레이터로 모든 모듈에서 `BusinessMetricsService`를 import 없이 주입 가능하게 만든다. 이는 의도된 설계이나, 단위 테스트에서 `@Global` 모듈을 가져오지 않고 `BusinessMetricsService`를 직접 `providers`에 추가할 경우, 글로벌 스코프와 무관하게 테스트 독립적인 인스턴스가 생성되어 테스트 간 격리가 보장된다. 현재 구현은 이 패턴을 올바르게 사용하고 있다.

### [INFO] emitTerminalExecutionMetrics — 실행 종료 경로에서 fire-and-forget DB 쿼리 추가
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` `recordNodeLatencyMetrics`
- 상세: `void this.recordNodeLatencyMetrics(execution.id)` 로 fire-and-forget DB 조회가 추가됐다. 에러는 내부에서 모두 swallow되어 실행 경로에 영향 없다. 다만 실행이 종료된 직후 DB에서 node_execution 레코드를 다시 조회하므로, 고빈도 실행 환경에서 추가적인 DB 부하가 발생할 수 있다. 단순 SELECT이고 fire-and-forget이라 서비스 가용성에는 영향 없다.
- 제안: 현재 설계 허용. 고빈도 운영 환경에서 DB 부하를 모니터링할 것을 권장.

## 요약

이번 변경은 `BusinessMetricsService`를 새로운 `@Global` 모듈로 도입하고, `ExecutionEngineService`·`ContinuationDlqMonitorService`·`LlmUsageLogService`의 생성자 시그니처에 이 서비스를 추가하는 방식으로 메트릭 계측 지점을 확산시킨다. 기존 호출자에 대한 Breaking Change는 없으며(NestJS DI가 주입을 처리), OTel no-op 안전성이 문서화되어 있어 비활성 환경에서도 안전하다. 주요 우려 사항은 (1) `queueProviders` 배열의 중복 등록 가능성(싱글턴이므로 정상 운영에서는 문제 없으나, 재초기화 시나리오에서 잠재적 위험), (2) `execution-engine.service.spec.ts`에서의 `BusinessMetricsService` 이중 선언, (3) `LlmUsageLogService`에서 메트릭 호출이 try 블록 외부에 있어 OTel 예외 시 보호받지 못하는 점이다. 전체적으로 intentional side effect 위주이며 unintended side effect는 경미한 수준이다.

## 위험도

LOW
