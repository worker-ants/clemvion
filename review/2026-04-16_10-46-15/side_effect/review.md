## 리뷰 결과

### 발견사항

---

**[WARNING] `isMultiTurnAgent` → `isMultiTurnConversation` 함수명 변경 및 타입 가드 제거**
- 위치: `result-timeline.tsx`, diff `-function isMultiTurnAgent` → `+function isMultiTurnConversation`
- 상세: 기존에는 `result.nodeType !== "ai_agent"` 조건으로 `ai_agent`가 아닌 노드는 early return하였으나, 변경 후에는 이 가드가 제거됨. 이로 인해 `output?.conversationConfig || output?.messages || output?.interactionType === "ai_conversation"` 조건을 모든 노드 타입에 대해 평가하게 됨. `messages` 필드를 우연히 포함하는 다른 노드(예: `http_request` 응답 바디에 `messages` 키가 있는 경우)가 멀티턴 노드로 잘못 분류될 수 있음.
- 제안: 노드 타입 화이트리스트 또는 `interactionType === "ai_conversation"` 조건만으로 판정하도록 좁히거나, `messages`가 배열인지 추가 검증 필요.

```ts
// 예시: 방어적 검사 추가
return !!(
  output?.interactionType === "ai_conversation" ||
  (Array.isArray(output?.messages) && output.messages.length > 0)
);
```

---

**[WARNING] `isLiveNode` 조건에서 `nodeType` 가드 제거**
- 위치: `result-timeline.tsx`, diff `-result.nodeType === "ai_agent"` 제거
- 상세: 기존 `isLiveNode`는 `isLiveConversation && status === "waiting_for_input" && nodeType === "ai_agent"`였으나, 변경 후 nodeType 조건이 제거됨. `waiting_for_input` 상태의 모든 노드(`form`, `carousel` 등 presentation 노드 포함)가 라이브 대화 노드로 처리되어 `conversationMessages`가 자식으로 렌더링될 수 있음. `isWaitingForm`이나 `isWaitingButtons`가 동시에 활성화된 상황에서 비어있는 대화 목록이 불필요하게 렌더링되는 부작용 발생 가능.
- 제안: 대화 노드임을 판정하는 더 명확한 기준 필요 (예: `isMultiTurnConversation(result)` 결과 또는 `nodeCategory === "ai"` 등과 조합).

---

**[WARNING] `isCompletedConversation` 판정 로직의 폴백 조건 과도하게 넓음**
- 위치: `result-detail.tsx`, 변경된 `isCompletedConversation` 블록
- 상세: `rawOut?.messages != null` 조건이 OR로 연결됨. 이는 최상위 `outputData`에 `messages` 키가 존재하는 모든 노드를 conversation으로 판정함. `interactionType` 조건과 달리 의미 검증 없이 구조적 유사성만으로 판정하므로, HTTP 응답 파싱 결과나 다른 AI 노드의 출력이 conversation inspector로 잘못 렌더링될 수 있음.
- 제안: 해당 폴백 조건 제거 또는 `interactionType` 체크와 결합 후 사용:

```ts
const isCompletedConversation =
  result.status === "completed" &&
  Array.isArray(innerOutput?.messages) &&
  (innerOutput?.interactionType === "ai_conversation" ||
    innerMeta?.interactionType === "ai_conversation");
```

---

**[INFO] `showTabs`에서 `!isAiAgent` 조건 제거에 따른 동작 변화**
- 위치: `result-detail.tsx`, `showTabs` 계산 로직
- 상세: 기존에는 `ai_agent` 타입 노드는 항상 탭이 숨겨졌으나, 변경 후 `isConversationNode`가 false인 ai_agent(싱글턴 결과)는 탭이 표시됨. 테스트 `"shows tabs for single-turn ai agent nodes"`가 이를 의도적으로 검증하고 있어 의도된 변경으로 보임. 단, 기존에 탭 없이 `GenericRenderer`로 렌더링되던 ai_agent 완료 결과가 이제 탭 UI로 전환되므로, `GenericRenderer` 경로를 통해 처리되던 ai_agent 특화 렌더링이 있다면 회귀 가능.
- 제안: `GenericRenderer`가 ai_agent 출력에 특화된 처리를 하고 있는지 확인 권장.

---

**[INFO] 테스트에서 `"Input"` 버튼 쿼리 방식 불일치**
- 위치: `result-detail.test.tsx`, `"renders conversation inspector for completed multi-turn information extractor"` 테스트
- 상세: `screen.queryByRole("button", { name: "Input" })`을 사용하나, 실제 탭 버튼의 accessible name이 텍스트 기반으로 정확히 "Input"인지는 구현에 의존함. 다른 테스트에서는 `screen.queryByText("Input")`을 사용하여 일관성이 없음. 기능상 문제는 없으나 접근성 속성이 추가되면 테스트가 의도치 않게 깨질 수 있음.
- 제안: 다른 테스트와 동일하게 `screen.queryByText("Input")`으로 통일.

---

### 요약

이번 변경은 `information_extractor`를 포함한 여러 AI 노드 타입을 대화형 노드로 지원하기 위해 기존의 `ai_agent` 타입 하드코딩을 제거하고 출력 데이터의 구조 및 `interactionType` 메타데이터 기반으로 판정 로직을 일반화했습니다. 핵심 로직 방향은 올바르나, `messages` 필드 존재 여부만으로 대화 노드를 판정하는 폴백 조건과 `isLiveNode`에서 `nodeType` 가드 제거로 인해, `messages` 키를 우연히 포함하는 비대화형 노드(HTTP 응답 등)나 `waiting_for_input` 상태의 form/button 노드가 대화 UI로 잘못 렌더링될 수 있는 부작용이 존재합니다. 타입/구조 검증을 강화하여 오탐을 줄이는 것이 권장됩니다.

### 위험도

**MEDIUM**