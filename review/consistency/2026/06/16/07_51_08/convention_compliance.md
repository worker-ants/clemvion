# 정식 규약 준수 검토 — `spec/3-workflow-editor/3-execution.md`

검토 모드: `--impl-done`, scope=`spec/3-workflow-editor/3-execution.md`, diff-base=`1899c05e`

---

## 발견사항

### [WARNING] `status: implemented` + `pending_plans` 비어있지 않음 — 규약 표 직접 모순

- **target 위치**: `spec/3-workflow-editor/3-execution.md` frontmatter (라인 3, 15–16)
- **위반 규약**: `spec/conventions/spec-impl-evidence.md §3` 상태 라이프사이클 표 — `implemented` 행의 `pending_plans:` 컬럼은 **"없음"**
- **상세**: 현재 frontmatter는 `status: implemented` 이면서 `pending_plans: [plan/in-progress/spec-sync-execution-gaps.md]` 를 동시에 선언한다. §3 표의 invariant("모든 약속 구현 완료 → pending_plans 없음")와 정면 충돌한다. 해당 plan 파일이 `plan/in-progress/` 에 아직 존재하므로 `spec-pending-plan-existence.test.ts` 는 통과하지만, `spec-status-lifecycle.test.ts` 의 guard (c)("partial 의 pending_plans 모두 complete 인데 status 미승격")는 `partial` 기준 체크라 이 방향 위반은 자동 차단되지 않는다. 즉 빌드 가드를 통과하더라도 규약 표의 semantic 을 위반한 상태다. §7 가 이번 PR 로 완전 구현되고 plan 의 모든 항목이 `[x]` 처리됐으므로, plan 을 `plan/complete/` 로 이동하고 spec frontmatter 에서 `pending_plans:` 를 제거해야 규약과 일치한다.
- **제안**: 이번 PR 커밋 안에서 `plan/in-progress/spec-sync-execution-gaps.md` 를 `plan/complete/spec-sync-execution-gaps.md` 로 이동하고, `spec/3-workflow-editor/3-execution.md` frontmatter 의 `pending_plans:` 행 전체를 삭제한다. plan 의 `started: 2026-06-03` 이 Gate C cutoff(`2026-06-04`) 이전이므로 `spec_impact` 선언은 면제된다 — 이동 자체만 수행하면 된다.

---

### [INFO] `<ImplAnchor>` `file` 지정 — `editor-toolbar.tsx` 가 정확한 entry point 파일이나 `execution-history-panel.tsx` 도 진입점으로 적합할 수 있음

- **target 위치**: `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` 및 `run-results.en.mdx` — 두 파일 모두 `<ImplAnchor file="codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx" symbol="ExecutionHistoryPanel" ...>`
- **위반 규약**: `spec/conventions/user-guide-evidence.md §1.1` — `file` 은 "가드가 실존 검증" 하고 `symbol` 은 "file 안 grep 대상"
- **상세**: `ExecutionHistoryPanel` 심볼은 `editor-toolbar.tsx` 에 import 되어 있으므로 가드(`impl-anchor-existence.test.ts`)가 grep ≥1 매치로 통과된다. 규약 위반은 아니다. 다만 `kind="ui-entry"` 는 "사용자가 '여기서 시작' 하는 클릭 가능한 entry" 를 가리키며, 패널 자체(`execution-history-panel.tsx`)보다 메뉴 버튼이 있는 `editor-toolbar.tsx` 가 더 정확한 진입점이다 — 현재 선택이 의미상 더 적합하다.
- **제안**: 현재 지정 방식이 규약과 일치하므로 변경 불필요. INFO 로 기록.

---

### [INFO] i18n dict 키 5개 양쪽 언어 동시 추가 — Principle 2 충족 확인

- **target 위치**: `codebase/frontend/src/lib/i18n/dict/en/editor.ts` + `dict/ko/editor.ts`
- **위반 규약**: 해당 없음 (규약 준수)
- **상세**: `executionHistory`, `historyDisabledRunning`, `executionHistoryEmpty`, `executionHistoryListFailed`, `executionHistoryLoadFailed` 5개 키가 en/ko 양쪽에 동시 추가됐다. `i18n-userguide.md` Principle 2("ko/en 사전 leaf key parity") 를 충족한다.
- **제안**: 변경 불필요.

---

### [INFO] `execution-history-panel.tsx` 하드코딩 문자열 없음 — Principle 1 충족

- **target 위치**: `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx`
- **위반 규약**: 해당 없음 (규약 준수)
- **상세**: 컴포넌트 내 모든 사용자 가시 문자열이 `t()` 키 호출을 통해 노출된다. `i18n-userguide.md` Principle 1 준수.
- **제안**: 변경 불필요.

---

## 요약

이번 diff 는 `spec/3-workflow-editor/3-execution.md §7` 인-에디터 실행 히스토리 구현을 반영한 spec 갱신, user-guide 두 언어 MDX 갱신(`<ImplAnchor>` 포함), i18n 사전 양쪽 언어 동시 추가, 신규 컴포넌트·store action·테스트를 포함한다. i18n Principle 1·2, `user-guide-evidence` `<ImplAnchor>` 규약, `spec-impl-evidence.md §1` 대상 경로의 `code:` 글로브 커버리지는 모두 충족한다. 단 frontmatter 가 `status: implemented` 임에도 `pending_plans:` 를 비우지 않아 `spec-impl-evidence.md §3` 의 라이프사이클 표 invariant("implemented → pending_plans 없음")와 모순된 상태로 남아있다. plan 의 전 항목이 `[x]` 완료됐으므로 `plan/in-progress/spec-sync-execution-gaps.md` 를 `plan/complete/` 로 이동하고 frontmatter 의 `pending_plans:` 를 제거하는 것이 이번 PR 에서 함께 수행되어야 한다. 그 외 CRITICAL 위반은 발견되지 않았다.

## 위험도

LOW
