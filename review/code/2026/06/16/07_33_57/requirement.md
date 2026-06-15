# 요구사항(Requirement) 리뷰 — §7 인-에디터 실행 히스토리 패널 (fix 커밋 반영)

## 점검 결과

### 발견사항

- **[INFO]** spec §7 상태 — 현재 브랜치 HEAD 기준 `spec/3-workflow-editor/3-execution.md` 의 §7 헤더는 "**상태: 구현.**" 으로 명기돼 있고, frontmatter `status: implemented`, Rationale R-7 도 완비돼 있다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/spec/3-workflow-editor/3-execution.md` §7 (line 252–284), R-7 (line 721–729)
  - 상세: 이전 리뷰(00_24_26)에서 WARNING W-1 로 보고된 "spec §7 이 미구현 상태" 는 stale-read FP 였으며, RESOLUTION W-1 에서 이미 반증됐다. 현 HEAD 에서 spec 과 구현이 일치한다.
  - 제안: 조치 불필요.

- **[INFO]** 기능 완전성 — spec §7.2 목록 요건(상태 아이콘 + 트리거 출처 + 소요 시간 + 노드 카운트 + 상대 시각, `limit=20`, `sort=started_at desc`)과 구현이 1:1 일치한다.
  - 위치: `/Volumes/project/private/clemvion/.claude/worktrees/exec-history-panel/codebase/frontend/src/components/editor/run-results/execution-history-panel.tsx` (getByWorkflow 호출 시 `limit:20, sort:'started_at', order:'desc'`, 각 항목 STATUS_ICON/TriggerCell/formatDuration/timeAgo 표시)
  - 상세: spec §7.2 "워크플로의 최근 실행을 시작 시각 내림차순으로 나열한다 (GET /api/executions/workflow/:id, 기본 20건)" 과 구현이 정확히 일치한다. 각 항목 필드(상태 아이콘·트리거·소요·노드카운트·상대시각)도 모두 렌더링된다.

- **[INFO]** §7.3 항목 클릭 흐름 — `handleSelect` 가 `getById` → `loadHistoricalExecution` → `onClose` 순서로 실행하며 spec 의 "상세 조회 → 드로어 채움 → 패널 닫기" 흐름과 일치한다.
  - 위치: `execution-history-panel.tsx` line 290–306
  - 상세: spec §7.3 "해당 실행의 상세(GET /api/executions/:id)를 받아 모든 노드 실행 결과로 Run Results 드로어를 채운다 (§10.10 — 라이브 실행과 동일한 store hydration 경로 `applyExecutionSnapshot` 재사용)" — `loadHistoricalExecution` 이 `startHistoryView` + `applyExecutionSnapshot` 를 조합해 이 요건을 충족한다.

- **[INFO]** `startHistoryView` store action — `startExecution` 과 동일한 per-execution 클리어(nodeResults, nodeStatuses, conversationMessages 등)를 수행하되 `startedAt` 은 과거 실행 시각을 보존하고 `executionId` 를 세팅해 Re-run(§10.14) 이 동작하도록 한다.
  - 위치: `execution-store.ts` line 537–549
  - 상세: spec §7.3 "이 입력으로 다시 실행": 드로어 헤더의 Re-run(§10.14)이 그 실행의 입력으로 Re-run 모달을 띄운다 (별도 버튼 신설 없이 적재된 실행에 대해 동작)" — `executionId` 세팅으로 이를 충족한다. R-7 설계 의도와 일치.

- **[INFO]** `loadHistoricalExecution` 래퍼 — 주석에 "입력은 반드시 `nodeExecutions` 를 포함한 상세 응답이어야 한다" 고 명시돼 있어 spec §7 목록 응답(노드 본문 제외 N+1 회피, §5 R-1)과의 차이를 올바르게 처리한다.
  - 위치: `apply-execution-snapshot.ts` line 990–1009

- **[INFO]** 유저 가이드(`run-results.mdx`, `run-results.en.mdx`) — 이 커밋에서 "⋮ → 실행 히스토리 = 페이지 이동" 기술을 "인-에디터 패널 → 드로어 적재 + 캔버스 오버레이 + Re-run" 으로 재작성했다. 이전 리뷰 W-2 FIX 가 반영됐다.

- **[INFO]** 테스트 커버리지 — 이전 리뷰 W-3/W-4/W-5/W-6 로 요구된 테스트(isError 경로, loadingId disabled, toolbar 닫힘, loadHistoricalExecution orchestration)가 이번 커밋에 모두 추가됐다.
  - 위치: `execution-history-panel.test.tsx` (isError, loadingId disabled, 빈 목록, 상세 실패 토스트), `editor-toolbar-run-input.test.tsx` (패널 열기, 항목 클릭 → 닫힘), `apply-execution-snapshot.test.ts` (loadHistoricalExecution 단위)

- **[INFO]** 아이콘 일치 — `editor-toolbar.tsx` 와 `execution-history-panel.tsx` 양쪽 모두 `Activity` 아이콘을 사용한다. 이전 리뷰 W-8 FIX 반영 완료.

- **[INFO]** `allExecutions` i18n 키 — `execution-history-panel.tsx` 에서 `t("editor.allExecutions")` 를 사용하는데, 해당 키(`allExecutions: "All Executions"` / `"전체 실행"`)가 en/ko dict 에 이미 존재한다. 이번 diff 에는 포함되지 않았지만 기존 코드에 있어 런타임 누락이 없다.

- **[INFO]** `executions.failedCount` i18n 키 — `execution-history-panel.tsx` 에서 `t("executions.failedCount", { count: failed })` 사용. `"({{count}} failed)"` / `"({{count}}개 실패)"` 가 en/ko dict 에 존재해 런타임 누락 없음.

- **[INFO]** 엣지 케이스: `completedNodeCount ?? 0` / `totalNodeCount ?? 0` / `failedNodeCount ?? 0` — null/undefined 방어가 되어 있다. 빈 목록(`executions.length === 0`) 과 로딩/에러 상태도 모두 처리된다.

- **[INFO]** 엣지 케이스: `open=false` 이면 `return null` 로 조기 종료하고, `enabled: open && !!workflowId` 로 쿼리도 실행하지 않는다. `workflowId` 가 없으면 메뉴 버튼이 `disabled={!workflowId}` 이고 패널 렌더도 `{workflowId && ...}` 로 조건부라 빈 ID 전달 자체가 차단된다.

- **[INFO]** `loadingId !== null` strict 비교 — `execution-history-panel.tsx` 에서 `disabled={loadingId !== null}` 을 사용해 이전 리뷰 INFO-5 FIX 가 반영됐다.

- **[INFO]** `loadHistoricalExecution` 내 `execution.startedAt ?? null` — `ExecutionData.startedAt` 이 optional 인 경우에도 null-safe 하게 처리된다.

- **[INFO]** 에러 시나리오: `handleSelect` 의 catch 블록에서 `toast.error(t("editor.executionHistoryLoadFailed"))` 가 호출되고 `loadHistoricalExecution` 은 호출되지 않으며 패널이 닫히지 않는다. spec §7.3 의 흐름(실패 시 패널 유지)과 일치하며, 테스트(`상세 조회 실패 → 에러 토스트, 패널 유지`)로 검증됐다.

- **[INFO]** `pending_plans` 필드 — frontmatter 에 `spec-sync-execution-gaps.md` 가 잔류해 있다. RESOLUTION INFO-7 에서 확인했듯 `spec-status-lifecycle.test.ts` 가드는 `implemented` 상태에서 `pending_plans` 를 허용(partial 만 제약)하므로 빌드 차단 없음. plan lifecycle 이동(→complete)은 planner 소관이다.

### 요약

이번 커밋(fix 반영)은 spec/3-workflow-editor/3-execution.md §7 의 모든 요건(7.1 진입점, 7.2 목록, 7.3 항목 클릭·드로어 적재·캔버스 오버레이·Re-run 재사용, 범위 한계 v1)을 완전히 구현하고 있다. spec §7 은 HEAD 기준으로 이미 `status: implemented` 와 R-7 Rationale 를 포함해 구현과 일치하며, 이전 리뷰 사이클(00_24_26)에서 제기된 Warning(유저 가이드 불일치, 테스트 갭, 아이콘 불일치, strict 비교, 코멘트 갱신)이 이번 커밋에서 모두 FIX 됐다. 엣지 케이스(null/undefined, 빈 목록, 로딩·에러 상태, loadingId disabled, open=false) 처리도 완비됐고, TODO/FIXME 코멘트는 존재하지 않는다. 비즈니스 로직(limit:20, 최신순, 상세 조회 후 hydration, 패널 닫기, Re-run 재사용, 전용 페이지 위임)이 spec 본문과 line-level 로 일치한다.

### 위험도

NONE

STATUS=success
