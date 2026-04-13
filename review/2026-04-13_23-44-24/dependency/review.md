## 의존성 코드 리뷰 — Dependency 관점

---

### 발견사항

---

**[CRITICAL]** `lib/stores/editor-store.ts`가 `components` 레이어를 직접 임포트 — 레이어 역전
- **위치**: `editor-store.ts:8` — `import { buildEdgeData } from "@/components/editor/canvas/edge-utils"`
- **상세**: `lib/stores/` 레이어(상태 관리, 하위 레이어)가 `components/editor/canvas/` 레이어(프레젠테이션, 상위 레이어)를 직접 의존합니다. 의존성 방향이 역전되어 있으며, 이로 인해:
  - `edge-utils.ts`의 파일 이동/리팩토링 시 스토어가 함께 수정되어야 함
  - 스토어를 테스트할 때 컴포넌트 레이어 전체가 test context에 진입
  - `edge-utils.ts`가 다시 `lib/node-definitions`를 import하므로 `store → component → lib` 혼재 구조 성립
- **제안**: `edge-utils.ts`(또는 최소한 `buildEdgeData`, `resolvePortType` 함수들)를 `lib/utils/edge-utils.ts` 또는 `lib/domain/edge-utils.ts`로 이동. 스토어와 컴포넌트 양쪽이 동일한 lib 레이어에서 임포트하도록 재배치.

---

**[WARNING]** `pathfinding@0.4.18` — 사실상 방치된(abandoned) 패키지를 `dependencies`(프로덕션)에 배치
- **위치**: `frontend/package.json` dependencies 섹션
- **상세**: 마지막 npm 배포가 2014~2015년경으로, 10년 이상 유지보수가 없습니다. 또한 `dependencies`에 배치되어 있어 프로덕션 번들에 포함됩니다. 전이 의존성인 `heap@0.2.5`(2013년 이후 미업데이트)까지 포함하면 gzip 기준 약 30~50KB가 번들에 추가됩니다. 기능(pathfinding)이 엣지가 노드와 교차하는 경우에만 활성화되는 선택적 UI 기능임을 고려하면 번들 비용 대비 효용이 낮습니다.
- **제안**: 다음 중 택일:
  1. `pathfinding` 패키지 제거 후 60~80줄 수준의 커스텀 A* 구현으로 대체 (의존성 자체 제거)
  2. Dynamic import로 코드 스플리팅 적용:
     ```ts
     const PF = await import("pathfinding");
     ```

---

**[WARNING]** `heap@0.2.5` 전이 의존성 — 암묵적 포함
- **위치**: `frontend/package-lock.json`
- **상세**: `pathfinding`의 전이 의존성으로 2013년 이후 업데이트가 없는 `heap@0.2.5`가 프로젝트에 포함됩니다. 직접 선언하지 않았으므로 `package.json`만 보면 이 패키지의 존재를 알 수 없고, 감사(audit)나 라이선스 검토에서 누락되기 쉽습니다.
- **제안**: `pathfinding` 자체를 대체하면 자동 해소됩니다.

---

**[WARNING]** `use-edge-highlighting.ts` — 내부 의존성 커플링 구조 검토 필요
- **위치**: `use-edge-highlighting.ts:1-5`
- **상세**: 이 훅은 `useEditorStore`(전역 상태)와 `getConnectedEdgeIds`(edge-utils)를 모두 직접 참조합니다. 훅 내부에서 zustand 스토어 구독(`hoveredNodeId`, `hoveredEdgeId`, `selectedNodeId` 3개 슬라이스)이 발생하므로, 스토어 상태 변경 시 이 훅을 사용하는 컴포넌트 전체가 리렌더됩니다. 특히 `hoveredNodeId`, `hoveredEdgeId`는 마우스 이벤트마다 변경되는 transient state이므로 영향 범위가 큽니다.
- **제안**: 스토어에서 직접 구독하지 않고 `WorkflowCanvas`에서 props/context로 주입받는 구조로 전환하거나, 전용 UI 스토어 슬라이스(`useUIStore`)로 분리하여 구독 범위를 최소화.

---

**[INFO]** `@types/pathfinding@0.1.0` — `devDependencies`에 올바르게 배치
- **위치**: `frontend/package.json` devDependencies 섹션
- **상세**: 타입 정의가 `devDependencies`에 정확히 배치되어 있습니다. 프로덕션 번들에 포함되지 않습니다. 별도 이슈 없음.

---

**[INFO]** 라이선스 호환성 — 문제 없음
- **위치**: `pathfinding`, `heap` 패키지
- **상세**: 두 패키지 모두 MIT 라이선스로 프로젝트 라이선스와 호환됩니다.

---

**[INFO]** `edge-utils.ts`의 내부 임포트 방향은 올바름
- **위치**: `edge-utils.ts:1` — `import { getNodeDefinition } from "@/lib/node-definitions"`
- **상세**: `components` 레이어에서 `lib` 레이어를 참조하는 방향은 정상입니다. `edge-utils.ts`가 `lib/`로 이동된다면 이 임포트도 유지됩니다.

---

**[INFO]** Legacy 마커(`arrow`, `arrow-selected`) — 미사용 내부 참조 잔존 가능성
- **위치**: `custom-edge.tsx` `EdgeMarkerDefs`
- **상세**: 이전 마커 시스템(`arrow`, `arrow-selected`)이 하위 호환 목적으로 유지되어 있으나, 현재 코드베이스에서 이 ID를 참조하는 곳이 있는지 확인이 필요합니다. 참조가 없다면 제거하여 불필요한 SVG DOM 노드를 줄일 수 있습니다.
- **제안**: `grep -r 'arrow"' --include="*.tsx" --include="*.ts"` 등으로 실제 참조 여부 확인 후 제거 검토.

---

### 요약

이번 변경의 핵심 의존성 문제는 두 가지입니다. 첫째, `lib/stores/editor-store.ts`가 `components/editor/canvas/edge-utils.ts`를 직접 임포트하면서 레이어 의존성 방향이 역전되었습니다. 클린 아키텍처 관점에서 상태 관리 레이어가 프레젠테이션 레이어를 알아서는 안 되며, `buildEdgeData`/`resolvePortType` 함수들을 `lib/` 하위로 이동시키는 것이 선행되어야 합니다. 둘째, `pathfinding@0.4.18`은 10년 이상 미유지 패키지로 `dependencies`(프로덕션 번들)에 포함되어 약 30~50KB를 추가합니다. 이 기능이 선택적 UI 기능임을 감안하면 커스텀 경량 A* 구현이나 dynamic import를 통한 코드 스플리팅이 권장됩니다. 라이선스 및 보안 취약점(알려진 CVE) 측면의 위험은 낮으나, 구조적 의존성 역전은 즉시 해결이 필요한 사항입니다.

---

### 위험도

**MEDIUM** — 기능 동작에 즉각적인 문제는 없으나, 레이어 역전이 방치되면 이후 리팩토링 비용이 누적되고 `pathfinding` 패키지는 번들 크기와 장기 유지보수 측면에서 부담이 됩니다.