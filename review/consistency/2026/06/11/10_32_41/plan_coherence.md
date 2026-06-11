## 발견사항

- **[WARNING]** target 이 origin/main 보다 구형(pre-merge) 상태를 기준으로 작성돼 이미 머지된 내용과 충돌
  - target 위치: `spec/2-navigation/14-execution-history.md` §5 목록 API 응답 샘플 + `## Rationale` 전체
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` §C-7 (✅ FIXED, commit `7f413725`)
  - 상세: target 문서(워킹트리 내 수정본)의 §5 JSON 샘플에서 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 세 필드와 `## Rationale` 섹션(R-1~R-4)이 **제거**돼 있다. 그런데 origin/main(현재 HEAD `230a0fba`)에는 이 필드들과 Rationale 섹션이 이미 존재한다. 즉 target 은 이전 세 개 병렬 worktree(ai-node-override-fields, audit-coverage-naming, auth-refresh-rotation-atomic — 모두 STALE, 아래 참조)가 main 에 머지되기 전의 파일을 기준으로 재작성된 것으로 추정된다. 이 채로 커밋하면 C-7 구현·R-1~R-4 Rationale 이 main 에서 제거된다.
  - 제안: target 워킹트리에서 `git diff origin/main -- spec/2-navigation/14-execution-history.md` 를 재확인하고, JSON 샘플에 `totalNodeCount`/`completedNodeCount`/`failedNodeCount` 유지, `## Rationale` 섹션(R-1~R-4) 유지한 채 Overview 구조 변경(### 1. 개요 → 인라인 요약문, #### 1.1/1.2 → ### 배경/목표/요구사항)만 적용해야 한다.

- **[INFO]** `spec-sync-structural-followups.md` C-7 항목이 이미 완료됐으나 plan 의 "spec frontmatter 승격" 위임이 별도 plan(`spec-update-c-sync-promotions.md`)에 미완으로 남아 있을 수 있음
  - target 위치: `spec/2-navigation/14-execution-history.md` frontmatter `status: implemented`
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` §스펙 승격 위임 (line ~57)
  - 상세: C-7 구현은 완료됐고 target 에도 `status: implemented` 가 유지돼 있어 frontmatter 자체는 문제없다. 다만 `spec-update-c-sync-promotions.md` 라는 위임 plan 이 in-progress 폴더에 보이지 않아 이미 처리됐거나 생성되지 않은 상태일 수 있다 — 트래킹 정도의 INFO.
  - 제안: `spec-update-c-sync-promotions.md` 존재 여부를 확인하고 없으면 `spec-sync-structural-followups.md §스펙 승격 위임` 항목을 처리 완료로 표시.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `audit-coverage-naming` (branch `claude/audit-coverage-naming`) — Step 1 ancestor check: STALE (branch HEAD 가 origin/main 의 조상). PR: empty (squash merge 로 추정, PR 기록 없음).
- `ai-node-override-fields` (branch `claude/ai-node-override-fields`) — Step 1: ACTIVE(아닌 것처럼 보이나 Step 2에서 PR `MERGED` 확인됨). Step 2 PR state: MERGED.
- `auth-refresh-rotation-atomic` (branch `claude/auth-refresh-rotation-atomic`) — Step 1: ACTIVE. Step 2 PR state: MERGED.

세 worktree 모두 `spec/2-navigation/14-execution-history.md` 를 동일하게 수정(EH-LIST-02 간소화 + nodeCount 3필드 제거 + Rationale 삭제)했으나, 이 변경은 main 에 **반영되지 않은 채 squash merge** 된 것으로 판단된다 — origin/main 현재 HEAD 에는 nodeCount 필드와 Rationale 이 존재(이 세 worktree 의 변경이 main 에 들어가지 않았음을 의미). 따라서 해당 삭제 변경이 다른 커밋에서 의도적으로 보존된 것이며, target 이 그 삭제를 재적용하는 것은 의도 역전이다.

해당 worktree 가 활성으로 남아 있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

Plan 정합성 관점에서 주요 위험은 **target 문서가 origin/main 의 현재 상태보다 구형 기준으로 재작성돼, 이미 구현 완료된 C-7 (nodeCount 3필드)와 R-1~R-4 Rationale 을 제거한다는 점**이다. 미해결 결정 충돌(§1)이나 선행 plan 미해소(§3) 는 없으며, 문서 구조 개선(Overview 3-section 포맷) 자체는 다른 plan 이 금지하는 내용이 아니다. worktree 충돌 후보 3건 모두 stale(Step 1 ancestor 또는 Step 2 PR MERGED)로 skip 됐고 active 충돌 0건.

---

## 위험도

MEDIUM
