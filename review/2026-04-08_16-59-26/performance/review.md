## 성능 코드 리뷰

### 발견사항

---

**[WARNING]** `isCompletedConversation` 조건에서 매 렌더마다 배열 필터링 및 매핑 수행
- 위치: `result-detail.tsx` — `isCompletedConversation` 조건 내 `conversationMessages` 인라인 파싱
- 상세: `isCompletedConversation` 분기에서 `filter().map()`이 props로 전달되며, 렌더 시마다 새 배열을 생성. `result`나 `outputData`가 변경되지 않아도 부모 컴포넌트 리렌더 시 매번 재계산됨
- 제안: `useMemo`로 메모이제이션하거나 상위 컴포넌트에서 미리 계산해 props로 내려보내기

```tsx
const historyMessages = useMemo(() => {
  if (!isCompletedConversation) return [];
  return (messages as Array<{role: string; content: string}>)
    .filter(m => m.role === "user" || m.role === "assistant")
    .map((m, i) => ({ type: m.role as "user"|"assistant", content: m.content, turnIndex: Math.floor(i/2)+1 }));
}, [isCompletedConversation, result.outputData]);
```

---

**[WARNING]** `getHistoryMessages`가 `useCallback`이지만 렌더마다 동일한 결과 재계산
- 위치: `result-timeline.tsx:getHistoryMessages`
- 상세: `useCallback([], [])` 의존성이 비어있어 함수 참조는 안정적이나, 호출 시마다 `filter().map()`으로 새 배열 생성. `results.map()` 내부에서 모든 노드에 대해 매 렌더마다 실행됨. 히스토리 메시지가 많을수록 비용 증가
- 제안: `useMemo`를 사용해 결과를 nodeId → messages 맵으로 사전 계산

```tsx
const historyMessagesMap = useMemo(() => {
  const map = new Map<string, ConversationItem[]>();
  for (const result of results) {
    if (isMultiTurnAgent(result)) {
      // 계산 로직
      map.set(result.nodeId, parsedMessages);
    }
  }
  return map;
}, [results]);
```

---

**[WARNING]** `isLiveNode` 선언 전에 `isExpanded`가 `isLiveNode`를 참조
- 위치: `result-timeline.tsx:130-135`
- 상세: `const isExpanded = isLiveNode || ...` 가 `const isLiveNode = ...` 보다 앞에 선언됨. JavaScript hoisting으로 `let/const`는 TDZ(Temporal Dead Zone)에 의해 `isLiveNode`가 `undefined`로 평가될 수 있음. 런타임 오류 가능성
- 제안: `isLiveNode` 선언을 `isExpanded` 앞으로 이동

---

**[WARNING]** `handleSendMessage`의 의존성 배열에 `conversationMessages` 배열 전체 포함
- 위치: `run-results-drawer.tsx:handleSendMessage`
- 상세: `conversationMessages` 배열이 의존성에 포함되어 있어 메시지가 추가될 때마다 `handleSendMessage` 함수가 재생성됨. 이 함수가 `ResultDetail`에 props로 전달되므로 연쇄 리렌더 유발
- 제안: 배열 전체 대신 길이만 의존성으로 사용하거나, `addConversationMessage` 내부에서 `set((state) => ...)` 패턴을 활용해 외부 상태 참조 제거

```tsx
const handleSendMessage = useCallback(
  (message: string) => {
    addConversationMessage({
      type: "user",
      content: message,
      turnIndex: useExecutionStore.getState().conversationMessages
        .filter(m => m.type === "user").length + 1,
    });
    setWaitingAiResponse(true);
  },
  [addConversationMessage, setWaitingAiResponse],
);
```

---

**[WARNING]** `run-results-drawer.tsx`에서 다수의 개별 `useExecutionStore` 구독
- 위치: `run-results-drawer.tsx:66-100`
- 상세: 10개 이상의 개별 셀렉터로 스토어를 구독. 각 상태 슬라이스가 변경될 때마다 해당 컴포넌트 리렌더가 트리거됨. `conversationMessages`처럼 자주 변경되는 상태가 전체 컴포넌트를 리렌더시킴
- 제안: 관련 상태를 그룹핑하거나 `zustand`의 `shallow` 비교를 사용

```tsx
const { conversationMessages, isWaitingAiResponse } = useExecutionStore(
  useShallow(s => ({ conversationMessages: s.conversationMessages, isWaitingAiResponse: s.isWaitingAiResponse }))
);
```

---

**[INFO]** `SummaryView`에서 `conversationMessages.filter()` 렌더마다 재계산
- 위치: `conversation-inspector.tsx:SummaryView`
- 상세: `conversationMessages.filter(m => m.type === "user").length`가 렌더마다 O(n) 순회. 대화 턴 수가 많을 경우 누적 비용 발생
- 제안: `conversationConfig`에서 `turnCount`가 이미 제공되므로 `config?.turnCount`를 우선 사용하고 filter는 fallback으로만 사용 (현재 코드가 이미 `??`로 처리 중이나, 좌측 표현식이 먼저 평가됨)

---

**[INFO]** `[...conversationMessages].reverse().find()` — 불필요한 배열 복사
- 위치: `conversation-inspector.tsx:SummaryView`
- 상세: `reverse()`는 원본 배열 변형을 방지하기 위해 스프레드로 복사 후 호출. 메시지 수가 많을 경우 불필요한 메모리 할당
- 제안: `findLast` 사용 (ES2023, 대부분의 최신 환경 지원)

```tsx
const lastAssistant = conversationMessages.findLast(m => m.type === "assistant");
```

---

**[INFO]** `isMultiTurnAgent` 헬퍼 함수가 렌더마다 모든 노드에 대해 호출
- 위치: `result-timeline.tsx:isMultiTurnAgent`
- 상세: 순수 함수이나 `results.map()` 내에서 매 렌더마다 모든 노드에 대해 `outputData` 캐스팅 및 옵셔널 체이닝 수행. 노드 수가 많을 경우 누적 비용
- 제안: `useMemo`로 결과를 Set으로 캐싱

---

### 요약

전반적으로 구조는 양호하나, 두 가지 주요 성능 패턴 문제가 있다. 첫째, `result-detail.tsx`와 `result-timeline.tsx`에서 렌더 함수 본문 내 배열 변환(`filter/map`)이 메모이제이션 없이 반복 수행되어 불필요한 객체 생성이 발생한다. 둘째, `run-results-drawer.tsx`에서 `handleSendMessage`의 의존성 배열에 `conversationMessages` 전체가 포함되어 메시지 추가 시마다 함수 참조가 갱신되고 하위 컴포넌트 리렌더를 연쇄 유발한다. `isLiveNode` 선언 순서 버그는 런타임 오류 가능성이 있어 즉시 수정이 필요하다.

### 위험도

**MEDIUM**