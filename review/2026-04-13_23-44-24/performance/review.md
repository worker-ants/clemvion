## Performance Code Review

### 발견사항

---

**[CRITICAL]** 전역 Zustand 스토어에 transient hover 상태 저장 → 마우스 이동마다 전체 구독자 리렌더링
- **위치**: `editor-store.ts:20–21`, `editor-store.ts:447–448`
- **상세**: `hoveredNodeId`, `hoveredEdgeId`는 마우스 이동 이벤트마다 갱신되는 고빈도 상태다. 이를 전역 Zustand 스토어에 저장하면 스토어를 구독하는 모든 컴포넌트(노드 패널, 툴바, 각 노드 컴포넌트 등)가 hover 상태 변경마다 리렌더된다. 사용자가 에지 위에 마우스를 올릴 때 초당 수십 번 `set({ hoveredEdgeId })` → 전체 구독자 리렌더 폭풍이 발생한다.
- **제안**: `useEdgeHighlighting` 훅 내부 `useRef`/`useState`로 로컬 관리하거나, 별도 `useUIStore` (zustand slice)를 분리하여 구독 범위를 캔버스 컴포넌트로 한정.

---

**[CRITICAL]** `getConnectedEdgeIds`가 hover 변경마다 전체 엣지 O(E) 선형 탐색
- **위치**: `use-edge-highlighting.ts:28`, `edge-utils.ts:71–78`
- **상세**: `highlightedEdgeIds` useMemo가 `hoveredNodeId` 또는 `selectedNodeId` 기반으로 계산될 때마다 `getConnectedEdgeIds`가 전체 `edges` 배열을 순회한다. 노드 hover/unhover 빈도가 높은 에디터 환경에서는 O(E) 탐색이 매 이벤트마다 반복 실행된다. 엣지 50개 기준으로 노드 위에 마우스를 올리고 내리는 단순 동작도 100회 이상 탐색이 발생할 수 있다.
- **제안**: `nodeId → Set<edgeId>` 역방향 인덱스를 스토어 또는 useMemo로 미리 계산하여 O(1) 조회:
  ```ts
  const nodeEdgeIndex = useMemo(() => {
    const idx = new Map<string, Set<string>>();
    for (const e of edges) {
      if (!idx.has(e.source)) idx.set(e.source, new Set());
      if (!idx.has(e.target)) idx.set(e.target, new Set());
      idx.get(e.source)!.add(e.id);
      idx.get(e.target)!.add(e.id);
    }
    return idx;
  }, [edges]);
  ```

---

**[WARNING]** `enhancedEdges` useMemo가 focus 활성 시 전체 엣지 배열을 매번 재생성
- **위치**: `use-edge-highlighting.ts:37–57`
- **상세**: `isFocusActive`가 true인 상태에서 `edges`, `highlightedEdgeIds`, `isFocusActive` 중 어느 하나라도 변경되면 `edges.map()`이 전체 배열을 순회하며 새 객체를 생성한다. 변경이 없는 엣지도 `wasHighlighted` 체크를 위해 참조 비교가 수행되고, highlight 해제 대상은 새 객체로 교체된다. 글로벌 스토어의 hover 상태 변경이 `edges` prop 변경을 유발하는 경로가 있다면 매 hover 이벤트마다 전체 맵이 실행된다.
- **제안**: 하이라이트 상태를 edge 데이터 외부 `Map<edgeId, boolean>`으로 별도 관리하고, CSS 클래스만 `.className`으로 동적 적용. React Flow의 `edges` 원본 배열을 변경하지 않아 내부 diff 비용을 최소화.

---

**[WARNING]** `isFocusActive`가 `enhancedEdges` useMemo 의존성에 중복 포함
- **위치**: `use-edge-highlighting.ts:55`
- **상세**: `isFocusActive`는 `highlightedEdgeIds !== null && highlightedEdgeIds.size > 0`에서 파생된 값이다. `enhancedEdges` memo deps가 `[edges, highlightedEdgeIds, isFocusActive]`로 두 가지를 모두 포함하므로, `highlightedEdgeIds` 변경 시 `isFocusActive`도 동시에 변경되어 사실상 두 번 트리거로 등록된 것과 같다. React는 실제로 두 번 실행하지 않지만, 의존성 배열의 비교 비용이 불필요하게 증가한다.
- **제안**: `deps`에서 `isFocusActive`를 제거하고 `memo` 내부에서 `highlightedEdgeIds`로 직접 판단:
  ```ts
  }, [edges, highlightedEdgeIds]);
  ```

---

**[WARNING]** 동적 `<style>` 태그 삽입으로 edge hover마다 브라우저 전체 CSSOM 재계산
- **위치**: `workflow-canvas.tsx:422–429`
- **상세**: `hoveredEdgeNodes`가 변경될 때마다 React가 `<style>` 태그를 DOM에 삽입/제거한다. 브라우저는 스타일 시트 변경 시 전체 문서에 대한 스타일 재계산(style recalculation)을 수행한다. 엣지 위에 마우스를 올릴 때마다 이 비용이 발생하며, 복잡한 캔버스(노드 50+개)에서는 체감 가능한 지연이 발생할 수 있다.
- **제안**: React Flow의 `updateNodeData` 또는 `setNodes`로 해당 노드에 className을 직접 부여하거나, `data-glow` attribute를 노드 DOM 요소에 설정하고 `globals.css`에 정적 규칙으로 처리:
  ```css
  .react-flow__node[data-glow] > div {
    box-shadow: 0 0 0 2px hsl(var(--primary) / 0.4);
  }
  ```

