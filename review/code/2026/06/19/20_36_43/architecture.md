# 아키텍처(Architecture) 리뷰

## 발견사항

### [INFO] ISP 적용 — 단일 12-멤버 EngineDriver를 소비자별 부분 인터페이스로 올바르게 분해
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `EngineDriver` 단일 인터페이스를 `CoreEngineDriver` → `InteractionEngineDriver` / `ReentryStateDriver` → `AiTurnEngineDriver` / `RetryEngineDriver` → `EngineDriver`(합집합) 계층으로 분해한 것은 ISP(인터페이스 분리 원칙)의 교과서적 적용이다. `FormInteractionService`와 `ButtonInteractionService`는 `stageDurableResumeSnapshot` + `updateExecutionStatus` + `contextKeyOf`만 필요하므로 `InteractionEngineDriver`로 범위를 좁혔고, `RetryTurnService`는 `rehydrateContext` / `loadAndBuildGraph` / `runNodeDispatchLoop` 등 5개 `@internal` 멤버가 필요하므로 `RetryEngineDriver`로, `AiTurnOrchestrator`는 `buildResumeCheckpoint` / `isCheckpointEligibleNodeType` / `applyPortSelection` 추가가 필요하므로 `AiTurnEngineDriver`로 분리됐다. 각 소비자가 실제 호출하는 표면만 컴파일 타임에 노출하므로 향후 표면 변경 시 영향 범위가 명확하게 드러난다.
- 제안: 현 설계 유지. 향후 신규 소비자 추가 시 기존 합집합에 새 부분 인터페이스를 합산하거나 `EngineDriver`를 확장하는 패턴을 일관 적용하면 된다.

---

