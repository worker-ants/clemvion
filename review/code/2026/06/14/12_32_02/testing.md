# 테스트(Testing) 리뷰 결과

## 발견사항

### [WARNING] execution-engine.service.spec.ts — `BusinessMetricsService` 중복 등록
- 위치: `execution-engine.service.spec.ts` diff, `describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트')` 내 `module3` 빌더 (~라인 15290–15293)
- 상세: `BusinessMetricsService`가 같은 `providers` 배열 안에 두 번 등록되어 있다. NestJS `TestingModule`은 후자를 우선하므로 기능상 문제는 없지만, copy-paste 오류로 향후 혼란을 줄 수 있다.
- 제안: 중복된 `BusinessMetricsService` 항목 한 줄 제거.

### [WARNING] `emitTerminalExecutionMetrics` / `recordNodeLatencyMetrics` — 직접 단위 테스트 없음
- 위치: `execution-engine.service.ts` 신규 메서드 `emitTerminalExecutionMetrics` (라인 9335+) 및 `recordNodeLatencyMetrics`
- 상세: `execution-engine.service.spec.ts`에서 `BusinessMetricsService`는 **실제 인스턴스**로 주입됐다(mock 아님). 이 상태에서 `recordExecutionTerminal`, `recordExecutionError`, `recordNodeDuration` 호출 여부를 검증하는 테스트가 존재하지 않는다. 즉,
  - `persisted=false`일 때 메트릭이 발생하지 않는다는 보장,
  - `newStatus`가 terminal이 아닐 때(예: `WAITING_FOR_INPUT`) skip된다는 보장,
  - `recordNodeLatencyMetrics`가 오류를 삼키는(try/catch) 것이 실제로 실행 경로를 막지 않는다는 보장
  가 모두 테스트되지 않은 상태다.
- 제안: `execution-engine.service.spec.ts`에 `BusinessMetricsService`를 mock으로 제공하는 전용 describe 블록을 추가하거나, `emitTerminalExecutionMetrics`를 `private`에서 `package-private`으로 노출해 직접 단위 테스트를 작성한다.

### [WARNING] `registerQueueDepthProvider` 호출 검증 — `ContinuationDlqMonitorService` 스펙에서 실제 콜백 내용 미검증
- 위치: `continuation-dlq-monitor.service.spec.ts`, `lifecycle` describe 블록
- 상세: 개정된 `makeService`는 `registerQueueDepthProvider` mock을 노출하지만, `onModuleInit` 시 해당 mock이 실제로 호출됐는지, 그리고 provider 콜백이 올바른 `getJobCounts` 인자(`'waiting','active','delayed','failed'`)로 호출되는지를 검증하는 테스트가 없다. `enabled=false`일 때도 provider가 등록된다는 주석이 코드에 있으나, 이 동작을 명시적으로 테스트하는 케이스가 없다.
- 제안: `lifecycle` 블록에 다음 두 케이스를 추가한다.
  1. `onModuleInit` 호출 후 `registerQueueDepthProvider`가 1회 호출됐는지 확인
  2. `enabled=false`일 때도 `registerQueueDepthProvider`가 호출됐는지 확인 (알람 disable과 독립적으로 gauge provider 등록이 이루어짐을 보장)

### [WARNING] `recordNodeLatencyMetrics` — `durationMs == null` 건너뜀 외 엣지케이스 미검증
- 위치: `execution-engine.service.ts`, `recordNodeLatencyMetrics` 메서드
- 상세: `row.node`가 `null`인 경우 `'unknown'`으로 fallback하는 로직, `durationMs == null` 건너뜀 로직이 존재하나 이에 대한 직접 단위 테스트가 없다. 특히 DB `find` 실패 시 `catch` 블록이 조용히 삼키는 동작이 검증되지 않는다.
- 제안: `BusinessMetricsService`를 mock으로 주입하는 테스트에서 `nodeExecutionRepository.find`가 reject할 때 `recordNodeDuration`이 호출되지 않고 예외도 전파되지 않음을 검증한다.

### [INFO] `BusinessMetricsService` 테스트 — `recordLlmTokens` 음수 토큰 케이스 미테스트
- 위치: `business-metrics.service.spec.ts`, `recordLlmTokens` 테스트
- 상세: `if (usage.inputTokens)` 조건은 falsy 체크이므로 `inputTokens: -5`처럼 음수 값도 `true`로 통과한다. 스펙상 토큰 수는 항상 비음수이지만, 방어적 관점에서 음수 입력 시 카운터에 음수값이 add되는 것이 의도된 동작인지 테스트가 명확히 밝히지 않는다.
- 제안: 음수 토큰 입력을 명시적으로 허용하거나 차단하는 정책을 결정하고, 그에 맞는 테스트 케이스를 추가한다.

