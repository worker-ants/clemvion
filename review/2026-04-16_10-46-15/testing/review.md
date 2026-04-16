### 발견사항

---

**[WARNING]** `isMultiTurnConversation` 함수의 핵심 로직 변경에 대한 단위 테스트 부재
- 위치: `result-timeline.tsx:62-80` (함수 이름 변경 + `nodeType !== "ai_agent"` 가드 제거)
- 상세: `isMultiTurnAgent` → `isMultiTurnConversation` 으로 이름이 바뀌고 `ai_agent` 타입 제한이 제거되었으나, 이 함수 자체를 직접 테스트하는 단위 테스트가 없음. 타임라인 테스트에서 렌더링을 통해 간접 검증은 되나, `conversationConfig` / `messages` / `interactionType` 세 가지 탐지 경로 중 `conversationConfig` 경로는 어떤 테스트에서도 커버되지 않음.
- 제안: `non-ai_agent` 타입(예: `information_extractor`, `form`)에서 `messages`/`conversationConfig` 각 경로별 `isMultiTurnConversation` 반환값을 검증하는 케이스 추가

---

**[WARNING]** `isLiveNode` 조건 완화(`nodeType === "ai_agent"` 제거)에 대한 테스트 없음
- 위치: `result-timeline.tsx:131-133`
- 상세: `isLiveNode`가 이제 `ai_agent`가 아닌 모든 `waiting_for_input` 노드에 적용됨. `isLiveConversation=true` + `status="waiting_for_input"` 조합을 `information_extractor` 등 다른 타입으로 렌더링하는 테스트가 없어, 라이브 대화 확장 UI가 예상치 않은 노드 타입에 표시될 수 있는 회귀를 잡지 못함.
- 제안: `isLiveConversation=true` + `waiting_for_input` + `nodeType="form"` 같은 비대화 노드에서 chevron이 렌더되지 않아야 함을 검증하는 테스트 추가

---

**[WARNING]** `isCompletedConversation` 세 번째 조건(`rawOut?.messages != null`)의 과포함 위험 미검증
- 위치: `result-detail.tsx:342-346`
- 상세: `rawOut?.messages != null` 조건은 wrapped 구조(`{ config, output, ... }`) 여부와 무관하게 최상위에 `messages` 키가 있으면 conversation으로 판단함. 이는 `messages` 필드를 직접 포함하는 비대화 노드(예: 레거시 HTTP 응답)에서 오판정할 수 있음. 테스트에서 이 경로를 의도적으로 검증하는 케이스가 없음.
- 제안: `outputData: { messages: [...], statusCode: 200 }` 형태의 비대화 노드가 탭을 숨기지 않아야 하는지(또는 의도적으로 숨겨야 하는지) 명시하는 테스트 추가

---

**[WARNING]** `result-timeline.test.tsx` 신규 테스트가 "확장 가능 여부"를 SVG 존재로만 검증
- 위치: `result-timeline.test.tsx:108-116`
- 상세: `container.querySelectorAll("svg").length > 0` 는 `StatusIcon`, `ChevronRight` 등 다른 SVG까지 포함해 항상 통과할 가능성이 높음. 실제로 chevron이 다중 턴 노드에 대해 렌더되는지를 검증하지 못함.
- 제안: `ChevronRight`/`ChevronDown`의 존재를 `aria-label` 또는 `data-testid` 속성으로 타겟하거나, 적어도 단일 노드 케이스에서 SVG 개수를 기준 비교하는 방식으로 개선. 또는 클릭 후 대화 항목이 펼쳐지는지를 검증하는 상호작용 테스트로 대체.

---

**[INFO]** `result-detail.test.tsx` 신규 테스트가 `isCompletedConversation` 활성화 시 실제 렌더 내용을 미검증
- 위치: `result-detail.test.tsx:255-286`
- 상세: `ConversationInspector`가 렌더되는지 확인하는 대신 Input 버튼의 부재만 검증함. `ConversationInspector`의 핵심 요소(메시지 목록, role 레이블 등)가 렌더되는지 포지티브 단언이 없어 컴포넌트가 빈 상태로 렌더되더라도 통과함.
- 제안: `expect(screen.getByText("My name is Alice")).toBeDefined()` 같이 실제 메시지 내용이 렌더되는지 포지티브 단언 추가

---

**[INFO]** `wrapped` 구조 + `output.interactionType` 경로에 대한 테스트 없음
- 위치: `result-detail.tsx:337-340` (`innerOutput?.interactionType === "ai_conversation"`)
- 상세: `{ config, output: { interactionType: "ai_conversation", ... } }` 형태로 `interactionType`이 `meta`가 아닌 `output` 안에 있는 경우를 커버하는 테스트가 없음. 현재 테스트는 `meta.interactionType` 경로만 검증함.
- 제안: `output` 레벨에 `interactionType`이 있는 케이스를 테스트에 추가

---

### 요약

이번 변경은 `ai_agent` 타입 제한을 제거하여 `information_extractor` 등 다른 AI 노드도 멀티턴 대화 UI를 사용할 수 있도록 일반화하는 작업으로, 변경의 방향은 타당하다. 핵심 신규 시나리오(completed multi-turn extractor에서 탭 숨김, single-turn ai_agent에서 탭 표시)에 대한 테스트가 추가된 점은 긍정적이다. 그러나 `isCompletedConversation`의 세 번째 조건(`rawOut?.messages`)의 과포함 위험, `isLiveNode` 조건 완화의 회귀 가능성, 그리고 타임라인 SVG 검증의 약한 단언이 잠재적 버그를 놓칠 수 있는 커버리지 갭으로 남아 있다. 특히 라이브 대화 확장 로직이 비대화 노드(`waiting_for_input` 상태의 form 등)에서도 활성화될 수 있는 회귀는 사용자에게 시각적 혼란을 줄 수 있어 보완이 필요하다.

### 위험도

**MEDIUM**