# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] business-metrics.service.ts — `recordLlmTokens` falsy 조건의 명시성 부족
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` L97-105
- **상세**: `if (usage.inputTokens)` 형태의 falsy 체크는 `undefined`, `null`, `0`을 모두 건너뛴다. JSDoc 주석("0 은 건너뛴다")과 테스트가 이를 의도된 동작으로 검증하므로 버그는 아니다. 그러나 `undefined` 누락(선택적 필드)과 `0` 생략(의도적 필터) 두 의미가 동일 구문에 혼합되어 독자가 의도를 즉시 파악하기 어렵다. 이미 이전 리뷰(12_32_02)에서도 INFO #15로 식별됐고 후속 목록에 남아 있다.
- **제안**: `if (usage.inputTokens != null && usage.inputTokens > 0)` 형태로 `undefined` 제외와 양수 필터 의도를 분리 표현하거나, 현행 유지 시 JSDoc에 "undefined·0 모두 건너뜀" 이유를 한 줄 명기한다.

### [INFO] execution-engine.service.ts — `onModuleInit` 내 책임 혼재
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/execution-engine/execution-engine.service.ts` L896-928
- **상세**: `onModuleInit`이 `registerHandlers()` 호출(핸들러 등록)과 `registerQueueDepthProvider` 블록(메트릭 gauge 등록)이라는 두 가지 서로 다른 책임을 담는다. 현재는 코드 블록이 명확히 주석으로 분리되어 있어 가독성 자체가 나쁘지는 않다. 그러나 새로운 gauge provider가 추가될수록 이 메서드가 비대해지는 구조다. `ContinuationDlqMonitorService`도 동일한 패턴을 취해 일관성은 있지만, 두 서비스 모두에서 초기화 로직이 단일 메서드에 누적되는 경향이다.
- **제안**: 큐 depth provider 등록 블록을 `private registerQueueDepthProviders(): void` 전용 메서드로 추출하고 `onModuleInit`에서 호출하면 책임 분리가 명확해지고 향후 메트릭 지점 추가 시 수정 범위가 최소화된다. 단기 필수는 아니며 리팩토링 항목이다.

### [INFO] business-metrics.service.ts — `LlmTokenUsage` 내부 인터페이스와 `TokenUsage` 구조적 중복
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` L25-29
- **상세**: `LlmTokenUsage` 인터페이스는 파일 내부에서만 사용되며 `llm` 모듈의 `TokenUsage`와 선택적 필드 구조가 동일하다. 모듈 간 느슨한 결합을 위해 의도적으로 분리한 설계 결정이고 클래스 JSDoc에 근거가 명기되어 있어 타당하다. 다만 두 타입이 diverge할 경우 조용히 호환성이 깨진다.
- **제안**: 현행 유지가 적절하다. 향후 두 타입 간 필드 불일치가 발생하면 공통 `packages/` 레이어에 도메인 공유 타입을 배치하는 방향을 검토한다.

### [INFO] app.module.ts — import 선언 위치와 모듈 배열 내 위치의 불일치
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/app.module.ts` (import 섹션)
- **상세**: `MetricsModule` import 선언이 `common/guards` 블록(RolesGuard) 바로 전에 삽입되어 있어, `common/` 임포트 사이에 `modules/` 임포트가 끼어드는 형태다. 모듈 배열에서의 위치(RedisModule 바로 다음, 공유 인프라 그룹)와 import 선언 위치가 일치하지 않아 코드 구조 읽기 흐름이 미세하게 끊긴다.
- **제안**: import 선언을 다른 `modules/` 임포트 그룹으로 이동해 `common/`과 `modules/` 블록을 분리한다. 사소한 수준이므로 필수는 아니다.

### [INFO] business-metrics.service.ts — `QueueDepthProvider` 타입의 에러 처리 계약 미명시
- **위치**: `/Volumes/project/private/clemvion/.claude/worktrees/metrics-business-1f9ab7/codebase/backend/src/modules/metrics/business-metrics.service.ts` L23
- **상세**: `QueueDepthProvider` 타입(`() => Promise<QueueDepthSnapshot[]>`)의 JSDoc이 "provider 가 throw 할 경우 해당 주기만 건너뛴다"는 에러 처리 계약을 명시하지 않는다. 실제로 `observeQueues`가 `Promise.allSettled`로 throw를 처리하므로 안전하지만, provider 구현자는 이 계약을 별도로 파악해야 한다.
- **제안**: `QueueDepthProvider` 타입 위 JSDoc에 "throw 시 해당 수집 주기를 건너뛰고 warn 로그를 남긴다" 한 줄을 추가한다.

---

## 요약

이번 변경은 `BusinessMetricsService` + `MetricsModule` 신설을 통한 NF-OB-07 도메인 메트릭 계측 도입이다. 이전 리뷰 세션(12_32_02)에서 지적된 주요 유지보수성 우려사항들(BusinessMetricsService 중복 등록, `as never` 타입 우회, `TERMINAL_STATUSES` 매번 재생성, `observeQueues` 직렬 폴링)이 모두 수정 완료된 상태로, 현재 코드는 전반적으로 양호하다. `BusinessMetricsService` 자체는 단일 책임을 유지하고 공개 API 이름(recordExecutionTerminal, recordLlmTokens, registerQueueDepthProvider 등)이 의도를 명확히 표현한다. 메트릭 실패가 실행 경로에 영향을 주지 않도록 오류를 삼키는 패턴이 일관되게 적용되었고, `Promise.allSettled` 병렬 폴링과 스냅샷 이터레이션으로 동시성 안전성도 확보되었다. 남은 항목은 모두 INFO 수준의 경미한 가독성 개선 사항으로, 현 코드베이스가 즉시 조치를 요하는 유지보수성 결함을 포함하지 않는다.

## 위험도

LOW

STATUS: SUCCESS
