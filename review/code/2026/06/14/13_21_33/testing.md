# 테스트(Testing) 리뷰 결과

## 발견사항

### [INFO] `llm-usage-log.service.spec.ts` — `insert 실패 시에도 메트릭은 기록된다` 케이스: DB 오류 전파 억제 검증 누락
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/llm/llm-usage-log.service.spec.ts` L42-51
- **상세**: `insert` 실패 시 `recordLlmTokens` 가 1회 호출되었음을 assertion 하지만, `service.record(...)` 자체가 예외를 던지지 않는다는 것(resolves.toBeUndefined)을 검증하지 않는다. 하단 L83-93 의 기존 케이스(`insert가 실패해도 throw하지 않고 경고만 남긴다`)가 예외 비전파를 커버하고 있어 기능상 중복되지 않으므로 결함은 아니나, 새 케이스가 "insert 실패 시에도 예외 없이 메트릭이 기록됨"을 단일 케이스에서 완결하지 않아 의도 표현이 약하다.
- **제안**: 해당 케이스에 `await expect(service.record(...)).resolves.toBeUndefined()` 를 추가해 insert 실패 → 예외 비전파 + 메트릭 기록을 하나의 케이스로 완결한다.

### [INFO] `business-metrics.service.spec.ts` — `recordLlmTokens` 음수 입력 케이스 미존재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` L62-77
- **상세**: `recordLlmTokens` 는 `if (usage.inputTokens)` falsy 체크를 사용한다. 양수·0 케이스는 테스트 커버가 되어 있지만, 음수 입력 시 Counter 에 음수가 기록되는지에 대한 테스트가 없다. OTel `Counter` 는 monotonically-increasing 이 계약이므로 음수 입력은 정의되지 않은 동작이다. 현재 호출 경로가 LLM API 응답을 그대로 넘기므로 실제로 음수가 발생하기 어렵지만, 방어 로직(`> 0` 명시적 검사)이 추가된다면 테스트로 보호되어야 한다.
- **제안**: 음수 토큰 정책(skip vs. clamp)을 결정한 뒤 케이스를 추가하거나, 현행 falsy 체크가 의도적임을 명시하는 주석으로 대체한다. 현시점에서는 당장 차단 이슈는 아니나 향후 정책 추가 시 회귀 방지용 케이스가 필요하다.

### [INFO] `business-metrics.service.spec.ts` — 복수 provider 모두 성공 시 합산 관측 케이스 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.spec.ts` L89-126
- **상세**: 현재 queue gauge 테스트는 (1) 단일 provider 정상 동작, (2) 첫 번째 provider 실패 + 두 번째 provider 성공 두 케이스만 존재한다. 복수 provider 가 모두 성공할 때 두 provider 의 observe 결과가 독립적으로 모두 기록되는지 (`Promise.allSettled` 병렬 집계 정확성)를 커버하는 케이스가 없다. 현재 구현이 `for (const settled of results)` 루프를 통해 처리하므로 이 경로가 단위 테스트에서 검증되지 않는다.
- **제안**: 두 provider 모두 성공하는 케이스를 추가해 각각의 observe 호출이 모두 발생함을 검증한다.

### [INFO] `continuation-dlq-monitor.service.spec.ts` — `provider` 콜백 반환값의 `queue` 라벨이 `CONTINUATION_EXECUTION_QUEUE` 상수임을 검증하지 않음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/continuation/continuation-dlq-monitor.service.spec.ts` L130-158
- **상세**: provider 콜백이 반환하는 스냅샷에서 `queue: expect.any(String)` 으로 검증한다. 실제 코드는 `CONTINUATION_EXECUTION_QUEUE` 상수를 사용하므로, `expect.any(String)` 은 공백 문자열이나 다른 큐 이름도 허용한다. 큐 이름이 잘못된 경우를 검출하지 못한다.
- **제안**: `queue: CONTINUATION_EXECUTION_QUEUE` 로 구체적 값을 단언한다. 상수를 import 해서 단언하면 상수가 변경될 때 테스트도 함께 실패해 회귀를 잡는다.

