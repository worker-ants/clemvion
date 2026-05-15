## 동시성 코드 리뷰 결과

### 발견사항

---

**[WARNING] `handleMouseUp`에서 stale closure로 인한 잘못된 높이 저장**
- 위치: `run-results-drawer.tsx` — `handleMouseUp` 내 `localStorage.setItem(STORAGE_KEY, String(panelHeight))`
- 상세: `useEffect`의 dependency array에 `panelHeight`가 포함되어 있지만, `handleMouseUp`이 캡처하는 `panelHeight`는 드래그 시작 시점의 값입니다. `handleMouseMove`는 `setPanelHeight`로 상태를 업데이트하지만, 동일 effect 클로저 내의 `handleMouseUp`은 최신 `panelHeight` 상태를 읽지 못하고 이전 값을 저장할 수 있습니다. 드래그 중 `panelHeight`가 변경되면 effect가 재등록되지만, 빠른 드래그 동작 중에는 여전히 stale 값을 캡처할 수 있습니다.
- 제안: `startHeight`처럼 `ref`를 사용하거나, `handleMouseUp`에서 `panelHeight` 대신 현재 DOM 높이를 직접 읽도록 수정:
  ```ts
  const currentHeightRef = useRef(panelHeight);
  // handleMouseMove에서:
  currentHeightRef.current = newHeight;
  setPanelHeight(newHeight);
  // handleMouseUp에서:
  localStorage.setItem(STORAGE_KEY, String(currentHeightRef.current));
  ```

---

**[WARNING] WebSocket 이벤트 핸들러의 이중 등록 위험**
- 위치: `use-execution-events.ts` — `useEffect` 내 `client.on(...)` 블록
- 상세: `handleNodeStarted`, `handleNodeCompleted`, `handleNodeFailed`, `handleNodeSkipped`가 `useCallback`으로 메모이제이션되어 있지만, 이들의 dependency(`updateNodeStatus`, `addNodeResult`)가 변경되면 새로운 함수 참조가 생성됩니다. `useEffect`의 cleanup에서 `client.off()`가 이전 참조로 제거되는데, 만약 렌더링 사이클 간에 참조가 바뀌면 이전 핸들러가 제거되지 않은 채로 새 핸들러가 추가되어 동일 이벤트에 대해 중복 처리가 발생할 수 있습니다. 단, Zustand 액션은 안정적 참조를 갖는 경향이 있으므로 실제 발생 가능성은 낮습니다.
- 제안: `useCallback` dependency를 `useRef`로 래핑하거나, 핸들러들을 effect 내부에서 직접 정의하여 항상 최신 참조를 cleanup에서 사용하도록 보장.

---

**[WARNING] `addNodeResult` 의 `node.started` → `node.completed` 순서 보장 없음**
- 위치: `use-execution-events.ts` — `handleNodeStarted` / `handleNodeCompleted`
- 상세: WS 이벤트는 네트워크를 통해 순서가 역전될 수 있습니다. `node.completed`가 `node.started`보다 먼저 도착하면, `addNodeResult`는 먼저 `completed` 상태로 항목을 추가하고, 이후 `started` 이벤트가 `running` 상태로 덮어씁니다. `addNodeResult`의 upsert 로직이 `running`으로 덮어쓰기 때문에 UI에 완료된 노드가 영구적으로 "Running" 상태로 표시될 수 있습니다.
- 제안: status 우선순위를 비교하는 로직 추가:
  ```ts
  const STATUS_PRIORITY = { pending: 0, running: 1, skipped: 2, completed: 3, failed: 3, waiting_for_input: 2 };
  // upsert 시: 기존 status priority >= 새 status priority이면 status 유지
  ```

---

**[INFO] `relations: ['node']` 추가로 인한 N+1 쿼리 잠재 위험**
- 위치: `executions.service.ts` — `nodeExecutionRepository.find({ relations: ['node'] })`
- 상세: 동시성 문제는 아니지만, 다수의 동시 요청이 발생할 때 각 요청마다 JOIN 없이 node relation을 lazy하게 로드하면 DB 커넥션 풀을 빠르게 소진할 수 있습니다. TypeORM이 `find` + `relations`를 사용할 경우 보통 JOIN으로 처리하므로 문제가 없으나, entity 설정에 따라 다를 수 있습니다.
- 제안: 실행 시 `QueryBuilder`와 `leftJoinAndSelect`로 단일 쿼리 보장을 명시적으로 확인.

---

**[INFO] `ResultTimeline`의 자동 선택 effect와 외부 선택 충돌**
- 위치: `result-timeline.tsx` — "Auto-select first result if nothing selected" `useEffect`
- 상세: `RunResultsDrawer`에서 `waitingNodeId` 변경 시 `selectResultNode(waitingNodeId)`를 호출하고, 동시에 `ResultTimeline` 내부에서도 `selectedId`가 없으면 첫 번째 노드를 선택하는 effect가 동작합니다. React의 batched state update 덕분에 직접적인 race condition은 발생하지 않으나, 이벤트 순서에 따라 form 노드 자동 선택이 첫 번째 노드로 덮어써질 수 있습니다.
- 제안: 두 선택 로직의 우선순위를 명확히 정의 (예: `waitingNodeId` 선택을 최우선으로 보장).

---

### 요약

이번 변경사항은 WebSocket 이벤트 기반의 단일 스레드 JavaScript 환경(브라우저 + Node.js)에서 동작하므로 전통적인 멀티스레드 동시성 문제(deadlock, mutex 등)는 해당되지 않습니다. 그러나 React의 비동기 렌더링과 WebSocket 이벤트의 비결정적 도달 순서로 인한 **stale closure 문제**(드래그 높이 저장 버그)와 **이벤트 순서 역전에 따른 status 덮어쓰기 버그**가 실제 발생 가능한 위험 요소입니다. WS 이벤트 핸들러 중복 등록 가능성도 낮지 않으므로 주의가 필요합니다. 전반적으로 Zustand의 원자적 상태 업데이트 사용이 일관되고, useRef를 통한 드래그 상태 관리는 적절합니다.

### 위험도

**MEDIUM**