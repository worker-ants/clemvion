## 발견사항

### 요약된 변경 의도
REST 폴링(`GET /executions/:id`) 방식을 WebSocket 기반 `execution.snapshot` 이벤트로 대체하고, 노드 이벤트 페이로드에 `input`/`finishedAt`/`interactionData` 필드를 추가하는 단일 기능 변경입니다.

---

### 발견사항

- **[INFO]** `ExecutionEventType.EXECUTION_SNAPSHOT` 열거형 추가
  - 위치: `websocket.service.ts:13`
  - 상세: `WebsocketService`가 이 열거형 값을 직접 사용하지 않고, 게이트웨이에서 문자열 리터럴 `'execution.snapshot'`으로 직접 emit합니다. 열거형 추가는 타입 안전성을 위한 것이나, 실제 활용되지 않는 상태입니다.
  - 제안: `emitExecutionSnapshot`에서 `ExecutionEventType.EXECUTION_SNAPSHOT`을 사용하도록 통일하거나, 현 변경 범위에서는 열거형 추가를 생략해도 무방합니다.

- **[INFO]** `websocket.gateway.spec.ts`의 `findById` 기본값이 `mockRejectedValue`
  - 위치: `websocket.gateway.spec.ts:51-56`
  - 상세: `findById`가 기본적으로 에러를 반환하도록 설정되어 있습니다. 스냅샷 전송 실패 시 게이트웨이가 조용히 무시하는 것을 검증하는 의도로 보이나, 성공 케이스(스냅샷이 정상 emit되는지)에 대한 테스트는 포함되지 않았습니다.
  - 제안: 스냅샷 성공 케이스 테스트를 `handleSubscribe` describe 블록에 추가하는 것을 권장합니다.

- **[INFO]** `use-execution-events.ts`에서 `handleSnapshot`이 `useEffect` 클로저 내부에 인라인 정의
  - 위치: `use-execution-events.ts:504-603`
  - 상세: 다른 핸들러들(`handleNodeStarted`, `handleNodeCompleted` 등)은 `useCallback`으로 외부에 선언된 반면, `handleSnapshot`만 `useEffect` 내부에 인라인 함수로 정의되어 있습니다. 의존성 배열에도 포함되어 있지 않습니다.
  - 제안: 일관성을 위해 `handleSnapshot`도 `useCallback`으로 추출하거나, 현 구조라면 의존성 관계에 문제가 없음을 명시하는 주석이 있으면 좋습니다. 단, 기능적으로는 `cancelledRef`와 클로저 내 store 접근이 올바르게 동작하므로 버그는 없습니다.

---

### 요약

전체 변경사항은 **단일 기능(REST 폴링 → WS 스냅샷 전환)** 에 집중되어 있으며, 범위를 벗어난 리팩토링, 무관한 파일 수정, 불필요한 기능 추가는 없습니다. 백엔드에서 `input`/`finishedAt` 필드를 여러 이벤트 전송 지점에 동시 추가한 것도 스냅샷 기능에서 이미 저장된 이력을 정확히 재현하기 위해 필요한 변경으로 적절합니다. 발견된 사항들은 모두 INFO 수준으로 기능 정확성에 영향을 주지 않습니다.

### 위험도
**LOW**