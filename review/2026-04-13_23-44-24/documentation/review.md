### 발견사항

---

- **[WARNING]** `edge-pathfinding.ts` — Catmull-Rom tension 주석과 실제 구현값 불일치
  - 위치: `edge-pathfinding.ts`, `pointsToSvgPath` 함수 내 tension 변수 선언부
  - 상세: `// Catmull-Rom to cubic bezier control points (tension = 0.5)` 주석이 있으나 실제 코드는 `const tension = 6;`으로 선언되어 있음. 알고리즘을 수정하려는 개발자가 `0.5`를 기준으로 변경을 시도할 경우 의도와 다른 결과가 나올 수 있음
  - 제안: `// Catmull-Rom to cubic bezier control points (tension factor = 6; higher value → tighter curves closer to straight line)`으로 수정, 또는 `const CATMULL_ROM_TENSION = 6;` 상수로 분리하여 명명 자체로 의도를 전달

---

- **[WARNING]** `edge-pathfinding.ts` — 항상 0인 변수에 "베지어 근사" 주석 부착
  - 위치: `wouldIntersectNode` 함수, `midOffsetX` / `midOffsetY` 선언부
  - 상세: 두 변수가 `= 0`으로 고정되어 수식 `midOffsetX * 4*t*(1-t)`의 항이 항상 0이 되어 실제로는 단순 선형 보간만 수행됨. 주석 `// Approximate a bezier curve midpoint offset`은 구현 의도와 실제 동작 모두를 잘못 설명하는 이중 오류
  - 제안: 변수 두 개와 해당 주석을 제거하고 수식을 `const x = (1 - t) * sourceX + t * targetX;`로 단순화하거나, 실제 베지어 제어점 오프셋을 구현할 경우 의미 있는 값을 채울 것

---

- **[INFO]** `custom-edge.tsx` — "Bright markers" 주석이 실제 동작을 오해하게 함
  - 위치: `EdgeMarkerDefs` 함수, `{/* Bright markers for selected/highlighted edges */}` 주석
  - 상세: `arrow-data-bright` 등 `-bright` 마커 모두 `PORT_TYPE_COLORS` 동일값 사용. 주석은 일반 마커와 다른 밝기를 암시하지만 실제로는 동일한 색상이므로 유지보수자에게 미완성 기능인지 의도적 설계인지 불명확함
  - 제안: 의도가 미래 확장을 위한 예약이라면 `{/* Markers for highlighted/selected edges — reserved for brightness distinction; currently same colors as normal markers */}`로 수정하거나, bright/normal 구분 자체를 제거하고 단일 마커 세트로 통합

---

- **[INFO]** `editor-store.ts` — 새로 추가된 hover 상태 필드에 인라인 주석 없음
  - 위치: `EditorState` 인터페이스, `hoveredNodeId` / `hoveredEdgeId` 필드 (라인 20–21)
  - 상세: Canvas state 섹션에 추가된 두 필드에 어떤 설명도 없음. 같은 섹션의 `selectedNodeId`도 주석이 없으나 이름이 자명한 반면, hover 상태가 비즈니스 스토어에 있는 이유가 불명확하여 후속 개발자가 의문을 가질 수 있음
  - 제안:
    ```ts
    hoveredNodeId: string | null; // ID of the node currently under the pointer (drives edge highlight)
    hoveredEdgeId: string | null; // ID of the edge currently under the pointer (highest priority for highlight)
    ```

---

- **[INFO]** `workflow-canvas.tsx` — 동적 `<style>` 주입 블록에 선택 이유 설명 없음
  - 위치: `{hoveredEdgeNodes && (<style>...</style>)}` 블록
  - 상세: `data-id` 셀렉터로 노드 glow를 적용하는 방식은 React 표준 패턴(className/data prop)과 다름. 왜 `updateNodeData`나 className 기반 방식이 아닌 이 방식을 선택했는지 이유가 없으면 후속 개발자가 "안전한 리팩토링 대상"으로 오해할 수 있음
  - 제안: 블록 위에 주석 추가 — `{/* React Flow does not provide a per-node style API; <style> injection with data-id selector is used to apply hover glow without triggering node data updates on every pointer event */}`

---

- **[INFO]** `edge-utils.ts` — `getMarkerIdForPortType` 함수가 실제로 사용되지 않음에도 export 및 테스트 포함
  - 위치: `edge-utils.ts:59-65`, `edge-utils.test.ts:71-81`
  - 상세: `custom-edge.tsx`는 마커 ID를 `` `arrow-${portType}` `` 패턴으로 직접 구성하므로 이 함수는 dead export. 테스트까지 작성되어 있어 유효한 API처럼 보이지만 실사용 코드가 없음
  - 제안: `custom-edge.tsx`에서 이 함수를 활용하도록 변경하거나, 사용하지 않는다면 함수와 테스트를 제거

---

- **[INFO]** 테스트 파일 모듈 수준 문서화 부재
  - 위치: `__tests__/edge-utils.test.ts` 파일 상단
  - 상세: 테스트 케이스 자체의 설명은 충분하지만 파일 수준 맥락(어떤 모듈의 무엇을 커버하는지)이 없음. `edge-pathfinding.test.ts`도 동일
  - 제안: 각 파일 상단에 `/** @module edge-utils — tests for port type resolution, edge color mapping, and edge enrichment utilities */` 형태의 JSDoc 추가

---

- **[INFO]** README 미갱신
  - 위치: 프로젝트 루트 또는 `frontend/` README
  - 상세: (1) 포트 타입별 엣지 색상 시스템 (data=초록, system=파랑, error=빨강, container=보라), (2) 노드/엣지 호버 하이라이팅, (3) `pathfinding` 런타임 의존성 추가라는 세 가지 사용자 가시적 변경이 있으나 README에 반영되지 않음
  - 제안: 에디터 캔버스 UX 섹션에 포트 색상 규칙과 인터랙션 동작(노드 선택/호버 시 연결된 엣지 강조)을 간략히 기술

---

### 요약

새로 추가된 파일(`edge-utils.ts`, `use-edge-highlighting.ts`)은 JSDoc이 함수 단위로 충실하게 작성되어 있고, `globals.css`의 Edge Highlighting 섹션도 각 규칙에 의도를 설명하는 주석이 갖춰져 있어 문서화 수준이 전반적으로 양호하다. 그러나 `edge-pathfinding.ts`의 두 가지 주석 오류 — tension 값 불일치(`0.5` vs 실제 `6`)와 항상 0인 변수에 붙은 베지어 근사 주석 — 는 기능 수정 시 잘못된 방향으로 유도할 수 있는 적극적 오류다. "Bright markers" 주석은 실제 색상 차이 없이 이름만 존재하는 상태를 감추고 있으며, 동적 `<style>` 주입 블록은 비표준 패턴임에도 선택 이유가 기록되지 않아 향후 "개선 대상"으로 무분별하게 삭제될 위험이 있다. `getMarkerIdForPortType`의 dead export와 README 미갱신은 외부 참조 문서와 코드 간 정합성 측면의 개선 사항이다.

### 위험도

**LOW** — 기능 동작에 영향을 주는 문서 오류는 없으나, `edge-pathfinding.ts`의 tension 불일치 주석은 알고리즘 수정 시 잘못된 판단을 유발할 수 있다.