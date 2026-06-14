# Testing Review — impl-execution-editor-gaps

## 발견사항

### **[INFO]** workflow-editor-shortcuts.test.ts — `isEditableTarget` jsdom 이중 검증 경로 누락
- 위치: `/codebase/frontend/src/components/editor/__tests__/workflow-editor-shortcuts.test.ts`
- 상세: 프로덕션 코드(`workflow-editor.tsx`)에 jsdom 이 `isContentEditable` 을 미구현한다는 이유로 `getAttribute("contenteditable")` 를 추가로 확인하는 방어 분기가 있다. 테스트는 `el.setAttribute("contenteditable", "true")` 만 검증하나, `contenteditable=""` (빈 문자열)를 attribute 로만 세팅한 케이스는 커버하지 않는다. 프로덕션 코드는 `attr === ""` 도 truthy 로 처리하므로 해당 분기는 이미 동작 중이나 테스트에 명시적 케이스가 없다.
- 제안: `el.setAttribute("contenteditable", "")` 케이스를 "treats contenteditable elements as editable" 테스트 내 또는 별도 it 블록으로 추가.

---

### **[INFO]** workflow-editor-shortcuts.test.ts — `isEditableTarget(null)` 경로 미테스트
- 위치: `/codebase/frontend/src/components/editor/__tests__/workflow-editor-shortcuts.test.ts`
- 상세: 프로덕션의 Escape 핸들러는 `document.activeElement as HTMLElement | null` 을 캐스팅하고 `active &&` 로 null 을 가드한다. `isEditableTarget` 자체는 `HTMLElement` 를 인수로 받으므로 null 경로는 함수 외부에서 처리되어 별도 테스트 불필요하나, 테스트 파일이 해당 설계 의도를 주석이나 분리 케이스로 명시하지 않아 유지보수 시 혼동 가능성이 있다.
- 제안: 주석으로 "null 가드는 호출자(handleKeyDown)가 담당" 을 명시하면 충분.

---

### **[WARNING]** editor-toolbar-run-input.test.tsx — `historyLoadFailed` 오류 경로 미테스트
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `handleLoadFromHistory` 의 catch 분기(`toast.error(t("editor.historyLoadFailed"))`)가 테스트 대상에 포함되어 있지 않다. `getByIdMock` 이 reject 할 경우 에러 토스트가 표시되고 picker 가 닫히지 않는 동작이 의도에 맞는지 검증되지 않았다. `sonner` mock 이 이미 setup 되어 있어 추가 비용이 적다.
- 제안:
  ```ts
  it("Load from History: getById fails → shows error toast, picker stays open", async () => {
    getByWorkflowMock.mockResolvedValue({ data: [/* stub */], pagination: { ... } });
    getByIdMock.mockRejectedValue(new Error("network error"));
    // open picker, click item, assert toast.error called, picker still visible
  });
  ```

---

### **[WARNING]** editor-toolbar-run-input.test.tsx — `historyQuery.data.length === 0` (빈 히스토리) 케이스 미테스트
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `historyPickerOpen === true` 이고 `getByWorkflow` 가 빈 배열을 반환할 때 "No past executions" 텍스트가 렌더되는 경로가 테스트되지 않는다. 프로덕션 코드의 삼항(`data.length > 0 ? ... : <empty>`) 분기가 검증되지 않아 오타·조건 변경에 무방비다.
- 제안: `getByWorkflowMock.mockResolvedValue({ data: [], pagination: ... })` 후 `findByText(/No past executions/i)` 로 검증하는 it 블록 추가.

---

### **[WARNING]** editor-toolbar-run-input.test.tsx — 실행 중(running) 상태에서 Run 버튼 disabled 케이스 미테스트
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: Submit 버튼이 `disabled={isRunning || jsonError != null}` 로 두 조건 모두 disabled 를 일으킬 수 있다. 유효한 JSON 입력 상태에서 `executionState.status = "running"` 일 때도 버튼이 disabled 되는지 검증하는 케이스가 없다. `editor-toolbar-stop.test.tsx` 에 유사 커버리지가 있을 수 있으나 run-input 다이얼로그 컨텍스트에서의 동작은 별개로 검증이 필요하다.
- 제안: `executionState.status = "running"` 으로 설정 후 다이얼로그를 열어 submit 버튼의 disabled 상태를 검증하는 it 블록 추가.

---

### **[WARNING]** execution-store.test.ts — `drawerExpanded` 초기 기본값 검증이 `beforeEach` setState 에 의존
- 위치: `/codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts` (3087~3114행)
- 상세: "defaults to expanded" 테스트는 `beforeEach` 에서 `setState({ drawerExpanded: true })` 를 직접 세팅한 뒤 `true` 임을 검증한다. 이는 실제 스토어의 초기화 기본값(`drawerExpanded: true` in `create(...)`)이 아닌 테스트 설정 값을 검증하는 구조다. 스토어 초기값이 `false` 로 변경되어도 테스트는 통과한다.
- 제안: "defaults to expanded" it 블록에서 `useExecutionStore.setState(useExecutionStore.getInitialState())` 또는 `getState()` reset 경로를 호출한 뒤 기본값을 확인하거나, `beforeEach` 에서 `setState` 없이 스토어 생성 직후 상태를 검증하도록 분리.

