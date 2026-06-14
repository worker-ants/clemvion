# 유지보수성(Maintainability) 리뷰 결과

## 발견사항

### [INFO] `isEditableTarget` 함수의 jsdom 우회 로직 — 이중 검사의 명시적 이유
- 위치: `/codebase/frontend/src/components/editor/workflow-editor.tsx` — `isEditableTarget` (라인 2256–2262)
- 상세: `el.isContentEditable` 확인 후 `getAttribute("contenteditable")` 를 한 번 더 확인하는 이중 체크가 있다. 이유는 jsdom 미구현 때문이며 주석에 명시되어 있어 의도는 분명하다. 그러나 빈 문자열(`attr === ""`)도 `true` 로 처리하는 케이스가 주석에는 설명되지 않아 미래 유지보수자가 이 조건의 뜻을 오해할 수 있다. (`contenteditable=""` 은 브라우저에서 "inherit" 의미이며 실제로는 편집 가능하지 않을 수 있음)
- 제안: 주석에 "contenteditable="" 은 inherit 의미이지만 jsdom 환경 호환성을 위해 보수적으로 editable 로 간주" 설명 추가. 또는 단위 테스트에 `contenteditable=""` 케이스를 추가해 의도를 문서화한다.

---

### [INFO] `EditorToolbar` 컴포넌트 — 단일 컴포넌트에 과도한 책임 집중
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (전체 약 380줄 TSX)
- 상세: 이번 변경으로 `historyPickerOpen`, `historyQuery`, `handleLoadFromHistory`, `jsonError` (useMemo), 히스토리 피커 렌더링 JSX 가 추가되었다. 이미 Run/More 드롭다운 상태 관리, 저장, 삭제 확인 다이얼로그, 실행 취소/중단 등 다수의 책임을 갖고 있던 컴포넌트에 추가 기능이 인라인으로 누적되어 복잡도가 증가하고 있다. 당장의 변경은 작고 명확하지만 누적 경향을 언급한다.
- 제안: 중기적으로 `RunWithInputDialog` 컴포넌트를 분리하는 것을 고려한다. `jsonInput`, `jsonError`, `historyPickerOpen`, `historyQuery`, `handleLoadFromHistory` 를 포함해 독립 컴포넌트로 추출하면 `EditorToolbar` 의 책임이 줄고 각 부분의 테스트가 용이해진다.

---

### [INFO] `handleRunWithInput` — JSON 파싱 이중 수행
- 위치: `/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `handleRunWithInput` (라인 1647–1672)
- 상세: `jsonError` 는 useMemo 로 실시간 유효성을 검사하고, 제출 버튼은 `jsonError != null` 시 disabled 처리된다. 그럼에도 `handleRunWithInput` 내부에서 `JSON.parse(jsonInput)` 를 재실행하고 `SyntaxError` 를 catch 하는 fallback 코드가 남아 있다. 이 경우 실시간 검증이 있으므로 `SyntaxError` 분기는 실제로 도달하기 어렵고, 두 경로가 에러 처리 방식이 다르다 (`alert()` vs `role="alert"` paragraph). 불일치가 혼란을 줄 수 있다.
- 제안: `jsonError` 가 있으면 이미 버튼이 비활성화되므로, `handleRunWithInput` 내의 `SyntaxError` catch 분기를 제거하거나 방어 코드임을 명확히 주석으로 표시한다. `alert()` 사용은 접근성·UX 관점에서도 기존 `role="alert"` 피드백 패턴과 일관성이 없다.

---

### [INFO] `run-results-drawer.tsx` — 상태 구독이 세분화되어 있으나 두 줄의 순서가 개념적으로 분리됨
- 위치: `/codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` — 라인 225–226
- 상세: `expanded` 와 `setExpanded` 를 각각 별도의 `useExecutionStore` 호출로 구독한다. Zustand selector 패턴으로 올바른 방식이며 불필요한 리렌더를 방지한다. 이 자체는 문제가 없다. 주석이 이유를 잘 설명하고 있다.
- 제안: 없음. 현행 패턴 유지.

---

### [INFO] `editor-toolbar-rbac.test.tsx` — `Object.assign(editorState, ...)` 로 테스트 간 상태 오염 위험
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-rbac.test.tsx` — 라인 801–816, 820–852
- 상세: `Object.assign(editorState, { graphWarnings: ... })` 로 공유 객체를 직접 변이하고, 테스트 말미에 수동으로 초기화한다. `beforeEach` 가 `vi.clearAllMocks()` 를 호출하지만 `editorState.graphWarnings` 는 mock 함수가 아니므로 초기화되지 않는다. 테스트가 비정상 종료되면(예외 발생) 정리 코드가 실행되지 않아 후속 테스트에 오염이 발생할 수 있다. 기존 패턴의 문제이지만 이번 변경이 동일 패턴을 추가했다.
- 제안: `beforeEach` 에서 `graphWarnings` 를 포함해 `editorState` 전체를 원래 값으로 되돌리는 재할당(`Object.assign(editorState, initialState)`)을 추가하거나, `afterEach` 로 정리 보장한다. 또는 각 테스트에서 `editorState` 를 `beforeEach` 에서 `vi.fn()` 재생성 방식으로 리셋한다.

