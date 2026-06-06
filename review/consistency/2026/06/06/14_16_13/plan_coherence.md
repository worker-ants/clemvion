# Plan 정합성 검토 결과

검토 모드: `--impl-done`
Target: `spec/5-system/4-execution-engine.md` (구현 영역 `codebase/backend/src/modules/executions/executions.service.ts`, `codebase/frontend/src/lib/websocket/apply-execution-snapshot.ts`, 관련 test/e2e)
Worktree: `fix-carousel-waiting-status-4d4ed3` (branch `claude/fix-carousel-waiting-status-4d4ed3`)

---

## 발견사항

### [INFO] target 에 spec 직접 편집 없음 — spec 갱신은 draft plan 으로 위임됨
- target 위치: `plan/in-progress/spec-update-execution-engine-pre-park-window.md` (이 worktree 에서 신규 생성)
- 관련 plan: 없음 (draft plan 자체가 후속 project-planner 작업 추적)
- 상세: `fix-carousel-waiting-status-4d4ed3` 의 구현 변경(`reconcilePreParkWaitingStatus`, `isNodeWaitingForInput`)은 `spec/5-system/4-execution-engine.md §1.1` 의 "원자성 보장" 블록퀘이트에 pre-park read-window intra-row 정규화 기술을 요구한다. 이 spec 갱신은 draft plan(`spec-update-execution-engine-pre-park-window.md`)으로만 남아 있고, target 구현 자체가 spec 을 수정하지는 않는다. `--impl-done` 체크 대상인 spec 갱신이 아직 미완료.
- 제안: `fix-carousel-waiting-status.md` 체크리스트의 마지막 항목 `/consistency-check --impl-done` 수행 전 draft plan 의 spec 변경을 project-planner 가 실행해 `spec/5-system/4-execution-engine.md §1.1` 을 갱신하거나, 본 plan 에 "spec 갱신 완료 시 본 plan 도 complete 이동 가능" 게이트를 명시해 두면 충분.

---

### [WARNING] spec-update draft plan 이 `exec-park-durable-resume` plan 의 §1.1 편집 영역과 잠재 충돌
- target 위치: `plan/in-progress/spec-update-execution-engine-pre-park-window.md` §제안 변경 — `spec/5-system/4-execution-engine.md §1.1` 원자성 보장 blockquote 끝에 신규 blockquote 삽입 제안
- 관련 plan: `plan/in-progress/exec-park-durable-resume.md` — "[Phase B 선행 — 완료 2026-06-05] spec 모델 개정: `4-execution-engine.md` §1.1 전이표·§4.x banner 2개…" 로 이미 §1.1 을 수정한 이력이 있으며, PR-B2 (branch `claude/exec-park-pr-b2`) 가 현재 active worktree 에서 추가 변경 중.
- 상세: `exec-park-durable-resume` 의 Phase-B-선행 커밋(main 에 이미 랜딩)이 §1.1 전이표를 편집했고, `spec-update-execution-engine-pre-park-window.md` 의 제안은 그 §1.1 원자성 보장 blockquote 끝에 새 blockquote 를 추가하는 것이다. 이 두 편집은 **동일 단락 인접 위치**를 건드려, draft plan 실행 시 exec-park plan 의 기존 §1.1 편집 결과를 기반으로 작업해야 한다. draft plan 실행자(project-planner)가 현재 main HEAD 의 §1.1 내용을 확인하고 신규 blockquote 삽입 위치를 정확히 맞춰야 한다.
- 제안: `spec-update-execution-engine-pre-park-window.md` 에 "exec-park Phase B spec 갱신 이후 main HEAD 기준으로 삽입 위치 확인 필수" 를 NOTE 로 추가. 실제 §1.1 텍스트 충돌은 아니고 순서 의존성이므로 CRITICAL 은 아님.

---

### [WARNING] `execution-park-resume.e2e-spec.ts` 와 `use-widget-eager-start.test.ts` 를 active worktree 2개와 동시 편집 중
- target 위치:
  - `codebase/backend/test/execution-park-resume.e2e-spec.ts` (fix-carousel 에서 formatter 정리 diff)
  - `codebase/channel-web-chat/src/widget/use-widget-eager-start.test.ts` (fix-carousel 에서 flaky race fix diff)
