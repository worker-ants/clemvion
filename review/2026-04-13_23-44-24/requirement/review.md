## 요구사항 코드 리뷰 — Requirement 관점

---

### 발견사항

---

**[CRITICAL]** `useEdgeHighlighting` 핵심 비즈니스 로직 테스트 완전 부재
- **위치**: `use-edge-highlighting.ts` 전체
- **상세**: 이번 변경의 핵심 요구사항인 hover/select 우선순위 로직(`hoveredEdge > hoveredNode > selectedNode`), `isFocusActive` 전환, `isHighlighted` className 토글, 포커스 해제 시 상태 복원 모두 테스트가 없습니다. `edge-utils.test.ts`, `edge-pathfinding.test.ts`는 작성되었으나 가장 복잡한 UX 로직을 담당하는 이 훅만 누락되었습니다.
- **제안**: `renderHook`을 사용하여 다음 시나리오를 최소 검증하세요.
  ```ts
  // 우선순위: hoveredEdge가 hoveredNode보다 우선
  // isFocusActive=false 시 원본 edges 참조 반환 (성능 최적화 보장)
  // 포커스 해제 시 isHighlighted=false 로 복원
  // hoveredEdgeNodes sourceId/targetId 정확성
  ```

---

**[CRITICAL]** `findSmartPath` A* 경로탐색에 에러 처리 부재
- **위치**: `edge-pathfinding.ts`, `findSmartPath` 함수
- **상세**: `PF.AStarFinder.findPath()` 및 `PF.Util.smoothenPath()` 호출에 try/catch가 없습니다. A* 라이브러리 내부 예외 발생 시 `CustomEdgeComponent` 렌더링이 크래시되어 캔버스 전체가 동작 불가 상태가 됩니다. 소스/타겟 좌표가 그리드 범위를 벗어나는 경우 등 edge case에서 라이브러리가 throw할 수 있습니다.
- **제안**: 
  ```ts
  try {
    const rawPath = finder.findPath(startCol, startRow, endCol, endRow, grid);
    // ...
  } catch {
    return null; // 베지어 폴백
  }
  ```

---

**[WARNING]** "Bright" 마커가 일반 마커와 동일한 색상 — 기능 불완전
- **위치**: `custom-edge.tsx`, `EdgeMarkerDefs`
- **상세**: 요구사항은 하이라이트된 엣지를 시각적으로 구분하는 것이나, `arrow-data-bright`, `arrow-system-bright` 등 모든 `-bright` 마커가 `PORT_TYPE_COLORS`의 동일한 값을 사용합니다. `markerId` 로직은 하이라이트/선택 시 `-bright` 마커를 가리키도록 올바르게 구현되어 있으나, 실제 마커 정의에서 색상 차이가 없어 기능이 절반만 구현된 상태입니다.
- **제안**: bright 마커에 명확히 구분되는 색상을 적용하거나, `-bright` 마커 세트를 제거하고 `markerId`를 `arrow-${portType}` 단일 패턴으로 통일하세요.

---

**[WARNING]** `wouldIntersectNode` — 베지어 곡선 대신 직선 샘플링으로 false negative 발생
- **위치**: `edge-pathfinding.ts`, `wouldIntersectNode` 함수
- **상세**: 요구사항은 엣지가 노드를 통과할 때 A* 경로탐색을 활성화하는 것이나, `midOffsetX = 0`, `midOffsetY = 0`으로 고정되어 실제로는 직선 보간만 수행합니다. 실제 렌더링은 베지어 곡선이므로, 곡선이 노드를 통과하더라도 직선이 교차하지 않으면 pathfinding이 발동되지 않는 기능 누락이 발생합니다. 주석의 "Approximate a bezier curve midpoint offset"과 실제 동작 불일치.
- **제안**: dead variable(`midOffsetX`, `midOffsetY`)을 제거하고 주석을 `// Check intersection using straight-line approximation` 으로 수정하거나, 실제 베지어 제어점으로 샘플링하세요.

---

**[WARNING]** `useEffect` cleanup 부재 — 워크플로우 전환 시 race condition
- **위치**: `editor-loader.tsx`, `useEffect` 내 `load()` 함수
- **상세**: `workflowId`가 변경되면 이전 `load()` 비동기 실행이 취소되지 않습니다. 이전 요청이 새 요청보다 늦게 완료되면 오래된 워크플로우 데이터로 `setWorkflow`가 호출되어 최신 상태를 덮어씁니다. 사용자가 워크플로우를 빠르게 전환하는 시나리오에서 잘못된 데이터가 표시됩니다.
- **제안**:
  ```ts
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [...] = await Promise.all([...]);
        if (cancelled) return;
        setWorkflow(workflowId, ...);
      } catch (err) {
        if (!cancelled) setError(...);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [workflowId, setWorkflow]);
  ```

---

**[WARNING]** `hoveredEdgeId` 유효성 검증 없음 — 전체 엣지 dim 처리 오동작
- **위치**: `use-edge-highlighting.ts:28-32`
- **상세**: `hoveredEdgeId`에 실제로 존재하지 않는 엣지 ID가 설정되면 `highlightedEdgeIds`가 크기 1 Set이 되어 `isFocusActive=true`가 됩니다. 그러나 해당 ID를 가진 엣지가 없으므로 하이라이트된 엣지 없이 모든 엣지가 dim 처리되는 혼란스러운 UX가 됩니다.
- **제안**: `hoveredEdgeId`가 실제 존재하는 엣지인지 확인 후 Set을 구성하세요.
  ```ts
  if (hoveredEdgeId) {
    const exists = edges.some(e => e.id === hoveredEdgeId);
    return exists ? new Set([hoveredEdgeId]) : null;
  }
  ```

