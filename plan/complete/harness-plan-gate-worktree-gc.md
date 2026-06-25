---
spec_impact: none
worktree: harness-plan-gate-worktree-gc-5d18bc
started: 2026-06-24
owner: developer
status: complete
title: 하네스 개선 — PR 전 plan 강제 + PR 후 worktree/branch 자동 정리
---

# 하네스 개선: plan push-gate + merged-worktree GC

## 배경

사용자 요청 두 가지:
1. **PR 전**: 처리하던 plan 을 갱신하거나 complete 로 이동하는 과정을 강제.
2. **PR 후**: PR 과 관련된 branch·worktree 를 정리(제거).

조사 결과 — push gate(`guard_review_before_push.py`→`review_guard.py`)는 *리뷰*만 검사하고 plan 은 안 봄. worktree 정리는 `cleanup-worktree.sh` 수동 호출만 있고 자동 트리거 0건. 머지된 worktree 가 누적 중이었음(조사 시점 worktree 4 + dangling branch 5).

## 개선 A — PR 전 plan 갱신/이동 강제

- [x] `_lib/plan_guard.py` 작성 — `evaluate_plan()`: codebase 변경 + 연결된 in-progress plan 미터치 → `untouched`(hard), 완료인데 in-progress → `complete_but_in_progress`(soft). 연결 판정은 frontmatter `worktree:` 정규화 ↔ 현재 worktree basename / `claude/` 뗀 branch.
- [x] `guard_review_before_push.py` 에 plan gate 추가 — review/plan 게이트가 각자 `BYPASS_REVIEW_GUARD` / `BYPASS_PLAN_GUARD` 독립 존중.
- [x] `guard_review_before_stop.py` 에 "완료 plan 이동" soft nudge 추가 — review nudge 와 별도 marker(kind)로 throttle.
- [x] `test_plan_guard.py` (20 cases) — 결정 테이블 + 정규화/frontmatter/checkbox/linked-plan.

## 개선 B — PR 후 worktree/branch 자동 정리 (SessionStart GC)

- [x] `.claude/tools/reap-merged-worktrees.sh` 작성 — gh MERGED worktree → `cleanup-worktree.sh --force`; dangling `claude/*` → `-d`(조상) / `-D`(gh MERGED). LOCAL-ONLY, 현재세션·dirty 제외, fail-safe(gh 없으면 skip), throttle(기본 6h), `--dry-run`/`REAP_GH_BIN` seam.
- [x] `bootstrap-session.sh` (SessionStart) 에 reaper 연결 (always exit 0).
- [x] `test_reap_merged_worktrees.py` (8 cases) — 임시 git repo + gh stub 통합 테스트.
- [x] 실제 레포 `--dry-run` 스모크 검증 (worktree 4 + branch 5 정확 식별, 현재/dirty skip).

## 공통

- [x] `harness-checks.yml` 트리거에 `.claude/tools/**` 추가.
- [x] 문서: `worktree-policy.md` §3·§7(GC reaper), `plan-lifecycle.md` §3(push gate + Stop nudge).
- [x] 전체 harness 스위트 통과 (`unittest discover` — 기존 134 → 신규 포함 162).

## 남은 작업

- [x] lint/build/test 게이트 재확인 후 `/ai-review` 수행 + Critical/Warning fix.
- [x] PR 생성.
- [x] 모든 항목 완료 시 이 plan 을 `plan/complete/` 로 이동 (같은 PR 안, `chore(plan): mark ... complete`).

## 결정 메모

- **GC 시점 = merge 시점 아닌 SessionStart**: merge 는 대부분 GitHub 웹에서 일어나 로컬이 관측 못 함 → 멱등 GC 로 수렴. ([[reference_ensure_worktree_stale_base]] 의 stale-base 위험도 함께 줄임.)
- **머지 탐지 = `gh pr view`**: `git branch --merged` 는 squash merge 를 못 잡음(이 레포는 squash). `gh pr view <branch>` 는 `gh pr list --head` 보다 robust(머지 후 remote 브랜치 삭제·브랜치명 drift 케이스도 잡음).
- **plan↔branch 연결**: `worktree:` 필드가 free-form(`(unstarted)`, 경로+주석 등)이라 정규화 후 worktree basename 매칭. 연결 plan 없으면 미차단(ad-hoc escape).
