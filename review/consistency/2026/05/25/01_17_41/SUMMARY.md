# Consistency Check 통합 보고서 (Phase 2 impl-prep)

**대상**: Phase 2 구현 착수 직전 (`spec/5-system/` scope)
**검토 모드**: `--impl-prep`
**검토 일자**: 2026-05-25
**세션**: `review/consistency/2026/05/25/01_17_41`

---

**BLOCK: NO (pre-existing CRITICAL 2건은 본 Phase 2 작업 무관)**

> Convention Compliance 가 보고한 CRITICAL 2건은 모두 **pre-existing 무관 이슈**:
> 1. `spec/5-system/1-auth.md §1.5.4` invitation 에러 코드 lower_snake_case — Phase 2 와 무관 (auth 영역)
> 2. `spec/5-system/1-auth.md` frontmatter `status: spec-only` vs 본문 구현 완료 — pre-existing tech debt
>
> 둘 다 본 Phase 2 (BullMQ continuation-queue 구현) 와 직접 충돌 없음. 별도 후속 PR (project-planner) 로 분리 권고.

## 본 Phase 2 작업과 관련된 발견사항

| # | Checker | 항목 | 처리 방안 |
|---|---|---|---|
| W-1 | cross_spec | `INVALID_EXECUTION_STATE` 에러 코드 spec 미등재 | Phase 2.4 구현 시 spec §7.5 또는 §6-ws-protocol §4.2 에 등재 (이미 등재된 다른 RESUME_* 패턴 따름) |
| W-2 | cross_spec | `queued: boolean` 필드 계약은 Phase 2 완료 후 유효 — 현재 frontend 가 false 전제로 동작 | Phase 2 완료가 곧 계약 활성 시점이므로 본 PR 안에서 자연 해소 |
| W-3 | plan_coherence | Phase 1.3 미결정 — plan 에 skip 결정 기록 필요 | plan 에서 [x] 처리하고 "(skip - Phase 2 적용으로 자연 해소)" 노트 |
| W-4 | plan_coherence | plan frontmatter `worktree` 가 Phase 1 worktree 가리킴 | Phase 2 worktree slug 으로 갱신 또는 Phase 별 plan 분리 |
| W-5 | plan_coherence | `task-queue` 큐 이름 확인이 Phase 2 작업 목록에 없음 | Phase 2.x 에 sub-task 로 추가하거나 README/spec 정합화 후속 PR 분리 |
| W-6 | plan_coherence | `retry-handler-followup.md` WARNING #1/#3/#4/#5 spec 미해소 — 본 작업과 spec 영역 중첩 | retry-handler-followup 은 별도 worktree 미시작. Phase 2 가 spec §7.4/§7.5 본문 구현이며, retry-handler-followup 은 동일 spec 의 다른 sub-section (_retryState) 이므로 직접 충돌 없음. 본 PR 머지 후 retry-handler-followup 작성자가 충돌 해소 |

## Checker별 위험도

| Checker | 결과 | 위험도 | 본 작업 관련성 |
|---|---|---|---|
| cross_spec | 5 INFO + WARNING | LOW | INVALID_EXECUTION_STATE 등재 + queued 활성화 |
| rationale_continuity | 4 INFO | LOW | 무관 |
| convention_compliance | **2 CRITICAL (pre-existing 무관)** + WARNING | HIGH (보고) → LOW (Phase 2 영향) | 모두 auth/graph-rag (무관) |
| plan_coherence | 4 WARNING | MEDIUM | 4건 모두 plan 위생 — 구현 진행에는 무영향 |
| naming_collision | 3 INFO | LOW | 무관 |

## 권장 조치

1. **Phase 2 구현 착수 진행** — pre-existing CRITICAL 은 분리.
2. **Plan 위생 정리** (구현 commit 전에):
   - `plan/in-progress/workflow-resumable-execution.md` frontmatter `worktree` 를 phase2 slug 으로 갱신
   - Phase 1.3 체크박스 `[x]` + "skip - Phase 2 자연 해소" 노트
   - Phase 2 작업 목록에 "task-queue 이름 확인 + spec §9.2/§4.2 정합화" sub-task 추가
3. **구현 시 spec 동반 갱신**:
   - `INVALID_EXECUTION_STATE` 에러 코드 spec §7.5 또는 §6-ws-protocol §4.2 에 등재
   - `queued: boolean` 필드가 Phase 2 활성화 시점부터 의미를 가짐을 §4.2 에 명시 (옛 무의미 → 의미 있음 전이)
