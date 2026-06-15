# 신규 식별자 충돌 검토 결과

검토 범위: `spec/3-workflow-editor/3-execution.md` §7 인-에디터 실행 히스토리 패널 구현 diff (base `1899c05e`)

---

## 발견사항

### 1. **[WARNING]** `editor.executionHistory` i18n 키가 `workflows.executionHistory` 와 동일 영문 표기로 겹침

- **target 신규 식별자**: `editor.executionHistory` = `"Execution History"` (EN) / `"실행 히스토리"` (KO)
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/editor.ts:63`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/ko/editor.ts:61`
- **기존 사용처**: `workflows.executionHistory` = `"Execution History"` (EN) / `"실행 내역"` (KO)
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/workflows.ts:89`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/ko/workflows.ts:89`
  - 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/app/(main)/workflows/page.tsx:595` (워크플로 목록 페이지의 컨텍스트 메뉴 항목)
- **상세**: namespace 가 `editor` vs `workflows` 로 달라 런타임 충돌은 없다. 그러나 영문 값이 `"Execution History"` 로 동일하고, 두 컨텍스트(워크플로 목록 컨텍스트 메뉴 vs 에디터 더보기 메뉴)의 기능이 다르다(전자는 전용 실행 내역 페이지로 이동, 후자는 인-에디터 모달 패널 오픈). KO 번역은 `"실행 내역"` vs `"실행 히스토리"` 로 의도적으로 구별되어 있으나 EN 표기는 동일하여 사용자 입장에서 동일한 레이블이 다른 동작을 유발한다.
- **제안**: EN 레이블을 구별 — 에디터 더보기 항목은 `"Quick Execution History"` 또는 `"Execution History (In-editor)"` 로 차별화하거나, KO 와 마찬가지로 `editor.executionHistory` = `"Execution History Panel"` 처럼 범위를 명시하는 것을 검토. 또는 `workflows.executionHistory` 쪽을 `"View Execution History"` (페이지 이동 의미) 로 변경해 동작 차이를 레이블로 명확히 한다.

---

### 2. **[WARNING]** `editor.historyLoadFailed` 와 `editor.executionHistoryLoadFailed` 가 의미상 유사하여 혼동 가능

- **target 신규 식별자**: `editor.executionHistoryLoadFailed` = `"Failed to load execution."` (EN) / `"실행을 불러오지 못했어요."` (KO)
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/editor.ts:67`
  - 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx:68` (패널 내 항목 클릭 → 상세 조회 실패 토스트)
- **기존 사용처**: `editor.historyLoadFailed` = `"Failed to load execution input."` (EN) / `"실행 입력을 불러오지 못했어요."` (KO)
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/lib/i18n/dict/en/editor.ts:62`
  - 사용처: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:132` (Run with Input 다이얼로그의 "Load from History" 피커 실패 토스트)
- **상세**: 두 키 모두 `editor` namespace 에 존재하며 "실행 히스토리 로드 실패"라는 유사 상황에 쓰인다. 기존 `historyLoadFailed` 는 "실행 입력(input)" 불러오기 실패, 신규 `executionHistoryLoadFailed` 는 "실행 상세(detail)" 불러오기 실패다. 영문 메시지("Failed to load execution input." vs "Failed to load execution.")가 짧은 차이만 있어, 코드를 읽는 개발자가 두 키를 혼용하거나 잘못된 쪽을 참조할 위험이 있다.
- **제안**: 키 이름이나 메시지 중 하나에서 목적을 명확히 — 예: `executionHistoryLoadFailed` → 메시지를 `"Failed to load execution detail."` 로 변경하거나, 키 이름을 `executionDetailLoadFailed` 로 바꿔 "전체 히스토리 목록 실패(`executionHistoryListFailed`)" / "상세 적재 실패(`executionDetailLoadFailed`)" / "입력 불러오기 실패(`historyLoadFailed`)"의 3계층이 명확히 구분되도록 한다.

---

### 3. **[INFO]** `historyPanelOpen` 과 `historyPickerOpen` 이 같은 컴포넌트 내 유사 이름으로 공존

- **target 신규 식별자**: `historyPanelOpen` / `setHistoryPanelOpen` (로컬 state)
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx:87`
- **기존 사용처**: `historyPickerOpen` / `setHistoryPickerOpen`
  - 동일 파일 84번 줄 — "Load from History" 피커(Run with Input 다이얼로그 내부의 과거 입력 선택 UI) 제어용
- **상세**: 두 변수 모두 `editor-toolbar.tsx` 에 존재하며 prefix `history`가 동일하다. 기능은 분명히 다르지만(피커 vs 패널), 새 코드를 읽는 개발자가 두 `history*Open` 중 어느 쪽을 수정해야 할지 순간적으로 혼동할 수 있다.
- **제안**: 기존 `historyPickerOpen`을 `runInputHistoryPickerOpen` 또는 `inputHistoryPickerOpen` 으로 rename하거나, 신규 `historyPanelOpen`을 `executionHistoryPanelOpen` 으로 명명해 용도가 변수명에서 드러나도록 한다. 기능 정확성에는 영향 없으므로 INFO 등급.

---

## 요약

신규 도입된 식별자(`ExecutionHistoryPanel`, `loadHistoricalExecution`, `startHistoryView`, `editor-execution-history-menu`, `editor.executionHistory*` 계열 i18n 키) 중 런타임 충돌은 발견되지 않았다. 주요 주의 지점은 두 가지다. 첫째, `editor.executionHistory` 와 `workflows.executionHistory` 가 영문 레이블을 `"Execution History"` 로 공유하면서 각각 다른 동작(모달 패널 vs 페이지 이동)을 유발하여 최종 사용자 혼선 가능성이 있다. 둘째, `editor.historyLoadFailed`(기존, 입력 불러오기 실패)와 `editor.executionHistoryLoadFailed`(신규, 실행 상세 적재 실패)의 메시지가 유사해 개발자 혼용 위험이 있다. React Query 캐시 키 `"editor-execution-history"`는 기존 키와 겹치지 않으며, 컴포넌트·함수·store 메서드명도 기존 codebase 에서 사용되지 않은 신규 식별자다.

## 위험도

LOW

---

STATUS: OK
