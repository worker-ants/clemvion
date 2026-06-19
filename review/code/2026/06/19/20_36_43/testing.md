# 테스트(Testing) 리뷰 결과

## 발견사항

### [WARNING] 서비스별 spec 파일의 mock driver 타입이 ISP 분할 후에도 여전히 `EngineDriver` (전체 인터페이스) 사용
- 위치: `ai-turn-orchestrator.service.spec.ts` (line 3, 36, 51), `form-interaction.service.spec.ts` (line 5, 44, 66), `button-interaction.service.spec.ts` (line 13, 49, 71), `retry-turn.service.spec.ts` (line 6, 44, 85)
- 상세: 이번 변경의 핵심 목적인 ISP 분할로 프로덕션 코드에서는 각 서비스가 `AiTurnEngineDriver` / `InteractionEngineDriver` / `RetryEngineDriver` 만 주입받도록 변경됐다. 그러나 해당 서비스들의 spec 파일은 여전히 `jest.Mocked<EngineDriver>` (12-멤버 전체 인터페이스)를 사용하고 있어, "이 서비스는 자신이 필요한 메서드만 사용한다"는 컴파일 타임 계약이 테스트에서 검증되지 않는다. 예를 들어 `FormInteractionService`는 `InteractionEngineDriver`만 알아야 하지만, spec에서는 `EngineDriver` 전체 mock을 주입하므로 서비스가 우연히 `buildResumeCheckpoint` 같은 미허용 메서드를 호출해도 테스트가 통과한다.
- 제안: 각 spec 파일의 mock driver 타입을 해당 서비스의 실제 주입 타입으로 좁힌다. `ai-turn-orchestrator.service.spec.ts` → `jest.Mocked<AiTurnEngineDriver>`, `form-interaction.service.spec.ts` / `button-interaction.service.spec.ts` → `jest.Mocked<InteractionEngineDriver>`, `retry-turn.service.spec.ts` → `jest.Mocked<RetryEngineDriver>`. `as unknown as` 캐스팅을 제거하면 타입스크립트가 mock에서 불필요한 메서드 추가를 컴파일 오류로 잡을 수 있어 테스트가 ISP 계약을 실제로 검증한다.

### [WARNING] `ExecutionEventEmitter` spec이 `forwardRef` 도입 후 직접 생성자 주입 방식(`new ExecutionEventEmitter(...)`)을 사용해 NestJS DI 라이프사이클 테스트 누락
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.spec.ts` (line 25-27)
- 상세: 이번 변경에서 `ExecutionEventEmitter` 생성자에 `@Inject(forwardRef(() => WebsocketService))` 데코레이터가 추가됐다. 기존 spec은 `new ExecutionEventEmitter(websocket as unknown as WebsocketService)`로 직접 인스턴스를 생성해 단위 테스트하므로, `forwardRef` 래퍼 + NestJS `@Inject` 메타데이터가 올바르게 동작하는지 모듈 수준에서는 검증하지 않는다. 주입 해석 실패(순환 참조 미해소)는 런타임까지 드러나지 않는다.
- 제안: 기존 단위 테스트는 그대로 유지하되, `Test.createTestingModule`을 사용하는 통합 스모크 테스트를 추가해 `WebsocketService` mock을 `forwardRef` 토큰으로 제공했을 때도 `ExecutionEventEmitter`가 올바르게 인스턴스화되는지 검증한다. 또는 이미 상위 통합 테스트(`execution-engine.service.spec.ts`)가 전체 모듈을 부트스트랩해 이를 커버하는지 확인한다.

### [INFO] `continuation-execution.processor.spec.ts` — `retry_last_turn`이 `isNodeExecutionWaiting` 가드를 우회하는 케이스에서 인수 어서션 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.spec.ts` (line 515-526)
- 상세: `bypasses isNodeExecutionWaiting guard` 케이스(line 515)는 `engine.isNodeExecutionWaiting.not.toHaveBeenCalled()`와 `retry.applyRetryLastTurn.toHaveBeenCalled()`만 확인한다. 어떤 인수로 호출됐는지(`executionId`, `spawnedNodeExecutionId`)를 어서트하지 않아, 인수 매핑 버그가 있을 때 이 테스트로는 탐지되지 않는다.
- 제안: `expect(retry.applyRetryLastTurn).toHaveBeenCalledWith('exec-1', 'ne-spawned')` 어서션을 추가한다 (위 두 `retry_last_turn` 테스트와 동일하게).

