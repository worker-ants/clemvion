# 부작용(Side Effect) 리뷰

## 발견사항

### [INFO] loadHistoricalExecution — 진행 중 라이브 실행 상태를 덮어쓴다
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `loadHistoricalExecution()` (line 303-308)
- 상세: `startHistoryView`는 `executionId`, `status`, `nodeStatuses`, `nodeResults` 등 execution-store 의 per-execution 상태 전체를 즉시 리셋한다. 라이브 실행(`status: "running"`)이 진행 중일 때 사용자가 히스토리 패널을 열어 항목을 클릭하면, 현재 진행 중인 실행 상태가 과거 실행 데이터로 덮어써진다. 이후 WebSocket 이벤트가 계속 도착해도 `executionId` 불일치로 노드 결과가 엉뚱한 컨텍스트에 적재되거나 UI가 혼란 상태가 될 수 있다.
- 제안: `ExecutionHistoryPanel` 진입점(`editor-toolbar.tsx`)에서 `status === "running"` 일 때 메뉴 항목을 disabled 처리하거나, `loadHistoricalExecution` 내부에서 현재 상태를 확인해 실행 중이면 경고 토스트를 띄우고 조기 반환하는 가드를 추가한다.

### [INFO] startHistoryView — drawerExpanded 상태를 변경하지 않는다 (의도된 동작, 문서화 부재)
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/execution-store.ts` `startHistoryView` (line 537-550)
- 상세: `startExecution`과 동일하게 per-execution 상태를 클리어하지만, `drawerExpanded`는 건드리지 않는다. 이는 의도된 동작으로 보이나(히스토리 로드 시 드로어를 강제로 열지 않음), 관련 주석이 없어 나중에 `startExecution`과 일관성 맞추려 할 때 drawerExpanded 리셋이 누락된다. `startExecution` 도 drawerExpanded 를 리셋하지 않으므로 일관성은 유지되고 있다. 문서화 수준 gap.
- 제안: `startHistoryView` 주석에 "drawerExpanded 는 의도적으로 유지 (히스토리 로드는 드로어를 자동 강제-오픈하지 않음)" 한 줄 명시.

### [INFO] useQuery queryKey ["editor-execution-history", workflowId] — 전역 React Query 캐시를 공유한다
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` line 294-306
- 상세: 패널을 열 때마다 동일 `workflowId`에 대해 캐시된 결과를 재사용한다. 이는 React Query 의 표준 동작이며 의도된 최적화이지만, 패널을 닫았다가 다시 열었을 때 stale 데이터가 잠시 보일 수 있다. 단, `refetchOnWindowFocus` 정책에 따라 자동 갱신되므로 실질 UX 문제는 없다. 새 실행이 완료된 직후 패널을 열면 이전 캐시(20건 목록)가 보일 수 있다.
- 제안: `staleTime: 0` 또는 `refetchOnMount: true`(기본값)를 명시해 패널 열 때마다 최신 목록을 보장하고 있음을 명확히 한다. 현재 기본값이므로 동작은 맞지만 명시적 표현 권장.

---

## 요약

이번 변경은 신규 `ExecutionHistoryPanel` 컴포넌트, `startHistoryView` store 액션, `loadHistoricalExecution` 오케스트레이션 함수를 추가하는 frontend-only 슬라이스다. 전역 변수 도입 없음, 환경 변수 읽기/쓰기 없음, 파일시스템 부작용 없음, 외부 네트워크 호출은 기존 `executionsApi.getByWorkflow`/`getById` 재사용이며 의도된 범위다. `editor-toolbar.tsx` 의 기존 시그니처는 변경되지 않았고, 추가된 `historyPanelOpen` state 는 컴포넌트 로컬이다. `ExecutionHistoryPanel` 의 props 시그니처(`workflowId`, `open`, `onClose`)는 신규 공개 인터페이스이며 기존 소비자가 없으므로 하위 호환 문제 없다. 유일한 실질적 부작용 위험은 라이브 실행 중 히스토리 항목 클릭 시 execution-store 를 강제 리셋하는 것으로, 진행 중 실행 데이터 소실 가능성이 있으나 현재 가드가 없다. 이 외 발견사항은 모두 INFO 수준(문서화 gap, 캐시 동작 명시 부재)이다.

## 위험도

LOW
