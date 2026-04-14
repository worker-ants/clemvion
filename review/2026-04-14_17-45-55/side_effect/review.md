## 리뷰 결과

### 발견사항

---

**[WARNING] `ResultDetailProps`에서 `onSendMessage` 제거 — breaking interface change**
- 위치: `result-detail.tsx`, `ResultDetailProps` 인터페이스
- 상세: `onSendMessage` prop이 인터페이스에서 제거되고 내부적으로 `useExecutionInteractionCommands`를 통해 처리됩니다. `run-results-drawer.tsx`에서는 이미 제거되었지만, 다른 컴포넌트에서 `ResultDetail`을 직접 사용하면서 `onSendMessage`를 넘기고 있다면 TypeScript 컴파일 오류가 발생합니다. 현재 변경 범위 내에서는 `result-detail.test.tsx`에서 이미 제거된 것이 확인되나, 코드베이스 전체에 대한 추적이 필요합니다.
- 제안: `grep -r "onSendMessage" frontend/src`로 추가 사용처가 없는지 확인하세요.

---

**[WARNING] `NodeResultsTab` 내 렌더 중 상태 변경 (Derived-state anti-pattern)**
- 위치: `page.tsx`, `NodeResultsTab` 함수, 약 350행
- 상세: 렌더 함수 본문에서 `setState`를 직접 호출하는 패턴입니다. React 18에서 이 패턴은 동작하지만, 렌더 중 상태 세터 호출은 즉시 재렌더를 예약하므로 조건이 계속 참일 경우 렌더링 루프 위험이 있습니다. `lastAutoSelectedWaiting`과 `waitingNodeId`가 동기화되어야 루프가 끊기는데, `waitingNodeId`가 외부 스토어에서 비동기로 변경될 경우 짧은 렌더 폭풍이 발생할 수 있습니다.
  ```tsx
  // 현재 코드 (렌더 중 setState)
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setNodeDetailTab("preview");
  }
  ```
- 제안: `useEffect`로 이동하고 `waitingNodeId`를 의존성으로 추가하는 것이 더 안전합니다.

---

**[WARNING] `useExecutionEvents`가 store reset 직후 호출됨 — 레이스 컨디션 가능성**
- 위치: `page.tsx`, `ExecutionDetailPage` 컴포넌트, 약 80~90행
- 상세: `useEffect`로 `resetStore()`를 실행하고, 같은 렌더에서 `useExecutionEvents({ executionId })`가 호출됩니다. `useExecutionEvents`가 초기 마운트 시 즉시 WebSocket 이벤트를 처리하거나 REST를 폴링한다면, reset이 적용되기 전(첫 렌더)에 스토어를 채울 수 있습니다. 이 경우 이전 execution의 stale state가 새 execution에 잠깐 보일 수 있습니다.
- 제안: `useExecutionEvents`가 `executionId` 변경 시 내부적으로 초기화를 수행하는지 확인하거나, `useEffect`의 cleanup에서 reset을 처리하는 방식을 검토하세요.

---

**[INFO] `useExecutionInteractionCommands`에서 `useExecutionStore.getState()` 직접 접근**
- 위치: `use-execution-interaction-commands.ts`, `sendMessage` 콜백
- 상세: `useCallback` 내에서 `useExecutionStore.getState()`를 직접 호출합니다. 이는 React의 subscription 메커니즘을 우회하지만, 콜백 내에서 최신 스냅샷을 읽는 목적으로는 적절합니다. 다만 `addConversationMessage`와 `setWaitingAiResponse`는 이미 selector로 구독 중이므로 getState 호출은 `conversationMessages` 배열의 길이만 읽기 위한 것인데, 이 부분은 안전합니다.
- 제안: 현재 코드는 의도적이며 문제없습니다. 주석 추가로 의도를 명확히 하면 더 좋습니다.

---

**[INFO] `package-lock.json`의 `peer` 플래그 변경 — 설치 동작 차이 없음**
- 위치: `package-lock.json` 전반
- 상세: `peer: true` 플래그의 추가/제거는 npm이 `package-lock.json`을 재생성하면서 발생하는 정상적인 메타데이터 조정입니다. 실제로 설치되는 패키지 버전은 변경되지 않습니다. `@emnapi/core`, `@emnapi/runtime` 추가는 optional 의존성으로 표시되어 있어 기존 빌드에 영향을 주지 않습니다.
- 제안: 이상 없음.

---

**[INFO] `run-results-drawer.tsx`에서 `handleSendMessage` 제거 — 동작 이관**
- 위치: `run-results-drawer.tsx`, 제거된 `handleSendMessage` 핸들러
- 상세: 기존에 drawer에서 직접 `addConversationMessage` + `setWaitingAiResponse`를 호출하던 로직이 `useExecutionInteractionCommands.sendMessage`로 이관되었습니다. 동작 자체는 동일하게 유지되므로 부작용 없음.
- 제안: 이상 없음.

---

### 요약

전체적으로 이번 변경은 WebSocket 인터랙션 명령을 `useExecutionInteractionCommands` 훅으로 중앙화하고, 실행 디테일 페이지에서 waiting 상태를 처리하는 기능을 추가한 리팩터링입니다. `ResultDetailProps`에서 `onSendMessage` 제거는 breaking change이지만 현재 범위 내의 소비자는 모두 업데이트되었습니다. 가장 주목할 부작용 위험은 **렌더 중 상태 세터 호출 패턴** (`NodeResultsTab`)으로, 이론적으로 렌더 루프를 유발할 수 있으며 `useEffect`로 대체하는 것이 React 관례에 부합합니다. `resetStore` → `useExecutionEvents` 순서의 레이스 컨디션도 실제 환경에서 stale state 플리커를 유발할 가능성이 있어 검증이 필요합니다.

### 위험도

**MEDIUM**