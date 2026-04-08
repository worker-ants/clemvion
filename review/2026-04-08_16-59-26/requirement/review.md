## 발견사항

### **[CRITICAL]** `isLiveNode` 선언 전 사용으로 인한 런타임 에러
- **위치**: `result-timeline.tsx` 렌더 루프 내 변수 선언 순서
- **상세**: `const isExpanded = isLiveNode || ...`가 `const isLiveNode = ...` 보다 먼저 선언됨. JavaScript `const`는 Temporal Dead Zone이 있어 이 코드는 `ReferenceError: Cannot access 'isLiveNode' before initialization`를 던짐
- **제안**: `isLiveNode` 선언을 `isExpanded` 앞으로 이동

```tsx
// 현재 (잘못된 순서)
const isMultiTurn = isMultiTurnAgent(result);
const isExpanded = isLiveNode || (expanded[result.nodeId] ?? false); // ❌ isLiveNode 미선언
const isLiveNode = isLiveConversation && ...;

// 수정
const isMultiTurn = isMultiTurnAgent(result);
const isLiveNode = isLiveConversation && result.status === "waiting_for_input" && result.nodeType === "ai_agent";
const isExpanded = isLiveNode || (expanded[result.nodeId] ?? false);
```

---

### **[WARNING]** Tool Call 항목이 타임라인에 표시되지 않음 (ED-EX-10 미충족)
- **위치**: `use-execution-events.ts` — `handleAiMessage` 콜백
- **상세**: Spec ED-EX-10은 "타임라인에 메시지/Tool Call 프리뷰 표시"를 요구하며, `ConversationTimelineItem`과 `ConversationItem.type === "tool"` 렌더러도 구현되어 있음. 그러나 `handleAiMessage`는 `payload.messages` 배열을 사용하지 않아 Tool call 항목이 실제로는 추가되지 않음
- **제안**: `payload.messages`를 순회하며 `role === "tool"` 항목을 `type: "tool"` ConversationItem으로 `addConversationMessage` 호출

---

### **[WARNING]** 캔버스 AI Agent 노드 시각적 피드백 미구현 (Spec 3.6 미충족)
- **위치**: 변경 대상 파일 외 (canvas node 렌더러)
- **상세**: Spec 3.6에서 "캔버스에서 AI Agent 노드에 💬 아이콘 + 초록 테두리 펄스 애니메이션"을 요구하나, 이번 변경셋에 캔버스 노드 시각화 관련 코드가 없음
- **제안**: `waiting_for_input` + `ai_conversation` 상태의 AI Agent 노드에 대한 캔버스 노드 컴포넌트 스타일 업데이트 필요

---

### **[WARNING]** `updateConversationConfig` 호출 시 `maxTurns` 손실
- **위치**: `use-execution-events.ts:handleAiMessage` → `updateConversationConfig(payload)`
- **상세**: `handleAiMessage`의 `payload`는 `{nodeId?, message?, turnCount?, messages?}` 구조이며 `maxTurns`가 없음. `updateConversationConfig`가 이 payload로 `waitingConversationConfig` 전체를 교체하면, `SummaryView`에서 `config?.maxTurns`를 읽을 때 `undefined`가 되어 "Turn N/∞"로 표시됨
- **제안**: `updateConversationConfig`를 머지(merge) 방식으로 변경하거나, `turnCount`만 별도로 업데이트하는 액션 사용

---

### **[WARNING]** 히스토리 모드 `messages` 캐스팅 시 null 안전성 부재
- **위치**: `result-detail.tsx` — `isCompletedConversation` 분기 내 `conversationMessages` 계산
- **상세**: `(result.outputData as Record<string, unknown>).messages as Array<...>` 캐스팅 후 바로 `.filter()` 호출. `outputData`가 null이거나 `messages`가 배열이 아닌 경우 TypeError 발생
- **제안**: 
```tsx
const messages = (result.outputData as Record<string, unknown> | null)?.messages;
const safeMessages = Array.isArray(messages) ? messages : [];
```

---

### **[WARNING]** 대화 완료 후 타임라인 접힘 상태가 초기화되지 않음
- **위치**: `result-timeline.tsx` — `expanded` 상태 관리
- **상세**: Spec 10.5에서 "대화 완료 후(History): 접힘 기본"을 요구. Live 중 사용자가 토글하여 `expanded[nodeId] = true`로 설정된 상태는 대화 완료 후에도 유지되어 History 모드에서도 펼쳐진 채로 표시됨
- **제안**: `resumeFromConversation` 또는 `completeExecution` 이벤트 시 expanded 상태를 초기화하거나, `isCompletedConversation` 판단 시 `expanded` 기본값을 `false`로 고정

---

### **[INFO]** 상태 바 레이블에 💬 이모지 누락
- **위치**: `run-results-drawer.tsx` — `statusLabel` 계산
- **상세**: 코드는 `"Conversing..."`이나 Spec 3.6 다이어그램은 `"💬 Conversing"` 표시
- **제안**: `"💬 Conversing..."` 으로 수정 (선택 사항, UX 일관성)

---

### **[INFO]** 히스토리 모드 백엔드 계약 의존성
- **위치**: `result-detail.tsx` — `isCompletedConversation` 조건, `result-timeline.tsx` — `getHistoryMessages`
- **상세**: ED-EX-11 구현이 백엔드가 `outputData.messages` 배열을 반환하는지 여부에 전적으로 의존. 해당 필드가 없으면 완료된 대화 이력이 전혀 표시되지 않으며 실패가 silent함
- **제안**: fallback 처리 또는 백엔드 API 계약 명시화

---

## 요약

이번 변경셋은 AI Agent Multi Turn 대화의 핵심 요구사항(ED-EX-09~11)을 대부분 구현하였으며, 스토어 설계(`CLEAR_WAITING` 패턴, `ConversationItem` 타입), WebSocket 이벤트 처리, 인스펙터 UI 구조는 Spec과 잘 대응된다. 그러나 `result-timeline.tsx`의 `isLiveNode`/`isExpanded` 변수 선언 순서 역전은 JavaScript TDZ 규칙에 의해 페이지 접속 즉시 런타임 에러를 유발하는 **CRITICAL 버그**이며, Tool Call 항목 표시 미구현(ED-EX-10 부분 미충족)과 캔버스 시각 피드백 누락(Spec 3.6)이 기능 완전성 측면에서 남아있다.

## 위험도
**HIGH** (CRITICAL 런타임 버그 1건 포함)