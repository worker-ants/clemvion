이제 실제 테스트 파일들과 디렉토리를 확인했습니다. 리뷰를 작성하겠습니다.

---

## Testing Code Review — 테스팅 관점

### 발견사항

---

**[CRITICAL] `use-edge-highlighting.ts` 테스트 전무 — 핵심 UX 로직 미검증**
- 위치: `frontend/src/components/editor/canvas/use-edge-highlighting.ts` 전체
- 상세: 이 훅은 엣지 하이라이팅 기능의 핵심 비즈니스 로직을 담당한다. `hoveredEdge > hoveredNode > selectedNode` 우선순위 결정, `isFocusActive` 계산, className 누적/제거, `isHighlighted` 플래그 토글, `hoveredEdgeNodes` 산출 등 5개의 독립적 경로가 있으나 단 하나의 테스트도 없다.
  ```ts
  // 누락된 핵심 시나리오 예시
  // 1. 우선순위: hoveredEdge가 있으면 hoveredNode는 무시되어야 함
  // 2. isFocusActive=false일 때 원본 edges 참조 반환 (성능 최적화)
  // 3. 포커스 해제 시 isHighlighted: false로 업데이트
  // 4. 존재하지 않는 edgeId hover 시 모든 엣지 dim 처리
  ```
- 제안: `@testing-library/react`의 `renderHook`과 Zustand `setState`를 활용하여 최소 아래 케이스를 커버하는 테스트 작성:
  ```ts
  // use-edge-highlighting.test.ts
  it("returns original edges reference when no focus", () => { ... });
  it("hoveredEdge takes priority over hoveredNode", () => { ... });
  it("removes edge-highlighted class when focus deactivated", () => { ... });
  it("isFocusActive is false when no node/edge is hovered or selected", () => { ... });
  ```

---

**[CRITICAL] `edge-utils.test.ts`의 `enrichEdgesWithPortData` — 단일 happy path만 검증**
- 위치: `edge-utils.test.ts:100-138`
- 상세: `data` 및 `error` 타입 2개 엣지만 테스트한다. 다음 경로들이 검증되지 않는다:
  - source 노드가 `nodes` 배열에 없을 때 → 빈 문자열로 폴백 → `"data"` 타입 반환 확인
  - `ai_agent` 노드에서 나오는 `out`, `user_ended`, `max_turns` 핸들 → `"system"` 타입
  - 컨테이너 노드(`loop`)의 `done` 핸들 → `"system"` 타입
  - `body` 핸들 → `"container"` 타입
  - 빈 `edges` / `nodes` 배열 입력
- 제안:
  ```ts
  it("source node not in nodes falls back to data type", () => {
    const edges = [{ id: "e1", source: "missing", target: "n1", sourceHandle: "out", ...}];
    const enriched = enrichEdgesWithPortData(edges, []);
    expect(enriched[0].data?.portType).toBe("data");
  });

  it("enriches ai_agent out handle as system type", () => {
    const nodes = [{ id: "n1", position: { x: 0, y: 0 }, data: { type: "ai_agent" } }];
    const edges = [{ id: "e1", source: "n1", target: "n2", sourceHandle: "out", ...}];
    expect(enrichEdgesWithPortData(edges, nodes)[0].data?.portType).toBe("system");
  });
  ```

---

**[WARNING] `editor-store.test.ts` — 새로운 `onConnect` 변경사항 미반영**
- 위치: `frontend/src/lib/stores/__tests__/editor-store.test.ts`
- 상세: `onConnect`가 `buildEdgeData`를 호출해 엣지에 `portType`, `portColor`, `sourcePort`를 설정하는 로직이 추가되었으나 스토어 테스트에 관련 케이스가 없다. 현재 `initialState`에 `hoveredNodeId`, `hoveredEdgeId`도 누락되어 있어, 향후 `setState`로 초기화할 때 타입 불일치가 발생할 수 있다.
  ```ts
  // initialState에 누락된 필드
  const initialState = {
    ...
    hoveredNodeId: null,  // 없음
    hoveredEdgeId: null,  // 없음
  };
  ```
- 제안:
  ```ts
  describe("onConnect", () => {
    it("attaches portType data to new edge", () => {
      const nodes = [makeNode("a", { data: { type: "manual_trigger" } })];
      useEditorStore.setState({ nodes, edges: [] });
      useEditorStore.getState().onConnect({ source: "a", target: "b", sourceHandle: "out", targetHandle: "in" });
      const edge = useEditorStore.getState().edges[0];
      expect(edge.data?.portType).toBe("data");
    });
  });

  describe("setHoveredNode / setHoveredEdge", () => {
    it("sets and clears hoveredNodeId", () => {
      useEditorStore.getState().setHoveredNode("n1");
      expect(useEditorStore.getState().hoveredNodeId).toBe("n1");
      useEditorStore.getState().setHoveredNode(null);
      expect(useEditorStore.getState().hoveredNodeId).toBeNull();
    });
  });
  ```

---

**[WARNING] `setWorkflow` 테스트 — hover 상태 초기화 누락 검증 없음**
- 위치: `editor-store.test.ts:107-124`
- 상세: `setWorkflow` 테스트가 `undoStack`, `redoStack` 초기화를 확인하지만 `hoveredNodeId`, `hoveredEdgeId`가 `null`로 리셋되는지 검증하지 않는다. side_effect 리뷰에서 지적된 실제 버그(워크플로우 전환 시 이전 hover 상태 잔존)가 테스트로 보호되지 않는다.
- 제안:
  ```ts
  it("resets hover state on workflow switch", () => {
    useEditorStore.setState({ hoveredNodeId: "old-node", hoveredEdgeId: "old-edge" });
    useEditorStore.getState().setWorkflow("wf-2", "New", [], []);
    expect(useEditorStore.getState().hoveredNodeId).toBeNull();
    expect(useEditorStore.getState().hoveredEdgeId).toBeNull();
  });
  ```

