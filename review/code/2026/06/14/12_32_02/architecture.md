# 아키텍처(Architecture) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `BusinessMetricsService` 의 큐 depth provider 등록 패턴이 의존성 방향을 역전시킨다
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `registerQueueDepthProvider`, `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `onModuleInit`, `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `onModuleInit`
  - 상세: `BusinessMetricsService` 는 `@Global` 메트릭 인프라 서비스다. 그런데 각 큐 소유 서비스(`ExecutionEngineService`, `ContinuationDlqMonitorService`)가 직접 `businessMetrics.registerQueueDepthProvider(...)` 를 호출해 관측 콜백을 등록하는 구조는 "push 등록" 패턴이다. 이 방식은 현재는 동작하지만 다음 두 가지 아키텍처 문제를 내포한다. 첫째, `BusinessMetricsService` 의 `queueProviders` 배열이 가변 상태로서 외부에서 임의 추가 가능한 열린 컬렉션이 되어, 서비스의 단일 책임 경계가 희석된다. 둘째, 큐 관측 책임이 분산되어 어떤 큐가 현재 등록되어 있는지 `BusinessMetricsService` 자체가 알 수 없다 — 새로운 큐 모듈 추가 시 `onModuleInit` 에 등록 호출을 반드시 추가해야 한다는 암묵적 계약이 생긴다(문서화되지 않으면 쉽게 누락).
  - 제안: 큐 provider 등록을 명시적 의존성 주입 패턴으로 전환하는 것을 중기 개선으로 고려한다. 예를 들어 `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰(`@Inject(QUEUE_DEPTH_PROVIDER) providers: QueueDepthProvider[]`)을 정의하고 각 큐 모듈이 토큰에 자신의 provider 를 바인딩하면, `BusinessMetricsService` 는 생성자에서 주입받아 등록 로직이 불필요해진다. 단, 현재 구현도 NF-OB-07 범위 내에서는 명확히 문서화되고 안전하게 작동하므로 단기 차단 이슈는 아니다.

### 발견사항 2
- **[WARNING]** `ExecutionEngineService` 가 비즈니스 로직과 메트릭 계측을 단일 서비스에 혼합한다
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `emitTerminalExecutionMetrics`, `recordNodeLatencyMetrics`
  - 상세: `ExecutionEngineService` 는 이미 대규모 서비스(14,000줄 이상의 스펙 파일 참조)다. 이번 변경에서 `emitTerminalExecutionMetrics` 와 `recordNodeLatencyMetrics` 라는 private 메서드가 추가되었는데, 이 메서드들은 실행 엔진의 핵심 책임(실행 흐름 제어)이 아닌 관측성 사이드이펙트다. 특히 `recordNodeLatencyMetrics` 는 DB에서 `nodeExecutionRepository.find` 를 수행하는 비동기 쿼리를 포함한다 — 이는 실행 엔진 서비스가 관측성 집계를 위한 추가 DB 읽기를 직접 담당하게 함으로써 SRP(단일 책임)를 약화시킨다. 단, 이 메서드는 `void` fire-and-forget 으로 실행 경로를 차단하지 않으며, 모든 오류를 삼킨다는 점에서 실용적 설계 선택이기도 하다.
  - 제안: 중기적으로 `ExecutionMetricsCollector` 와 같은 별도 서비스로 분리하고, 실행 엔진은 도메인 이벤트(`ExecutionEventEmitter`)를 통해 terminal 전이를 발행하면 메트릭 서비스가 구독하는 옵저버 패턴을 고려한다. 현재도 `ExecutionEventEmitter` 가 존재하므로 이 방향으로의 마이그레이션 경로가 열려 있다.

### 발견사항 3
- **[INFO]** 테스트 코드에 `BusinessMetricsService` 가 중복 등록된 구간이 있다
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` — 라인 15290 근방 (`describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 의 `module3`)
  - 상세: diff 에서 `BusinessMetricsService` 가 동일 `providers` 배열에 두 번 추가되었다. NestJS 는 이 경우 두 번째 등록을 무시하므로 런타임 오류는 없지만, 코드 품질 관점에서 명백한 복사-붙여넣기 오류다.
  - 제안: 중복 `BusinessMetricsService` 항목을 제거한다.

### 발견사항 4
- **[INFO]** `MetricsModule` 의 `@Global` 사용은 적절하나 경계 명시가 필요하다
  - 위치: `/codebase/backend/src/modules/metrics/metrics.module.ts`
  - 상세: `@Global` 데코레이터로 `BusinessMetricsService` 를 전역 공급함으로써 계측 지점(execution-engine, llm, continuation)이 별도 import 없이 주입받을 수 있다. 이 패턴은 `RedisModule` 과 같은 기존 공유 인프라와 일관된다. 다만 `@Global` 모듈 수가 늘어날수록 암묵적 전역 의존성이 증가해 테스트 격리나 의존성 추적이 어려워진다. 현재 수준(인프라 2개: Redis, Metrics)은 수용 가능하다.
  - 제안: `@Global` 모듈은 인프라 서비스(Redis·메트릭 등)로 제한하고, 비즈니스 도메인 서비스는 명시적 import 로 유지하는 규약을 팀 컨벤션으로 문서화한다.

### 발견사항 5
- **[INFO]** `BusinessMetricsService` 의 `LlmTokenUsage` 인터페이스가 `TokenUsage` 와 중복된다
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `LlmTokenUsage` (내부 private interface), `/codebase/backend/src/modules/llm/llm-usage-log.service.ts` — `TokenUsage` 참조
  - 상세: `LlmTokenUsage` 는 `BusinessMetricsService` 내부에 정의된 private 인터페이스로, `TokenUsage` (llm 모듈의 공개 타입)와 구조적으로 동일하다. 별도 정의가 있는 이유는 `metrics` 모듈이 `llm` 모듈에 의존하지 않게 하기 위한 의존성 역전 선택이다. 이는 의도된 격리 결정으로 타당하다.
  - 제안: 향후 두 타입 간 diverge 를 방지하기 위해, 공통 `packages/` 에 `TokenUsage` 같은 도메인 공유 타입을 배치하거나, `LlmTokenUsage` 를 `Pick<TokenUsage, ...>` 로 정의하는 방법을 고려한다.

### 발견사항 6
- **[INFO]** `ContinuationDlqMonitorService` 가 `BusinessMetricsService` 를 직접 생성자 주입받는 것은 모듈 경계 관점에서 명확하다
  - 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts`
  - 상세: `continuation` 서브 모듈이 상위 `metrics` 모듈의 서비스를 주입받는다. `MetricsModule` 이 `@Global` 이므로 모듈 import 없이 가능하며, 순환 의존성은 없다 (`metrics` → `execution-engine` 방향 의존이 없음). 레이어 방향: `execution-engine` → `metrics(infra)` 로 단방향이다.
  - 제안: 현재 구조는 수용 가능하며 변경 불필요.

---

## 요약

이번 변경은 NF-OB-07 비즈니스 메트릭 파이프라인을 도입한 것으로, 아키텍처 관점에서 전체적으로 합리적인 설계 결정을 따른다. `BusinessMetricsService` 를 `@Global` 의 독립 모듈로 분리하고, OTel no-op meter 패턴을 활용해 비활성 환경에서의 안전성을 보장하며, 계측 지점이 실행 경로를 차단하지 않도록 fire-and-forget 과 오류 삼킴을 일관되게 적용한 점이 긍정적이다. 다만 큐 depth provider 의 push 등록 패턴은 암묵적 계약을 생성하고, `ExecutionEngineService` 에 관측성 코드가 혼합되는 SRP 경계 희석이 경미하게 발생한다. 테스트 코드의 중복 provider 등록은 즉시 정리가 권장된다. 전반적으로 현재 규모와 NF-OB-07 범위 내에서는 실용적이고 안전한 구현이며, 제안된 개선은 중기 기술부채 항목으로 관리한다.

## 위험도

LOW

STATUS: SUCCESS
