# Plan 정합성 검토 — spec/2-navigation/6-config.md

검토 모드: spec draft (--spec)
검토 대상: `spec/2-navigation/6-config.md` (worktree `spec-nit-batch-f35923`)
검토일: 2026-06-11

---

## 발견사항

### [WARNING] frontmatter `pending_plans` 에 이미 완료된 plan 참조 잔존
- **target 위치**: `spec/2-navigation/6-config.md` frontmatter `pending_plans:` 2번째 항목
- **관련 plan**: `plan/in-progress/unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`)
- **상세**: target 의 frontmatter 는 `plan/in-progress/unified-model-management.md` 를 pending_plans 로 열거한다. 그러나 이 plan 의 소유 worktree `unified-model-mgmt-5af7ee` 의 PR(#541)은 이미 `origin/main` 에 squash-merge 완료됐다 (Step 2 GitHub PR state = MERGED). PR0(spec)·PR1(backend)·PR2(embedding 1급화)·PR3(frontend /models 통합)·PR-A/B/C 이월 3건이 모두 완료 기록되어 있다. plan-lifecycle 규약상 이 plan 은 `plan/complete/` 로 이동됐어야 하며, `6-config.md` 의 `pending_plans` 에서도 제거돼야 한다. 미제거 상태면 spec-frontmatter guard(`spec-pending-plan-existence` 테스트)가 존재하지 않는 경로를 가리키는 참조를 잡아낼 수 있다.
  - 추가로, `unified-model-management.md` 는 `main` 의 `plan/in-progress/` 에는 없고 stale worktree 내부에만 남아 있다. target 브랜치(spec-nit-batch)는 origin/main(`5606b385`) 위에 nit 커밋을 쌓은 구조이므로, 이 frontmatter 참조는 PR 머지 후에도 정리되지 않은 잔존 참조다.
- **PR4 cleanup 여부**: `unified-model-management.md §4 PR4`(V092 cleanup — `rerank_config` drop·alias 엔드포인트 제거)는 아직 실행 전이다. target spec §3 "PR4 에서 제거한다" 주석은 정확하다. PR4 가 실행된 후에는 해당 deprecation 주석도 갱신해야 한다.
- **제안**: `spec/2-navigation/6-config.md` frontmatter 에서 `- plan/in-progress/unified-model-management.md` 줄을 제거한다. 동시에 PR4 cleanup 을 위해 별도 plan(또는 `unified-model-management.md` 를 `plan/complete/` 로 이동 시 PR4 잔여 추적 파일)을 생성하고 `pending_plans` 에 해당 경로를 등재한다.

---

### [INFO] `spec-sync-config-gaps.md` 소유 worktree stale — plan 파일만 잔존
- **target 위치**: `spec/2-navigation/6-config.md` frontmatter `pending_plans:` 1번째 항목
- **관련 plan**: `plan/in-progress/spec-sync-config-gaps.md` (worktree `spec-sync-audit`, PR #443 MERGED)
- **상세**: `spec-sync-audit` worktree 는 Step 2 GitHub PR #443 MERGED 확인으로 stale 판정. 단, `spec-sync-config-gaps.md` 자체는 Auth 미구현 갭(IP Whitelist UI·API Key Header Name 필드·기간별 호출 통계)을 추적하는 **아직 해소되지 않은 TODO** 를 담고 있어 plan 파일은 `in-progress` 유지가 맞다. worktree `spec-sync-audit` 가 해당 plan 을 소유했지만 실제 pending gap 이 남아 있으므로, worktree 정리(cleanup) 와 별개로 plan 파일 자체의 `pending_plans` 참조는 유지해야 한다. target spec 은 이 gap 들을 §A.2/§A.3 구현 현황 주석으로 올바르게 반영하고 있다 — 충돌 없음.
- **제안**: worktree `spec-sync-audit` 에 대해 cleanup-worktree-all.sh 실행 권장. `spec-sync-config-gaps.md` frontmatter 의 `worktree: spec-sync-audit` 를 `(unstarted)` 또는 신규 worktree 명으로 갱신 권장 (plan 파일 자체는 유지).

---

### [INFO] 미결 결정 충돌 없음 — nit 변경 범위 제한적
- **target 위치**: `spec/2-navigation/6-config.md` 전체
- **상세**: 이번 nit 커밋(`9c839e62`)이 `6-config.md` 에 가한 실제 변경은 `## Overview (제품 정의)` 단락 신설뿐이다. 이는 순수 additive 이며, `spec-sync-config-gaps.md` 의 미해결 항목(Auth 부분)·`unified-model-management.md` 의 미집행 PR4 cleanup 과 의미적으로 충돌하지 않는다. 미해결 결정(§5 열린 결정 D-1/D-2/D-3)은 spec 본문에 이미 확정 방향으로 기술되어 있고, nit 변경은 이를 건드리지 않았다.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보:
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 1: ACTIVE (squash merge 로 ancestor 아님), Step 2: PR #541 MERGED → **stale**. `spec/2-navigation/6-config.md` 를 수정한 PR 이 이미 완료됨. CRITICAL 제외.
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 1: ACTIVE (squash merge 로 ancestor 아님), Step 2: PR #443 MERGED → **stale**. `spec-sync-config-gaps.md` 소유이나 워크트리 자체는 완료됨. CRITICAL 제외.

두 worktree 모두 active 체크아웃 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/2-navigation/6-config.md` 의 nit 변경(Overview 단락 신설)은 내용적으로 어떤 in-progress plan 의 미해결 결정과도 충돌하지 않는다. 가장 큰 정합 이슈는 frontmatter `pending_plans` 에 이미 머지 완료된 `unified-model-management.md` 참조가 남아 있다는 것(WARNING)이다 — 해당 plan 의 worktree PR #541이 squash-merge 됐음에도 `in-progress/` 이동 및 frontmatter 정리가 누락됐다. PR4 cleanup 은 별도로 추적이 필요하다. worktree 충돌 후보 2건(unified-model-mgmt-5af7ee·spec-sync-audit)은 Step 2 GitHub PR 상태가 MERGED 로 확인되어 stale 판정, CRITICAL 분류에서 제외했다.

## 위험도

LOW
