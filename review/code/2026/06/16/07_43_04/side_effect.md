# 부작용(Side Effect) 리뷰 — exec-history-panel (§7)

## 발견사항

### [INFO] `startHistoryView` — 전역 Zustand 스토어 상태를 의도적으로 교체
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/execution-store.ts` `startHistoryView` 구현
- 상세: `startHistoryView`는 `executionId`, `status`, `nodeStatuses`, `nodeResults`, `nodeResultIndexByExecId`, `lastIndexByNodeId`, `firstNoExecIdIndexByNodeId`, `startedAt`, `selectedResultNodeId`, `CLEAR_INPUT_AFFORDANCE`, `CLEAR_CONVERSATION_SNAPSHOT` 등 execution-store 의 대부분의 per-execution 상태 키를 한 번에 덮어씌운다. 이 동작은 `startExecution`과 동일한 패턴을 의도적으로 재현한 것으로 설계 문서에 명확히 기술돼 있다. 단, `drawerExpanded` (UI 선호값)는 의도적으로 유지한다는 주석이 붙어 있어 상태 변경 범위를 명확히 문서화했다.
- 부작용 위험도: 없음 — 의도된 설계이며 JSDoc 주석에 명시됨.
- 제안: 현행 유지.

### [INFO] `loadHistoricalExecution` — 전역 스토어를 두 단계(reset → hydrate)로 연속 변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` `loadHistoricalExecution`
- 상세: `startHistoryView(...)` 호출(스토어 reset) → `applyExecutionSnapshot(execution)` 호출(hydrate) 두 단계가 동기 순서로 실행된다. 이 패턴은 Zustand의 `set` 배치 처리에 의존하지 않고, 두 `set` 호출 사이에 React 렌더링이 끼어들 수 있는 구조다. 실제로 Zustand는 기본적으로 React batching 범위 밖에서 각 `set` 마다 구독자에게 알린다. 따라서 `startHistoryView` 직후 캔버스/드로어 구독 컴포넌트가 `status: "running"`, `nodeResults: []` 상태를 잠깐 렌더할 가능성이 있다. 이는 기존 `startExecution` → WebSocket 이벤트 스트림에서도 동일하게 발생하는 과도적 "flash" 이므로 이번 변경이 새롭게 도입한 문제는 아니다. 다만 동기 함수이기 때문에 WS 스트림보다 두 상태 사이 간격이 훨씬 짧아 실사용자가 빈 상태를 보게 될 가능성이 라이브 실행보다는 낮다.
- 부작용 위험도: 없음 — 라이브 실행 경로와 동일한 패턴이며 시각적 영향은 미미.
- 제안: 현행 유지. 향후 atomic 업데이트가 필요하면 두 호출을 단일 `set` 으로 합치는 리팩토링을 고려할 수 있으나 긴급하지 않다.

### [INFO] `ExecutionHistoryPanel` — `useQuery` queryKey 로 새 캐시 버킷 생성
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` L309
- 상세: `queryKey: ["editor-execution-history", workflowId]` 로 전용 캐시 키를 사용한다. 같은 `executionsApi.getByWorkflow` 를 호출하는 다른 쿼리(예: 전용 실행 내역 페이지)와 키가 분리돼 있어, 두 쿼리가 서로 캐시를 공유하거나 오염시키지 않는다. `enabled: open && !!workflowId` 조건으로 패널이 닫힌 상태에서는 네트워크 요청이 발생하지 않는다.
- 부작용 위험도: 없음.
- 제안: 현행 유지.

### [INFO] `editor-toolbar.tsx` — 새 boolean 상태 `historyPanelOpen` 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` L599
- 상세: `EditorToolbar` 컴포넌트 로컬 상태에 `historyPanelOpen` 하나가 추가됐다. 이 상태는 컴포넌트 인스턴스 내에 국한되며 전역 스토어를 건드리지 않는다. 기존 `deleteConfirmOpen`, `historyPickerOpen` 등과 동일한 패턴이다.
- 부작용 위험도: 없음.
- 제안: 현행 유지.

