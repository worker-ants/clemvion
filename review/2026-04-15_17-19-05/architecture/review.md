### 발견사항

---

**[WARNING] WebsocketGateway의 단일 책임 원칙(SRP) 위반**
- 위치: `websocket.gateway.ts` — `handleSubscribe()` + `emitExecutionSnapshot()`
- 상세: Gateway는 본래 WebSocket 연결/메시지 라우팅 책임만 가져야 하지만, 이번 변경으로 `ExecutionsService`를 직접 의존하여 실행 스냅샷 조회 및 직렬화 로직까지 담당하게 됨. 구독 이벤트 핸들러(`handleSubscribe`)가 I/O(DB 조회)를 fire-and-forget(`void`)으로 유발하고 있어 사이드이펙트 추론이 어려워짐.
- 제안: 스냅샷 조회·직렬화 책임을 `WebsocketService`로 이동하거나, `ExecutionSnapshotService` 같은 전용 서비스로 분리. Gateway는 `websocketService.emitSnapshot(client, executionId)` 한 줄만 호출하도록 위임.

---

**[WARNING] forwardRef 남용으로 인한 순환 의존성 은폐**
- 위치: `websocket.module.ts`, `websocket.gateway.ts`
- 상세: 이미 `ExecutionEngineModule`에 `forwardRef`가 사용 중인 상황에서 `ExecutionsModule`까지 `forwardRef`로 추가됨. `forwardRef`는 순환 의존성 해소 수단이지만, 실제 순환이 없는 단방향 의존(`WebsocketModule → ExecutionsModule`)에도 적용되어 있음. 이는 실제 순환이 없음에도 불필요한 복잡도를 추가하고, 진짜 순환이 생겼을 때 탐지를 어렵게 함.
- 제안: `ExecutionsModule`이 `WebsocketModule`을 참조하지 않는다면 `forwardRef` 없이 일반 `imports: [ExecutionsModule]`로 교체. 순환 의존성 그래프를 명시적으로 문서화.

---

**[WARNING] 레이어 경계 침범 — Gateway가 도메인 데이터 직접 노출**
- 위치: `websocket.gateway.ts:emitExecutionSnapshot()`
- 상세: `executionsService.findById()`의 반환값이 가공 없이 `client.emit('execution.snapshot', { execution: snapshot })`으로 직접 전송됨. 이는 도메인 레이어의 내부 Entity 구조가 WebSocket 페이로드 계약(contract)으로 그대로 노출되는 구조. 향후 Entity 변경이 클라이언트 프로토콜 변경을 강제함.
- 제안: 전용 DTO/Presenter(예: `ExecutionSnapshotDto`)를 통해 직렬화를 명시적으로 제어. REST API에 이미 응답 DTO가 있다면 동일 DTO 재사용.

---

**[INFO] `handleSnapshot` 함수의 클로저 스코프 과부하**
- 위치: `use-execution-events.ts` — `handleSnapshot` (useEffect 내부 정의)
- 상세: `handleSnapshot`이 `useEffect` 내부에 인라인 함수로 정의되어 다수의 store 액션(`updateNodeStatus`, `addNodeResult`, `completeExecution`, `failExecution`, `pauseForForm` 등)을 클로저로 캡처함. 폴링 로직을 WS 이벤트로 이전하는 과정에서 기존 `pollExecutionStatus` 함수의 구조를 그대로 이동한 결과이며, 다른 핸들러들이 `useCallback`으로 안정화된 것과 달리 이 함수만 `useEffect` 의존성 배열 외부에서 메모이즈되지 않음.
- 제안: `handleSnapshot`을 다른 핸들러처럼 `useCallback`으로 추출하여 `useEffect` 의존성 배열에 명시적으로 포함시키거나, 스냅샷 처리 로직을 store 액션으로 캡슐화(`applyExecutionSnapshot(execution)`).

---

**[INFO] 백엔드-프론트엔드 이벤트 계약의 타입 안전성 부재**
- 위치: `use-execution-events.ts`, `websocket.service.ts`
- 상세: `ExecutionEventType.EXECUTION_SNAPSHOT` enum이 추가되었으나, 실제 emit은 Gateway에서 직접 문자열 `'execution.snapshot'`으로 호출되어 enum과 실제 사용이 분리됨. 프론트엔드는 `unknown`으로 수신 후 as-cast로 처리. 이벤트 페이로드 구조가 공유 타입 없이 양측에 암묵적으로 복제됨.
- 제안: 백엔드-프론트엔드 공유 타입 패키지(예: `packages/shared-types`) 도입이 장기적으로 유효하나, 단기적으로는 `WebsocketService.emitExecutionSnapshot()`을 통해 emit을 중앙화하여 enum 사용을 강제.

---

### 요약

이번 변경의 핵심 방향인 **REST 폴링 → WS 스냅샷 이벤트로 전환**은 네트워크 요청 감소와 실시간성 향상이라는 명확한 아키텍처 이점을 가지며 전반적으로 올바른 방향이다. 다만 이 과정에서 `WebsocketGateway`가 `ExecutionsService`를 직접 의존하게 되어 Gateway 레이어에 도메인 조회 책임이 혼입되었고, `forwardRef`의 과잉 사용으로 모듈 의존성 그래프의 명시성이 저하되었다. 프론트엔드에서는 스냅샷 처리 로직이 `useEffect` 내 인라인 클로저로 고착되어 다른 핸들러들과 구조적 일관성이 깨졌다. 기능 정확성에 대한 위험도는 낮으나, 모듈 경계 명확성과 레이어 분리 원칙 측면에서 리팩터링이 권장된다.

### 위험도

**LOW**