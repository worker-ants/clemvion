# 아키텍처(Architecture) 리뷰

## 발견사항

### 발견사항 1
- **[WARNING]** `registerQueueDepthProvider` push 등록 패턴이 암묵적 계약을 생성하며 DI 원칙(의존성 역전)과 어긋난다
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` — `registerQueueDepthProvider` 메서드 / `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `onModuleInit` L900 / `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `onModuleInit` L61
  - 상세: `BusinessMetricsService`는 `@Global` 인프라 서비스이나 `queueProviders: QueueDepthProvider[]` 가변 컬렉션을 공개 `push` API로 노출한다. 이 패턴은 두 가지 DIP/OCP 위반을 내포한다. (1) `BusinessMetricsService`가 OTel 수집 주기마다 어느 큐가 등록되었는지 자체적으로 알 수 없다 — 새 큐 모듈 추가 시 `onModuleInit`에 `registerQueueDepthProvider` 호출을 반드시 추가해야 한다는 암묵적 계약이 생긴다. (2) `queueProviders` 배열이 외부에서 임의 추가 가능한 열린 컬렉션(open collection)이 되어 서비스 불변식을 외부가 침범할 수 있다. 현재는 두 곳(ExecutionEngineService, ContinuationDlqMonitorService)뿐이나 큐 모듈이 늘어날수록 암묵적 등록 계약 위반 위험이 높아진다. 이전 ai-review에서 이미 W-10으로 식별되어 plan 후속 기록된 상태이며, 본 리뷰도 동일 관점에서 유지된 WARNING이다.
  - 제안: 중기 개선으로 `QUEUE_DEPTH_PROVIDER` 다중 주입 토큰(`@Inject(QUEUE_DEPTH_PROVIDER) providers: QueueDepthProvider[]`)을 정의하고 각 큐 모듈이 토큰에 바인딩하면 `BusinessMetricsService` 생성자가 주입받아 push 등록 자체를 제거할 수 있다. 현재 구현은 NF-OB-07 범위 내에서 안전하게 동작하므로 단기 차단 이슈는 아니다.

### 발견사항 2
- **[WARNING]** `ExecutionEngineService`가 도메인 실행 로직과 관측성 코드를 단일 서비스에 혼재 — SRP 약화
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `emitTerminalExecutionMetrics` (L9359) / `recordNodeLatencyMetrics` (L9387) / `onModuleInit` 내 큐 depth provider 등록 블록 (L900)
  - 상세: `ExecutionEngineService`는 이미 대규모 서비스(9400줄+)다. 이번 변경에서 (a) `emitTerminalExecutionMetrics`, (b) `recordNodeLatencyMetrics`, (c) `onModuleInit` 내 큐 depth gauge 등록이라는 세 가지 관측성 책임이 추가되었다. 특히 `recordNodeLatencyMetrics`는 완료된 node_execution을 DB에서 조회하는 비동기 쿼리를 포함한다 — 실행 엔진이 관측성 집계를 위한 추가 DB 읽기를 직접 담당하게 되어 단일 책임 경계가 명확하게 희석된다. fire-and-forget/오류 swallow로 실행 경로를 차단하지 않는 실용적 설계 선택이나, 관측성 로직의 증가는 서비스 비대화를 가속시킨다. 이전 ai-review W-12로 식별된 항목이다.
  - 제안: 중기 개선으로 `ExecutionMetricsCollector`와 같은 별도 서비스로 분리하고, `ExecutionEngineService`는 기존 `ExecutionEventEmitter`를 통해 terminal 전이 이벤트를 발행하면 메트릭 서비스가 구독하는 옵저버 패턴을 고려한다. `ExecutionEventEmitter`가 이미 존재하므로 마이그레이션 경로가 열려 있다.

### 발견사항 3
- **[INFO]** `@Global` MetricsModule 패턴은 기존 RedisModule과 일관되며 계층 방향은 올바르다
  - 위치: `/codebase/backend/src/modules/metrics/metrics.module.ts` / `/codebase/backend/src/app.module.ts`
  - 상세: `MetricsModule`을 `@Global`로 `AppModule`에 등록해 계측 지점(execution-engine, llm, continuation)이 별도 module import 없이 `BusinessMetricsService`를 주입받는 구조는 `RedisModule`과 동일한 선례다. 모듈 의존 방향이 `execution-engine → metrics(infra)`, `llm → metrics(infra)` 단방향이며 순환 참조가 없다. `metrics` 모듈은 `execution-engine`이나 `llm` 모듈에 대한 역방향 의존이 없다. 현재 인프라 수준 `@Global` 모듈이 2개(Redis, Metrics)로 관리 가능한 범위다.
  - 제안: `@Global` 모듈은 인프라 서비스(Redis, 메트릭 등)로 제한하고 비즈니스 도메인 서비스는 명시적 import를 유지하는 규약을 팀 컨벤션으로 문서화하면 향후 남용을 방지할 수 있다.

### 발견사항 4
- **[INFO]** `BusinessMetricsService`의 `LlmTokenUsage` private 인터페이스가 `TokenUsage`(llm 모듈)와 구조적으로 중복 — 의존성 격리를 위한 의도된 선택이나 diverge 위험 존재
  - 위치: `/codebase/backend/src/modules/metrics/business-metrics.service.ts` L25-29 (`LlmTokenUsage`) / `/codebase/backend/src/modules/llm/interfaces/llm-client.interface.ts` (`TokenUsage`)
  - 상세: `metrics` 모듈이 `llm` 모듈에 의존하지 않도록 자체 `LlmTokenUsage` 인터페이스를 내부 정의한 것은 결합도 최소화 관점에서 타당하다. 그러나 두 인터페이스가 구조적으로 동일한 상태에서 향후 `TokenUsage`에 필드가 추가될 때 `LlmTokenUsage`가 조용히 누락되는 diverge 위험이 있다. 현재는 TypeScript 구조적 타입 시스템이 컴파일 타임에 호환성을 보장하지만, 계측 누락(새 필드가 `LlmTokenUsage`에 없으면 `recordLlmTokens` 서명이 수용 불가)이 아니라 계측 과잉/누락 오류는 런타임에서만 드러난다.
  - 제안: 공통 타입을 `packages/` 공유 패키지나 별도 인터페이스 파일에 배치하거나, `LlmTokenUsage`를 `Pick<TokenUsage, 'inputTokens' | 'outputTokens' | 'thinkingTokens'>`로 정의해 `TokenUsage` 변경이 자동으로 반영되게 하는 방법을 중기 검토한다. (INFO 수준 — 현재 diverge 없음)

### 발견사항 5
- **[INFO]** `ContinuationDlqMonitorService.onModuleInit`에서 큐 depth provider 등록과 알람 타이머 설정이 함께 처리됨 — 응집도 관점 경미한 복합 책임
  - 위치: `/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.ts` — `onModuleInit` L58-93
  - 상세: `onModuleInit`이 (1) gauge provider 등록, (2) enabled 분기, (3) setInterval 타이머 시작의 세 가지 초기화 책임을 순차적으로 수행한다. `ExecutionEngineService.onModuleInit`도 (1) handler 등록, (2) 큐 depth gauge 등록을 혼재하는 동일 패턴이다. 현재 규모에서는 읽기 가능하나 향후 초기화 책임이 추가될 경우 빠르게 비대해질 수 있다. 순환 의존 등 구조적 문제는 없다.
  - 제안: gauge provider 등록을 `private registerGaugeProvider(): void`와 같이 전용 메서드로 추출하면 `onModuleInit`의 읽기 흐름이 개선된다. 선택적 개선이며 현재 상태도 허용 가능하다.

### 발견사항 6
- **[INFO]** `recordNodeLatencyMetrics`에서 QueryBuilder 4컬럼 projection 사용은 이전 리뷰(W-9) 수정의 결과로 올바르나, `leftJoin` + `addSelect` 패턴이 `n.type` null 시 `row.node?.type ?? 'unknown'` 방어 코드를 필요로 하는 구조적 취약성이 남아 있다
  - 위치: `/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` — `recordNodeLatencyMetrics` L9389-9413
  - 상세: `leftJoin('ne.node', 'n')` + `addSelect('n.type')`으로 최소 컬럼만 조회하는 것은 W-9 수정의 올바른 결과다. 그러나 node가 삭제된 레거시 row의 경우 `row.node`가 null이 될 수 있어 `?? 'unknown'` 폴백이 필요하다. 이 경우 메트릭 `node_type='unknown'`으로 집계되어 Prometheus에서 의미 불명확한 데이터가 발생할 수 있다. 현재 catch-all로 완전히 삼키고 있어 운영상 오진단 위험은 낮다.
  - 제안: `node_type='unknown'` 라벨로 집계되는 건수가 운영 모니터링에서 의미 있는 신호인지 여부를 spec에 명시하면 향후 Grafana 대시보드 구성 시 혼란을 방지할 수 있다. 코드 변경 불필요.

---

## 요약

이번 변경(NF-OB-07 비즈니스 메트릭 파이프라인)은 `BusinessMetricsService`를 `@Global` 독립 모듈로 분리하고, OTel no-op meter 패턴으로 비활성 환경 안전성을 보장하며, 모든 계측 지점이 실행 경로를 차단하지 않도록 fire-and-forget/오류 격리를 일관되게 적용한 점에서 아키텍처 관점의 기반 설계는 합리적이다. 모듈 의존 방향(`execution-engine/llm → metrics(infra)`)은 단방향이며 순환 참조가 없다. 주요 아키텍처 우려사항은 두 가지다: (1) `registerQueueDepthProvider` push 등록 패턴이 새 큐 모듈 추가 시 암묵적 등록 계약 누락 위험을 내포하며(W-10, 이미 plan 후속 기록됨), (2) `ExecutionEngineService`에 관측성 DB 쿼리(`recordNodeLatencyMetrics`)가 혼재되어 SRP 경계가 희석된다(W-12, 이미 plan 후속 기록됨). 두 항목 모두 현 릴리즈 차단 수준은 아니며, `QUEUE_DEPTH_PROVIDER` DI 토큰 패턴 전환 및 `ExecutionMetricsCollector` 분리를 중기 기술부채 항목으로 관리하는 것이 적절하다.

## 위험도

LOW

STATUS: SUCCESS