### [INFO] `BusinessMetricsService` 테스트 — 다중 gauge provider 등록 순서 검증 없음
- 위치: `business-metrics.service.spec.ts`
- 상세: provider가 실패해도 두 번째 provider는 계속 관측되는 격리 케이스는 검증되었으나, 복수 provider의 결과가 정상 합산되어 observe되는 케이스(provider가 2개 이상이고 모두 성공)는 별도로 검증되지 않는다.
- 제안: 2개 provider 모두 성공하는 케이스를 추가해 merged 관측 동작을 명시적으로 검증한다.

### [INFO] `execution-engine.service.spec.ts` — `BusinessMetricsService` 실제 인스턴스 사용에 따른 OTel 전역 의존성
- 위치: `execution-engine.service.spec.ts` 전체 `providers` 배열 (`BusinessMetricsService` 실제 클래스 등록)
- 상세: `BusinessMetricsService` 생성자는 `metrics.getMeter('clemvion.business')`를 직접 호출한다. 테스트 환경에서 OTel MeterProvider가 no-op이므로 기능 오류는 없지만, `business-metrics.service.spec.ts`에서처럼 `getMeter`를 spy하지 않기 때문에 `execution-engine` 스펙에서는 실제 instrument들이 no-op counter/histogram으로 생성된다. 이는 의도된 동작이지만, 테스트가 `BusinessMetricsService`의 실제 호출 여부를 추적할 수 없어 계측 검증에 맹점이 생긴다.
- 제안: `execution-engine.service.spec.ts`의 일부 describe 블록(특히 `updateExecutionStatus` 관련 경로 테스트)에서 `BusinessMetricsService`를 mock으로 교체하거나, 별도의 통합 테스트 파일을 만들어 메트릭 계측 경로를 독립 검증한다.

### [INFO] `LlmUsageLogService` 테스트 — `recordLlmTokens` 실패 시 DB insert도 시도하지 않는 경우 미검증
- 위치: `llm-usage-log.service.spec.ts`
- 상세: `record` 메서드는 `businessMetrics.recordLlmTokens`를 `try` 블록 바깥에서 호출한다. 만약 `recordLlmTokens` 자체가 예외를 던진다면(no-op이 아닌 구현 오류 등) `insert`는 실행되지 않는다. 이 경우가 테스트되지 않았다.
- 제안: `recordLlmTokens`가 throw할 때 `insert`도 호출되지 않고, 예외가 호출자에게 전파되는지 명확히 테스트한다(또는 의도적으로 허용한다면 문서화한다).

### [INFO] `MetricsModule` — 모듈 자체 통합 테스트 없음
- 위치: `codebase/backend/src/modules/metrics/metrics.module.ts`
- 상세: `MetricsModule`이 `@Global`로 선언되었으나, NestJS 모듈 빌드가 실제로 `BusinessMetricsService`를 전역 export하는지 검증하는 통합 테스트가 없다. `app.module.ts`의 `MetricsModule` 등록이 의도대로 동작하는지는 e2e 레벨에서만 확인 가능하다.
- 제안: `metrics.module.spec.ts`를 추가해 `Test.createTestingModule({ imports: [MetricsModule] })`로 `BusinessMetricsService`가 inject 가능함을 검증한다. 단순 smoke test이지만 @Global 설정 오류를 조기에 잡을 수 있다.

---

## 요약

이번 변경은 `BusinessMetricsService` 핵심 로직에 대해 잘 구성된 단위 테스트(`business-metrics.service.spec.ts`)를 새로 추가했으며, counter/histogram/observable gauge 각각의 happy path와 provider 실패 격리 케이스를 충실히 커버한다. `LlmUsageLogService`와 `ContinuationDlqMonitorService` 스펙 변경도 의존성 주입 변화에 맞게 테스트 픽스처가 적절히 갱신됐다. 다만 `execution-engine.service.spec.ts`에서 `BusinessMetricsService`가 실제 인스턴스로 주입되어 계측 경로(`emitTerminalExecutionMetrics`, `recordNodeLatencyMetrics`)를 직접 assertion하는 테스트가 부재한 점, `continuation-dlq-monitor.service.spec.ts`에서 `registerQueueDepthProvider` 콜백 동작을 검증하지 않는 점, 그리고 `execution-engine.service.spec.ts`의 `BusinessMetricsService` 중복 등록은 보완이 필요하다. 전반적인 테스트 품질은 양호하나, 실행 엔진 메트릭 계측 경로에 대한 커버리지 갭이 존재한다.

## 위험도

MEDIUM
