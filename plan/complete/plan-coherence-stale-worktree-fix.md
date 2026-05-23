---
worktree: plan-coherence-stale-worktree-fix-0e2222
started: 2026-05-23
completed: 2026-05-23
owner: developer
---

# Plan-coherence-checker stale worktree false-positive 차단

## 배경

PR #287 (harness — spec-impl coverage standing audit) 의 consistency-check 2 라운드 (16_48_26 → 17_01_07) 에서 **plan-coherence-checker 가 CRITICAL 4건 BLOCK 발생**. 그러나 4건 모두 false-positive:

| 지목 worktree | 실제 PR 상태 |
|---|---|
| `ai-agent-turn-fail-finalize-a22724` | PR #209 MERGED (2026-05-19) |
| `agent-model-override-18a044` | PR #286 MERGED (2026-05-23) |
| `redis-bullmq-env-hardening-7a47dc` | PR #211 MERGED (2026-05-19) |

원인: `.claude/agents/plan-coherence-checker.md §검토 관점 5번` 이 **worktree 의 디렉토리 존재만으로 동시 수정 충돌 판단**. 머지된 PR 의 stale worktree 가 정리되지 않은 상태에서 검사하면 항상 false-positive.

영향: BLOCK 결정 신뢰도 직결. PR #287 케이스에서는 main Claude 가 수동으로 PR 상태 확인 후 false-positive 라고 판단해 진행했지만, 매번 그래야 하면 가드의 가치 손상.

## 결정

`spec-harness-impl-coverage` (PR #287) 의 결정 ④ 후속. 사용자 결정: 옵션 A — 별 plan / 별 PR 로 fix.

## 변경안

### 1. `.claude/agents/plan-coherence-checker.md` 강화

- **§검토 관점 5번** — "worktree 충돌" 강화: stale worktree skip 명시
- **§stale worktree 판정 (신설 절)** — 3단계 cascade 알고리즘 명시:
  1. `git merge-base --is-ancestor <branch> origin/main` — branch HEAD 가 main 의 조상이면 stale (non-squash merge)
  2. `gh pr list --state all --head <branch> --json state` — PR state ∈ {MERGED, CLOSED} 면 stale (squash/rebase merge)
  3. 둘 다 fail 시 active 로 간주 (보수적 — false-positive 보다 false-negative 가 작업 차단 사고 큼)
- **§출력 형식** — "stale 으로 skip 한 worktree 목록" 도 INFO 로 같이 보고 (false-positive 디버깅 + 정리 권고)

### 2. plan 1 (`developer-partial-impl-discipline.md`) complete 이동

PR #287 안에서 이미 SKILL.md + PROJECT.md 변경 반영됨. 본 plan 의 체크리스트는 사실상 PR #287 머지로 완료. 별 PR 분리 금지 (`plan-lifecycle.md §3`) 라서 본 PR (결정 ④ 후속) 안에 chore commit 곁들임.

`plan/in-progress/0-unimplemented-overview.md §하네스·프로세스 개선` 표에도 plan 1 완료 반영.

## 체크리스트

- [x] worktree 생성 (`plan-coherence-stale-worktree-fix-0e2222`) — 완료
- [x] 본 plan 작성 — 완료
- [x] `.claude/agents/plan-coherence-checker.md` §검토 관점 5번 강화
- [x] `.claude/agents/plan-coherence-checker.md` §stale worktree 판정 신설
- [x] `.claude/agents/plan-coherence-checker.md` §출력 형식 갱신
- [x] plan 1 (`developer-partial-impl-discipline.md`) → `plan/complete/` 이동
- [x] `0-unimplemented-overview.md` 갱신 (plan 1 완료 + 본 plan 추가)
- [x] commit + PR push
- [x] plan `complete/` 이동

## 검증 명령

본 plan 은 `.claude/agents/**` + `plan/**` 변경만 — e2e 면제 (`PROJECT.md §e2e 면제 화이트리스트` 부분집합).

다음 consistency-check 호출 시 본 fix 가 의도대로 동작하는지 (stale worktree 가 INFO 로 분리되고 CRITICAL 에서 빠지는지) 자연스럽게 검증됨.

## Rationale

### R-1. 3단계 cascade 채택 (단일 알고리즘 미채택)

git merge-base 단독은 squash/rebase merge 케이스 (commit hash 가 바뀌어 ancestor 관계 깨짐) 를 놓침. PR API 단독은 force-push / rewrite 케이스 (PR 머지 후 branch 가 새로 push 된 경우) 를 놓침. 둘 다 통과시 active 로 두는 보수적 fallback 으로 false-negative 위험 최소화.

### R-2. "stale 으로 skip 한 worktree" INFO 보고

본 fix 가 도입돼도 stale worktree 자체가 환경에 남으면 매 검사마다 skip 비용 발생. INFO 로 보고해 사용자가 정기적으로 `cleanup-worktree-all.sh` 실행할 trigger 제공.

### R-3. plan 1 동반 처리

`plan-lifecycle.md §3` 의 "plan 이동만 담은 별 PR 분리 금지" 규칙 준수. 본 PR (결정 ④ 의 다른 작업) 에 chore commit 곁들임.