### [INFO] i18n 딕셔너리 — 새 키 추가만 수행, 기존 키 미변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/editor.ts`, `ko/editor.ts`
- 상세: 5개 신규 키(`executionHistory`, `historyDisabledRunning`, `executionHistoryEmpty`, `executionHistoryListFailed`, `executionHistoryLoadFailed`)가 추가됐다. 기존 키는 수정되지 않아 기존 번역 문자열을 사용하는 모든 호출자에 영향 없음.
- 부작용 위험도: 없음.
- 제안: 현행 유지.

### [INFO] `ExecutionHistoryPanel` — 공개 함수 시그니처 신규 도입, 기존 시그니처 미변경
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` L296
- 상세: `ExecutionHistoryPanel({ workflowId, open, onClose })` 는 신규 컴포넌트이므로 기존 호출자가 없다. 유일한 호출자는 `editor-toolbar.tsx`에서 추가된 렌더 코드다. 기존 함수/컴포넌트 시그니처를 변경한 항목은 없다.
- 부작용 위험도: 없음.

### [INFO] `startHistoryView` — `ExecutionState` 인터페이스에 신규 메서드 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/execution-store.ts` L903
- 상세: `ExecutionState` 인터페이스에 `startHistoryView` 메서드가 추가됐다. 기존 `startExecution` 등 다른 메서드 시그니처는 변경되지 않았다. 인터페이스 확장(addition)은 기존 타입 사용자에 영향을 주지 않는다.
- 부작용 위험도: 없음.

### [INFO] `loadHistoricalExecution` — `apply-execution-snapshot.ts` 의 공개 API 추가
- 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` L1052
- 상세: 기존 `applyExecutionSnapshot`, `isNodeWaitingForInput` 에 더해 `loadHistoricalExecution` 이 새로 export 됐다. 기존 export 시그니처나 동작에 변경이 없다. 신규 export 는 기존 소비자에게 영향 없이 추가된다.
- 부작용 위험도: 없음.

### [INFO] 네트워크 호출 — 새 진입점에서 기존 API 재사용, 추가 외부 서비스 없음
- 위치: `execution-history-panel.tsx` `useQuery`, `handleSelect`
- 상세: `executionsApi.getByWorkflow` 및 `executionsApi.getById` 는 이미 존재하는 API 클라이언트를 호출하는 것이다. 신규 외부 서비스 연동이나 예상치 못한 엔드포인트 호출은 없다. `enabled: open && !!workflowId` 조건으로 패널이 닫힌 상태에서는 네트워크 호출이 발생하지 않는다.
- 부작용 위험도: 없음.

### [INFO] 이벤트/콜백 — `onClose` 콜백 호출 경로 명확
- 위치: `execution-history-panel.tsx` `handleSelect` 내 `onClose()` 호출
- 상세: `onClose`는 항목 클릭 성공 경로에서만 호출된다. 상세 조회 실패 시(`catch` 블록)에는 `onClose`가 호출되지 않아 패널이 열린 채로 유지된다. 이 동작은 테스트로 검증되어 있다.
- 부작용 위험도: 없음.

---

## 요약

이번 변경은 프론트엔드 전용(backend 무변경) 기능 추가로, 부작용 관점에서 위험도가 낮다. 전역 상태 변경은 `useExecutionStore`를 통한 것으로 `startHistoryView` 메서드에 의해 의도적이고 문서화된 방식으로 수행된다. `loadHistoricalExecution`의 `startHistoryView` → `applyExecutionSnapshot` 두 단계 동기 호출은 Zustand 구독자에게 과도적 "empty" 상태를 잠깐 보여줄 수 있으나, 이는 기존 라이브 실행 경로(`startExecution` → WS 이벤트 스트림)와 동일한 패턴이며 해당 간격이 훨씬 짧아 실질 사용자 영향이 없다. 기존 함수 시그니처·공개 API·환경 변수는 변경되지 않았으며, 신규 추가된 export와 인터페이스 메서드는 기존 호출자에 영향을 주지 않는다. 의도치 않은 파일시스템 부작용, 전역 변수 도입, 외부 네트워크 호출은 발견되지 않았다.

## 위험도

NONE