---

### **[INFO]** execution-store.test.ts — `setDrawerExpanded(true)` (이미 true 상태에서 명시적 set) 케이스 누락
- 위치: `/codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`
- 상세: `setDrawerExpanded(false)` 만 테스트하고 `setDrawerExpanded(true)` 는 테스트하지 않는다. 단순 setter 이므로 LOW 위험이나 완성도를 위해 추가 가능.
- 제안: 같은 it 블록 내에 `setDrawerExpanded(true)` → `toBe(true)` 체인 추가.

---

### **[INFO]** run-results-drawer.tsx — `drawerExpanded` 상태 변경 관련 컴포넌트 테스트 부재
- 위치: `/codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx`
- 상세: `expanded` 가 로컬 `useState` 에서 store 선택자로 리팩터링되었으나 컴포넌트 렌더 테스트가 없다. 셰브론 클릭 시 `setDrawerExpanded` 가 호출되는지, `expanded=false` 일 때 타임라인/상세가 숨겨지는지를 검증하는 테스트가 없다. 다만 파일 주석 정책(`workflow-editor-debounce.test.ts` 와 동일 — "WebSocket·ReactFlow·QueryClient 의존성으로 단위 테스트 부적합")에 의해 의도적으로 제외된 것으로 보인다.
- 제안: 최소한 store unit 수준에서 `setDrawerExpanded(false)` 후 `drawerExpanded` 가 false 인지는 이미 `execution-store.test.ts` 로 커버되어 있다. 컴포넌트 레벨 검증이 필요하다면 `RunResultsDrawer` 를 store mock 과 함께 얕은 렌더 테스트로 추가 가능.

---

### **[INFO]** editor-toolbar-rbac.test.tsx — `beforeEach` 에서 `vi.clearAllMocks()` + `cleanup()` 순서
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-rbac.test.tsx` (748~754행)
- 상세: `vi.clearAllMocks()` 가 `cleanup()` 보다 먼저 실행된다. 이미 동작에는 문제가 없으나 `@testing-library/react` 의 관용적 순서는 cleanup 후 mock 초기화이다. 여러 테스트 파일에서 일관성을 유지하는 것이 가독성에 유리하다.
- 제안: 순서를 `cleanup(); vi.clearAllMocks();` 로 통일 (동작 변경 없음, 컨벤션 정렬).

---

### **[INFO]** editor-toolbar-rbac.test.tsx — `editorState` 의 `graphWarnings` 를 `Object.assign` 으로 변이 후 테스트 종료 시 수동 초기화
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-rbac.test.tsx` (801~817행, 848~852행)
- 상세: `Object.assign(editorState, { graphWarnings: ... })` 로 shared mutable state 를 변경하고, 테스트 끝에 `Object.assign` 으로 다시 초기화한다. 테스트가 throw 하거나 early return 하면 초기화 코드가 실행되지 않아 다른 테스트에 side effect 가 생길 수 있다. `vi.clearAllMocks()` 는 mock fn 을 초기화하지만 mutable editorState 객체는 초기화하지 않는다.
- 제안: `afterEach` 에서 `editorState.graphWarnings` 를 초기 상태로 재설정하거나, `Object.assign` 대신 `vi.mocked(useEditorStore).mockReturnValue(...)` 패턴으로 테스트-격리된 반환값을 설정.

---

### **[INFO]** editor-toolbar-run-input.test.tsx — `executionState` mutable shared object 패턴
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: `executionState.status = "idle"` 을 `beforeEach` 에서 직접 리셋하는 패턴은 `editor-toolbar-rbac.test.tsx` 와 동일한 mutable state 패턴이다. 현재 테스트 수에서는 문제가 없으나, status 를 변경하는 테스트가 추가되면 격리 문제로 연결될 수 있다.
- 제안: `beforeEach` 에서 `executionState.status = "idle"` 재설정이 이미 되어 있으므로 현재는 수용 가능. 추후 fixture factory 패턴으로 전환 고려.

---

## 요약

전반적으로 이번 변경은 테스트 친화적인 설계 원칙을 잘 따르고 있다. `isEditableTarget` 의 순수 함수 추출, `drawerExpanded` 의 store 승격, `jsonError` 의 `useMemo` 분리 모두 단위 테스트 가능성을 높이는 방향이며 실제 테스트도 추가되었다. 주요 갭은 세 곳이다: (1) `handleLoadFromHistory` 의 실패 경로(catch 분기)가 테스트되지 않아 에러 토스트 동작이 검증되지 않는다. (2) 빈 히스토리(empty state) 렌더 경로가 커버되지 않는다. (3) `drawerExpanded` 기본값 테스트가 실제 store 초기화 값이 아닌 `beforeEach` 의 `setState` 로부터 참값을 얻어 스토어 기본값 변경을 탐지하지 못한다. `editorState` 의 `Object.assign` 변이 패턴도 테스트 간 격리 위험을 내포하나 현재 구조에서는 수용 범위 내다.

## 위험도

MEDIUM
