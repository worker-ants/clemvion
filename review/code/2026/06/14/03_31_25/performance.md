# Performance Review

## 발견사항

### **[INFO]** `jsonError` useMemo 의존성에 `t` 포함 — 불필요한 재계산 가능성
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — `jsonError` useMemo (line ~1551)
- 상세: `t` (번역 함수)는 로케일이 바뀔 때만 교체되므로 일반적으로 안정적이지만, 구현에 따라 렌더마다 새 참조가 생성될 수 있다. `jsonInput` 변경 시 JSON.parse는 O(n) 비용이 발생하는데, `t`가 불안정하면 jsonInput과 무관한 리렌더에서도 parse가 재실행된다. 영향은 소규모 JSON 입력 범위에서 미미하다.
- 제안: `t`를 의존성에서 제거하고 에러 키만 반환하거나, 에러 메시지 조합을 useMemo 바깥에서 수행하는 방식을 고려한다. 단, 현재 규모에서는 실질적 성능 문제는 없다.

### **[INFO]** `completedNodes` 파생 계산이 렌더 함수 최상위에서 3회 반복 순회
- 위치: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` (line ~405-412)
- 상세: `status === "idle"` early-return 이후 `nodeStatuses.entries()`를 `Array.from()`으로 변환한 뒤 `.filter()` 3회 체이닝한다 (`completedNodes`, `completedCount`, `failedCount`). `nodeStatuses`가 Map이므로 entries() 변환 자체는 O(n)이고, 3회 순회(총 O(3n))가 매 렌더마다 발생한다. 실행 중 빈번한 리렌더 상황에서 노드 수가 수백 개라면 미소한 낭비가 누적된다.
- 제안: useMemo 또는 단일 루프로 `completedCount`, `failedCount`를 동시에 집계한다. 예시: `nodeStatuses.entries()`를 한 번 순회해 카운트를 동시에 산출하고 useMemo로 memoize한다. 단, 현재 규모(수십 노드)에서는 실질 병목은 아니다.

### **[INFO]** `nodeResults.find()` 가 매 렌더마다 선형 탐색
- 위치: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` (line ~445-450)
- 상세: `selectedResult` 계산이 `nodeResults.find()`로 매 렌더마다 O(n) 탐색을 수행한다. `early-return` 이후 코드이며 useMemo로 감싸지 않는다. 실행 결과가 수백 개의 노드 실행 항목을 포함할 경우 매 렌더마다 선형 탐색이 반복된다.
- 제안: `useMemo([nodeResults, selectedResultNodeId], ...)` 로 감싸거나, `nodeResults`를 Map 자료구조(nodeExecutionId → result)로 관리해 O(1) 조회로 전환을 검토한다.

### **[INFO]** `historyQuery`가 `enabled` 조건이 있으나 캐시 키 재사용 전략은 적절함
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (line ~1564)
- 상세: `enabled: !!workflowId && runWithInputOpen && historyPickerOpen` 로 조건부 fetch가 잘 구현되어 있다. `queryKey: ["editor-run-history", workflowId]`로 캐싱되므로 동일 workflowId에서 히스토리 피커를 다시 열 때 불필요한 재요청이 발생하지 않는다. 적절한 설계.

### **[INFO]** `handleLoadFromHistory` 내 `executionsApi.getById` 는 React Query 캐시를 우회
- 위치: `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (line ~1576-1588)
- 상세: 히스토리 항목 클릭 시 `executionsApi.getById(id)`를 직접 호출해 React Query 캐시를 사용하지 않는다. 동일 실행을 반복 선택하면 매번 네트워크 요청이 발생한다. 단, 히스토리 피커에서 최대 10개의 항목 중 하나를 선택하는 사용 빈도상 실질 병목은 낮다.
- 제안: `queryClient.fetchQuery({ queryKey: ["execution", id], queryFn: () => executionsApi.getById(id) })`를 사용하면 이미 캐시된 실행 상세(드로어의 `detailQuery`와 동일 키 공유)를 재사용할 수 있다.

### **[INFO]** `isEditableTarget` 함수의 `getAttribute` 이중 체크는 jsdom 대응용 — 프로덕션 비용 무시 가능
- 위치: `codebase/frontend/src/components/editor/workflow-editor.tsx` (line ~2256-2263)
- 상세: `el.isContentEditable` 확인 후 `el.getAttribute("contenteditable")`를 추가로 호출한다. 브라우저에서는 `isContentEditable`이 항상 동작하므로 추가 호출은 불필요하지만, 비용은 O(1)로 무시 가능하다. jsdom 호환성을 위한 의도적 설계로 문서화도 되어 있다.
- 제안: 변경 불필요.

### **[INFO]** `closest("[data-run-results-drawer]")` DOM 트리 탐색이 Escape 키마다 실행
- 위치: `codebase/frontend/src/components/editor/workflow-editor.tsx` (line ~2359-2368)
- 상세: `keydown` 핸들러 내 `e.key === "Escape"` 분기에서 `document.activeElement.closest("[data-run-results-drawer]")`를 매 Escape 키 이벤트마다 DOM 트리를 탐색한다. Escape는 빈번하지 않은 이벤트이므로 실질 비용은 무시 가능하다.
- 제안: 변경 불필요.

### **[INFO]** `RunResultsDrawer`의 다중 `useExecutionStore` 개별 selector 호출
- 위치: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` (line ~247-285)
- 상세: `useExecutionStore`를 15회 이상 개별 selector로 호출한다. Zustand의 동작상 각 selector가 독립적으로 구독하므로, 각 슬라이스가 변경될 때마다 해당 구독만 재렌더를 트리거한다. 이는 과-구독(over-subscription)을 방지하는 올바른 패턴이다. 성능 우려 없음.
- 제안: 변경 불필요.

### **[INFO]** `expanded` 상태를 로컬 `useState`에서 store로 승격 — 추가 subscriber 증가
- 위치: `codebase/frontend/src/components/editor/run-results/run-results-drawer.tsx` (diff: `useExecutionStore((s) => s.drawerExpanded)` / `setDrawerExpanded`)
- 상세: `expanded`를 store로 승격하면 store 구독자가 추가된다. `WorkflowEditor`도 `toggleDrawerExpanded`를 구독하므로, `drawerExpanded` 변경 시 두 컴포넌트가 모두 리렌더될 가능성이 있다. 단, 키보드 단축키 접근을 위한 설계 요구사항이며 실제 리렌더 비용은 토글 빈도(낮음)에 비례하므로 실질 영향은 없다.
- 제안: 변경 불필요.

## 요약

이번 변경은 §10.12 단축키 기능 추가(Ctrl+Shift+R 드로어 토글, Escape 포커스 복귀), §2.2 실시간 JSON 검증, 히스토리 기반 입력 로드 기능으로 구성된다. 성능 관점에서 전반적으로 양호하다. `historyQuery`의 조건부 fetch, `visibleResults`의 useMemo, `handleMouseMove` throttling 없는 대신 `ref`로 상태를 추적하는 패턴 등은 적절하게 구현되어 있다. 주목할 만한 개선 여지는 `RunResultsDrawer`의 `completedNodes` 3회 중복 순회 및 `selectedResult`의 useMemo 부재인데, 이는 현재 데이터 규모(수십 노드)에서 병목이 되지 않는다. `handleLoadFromHistory`가 React Query 캐시를 우회해 직접 API를 호출하는 부분은 캐시 공유 개선 여지가 있으나 사용 빈도상 낮은 우선순위다.

## 위험도

LOW
