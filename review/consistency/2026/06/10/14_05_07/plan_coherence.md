# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 (--impl-prep)
대상 scope: `spec/2-navigation/`
검토 일시: 2026-06-10

---

## 발견사항

### 1. [WARNING] spec-sync-schedule-gaps.md — C-10 구현 완료 항목이 plan에서 여전히 open
- **target 위치**: `spec/2-navigation/3-schedule.md` §4, `spec-sync-schedule-gaps.md` 마지막 항목
- **관련 plan**: `plan/in-progress/spec-sync-schedule-gaps.md` 라인 17
  - `[ ] GET /api/schedules 의 sort/order 쿼리 반영 (§4). DTO 는 받지만 findAll 이 무시하고 created_at DESC 고정 정렬.`
- **상세**: `spec-sync-structural-followups.md §C-10` 은 "✅ FIXED (this PR)" 로 표기하고, 실제 코드(`schedules.service.ts:37-52`)도 `resolveOrderBy` 함수를 통해 `sort`/`order` 를 적용한다. 그러나 `spec-sync-schedule-gaps.md` 의 해당 항목은 `[ ]` 미완료 상태로 남아 있다. 구현 완료됐는데 추적 plan 이 갱신되지 않아 중복 구현 시도 위험이 있다.
- **제안**: `spec-sync-schedule-gaps.md` 의 sort/order 항목을 `[x]` 로 체크하거나 plan 에서 제거. `spec/2-navigation/3-schedule.md` §4 의 "sort/order 반영은 미구현/Planned" 경고 문구도 코드 현실에 맞게 삭제 또는 수정 필요 (구현 완료 상태 반영).

---

### 2. [WARNING] spec-sync-workflow-list-gaps.md — C-1 버그 수정 항목이 plan에서 여전히 open
- **target 위치**: `spec/2-navigation/1-workflow-list.md` §2.3, `spec-sync-workflow-list-gaps.md`
- **관련 plan**: `plan/in-progress/spec-sync-workflow-list-gaps.md` 라인 20
  - `[ ] 상태 필터 파라미터 불일치 (§2.3)...`
- **상세**: `spec-sync-structural-followups.md §C-1` 은 "✅ FIXED (this PR)" 로 표기. 실제 코드(`workflows/page.tsx:112-113`)는 `params.status = "active"` / `params.status = "inactive"` 로 수정 완료돼 있다. 그러나 `spec-sync-workflow-list-gaps.md` 의 해당 "코드 버그" 항목은 `[ ]` 미완료 상태다.
- **제안**: `spec-sync-workflow-list-gaps.md` 의 상태 필터 불일치 항목을 `[x]` 로 체크. `spec/2-navigation/1-workflow-list.md` §2.3 경고 문단의 "클라이언트 수정이 필요하다" 서술도 수정 완료 사실을 반영할 것 (또는 삭제).

---