- 관련 plan:
  - `plan/in-progress/exec-park-durable-resume.md` — worktree `exec-park-b2b-04a2f8` (branch `claude/exec-park-b2b-04a2f8`) 가 `execution-park-resume.e2e-spec.ts` + `use-widget-eager-start.test.ts` 양쪽을 모두 수정 중
  - `plan/in-progress/exec-park-durable-resume.md` — worktree `exec-park-durable-resume` (branch `claude/exec-park-pr-b2`) 가 `use-widget-eager-start.test.ts` 를 수정 중
- 상세:
  - `exec-park-b2b-04a2f8` 는 PR 미생성(no PR)이고 4커밋을 가진 active worktree. `execution-park-resume.e2e-spec.ts` 와 `use-widget-eager-start.test.ts` 를 같이 편집한다. fix-carousel 도 두 파일 모두 수정한다. fix-carousel 의 변경 내용은 포맷 정리(e2e) + flaky race 수정(eager-start test)으로 내용 충돌은 낮지만, **리베이스 순서**에 따라 머지 충돌 발생 가능.
  - `exec-park-pr-b2` 는 `use-widget-eager-start.test.ts` 에 변경이 있다.
  - 두 worktree 모두 active(PR 없거나 OPEN). stale 판정 cascade 에서 제외되지 않음.
- 제안: fix-carousel PR 이 먼저 머지되면 exec-park-b2b/exec-park-pr-b2 가 rebase 시 두 파일의 충돌 해결 필요. fix-carousel 의 해당 변경이 포맷·flaky-fix 에 국한돼 있어 의미 충돌 위험은 낮지만, exec-park-b2b 착수자가 fix-carousel 머지 후 rebase 를 의식해야 한다.

---

### [INFO] stale 으로 skip 한 worktree
worktree 충돌 후보 전수 점검 결과:

- `harden-review-hooks-cb1c84` (branch `claude/harden-review-hooks-cb1c84`) — Step 2 PR #493 MERGED. Step 1 ancestor ACTIVE(squash-merge). → stale(squash-merge skip). 대상 파일(`.claude/hooks/**`) 은 fix-carousel 과 겹치지 않음.
- `plan-complete-p6-043804` (branch `claude/plan-complete-p6-043804`) — Step 2 PR #495 MERGED. Step 1 ancestor ACTIVE(squash-merge). → stale(squash-merge skip). `plan/` 파일만 건드려 fix-carousel 과 겹치지 않음.
- `rag-dynamic-cut-12fac1` (branch `claude/rag-dynamic-cut-12fac1`) — Step 1 ancestor STALE. PR 없음. → stale(ancestor). fix-carousel 과 겹치지 않음.

해당 worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target(`fix-carousel-waiting-status-4d4ed3`)의 핵심 구현(backend `executions.service.ts` intra-row 정규화 + frontend `apply-execution-snapshot.ts` defense-in-depth)은 `exec-park-durable-resume` plan 에서 미해결로 남긴 항목을 일방적으로 결정하지 않는다 — 양측의 수정 영역(execution-engine.service vs executions.service)이 명확히 분리되어 있고, 새로 도입한 `reconcilePreParkWaitingStatus` / `isNodeWaitingForInput` 함수는 park 아키텍처의 원자성(D1~D6 결정)과 독립적인 read-side 정규화다. 다만 (1) spec 갱신이 draft plan 단계에 머물러 `--impl-done` 체크가 미완료이고, (2) 두 active worktree(`exec-park-b2b-04a2f8`, `exec-park-pr-b2`)가 공유 테스트 파일 2건을 동시에 건드려 rebase 시 minor 충돌 가능성이 있으며, (3) spec-update draft plan 의 §1.1 삽입 위치가 `exec-park` 기존 편집 결과에 순서 의존한다. worktree 충돌 후보 7건 중 stale 3건 skip(harden-review-hooks MERGED, plan-complete-p6 MERGED, rag-dynamic-cut ancestor), active 4건 분석; 그 중 exec-park-b2b·exec-park-pr-b2 2건이 상기 WARNING 관련, impl-exec-concurrency-cap 1건은 동일 테스트 파일 겹침(INFO 수준), fix-carousel 자신 제외.

---

## 위험도

LOW
