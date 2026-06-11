# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 검토 (--impl-done, scope=spec/2-navigation/, diff-base=origin/main)
Target: `spec/2-navigation/` 전체 (실제 변경된 spec 파일: 없음 — kb-banner-refactor-76a800 은 codebase/ 만 수정)

---

## 발견사항

- **[CRITICAL]** unified-model-mgmt-5af7ee worktree 가 `spec/2-navigation/5-knowledge-base.md` 의 배너 스펙 전체를 삭제
  - target 위치: `spec/2-navigation/5-knowledge-base.md` §2.4.1 "검색 불가 배너" 항목 4줄 + Rationale §R-3 "상세 상단에 검색 불가 배너 + '지금 재임베딩' CTA 를 둔 이유" 전체 + Rationale §R-2 상당 부분
  - 관련 plan: `plan/in-progress/kb-model-change-reembed-followup.md` (진행 중, worktree: (unstarted) 이지만 실제 kb-banner-refactor-76a800 이 구현을 완료한 작업)
  - 상세: `unified-model-mgmt-5af7ee` 브랜치(branch `claude/unified-model-mgmt-5af7ee`)는 `spec/2-navigation/5-knowledge-base.md` 에서 다음을 **삭제**하는 변경을 포함한다:
    1. `§2.4.1` 의 "**검색 불가 배너**" bullet 전체 (idle/in_progress 분기, RoleGate CTA, ConfirmModal, 자동 소멸 조건, 신규 API 없음 등 4개 하위 bullet)
    2. `Rationale §R-3` 전체 ("상세 상단에 검색 불가 배너 + 지금 재임베딩 CTA 를 둔 이유")
    3. `Rationale §R-2` 의 후속 링크를 `plan/complete/kb-model-change-reembed-followup.md` 로 변경 (kb-banner 의 spec 에서는 `plan/in-progress/` 경로)
    이 삭제는 kb-banner-refactor-76a800 이 구현 완료한 기능(UnsearchableBanner 컴포넌트 — `codebase/frontend/src/components/knowledge-base/unsearchable-banner.tsx`)의 spec 근거를 제거한다. 두 브랜치가 main 에 병합될 때 unified-model-mgmt 가 나중에 머지되면 배너 spec 이 사라져 구현이 spec 없는 상태가 된다(역커버리지 위반).
  - 제안: (a) unified-model-mgmt-5af7ee 브랜치에서 배너 관련 삭제 변경을 되돌리고, 임베딩 모델 1급화(ModelConfig select 등) 변경은 배너 spec 을 보존한 채 적용. 또는 (b) 두 브랜치의 머지 순서를 kb-banner 먼저, unified-model-mgmt 나중으로 고정한 뒤 unified-model-mgmt 가 머지될 때 R-2/R-3 를 유지. 어느 경로든 배너 spec 과 R-3 Rationale 는 구현 코드가 살아있는 한 삭제되어서는 안 된다.

- **[WARNING]** unified-model-mgmt-5af7ee 가 `spec/2-navigation/5-knowledge-base.md` R-2 링크를 `plan/complete/` 로 변경하나, plan 이동이 아직 미완료
  - target 위치: `spec/2-navigation/5-knowledge-base.md` Rationale §R-2·§R-3 의 `kb-model-change-reembed-followup.md` 경로
  - 관련 plan: `plan/in-progress/kb-model-change-reembed-followup.md` — frontmatter `worktree: (unstarted)`, 남은 체크리스트 5개 미완료
  - 상세: unified-model-mgmt 브랜치는 `plan/complete/kb-model-change-reembed-followup.md` 경로로 링크를 수정했지만, 해당 plan 은 아직 `plan/in-progress/` 에 있고 체크리스트("worktree 설정", "테스트 선작성", "구현", "TEST WORKFLOW", "ai-review")가 모두 미완료다. 이 상태에서 unified-model-mgmt 가 머지되면 plan 링크가 dead link 가 된다.
  - 제안: unified-model-mgmt 브랜치에서 해당 링크를 `plan/in-progress/` 경로로 복원하거나, kb-banner-refactor 의 구현이 "kb-model-change-reembed-followup 의 구현 단계를 모두 완료한 것"으로 확정한 뒤 plan 을 `plan/complete/` 로 이동하고 unified-model-mgmt 브랜치를 업데이트.

- **[INFO]** auth-refresh-rotation-atomic worktree 도 `spec/2-navigation/5-knowledge-base.md` 를 수정하나 충돌 없음
  - target 위치: `spec/2-navigation/5-knowledge-base.md` frontmatter (status: implemented → partial, pending_plans 추가) 및 R-2/R-3 링크 텍스트 단순 보정
  - 관련 plan: auth-refresh-rotation-atomic 브랜치 — spec 파일에서 `status: implemented → partial` 로 변경하고 `pending_plans: plan/in-progress/kb-model-change-reembed-followup.md` 추가. 이는 현재 main 의 5-knowledge-base.md 상태와 이미 동일하므로 실질적 충돌 없음(머지 시 no-op). R-2/R-3 내용도 kb-banner 관련 부분을 제거하지 않음.
  - 제안: 추가 조치 불필요. 머지 시 자연 해소.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보: `auth-refresh-rotation-atomic`, `unified-model-mgmt-5af7ee`

stale 판정 cascade:
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`):
  - Step 1: `git merge-base --is-ancestor` → ACTIVE (exit 1)
  - Step 2: `gh pr list --state all --head claude/auth-refresh-rotation-atomic` → 빈 결과 (PR 없음)
  - Step 3: Fallback — **active 로 처리**. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.
  - **skip 하지 않음** (active).

- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`):
  - Step 1: `git merge-base --is-ancestor` → ACTIVE (exit 1)
  - Step 2: `gh pr list --state all --head claude/unified-model-mgmt-5af7ee` → 빈 결과 (PR 없음)
  - Step 3: Fallback — **active 로 처리**. stale 판정 cascade Step 1/2 모두 음성. active 로 처리 — 실제 stale 이면 cleanup-worktree-all.sh 실행 후 재검토 권장.
  - **skip 하지 않음** (active).

**stale skip 건수: 0건.** worktree 충돌 후보 2건 전부 active 로 분류.

---

## 요약

`kb-banner-refactor-76a800` 은 `spec/2-navigation/` 파일을 직접 수정하지 않으며, 구현한 UnsearchableBanner 컴포넌트의 spec 근거는 `spec/2-navigation/5-knowledge-base.md` §2.4.1 과 Rationale R-3 에 이미 존재한다. 그러나 **active worktree `unified-model-mgmt-5af7ee`** 가 해당 spec 파일에서 배너 spec(§2.4.1 검색 불가 배너 bullet 전체 + R-3 전체)을 삭제하는 변경을 독립적으로 포함하고 있어, 두 브랜치가 병렬로 진행되면 머지 순서에 따라 구현 코드는 남아있으나 spec 근거가 사라지는 역커버리지 위반이 발생한다. worktree 충돌 후보 2건 중 stale skip 0건, active 2건 분석.

---

## 위험도

CRITICAL