---

**[WARNING]** `enrichEdgesWithPortData` 엣지 케이스 — 테스트 불충분
- **위치**: `edge-utils.test.ts:114-138`
- **상세**: 정상 케이스 하나만 테스트됩니다. 다음 시나리오가 검증되지 않았습니다: source 노드가 `nodes` 배열에 없을 때, `ai_agent` 시스템 포트(`out`, `user_ended`), 컨테이너 `done` 포트, 빈 배열 입력. `editor-loader.tsx`에서 이 함수를 실제 워크플로우 로드에 사용하므로 커버리지가 중요합니다.
- **제안**: 누락된 케이스에 대한 테스트를 추가하세요.

---

**[WARNING]** `getMarkerIdForPortType` 미사용 함수 (dead export)
- **위치**: `edge-utils.ts:56-65`
- **상세**: 함수가 export되고 테스트까지 작성되어 있으나, `custom-edge.tsx`에서는 `` `arrow-${portType}` `` 템플릿 리터럴로 직접 마커 ID를 구성합니다. 프로덕션 코드에서 호출되지 않는 함수에 테스트를 작성한 것은 관리 비용만 증가시킵니다.
- **제안**: `custom-edge.tsx`에서 이 함수를 활용하거나, 사용하지 않는다면 함수와 테스트 모두 제거하세요.

---

**[WARNING]** `edgeStroke`에서 `isError` 분기 중복 — 의도와 구현 불일치
- **위치**: `custom-edge.tsx:44-51`
- **상세**: `portType === "error"` 이면 `portColor`는 이미 `PORT_TYPE_COLORS.error`입니다. 별도 `isError` 분기에서 `PORT_TYPE_COLORS.error`를 반환하는 것은 동일한 결과입니다. 단, 선택(selected) 상태일 때 에러 엣지가 `hsl(var(--primary))`로 렌더링되는 기존 동작이 사라진 것이 의도된 변경인지 불명확합니다.
- **제안**: `isError` 분기를 제거하고 `props.selected ? "hsl(var(--primary))" : portColor`로 단순화하거나, 에러 엣지 선택 시 색상 동작에 대한 명시적 결정을 내리세요.

---

**[INFO]** `setWorkflow` 호출 시 hover 상태 초기화 누락
- **위치**: `editor-store.ts`, `setWorkflow` 액션
- **상세**: 워크플로우 전환 시 `undoStack`, `redoStack`은 초기화하지만 `hoveredNodeId`, `hoveredEdgeId`는 초기화하지 않습니다. 워크플로우 간 이동 중 마우스가 노드 위에 있는 경우 이전 워크플로우의 hover 상태가 잔존할 수 있습니다.
- **제안**: `setWorkflow`에 `hoveredNodeId: null, hoveredEdgeId: null` 초기화를 추가하세요.

---

**[INFO]** Catmull-Rom tension 주석 불일치 (`0.5` vs `6`)
- **위치**: `edge-pathfinding.ts`, `pointsToSvgPath` 함수
- **상세**: `// Catmull-Rom to cubic bezier control points (tension = 0.5)` 주석과 달리 실제 값은 `const tension = 6`입니다. tension이 크면 제어점 오프셋이 작아져 더 직선에 가까운 곡선이 생성됩니다. 유지보수 시 잘못된 방향으로 수정이 이루어질 수 있습니다.
- **제안**: 주석을 실제 값(`tension = 6`)에 맞게 수정하거나 `const CATMULL_ROM_TENSION = 6`으로 명명하세요.

---

**[INFO]** Legacy 마커 잔존 — 사용 여부 미확인
- **위치**: `custom-edge.tsx`, `EdgeMarkerDefs`
- **상세**: 포트 타입 기반 마커 시스템으로 전환되었으나 "backward compatibility" 명목으로 `arrow`, `arrow-selected` 구 마커가 유지됩니다. 코드베이스 전체에서 이 마커를 참조하는 곳이 없다면 불필요한 잔재입니다.
- **제안**: 코드베이스 전체에서 `url(#arrow)`, `url(#arrow-selected)` 참조 여부를 확인하고, 없다면 제거하세요.

---

### 요약

이번 변경은 엣지 하이라이팅, 포트 타입 색상 분류, 스마트 경로 탐색이라는 세 가지 기능을 추가했습니다. 비즈니스 로직의 설계 방향(우선순위 기반 하이라이팅, 포트 타입별 색상 매핑)은 올바르나, 핵심 UX 로직인 `useEdgeHighlighting` 훅에 테스트가 전혀 없고, A* 경로탐색에 예외 처리가 없어 크래시 위험이 존재합니다. "Bright" 마커 기능은 의도만 있고 실제 시각적 차이가 없어 절반만 구현된 상태이며, `wouldIntersectNode`의 직선-베지어 불일치로 pathfinding이 필요한 경우를 놓칠 수 있습니다. `editor-loader.tsx`의 race condition과 `hoveredEdgeId` 유효성 검증 부재는 실제 사용 시 비정상 상태를 유발할 수 있는 요구사항 미충족 항목입니다.

### 위험도

**MEDIUM**