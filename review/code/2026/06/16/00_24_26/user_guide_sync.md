# 유저 가이드 동반 갱신 리뷰

## 발견사항

### [WARNING] 실행·디버깅 흐름 변경 — `05-run-and-debug/run-results.{mdx,en.mdx}` 갱신 누락

- **변경 파일**:
  - `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` (신규)
  - `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (⋮ 메뉴에 "실행 히스토리" 진입점 추가)
  - `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts` (`loadHistoricalExecution` 추가)
  - `codebase/frontend/src/lib/stores/execution-store.ts` (`startHistoryView` 추가)

- **매트릭스 항목**: `run-debug-flow-change` — "실행·디버깅 흐름 변경" → `codebase/frontend/src/content/docs/05-run-and-debug/`

- **누락된 동반 갱신**:
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx`
  - `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx`

- **상세**: `run-results.mdx` §"실행 이력 조회" (line 112~123) 와 `run-results.en.mdx` §"Browsing execution history" (line 101~114) 에는 `⋮ → 실행 히스토리` 를 클릭하면 `/workflows/:id/executions` 전용 페이지로 이동하는 흐름(Steps 1~4)이 기술돼 있다. 그러나 이번 PR 로 추가된 `ExecutionHistoryPanel` 은 페이지 이동 없이 **인-에디터 모달 패널** 을 열어 선택한 과거 실행을 Run Results 드로어 + 캔버스 오버레이로 적재하는 전혀 다른 동작을 한다. 현재 사용자 가이드 설명("Step 2: /workflows/:id/executions 에서 상태별 필터..., Step 3: 행 클릭 시 상세 페이지로 이동")은 실제 동작과 불일치하여 사용자 혼선을 야기한다.

- **제안**:
  1. `run-results.mdx` "실행 이력 조회" 절의 Steps 를 갱신: Step 1 에서 패널이 열리고, 항목 클릭 시 Run Results 드로어가 채워지는 인-에디터 흐름으로 재작성. "전체 실행" 링크로 더 깊은 탐색을 위임하는 내용 추가.
  2. `run-results.en.mdx` §"Browsing execution history" 를 동일하게 갱신 (KO/EN 시블링 동시 갱신 원칙).
  3. "이 입력으로 다시 실행" 는 패널 안의 별도 버튼이 아닌 드로어 Re-run(§10.14)으로 제공되는 점도 명시.

---

### [INFO] spec-major-change — `spec: status` 승격 시 `pending_plans:` 잔류 확인 필요

- **변경 파일**: `spec/3-workflow-editor/3-execution.md` (`status: partial` → `status: implemented`)

- **매트릭스 항목**: `spec-major-change` — "`status: implemented` 이면 `code:` 글로브 ≥1 매치 보장"

- **상세**: `code:` 글로브는 `codebase/frontend/src/components/editor/run-results/*.tsx` 등으로 신규 파일을 커버하므로 글로브 ≥1 매치는 충족된다. 다만 `status: implemented` 인데 `pending_plans: [plan/in-progress/spec-sync-execution-gaps.md]` 가 남아 있다. `spec-status-lifecycle.test.ts` 가드가 `implemented` 상태에서 `pending_plans:` 보유를 어떻게 처리하는지 별도 확인이 필요하다. 이번 PR 에서 `plan/in-progress/spec-sync-execution-gaps.md` 의 해당 태스크가 완료 처리되었는지도 점검 권고.

- **제안**: `spec/3-workflow-editor/3-execution.md` 의 `pending_plans:` 항목이 실제로 완료된 태스크를 가리키면 제거하거나, 아직 남은 gap 이 있다면 `status: partial` 을 유지해야 한다. `spec-status-lifecycle.test.ts` 실행으로 가드 통과 여부 확인 권고.

---

## i18n parity 확인 결과

`execution-history-panel.tsx` 가 사용하는 `t("editor.executionHistory")`, `t("editor.executionHistoryEmpty")`, `t("editor.executionHistoryListFailed")`, `t("editor.executionHistoryLoadFailed")`, `t("editor.allExecutions")` 5개 키 모두 `dict/ko/editor.ts` 와 `dict/en/editor.ts` 양쪽에 등록돼 있다. i18n parity 위반 없음.

`formFileMimeRejected` / `formFileSizeExceeded` / `formFileTotalExceeded` / `formFileCountExceeded` 4개 키도 ko/en 양쪽에 동시 추가됐다. parity 충족.

## 요약

매트릭스 총 19개 trigger 중 이번 변경에 매칭되는 trigger 2개 확인 (`run-debug-flow-change`, `spec-major-change`). `run-debug-flow-change` 에 대해 `05-run-and-debug/run-results.{mdx,en.mdx}` 의 "실행 이력 조회/Browsing execution history" 절이 실제 구현과 불일치하는 상태로 갱신 누락 1건 (WARNING). `spec-major-change` 에 대해 `pending_plans:` 잔류 여부 확인 권고 1건 (INFO). i18n parity 위반 없음.

## 위험도

MEDIUM
