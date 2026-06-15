# 유지보수성(Maintainability) 리뷰

## 발견사항

### 발견사항 — execution-history-panel.tsx

- **[INFO]** 매직 넘버 `limit: 20`
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` (쿼리 `limit: 20`)
  - 상세: `20` 이 인라인 주석으로 설명되어 있어 의도는 파악 가능하나, 상수로 추출하면 테스트·미래 변경 시 단일 지점 수정이 가능하다. 현재 run-dialog 의 `limit: 10` 과 서로 다른 숫자가 분산 존재해, 향후 혼동 여지가 있다.
  - 제안: `const PANEL_HISTORY_LIMIT = 20;` 과 같은 named constant 로 추출. (이전 리뷰 INFO-4 로 이미 보고됐으며 주석 FIX 로 처분됨 — 상수 추출 자체는 DEFER 수준)

- **[INFO]** 테스트 내 pagination mock 리터럴 반복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` — 각 테스트마다 `{ page: 1, limit: 20, totalItems: N, totalPages: N }` 패턴 반복
  - 상세: 7개 테스트 케이스 중 5개에서 동일한 pagination 오브젝트 리터럴이 반복된다. 필드 이름이 바뀌거나 pagination 스키마가 변경되면 여러 곳을 수정해야 한다.
  - 제안: `makePagination(total: number)` 헬퍼를 테스트 파일 상단에 추출해 중복 제거. (이전 리뷰 INFO-6 으로 DEFER 처분됨)

- **[INFO]** `loadingId !== null` strict equality (이전 리뷰에서 FIX 완료)
  - 위치: `execution-history-panel.tsx` — `disabled={loadingId !== null}` 확인됨
  - 상세: 이미 `!== null` 으로 수정되어 있어 추가 조치 불필요.

- **[INFO]** 렌더 함수 내 인라인 삼항 중첩 (가독성)
  - 위치: `execution-history-panel.tsx` — `div.min-h-0.flex-1.overflow-y-auto` 내부 `isLoading ? ... : isError ? ... : length === 0 ? ... : <ul>` 4단 삼항
  - 상세: 네 가지 UI 상태(로딩·에러·빈 목록·목록)를 하나의 JSX 블록에 삼항 체인으로 표현했다. 현재 각 분기가 단순(단일 div)이라 허용 가능하지만, 분기 중 하나라도 복잡해지면 추출이 어려워진다. 의도는 명확하며 가독성 임계선 직전 수준.
  - 제안: `renderContent()` 헬퍼 함수 또는 초기 return 패턴으로 추출하면 각 분기의 책임이 분리되어 향후 확장 용이.

### 발견사항 — editor-toolbar.tsx

- **[WARNING]** 거대 컴포넌트 비대화 지속 (이전 리뷰 W-7, DEFER)
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` — 900줄+ 단일 컴포넌트
  - 상세: 이번 PR 이 메뉴 항목 1개(`button`) + boolean state 1개(`historyPanelOpen`) + 패널 렌더 1개(`ExecutionHistoryPanel`) 만 추가한 것은 최소 침습 원칙에 부합한다. 그러나 컴포넌트 전체의 state 개수(6개 이상의 boolean open 상태), 함수 개수, JSX 깊이가 이번 변경으로 더욱 누적됐다. 이 파일은 이번 PR 이전부터 분리 필요성이 있었으며 MoreMenu 추출이 가장 효과적인 첫 단계다.
  - 제안: `MoreDropdownMenu` 컴포넌트 추출을 별도 리팩토링 plan 항목으로 등록. (이미 RESOLUTION W-7 DEFER 로 처분됨)

- **[INFO]** `historyPanelOpen` 상태 조건부 마운트 패턴 일관성
  - 위치: `editor-toolbar.tsx` — `{workflowId && <ExecutionHistoryPanel ... />}` 및 `open={historyPanelOpen}`
  - 상세: 동일 파일 내 다른 모달(예: deleteConfirm, historyPicker)은 `open` prop 없이 조건부 렌더(`condition && <Dialog>`)를 쓰는 반면, `ExecutionHistoryPanel` 은 `workflowId` 조건부 + `open` prop 이중 제어 방식이다. 패턴이 혼재하면 새 기여자가 어떤 패턴을 따라야 하는지 혼란스럽다.
  - 제안: 파일 내 모달 마운트 패턴을 한 가지로 통일하거나, 각 패턴의 선택 근거를 주석으로 명시.

### 발견사항 — apply-execution-snapshot.ts / execution-store.ts

- **[INFO]** `startHistoryView` 와 `startExecution` 의 코드 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/stores/execution-store.ts` — `startExecution` 과 `startHistoryView` 가 동일한 클리어 필드를 나열
  - 상세: 두 함수 모두 `nodeStatuses: new Map()`, `nodeResults: []`, `nodeResultIndexByExecId: new Map()`, `lastIndexByNodeId: new Map()`, `firstNoExecIdIndexByNodeId: new Map()`, `selectedResultNodeId: null`, `...CLEAR_INPUT_AFFORDANCE`, `...CLEAR_CONVERSATION_SNAPSHOT` 를 공유한다. 차이는 `status`(running 고정 vs now), `startedAt`(인자 vs now) 뿐이다. 향후 클리어 대상 필드가 추가되면 두 함수를 모두 수정해야 하는 산탄총 수술(shotgun surgery) 위험.
  - 제안: 공통 클리어 객체를 `CLEAR_EXECUTION_STATE` 상수나 `buildClearState()` 헬퍼로 추출해 두 함수가 spread 로 공유.