---

### [INFO] `editor-toolbar-run-input.test.tsx` — 테스트 파일에 `vi.mock` 보일러플레이트 중복
- 위치: `/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` — 라인 884–956
- 상세: `editor-toolbar-rbac.test.tsx` 와 동일한 mock 보일러플레이트 (next/navigation, next/link, editor-store, execution-store, assistant-store) 가 상당 부분 중복된다. 두 파일의 `editorState` 객체 구조도 거의 동일하며 별도로 관리된다. 미래에 `EditorStore` 인터페이스가 변경되면 두 파일 모두 수정해야 한다.
- 제안: 공통 mock 설정을 `__tests__/setup/editor-toolbar-mocks.ts` 등 공유 헬퍼로 추출하는 것을 고려한다. 단, 테스트 파일 간의 독립성이 선호되는 팀 컨벤션이 있다면 현 상태 유지도 합리적이다.

---

### [INFO] `workflow-editor.tsx` — `handleKeyDown` 내 `return` 문 비일관성
- 위치: `/codebase/frontend/src/components/editor/workflow-editor.tsx` — `handleKeyDown` (라인 2325–2372)
- 상세: `Ctrl+Shift+R` 처리 블록은 `toggleDrawerExpanded()` 후 `return` 으로 조기 탈출하지만, 다른 단축키 블록(Undo, Redo, Save, 어시스턴트)은 `return` 없이 `if` 체인으로 이어진다. 기능적으로 문제없지만 스타일 불일관성이 있다. Escape 블록도 `return` 없이 끝난다.
- 제안: 모든 처리 블록을 `return` 으로 통일하거나, Shift+R 의 `return` 을 제거하고 일관되게 `if/else if` 체인으로 구성한다. 어느 쪽이든 일관성이 중요하다.

---

### [INFO] `workflow-editor.tsx` — 500ms debounce 매직 넘버
- 위치: `/codebase/frontend/src/components/editor/workflow-editor.tsx` — 라인 2316
- 상세: `setTimeout(..., 500)` 의 500ms 는 기존 코드의 값이며 이번 변경이 추가한 것은 아니다. 주석에 설명이 있지만 named constant 가 없다. 이번 변경 범위와 무관하나 참고로 기록한다.
- 제안: 이번 리뷰 범위 외. 별도 리팩토링 시 `const GRAPH_WARNING_DEBOUNCE_MS = 500;` 으로 추출 권장.

---

## 요약

이번 변경은 §10.12 단축키 지원(Ctrl+Shift+R, Escape)과 §2.2 히스토리 로드 기능을 추가하며, 전반적으로 주석이 잘 달려 있고 의도가 명확하다. 네이밍 컨벤션은 코드베이스 기존 패턴을 잘 따르며, i18n 키 추가도 en/ko 양 로케일에 대칭적으로 이루어졌다. `isEditableTarget` 헬퍼 추출과 단위 테스트 분리는 바람직한 설계다. 주요 유지보수성 우려는 `EditorToolbar` 컴포넌트의 누적 복잡도, `handleRunWithInput` 내 이중 JSON 파싱 및 `alert()` 와 선언적 에러 UI의 혼재, 그리고 공유 테스트 픽스처의 직접 변이 패턴이다. 이중 어느 것도 즉각적인 버그를 일으키는 Critical 수준은 아니며, 코드베이스의 현재 패턴 범위 내에 있다.

## 위험도

LOW
