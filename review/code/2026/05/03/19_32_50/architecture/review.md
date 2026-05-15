### 발견사항

- **[WARNING]** 듀얼 어큐뮬레이터 동기화 불변식 — 컴파일러 미보호
  - 위치: `ai-agent.handler.ts` — ragAcc/turnRagAcc 병렬 push 4개소 (line ~314, ~316, ~664, ~666)
  - 상세: "turn delta 합 = 노드 전체 누적" 불변식이 코드 구조가 아닌 호출자 규율로만 지켜진다. `pushSources` / `pushDiagnostic` 을 한쪽만 빠뜨려도 컴파일 에러 없이 조용히 깨진다.
  - 제안: 두 accumulator를 묶는 `RagAccumulatorGroup` (또는 handler 내 `pushToAllAccs(delta)` helper)를 도입해 push를 원자적으로 만든다. 단일 진입점이 생기면 누락 불가능하다.

- **[WARNING]** `ResultDetail` 렌더마다 `aiMetadata` / `turnRefIndex` 재계산 — 메모이제이션 부재
  - 위치: `result-detail.tsx` ~line 852–858
  - 상세: `extractAiMetadata(result.outputData)` 와 `new Map(...)` 이 매 렌더에 실행된다. `outputData` 참조가 변하지 않아도 불필요한 파싱·Map 생성이 반복되며, 하위 트리에 새 Map 참조가 전달돼 불필요한 리렌더를 유발할 수 있다.
  - 제안: `useMemo(() => extractAiMetadata(result.outputData), [result.outputData])` 와 `useMemo(() => new Map(...), [aiMetadata])` 로 감싼다.

- **[WARNING]** 렌더 중 `setState` — React 파생 상태 패턴 비일관성
  - 위치: `result-detail.tsx` ~line 834–839
  - 상세: `if (result && activeTabNodeId !== result.nodeId) { setActiveTabNodeId(...); setActiveTab(...); }` 는 React가 공식적으로 허용하는 "렌더 중 파생 상태 갱신" 패턴이나, 추가 렌더 사이클을 유발하고 팀 내 일관성이 없으면 혼란을 줄 수 있다. `key` prop 으로 컴포넌트를 교체하거나 `useEffect` 에서 처리하는 것이 더 의도가 명확하다.
  - 제안: `<NodeDetailTabs key={result.nodeId} ... />` 형태로 교체 시 React가 상태를 자동 초기화한다.

- **[INFO]** 단일턴에서 `turnRagAcc = ragAcc` 중복 계산
  - 위치: `ai-agent.handler.ts` ~line 195
  - 상세: single-turn 경로에서 `ragAcc` 와 `turnRagAcc` 가 항상 동일한 값을 가진다. 코드 주석이 이유("스키마 일관성")를 잘 설명하고 있으나, 향후 유지보수자가 이중 상태를 의심할 여지가 있다.
  - 제안: 이중 accumulator 패턴 자체가 `RagAccumulatorGroup` 으로 캡슐화되면 이 의문도 자연스럽게 해소된다.

- **[INFO]** 3단계 prop drilling — `turnRefIndex` / `onJumpToReferences`
  - 위치: `result-detail.tsx` → `conversation-inspector.tsx` → `SelectedItemDetail` / `SummaryView`
  - 상세: 현재 깊이(3)에서는 허용 범위지만, ConversationInspector의 자식 컴포넌트가 늘어날 경우 전달 경로가 확산된다.
  - 제안: 컴포넌트 트리가 더 깊어지면 React Context 또는 컴포넌트 합성(slot) 패턴 전환을 고려한다.

- **[INFO]** `NodeDetailTabs` 의 기본 탭 결정 로직이 부모로 이동
  - 위치: `result-detail.tsx` ~line 836
  - 상세: `result.error ? "error" : "preview"` 결정이 `ResultDetail` 에 있어 탭 UI 컴포넌트(`NodeDetailTabs`)가 자신의 기본값을 알지 못한다. 나쁜 설계는 아니지만, `NodeDetailTabs` 가 "defaultTab" prop을 받아 내부에서 초기화하는 방식이 더 응집도 높다.

---

### 요약

전체 변경은 **addi­tive extension** 원칙을 잘 따른다. 백엔드에서 `RagAccumulator` 인터페이스·레이어 구조를 건드리지 않고 동일 패턴의 인스턴스를 추가했고, 프론트엔드에서는 `output-shape.ts` 파싱 레이어 → `result-detail.tsx` 오케스트레이션 → `conversation-inspector.tsx` UI 의 단방향 데이터 흐름이 유지된다. 그러나 **듀얼 어큐뮬레이터 동기화 불변식이 컴파일러 보호 없이 4개 호출 지점에서만 지켜지는 점**이 가장 큰 구조적 취약점이다. 이를 `RagAccumulatorGroup` 으로 묶는 한 번의 리팩터링으로 불변식을 타입 시스템 수준으로 끌어올릴 수 있다. 성능 측면의 메모이제이션 누락도 실용적인 수준에서 보완이 필요하다.

### 위험도

**LOW**