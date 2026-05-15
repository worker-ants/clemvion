### 발견사항

---

**[INFO] `use-execution-interaction-commands` 훅 추출 — 책임 분리 개선**
- 위치: `use-execution-interaction-commands.ts`
- 상세: WebSocket 명령 발행 로직이 `result-detail.tsx`, `run-results-drawer.tsx`에 각각 인라인으로 흩어져 있던 것을 단일 훅으로 통합. SRP 및 DRY 관점에서 명확한 개선.
- 제안: 현재 구조 유지.

---

**[WARNING] `sendMessage` 내부에서 `useExecutionStore.getState()` 직접 접근**
- 위치: `use-execution-interaction-commands.ts:49`
  ```ts
  const { conversationMessages } = useExecutionStore.getState();
  ```
- 상세: `useCallback` 의존 배열에 `conversationMessages`를 포함하지 않기 위해 Zustand의 getState()를 직접 호출하는 패턴. 이는 훅의 리액티브 데이터 흐름을 우회하는 imperative 접근으로, 스토어 내부 구조에 대한 암묵적 결합을 만든다. 현재는 동작하지만, 스토어 슬라이스가 분리되거나 셀렉터가 변경될 경우 조용히 깨질 수 있다.
- 제안: `addConversationMessage` 액션 내부에서 턴 인덱스를 계산하도록 스토어 액션을 확장하거나, `sendMessage`를 스토어 액션으로 흡수하여 외부에서 상태를 직접 읽지 않도록 캡슐화.

---

**[WARNING] `ExecutionDetailPage`의 `NodeResultsTab`에서 렌더 중 setState 호출**
- 위치: `page.tsx:356-360`
  ```ts
  if (waitingNodeId && waitingNodeId !== lastAutoSelectedWaiting) {
    setLastAutoSelectedWaiting(waitingNodeId);
    setSelectedNodeId(waitingNodeId);
    setNodeDetailTab("preview");
  }
  ```
- 상세: 렌더 함수 본문에서 `setState`를 직접 호출하는 패턴. React 공식 문서가 허용하는 "derived state" 패턴이라고 주석에 명시되어 있으나, 이 패턴은 동일 렌더 사이클에서 즉시 리렌더를 유발하여 성능 저하 및 디버깅 난이도 상승을 초래한다. 또한 `setSelectedNodeId`가 외부 `waitingNodeId`에 반응하는 사이드이펙트를 렌더 경로에 내포하여 컴포넌트 동작 예측을 어렵게 만든다.
- 제안: `useEffect(() => { ... }, [waitingNodeId])`로 전환하거나, `waitingNodeId`가 변경되면 자동 선택 로직을 스토어 액션(`pauseForForm`, `pauseForButtons`, `pauseForConversation`)에서 처리하여 컴포넌트가 선택 상태를 파생적으로만 읽도록 설계.

---

**[WARNING] `ExecutionDetailPage`와 `RunResultsDrawer` 간 waiting 상태 처리 로직 중복**
- 위치: `page.tsx:372-416` vs `run-results-drawer.tsx` 전체
- 상세: `isSelectedWaiting`, `isWaitingForm`, `isWaitingButtons`, `isWaitingConversation` 파생 로직과 핸들러(`handleFormSubmit`, `handlePortButtonClick` 등)가 두 컴포넌트에 각각 구현되어 있다. `useExecutionInteractionCommands`로 명령은 통합되었으나, 상태 파생 및 렌더 분기 로직은 여전히 중복. 향후 interaction type이 추가될 경우 두 곳을 모두 수정해야 한다.
- 제안: waiting 상태 파생 + 인터랙션 핸들러를 묶는 `useWaitingInteractionState(executionId)` 훅을 추출하여 두 컴포넌트가 공유. 또는 `ResultDetail` 컴포넌트가 waiting 상태를 내부적으로 소비하도록 재설계(현재 `RunResultsDrawer`는 이미 이 방향으로 구현).

---

**[WARNING] `NodeResultsTab`이 글로벌 Zustand 스토어에 직접 의존**
- 위치: `page.tsx:330-365`
- 상세: `NodeResultsTab`은 순수 UI 컴포넌트처럼 보이지만 내부에서 `useExecutionStore`를 직접 구독한다. 페이지와 컴포넌트 간 레이어 경계가 모호해져, `NodeResultsTab`을 다른 컨텍스트에서 재사용하려면 동일한 글로벌 스토어가 반드시 존재해야 한다.
- 제안: waiting 상태 관련 props(`waitingNodeId`, `waitingInteractionType` 등)를 부모(`ExecutionDetailPage`)에서 내려받도록 변경하거나, 스토어 의존성을 명시적으로 표현하는 Container/Presenter 패턴 적용.

---

**[INFO] `waitingButtonConfig`의 반복적인 타입 캐스팅**
- 위치: `page.tsx:541-568`
  ```ts
  ((waitingButtonConfig as Record<string, unknown>).buttons as Array<{...}>) ?? []
  ```
- 상세: 동일한 캐스팅 패턴이 `page.tsx`와 `run-results-drawer.tsx` 양쪽에 존재. 스토어의 `waitingButtonConfig` 타입이 `unknown`으로 선언되어 소비 측에서 반복적인 캐스팅을 강제.
- 제안: 스토어 타입 정의에 `ButtonConfig`, `FormConfig` 등 인터페이스를 추가하여 캐스팅 부담 제거.

---

**[INFO] `package-lock.json` 변경 — `peer` 플래그 재정렬**
- 위치: `package-lock.json` 전체
- 상세: `@emnapi/core`, `@emnapi/runtime` 신규 추가 및 다수 패키지의 `peer` 플래그 변경. npm의 의존성 해결 알고리즘 변화로 인한 자동 재생성으로 보이며 실질적 구조 변경은 없음. `@emnapi` 패키지는 WASM 런타임으로 `optional`로 표시되어 있어 빌드 영향 없음.
- 제안: 현재 유지.

---

### 요약

이번 변경은 WebSocket 상호작용 명령을 `useExecutionInteractionCommands` 훅으로 추출하고, `ExecutionDetailPage`에 실행 대기(waiting) 인터랙션 지원을 추가한 의미 있는 리팩터링이다. 명령 레이어의 응집도는 개선되었으나, 몇 가지 아키텍처적 긴장이 남아 있다: (1) waiting 상태 파생 및 렌더 분기 로직이 `page.tsx`와 `run-results-drawer.tsx` 양쪽에 중복되어 단일 진실 원천(SSOT)이 부재하고, (2) `NodeResultsTab`이 글로벌 스토어에 직접 의존하여 레이어 경계가 흐려졌으며, (3) 렌더 중 setState 호출과 `getState()` 직접 접근이 리액티브 데이터 흐름 원칙을 부분적으로 위반한다. 기능 정확성에 즉각적 위협은 없으나, interaction type이 추가될수록 중복 유지보수 비용이 누적될 위험이 있다.

### 위험도

**MEDIUM**