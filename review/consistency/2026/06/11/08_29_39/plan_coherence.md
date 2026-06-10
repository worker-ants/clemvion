# Plan 정합성 검토 결과

검토 모드: `--impl-done` (scope=spec/2-navigation/, diff-base=origin/main)
대상 worktree: `kb-reembed-banner-impl-31d0c8` (branch `claude/kb-reembed-banner-impl-31d0c8`)
대상 plan: `plan/in-progress/kb-model-change-reembed-followup.md`

---

## 발견사항

### [WARNING] unified-model-mgmt-5af7ee 가 spec/2-navigation/5-knowledge-base.md §2.4.1 검색 불가 배너를 제거 중

- **target 위치**: `spec/2-navigation/5-knowledge-base.md` §2.4.1 검색 불가 배너 (lines 147–152, R-3) — 현재 origin/main 에 존재하며 kb-reembed-banner-impl 이 구현하는 표적 spec
- **관련 plan**: 없음 (unified-model-mgmt-5af7ee 에는 `plan/in-progress/unified-model-management.md` 가 있으나 `in-progress/` 에 등재되지 않은 active worktree)
- **상세**: active worktree `unified-model-mgmt-5af7ee`(stale 판정 cascade — Step 1: ancestor 아님, Step 2: PR 없음, Step 3: active fallback)가 `spec/2-navigation/5-knowledge-base.md` 를 광범위하게 수정 중이며, 그 과정에서 §2.4.1 **검색 불가 배너** (`embeddingDimension == null` 신호, `reembedStatus` idle/in_progress 분기, `[지금 재임베딩]` CTA 명세)와 **R-3 Rationale** 절 전체를 삭제하는 diff 를 가지고 있다. 해당 spec 절은 origin/main(PR #529 에서 추가) 에 존재하며, 현재 target 이 구현 중인 기능의 SoT 다. 또한 unified-model-mgmt 의 diff 는 5-knowledge-base.md 의 `status` 를 `partial → implemented` 로 격상하고 `pending_plans: [kb-model-change-reembed-followup.md]` 도 제거한다 — 즉 kb-reembed-banner-impl 이 아직 완료되지 않은 상태에서 spec 을 "완료" 로 선언하는 모양이 된다. unified-model-mgmt 의 `plan/in-progress/unified-model-management.md` 는 "차원 교체 가드는 `kb-model-change-reembed-followup.md` 규칙 준수"라고 명시하고 있으나, 실제 spec diff 는 그 plan 의 SoT 인 배너 spec 을 삭제하는 불일치가 있다.
- **제안**: unified-model-mgmt-5af7ee 가 5-knowledge-base.md 를 수정할 때 §2.4.1 검색 불가 배너·R-3 절을 보존하거나, 혹은 unified-model-mgmt PR 이 kb-reembed-banner-impl PR 보다 **나중에 병합**될 것이 확실해지면 병합 순서를 PR 본문에 명시해야 한다. kb-reembed-banner-impl 쪽에서는 별도 조치 불필요(target 이 spec 을 제거하지 않음).

---

### [INFO] spec/2-navigation/4-integration.md diff 는 rebase 아티팩트 — 이 PR 의 의도적 변경 아님

- **target 위치**: `spec/2-navigation/4-integration.md` lines 830, 1136 (apiLabel makeshop 행 삭제)
- **관련 plan**: 없음 (이 worktree 의 커밋 이력에 4-integration.md 변경 없음)
- **상세**: `git diff origin/main` 에서 spec/2-navigation/4-integration.md 가 변경된 것으로 보이지만, merge-base(`071c5959`) 이후 이 worktree 의 커밋이 해당 파일을 건드리지 않았음을 확인했다. 원인은 origin/main 이 PR #530("makeshop catalog operations 충전 V-06") 을 merge-base 이후 포함해 makeshop 행을 spec 에 추가했으나, 이 worktree 가 아직 rebase 되지 않아 delta 로 보이는 것이다. 실제 변경 책임은 이 PR 에 없다. 단, 병합 전 rebase 시 PR #530 의 makeshop 추가 내용을 정확히 수용해야 한다.
- **제안**: 병합 전 `git rebase origin/main` 을 수행해 아티팩트 제거. consistency-check --impl-done 에서 이 diff 를 target 의 spec 변경으로 해석하지 말 것.

---

### [INFO] spec-sync-workflow-list-gaps.md 의 미구현 항목들 — target 범위와 무관

- **target 위치**: `spec/2-navigation/1-workflow-list.md`
- **관련 plan**: `plan/in-progress/spec-sync-workflow-list-gaps.md` (worktree: spec-sync-audit, stale — Step 2: PR #443 MERGED)
- **상세**: spec-sync-workflow-list-gaps 는 정렬 UI / 태그 필터 UI / 폴더 필터 UI / 마켓플레이스 링크 미구현 항목을 추적한다. worktree `spec-sync-audit` 가 stale 이고 해당 plan 의 항목들은 1-workflow-list.md 를 건드리지 않는다. target kb-reembed-banner-impl 도 1-workflow-list.md 를 변경하지 않으므로 충돌 없음.
- **제안**: plan 파일 자체는 worktree 필드가 stale worktree 를 가리키므로 cleanup-worktree-all.sh 실행 후 plan frontmatter `worktree` 를 갱신 권장.

---

## Stale 으로 skip 한 worktree (의무)

spec/2-navigation/ 관련 worktree 충돌 후보 7건 중 stale 판정으로 skip 된 항목:

- `health-probe-status-d9a184` (branch `claude/health-probe-status-d9a184`) — Step 2: PR #527 MERGED. 5-knowledge-base.md 와 4-integration.md 를 건드렸으나 squash merge 완료.
- `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) — Step 2: PR #526 MERGED (fix(integrations): makeshop expired 오격하 해소). 5-knowledge-base.md 와 4-integration.md 건드림.
- `kb-reembed-banner-ecfe2b` (branch `claude/kb-reembed-banner-ecfe2b`) — Step 2: MERGED. 4-integration.md 건드림.
- `kb-unsearchable-groom-cbe34e` (branch `claude/kb-unsearchable-groom-cbe34e`) — Step 2: MERGED. 4-integration.md + 5-knowledge-base.md 건드림.
- `makeshop-catalog-labels` (branch `claude/makeshop-catalog-labels`) — Step 2: PR #530 MERGED (fix(integrations): makeshop catalog operations 충전 V-06). 5-knowledge-base.md 건드림.
- `spec-sync-audit` (branch `claude/spec-sync-audit`) — Step 2: PR #443 MERGED. worktree: spec-sync-audit 를 frontmatter 로 가진 여러 plan 파일(spec-sync-workflow-list-gaps 등)은 이 stale worktree 를 참조 중.

위 worktree 들은 PR 이 merged 됐으나 물리적 worktree checkout 이 남아 있어 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active worktree 로 처리된 항목 (1건):
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 1: ancestor 아님, Step 2: PR 없음(empty), Step 3: active fallback. 30개 커밋 ahead + 미커밋 변경사항 확인. → **§발견사항 WARNING** 으로 보고.

---

## 요약

target `kb-reembed-banner-impl-31d0c8` 은 spec/2-navigation/5-knowledge-base.md 의 "검색 불가 배너" spec(PR #529) 을 SoT 로 삼아 KB 상세 페이지 배너 컴포넌트와 CTA 를 구현한 PR 이다. target 자체의 커밋이 spec/2-navigation/ 파일을 변경하지 않으므로 미해결 결정 우회·spec 충돌은 없다. 가장 주요한 위험은 active worktree `unified-model-mgmt-5af7ee` 가 5-knowledge-base.md 에서 배너 spec 절(§2.4.1·R-3)을 제거하는 diff 를 가지고 있다는 점으로, 병합 순서에 따라 target 의 구현 근거가 spec 에서 사라질 수 있다(WARNING). spec/2-navigation/4-integration.md 의 diff 는 origin/main 이 rebase 없이 앞서 나간 데 따른 순수 아티팩트(INFO)다. worktree 충돌 후보 7건 중 stale 6건 skip, active 1건(unified-model-mgmt-5af7ee) 분석.

---

## 위험도

**MEDIUM**

(unified-model-mgmt-5af7ee 가 아직 병합되지 않은 active worktree 로, 5-knowledge-base.md 의 배너 spec 절을 삭제하는 diff 를 가지고 있다. 이 PR 보다 먼저 병합되면 배너 구현의 spec 근거가 사라지는 충돌이 발생하나, unified-model-mgmt plan 자체가 kb-model-change-reembed-followup 을 후행 의존으로 인식하므로 협조 가능한 수준이다.)
