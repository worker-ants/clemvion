# Plan 정합성 검토 — spec/5-system/4-execution-engine.md (--impl-prep)

검토 모드: 구현 착수 전 검토 (--impl-prep)
Target: `spec/5-system/4-execution-engine.md`
Target worktree: `exec-park-polish-080a4d` (branch `claude/exec-park-polish-080a4d`)
검토일: 2026-06-06

---

## 발견사항

### [INFO] target 파일 실제 미수정 — impl-prep scope 와 plan 실작업 범위 불일치
- target 위치: `spec/5-system/4-execution-engine.md` (파일 전체)
- 관련 plan: `plan/in-progress/exec-park-polish.md` §A2 (frontmatter `code:` glob 추가 — 미착수)
- 상세: `claude/exec-park-polish-080a4d` 브랜치가 main 대비 수정한 spec 파일은 `spec/5-system/14-external-interaction-api.md`, `spec/5-system/7-llm-client.md`, `spec/data-flow/3-execution.md` 뿐이다. `spec/5-system/4-execution-engine.md` 은 현재 이 worktree 에서 수정된 바 없다(git diff 0줄). `--impl-prep` scope 가 이 파일로 설정된 것은 향후 plan A2(frontmatter `code:` glob 추가)·A3(`1-ai-agent.md` 표현 정정) 작업을 선행 점검하는 목적으로 보인다.
- 제안: 현재 착수 전 점검이므로 문제없음. A2 작업(frontmatter `code:` 갱신) 착수 시 `--impl-prep` 재실행 불요(frontmatter 변경은 경미). 실제 spec 본문 수정이 수반되는 A3(`1-ai-agent.md`)은 그 파일을 scope 로 `--impl-prep` 실행 권장.

---

### [INFO] spec-draft-exec-park-b2-durable.md — worktree `exec-park-durable-resume` stale skip
- target 위치: `plan/in-progress/spec-draft-exec-park-b2-durable.md` frontmatter `worktree: exec-park-durable-resume`
- 관련 plan: `plan/in-progress/spec-draft-exec-park-b2-durable.md` (대상 spec 동일: `4-execution-engine.md`)
- 상세: 이 plan 의 worktree `exec-park-durable-resume` 브랜치를 §worktree stale 판정 cascade 로 검사. Step 1(`merge-base --is-ancestor`) → ACTIVE(exit 1). Step 2(PR state) → `gh pr list --state all --head claude/exec-park-durable-resume` = **MERGED**. 따라서 **stale** 판정 — `4-execution-engine.md` 동시 수정 경합 후보에서 제외. 해당 plan 의 `4-execution-engine.md` 변경(C5 spec 재전환)은 이미 main 에 반영된 것으로 확인됨(현 spec 본문이 "PR-B2b 완료형"으로 기술된 것이 증거).
- 제안: stale worktree 정리 대상. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

### [INFO] impl-concurrency-cap-pr2b worktree — 4-execution-engine.md 미접촉, 경합 없음
- target 위치: `spec/5-system/4-execution-engine.md`
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (worktree: `impl-exec-concurrency-cap`, branch `claude/impl-concurrency-cap-pr2b` — ACTIVE)
- 상세: 이 worktree 는 현재 ACTIVE(Step 1 미조상, Step 2 PR 없음)이며 같은 리포지토리에 체크아웃된 실제 활성 worktree다. 그러나 `claude/impl-concurrency-cap-pr2b` 브랜치가 main 대비 수정하는 파일은 `plan/in-progress/exec-intake-queue-impl.md` 뿐이며 `spec/5-system/4-execution-engine.md` 은 수정하지 않는다. exec-intake-queue-impl.md §PR2b 착수 조건에 "PR-B2 머지 후 rebase 선행" 이 명시돼 있어 spec 충돌 위험도 자기통제됨. → worktree 충돌 해당 없음.
- 제안: 추적 메모 수준. PR2b 착수 시 해당 plan 에 명시된 rebase 의무 준수.

---

### [INFO] exec-park-polish plan A2 — 4-execution-engine.md frontmatter 변경 예정, 미해결 결정 없음
- target 위치: `spec/5-system/4-execution-engine.md` frontmatter `code:` glob
- 관련 plan: `plan/in-progress/exec-park-polish.md` §A2
- 상세: 폴리시 plan 은 `4-execution-engine.md` frontmatter 의 `code:` glob 에 `codebase/backend/src/shared/execution-resume/**` 을 추가할 예정이다. 이는 spec 본문 변경이 아닌 frontmatter 메타 보강으로, 어떤 미해결 결정과도 충돌하지 않는다. 현 spec frontmatter 의 `pending_plans:` 에 `exec-park-durable-resume.md` 가 등재돼 있으나 해당 plan 의 실제 작업은 완료(MERGED)된 상태이므로 frontmatter 갱신(pending_plans 제거) 도 후속 정리 항목으로 남아있다.
- 제안: A2 완료 시 `pending_plans:` 에서 `exec-park-durable-resume.md` 제거 여부도 함께 검토. plan-lifecycle 에 따라 완료된 plan 은 pending_plans 에서 삭제해야 SoT 정합 유지.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정으로 skip 된 항목:

- `exec-park-durable-resume` (branch `claude/exec-park-durable-resume`) — Step 1 non-ancestor (ACTIVE), Step 2 PR MERGED → **stale**

해당 worktree 가 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/4-execution-engine.md` 를 대상으로 한 Plan 정합성 검토에서 CRITICAL 또는 WARNING 수준의 충돌은 발견되지 않았다. Target worktree(`exec-park-polish-080a4d`)는 현재 이 파일을 수정하지 않았으며, 향후 예정된 frontmatter 보강(A2)은 미해결 결정과 무관하고 타 active worktree 와 경합하지 않는다. 동일 spec 을 과거에 작업했던 `exec-park-durable-resume` 브랜치는 PR MERGED 확인으로 stale 판정돼 경합 대상에서 제외됐다. 유일한 실제 active 병렬 worktree(`impl-concurrency-cap-pr2b`)는 이 spec 파일을 건드리지 않는다. 후속 정리 항목으로 stale worktree cleanup 및 spec frontmatter `pending_plans:` 정합화가 권장된다. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

---

## 위험도

NONE
