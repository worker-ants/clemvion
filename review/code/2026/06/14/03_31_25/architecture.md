# 아키텍처(Architecture) 리뷰 결과

## 발견사항

### [WARNING] EditorToolbar 의 단일 책임 위반 — 대화(dialog) 로직과 데이터 조회가 툴바에 혼재
- **위치**: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` 전체
- **상세**: `EditorToolbar` 는 이미 저장·실행·삭제·버전이력·실행중단·어시스턴트 토글 등 다수의 액션을 담고 있는데, 이번 변경으로 "Run with Input" 다이얼로그 UI, 실시간 JSON 유효성 검증(`jsonError` useMemo), 히스토리 목록 조회(`historyQuery` useQuery), 과거 실행 상세 조회(`handleLoadFromHistory`) 까지 같은 컴포넌트 안에 추가되었다. SRP 관점에서 "히스토리에서 불러오기" 기능은 독립된 `RunWithInputDialog` 컴포넌트 + `useRunInputHistory` 훅으로 분리되어야 레이어 책임이 명확해진다.
- **제안**: `RunWithInputDialog` 컴포넌트를 `editor/toolbar/` 또는 `editor/run-input/` 서브 폴더에 추출하고, `historyQuery` / `handleLoadFromHistory` / `jsonError` 를 `useRunInputHistory(workflowId)` 커스텀 훅으로 캡슐화한다. `EditorToolbar` 는 열림 상태(boolean) 와 `workflowId` 만 전달하도록 줄인다.

### [WARNING] `handleLoadFromHistory` 가 비즈니스 레이어를 우회하여 API 를 직접 호출
- **위치**: `editor-toolbar.tsx` — `handleLoadFromHistory` 콜백 내 `executionsApi.getById(id)` 직접 호출
- **상세**: `EditorToolbar` 는 프레젠테이션 레이어에 속하는 컴포넌트인데, `executionsApi` 를 직접 `await` 호출하고 있다. `historyQuery` 쪽은 `useQuery` 로 TanStack Query 를 통해 캐싱·에러 경계를 활용하지만, 상세 조회는 `useQuery` 없이 명령형 비동기 fetch 를 한다. 이로 인해 에러 핸들링이 단순 `console.error + toast` 로만 처리되고 쿼리 캐시와 연동되지 않는다.
- **제안**: `useQuery(["execution", id], ..., { enabled: !!selectedHistoryId })` 패턴으로 선언적으로 전환하거나, 최소한 커스텀 훅 안으로 캡슐화하여 `EditorToolbar` JSX 에서 `executionsApi` 직접 참조를 제거한다.

### [INFO] `drawerExpanded` 상태 승격 — store 설계 결정은 적절하나 store 비대화 주의
- **위치**: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` 및 `execution-store` (미노출)
- **상세**: `expanded` 를 로컬 `useState` 에서 `useExecutionStore` 로 승격한 결정은 §10.12 키보드 핸들러와 헤더 셰브론 간 상태 공유 필요성을 해소한다. 아키텍처적으로 정당한 승격이다. 다만 execution store 가 이미 실행 상태·nodeStatuses·nodeResults·conversationMessages 등 많은 슬라이스를 보유하므로, UI-only 상태(`drawerExpanded`)가 비즈니스 데이터와 혼재된다. 향후 분리 기준을 명확히 해두면 좋다.
- **제안**: 현 변경은 수용 가능하되, 중장기적으로 `editorUiStore` 또는 `runResultsUiStore` 를 별도로 두어 UI 토글 상태를 분리하는 것을 검토한다.

### [INFO] `isEditableTarget` 함수의 배치 — 유틸리티성 함수가 컴포넌트 파일에 노출 export 됨
- **위치**: `codebase/frontend/src/components/editor/workflow-editor.tsx` — `export function isEditableTarget`
- **상세**: `isEditableTarget` 은 순수 DOM 헬퍼로 컴포넌트와 무관하다. 현재 테스트가 `workflow-editor` 에서 직접 import 하는 구조를 선택한 것은 "WebSocket·ReactFlow 의존 없이 순수 함수 단위 테스트" 정책에 따른 pragmatic 결정이며 테스트 패턴 자체는 합당하다. 그러나 함수를 `@/lib/utils/keyboard` 또는 `@/lib/utils/dom` 에 두면 컴포넌트 파일의 공개 API 면적이 줄고, 다른 위치에서 재사용할 때 `workflow-editor` 를 import 할 필요가 없어진다.
- **제안**: `isEditableTarget` 을 `/lib/utils/dom.ts` 또는 `/lib/utils/keyboard.ts` 로 이동하고, `workflow-editor.tsx` 와 테스트 파일 양쪽이 해당 경로에서 import 하도록 한다.

