# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-health-probe-status.md`
검토 모드: spec draft (--spec)

---

## 발견사항

- **[WARNING]** `spec-sync-structural-followups.md` 의 `9-observability` 미완 cross-spec 항목과 target 의 substantive 변경이 동일 파일에 교차
  - target 위치: `plan/in-progress/spec-draft-health-probe-status.md §영향받는 문서 → spec/data-flow/9-observability.md`
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md §B` — "data-flow/9-observability — System Status SoT 참조가 5-system/16 과 2-navigation/15 두 갈래 — 정식 /consistency-check 로 정리 권장" (미완, `[ ]`)
  - 상세: target plan 은 `9-observability.md §1.1` 에 liveness/readiness 분리·mermaid 액터·status code·HEALTH_CHECK_LOG·Rationale 을 substantive 하게 갱신할 예정이다. structural-followups 의 해당 항목은 동일 파일의 System Status SoT cross-ref 경로(5-system/16 vs 2-navigation/15)를 정리하는 내용으로, 목적이 직교하므로 CRITICAL 충돌은 아니다. 그러나 target 이 9-observability 를 대폭 개정하는 시점에 structural-followups 의 SoT 정리 항목이 후속 edit 으로 남는 경우 편집 경합이 발생한다.
  - 제안: target spec 작업 시 structural-followups §B 의 SoT dual-reference 항목을 병행 처리하거나, target PR 이 9-observability 를 개정한 후 structural-followups 해당 항목에 "target PR 반영 완료" 체크 여부를 확인한다. 두 plan 작업자가 다른 worktree 에서 동시에 같은 파일을 편집하지 않도록 주의.

- **[WARNING]** `spec-sync-structural-followups.md` worktree `spec-sync-audit` 가 active git 브랜치로 추적되지 않으나 plan frontmatter 에 명시됨 — target plan 착수 전 확인 필요
  - target 위치: target plan frontmatter `worktree: health-probe-status-d9a184` (이미 배정 완료)
  - 관련 plan: `plan/in-progress/spec-sync-structural-followups.md` frontmatter `worktree: spec-sync-audit`
  - 상세: `git worktree list` 에 `spec-sync-audit` 브랜치/worktree 가 존재하지 않는다(local 브랜치, remote 브랜치 모두 없음). 실제 작업이 다른 worktree 에서 진행 중이거나 이미 main 에 squash merge 됐을 가능성이 있다. target 과 동일 파일(`9-observability.md`)이 해당 plan 의 §B 미완 항목에 포함되어 있어, 실제 worktree 가 재개될 경우 겹칠 수 있다.
  - 제안: `spec-sync-structural-followups.md` 의 worktree 필드를 현재 상태로 갱신(미착수면 `(unstarted)`)하고, §B 9-observability 항목이 target PR 에서 해소될 수 있는지 확인한다.

- **[INFO]** `exec-intake-queue-impl.md` 의 `16-system-status-api.md §1` 변경 항목은 이미 완료(`[x]`)
  - 관련 plan: `plan/in-progress/exec-intake-queue-impl.md` — `16-system-status-api.md §1` 에 execution-run 반영 (PR2a 완료 기록)
  - 상세: 해당 plan 의 16-system-status 작업은 완료 상태이며, 현재 미완 항목(PR3, PR4)은 execution-engine/park 범위라 target 과 영역 겹침 없음. 충돌 없음.

- **[INFO]** `spec/data-flow/9-observability.md §Rationale` 의 "S3 ping — liveness 빨라야 하므로 readiness/별도 endpoint 권장" 기존 서술이 target 변경 후 더 강한 근거로 실현되는 구조
  - target 위치: `spec-draft-health-probe-status.md §영향받는 문서 → §Rationale` "기존 S3 분리 권고를 readiness 기준으로 재서술"
  - 상세: 현재 9-observability.md Rationale 에 "S3 ping 은 liveness 가 빨라야 하니 readiness/별도 endpoint 권장" 기술이 있고, target plan 은 이를 readiness(`/api/health`) 기준으로 재서술한다. 기존 서술과 방향이 일치(plan §Rationale 명시)하므로 충돌 없음. 재서술 시 기존 문장을 삭제하지 말고 새 구조를 명문화하는 방향으로 편집하면 이력 연속성이 유지된다.

- **[INFO]** target plan `§후속(구현)` 의 수동 감사 노트 — `spec/data-flow/9-observability.md` 는 `spec-impl-evidence` 가드 범위 밖이라 spec↔구현 자동 커버리지 없음 (target plan 에 이미 명시됨, 추가 조치 불요)
  - 상세: target plan §후속 마지막 항목에 이미 적혀있어 인지하고 있음. 구현 착수 시 developer 가 수동 확인하도록 인수인계하면 충분.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보: `.claude/worktrees/spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — 이 worktree 의 diff(`origin/main..HEAD`)에 target 3개 파일 모두 포함되어 있어 §5 검사 대상이었음.

- `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 1: `git merge-base --is-ancestor` ACTIVE(branch HEAD 가 main 의 조상 아님). Step 2: `gh pr list --state all --head claude/spec-sync-audit-998544` → PR #516 state **MERGED**. squash merge 케이스로 **stale 판정**. CRITICAL 분류에서 제외.

해당 worktree 가 활성으로 남아있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target plan(`spec-draft-health-probe-status.md`)은 `plan/in-progress` 의 미해결 결정을 일방적으로 우회하는 항목이 없다. target 이 손대는 3개 spec 파일(`9-observability.md`, `3-error-handling.md`, `16-system-status-api.md`) 중 active 경합은 없으며, 유일한 worktree 충돌 후보(`spec-sync-audit-998544`)는 PR #516 MERGED 로 stale 판정되어 제외됐다. 다만 `spec-sync-structural-followups.md` 가 동일 `9-observability.md` 의 미완 cross-spec 정리 항목(`[ ]`)을 보유하므로 target PR 편집 시 해당 항목을 병행 처리하거나 후속 체크를 명시하는 것이 권장된다. worktree 충돌 후보 1건 중 stale 1건 skip, active 0건 분석.

---

## 위험도

LOW
