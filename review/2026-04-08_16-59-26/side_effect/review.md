## 부작용 코드 리뷰 결과

### 발견사항

---

**[CRITICAL] `result-timeline.tsx` — `isLiveNode` 변수 사용 전 선언**
- 위치: `result-timeline.tsx`, 렌더 블록 내부
- 상세: `isExpanded = isLiveNode || ...` 가 `isLiveNode` 선언보다 먼저 등장. JavaScript의 `let`/`const` TDZ(Temporal Dead Zone) 문제로 런타임 ReferenceError 발생 가능
- 제안: `isLiveNode` 선언을 `isExpanded` 위로 이동
```tsx
const isLiveNode = isLiveConversation && ...;
const isExpanded = isLiveNode || (expanded[result.nodeId] ?? false);
```

---

**[WARNING] `run-results-drawer.tsx` — `handleSendMessage`에서 `conversationMessages` 클로저 의존**
- 위치: `handleSendMessage` useCallback, `conversationMessages` 의존성
- 상세: `conversationMessages`가 deps 배열에 포함되어 있어 메시지가 추가될 때마다 핸들러가 재생성됨. 이 핸들러를 `ResultDetail`로 prop 전달 시 매 렌더마다 참조가 바뀌어 불필요한 자식 리렌더 발생. 또한 `turnIndex` 계산(`filter(...).length + 1`)이 낙관적 업데이트와 WebSocket 응답 간의 경쟁 조건(race condition)에서 중복 카운팅될 여지가 있음
- 제안: `addConversationMessage` 콜백 내부에서 store 상태를 직접 읽도록 store action을 수정하거나, `useRef`로 메시지 카운트를 추적

---

**[WARNING] `use-execution-events.ts` — `handleAiMessage`에서 `isWaitingAiResponse` 미해제 시나리오**
- 위치: `handleAiMessage` 콜백
- 상세: 사용자가 메시지를 보내면 `setWaitingAiResponse(true)`가 호출되지만, 네트워크 오류나 실행 실패로 `execution.ai_message` 이벤트가 오지 않으면 `isWaitingAiResponse`가 영구적으로 `true`로 남아 입력 UI가 비활성 상태로 잠김. `CLEAR_WAITING`에 `isWaitingAiResponse: false`가 포함되어 있어 `failExecution`/`completeExecution` 시에는 해소되지만, 중간에 다른 상태 전이가 발생하는 경우 누락 가능
- 제안: `handleExecutionFailed`, `handleExecutionCancelled`에서 명시적으로 `setWaitingAiResponse(false)` 호출 또는 타임아웃 처리 추가

---

**[WARNING] `result-timeline.tsx` — 자동 스크롤 ref 로직 불일치**
- 위치: useEffect auto-scroll, `prevCountRef` / `prevMsgCountRef`
- 상세: `prevCountRef`와 `prevMsgCountRef`를 합산해 스크롤 여부를 판단하지만, 두 값을 별도로 업데이트하는 구조라 한 쪽이 감소(예: 실행 리셋 후 messages가 0으로 초기화)할 경우 `totalCount > prevTotal` 조건이 오작동하여 예상치 못한 스크롤 방지 또는 강제 스크롤 발생 가능
- 제안: 카운터를 합산 단일 ref로 관리하거나, 각각 독립적인 auto-scroll 로직으로 분리

---

**[WARNING] `result-detail.tsx` — `isCompletedConversation` 메시지 파싱에서 잠재적 런타임 에러**
- 위치: `isCompletedConversation` 조건 블록 내 `conversationMessages` prop 인라인 계산
- 상세: `(result.outputData as ...).messages` 가 `null`이거나 배열이 아닌 경우 `.filter()` 호출 시 TypeError 발생. `isCompletedConversation` 체크에서 `!!...messages`로 존재를 확인하지만, 빈 배열(`[]`)은 truthy이므로 통과 후 문제 없음 — 그러나 `messages`가 배열이 아닌 객체나 문자열인 경우는 방어되지 않음
- 제안: `Array.isArray()` 가드 추가
```tsx
const msgs = (result.outputData as Record<string, unknown>).messages;
if (!Array.isArray(msgs)) return [];
```

---

**[INFO] `execution-store.ts` — `CLEAR_WAITING` 상수가 모듈 스코프에서 `WaitingInteractionType | null` 타입 캐스팅 포함**
- 위치: `CLEAR_WAITING` 객체 정의
- 상세: `null as WaitingInteractionType | null` 캐스팅이 있어 타입 추론을 강제. 이는 기술적 부작용이 아니라 TypeScript 타입 안전성 제약에 의한 패턴으로, 기능적 문제는 없음
- 제안: `waitingInteractionType: null satisfies WaitingInteractionType | null` (TS 4.9+) 또는 별도 타입 명시로 가독성 향상 가능

---

**[INFO] `use-execution-events.ts` — `handleWaitingForInput` 내 중복 상태 읽기**
- 위치: `conversationMessages.length === 0` 체크를 위한 `useExecutionStore.getState()` 직접 호출
- 상세: 이미 클로저로 `addConversationMessage`를 가지고 있으면서 store를 직접 읽는 혼재된 패턴. 기능적 문제는 없으나 일관성 부족으로 유지보수 혼란 가능
- 제안: store action 내부에서 중복 방지 로직을 처리하도록 `addConversationMessage`를 `idempotent`하게 설계

---

### 요약

이번 변경에서 가장 심각한 부작용은 **`result-timeline.tsx`의 `isLiveNode`/`isExpanded` 선언 순서 역전**으로, 런타임 에러를 유발할 수 있는 실질적 버그입니다. 나머지 이슈들은 네트워크 오류 시 UI 잠김(`isWaitingAiResponse` 미해제), 낙관적 업데이트와 서버 응답 간의 경쟁 조건, 배열 타입 미검증으로 인한 잠재적 TypeError 등으로, 엣지 케이스에서 사용자 경험을 저하시키거나 오류를 유발할 수 있습니다. `CLEAR_WAITING` 패턴 도입과 `resumeFromConversation`/`pauseForConversation` 추가는 기존 상태 관리 구조와 일관성 있게 설계되어 전반적으로 의도하지 않은 전역 상태 오염은 없습니다.

---

### 위험도

**MEDIUM** — CRITICAL 선언 순서 버그 1건, WARNING 수준 엣지케이스 3건 존재. 정상 플로우에서는 동작하나 네트워크 오류·리셋·빠른 상호작용 시나리오에서 문제 발생 가능.