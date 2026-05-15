## 아키텍처 코드 리뷰

### 발견사항

---

- **[CRITICAL]** `isLiveNode` 변수 선언 전 참조 (Temporal Dead Zone 버그)
  - 위치: `result-timeline.tsx`, `results.map()` 내부
  - 상세: `const isExpanded = isLiveNode || (expanded[result.nodeId] ?? false)` 라인이 `const isLiveNode = ...` 선언보다 앞에 위치. `const`는 호이스팅되지 않으므로 런타임에 `ReferenceError` 발생.
  - 제안: `isLiveNode` 선언을 `isExpanded` 선언 위로 이동.

---

- **[WARNING]** 메시지 파싱 로직 중복 (DRY 위반)
  - 위치: `result-detail.tsx` (`isCompletedConversation` 블록), `result-timeline.tsx` (`getHistoryMessages`)
  - 상세: `outputData.messages`를 `ConversationItem[]`으로 변환하는 동일 로직이 두 컴포넌트에 각각 구현되어 있음. 필터/맵 로직이 동일하며, 변경 시 두 곳 모두 수정 필요.
  - 제안: `conversation-utils.ts`로 `parseHistoryMessages(outputData: unknown): ConversationItem[]` 유틸 함수 분리.

---

- **[WARNING]** `ResultDetail`에서 직접 WebSocket 이벤트 발신 (레이어 책임 위반)
  - 위치: `result-detail.tsx`, `handleSendMessage` / `handleEndConversation`
  - 상세: Form/Button 인터랙션은 WS 호출 없이 콜백만 호출하는데, 대화 인터랙션은 `getWsClient().emit()`을 컴포넌트 내에서 직접 호출. 인프라 레이어가 프레젠테이션 레이어에 혼재되어 일관성이 없음.
  - 제안: `onSendMessage`/`onEndConversation` 콜백에서 WS 호출까지 처리하도록 끌어올리거나, 전용 훅(`useConversationInteraction`)으로 캡슐화.

---

- **[WARNING]** `turnIndex` 계산 로직이 컴포넌트에 위치 (비즈니스 로직 누출)
  - 위치: `run-results-drawer.tsx`, `handleSendMessage`
  - 상세: `conversationMessages.filter((m) => m.type === "user").length + 1` 계산이 드로어 컴포넌트에 있음. 메시지 인덱싱 규칙은 스토어의 `addConversationMessage` 내에서 자동으로 처리해야 할 비즈니스 로직.
  - 제안: `addConversationMessage`가 자동으로 `turnIndex`를 계산하도록 store 내부화.

---

- **[WARNING]** `unknown` 타입 남용으로 인한 타입 안정성 저하
  - 위치: `execution-store.ts` (`waitingConversationConfig: unknown`), `result-detail.tsx` (`conversationConfig: unknown`), `conversation-inspector.tsx` (`conversationConfig: unknown`)
  - 상세: `conversationConfig`가 3개 레이어를 통과하는 동안 내내 `unknown`으로 처리되고 각 컴포넌트에서 `as Record<string, unknown>`으로 단언. 타입 오류가 컴파일 타임이 아닌 런타임에 발생.
  - 제안: `ConversationConfig` 인터페이스를 `execution-store.ts`에 정의하고 전파.

---

- **[WARNING]** `ResultDetailProps` 인터페이스 과다 확장 (Interface Segregation 위반)
  - 위치: `result-detail.tsx`, `ResultDetailProps`
  - 상세: props가 14개로 증가. `isWaitingConversation`, `conversationConfig`, `conversationMessages`, `selectedConversationItemIndex`, `isWaitingAiResponse`, `onConversationEnd`, `onSendMessage` 등 대화 관련 props 7개가 추가됨. 새 인터랙션 타입마다 이 인터페이스가 계속 확대되는 구조.
  - 제안: 인터랙션 타입별로 객체로 묶거나 판별 유니온 사용: `waitingState: { type: 'conversation', config, messages, ... } | { type: 'form', config } | null`.

---

- **[WARNING]** 인터랙션 타입 추가 시 5개 이상 파일 수정 필요 (확장성 취약)
  - 위치: 전반적 아키텍처
  - 상세: 새 `WaitingInteractionType` 추가 시 store(상태+액션), 이벤트 핸들러, 드로어(구독+props), detail(조건 분기), timeline(감지 로직) 모두 수정 필요. Strategy/Plugin 패턴 부재.
  - 제안: 인터랙션 타입별 핸들러를 레지스트리 패턴으로 관리하거나, `waitingInteraction: { type, payload }` 판별 유니온으로 store를 단순화.

---

- **[WARNING]** `isMultiTurnAgent()` 감지 로직이 UI 레이어에 위치
  - 위치: `result-timeline.tsx`, `isMultiTurnAgent` 함수
  - 상세: 노드 타입이 Multi-Turn인지 판단하는 비즈니스 규칙이 타임라인 컴포넌트 내부에 정의됨. `outputData` 구조에 대한 지식을 UI 컴포넌트가 갖는 것은 응집도 저하.
  - 제안: `node-definitions.ts`나 별도 유틸리티로 이동, 또는 `NodeResult`에 플래그 필드 추가.

---

- **[INFO]** `RunResultsDrawer`의 store 구독 과다 (15개 이상)
  - 위치: `run-results-drawer.tsx`
  - 상세: 드로어가 store에서 15개 이상의 값/액션을 직접 구독. 대화 관련 상태가 추가되면서 더 심화됨.
  - 제안: `useConversationState()`, `useExecutionStatus()` 등 도메인별 선택기 훅으로 분리.

---

### 요약

이번 변경은 AI Agent Multi-Turn 대화 기능을 기존 실행 결과 드로어에 통합하는 작업으로, 전반적인 구현 방향은 스펙에 부합하나 아키텍처 관점에서 몇 가지 중요한 문제가 있다. 가장 긴급한 것은 `result-timeline.tsx`의 TDZ 버그로 런타임 오류를 유발한다. 구조적으로는 메시지 파싱 로직 중복, `ResultDetail`의 직접 WebSocket 호출, `unknown` 타입 남용이 주요 경고 사항이다. 인터랙션 타입이 추가될 때마다 5개 이상의 파일을 수정해야 하는 구조적 취약성이 있으며, 대화 관련 props/상태가 여러 레이어에 분산되어 응집도가 낮다. 지금 당장의 기능 동작에는 큰 문제가 없으나, 다음 인터랙션 타입 추가나 대화 기능 확장 시 부채가 누적될 위험이 높다.

### 위험도

**HIGH** (TDZ 런타임 버그로 인해)