---

**[WARNING] `formatLabel` 순수 함수 테스트 없음**
- 위치: `frontend/src/components/editor/canvas/custom-edge.tsx:18-31`
- 상세: `formatLabel`은 `case_N`, `branch_N` 번호 파싱, 특수값(`true/false/default/done/error`) 변환, 일반 문자열 대문자화 등 6개의 분기를 가진 순수 함수이나 `export`되지 않아 테스트가 불가능하다.
- 제안: `formatLabel`을 `edge-utils.ts`로 이동하고 `export`한 후 테스트 추가:
  ```ts
  it("formats case_ ports with 1-indexed display", () => {
    expect(formatLabel("case_0")).toBe("Case 1");
    expect(formatLabel("case_3")).toBe("Case 4");
  });
  it("formats branch_ ports", () => {
    expect(formatLabel("branch_0")).toBe("Branch 1");
  });
  it("capitalizes unknown port names", () => {
    expect(formatLabel("myCustomPort")).toBe("MyCustomPort");
  });
  ```

---

**[WARNING] `editor-loader.tsx` 비동기 로딩 로직 테스트 없음**
- 위치: `frontend/src/app/(editor)/workflows/[id]/editor-loader.tsx`
- 상세: concurrency 리뷰에서 지적된 race condition(취소 플래그 부재)뿐 아니라, `enrichEdgesWithPortData`가 실제로 적용되는지, API 오류 시 `error` 상태가 설정되는지, 로딩 상태가 올바르게 전환되는지 검증하는 테스트가 없다. 이는 워크플로우 초기 로딩의 핵심 경로다.
- 제안: `workflowsApi`를 mock하여 컴포넌트 테스트 작성:
  ```ts
  it("calls enrichEdgesWithPortData during load", async () => {
    // workflowsApi.get, getNodes, getEdges mock 설정
    // renderWithProviders(<WorkflowEditorLoader workflowId="wf-1" />)
    // setWorkflow 호출 시 edges에 portType 포함 확인
  });

  it("sets error state when API fails", async () => { ... });
  ```

---

**[INFO] `resolvePortType` — `"emit"` 핸들 및 미정의 컨테이너 타입 테스트 누락**
- 위치: `edge-utils.test.ts:8-55`
- 상세: 현재 테스트는 `ai_agent`의 알려진 시스템 포트와 일반 데이터 포트만 검증한다. `"emit"` 핸들(컨테이너 이벤트 방출), 알 수 없는 nodeType의 폴백, 노드 정의에 없는 포트 등의 경계값이 누락되어 있다.
- 제안:
  ```ts
  it("returns 'data' for unknown node type", () => {
    expect(resolvePortType("out", "unknown_node_type")).toBe("data");
  });

  it("returns 'data' for empty sourceHandle string treated as falsy-ish", () => {
    expect(resolvePortType("", "manual_trigger")).toBe("data");
  });
  ```

---

**[INFO] `getConnectedEdgeIds` — 양방향 엣지 케이스 미검증**
- 위치: `edge-utils.test.ts:82-112`
- 상세: 현재 테스트는 단방향 관계만 확인한다. 같은 노드가 source와 target으로 모두 등장하는 경우(자기 참조 엣지 또는 사이클)가 커버되지 않는다. 또한 동일한 노드 쌍 사이에 여러 엣지가 있는 경우도 미검증이다.
- 제안:
  ```ts
  it("handles node appearing as both source and target in different edges", () => {
    const edges = [
      { id: "e1", source: "a", target: "b" },
      { id: "e2", source: "b", target: "a" },
    ];
    expect(getConnectedEdgeIds("a", edges)).toEqual(new Set(["e1", "e2"]));
  });
  ```

---

**[INFO] `edge-utils.test.ts` — 파일 수준 맥락 설명 부재**
- 위치: `edge-utils.test.ts:1`
- 상세: 테스트 파일 최상단에 어떤 모듈을 테스트하고 어떤 범위를 커버하는지 설명이 없다. 테스트 케이스 자체는 명확하나 파일 수준의 맥락이 없어 새 기여자가 테스트 구조를 파악하기 어렵다.

---

### 요약

`edge-utils.ts`에 대한 단위 테스트(`edge-utils.test.ts`)가 신규 작성된 점은 긍정적이나, 이번 변경의 핵심 로직인 `use-edge-highlighting.ts` 훅이 테스트 없이 릴리즈된 것이 가장 큰 문제다. 이 훅은 우선순위 기반 포커스 결정, 엣지 className 생성/제거, React Flow 성능 최적화(참조 동일성 유지) 등 검증이 필요한 복잡한 상태 전환 로직을 담고 있다. 또한 `editor-store.test.ts`의 `initialState`가 새로 추가된 `hoveredNodeId`/`hoveredEdgeId` 필드를 누락하여 타입 안전성이 깨져 있고, `onConnect`의 `buildEdgeData` 연동 및 `setWorkflow`의 hover 상태 초기화 여부가 전혀 검증되지 않는다. `enrichEdgesWithPortData`는 시스템/컨테이너 포트 타입을 테스트하지 않아 핵심 분류 로직의 커버리지 갭이 있다. `formatLabel`은 `export`되지 않아 테스트 자체가 불가능한 구조적 문제가 있다.

### 위험도

**HIGH** — `use-edge-highlighting.ts` 테스트 완전 부재와 `editor-store.test.ts`의 신규 상태 미반영이 결합되어, 리팩토링 시 핵심 UX 동작의 회귀를 감지할 수단이 없다.