### 3. [WARNING] spec/2-navigation/5-knowledge-base.md — pending_plans 참조 대상인 kb-unsearchable-warning 이 완료됐으나 spec frontmatter 미갱신 가능성
- **target 위치**: `spec/2-navigation/5-knowledge-base.md` frontmatter
- **관련 plan**: `plan/in-progress/kb-unsearchable-warning.md` (worktree: `kb-unsearchable-warning-b47e20`, PR #511 MERGED)
- **상세**: `kb-unsearchable-warning-b47e20` 의 PR #511 은 MERGED 상태다. 그러나 현재 `main` 의 `spec/2-navigation/5-knowledge-base.md` frontmatter 는 `status: partial` + `pending_plans: [plan/in-progress/kb-unsearchable-warning.md]` 로 남아 있다. 별도 브랜치들(`kb-lifecycle-groom-57cc46`, `plan-complete-ai-review-backlog-85f80a`, `refactor-backlog-options`, `unified-model-mgmt`)이 모두 이를 `status: implemented` + pending_plans 제거로 동일하게 수정하고 있어 **4개 active/stale branch 가 동일 패치를 중복 보유**하고 있다. 이미 `kb-lifecycle-groom` PR #513 도 MERGED 됐으나 `main` 에 반영됐는지 확인 필요.
- **제안**: `spec/2-navigation/5-knowledge-base.md` 의 현재 `main` 상태를 확인. `status: partial` + pending_plans 가 아직 있다면 project-planner 가 `status: implemented` 로 승격하고 pending_plans 제거. 중복 패치를 보유한 branch 들은 이 변경 이후 rebase 또는 revert 필요.

---

### 4. [INFO] spec/2-navigation/2-trigger-list.md — sort/order 미구현 Planned 경고 추가됨, 대응 plan 항목 부재
- **target 위치**: `spec/2-navigation/2-trigger-list.md` §3 GET /api/triggers 행
- **관련 plan**: 해당 없음 (gap 추적 plan 없음)
- **상세**: trigger-schedule-sync 브랜치 변경에서 `GET /api/triggers` 에 sort/order 미구현 경고를 추가했다. 그러나 현재 `plan/in-progress/` 에 이 gap 을 추적하는 plan 파일이 없다. `spec-sync-schedule-gaps.md` 가 schedule 의 같은 gap 을 추적하는 패턴과 일관성이 없다.
- **제안**: `spec/2-navigation/2-trigger-list.md` 의 trigger sort/order 미구현 항목을 추적할 plan 항목을 생성하거나, 기존 `spec-sync-structural-followups.md` 에 항목 추가 고려.

---

### 5. [INFO] spec-sync-audit-998544 worktree — spec/2-navigation/ 파일을 수정하는 stale worktree
- **target 위치**: 전체 `spec/2-navigation/` (2-trigger-list.md, 3-schedule.md 포함)
- **관련 plan**: `plan/in-progress/spec-code-cross-audit-2026-06-10.md` (worktree: `spec-sync-audit-998544`)
- **상세**: `spec-sync-audit-998544` worktree 의 branch `claude/spec-sync-audit-998544` 는 PR #516 (MERGED) 를 통해 이미 squash merge 됐다. Step 1 ancestor 검사는 ACTIVE(exit 1) 이나 Step 2 PR #516 상태는 MERGED — stale worktree 로 판정. 이 worktree 가 `spec/2-navigation/` 의 다수 파일을 수정하고 있으나 이미 origin/main 에 반영됐다.
- **제안**: `spec-sync-audit-998544` worktree 는 stale 이므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

### 6. [INFO] 4개 stale worktree 가 spec/2-navigation/5-knowledge-base.md 동일 패치 보유
- **target 위치**: `spec/2-navigation/5-knowledge-base.md`
- **관련 worktree**: `kb-lifecycle-groom-57cc46` (PR #513 MERGED), `kb-unsearchable-warning-b47e20` (PR #511 MERGED), `plan-complete-ai-review-backlog-85f80a` (PR #510 MERGED), `unified-model-mgmt-5af7ee` (no PR, stale by Step 1)
- **상세**: 4개 모두 `status: partial → implemented` + `pending_plans` 제거라는 동일한 단순 frontmatter 변경을 보유하고 있다. PR #513, #511, #510 이 모두 MERGED 됐으므로 이 worktree 들은 모두 stale 로 판정.
- **제안**: `./cleanup-worktree-all.sh --yes --force` 로 kb-lifecycle-groom-57cc46, kb-unsearchable-warning-b47e20, plan-complete-ai-review-backlog-85f80a, unified-model-mgmt-5af7ee 정리 권장.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

| worktree | branch | 판정 |
|---|---|---|
| `trigger-schedule-sync-f88604` | `claude/trigger-schedule-sync-f88604` | Step 1: branch HEAD = origin/main (mutual ancestor). Step 2: PR 없음, Step 1 STALE 확인으로 판정. 이 worktree 에서 consistency check 가 실행 중임 — 자기 자신이 대상. |
| `spec-sync-audit-998544` | `claude/spec-sync-audit-998544` | Step 1: ACTIVE (squash merge로 commit hash 바뀜). Step 2: PR #516 MERGED → **stale**. |
| `kb-lifecycle-groom-57cc46` | `claude/kb-lifecycle-groom-57cc46` | Step 1: ACTIVE. Step 2: PR #513 MERGED → **stale**. |
| `kb-unsearchable-warning-b47e20` | `claude/kb-unsearchable-warning-b47e20` | Step 1: ACTIVE. Step 2: PR #511 MERGED → **stale**. |
| `plan-complete-ai-review-backlog-85f80a` | `claude/plan-complete-ai-review-backlog-85f80a` | Step 1: ACTIVE. Step 2: PR #510 MERGED → **stale**. |
| `unified-model-mgmt-5af7ee` | `claude/unified-model-mgmt-5af7ee` | Step 1: STALE (ancestor of origin/main). Step 2: PR 없음. Step 1 STALE 로 판정. |

`plan-complete-turn-timing-aa533b` (branch: `refactor-backlog-options`) 는 PR #517 OPEN → **active** 로 판정. `spec/2-navigation/5-knowledge-base.md` 의 동일 frontmatter 패치를 보유하나, 이 변경이 이미 main 에 반영돼 있다면 (#513 MERGED) merge 시 자동 해소됨 (충돌 없음).

stale worktree 가 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/2-navigation/` 에 대한 impl-prep 정합성 관점에서 주요 이슈는 **이미 구현 완료된 갭이 in-progress plan 에서 open 상태로 잘못 남겨진 것**이다. `spec-sync-schedule-gaps.md` 의 sort/order 항목(C-10, 코드 확인 완료)과 `spec-sync-workflow-list-gaps.md` 의 상태 필터 버그 항목(C-1, 코드 확인 완료)이 모두 체크되지 않아 이중 구현 시도 오해를 유발할 수 있다. 미해결 결정 우회나 active worktree 간 실질적 경합은 발견되지 않았다. worktree 충돌 후보 7건을 분석한 결과 stale 6건 skip, active 1건(refactor-backlog-options, spec/2-navigation/5-knowledge-base.md 동일 패치 보유 — 단 해당 spec 변경은 이미 main 에 도달했을 가능성이 높아 merge 시 자동 해소 예상)이다.

---

## 위험도

LOW
