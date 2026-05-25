# Consistency Check 통합 보고서 (post-rebase, impl-prep spec/5-system/)

**BLOCK: NO** — Critical 없음. 본 PR 영역의 spec 변경(BullMQ 전환·§7.5.1·동반 갱신) 은 모두 일관 적용 확인. WARNING 6건 중 본 PR 영역 직접 관련은 W5/W6 둘 — 즉시 처리 가능.

## 전체 위험도
**MEDIUM** — 본 PR 영역만 LOW, base branch pre-existing spec drift 4건이 spec/5-system/ 전체로는 MEDIUM 위험도 유지.

## Critical
없음.

## WARNING (본 PR 영역 직접 관련)

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| W5 | plan_coherence | `plan/in-progress/workflow-resumable-execution.md` frontmatter `worktree:` 가 옛 `phase2-a6b133` 그대로 — 현재 active worktree `phase2-cont-64f537` 미반영 | 즉시 fix |
| W6 | plan_coherence | `plan/in-progress/retry-handler-followup.md` 에 `execution:continuation` BullMQ 전환 기준 한 줄 추가 (이미 `workflow-resumable-execution.md §"다음 단계" 3번` 에 위임 기록되어 있으나 retry-handler-followup 본문에 미적용) | 즉시 fix |

## WARNING (base branch pre-existing — 본 PR 무관)

| # | Checker | 발견 | 처리 |
|---|---------|------|------|
| W1 | convention_compliance | `1-auth.md` `status: spec-only` + 본문 구현 인용 — TTL 90일 가드 위험 | 별 spec PR |
| W2 | convention_compliance | `1-auth.md §1.5.4` 에러 코드 UPPER/lower 혼용 | 별 spec PR |
| W3 | convention_compliance | `11-mcp-client.md` `status: spec-only` + Cafe24 Internal Bridge 구현 인용 | 별 spec PR |
| W4 | convention_compliance | `10-graph-rag.md` 이중 Overview 구조 | 별 spec PR |

## INFO (14건)

대부분 base branch 또는 별 spec 영역 follow-up. 본 PR 처리 대상 없음.

## Checker 별 위험도

| Checker | 위험도 |
|---------|--------|
| cross_spec | LOW |
| rationale_continuity | NONE |
| convention_compliance | MEDIUM (pre-existing) |
| plan_coherence | LOW |
| naming_collision | LOW |

## 본 PR 영역 결론

Phase 2 cont rebase 후에도 본 PR 의 spec/code/plan 변경이 모두 일관. W5/W6 만 본 PR 안에서 처리 후 push 가능.

**BLOCK: NO**.
