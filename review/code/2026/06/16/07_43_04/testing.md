# Testing Review — exec-history-panel (§7 인-에디터 실행 히스토리 패널)

## 발견사항

### [INFO] ExecutionHistoryPanel 단위 테스트 — 핵심 흐름 전건 커버 확인
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx`
- 상세: 이전 리뷰(00_24_26)에서 WARNING으로 지적된 갭 4건(isError 경로·loadingId disabled·toolbar 닫힘·loadHistoricalExecution orchestration)이 이번 커밋에서 모두 추가됐다. 현 시점 테스트 케이스:
  1. `open=false` 렌더 억제 + 쿼리 미호출
  2. 로딩 UI (`isLoading` 경로 — 미해소 Promise)
  3. "전체 실행" 링크 href 검증 (`/workflows/wf-1/executions`)
  4. `failedNodeCount > 0` 분기 (`(N failed)` 보조 표기)
  5. 목록 렌더 — 트리거·소요시간·노드수 + API 인수 검증 (`limit:20, sort:'started_at', order:'desc'`)
  6. 항목 클릭 → `getById` → `loadHistoricalExecution` → `onClose` 흐름
  7. 목록 조회 실패 (`isError`) → 에러 메시지 렌더
  8. `loadingId` 동시 클릭 차단 — 미해소 Promise로 disabled 상태 검증
  9. 빈 목록 empty state
  10. 상세 조회 실패 → 에러 토스트, 패널 유지, `loadHistoricalExecution` 미호출
- 이전 리뷰 대비 신규 추가: 케이스 2(isLoading), 3(href), 4(failedCount), 7(isError), 8(loadingId disabled). 제안: 추가 개선 불필요.

### [INFO] loadHistoricalExecution orchestration 단위 테스트 추가 및 호출 순서 명시 검증
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/__tests__/apply-execution-snapshot.test.ts`
- 상세: 이전 리뷰(00_24_26 WARNING-6, 07_33_57 WARNING-1)에서 지적된 `loadHistoricalExecution` 단위 테스트 부재가 해소됐다. 현재 테스트는 실 store를 사용해 다음을 검증한다:
  - `executionId` 세팅 확인
  - 과거 실행의 실제 `startedAt` 보존 (now 아님)
  - `status: 'completed'` (terminal 값 — applyExecutionSnapshot이 덮어씀)
  - `nodeResults.toHaveLength(1)` — 순서 역전(`applyExecutionSnapshot` 먼저 실행 시 `startHistoryView`가 결과를 비워 length 0이 됨) 감지 설계가 주석으로 명시됨
  - `nodeStatuses.get('node-a')?.status === 'completed'`
- 07_33_57 RESOLUTION W-1("FIX — 상태 단언이 순서 역전 시 실패함을 주석으로 명시") 반영 확인. 제안: 추가 개선 불필요.

### [INFO] startHistoryView store 테스트 — 충분하고 정확함
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`
- 상세: 이번 커밋에서 `status: 'running'` 단언(`expect(state.status).toBe("running")`)이 추가됐다 (07_33_57 testing#8 FIX). 검증 항목:
  - `executionId` 세팅
  - `status === 'running'` (transient — applyExecutionSnapshot이 terminal로 덮어쓰기 전)
  - `startedAt` 과거 시각 보존
  - `nodeResults`, `nodeStatuses`, `conversationMessages`, `selectedResultNodeId` 클리어
- `startExecution`과의 차이(startedAt 보존 vs now, status 고정 vs 직접 'running' 세팅)가 명확히 표현됨.

### [INFO] toolbar 통합 테스트 — 패널 열기와 항목 클릭→닫힘 모두 커버
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx`
- 상세: 이전 리뷰(00_24_26 WARNING-5)에서 지적된 갭이 해소됐다. 신규 케이스 2건:
  1. "⋮ → 실행 히스토리" 클릭 → 패널 dialog 렌더 + API 인수 검증
  2. 항목 클릭 → `loadHistoricalExecution` 호출 + dialog 닫힘(`queryByRole("dialog") === null`)
- `loadHistoricalExecution`을 `vi.mock("@/lib/websocket/apply-execution-snapshot", ...)` 로 격리해 toolbar 레벨의 onClose 콜백 연결이 `setHistoryPanelOpen(false)`로 이어지는지 통합 검증.

