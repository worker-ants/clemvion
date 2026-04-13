## 부작용(Side Effect) 코드 리뷰

---

### 발견사항

---

**[WARNING] 전역 Zustand 스토어에 UI hover 상태 추가 — hover 시마다 스토어 전체 구독자 리렌더**
- **위치**: `editor-store.ts:20-21`, `setHoveredNode`/`setHoveredEdge` 액션
- **상세**: `hoveredNodeId`, `hoveredEdgeId`가 `set({ hoveredNodeId: id })` 형태로 업데이트됨. Zustand는 `set` 호출마다 전체 구독자에게 알림을 발송하므로, 마우스가 노드/엣지 위를 이동할 때마다 노드 설정 패널, 툴바 등 hover와 무관한 컴포넌트가 리렌더됨.
- **제안**: `useEdgeHighlighting` 훅 내부 `useRef`/`useState`로 관리하거나, 별도 `useUIStore` Zustand slice로 분리하여 구독 범위 최소화.

---

**[WARNING] `setWorkflow` 호출 시 `hoveredNodeId`/`hoveredEdgeId` 미초기화 — stale 상태 잔존**
- **위치**: `editor-store.ts` `setWorkflow` 액션 (관련 코드 위치 확인 필요)
- **상세**: 워크플로우 전환 시 `nodes`, `edges`, `undoStack`, `redoStack`은 초기화되지만 새로 추가된 두 hover 상태는 초기화되지 않음. 빠른 워크플로우 전환 시 이전 워크플로우의 hover 상태가 남아 새 워크플로우에서 `isFocusActive=true`를 유지하며 잘못된 엣지 dimming이 야기될 수 있음.
- **제안**: `setWorkflow` 내에 `hoveredNodeId: null, hoveredEdgeId: null` 추가.

---

**[WARNING] `enrichEdgesWithPortData`가 기존 `edge.data`를 완전히 교체**
- **위치**: `edge-utils.ts:98-109`
- **상세**:
  ```typescript
  return { ...edge, data }; // 기존 edge.data를 완전히 덮어씀
  ```
  API 응답에 `edge.data`에 프론트엔드가 인식하지 못하는 추가 필드가 있을 경우 해당 데이터가 손실됨. 현재 API 계약상 문제는 없으나, 향후 백엔드 스키마 확장 시 데이터 유실 위험.
- **제안**: `return { ...edge, data: { ...(edge.data as object ?? {}), ...newData } }` 형태로 기존 data를 보존.

---

**[WARNING] `onConnect`에서 `sourceNode` 미발견 시 포트 타입 오분류**
- **위치**: `editor-store.ts:386-394`
- **상세**: `state.nodes.find((n) => n.id === connection.source)`가 `undefined`를 반환하면 `sourceNodeType`이 `""`로 폴백함. `resolvePortType("out", "")` 호출 시 AI Agent의 `out` 포트(system), Loop의 `done` 포트(system) 등이 모두 `"data"` 타입으로 잘못 분류됨 — 포트 색상이 초록(data)으로 잘못 렌더링됨.
- **제안**: sourceNode 미발견 시 경고 로깅 추가. 또는 `connection.source`가 `state.nodes`에 반드시 존재함을 보장하는 단언.

---

**[WARNING] 전역 CSS `.react-flow__edge path` transition 추가로 기존 상호작용 변화**
- **위치**: `globals.css:68-70`
- **상세**:
  ```css
  .react-flow__edge path {
    transition: opacity 150ms ease, stroke-width 150ms ease;
  }
  ```
  모든 ReactFlow 엣지 path에 전역 transition이 적용됨. 기존에 즉각적이던 엣지 선택(selected) 시각 피드백, 오류 상태 표시(`strokeDasharray` 전환)가 150ms 지연으로 변경됨. 의도된 변경이나 기존 UX 즉각성을 제거하는 광범위한 부작용.

---

