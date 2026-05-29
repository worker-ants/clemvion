# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done)
Target: `spec/5-system/4-execution-engine.md` diff vs `origin/main`
Worktree: `workflow-resumable-phase3-a4ea4a`
검토 일시: 2026-05-29

---

## 발견사항

### [INFO] 두 plan 파일이 아직 `plan/in-progress/` 에 잔류 — `plan/complete/` 이동 권장

- **target 위치**: `plan/in-progress/workflow-resumable-execution.md` 및 `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` (모두 이번 diff 에 포함)
- **관련 plan**:
  - `plan/in-progress/workflow-resumable-execution.md` — Phase 3 (3.1, 3.2) 및 변경 2.3 모두 `[x]` 완료 표시. "다음 단계" 섹션은 Phase 1 착수 전 안내로 이제 전부 이행됨.
  - `plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md` — "본 plan 의 spec 작업 + 변경 2.3 모두 완료 — `git mv` 로 `plan/complete/` 이동 가능"이라고 명시.
- **상세**: 두 plan 파일 모두 자체적으로 "이동 가능"이라 선언했으나 이번 worktree diff 에 `git mv` 가 포함되지 않았다. 현재 상태는 완료 항목이 `in-progress/` 에 잔류하는 것으로, plan-lifecycle 규약 불이행.
- **제안**: PR merge 전 또는 별 commit 으로 `git mv plan/in-progress/workflow-resumable-execution.md plan/complete/` 및 `git mv plan/in-progress/spec-update-workflow-resumable-execution-phase2-followup.md plan/complete/` 실행.

---

### [INFO] `plan/in-progress/0-unimplemented-overview.md` Phase 3 상태가 "대기"로 outdated

- **target 위치**: `plan/in-progress/workflow-resumable-execution.md` §Phase 3 섹션
- **관련 plan**: `plan/in-progress/0-unimplemented-overview.md` line 81 — `"Phase 3 (DLQ 모니터링 + mermaid 재작성) 대기"`
- **상세**: 이번 worktree 에서 Phase 3.1 (DLQ 모니터링) 과 3.2 (mermaid 재작성 — stale 확인으로 추가 변경 불필요) 가 모두 완료됐다. `0-unimplemented-overview.md` 는 갱신 없이 "대기" 표기가 잔류한다.
- **제안**: `plan/in-progress/0-unimplemented-overview.md` line 81 의 Phase 3 상태를 "완료 (2026-05-29)" 로 갱신. 이 파일은 다른 작업자들이 우선순위 결정에 참조하므로 stale 표기가 혼란 유발 가능.

---

### [INFO] `retry-handler-followup.md` WARNING #2 BullMQ 기준 한 줄 추가 — 본 PR 에 미포함

- **target 위치**: `plan/in-progress/workflow-resumable-execution.md` §"다음 단계" 3번 — "`plan/in-progress/retry-handler-followup.md` 에 WARNING #2 BullMQ 기준 명시 한 줄 추가는 본 plan 과 독립 — 별도 commit 으로 처리"
- **관련 plan**: `plan/in-progress/retry-handler-followup.md` WARNING #2 — Continuation Bus BullMQ 기준 작성 명시
- **상세**: `workflow-resumable-execution.md §"다음 단계"` 가 이 추가를 "별도 commit" 으로 명시했으나, `retry-handler-followup.md` 에 해당 한 줄이 아직 없다. `retry-handler-followup.md` 는 `worktree: multiturn-error-preserve` 를 frontmatter 에 선언하지만, 그 branch 에 대한 PR 이 존재하지 않는다 (gh pr list 결과 `[]`). 따라서 누락이 방치될 가능성이 있다.
- **제안**: `retry-handler-followup.md` WARNING #2 항목 아래에 "(2026-05-25 갱신)" 노트를 추가하거나, 본 PR 에 동반 commit 으로 포함하는 것을 권고.

---