- **[INFO]** `loadHistoricalExecution` 함수 위치
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`
  - 상세: `loadHistoricalExecution` 은 store action 과 snapshot 적용을 조합하는 orchestration 함수인데, `websocket/` 디렉터리에 위치한다. 함수 자체는 WebSocket 과 무관하며 REST 상세 응답(`ExecutionData`)을 받아 처리한다. 이름과 위치가 약간 불일치하지만, `applyExecutionSnapshot` 이 같은 파일에 있어 응집은 높다. 명명과 위치가 현재 구조에서 허용 가능한 수준.
  - 제안: 명시적 주석(이미 존재)으로 충분. 향후 `utils/execution-orchestration.ts` 같은 전용 파일로 이동 고려.

### 발견사항 — 테스트 파일

- **[INFO]** `editor-toolbar-run-input.test.tsx` 내 실행 데이터 리터럴 중복
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` — §7 테스트 두 케이스(line 480~545)에서 동일한 execution 오브젝트 리터럴 중복
  - 상세: "Execution History: ⋮ 메뉴" 와 "Execution History: 항목 클릭" 두 테스트가 `{ id: "ex-9", workflowId: "wf-1", ... }` 를 각각 복사·붙여넣기. `SAMPLE` 상수(`execution-history-panel.test.tsx` 에 이미 존재하는 패턴)를 활용하지 않았다.
  - 제안: 공통 fixture 상수(예: `EX_SAMPLE`) 를 상단에 추출.

### 발견사항 — i18n

- **[INFO]** `executionHistoryLoadFailed` vs `historyLoadFailed` 네이밍 일관성
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/editor.ts` 및 `ko/editor.ts`
  - 상세: 기존 키 `historyLoadFailed`("히스토리에서 불러오기 실패")와 신규 키 `executionHistoryLoadFailed`("실행을 불러오지 못했어요")의 네이밍 패턴이 유사하지만 접두사 규칙이 상이하다(`history*` vs `executionHistory*`). 기능은 다르지만, 이름만 보면 혼동 가능.
  - 제안: 기존 `historyLoadFailed` 가 Load-from-History 픽커용임을 주석으로 명시하거나, 두 그룹이 독립된 기능임을 키 이름에서 명확히 구분.

---

## 요약

이번 PR(`§7 인-에디터 실행 히스토리 패널`)은 신규 컴포넌트(`ExecutionHistoryPanel`), store action(`startHistoryView`), 오케스트레이션 함수(`loadHistoricalExecution`)를 추가하고 기존 `applyExecutionSnapshot`을 재사용하는 최소 침습 설계다. 전반적인 가독성은 양호하고, 인라인 주석과 JSDoc 이 의도를 충분히 설명한다. 주요 유지보수성 위험은 세 가지다: (1) `editor-toolbar.tsx` 의 누적 비대화(이전 리뷰에서 DEFER 처분된 기술적 부채), (2) `startExecution`/`startHistoryView` 공유 클리어 필드가 별도 추출 없이 중복돼 향후 필드 추가 시 산탄총 수술 위험, (3) 테스트 픽스처 리터럴 반복. 이중 (2)는 상수 추출로 즉시 해소 가능한 INFO 수준이며, 나머지는 별도 리팩토링 범위다. Critical/Warning 신규 발견은 없다.

---

## 위험도

LOW