### [INFO] 의존성 역전(DIP) — ENGINE_DRIVER 토큰 + useExisting 바인딩 패턴 일관 적용
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts`
- 상세: 모든 추출 서비스(`AiTurnOrchestrator`, `FormInteractionService`, `ButtonInteractionService`, `RetryTurnService`)가 `ExecutionEngineService` 구체 클래스를 직접 참조하지 않고 `ENGINE_DRIVER` 토큰(부분 인터페이스)을 통해 의존한다. 모듈에서 `useExisting: ExecutionEngineService`로 단일 바인딩하므로 향후 엔진 구현체 교체 시 모듈 설정 한 곳만 변경하면 된다. `WORKFLOW_EXECUTOR` 선례와 동일 패턴이 일관 적용됐다.
- 제안: 현 설계 유지.

---

### [INFO] 단방향 DI 달성 — engine→Retry 역방향 순환 의존성 제거 완료
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (삭제된 `retryTurnService` 주입 + `retryLastTurn` / `applyRetryLastTurn` thin delegator 제거)
- 상세: 이전 구조에서는 `ExecutionEngineService → RetryTurnService` (forwardRef 역방향 주입) + `RetryTurnService → ENGINE_DRIVER(=ExecutionEngineService)` (순방향 주입)으로 쌍방향 순환이 존재했다. 이번 변경으로 엔진에서 `RetryTurnService` 주입을 제거하고 외부 진입점(`WebsocketGateway`, `ContinuationExecutionProcessor`)이 `RetryTurnService`를 직접 호출하도록 재배선해 순환 DI가 단방향 `Retry → ENGINE_DRIVER`로 정리됐다. `AiTurn/Form/Button`은 그래프 순회 중 위임이 필요하므로 forwardRef 양방향이 불가피하게 잔류하는 것도 주석으로 명시돼 있다.
- 제안: 현 설계 유지.

---

### [INFO] ExecutionEventEmitter의 forwardRef 추가 — 단기 처방으로 적절하나 ES-module 순환 근본 원인 잔류
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: `RetryTurnService` import 위치 이동으로 `WebsocketService ↔ WebsocketGateway ↔ ExecutionEventEmitter` ES-module 순환이 짧은 경로로 노출됐고, `@Inject(forwardRef(() => WebsocketService))`로 데코레이터 메타데이터 평가 순서 의존을 해소했다. 동작 불변이고 패턴도 NestJS 표준이다. 그러나 이 순환 자체는 WebsocketService가 이벤트 발행 책임과 라우팅 상태 등록 책임을 함께 갖고 있고 ExecutionEventEmitter가 그 두 책임을 wrapping하는 구조에서 기인한다. `ExecutionEventEmitter` JSDoc에도 "향후 비-WS 채널 추가 시 routing facade로 분리" 가능성이 언급돼 있다.
- 제안: 현재 단계에서는 forwardRef 처방으로 충분하다. 비-WS 채널(Sentry/OTel) 추가 시점에 `registerExecutionRouting` / `releaseExecutionRouting`을 별도 routing facade로 분리하면 이 순환이 자연히 해소된다.

---

### [INFO] ContinuationExecutionProcessor의 의존 서비스 증가 — 향후 케이스 증가 시 dispatcher 패턴 고려 필요
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
- 상세: 프로세서가 이전에는 `ExecutionEngineService`만 의존했으나 이제 `ExecutionEngineService` + `RetryTurnService` 두 서비스를 모두 알아야 한다. retry_last_turn 케이스만 다른 서비스로 dispatch하고 나머지 5개 케이스는 engine으로 dispatch하는 구조다. switch 분기 수가 증가하지는 않았으나 의존 서비스가 늘었다. continuation job 타입이 더 증가하면 프로세서가 여러 도메인 서비스를 알아야 하는 팬아웃 허브가 될 수 있다.
- 제안: 현재 규모에서는 허용 범위다. 향후 continuation job 타입이 5개를 초과하거나 새 서비스 직접 주입이 추가된다면 별도 dispatcher/router 레이어나 타입별 handler registry 패턴 도입을 고려한다.

---

### [INFO] 모듈 exports에 RetryTurnService 추가 — 캡슐화 약화와 순환 DI 제거의 tradeoff
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts`
- 상세: `RetryTurnService`를 `exports`에 추가해 `WebsocketModule`과 `ContinuationExecutionProcessor`가 직접 접근하도록 했다. 이전에는 엔진의 public 표면(thin delegator)을 통해 접근했으므로 내부 서비스가 외부에 노출되지 않았다. 엔진 내부 서비스가 모듈 경계를 넘어 노출되는 것은 캡슐화 관점에서 약화이나, 순환 DI 제거라는 명확한 기술적 동기가 있고 thin delegator를 유지하는 것이 오히려 dead code 증가 문제를 만들었으므로 선택은 합리적이다.
- 제안: INFO 수준. 장기적으로 retry 진입점을 독립 facade 또는 별도 `RetryModule`로 분리하면 모듈 경계를 회복할 수 있다. 현재 strangler-fig 진행 중에는 허용 가능한 tradeoff다.

---

### [INFO] WebsocketGateway의 의존 서비스 증가 — SRP 관점 주의 지점
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: `WebsocketGateway`가 이미 `ExecutionEngineService`, `ExecutionsService`, `BackgroundRunsService` 등 다수 서비스를 주입받는 상황에서 `RetryTurnService`가 추가됐다. 게이트웨이가 여러 도메인 서비스의 facade 역할을 하는 구조는 god-class 패턴의 전조일 수 있다.
- 제안: 현재 수준에서는 허용 범위다. 향후 핸들러 메서드 수가 증가하면 도메인별 sub-gateway 또는 command handler 패턴으로 분리를 고려한다.

---

## 요약

이번 변경(C-1 후속 ④)은 god-class `ExecutionEngineService` 분해 strangler-fig의 ISP 완성 단계로서 아키텍처 관점에서 전반적으로 올바른 방향이다. 단일 12-멤버 `EngineDriver`를 소비자별 부분 인터페이스(`InteractionEngineDriver` / `AiTurnEngineDriver` / `RetryEngineDriver`)로 분해해 각 서비스가 실제 사용하는 표면만 컴파일 타임에 노출하는 ISP 원칙을 충실히 구현했고, 엔진→Retry 역방향 순환 DI를 제거해 단방향 의존성 그래프를 달성했다. `forwardRef`가 불가피한 ES-module 순환은 명시적으로 격리되고 주석으로 설명돼 있다. INFO 항목들은 모두 비차단이며 현재 단계의 strangler-fig 진행 맥락에서 허용 가능한 tradeoff다.

## 위험도

NONE
