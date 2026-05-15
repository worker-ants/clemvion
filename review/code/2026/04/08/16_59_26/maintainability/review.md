## 유지보수성 코드 리뷰

### 발견사항

---

**[CRITICAL] `isExpanded`가 `isLiveNode` 선언 이전에 참조됨**
- 위치: `result-timeline.tsx`, 렌더링 블록 내
- 상세: `const isExpanded = isLiveNode || ...`가 `const isLiveNode = ...` 보다 앞에 선언되어 있음. JavaScript hoisting으로 `isLiveNode`가 `undefined`로 평가되어 항상 `expanded[result.nodeId] ?? false`만 사용됨 — 라이브 노드가 자동 펼침되지 않는 런타임 버그.
- 제안: 선언 순서를 `isLiveNode` → `isMultiTurn` → `isExpanded` 순으로 변경

---

**[WARNING] `unknown` 타입의 과도한 사용으로 인한 반복적 타입 캐스팅**
- 위치: `result-detail.tsx` (ButtonBar props 블록), `run-results-drawer.tsx`, `conversation-inspector.tsx`
- 상세: `buttonConfig`, `formConfig`, `conversationConfig`가 모두 `unknown`으로 선언되어 컴포넌트 전반에서 `as Record<string, unknown>` 캐스팅이 반복됨. 특히 `result-detail.tsx`의 ButtonBar 렌더링 부분은 5회 이상 중첩 캐스팅이 발생함.
- 제안: `execution-store.ts`에 `ButtonConfig`, `FormConfig`, `ConversationConfig` 인터페이스를 정의하고 store에서부터 타입 적용

---

**[WARNING] 히스토리 메시지 파싱 로직 중복**
- 위치: `result-detail.tsx`의 `isCompletedConversation` 블록, `result-timeline.tsx`의 `getHistoryMessages` 함수
- 상세: `outputData.messages`를 `ConversationItem[]`으로 변환하는 동일한 로직이 두 곳에서 독립적으로 구현됨. 필터 조건(`role === "user" || role === "assistant"`)과 `turnIndex` 계산식(`Math.floor(i / 2) + 1`)이 완전히 동일.
- 제안: `utils.ts`에 `parseHistoryMessages(outputData: unknown): ConversationItem[]` 유틸 함수로 추출

---

**[WARNING] `ResultDetail`의 props 인터페이스가 과도하게 증가**
- 위치: `result-detail.tsx`, `ResultDetailProps` 인터페이스
- 상세: 이번 변경으로 props가 8개 → 15개로 증가. `isWaitingConversation`, `conversationConfig`, `conversationMessages`, `selectedConversationItemIndex`, `isWaitingAiResponse`, `onConversationEnd`, `onSendMessage`가 일괄 추가됨. 대화 관련 props만으로 서브 객체를 구성하면 더 명확함.
- 제안: `conversationProps?: { config, messages, selectedIndex, isWaitingAi, onEnd, onSend }` 형태로 그룹핑

---

**[WARNING] `handleSendMessage`에서 side effect 순서 문제**
- 위치: `result-detail.tsx`, `handleSendMessage` 콜백
- 상세: `onSendMessage(message)` (store에 optimistic 추가) 후 `client.emit(...)` (서버 전송) 순서임. `onSendMessage`가 실패해도 emit은 실행되고, emit 실패 시 롤백 메커니즘이 없음. 또한 동일 컴포넌트에서 WS 이벤트를 직접 emit하는 패턴이 `handleFormSubmit`과 일관됨.
- 제안: 현재 패턴 유지하되, emit 실패 처리 또는 에러 경계 추가 고려

---

**[WARNING] `run-results-drawer.tsx`에서 store selector가 개별 구독으로 분산**
- 위치: `run-results-drawer.tsx`, store 구독 블록
- 상세: 이번 변경으로 `useExecutionStore` 개별 selector 호출이 14개에서 21개로 증가. 관련 state를 하나의 selector로 묶지 않아 컴포넌트가 불필요한 횟수로 re-render될 수 있음.
- 제안: 대화 관련 state를 `useShallow` + 단일 selector로 묶거나, 관련 로직을 custom hook(`useConversationState`)으로 추출

---

**[INFO] `SummaryView`의 인라인 긴 표현식**
- 위치: `conversation-inspector.tsx`, `SummaryView` 컴포넌트
- 상세: `(config?.turnCount as number) ?? conversationMessages.filter((m) => m.type === "user").length` 가 JSX 인라인에 삽입되어 가독성 저하. 해당 표현식은 `currentTurn` 변수로 분리하면 명확함.
- 제안: `const currentTurn = (config?.turnCount as number) ?? conversationMessages.filter(m => m.type === "user").length` 로 변수 추출

---

**[INFO] `isMultiTurnAgent` 함수의 판별 조건이 암묵적**
- 위치: `result-timeline.tsx`, `isMultiTurnAgent` 함수
- 상세: `output?.interactionType === "ai_conversation"` 조건은 `outputData`가 아닌 `waitingInteractionType`의 값인데, 완료된 노드의 `outputData`에 해당 필드가 포함되어야 한다는 전제가 주석 없이 코드로만 표현됨.
- 제안: 함수에 짧은 주석 추가: `// outputData.interactionType is set by backend when node completes`

---

### 요약

이번 변경은 AI Agent Multi Turn 대화 기능을 일관된 패턴으로 확장하고, `CLEAR_WAITING` 상수를 통한 store 리팩터링 등 긍정적인 개선이 포함되어 있다. 그러나 **`isExpanded`/`isLiveNode` 선언 순서 역전**이라는 런타임 버그가 존재하며, `unknown` 타입의 광범위한 사용과 히스토리 메시지 파싱 로직의 중복이 향후 수정 시 일관성 유지를 어렵게 만든다. `ResultDetail`의 props 수가 15개로 증가한 것은 컴포넌트 분리 또는 props 그룹핑이 필요하다는 신호다. 신규 파일(`conversation-inspector.tsx`, `conversation-timeline-item.tsx`)은 단일 책임 원칙을 잘 따르고 있어 구조적으로 양호하다.

### 위험도

**MEDIUM** (런타임 버그 1건 포함)