---

**[WARNING]** 전역 CSS `transition`이 모든 엣지 path에 적용되어 상시 비용 발생
- **위치**: `globals.css:69–71`
- **상세**: `.react-flow__edge path { transition: opacity 150ms ease, stroke-width 150ms ease; }`가 캔버스 내 모든 엣지 경로에 전역 적용된다. 엣지가 선택되거나 focus 상태가 변경될 때마다 브라우저가 모든 엣지의 transition을 계산한다. ReactFlow의 엣지 렌더링과 결합 시 불필요한 compositing 레이어가 추가될 수 있다.
- **제안**: 기본 상태에서는 transition을 제거하고, focus 활성 상태에서만 적용:
  ```css
  [data-edge-focus-active] .react-flow__edge path {
    transition: opacity 150ms ease;
  }
  ```

---

**[WARNING]** `edge-flow` 무한 CSS 애니메이션에 GPU 가속 힌트 없음
- **위치**: `globals.css:97–110`
- **상세**: `stroke-dashoffset` 애니메이션(`edge-flow 0.6s linear infinite`)은 SVG 속성 변경이므로 기본적으로 메인 스레드에서 처리된다. `will-change` 없이는 GPU 합성 레이어가 생성되지 않아 메인 스레드 페인팅 비용이 발생한다. 여러 엣지가 동시에 강조되면 이 비용이 선형으로 증가한다.
- **제안**: 해당 path 요소에 `will-change: stroke-dashoffset`을 조건부로 추가하거나, `stroke-dashoffset` 대신 CSS `transform: translateX()` 기반 구현으로 교체하여 GPU 합성 레이어 활용. 단, `will-change` 남용 시 메모리 증가에 주의.

---

**[WARNING]** `hoveredEdgeNodes` useMemo가 `edges.find()` O(E) 수행
- **위치**: `use-edge-highlighting.ts:59–64`
- **상세**: `hoveredEdgeId`가 변경될 때마다 `edges.find()`가 O(E) 탐색을 수행한다. 위의 역방향 인덱스 Map이 구축되어 있다면 이 탐색은 O(1)로 개선 가능하다.
- **제안**: `edgeId → edge` 인덱스 Map을 활용하거나, `hoveredEdgeId` 변경 시점에 스토어에서 직접 source/target을 저장.

---

**[INFO]** `enrichEdgesWithPortData`의 O(N+E) 초기화 비용 (허용 가능)
- **위치**: `editor-loader.tsx:49–58`, `edge-utils.ts:82–96`
- **상세**: 워크플로우 로드 시 노드 Map 구축(O(N))과 엣지 순회(O(E))가 추가된다. 이는 일회성 초기화 비용으로, 비동기 API 호출 이후에 실행되므로 UX에 미치는 영향은 미미하다. 현재 구현은 적절하다.

---

**[INFO]** `markerId` 문자열 템플릿 연산이 모든 엣지 렌더마다 실행
- **위치**: `custom-edge.tsx:55–57`
- **상세**: `` `arrow-${portType}-bright` `` / `` `arrow-${portType}` `` 템플릿 리터럴이 매 렌더마다 새 문자열을 생성한다. `portType`은 엣지 로드 시 한 번 결정되고 이후 변경되지 않으므로, `useMemo`나 `data`에 미리 저장된 값을 활용하면 문자열 할당을 제거할 수 있다. 엣지 수가 많을수록 누적 비용이 발생한다.
- **제안**: `buildEdgeData`에서 `markerId`도 미리 계산하여 `edge.data`에 저장하거나, `getMarkerIdForPortType` 함수를 활용.

---

### 요약

이번 변경의 핵심 성능 위험은 **고빈도 이벤트(마우스 hover)가 전역 상태 → 전체 구독자 리렌더를 유발하는 연쇄 반응**에 있다. `hoveredNodeId`/`hoveredEdgeId`를 전역 Zustand 스토어에 저장한 결과, 마우스가 에지 위를 지날 때마다 스토어 전체 구독자가 리렌더되고, `useEdgeHighlighting`의 `enhancedEdges` useMemo가 실행되어 전체 엣지 배열을 재순회한다. 여기에 `getConnectedEdgeIds`의 O(E) 탐색이 hover마다 추가되며, 동적 `<style>` 태그 삽입이 브라우저 전체 CSSOM 재계산을 유발한다. `will-change` 없는 SVG 무한 애니메이션도 메인 스레드 부담을 가중시킨다. hover 상태를 로컬 또는 분리된 UI 스토어로 이전하고, 엣지-노드 역방향 인덱스로 탐색 비용을 O(1)로 낮추며, 동적 style 태그를 data 속성 기반 CSS로 대체하는 것이 최우선 개선 과제다.

### 위험도

**HIGH**