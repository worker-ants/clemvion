### 발견사항

- **[HIGH]** 전역 싱글턴 스토어의 동시 접근 — 리셋이 다른 소비자를 덮어씀
  - 위치: `page.tsx:80-83` (`useEffect(() => { resetStore(); }, [executionId, resetStore])`)
  - 상세: `useExecutionStore`는 전역 Zustand 싱글턴이다. 실행 상세 페이지가 마운트될 때 `reset()`을 호출하면, 동일 브라우저 탭 내 다른 소비자(예: 편집기의 `RunResultsDrawer`, 혹은 두 개의 탭을 동시에 열어둔 경우)의 대화·폼·버튼 상태가 즉시 소멸된다. 특히 사용자가 실행 목록에서 다른 실행으로 빠르게 전환할 경우, 이전 실행의 스토어 채우기(REST 폴링)와 새 실행의 `reset()` 사이에 경쟁 조건이 발생할 수 있다.
  - 제안: 실행 ID별로 격리된 스토어 인스턴스(예: `createStore` + context)를 사용하거나, `reset()` 대신 `resetForExecution(executionId)` 형태로 현재 실행 ID를 확인 후 조건부 초기화를 수행한다.

---

- **[MEDIUM]** 이중 폴링에 의한 경쟁 조건 — React Query + `useExecutionEvents` REST 폴링
  - 위치: `page.tsx:96-103` (`refetchInterval: 2000`) + `useExecutionEvents({ executionId })`
  - 상세: `executionQuery`의 2초 간격 리패치와 `useExecutionEvents` 내부의 REST 폴링이 병렬로 동작한다. 두 폴링이 거의 동시에 응답을 받을 때, 서로 다른 실행 상태 스냅샷을 스토어에 쓰는 순서가 불확정적이다. 특히 실행이 `waiting_for_input` → `running`으로 전환하는 순간, 한 폴링이 이전 상태를 늦게 반영하면 UI가 이미 재개된 실행을 다시 "대기 중"으로 표시할 수 있다.
  - 제안: 두 폴링 중 하나를 제거하거나, 스토어 업데이트 시 타임스탬프 기반 낙관적 잠금(응답의 `updatedAt`이 현재 스토어보다 최신일 때만 반영)을 적용한다.

---

- **[MEDIUM]** `sendMessage` 낙관적 업데이트 — WebSocket 전송 실패 시 롤백 없음
  - 위치: `use-execution-interaction-commands.ts:46-59`
  - 상세: 사용자 메시지를 스토어에 추가하고(`addConversationMessage`), `isWaitingAiResponse`를 `true`로 설정한 뒤 `getWsClient().emit()`을 호출한다. WebSocket 전송이 실패(연결 끊김, 서버 오류)하더라도 스토어 상태는 복원되지 않아, 실제로 서버에 전달되지 않은 유령 메시지가 UI에 남는다.
  - 제안: `emit`의 ACK 콜백 또는 오류 이벤트를 활용해 실패 시 `conversationMessages`에서 마지막 항목을 제거하고 `isWaitingAiResponse`를 `false`로 되돌리는 롤백 로직을 추가한다.

---

- **[LOW]** 렌더 단계에서의 다중 `setState` 호출 — 불필요한 재렌더 유발 가능
  - 위치: `page.tsx:349-354`
  ```tsx
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setNodeDetailTab("preview");
  }
  ```
  - 상세: 렌더 단계에서 `setState`를 3번 개별 호출한다. React는 이 패턴(render-time derived state)을 공식 지원하지만, React Concurrent Mode에서는 렌더가 여러 번 실행될 수 있어 각 호출이 별도 재렌더를 유발할 위험이 있다. `waitingNodeId`가 빠르게 변경되면 이 블록이 반복 실행되어 잠재적 무한 렌더 루프 또는 예상치 못한 탭 선택 재설정이 발생할 수 있다.
  - 제안: `useEffect`로 옮기거나, 세 상태를 단일 `useReducer`로 통합하여 원자적으로 업데이트한다.

---

- **[INFO]** `package-lock.json` 변경 — 동시성과 무관
  - `peer` 플래그 조정 및 `@emnapi/core`, `@emnapi/runtime` 추가는 패키지 의존성 트리 변경일 뿐이며 런타임 동시성에 영향을 주지 않는다.

---

### 요약

가장 심각한 문제는 전역 Zustand 스토어를 공유하는 구조에서 발생한다. 페이지 마운트 시 `reset()`을 호출하는 패턴은 스토어의 단일 인스턴스가 여러 소비자(편집기 드로어, 상세 페이지)에 의해 동시에 사용될 때 경쟁 조건을 일으킨다. 이중 폴링(React Query + `useExecutionEvents`)은 실행 상태 전환 시점에서 비결정적 스토어 업데이트를 일으킬 수 있으며, `sendMessage`의 낙관적 업데이트는 WebSocket 장애 복구 경로가 없어 UI와 서버 상태의 불일치로 이어질 수 있다. JavaScript의 단일 스레드 특성 덕분에 진정한 의미의 병렬 접근은 없지만, 비동기 이벤트 순서의 불확정성으로 인한 논리적 경쟁 조건은 충분히 발생 가능한 수준이다.

### 위험도
**MEDIUM**