# Plan 정합성 검토 결과

대상: `plan/in-progress/spec-update-deadcode-cleanup.md`
검토 모드: `--spec` (spec draft 검토)

---

## 발견사항

충돌·중복·미해소 선행 조건은 발견되지 않았다.

아래 항목들을 검토했으나 모두 무해하거나 이미 완료된 것으로 판정한다.

### [INFO] exec-intake-queue-impl.md — `spec/5-system/16-system-status-api.md` 동시 참조

- target 위치: `spec_impact: spec/5-system/16-system-status-api.md`
- 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` (worktree `impl-exec-concurrency-cap`, PR #469 MERGED → stale, Step 2 판정)
- 상세: exec-intake plan 은 `16-system-status-api.md §1`(execution-run 큐 등재)을 다루며 이미 완료("PR2a 반영 완료"). target plan 은 `§3`(threshold 상수명 → getter 표현)을 다룬다. 두 변경은 서로 다른 섹션으로 실질 충돌 없음. exec-intake worktree 는 PR #469 MERGED 로 stale.
- 제안: 추가 조치 불요.

### [INFO] background-context-key-followups.md — `spec/conventions/execution-context.md` 병행 참조

- target 위치: `spec_impact: spec/conventions/execution-context.md §1`
- 관련 plan: `plan/in-progress/background-context-key-followups.md` (worktree `fix-bg-context-followups`, PR #451 MERGED → stale)
- 상세: background-context plan 은 `execution-context.md §Rationale`(기각 범위 한정 주석, commit 139b8411 반영 완료)을 수정했다. 미해소 INFO#1은 "§원칙 4 선례 목록에 `engineResolvedConfigCache` 추가 or §1 각주 SoT 위임"으로 §원칙 4에 관한 것이다. target plan 은 §원칙 1 선례 목록에 `structuredOutputCache` 필드를 추가한다. 섹션·목적이 다르며 worktree 는 PR #451 MERGED 로 stale.
- 제안: 추가 조치 불요. 단, project-planner 가 `execution-context.md §1` 을 편집할 때 background plan 의 INFO#1 잔여("§원칙 4 선례 목록 `engineResolvedConfigCache`")도 동시에 반영하면 편집 왕복을 줄일 수 있다 — 강제 사항 아님.

### [INFO] parallel-p2-followups.md — `spec/4-nodes/1-logic/10-parallel.md` 참조

- target 위치: `spec_impact: spec/4-nodes/1-logic/10-parallel.md §Rationale`
- 관련 plan: `plan/in-progress/parallel-p2-followups.md` (worktree `(unstarted)`)
- 상세: parallel-p2-followups 는 `10-parallel.md §Rationale 결정 G`·`execution-context.md`를 구현 책임 plan 으로 참조한다고 명시하나, 아직 착수 전(unstarted). target plan 이 §Rationale에 M-5 freeze invariant 1줄을 추가하는 것은 결정 G(ParallelBranchContext 분리)와 무관한 독립 내용이다. 충돌 없음.
- 제안: 추가 조치 불요.

### [INFO] 목표 worktree `plan-complete-turn-timing-aa533b` PR 이미 머지

- target 위치: frontmatter `worktree: plan-complete-turn-timing-aa533b`
- 상세: `claude/plan-complete-turn-timing-aa533b` 브랜치의 PR #509가 MERGED 상태다. target plan 은 developer 가 동일 worktree에서 작성한 spec 갱신 초안이며, 이 draft 자체는 project-planner 가 별도 편집으로 적용한다. worktree가 이미 머지됐다는 사실이 draft 유효성을 훼손하지 않는다 (draft 콘텐츠는 worktree 내 commit이 아니라 plan 파일 자체).
- 제안: project-planner 가 적용 시 새 worktree 또는 직접 main 갱신으로 진행하면 된다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검토 중 stale 판정으로 제외한 항목:

- `fix-bg-context-followups` (branch `claude/fix-bg-context-followups`) — Step 1 non-ancestor(squash merge), Step 2 PR #451 MERGED
- `exec-park-durable-resume` (branch `claude/exec-park-durable-resume`) — Step 1 non-ancestor, Step 2 PR #470 MERGED
- `impl-exec-concurrency-cap` (branch `impl-exec-concurrency-cap`) — Step 1 non-ancestor, Step 2 PR #469 MERGED
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1 non-ancestor, Step 2 PR #443 MERGED
- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1 non-ancestor, Step 2 PR #516 MERGED
- `plan-complete-turn-timing-aa533b` (branch `claude/plan-complete-turn-timing-aa533b`) — Step 1 non-ancestor, Step 2 PR #509 MERGED

위 6개 worktree 는 머지된 브랜치의 정리되지 않은 잔재다. 필요 시 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec-update-deadcode-cleanup.md` 가 touch 하는 세 spec 파일(`spec/5-system/16-system-status-api.md §3`, `spec/4-nodes/1-logic/10-parallel.md §Rationale`, `spec/conventions/execution-context.md §1`)에 대해 현재 OPEN 상태의 PR 또는 활성 worktree 와의 충돌은 없다. exec-intake-queue(§1)·background-context-key(§Rationale)·parallel-p2-followups(결정 G)가 같은 파일을 참조하나, 변경 섹션이 상이하거나 해당 worktree 가 이미 머지됐다. 미해결 결정과의 충돌·선행 plan 미해소·후속 항목 무효화도 없다. worktree 충돌 후보 6건 전부 stale 판정으로 skip, active 0건 분석.

---

## 위험도

NONE
