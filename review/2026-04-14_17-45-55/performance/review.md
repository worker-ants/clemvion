## 성능 코드 리뷰

### 발견사항

---

**[WARNING] `useExecutionStore` 셀렉터 과분할 — 불필요한 다중 구독**
- 위치: `page.tsx:318~362`, `run-results-drawer.tsx:90~130`
- 상세: `NodeResultsTab`에서 스토어 셀렉터를 9개로 분리 호출하고 있음. Zustand는 각 셀렉터마다 별도 구독을 생성하므로, 관련 필드가 동시에 업데이트될 때 9번의 독립적인 리렌더 트리거가 발생할 수 있음. `run-results-drawer.tsx`도 동일 패턴으로 12개 이상의 셀렉터를 분리.
- 제안: 관련 있는 waiting 상태를 하나의 셀렉터로 묶어 객체로 반환하거나, `useShallow`를 활용해 shallow compare로 묶어 구독 횟수를 줄임.

```ts
// Before (9 subscriptions)
const waitingNodeId = useExecutionStore((s) => s.waitingNodeId);
const waitingInteractionType = useExecutionStore((s) => s.waitingInteractionType);
// ...

// After (1 subscription, shallow compare)
import { useShallow } from 'zustand/react/shallow';
const waitingState = useExecutionStore(useShallow((s) => ({
  waitingNodeId: s.waitingNodeId,
  waitingInteractionType: s.waitingInteractionType,
  waitingFormConfig: s.waitingFormConfig,
  waitingButtonConfig: s.waitingButtonConfig,
  waitingConversationConfig: s.waitingConversationConfig,
  conversationMessages: s.conversationMessages,
  isWaitingAiResponse: s.isWaitingAiResponse,
})));
```

---

**[WARNING] 렌더 중 상태 변경 — React 동시성 모드 위험**
- 위치: `page.tsx:355~360`
- 상세: 렌더 함수 본문에서 직접 `setState` 호출 (`setLastAutoSelectedWaiting`, `setSelectedNodeId`, `setNodeDetailTab`)이 발생함. React 18 동시성 모드에서 렌더는 여러 번 실행될 수 있으므로 중복 상태 변경이 반복되어 불필요한 리렌더를 유발함.

```ts
// 현재: 렌더 중 직접 setState (위험)
if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
  setLastAutoSelectedWaiting(waitingNodeId);
  setSelectedNodeId(waitingNodeId);
  setNodeDetailTab("preview");
}
```

- 제안: `useEffect`로 이동하여 렌더 완료 후 한 번만 실행되도록 변경.

```ts
useEffect(() => {
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setNodeDetailTab("preview");
  }
}, [waitingNodeId, lastAutoSelectedWaiting]);
```

---

**[WARNING] `adjacentQuery` 에서 100개 execution 전체 조회**
- 위치: `page.tsx:108~127`
- 상세: 이전/다음 네비게이션을 위해 `limit: 100`으로 전체 목록을 가져와 클라이언트에서 index 탐색. execution이 많을수록 전송 데이터와 파싱 비용이 증가하며, 현재 execution이 100번째 이후라면 네비게이션이 아예 동작하지 않음.
- 제안: 백엔드에서 `adjacent` 전용 엔드포인트(`/executions/:id/adjacent`)를 제공하거나, cursor 기반으로 현재 id 전후 2개만 조회.

---

**[WARNING] `refetchInterval` 콜백 내 매 tick마다 새 함수 생성**
- 위치: `page.tsx:99~106`
- 상세: `refetchInterval`에 인라인 arrow function이 전달되어, React Query 내부에서 interval 체크 시마다 새 함수 참조가 생성됨. 현재 구현은 부수효과가 없어 큰 문제는 아니지만, `useCallback`으로 안정적인 참조를 유지하는 것이 바람직함.
- 제안:
```ts
const refetchInterval = useCallback((query: Query<ExecutionData>) => {
  const status = query.state.data?.status;
  return status && !["completed", "failed", "cancelled"].includes(status) ? 2000 : false;
}, []);
```

---

**[INFO] `useExecutionInteractionCommands` 내 매 렌더마다 스토어 상태 직접 접근**
- 위치: `use-execution-interaction-commands.ts:47`
- 상세: `sendMessage`의 `useCallback` 내에서 `useExecutionStore.getState()`를 직접 호출하여 현재 값을 읽음. 이는 클로저 stale 문제를 회피하기 위한 올바른 패턴이나, `conversationMessages` 셀렉터 구독도 병행하고 있어 이중 참조가 발생함. 셀렉터 구독(`addConversationMessage`, `setWaitingAiResponse`)은 유지하되 `conversationMessages`는 `getState()`로만 읽는 것으로 통일하는 것이 더 명확함.
- 제안: 이미 `getState()`로 읽고 있으므로 `conversationMessages` 셀렉터 구독은 제거 가능 (현재 코드에는 없어 이미 올바름 — 확인 완료).

---

**[INFO] `package-lock.json`의 `peer` 플래그 조정 — 런타임 영향 없음**
- 위치: `package-lock.json` 전체
- 상세: `react`, `react-dom`, `react-hook-form`, `zod`, `immer`, `redux` 등 핵심 런타임 패키지의 `peer: true` 플래그가 제거됨. 이는 npm lock 파일의 메타데이터 변경이며 번들 크기나 런타임 성능에 직접적인 영향 없음. `@emnapi/core`, `@emnapi/runtime` 추가는 WebAssembly 스레딩 관련 optional 패키지로, 실제 사용 시에만 로드됨.

---

### 요약

이번 변경의 핵심은 `waiting_for_input` 상태를 실행 이력 페이지에서도 처리할 수 있도록 WebSocket 명령 로직을 `useExecutionInteractionCommands` 훅으로 추출하여 재사용성을 높인 것으로, 구조 개선 측면에서 방향성은 좋음. 다만 성능 관점에서는 두 가지 주요 문제가 있음: `NodeResultsTab`에서 9개의 분리된 Zustand 셀렉터로 인한 다중 구독과, 렌더 함수 본문 내 직접 `setState` 호출이 React 18 동시성 모드와 충돌할 위험. `adjacentQuery`의 `limit: 100` 전체 조회는 데이터 규모가 커질수록 불필요한 페이로드 비용이 증가하므로 백엔드 최적화가 권장됨. `package-lock.json` 변경은 성능에 영향 없음.

### 위험도

**MEDIUM**