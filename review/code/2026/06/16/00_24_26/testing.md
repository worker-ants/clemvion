# Testing Review — exec-history-panel

## 발견사항

### [INFO] `ExecutionHistoryPanel` 테스트 커버리지 — 핵심 흐름 양호
- 위치: `/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx`
- 상세: open=false 렌더 억제, 목록 렌더(§7.2), 항목 클릭→상세 조회→적재→닫기(§7.3), 빈 목록(empty state), 상세 조회 실패 토스트 5가지 케이스가 모두 커버됨. 각 케이스는 단일 목적을 명확히 기술하고 있어 가독성이 높다.

### [WARNING] `historyQuery.isError` 경로(목록 조회 실패)에 대한 테스트 없음
- 위치: `execution-history-panel.tsx` 라인 457 (`historyQuery.isError` 분기), `execution-history-panel.test.tsx`
- 상세: `getByWorkflowMock.mockRejectedValue(...)` 케이스가 존재하지 않는다. 컴포넌트는 `historyQuery.isError` 시 "Failed to load execution history." 오류 메시지를 렌더하는데, 이 경로에 대한 단위 테스트가 없어 회귀 시 무음으로 실패할 수 있다.
- 제안:
  ```ts
  it("목록 조회 실패 → 오류 메시지 렌더", async () => {
    getByWorkflowMock.mockRejectedValue(new Error("network"));
    renderPanel();
    expect(
      await screen.findByText(/Failed to load execution history/i),
    ).toBeInTheDocument();
  });
  ```

### [WARNING] `loadingId` 동시 클릭 차단(disabled 상태) 렌더 테스트 없음
- 위치: `execution-history-panel.tsx` 라인 475 (`disabled={loadingId != null}`), 테스트 파일
- 상세: 한 항목 클릭 중에 다른 항목 버튼이 `disabled` 처리되는 것이 컴포넌트의 명시적 구현이다. 이 상태 관리 로직에 대한 테스트가 없어, 향후 `loadingId` 조건이 변경될 경우 자동 감지가 불가능하다.
- 제안: 목록에 항목 두 개를 넣고, 한 항목 클릭 직후 나머지 button들이 `disabled` 속성을 갖는지 확인하는 케이스 추가.

### [WARNING] `EditorToolbar` 통합 테스트에서 `ExecutionHistoryPanel` 의 패널 닫기·항목 선택 흐름이 누락됨
- 위치: `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` (추가된 §7 테스트)
- 상세: 추가된 테스트는 ⋮ 메뉴 클릭 → 패널 open → 목록 조회까지만 검증한다. 패널 내 항목 클릭 → `loadHistoricalExecution` 호출 → 패널 닫힘 흐름은 통합 테스트 수준에서 확인되지 않는다. 단위 수준에서는 `execution-history-panel.test.tsx` 가 커버하지만, toolbar 레벨에서 onClose 콜백이 실제로 `setHistoryPanelOpen(false)` 에 연결되는지 검증이 빠져 있다.
- 제안: 기존 테스트에 항목 클릭→패널 닫힘 단계를 추가하거나, 독립 케이스로 분리.

### [INFO] `startHistoryView` store 테스트 — 적절하고 충분함
- 위치: `codebase/frontend/src/lib/stores/__tests__/execution-store.test.ts`
- 상세: `executionId`, `startedAt` 보존, `nodeResults`·`nodeStatuses`·`conversationMessages`·`selectedResultNodeId` 초기화가 모두 assert된다. `startExecution` 과의 차이점(startedAt 보존 vs now)이 명확히 설명되어 있다.

