## 아키텍처 코드 리뷰 — Architecture 관점

---

### 발견사항

---

**[CRITICAL]** 스토어 레이어가 컴포넌트 레이어에 의존 (의존성 역전 위반)
- **위치**: `editor-store.ts:8` — `import { buildEdgeData } from "@/components/editor/canvas/edge-utils"`
- **상세**: `lib/stores/`(상태 관리 레이어)가 `components/editor/canvas/`(프레젠테이션 레이어)를 직접 참조합니다. 클린 아키텍처의 의존성 규칙상 하위 레이어(lib)는 상위 레이어(components)를 알아서는 안 됩니다. 이 구조에서는 컴포넌트 파일 이동·리팩토링 시 스토어도 함께 수정해야 하는 강결합이 발생합니다.
- **제안**: `edge-utils.ts`를 `lib/utils/edge-utils.ts` 또는 `lib/domain/edge-utils.ts`로 이동하여, 스토어와 컴포넌트 모두 동일한 도메인 레이어에서 import하도록 재배치.

---

**[WARNING]** 글로벌 Zustand 스토어에 transient UI 상태 혼재 (SRP 위반)
- **위치**: `editor-store.ts:20-21`, `editor-store.ts:283-284`
- **상세**: `hoveredNodeId`, `hoveredEdgeId`는 마우스 포인터 위치에 따른 순간적인 UI 상태입니다. 이를 도메인 스토어에 두면 hover 이벤트마다 노드 패널·툴바 등 스토어 전체 구독자가 불필요하게 리렌더됩니다. 비즈니스 로직(워크플로우 상태)과 UI 인터랙션 상태가 한 스토어에 혼재하여 단일 책임 원칙이 깨집니다.
- **제안**: `useEdgeHighlighting` 훅 내부 `useRef`/`useState`로 관리하거나, 별도 `useUIStore` (Zustand slice)를 분리하여 구독 범위를 최소화.

---

**[WARNING]** 인라인 `<style>` 태그를 통한 동적 CSS 주입 안티패턴
- **위치**: `workflow-canvas.tsx:422-429`
- **상세**:
  ```tsx
  <style>{`
    .react-flow__node[data-id="${hoveredEdgeNodes.sourceId}"] > div,
    .react-flow__node[data-id="${hoveredEdgeNodes.targetId}"] > div { ... }
  `}</style>
  ```
  API에서 유래한 노드 ID가 CSS 선택자에 직접 보간됩니다. 현재는 UUID이므로 실질 위험이 낮지만, 구조적으로 CSS injection 취약점과 동일한 패턴입니다. 또한 React 렌더 사이클 외부에서 스타일시트를 동적 생성·파기하므로 전체 문서 스타일 재계산이 발생합니다.
- **제안**: `useEditorStore`를 통해 hover 대상 노드에 `className`을 부여하거나, `data-glow` 속성을 노드 데이터에 반영하고 `globals.css`에 정적 규칙으로 처리.

---

**[WARNING]** "Bright" 마커가 일반 마커와 동일한 색상 — 불완전 구현
- **위치**: `custom-edge.tsx:121-141`
- **상세**: `arrow-data-bright` 등 `-bright` 마커가 `PORT_TYPE_COLORS`의 동일한 값을 사용합니다. `markerId` 계산 로직(`arrow-${portType}-bright`)과 실제 렌더링 사이에 의미적 불일치가 존재하여 불필요한 복잡성을 추가합니다. 마커 8개가 실질적으로 4개와 동일한 역할을 합니다.
- **제안**: bright 마커에 명시적으로 다른 색상을 정의하거나, 구분을 제거하고 단일 `arrow-${portType}` 마커로 통일. 선택 상태 시각화는 `strokeWidth` 변경만으로 충분히 표현 가능.

---

**[WARNING]** `resolvePortType`이 특정 노드 타입을 하드코딩 (OCP 위반)
- **위치**: `edge-utils.ts:37-48`
- **상세**:
  ```ts
  if (sourceNodeType === "ai_agent") {
    if (sourceHandle === "out" || sourceHandle === "user_ended" || sourceHandle === "max_turns") {
      return "system";
    }
  }
  ```
  포트 타입 분류 로직이 함수 내 인라인 분기로 특정 노드 타입에 결합되어 있습니다. 새 노드 타입 추가 시 이 함수를 반드시 수정해야 하는 OCP 위반입니다. `NodeDefinition`의 `outputs` 배열에 타입 정보가 있음에도 AI Agent만 예외적으로 하드코딩되어 있습니다.
- **제안**: `NodeDefinition`의 `outputs` 배열에 `portType: "system" | "data" | "error" | "container"` 필드를 표준화하고, `resolvePortType`이 항상 정의에서 읽도록 통일. AI Agent 특수 케이스를 노드 정의 파일로 이전.

---

**[INFO]** `getMarkerIdForPortType`이 사실상 미사용 (dead export)
- **위치**: `edge-utils.ts:58-65`
- **상세**: `custom-edge.tsx`는 `` `arrow-${portType}` `` 템플릿 리터럴로 마커 ID를 직접 구성하여 이 함수를 우회합니다. 테스트는 작성되어 있으나 프로덕션 코드에서 호출되지 않습니다.
- **제안**: `custom-edge.tsx`에서 이 함수를 사용하도록 통일하거나, 사용되지 않는다면 제거.

---

**[INFO]** `isFocusActive`의 중복 useMemo 의존성
- **위치**: `use-edge-highlighting.ts:38`
- **상세**: `isFocusActive`는 `highlightedEdgeIds`에서 파생된 값인데, `enhancedEdges` memo의 deps 배열에 `[edges, highlightedEdgeIds, isFocusActive]`로 양쪽이 모두 포함됩니다. `highlightedEdgeIds`가 변경될 때 `isFocusActive`도 항상 함께 변경되므로 논리적 중복입니다.
- **제안**: `isFocusActive`를 의존성 배열에서 제거하고 `highlightedEdgeIds !== null`로 내부 조건을 직접 평가.

---

### 요약

이번 변경은 엣지 하이라이팅과 포트 타입 색상 분류를 위한 `edge-utils.ts`, `use-edge-highlighting.ts` 모듈화로 관심사 분리 의도는 긍정적입니다. 그러나 **핵심 아키텍처 문제**가 있습니다. `lib/stores/editor-store.ts`가 `components/editor/canvas/edge-utils.ts`를 직접 임포트하여 상태 관리 레이어가 프레젠테이션 레이어에 의존하는 역전이 발생했으며, 이는 레이어 경계를 무너뜨립니다. `edge-utils.ts`를 `lib/` 하위로 이동하는 것이 이후 확장성을 위한 핵심 선행 과제입니다. 추가로 글로벌 스토어의 transient UI 상태 오염, 동적 CSS 주입 안티패턴, OCP를 위반하는 `resolvePortType` 하드코딩이 함께 해결되어야 구조적 건전성이 확보됩니다.

### 위험도

**MEDIUM**