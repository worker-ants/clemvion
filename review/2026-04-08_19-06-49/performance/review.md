## 성능 리뷰 결과

### 발견사항

---

**[WARNING] `chatParams`에 메시지 배열 전체를 복사 후 즉시 LLM 호출 파라미터와 중복 전달**
- 위치: `ai-agent.handler.ts`, `processMultiTurnMessage()` — diff +4~8행
- 상세: `chatParams`를 디버깅용으로 캡처할 때 `messages: [...messages]`로 얕은 복사를 수행하고, 바로 아래 `llmService.chat()` 호출 시 동일한 `messages` 배열을 다시 전달합니다. 대화가 길어질수록(수십 턴, 각 메시지가 수천 토큰) 메시지 배열 복사 비용이 누적됩니다. 또한 `chatParams.messages`와 `llmService.chat()`에 전달된 `messages`는 동일한 객체를 참조하므로, tool call 루프 이후 `chatParams`가 최종 상태를 반영하게 되어 "요청 시점"의 스냅샷이 아닌 변형된 배열을 캡처하는 버그도 내포합니다.
- 제안: LLM 호출 파라미터를 직접 재사용하거나, 디버깅 목적임을 명확히 하고 tool call 루프 진입 전 길이를 기록하는 방식으로 대체:
  ```ts
  const snapshotLength = messages.length; // tool call 전 스냅샷
  const turnStartedAt = Date.now();
  let result = await this.llmService.chat(llmConfig, { model, messages, ... });
  // 필요 시: const requestSnapshot = messages.slice(0, snapshotLength);
  ```

---

**[WARNING] WebSocket 이벤트마다 `requestPayload` / `responsePayload` 전체를 직렬화하여 전송**
- 위치: `execution-engine.service.ts` — diff +884~893행, `use-execution-events.ts` — diff +227~232행
- 상세: `newState.lastTurnRequest`에는 전체 메시지 히스토리(`messages` 배열 포함)가 담겨 있습니다. 대화가 10턴 이상 진행되면 수십 KB 규모의 payload가 매 턴마다 WebSocket으로 브라우저에 전달되고, 프론트엔드 Zustand store에 `ConversationItem[]`로 누적됩니다. N턴 대화 시 O(N²) 메모리 누적이 발생합니다.
- 제안: `requestPayload`에서 `messages` 필드를 제외하고 전송 (`{...chatParams, messages: undefined}`), 또는 마지막 user 메시지와 파라미터만 포함하는 경량 버전으로 전송. 전체 히스토리는 서버 측 node execution output에서 이미 보존되므로 중복입니다.

---

**[WARNING] `SummaryView`에서 `isLive=false`일 때 IIFE로 매 렌더링마다 메시지 배열 변환**
- 위치: `conversation-inspector.tsx` — `SummaryView` 함수 내 `items` 계산부
- 상세: `isLive=false` 분기에서 즉시 실행 함수(IIFE)로 `output.messages`를 filter + map 변환합니다. `useMemo` 없이 컴포넌트 렌더링마다 재실행되므로, 대화 메시지가 많을수록 불필요한 연산이 반복됩니다. `SummaryView`는 부모에서 자주 리렌더될 수 있습니다(예: `isWaitingAiResponse` 상태 변화 시).
- 제안:
  ```tsx
  const items = useMemo(() => {
    if (isLive) return conversationMessages;
    if (!output?.messages) return conversationMessages;
    return (output.messages as Array<...>)
      .filter(...)
      .map(...);
  }, [isLive, conversationMessages, output]);
  ```

---

**[INFO] `handleSendMessage`의 `conversationMessages.filter()` 호출이 매 메시지 전송마다 O(N) 탐색**
- 위치: `run-results-drawer.tsx` — `handleSendMessage` 콜백
- 상세: `conversationMessages.filter((m) => m.type === "user").length`로 user 메시지 수를 계산합니다. 별도로 `turnCount` 상태를 관리하거나 store에서 제공하면 O(1)로 단순화할 수 있습니다. 현재 대화 규모에서는 실질적 영향은 미미하지만, 구조적으로 불필요합니다.
- 제안: store에 `userTurnCount` 파생 값을 추가하거나 `addConversationMessage` 내부에서 turnIndex를 자동 계산.

---

**[INFO] `TabBar` 제네릭 컴포넌트가 매 렌더링마다 새 함수 참조 생성**
- 위치: `conversation-inspector.tsx` — `TabBar` 컴포넌트
- 상세: `onClick={() => onChange(tab.id)` 화살표 함수가 탭 수만큼 매 렌더링마다 새로 생성됩니다. 현재 탭이 4개로 영향은 미미하지만, `useCallback`을 사용하는 부모 패턴과 일관성이 없습니다.
- 제안: 탭 버튼을 별도 `memo` 컴포넌트로 분리하거나 data-attribute 패턴으로 단일 핸들러 사용.

---

### 요약

이번 변경의 핵심 성능 리스크는 디버깅 목적의 **LLM 요청/응답 페이로드 전체를 매 턴마다 WebSocket으로 전송하고 클라이언트 메모리에 누적**하는 구조입니다. `requestPayload`에 전체 메시지 히스토리가 포함되므로 N턴 대화 시 O(N²) 메모리 사용이 발생하고, 네트워크 전송량도 선형 이상으로 증가합니다. `chatParams` 복사 시점 문제로 인해 디버깅 데이터의 정확성도 보장되지 않습니다. 프론트엔드의 `SummaryView` 내 IIFE 변환도 `useMemo`로 보완이 필요합니다. 나머지 항목은 현재 규모에서 실질적 영향이 낮습니다.

### 위험도

**MEDIUM**