### [INFO] `data-run-results-drawer` 속성 기반 DOM 탐색 — 암묵적 결합
- **위치**: `workflow-editor.tsx` `handleKeyDown` 내 `active.closest("[data-run-results-drawer]")`
- **상세**: `WorkflowEditor` 가 `RunResultsDrawer` 의 내부 DOM 구조(`data-run-results-drawer` 속성)에 직접 의존하는 것은 두 컴포넌트 간 암묵적 결합을 만든다. `RunResultsDrawer` 가 루트 엘리먼트를 변경하거나 속성을 제거하면 Escape 동작이 조용히 깨진다. 현재는 `data-*` 속성을 컨벤션으로 활용하는 방식이 Next.js/React 에서 관행적으로 쓰이므로 심각하지는 않으나, 이 결합이 암묵적임을 문서화하거나 상수로 공유하는 것이 바람직하다.
- **제안**: `DATA_RUN_RESULTS_DRAWER = "data-run-results-drawer"` 상수를 별도 파일(예: `editor-constants.ts`)에 정의하여 양쪽에서 import 하거나, JSDoc 주석에 "§10.12 결합 지점" 을 명시한다.

### [INFO] 테스트 모듈 내 `editorState` 가변 객체를 `Object.assign` 으로 변이 — 테스트 격리 취약성
- **위치**: `editor-toolbar-rbac.test.tsx` — `Object.assign(editorState, ...)` 패턴
- **상세**: `editorState` 는 모듈 상단에 `const` 로 선언된 단일 객체이며, 일부 테스트가 `Object.assign` 으로 직접 변이한 후 `Object.assign` 으로 되돌린다. `beforeEach` 의 `vi.clearAllMocks()` 는 이 변이를 초기화하지 않는다. 테스트 실행 순서에 따라 `graphWarnings` 상태가 잔류할 수 있다. 아키텍처상 테스트 헬퍼(픽스처)와 프로덕션 모킹 인터페이스가 분리되어 있지 않다.
- **제안**: `beforeEach` 에서 `Object.assign(editorState, defaultEditorState)` 로 항상 전체를 리셋하거나, `vi.mock` 팩토리 안에서 `vi.fn()` getter 를 통해 불변 픽스처 패턴을 사용한다.

### [INFO] `EditorToolbar` — 모달/다이얼로그가 컴포넌트 내부에 `fixed` 포지션으로 인라인 렌더링
- **위치**: `editor-toolbar.tsx` `{runWithInputOpen && ...}` 및 `{deleteConfirmOpen && ...}` 블록
- **상세**: 두 모달이 `EditorToolbar` 반환값의 Fragment 안에서 조건부로 렌더되고 있으며 `fixed inset-0` CSS 로 뷰포트를 차지한다. `ReRunModal` 이 `RunResultsDrawer` 에서 별도 컴포넌트로 분리된 것과 대조적으로, `EditorToolbar` 의 모달들은 추출 없이 인라인에 남아 있다. 코드량이 늘어날수록 유지보수가 어려워진다.
- **제안**: `RunWithInputDialog` / `DeleteWorkflowDialog` 를 각각 별도 컴포넌트로 추출하여 `EditorToolbar` 의 렌더 함수 크기를 줄인다. 단, 현재 기능적 동작에는 문제가 없으므로 즉각적 차단은 아니다.

## 요약

이번 변경은 §10.12 키보드 단축키(Ctrl+Shift+R 드로어 토글, Escape 포커스 복귀)와 Run with Input 히스토리 로드 기능을 구현한다. 상태 승격(`drawerExpanded` → execution store) 결정은 문제를 올바르게 해결하며, `isEditableTarget` 의 순수 함수 분리 및 `data-run-results-drawer` 속성 기반 탐색 패턴도 실용적이다. 주요 아키텍처 우려는 `EditorToolbar` 가 JSON 검증·히스토리 조회·다이얼로그 렌더링을 모두 흡수하여 단일 책임 원칙을 벗어나기 시작한 점이다. 컴포넌트 크기는 이미 ~370줄에 달하며 추가 기능이 붙을수록 유지보수 부담이 커지므로, `RunWithInputDialog` 와 관련 커스텀 훅 분리를 중단기 과제로 권장한다. 순환 의존성은 없고 레이어 경계도 대체로 지켜지며, 확장성 측면의 구조적 결함은 없다.

## 위험도

LOW