### [WARNING] `loadHistoricalExecution` 자체 단위 테스트 없음
- 위치: `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`, 관련 테스트 파일 부재
- 상세: `loadHistoricalExecution` 은 `startHistoryView` + `applyExecutionSnapshot` 을 순서대로 호출하는 orchestration 함수다. `ExecutionHistoryPanel` 테스트에서 mock으로 대체되어 있어, 실제 두 호출 순서·인수 전달이 맞는지는 검증되지 않는다. `applyExecutionSnapshot` 자체 테스트가 별도 존재하더라도, 조합 호출 경로의 통합 테스트가 빠져 있다.
- 제안: `apply-execution-snapshot.test.ts` 에 `loadHistoricalExecution` 케이스 추가. `startHistoryView` 가 먼저 호출되고 올바른 인수가 전달되는지 spy로 검증.

### [INFO] Mock 패턴 적절 — 모듈 경계 격리 명확
- 위치: `execution-history-panel.test.tsx`, `editor-toolbar-run-input.test.tsx`
- 상세: `executionsApi`, `loadHistoricalExecution`, `sonner.toast` 를 vi.mock으로 격리하고, `QueryClient`에 `retry: false`를 설정해 비동기 테스트 안정성을 확보했다. mock 변수가 모듈 최상단에 선언되고 `beforeEach`에서 `vi.clearAllMocks()`로 리셋되어 테스트 간 격리가 유지된다.

### [INFO] `cleanup()` 호출 — `afterEach` 대신 `beforeEach` 배치
- 위치: `execution-history-panel.test.tsx` 라인 103, `editor-toolbar-run-input.test.tsx`
- 상세: `beforeEach`에서 `cleanup()`을 호출하는 패턴은 기존 `editor-toolbar-run-input.test.tsx` 와 일치하며 vitest + testing-library 조합에서 일반적으로 허용된다. `@testing-library/react`의 자동 cleanup이 활성화된 환경이라면 중복이지만, 문제가 생기지는 않는다.

### [INFO] i18n 키 추가에 대한 별도 테스트 불필요
- 위치: `en/editor.ts`, `ko/editor.ts`
- 상세: 4개 신규 i18n 키(`executionHistory`, `executionHistoryEmpty`, `executionHistoryListFailed`, `executionHistoryLoadFailed`)가 en·ko 양 언어에 대칭적으로 추가됐다. 이 변경에 대한 별도 타입 테스트는 TypeScript 타입 시스템(`Dict["editor"]`)이 컴파일 시점에 검증하므로 추가 단위 테스트는 불필요하다.

### [INFO] `triggerLabel: null` 케이스 — toolbar 테스트에 커버됨
- 위치: `editor-toolbar-run-input.test.tsx` 신규 테스트, `triggerLabel: null`
- 상세: `execution-history-panel.test.tsx`의 `SAMPLE` 픽스처에는 `triggerLabel: "Gehrig"`만 있어 null 케이스가 없다. toolbar 테스트의 `ex-9` 픽스처에 `triggerLabel: null`이 포함되어 있어 `TriggerCell` 컴포넌트가 null을 안전하게 처리하는지 간접 확인된다. 다만 `ExecutionHistoryPanel` 단위 테스트에는 null 케이스가 없으므로 경계값 커버리지가 분산되어 있다.

## 요약

`ExecutionHistoryPanel` 단위 테스트는 핵심 5가지 흐름(렌더 억제·목록·항목 클릭·빈 상태·에러 토스트)을 명확하게 커버하며, `startHistoryView` store 테스트도 충분하다. 주요 갭은 두 가지다: (1) 목록 조회 자체가 실패하는 `isError` 경로에 대한 테스트 누락, (2) `loadHistoricalExecution` orchestration 함수의 단위 테스트 부재로 인해 `startHistoryView` → `applyExecutionSnapshot` 호출 순서·인수 전달이 런타임에서만 검증된다. toolbar 통합 테스트에서 패널 닫힘까지 확인되지 않는 점도 경계 케이스 회귀 위험을 높인다. 전체적으로 테스트 구조·격리·가독성은 양호하며, critical한 실행 누락보다는 엣지 케이스 보강이 필요한 수준이다.

## 위험도

LOW