### [INFO] Mock 패턴 적절 — 격리·리셋·비동기 안정성 양호
- 위치: `execution-history-panel.test.tsx`, `editor-toolbar-run-input.test.tsx`, `apply-execution-snapshot.test.ts`
- 상세:
  - `executionsApi.getByWorkflow`, `executionsApi.getById`, `loadHistoricalExecution`, `sonner.toast`를 `vi.mock`으로 경계 격리.
  - `QueryClient({ defaultOptions: { queries: { retry: false } } })` 로 React Query 재시도 비활성화 — rejected promise 테스트 안정성 확보.
  - `beforeEach(() => { vi.clearAllMocks(); cleanup(); useLocaleStore.setState({ locale: "en" }); })` — mock 리셋 + DOM 클린업 + locale 고정으로 테스트 간 독립성 유지.
  - `waitFor` + `findBy*` 조합으로 비동기 상태 전이 대기 처리가 일관적.

### [INFO] cleanup() 호출 — beforeEach 배치 패턴 일관성
- 위치: `execution-history-panel.test.tsx` line 103
- 상세: `beforeEach`에서 `cleanup()`을 호출하는 패턴이 기존 `editor-toolbar-run-input.test.tsx`와 일치한다. `@testing-library/react`의 자동 cleanup이 활성화된 환경에서는 중복이나 기능 문제는 없다.

### [INFO] triggerLabel: null 경계값 — toolbar 테스트에서 간접 커버
- 위치: `editor-toolbar-run-input.test.tsx` 신규 §7 테스트 픽스처 (`triggerLabel: null`)
- 상세: `execution-history-panel.test.tsx`의 `SAMPLE` 픽스처에는 `triggerLabel: "Gehrig"` 만 있어 단위 테스트 레벨에서 null 케이스가 없다. toolbar 통합 테스트에서 `triggerLabel: null` 픽스처를 사용해 `TriggerCell` 의 null 처리가 간접 검증된다. 별도 단위 테스트 추가는 `TriggerCell` 컴포넌트 책임 범위라 이 레벨에서 요구되지 않음.

### [INFO] 테스트 픽스처 리터럴 중복 — 가독성 nit, 기능 문제 없음
- 위치: `execution-history-panel.test.tsx` 내 pagination 리터럴 (`{ page: 1, limit: 20, totalItems: N, totalPages: N }`) 반복, `editor-toolbar-run-input.test.tsx` 내 execution 오브젝트 리터럴 2회 중복
- 상세: 동일 픽스처가 여러 테스트 케이스에 반복된다. 스키마 변경 시 여러 곳 수정 필요. `SAMPLE` 상수 패턴이 `execution-history-panel.test.tsx`에 이미 있어 toolbar 테스트에서도 동일 패턴을 활용할 여지가 있다.
- 제안: 이전 리뷰(00_24_26 INFO-6, 07_33_57 DEFER)에서 DEFER 처분됨. 비결함·후속 nit.

### [INFO] i18n 키 추가에 대한 별도 테스트 불필요
- 위치: `en/editor.ts`, `ko/editor.ts`
- 상세: 4개 신규 i18n 키(`executionHistory`, `historyDisabledRunning`, `executionHistoryEmpty`, `executionHistoryListFailed`, `executionHistoryLoadFailed`)가 en·ko 양 언어에 대칭적으로 추가됐다. TypeScript 타입 시스템(`Dict["editor"]`)이 컴파일 시점에 검증하므로 별도 단위 테스트 불필요.

---

## 요약

이번 커밋은 두 라운드의 코드 리뷰(00_24_26, 07_33_57)에서 지적된 테스트 갭을 모두 해소했다. `ExecutionHistoryPanel` 단위 테스트는 10개 케이스로 확장돼 isLoading·isError·href·failedCount·loadingId disabled 등 모든 분기를 커버하며, `loadHistoricalExecution` orchestration 테스트는 실 store로 호출 순서 역전을 감지하는 설계까지 갖췄다. `startHistoryView` store 테스트에 `status` 단언이 추가되고, toolbar 통합 테스트에 패널 열기+닫힘 흐름이 모두 추가됐다. Mock 격리·비동기 안정성·테스트 간 독립성 모두 양호하며, 잔여 nit(픽스처 헬퍼 추출, cleanup 이중 호출)는 기능 문제 없는 DEFER 수준이다. 전체적으로 추가 테스트 보강 없이 머지 가능한 수준이다.

## 위험도

NONE
