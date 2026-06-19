# 성능(Performance) 리뷰 결과

리뷰 대상: C-1 후속 ④ — EngineDriver ISP 부분인터페이스 분할 + engine→Retry 순환 DI 제거

---

## 발견사항

### [INFO] `forwardRef` 추가 — 극소 런타임 오버헤드 (비차단)
- 위치: `execution-event-emitter.service.ts` (파일 6), `websocket.gateway.ts` (파일 13)
- 상세: `ExecutionEventEmitter` 에 `@Inject(forwardRef(() => WebsocketService))` 가 추가되고, `WebsocketGateway` 에 `@Inject(forwardRef(() => RetryTurnService))` 가 추가됐다. NestJS `forwardRef` 는 모듈 초기화 시 lazy proxy 객체를 생성하며, 이후 모든 메서드 호출에 proxy 디스패치 한 단계가 더 추가된다. 런타임 비용은 무시할 수 있는 수준(메서드 호출당 단일 프록시 dereference)이고, 순환 DI 해소가 목적이므로 트레이드오프가 정당하다.
- 제안: `WebsocketGateway → RetryTurnService` 방향이 단방향(순환 없음)이라면 `forwardRef` 없이 직접 주입으로 단순화 가능하나, ES-module 평가 순서 문제를 방어하려는 의도가 주석에 명시돼 있으므로 현 상태 유지도 합리적이다.

### [INFO] `contextKeyOf` 호출 이중 반복 — 단순 필드 읽기이지만 지역 변수 캐싱 권장
- 위치: `form-interaction.service.ts` (파일 10), `processFormResumeTurn` 메서드 내 `setStructuredOutput` / `setNodeOutput` 연속 호출 구간
- 상세: `this.driver.contextKeyOf(context)` 가 두 줄 연속으로 별도 호출된다. `contextKeyOf` 는 `context.bgKey ?? context.executionId` 수준의 단순 읽기이므로 실비용은 없다. 이번 ISP 분할로 `contextKeyOf` 가 `CoreEngineDriver` 에 정의돼 모든 소비 인터페이스에서 공유되는 점은 올바르다. 성능보다 가독성 개선 차원에서 로컬 변수 캐싱을 권장한다.
- 제안: `const contextKey = this.driver.contextKeyOf(context);` 로 한 번만 호출하고 두 곳에서 재사용.

### [INFO] `EngineDriver` ISP 분할 자체 — 런타임 오버헤드 없음 (컴파일 타임 전용)
- 위치: `engine-driver.interface.ts` (파일 5)
- 상세: `EngineDriver` 를 `CoreEngineDriver` / `InteractionEngineDriver` / `ReentryStateDriver` / `AiTurnEngineDriver` / `RetryEngineDriver` 로 분해한 것은 TypeScript 타입 전용 변경이다. 런타임에는 여전히 동일한 `ExecutionEngineService` 인스턴스가 `useExisting` 으로 바인딩되므로 객체 할당·메서드 디스패치·메모리 사용에 아무런 변화가 없다. 인터페이스 계층 수가 늘어도 JavaScript 런타임에는 소거된다.
- 제안: 없음. 성능 중립 변경.

### [INFO] `RetryTurnService` export 추가 — 싱글톤 재사용이므로 메모리 비용 없음
- 위치: `execution-engine.module.ts` (파일 7)
- 상세: `RetryTurnService` 를 `exports` 배열에 추가했다. NestJS 모듈 exports 는 기존 싱글톤 인스턴스에 대한 참조만 공유하므로 새 인스턴스 생성이 없다. 메모리 오버헤드 없음.
- 제안: 없음.

### [INFO] `retry_last_turn` 경로의 `isNodeExecutionWaiting` DB 조회 생략 — 긍정적 설계
- 위치: `continuation-execution.processor.ts` (파일 4), `type !== 'cancel' && type !== 'retry_last_turn'` 가드
- 상세: `retry_last_turn` 타입은 idempotency guard 의 `isNodeExecutionWaiting` DB SELECT 를 명시적으로 건너뛴다. 이번 변경 후에도 `RetryTurnService` 로 재배선되면서 동일하게 유지된다. retry 경로에서 불필요한 DB 조회를 하지 않고 `applyRetryLastTurn` 내부 자체 멱등 가드(RUNNING 상태 검증)에 위임하는 것은 올바른 성능 선택이다.
- 제안: 없음. 현행 설계가 올바름.

---

## 요약

이번 변경(C-1 후속 ④)은 순수 리팩터링으로, 런타임 성능에 유의미한 영향을 주지 않는다. `EngineDriver` ISP 분할은 TypeScript 컴파일 타임 전용이며 런타임에 소거된다. `engine→Retry` 순환 DI 제거로 `forwardRef` 2개가 추가됐으나 프록시 비용은 무시할 수 있다. `RetryTurnService` 직접 노출로 delegate 체인 1단계가 줄어 미세한 성능 개선 효과가 있다. `form-interaction.service.ts` 의 `contextKeyOf` 이중 호출은 단순 필드 읽기이므로 실질 비용이 없으나 가독성 차원에서 지역 변수로 캐싱을 권장한다. 성능 관점에서 차단이나 긴급 수정이 필요한 항목은 없다.

---

## 위험도

NONE