### [INFO] `execution-engine.service.spec.ts` — `applyRetryLastTurn` 통합 테스트 약 16개 호출 사이트 전환은 완료됐으나 `retryTurnService`가 `ENGINE_DRIVER`를 경유해 엔진과 협력한다는 경로가 주석 외 검증 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/execution-engine/execution-engine.service.spec.ts` (line 12629 일대)
- 상세: 이는 현재 구조상 의도된 통합 테스트로 driver=엔진 실인스턴스를 exercise하므로 실질적으로 커버는 된다. 별도 `retry-turn.service.spec.ts`에서 `driver=RetryEngineDriver mock`으로 격리 검증하는 방식이 이미 있어 통합/단위 역할이 분리된 상태다. 허용 가능한 수준이다.
- 제안: 필수 변경 아님. `retryTurnService` 인스턴스를 얻는 블록에 "이 통합 테스트는 RetryTurnService → ENGINE_DRIVER(엔진) 협력 전체를 exercise 한다"는 짧은 주석을 추가하면 가독성이 개선된다.

### [INFO] `websocket.gateway.spec.ts` — 에러 케이스 4개에서 `module.get(RetryTurnService)` 호출이 각 `it` 블록마다 반복
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/websocket/websocket.gateway.spec.ts` (line 843, 886, 904, 916, 928)
- 상세: 동일한 `module.get(RetryTurnService)` 호출이 5개 `it` 블록에 분산돼 있다. mock이 `useValue`로 등록된 동일 객체를 반환하므로 격리 문제는 없지만 중복이 있다.
- 제안: 선택적 리팩터. `describe('handleRetryLastTurn')` 블록 상단에 `let mockRetry` 를 선언하고 `beforeEach`에서 한 번만 resolve 하면 반복이 줄어든다.

### [INFO] `engine-driver.interface.ts` ISP 계층 구조 자체에 대한 타입 수준 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/engine-di-isp-2288fe/codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver extends AiTurnEngineDriver, RetryEngineDriver` 상속 계층이 중복 없이 12개 멤버를 포함하는지, `ExecutionEngineService implements EngineDriver` 가 올바른지는 `tsc --noEmit` 통과로 보장된다. 그러나 `InteractionEngineDriver extends CoreEngineDriver` 체인이 깨졌을 때 어느 소비자 spec에서 먼저 실패할지 추적이 어렵다.
- 제안: 이미 `tsc` 빌드 패스로 커버되고 있어 필수 추가 항목은 아니다. 향후 멤버 변경 시 regression을 빠르게 잡으려면 `satisfies` 또는 AssignableTo 패턴의 타입 테스트 파일을 추가하는 것을 고려할 수 있다.

---

## 요약

이번 변경(C-1 후속 ④ ISP + engine→Retry DI 제거)은 테스트 관점에서 전반적으로 견고하게 작성됐다. `ContinuationExecutionProcessor` spec은 `RetryTurnService` mock을 올바르게 분리해 제공하고 어서션도 업데이트됐으며, `execution-engine.service.spec.ts`의 `applyRetryLastTurn` 호출 사이트 16개도 `retryTurnService`로 일관되게 전환됐고, `websocket.gateway.spec.ts`의 에러 케이스도 `RetryTurnService` mock으로 올바르게 재배선됐다. 주요 경고는 두 가지다: (1) `ai-turn-orchestrator`, `form-interaction`, `button-interaction`, `retry-turn` spec 파일이 ISP 도입 이후에도 여전히 12-멤버 전체 `EngineDriver`를 mock 타입으로 사용해, 각 서비스가 실제로 허용된 메서드만 사용하는지 컴파일 타임 계약이 테스트에서 검증되지 않는 점, (2) `ExecutionEventEmitter`가 `forwardRef`로 전환됐으나 spec은 직접 생성자 주입 방식을 유지해 NestJS DI 해석 경로가 모듈 수준에서 테스트되지 않는 점이다. 두 경고 모두 기능 버그를 유발하지는 않지만 ISP 분할의 컴파일 타임 안전망 효과가 테스트에서 실현되지 않는 아쉬움이 있다. 전반적인 테스트 격리·가독성·커버리지는 양호하다.

---

## 위험도

LOW