### [INFO] `execution-engine.service.spec.ts` — `registerQueueDepthProvider` 가 `onModuleInit` 에서 호출되는지 검증하는 케이스가 NF-OB-07 전용 describe 블록에 없음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` L15627 이하 `NF-OB-07 BusinessMetrics 동작` describe
- **상세**: W-3(emitTerminalExecutionMetrics), W-5(recordNodeLatencyMetrics) 전용 케이스는 충실히 추가되었으나, `ExecutionEngineService.onModuleInit` 가 `businessMetrics.registerQueueDepthProvider` 를 1회 호출하는지 검증하는 케이스가 이 describe 블록에 없다. `mockBizMetrics.registerQueueDepthProvider` mock 은 준비되어 있어 바로 활용 가능한 상태다.
- **제안**: 아래 케이스를 `NF-OB-07 BusinessMetrics 동작` describe 에 추가한다:
  ```ts
  it('onModuleInit 시 registerQueueDepthProvider 를 1회 호출한다', () => {
    svcMetrics.onModuleInit();
    expect(mockBizMetrics.registerQueueDepthProvider).toHaveBeenCalledTimes(1);
    expect(mockBizMetrics.registerQueueDepthProvider).toHaveBeenCalledWith(expect.any(Function));
  });
  ```

### [INFO] `metrics.module.spec.ts` — smoke 테스트가 `BusinessMetricsService` 의 실제 메서드 동작을 검증하지 않음
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/metrics.module.spec.ts`
- **상세**: `MetricsModule` smoke 테스트는 DI 해결 가능 여부(`toBeInstanceOf(BusinessMetricsService)`)만 검증한다. 이는 의도된 목적(모듈 구성 오류 조기 발견)으로 적절하다. 다만 `metrics.getMeter` 가 no-op meter 를 반환하는 환경에서 생성자 내 instrument 초기화가 에러 없이 완료되는지도 확인하지 않는다.
- **제안**: 현재 scope(smoke 테스트)에서는 충분하다. 실제 OTel API 호출은 `business-metrics.service.spec.ts` 에서 mock meter 로 검증하므로 중복 검증 불필요. 개선 불필요.

### [INFO] `llm-usage-log.service.spec.ts` — `recordLlmTokens` mock 이 `totalTokens` 를 포함한 usage 객체 전체를 전달받는지 검증함 (의도와 일치하는지 확인 필요)
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/llm/llm-usage-log.service.spec.ts` L39
- **상세**: `expect(recordLlmTokens).toHaveBeenCalledWith('gpt-4o', usage)` 에서 `usage = { inputTokens: 12, outputTokens: 8, totalTokens: 20 }` 전체를 단언한다. 실제 구현 `LlmUsageLogService.record` 는 `params.usage` 를 그대로 넘기므로 `totalTokens` 도 포함된다. `BusinessMetricsService.recordLlmTokens` 의 `LlmTokenUsage` 인터페이스는 `totalTokens` 필드가 없어 TypeScript 구조적 호환은 되지만, mock assertion 에 `totalTokens` 가 포함됨으로써 `BusinessMetricsService` 가 `totalTokens` 를 무시한다는 사실이 테스트에서 드러나지 않는다.
- **제안**: `toHaveBeenCalledWith('gpt-4o', expect.objectContaining({ inputTokens: 12, outputTokens: 8 }))` 형태로 관심 필드만 단언하거나, 현재 구현이 usage 객체 전체를 pass-through 함을 주석으로 명시한다. 기능상 버그는 아니나 테스트 의도 표현이 명확해진다.

---

## 요약

NF-OB-07 비즈니스 메트릭 도입에 따른 테스트 추가는 전반적으로 충실하다. `BusinessMetricsService` 의 5개 instrument 전체에 대한 단위 테스트(`business-metrics.service.spec.ts`), `LlmUsageLogService` 의 metricsrecord 격리 검증, `ContinuationDlqMonitorService` 의 provider 등록 및 콜백 반환값 검증, `ExecutionEngineService` private 메서드(`emitTerminalExecutionMetrics`, `recordNodeLatencyMetrics`) 의 엣지 케이스 4+4 케이스, `MetricsModule` smoke 테스트까지 새 코드에 대한 테스트 존재 여부와 기본 커버리지는 양호하다. 테스트 격리도 적절히 이루어져 있으며(mock meter, mock BusinessMetricsService, factory 함수 패턴), `BusinessMetricsService` 중복 등록 이슈는 이미 commit 482901c4 에서 수정 완료되었다. 남은 갭은 모두 INFO 수준으로: 복수 provider 합산 관측 케이스 누락, `CONTINUATION_EXECUTION_QUEUE` 구체적 큐 이름 미단언, `onModuleInit` 의 `registerQueueDepthProvider` 호출 검증 누락(execution-engine 측), 음수 토큰 정책 미결 케이스 등이다. 이들은 기능 정확성보다 회귀 방지 강도를 높이는 항목이며 즉각 차단 이슈가 아니다.

## 위험도

LOW

STATUS: SUCCESS
