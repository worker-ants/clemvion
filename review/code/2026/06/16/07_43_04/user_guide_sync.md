# 유저 가이드 동반 갱신(User Guide Sync) 리뷰

## 매트릭스 적재

`.claude/config/doc-sync-matrix.json` rows[] 19개 적재 완료. 본 PR 변경 파일 목록:

- `codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` (신규 TSX)
- `codebase/frontend/src/components/editor/run-results/__tests__/execution-history-panel.test.tsx` (신규 TSX 테스트)
- `codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx` (TSX 수정)
- `codebase/frontend/src/components/editor/toolbar/__tests__/editor-toolbar-run-input.test.tsx` (TSX 테스트 수정)
- `codebase/frontend/src/lib/i18n/dict/en/editor.ts` (신규 i18n 키 5개)
- `codebase/frontend/src/lib/i18n/dict/ko/editor.ts` (신규 i18n 키 5개)
- `codebase/frontend/src/lib/stores/execution-store.ts`
- `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`
- `codebase/frontend/src/content/docs/05-run-and-debug/run-results.mdx` (KO docs 갱신)
- `codebase/frontend/src/content/docs/05-run-and-debug/run-results.en.mdx` (EN docs 갱신)
- `spec/3-workflow-editor/3-execution.md`
- `plan/in-progress/spec-sync-execution-gaps.md`

---

## 발견사항

### trigger 매칭 결과

**매칭된 trigger 3개**:

1. **`new-ui-string`** (semantic) — `execution-history-panel.tsx` + `editor-toolbar.tsx` 신규 TSX 에 `t("editor.executionHistory")`, `t("editor.allExecutions")`, `t("editor.historyDisabledRunning")`, `t("editor.executionHistoryEmpty")`, `t("editor.executionHistoryListFailed")`, `t("editor.executionHistoryLoadFailed")` 6개 i18n 키 사용.

2. **`run-debug-flow-change`** (semantic) — `apply-execution-snapshot.ts` 에 `loadHistoricalExecution` 신규 함수, `execution-store.ts` 에 `startHistoryView` 신규 store action 추가 — 실행·디버깅 흐름의 "과거 실행 적재" 경로 신설. `05-run-and-debug/` docs 동반 갱신 대상.

3. **`userguide-gui-flow-section`** (semantic) — `run-results.mdx`/`run-results.en.mdx` 에 신규 `### 인-에디터 히스토리 패널 (빠른 조회)` 절 + `<ImplAnchor>` 동반 작성.

**비매칭 trigger** — `new-node`, `node-schema-change`, `new-warning-code`, `new-error-code`, `integration-provider-change`, `new-userguide-section-dir`, `auth-session-flow-change`, `expression-language-change`, `env-runtime-change`, `spec-major-change`, `backend-api-change`, `new-cross-cutting-enum`, `new-backend-ui-zod-value`, `new-handler-output-field`, `auth-config-type-enum-change`, `spec-defect-found`: 해당 없음.

---

### 누락 검출 결과

**trigger `new-ui-string` — i18n parity 검사**

신규 TSX 에서 사용하는 모든 i18n 키가 ko/en 양쪽에 대칭 등록됐는지 확인:

| 키 | ko 등록 | en 등록 |
|---|---------|---------|
| `editor.executionHistory` | line 61 | line 63 |
| `editor.historyDisabledRunning` | line 62 | line 64 |
| `editor.executionHistoryEmpty` | line 63 | line 65 |
| `editor.executionHistoryListFailed` | line 64 | line 66 |
| `editor.executionHistoryLoadFailed` | line 65 | line 67 |
| `editor.allExecutions` (기존 키, 재사용) | line 189 | line 191 |

**판정: 누락 없음.** 5개 신규 키가 ko/en 양쪽에 동일한 위치에 대칭 추가됐다. `allExecutions` 는 기존 키를 재사용하며 양쪽 모두 존재한다.

---

**trigger `run-debug-flow-change` — 05-run-and-debug/ docs 동반 갱신**

대상: `codebase/frontend/src/content/docs/05-run-and-debug/`

- `run-results.mdx` — 변경 set 에 포함됨. "실행 이력 조회" 절을 "인-에디터 히스토리 패널(빠른 조회)" + "전용 실행 내역 페이지(상세 탐색)" 구조로 재작성, `<ImplAnchor>` 동반 추가. KO 갱신 완료.
- `run-results.en.mdx` — 변경 set 에 포함됨. "Browsing execution history" 절을 동일 구조로 재작성, `<ImplAnchor>` 동반 추가. EN 갱신 완료.

**판정: 누락 없음.** KO/EN 양 docs 파일이 동일 PR 에서 동반 갱신됐다.

---

**trigger `userguide-gui-flow-section` — ImplAnchor 작성**

대상: user-guide GUI 흐름 절에 `<ImplAnchor kind="ui-entry">` 동반 작성.

- `run-results.mdx` `### 인-에디터 히스토리 패널 (빠른 조회)` 절에:
  ```
  <ImplAnchor
    kind="ui-entry"
    file="codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx"
    symbol="ExecutionHistoryPanel"
    describes="에디터 더보기(⋮) 메뉴의 '실행 히스토리' 항목 — 인-에디터 실행 이력 패널 진입점"
  />
  ```
  작성됨 (KO).

- `run-results.en.mdx` `### In-editor history panel (quick review)` 절에 동일 `<ImplAnchor>` 작성됨 (EN).

참조 파일(`codebase/frontend/src/components/editor/toolbar/editor-toolbar.tsx`)과 심볼(`ExecutionHistoryPanel` — 실제는 `execution-history-panel.tsx` 에서 import 돼 toolbar 에서 렌더됨)이 실존하며 impl-anchor-existence guard 조건을 충족한다.

**판정: 누락 없음.**

---

**backend-labels.ts 동반 갱신 여부**

신규 TSX 컴포넌트는 backend 의 warningCode/errorCode 를 새로 발행하지 않는다. `apply-execution-snapshot.ts` 의 `loadHistoricalExecution` 과 `execution-store.ts` 의 `startHistoryView` 는 기존 API 응답을 재사용하는 frontend-only 변경이며 신규 backend error code 가 없다. `backend-labels.ts` 동반 갱신 불필요 — 해당 없음.

---

**신규 섹션 디렉토리 locale 등록**

신규 docs 디렉토리 생성 없음 — `05-run-and-debug/` 은 기존 디렉토리의 기존 파일 수정. `locale.ts` 갱신 불필요 — 해당 없음.

---

## 요약

매트릭스 19개 trigger 중 3개(new-ui-string, run-debug-flow-change, userguide-gui-flow-section)가 본 PR 변경 파일에 매칭됐다. 3개 trigger 모두 동반 갱신이 같은 변경 set 에 포함되어 있다: i18n 신규 키 5개가 ko/en 양쪽에 parity 유지되어 추가됐고(`codebase/frontend/src/lib/i18n/dict/{ko,en}/editor.ts`), 실행·디버깅 흐름 변경에 대해 `05-run-and-debug/run-results.{mdx,en.mdx}` 가 KO/EN 동시 재작성됐으며, 신규 GUI 흐름 절에 `<ImplAnchor>` 가 양쪽 docs 에 동반 작성됐다. 동반 갱신 누락 0건.

## 위험도

NONE

STATUS=success ISSUES=0
