# Testing Review — §7 인-에디터 실행 히스토리 패널

## 발견사항

### [INFO] 테스트 존재 여부 — 양호, 이전 리뷰 갭 전건 해소됨
- 위치: 전체 테스트 파일
- 상세: 이번 PR은 이전 `00_24_26` 리뷰에서 WARNING(W-3~W-6)으로 지적된 테스트 갭 4건을 모두 FIX했다. `execution-history-panel.test.tsx`(신규 7개 케이스), `apply-execution-snapshot.test.ts`(`loadHistoricalExecution` orchestration), `execution-store.test.ts`(`startHistoryView`), `editor-toolbar-run-input.test.tsx`(toolbar 통합 2개 케이스)가 추가됐다.
- 제안: 없음.

### [INFO] 커버리지 갭 — 로딩 상태(isLoading) 명시적 테스트 없음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx`
- 상세: `historyQuery.isLoading` 경로(Loader2 스피너 + "common.loading" 렌더)를 명시적으로 검증하는 케이스가 없다. QueryClient `retry: false` + 비동기 mock 패턴으로 간접 커버는 되지만, 로딩 UI를 명시적으로 단언하는 테스트가 없어 해당 분기 CSS/텍스트 변경 시 회귀를 감지하기 어렵다. 단, `isError`·`empty`·`list` 경로는 모두 커버된다.
- 제안: 낮은 우선순위. `getByWorkflowMock`을 미해소 Promise로 두고 "common.loading" 텍스트 또는 Loader2의 `data-testid`를 단언하는 케이스 1개 추가를 고려할 수 있다.

### [INFO] 커버리지 갭 — failedNodeCount > 0 분기 미테스트
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` line 159-161
- 상세: `failed > 0` 조건으로 `executions.failedCount` 보조 표기를 렌더하는 분기가 테스트되지 않는다. SAMPLE fixture는 `failedNodeCount: 0`만 사용한다. 저위험이나 해당 분기 변경 시 회귀 방지 안전망이 없다.
- 제안: `failedNodeCount: 2`를 가진 fixture로 `(N failed)` 텍스트 렌더를 단언하는 케이스 추가.

### [INFO] 커버리지 갭 — "All Executions" 링크 렌더 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx`
- 상세: 패널 헤더의 "All Executions" (`<a href={/workflows/${workflowId}/executions}`) 링크가 렌더되는지, 그리고 href가 올바른 workflowId를 포함하는지를 검증하는 테스트가 없다. href 문자열 오류는 현재 테스트로 잡히지 않는다.
- 제안: 기존 목록 렌더 케이스에 `screen.getByRole("link", { name: /all executions/i })` + `toHaveAttribute("href", ...)` 단언을 병합 가능.

### [INFO] Mock 적절성 — `loadHistoricalExecution` mock이 내부 orchestration을 숨김
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` line 26-30
- 상세: 패널 단위 테스트에서 `loadHistoricalExecution` 전체를 mock으로 대체하므로, 패널은 "올바른 인수를 넘기는가"만 검증하고 실제 store hydration은 검증하지 않는다. 이는 의도된 격리이며, orchestration 내부는 `apply-execution-snapshot.test.ts`의 통합 케이스가 별도로 커버한다. 두 테스트가 협력해 전체 경로를 커버하므로 적절한 설계다.
- 제안: 없음.

### [INFO] 테스트 격리 — `cleanup()` 수동 호출이 `beforeEach`에 있음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` line 71
- 상세: `@testing-library/react`는 Vitest의 `afterEach` 훅으로 자동 cleanup을 등록한다. `beforeEach`에서 수동 `cleanup()`을 추가로 호출하면 이전 테스트 잔여물을 명시적으로 제거하지만, 이중 cleanup이 발생한다. 현재는 문제가 없으나 관습적이지 않다.
- 제안: Vitest 자동 cleanup에 의존하고 `beforeEach`의 `cleanup()` 제거를 고려할 수 있다. 단, 기존 동작에 문제가 없으므로 낮은 우선순위.

### [INFO] 테스트 가독성 — pagination mock 리터럴 반복
- 위치: `execution-history-panel.test.tsx` 내 다수 케이스
- 상세: `pagination: { page: 1, limit: 20, totalItems: 1, totalPages: 1 }` 리터럴이 5개 케이스에 반복된다. 이전 리뷰 INFO-6(DEFER)와 일치하는 nit이다.
- 제안: `makePagination(totalItems: number)` 헬퍼로 추출하면 가독성이 향상되지만 기능 회귀 위험은 없어 낮은 우선순위.

### [INFO] `startHistoryView` 테스트 — `drawerOpen` 상태 변경 미검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`
- 상세: `startHistoryView` 테스트가 `executionId`, `startedAt`, `nodeResults`, `nodeStatuses`, `conversationMessages`, `selectedResultNodeId`를 검증하지만, `startExecution`이 드로어를 여는 부수 효과(있다면)와 `status` 초기 transient 값(`"running"`)을 명시적으로 단언한다. `status`가 `"running"`으로 세팅됨은 구현 주석에 기술돼 있으나 테스트에서 `state.status`를 단언하지 않는다.
- 제안: `expect(state.status).toBe("running")` 단언 추가로 transient 상태 보장.

### [WARNING] `apply-execution-snapshot.test.ts`의 `loadHistoricalExecution` 테스트 — `startHistoryView`와 `applyExecutionSnapshot` 호출 순서를 직접 검증하지 않음
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts` line 945 이하
- 상세: 현재 테스트는 실제 store를 사용해 최종 상태를 단언하는 통합 스타일로, `startHistoryView → applyExecutionSnapshot` 호출 순서 자체를 검증하지 않는다. 순서가 역전되면(즉, `applyExecutionSnapshot` 후 `startHistoryView` 호출 시) `applyExecutionSnapshot`이 세팅한 `executionId`/`nodeResults`를 `startHistoryView`의 reset이 덮어써 빈 상태가 된다. 그러나 최종 상태 단언(`executionId`, `nodeResults`, `status` 등)이 올바른 순서에서만 성공하므로 실질적으로 순서가 간접 보장된다.
- 제안: 현재 수준으로 충분하지만, spy를 추가해 `startHistoryView.mock.invocationCallOrder < applyExecutionSnapshot.mock.invocationCallOrder`를 명시하면 설계 의도가 더 명확해진다. 낮은 우선순위.

## 요약

§7 인-에디터 실행 히스토리 패널에 대한 테스트 커버리지는 전반적으로 양호하다. 이전 리뷰(00_24_26)에서 지적된 4건의 WARNING 테스트 갭(isError 경로, loadingId disabled, toolbar 닫힘, loadHistoricalExecution orchestration)이 모두 해소됐으며, 핵심 행복 경로(목록 렌더, 항목 클릭-적재-닫기, 빈 목록, 상세 조회 실패 토스트)는 `ExecutionHistoryPanel` 단위 테스트로 격리 검증되고, store `startHistoryView`와 `loadHistoricalExecution` orchestration은 별도 파일에서 독립적으로 테스트된다. 미비 사항은 isLoading 명시 단언, failedNodeCount > 0 분기, "All Executions" href 검증, `status: "running"` transient 단언 등이며 모두 INFO 수준의 개선 사항이다. 하나의 WARNING은 `startHistoryView → applyExecutionSnapshot` 호출 순서를 spy로 명시하지 않는 점이나, 최종 상태 단언으로 순서가 간접 보장되므로 실질 결함 위험은 낮다.

## 위험도
LOW
