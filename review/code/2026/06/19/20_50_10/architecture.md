# Architecture Review

## 발견사항

### [INFO] ISP 적용 — CoreEngineDriver를 공유 베이스로 적절히 계층화
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts`
- 상세: `CoreEngineDriver`(updateExecutionStatus, contextKeyOf) → `InteractionEngineDriver` / `ReentryStateDriver` → `AiTurnEngineDriver` / `RetryEngineDriver` 계층이 인터페이스 상속으로 정렬됐다. 각 소비자는 자신이 실제로 호출하는 표면만 주입받아 인터페이스 분리 원칙을 컴파일 타임에 강제한다. 런타임 바인딩(`ENGINE_DRIVER useExisting: ExecutionEngineService`)은 불변이고 슬라이스 수만큼 DI 토큰이 늘지 않으므로 모듈 복잡도 증가 없이 ISP를 달성한 점이 긍정적이다.
- 제안: 현행 유지. 향후 소비자가 추가될 때 동일 패턴(`extends CoreEngineDriver`)으로 확장 가능한지 확인.

### [INFO] EngineDriver 합성 인터페이스가 다이아몬드 상속을 형성
- 위치: `codebase/backend/src/modules/execution-engine/engine-driver.interface.ts` — `EngineDriver extends AiTurnEngineDriver, RetryEngineDriver`, 두 부모 모두 `CoreEngineDriver` 상속
- 상세: TypeScript 인터페이스 다이아몬드는 런타임 문제가 없고 컴파일러가 멤버를 정상 병합하므로 실용적 위험은 없다. 단, `CoreEngineDriver`의 `contextKeyOf`가 `AiTurnEngineDriver` 경로(InteractionEngineDriver 경유)와 `RetryEngineDriver` 경로 양쪽에서 동일 시그니처로 상속되는 점은 IDE에서 혼란을 유발할 수 있다.
- 제안: `contextKeyOf`가 양 경로에서 중복 상속되는 의도를 JSDoc에 짧게 메모하거나, 컴파일러 경고가 없음을 확인하는 lint 체크 추가.

### [INFO] forwardRef 잔존 — ExecutionEventEmitter↔WebsocketService 간 ES-module 순환
- 위치: `codebase/backend/src/modules/execution-engine/events/execution-event-emitter.service.ts`
- 상세: engine→Retry 역방향 DI 제거로 순환 경로가 노출되어 `forwardRef(() => WebsocketService)`가 새로 추가됐다. NestJS `forwardRef`는 순환 DI의 증상을 숨기는 것이지 해결이 아니다. `ExecutionEventEmitter`가 `WebsocketService`에 강하게 결합된 상태이므로, 향후 비-WS 채널(Sentry/OTel) 추가 시 이 facade가 WebsocketService 이외의 의존성을 추가로 받아 단일 책임이 흔들릴 수 있다. 코드 내 JSDoc("향후 채널 다중화 시 분리")이 이 위험을 이미 인지하고 있다.
- 제안: 단기는 현행 forwardRef 유지. 중기적으로 `WebsocketModule` / `ExecutionEngineModule` 의존 방향을 재검토해 이벤트 발행 경로가 단방향이 되도록 추상화를 고려.

### [INFO] WebsocketGateway에 forwardRef로 RetryTurnService 직접 주입 — 레이어 경계 확인 필요
- 위치: `codebase/backend/src/modules/websocket/websocket.gateway.ts`
- 상세: `WebsocketGateway`(프레젠테이션/전송 레이어)가 `RetryTurnService`(비즈니스 레이어, execution-engine 모듈 소속)를 직접 주입받는다. 기존에는 `ExecutionEngineService` facade를 통해 동일한 역할을 했으나, engine→Retry 순환 DI 제거 후 게이트웨이가 엔진 내부 서비스를 두 개(`ExecutionEngineService` + `RetryTurnService`) 알아야 하는 구조가 됐다. strangler-fig 전환 중 불가피한 중간 상태이나 외부 소비자가 내부 구성을 인지하는 leaky abstraction 위험이 있다.
- 제안: 현행 유지. strangler-fig 완료 후 Gateway가 의존해야 하는 진입점을 단일 public facade로 재집결하는 것을 고려.

### [INFO] ContinuationExecutionProcessor가 두 서비스를 직접 알아야 하는 라우팅 구조
- 위치: `codebase/backend/src/modules/execution-engine/continuation/continuation-execution.processor.ts`
- 상세: `retry_last_turn` 분기만 `RetryTurnService`로 라우팅하고 나머지 5개 분기는 `ExecutionEngineService`로 라우팅하는 switch-case가 하나의 파일에 혼재한다. 이는 god-class 분해 과정의 중간 상태로 의도된 설계이며 exhaustiveness guard가 있어 확장성은 확보된 상태다.
- 제안: 현행 유지. 장기적으로 continuation job의 dispatch를 별도 `ContinuationDispatcher`로 분리해 processor는 큐 소비만 담당하는 구조 검토.

### [INFO] RetryTurnService export가 ExecutionEngineModule 경계를 넓힘
- 위치: `codebase/backend/src/modules/execution-engine/execution-engine.module.ts`
- 상세: `RetryTurnService`를 `exports`에 추가해 외부 모듈(`WebsocketModule`, `ContinuationExecutionProcessor`)이 직접 접근할 수 있게 됐다. 전문 비즈니스 서비스를 직접 export하면 외부 소비자가 엔진 내부 분해 결과에 결합하게 된다. 이는 engine→Retry 순환 DI 제거의 부수 효과이며 단기적으로 불가피하다.
- 제안: 중기적으로 `retryLastTurn` 진입점을 단일 public facade에 재통합해 외부 소비자가 내부 서비스 구성을 몰라도 되도록 캡슐화 회복을 검토.

## 요약

이번 변경은 단일 12-멤버 `EngineDriver` 인터페이스를 소비자별 최소 슬라이스(`CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver`)로 분해하고, engine→Retry 역방향 순환 DI를 제거해 단방향 의존 관계를 확립한 리팩터링이다. ISP 적용은 컴파일 타임 가시성을 소비자별로 명확히 좁혀 계약을 정확히 표현하며, 런타임 바인딩과 동작은 불변이므로 안전성이 높다. 순환 DI 제거는 전반적으로 긍정적이나, 그 결과로 `ExecutionEventEmitter`에 새 `forwardRef`가 추가되고 `WebsocketGateway`·`ContinuationExecutionProcessor`가 두 서비스를 동시에 알아야 하는 구조가 됐다. 이는 strangler-fig 전환 중 불가피한 중간 상태로 허용 가능하지만, 장기적으로 엔진 내부 서비스가 외부에 직접 노출되는 leaky abstraction 위험을 내포한다. 발견된 사항은 모두 INFO 수준이며 현재 아키텍처 방향(god-class 분해 + ISP)은 올바르다.

## 위험도

LOW
