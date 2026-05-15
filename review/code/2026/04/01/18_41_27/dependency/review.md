## 의존성 코드 리뷰

### 발견사항

---

**[WARNING] 순환 의존성 해결을 위한 `forwardRef` 남용**
- 위치: `execution-engine.module.ts`, `websocket.module.ts`, `execution-engine.service.ts`, `websocket.gateway.ts`
- 상세: `ExecutionEngineModule ↔ WebsocketModule` 간 양방향 의존성이 형성되어 `forwardRef`로 해결하고 있음. 이는 근본적인 설계 문제의 임시 방편이다. `WebsocketGateway`가 `ExecutionEngineService`를 직접 의존하는 구조는 아키텍처 레이어 위반에 해당한다 (WebSocket 계층이 실행 엔진 계층을 알아야 하는 이유 없음).
- 제안: `ExecutionEngineService`에서 Form 제출 콜백을 처리하는 이벤트 버스(Event Emitter) 패턴 도입, 또는 `WebsocketGateway`의 `handleSubmitForm`을 별도 컨트롤러(`POST /executions/:id/continue`)로만 처리하여 순환 참조 자체를 제거.

---

**[WARNING] `ExecutionEngineService`를 `ExecutionsController`에 직접 주입**
- 위치: `executions.controller.ts`, `executions.module.ts`
- 상세: `ExecutionsModule`이 `ExecutionEngineModule`을 import하여 `ExecutionEngineService`를 컨트롤러에 직접 주입하고 있다. 이로 인해 `ExecutionsModule`이 `ExecutionEngineModule`에 대한 새로운 의존성을 갖게 되었고, 모듈 간 결합도가 높아졌다. `ExecutionEngineService.continueExecution()`의 에러 처리(`throw`)가 컨트롤러에서 처리되지 않아 500 에러가 발생할 수 있다.
- 제안: `ExecutionsService.continueExecution()`을 통해 간접 호출하거나, `@Post(':id/continue')` 엔드포인트를 `execution-engine` 관련 컨트롤러로 분리. 또는 에러를 `HttpException`으로 변환하는 처리 추가.

---

**[INFO] `pendingContinuations` Map의 메모리 누수 가능성**
- 위치: `execution-engine.service.ts` - `pendingContinuations`
- 상세: 외부 라이브러리 의존성은 아니지만, `finally` 블록에서 `pendingContinuations.delete(executionId)`를 호출하나 서버 재시작 없이 오랜 시간 실행 중 대기 중인 execution이 많을 경우 Map 항목이 누적될 수 있다. 현재는 `finally`에서 삭제하므로 정상 케이스는 괜찮으나, 서버 크래시 시 정리되지 않는다.
- 제안: 인메모리 상태이므로 분산 환경(다중 인스턴스) 배포 불가. 이를 문서화하거나 Redis 등 외부 상태 저장소 도입 검토.

---

**[INFO] 새로운 외부 패키지 의존성 없음 — 긍정적**
- 위치: 전체 변경사항
- 상세: 모든 변경사항이 기존 NestJS 내장 기능(`forwardRef`, `@Inject`), 기존 TypeORM, 기존 Zustand, Socket.IO를 활용하고 있다. 신규 외부 패키지 추가 없음.

---

**[INFO] `WsClient` 인터페이스에 `emit` 추가**
- 위치: `ws-client.ts`
- 상세: `getWsClient().emit()` 호출이 `run-results-drawer.tsx`에서 직접 사용됨. WebSocket 연결이 없을 때(`socket`이 null) 조용히 실패(`socket?.emit`)하는데, UI에서 폼 제출 후 성공 여부를 확인할 수 없다.
- 제안: `emit` 반환값을 통해 연결 상태를 확인하거나, `isConnected()` 체크 후 미연결 시 사용자에게 피드백 제공.

---

**[INFO] `use-execution-events.ts`의 `useEffect` 의존성 배열 과다**
- 위치: `use-execution-events.ts` - useEffect deps 배열
- 상세: `updateNodeStatus`, `addNodeResult`, `completeExecution` 등 Zustand store 액션들이 deps 배열에 포함되어 있다. Zustand 액션은 참조 안정성이 보장되므로 deps 배열에 포함할 필요 없어 불필요한 effect 재실행 위험이 있다. 외부 라이브러리 의존성 문제는 아니나 Zustand API 사용 패턴 미준수.
- 제안: store 액션들을 `useCallback` 밖에서 `useExecutionStore.getState().action` 방식으로 직접 호출하거나, deps에서 제거.

---

### 요약

이번 변경사항은 신규 외부 패키지를 도입하지 않고 기존 NestJS, TypeORM, Zustand, Socket.IO 스택을 활용하여 Form 노드 blocking 기능을 구현한 점은 의존성 관점에서 긍정적이다. 그러나 `ExecutionEngineModule ↔ WebsocketModule` 간 양방향 순환 의존성이 `forwardRef`로 해결된 것은 아키텍처 레이어 경계 위반의 신호로, 향후 유지보수 시 복잡도가 증가할 수 있다. 또한 `pendingContinuations` 인메모리 Map은 단일 서버 환경에서만 동작하므로 수평 확장이 불가능하다는 제약이 명시되어야 한다. 전반적으로 의존성 위험도는 낮으나 구조적 결합도 문제는 조기에 해결하는 것이 권장된다.

### 위험도

**LOW**