**[WARNING] 동적 `<style>` 태그가 스타일 재계산(Recalculation)을 전체 문서에 강제**
- **위치**: `workflow-canvas.tsx:420-429`
- **상세**: `hoveredEdgeNodes`가 변경될 때마다 `<style>` 태그가 DOM에 삽입/제거됨. 브라우저는 `<style>` 태그 변경 시 전체 문서 스타일 재계산을 수행함. 엣지 hover 시마다 이 비용이 발생하여 복잡한 페이지에서 Frame jank 유발 가능.
  
  추가로, `hoveredEdgeNodes.sourceId`가 CSS 선택자에 직접 보간됨. React의 XSS 보호는 `<style>` 문자열 보간에 적용되지 않으며, ID 값에 `"]` 문자가 포함될 경우 선택자 구조가 파괴됨.
  ```tsx
  .react-flow__node[data-id="${hoveredEdgeNodes.sourceId}"] > div
  // sourceId에 특수 문자 포함 시 셀렉터 파괴 가능
  ```
- **제안**: `CSS.escape(id)` 적용 또는 노드 className/`updateNodeData` API 기반 접근으로 교체.

---

**[INFO] `useEdgeHighlighting`의 `isFocusActive` 전환 시 전체 엣지 배열 재생성**
- **위치**: `use-edge-highlighting.ts:38-57`
- **상세**: `isFocusActive`가 true로 전환될 때 `enhancedEdges` useMemo가 실행되어 전체 엣지 배열을 순회하며 새 객체를 생성함. React Flow는 새 객체를 받으면 해당 엣지를 리렌더 대상으로 처리. 노드 hover 시작/종료마다 O(N) 엣지 객체 생성이 발생하며, 이 새 객체들이 `enhancedEdges`로 ReactFlow에 전달되어 추가 diff 비용을 유발.

---

**[INFO] `arrow-selected` 레거시 마커가 더 이상 참조되지 않음**
- **위치**: `custom-edge.tsx:199-200`
- **상세**: `markerId`가 이제 `arrow-${portType}` 또는 `arrow-${portType}-bright`를 사용하므로 `arrow-selected` 마커는 프로덕션 코드에서 참조되지 않음. Backward compatibility 주석이 있으나 실제 사용처가 없는 dead code.
- **제안**: 코드베이스 전체에서 `url(#arrow-selected)` 참조 여부 확인 후 제거.

---

**[INFO] `isFocusActive` 중복 의존성**
- **위치**: `use-edge-highlighting.ts:39-57`
- **상세**: `enhancedEdges` useMemo의 의존성 배열이 `[edges, highlightedEdgeIds, isFocusActive]`로 구성되어 있으나, `isFocusActive`는 `highlightedEdgeIds`에서 파생된 값. `highlightedEdgeIds` 변경 시 `isFocusActive`도 동시에 변경되므로 실질적으로 중복 의존성이지만 memo 재계산 조건이 불필요하게 늘어남.
- **제안**: `isFocusActive`를 의존성 배열에서 제거.

---

### 요약

이번 변경의 핵심 부작용은 세 영역에 집중됩니다. 첫째, `hoveredNodeId`/`hoveredEdgeId`를 전역 Zustand 스토어에 추가하여 마우스 이동마다 스토어 전체 구독자가 리렌더되는 성능 부작용이 발생하며, `setWorkflow` 시 해당 상태가 초기화되지 않아 워크플로우 전환 시 stale 상태가 잔존할 수 있습니다. 둘째, `globals.css`의 전역 `.react-flow__edge path` transition 추가로 기존 모든 엣지의 즉각적 시각 피드백이 150ms 지연으로 변경되는 의도치 않은 광범위한 부작용이 있습니다. 셋째, 동적 `<style>` 태그의 노드 ID 직접 보간은 hover 시마다 전체 문서 스타일 재계산을 유발하고 구조적으로 CSS injection 패턴을 내포합니다. `enrichEdgesWithPortData`의 기존 `data` 필드 완전 교체와 `onConnect`의 `sourceNode` 미발견 시 포트 타입 오분류 가능성도 개선이 필요한 부작용입니다.

### 위험도

**MEDIUM**