### [INFO] `fix-mail-send-status-59d3b3` worktree 가 `execution-engine.service.ts` 를 동시 편집 — merge 시 수동 확인 필요 가능성

- **target 위치**: `codebase/backend/src/modules/execution-engine/execution-engine.service.ts` (Phase3 diff: lines ~264, ~2938–2993 범위)
- **관련 plan**: plan 파일 없음. worktree `fix-mail-send-status-59d3b3` (branch `claude/fix-mail-send-status-59d3b3`, PR #350 OPEN) 이 동일 파일의 lines ~222, ~1185, ~1357, ~4335–4680 범위를 편집 중.
- **상세**: 두 브랜치 모두 `execution-engine.service.ts` 를 건드리지만 수정 위치가 다르다. Phase3 는 `InvalidExecutionStateError` 신설 (~264) 과 `resolveWaitingNodeExecutionId` throw 전환 (~2938) 이고, fix-mail-send-status 는 `ErrorPortFallbackError` 신설과 오류 포트 라우팅 관련 부분이다. 직접적인 hunk 충돌 가능성은 낮으나, 두 PR 이 연달아 main 에 들어갈 때 git 이 자동 merge 에 실패할 수 있다.
- **제안**: Phase3 PR 과 PR #350 의 순서를 조율하거나, 나중에 merge 되는 쪽에서 rebase 를 수행해 충돌 여부를 확인. spec 파일 충돌은 없으므로 코드 레벨 충돌만 점검하면 된다.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `workflow-resumable-execution-phase2-cont-64f537` (branch `claude/workflow-resumable-execution-phase2-cont-64f537`) — Step 1: ACTIVE (squash merge 로 ancestor 불일치). Step 2: PR #321 MERGED → **stale**. spec/5-system/4-execution-engine.md 편집 여부 경합 후보였으나 stale 판정으로 skip.

이 worktree 는 더 이상 활성으로 사용되지 않는다. `./cleanup-worktree-all.sh --yes --force` 실행을 권장한다.

추가 이력 branch 확인:

- `claude/workflow-resumable-execution-6b105e` — Step 1: ACTIVE. Step 2: PR 없음 (`[]`). Step 3: active 로 처리. 그러나 `workflow-resumable-execution.md` 에 "merged base 로 잔류" 라고 명시됨. 물리 worktree 는 `.claude/worktrees/` 에 없으므로 git branch 만 잔류. spec/codebase 파일 경합 없음 — INFO 수준. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.

---

## 요약

이번 diff (`workflow-resumable-phase3-a4ea4a`) 의 spec 변경 (`spec/5-system/4-execution-engine.md`) 은 plan 과의 충돌·미해결 결정 우회·선행 조건 미해소가 없다. Phase3 (3.1 DLQ 모니터링, 3.2 mermaid 재확인) 와 변경 2.3 (`resolveWaitingNodeExecutionId` throw 전환) 은 모두 `workflow-resumable-execution.md` 및 `spec-update-workflow-resumable-execution-phase2-followup.md` 에 명시된 범위 안에서 수행됐고, 두 plan 이 자체적으로 완료 선언한 항목과 spec diff 가 일치한다. 유일한 active worktree 간 코드 경합은 `fix-mail-send-status-59d3b3` (PR #350 OPEN) 가 동일 `execution-engine.service.ts` 를 수정하나, hunk 위치가 달라 직접 충돌 가능성은 낮다. plan 완료 후 `plan/complete/` 이동 미수행, `0-unimplemented-overview.md` Phase 3 상태 stale, `retry-handler-followup.md` 업데이트 누락이 INFO 수준 후속 사항으로 남는다. worktree 충돌 후보 1건 (`workflow-resumable-execution-phase2-cont-64f537`) 이 Step 2 PR #321 MERGED 로 stale 판정돼 skip됐다. active worktree 중 동일 spec 파일을 편집 중인 것은 없다.

---

## 위험도

LOW

STATUS: OK
