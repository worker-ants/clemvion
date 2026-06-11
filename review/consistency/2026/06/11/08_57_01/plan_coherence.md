# Plan 정합성 검토 결과

검토 대상: `spec/data-flow/` (구현 완료 후 검토, diff-base=origin/main)
실제 변경 파일: `spec/data-flow/2-auth.md` (단일 파일)
검토 시점: 2026-06-11

---

## 발견사항

발견된 CRITICAL / WARNING 항목 없음.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 분석: `spec/data-flow/` 를 건드리는 활성 worktree 7개를 검출해 stale 판정을 수행했다.

### 분석 결과

target (`spec/data-flow/2-auth.md`) 과 동일 파일을 손대는 다른 활성 worktree 는 검출되지 않았다.

`spec/data-flow/` 하위 **다른** 파일을 손대는 worktree 6개를 추가로 검토했으나, 어떤 worktree 도 `2-auth.md` 에는 접촉하지 않아 §5 worktree 충돌 대상이 없다.

stale 판정을 수행한 6개 후보:

- `health-probe-status-d9a184` (branch `claude/health-probe-status-d9a184`) — Step 2 PR #527 **MERGED** → **stale**
- `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) — Step 2 PR #526 **MERGED** → **stale**
- `kb-reembed-banner-ecfe2b` (branch `claude/kb-reembed-banner-ecfe2b`) — Step 2 PR #529 **MERGED** → **stale**
- `kb-unsearchable-groom-cbe34e` (branch `claude/kb-unsearchable-groom-cbe34e`) — Step 2 PR #528 **MERGED** → **stale**
- `makeshop-catalog-labels` (branch `claude/makeshop-catalog-labels`) — Step 2 PR #530 **MERGED** → **stale**
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 1 ancestor 검사 ACTIVE, Step 2 PR 없음 → **active (Step 3 fallback)**. 단 해당 worktree 가 변경하는 파일은 `spec/data-flow/{1-audit, 5-integration, 6-knowledge-base, 7-llm-usage, 8-notifications, 9-observability, 13-agent-memory, 15-external-interaction}.md` 로 `2-auth.md` 와 비겹침 → §5 충돌 대상 아님.

**stale skip 목록:**

- `health-probe-status-d9a184` (branch `claude/health-probe-status-d9a184`) — Step 2 PR #527 MERGED
- `integration-expiry-fixes-1d7c7d` (branch `claude/integration-expiry-fixes-1d7c7d`) — Step 2 PR #526 MERGED
- `kb-reembed-banner-ecfe2b` (branch `claude/kb-reembed-banner-ecfe2b`) — Step 2 PR #529 MERGED
- `kb-unsearchable-groom-cbe34e` (branch `claude/kb-unsearchable-groom-cbe34e`) — Step 2 PR #528 MERGED
- `makeshop-catalog-labels` (branch `claude/makeshop-catalog-labels`) — Step 2 PR #530 MERGED

위 5개 worktree 는 PR 이 MERGED 상태로 stale 판정. 활성으로 남아 있을 이유가 없으므로 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target 변경(`spec/data-flow/2-auth.md §1.4` — refresh 토큰 rotation 원자성 표기 추가)은 plan/in-progress 와의 정합성 관점에서 문제없다.

**검토 1 (미해결 결정과의 충돌)**: 변경 근거인 `plan/in-progress/refactor/05-database.md` C-1 은 spec 대조 판정 D ("미결정 영역")로 분류되어 있었고, 권장안 A(트랜잭션 원자화)를 명시하여 결정이 완료된 상태다. target 은 그 결정을 spec 에 반영한 것으로 미해결 결정을 우회하지 않는다.

**검토 2 (중복 작업)**: 다른 활성 worktree 중 `spec/data-flow/2-auth.md` 를 건드리는 곳은 없다. `unified-model-mgmt-5af7ee` 가 `spec/data-flow/` 하위 파일을 다수 변경하지만 `2-auth.md` 는 포함되지 않아 경합 없음.

**검토 3 (선행 plan 미해소)**: target 의 사전 조건인 `auth.service.ts` 구현 (`plan/in-progress/auth-refresh-rotation-atomic.md` 체크리스트 해당 코드 커밋)은 이미 branch 에 포함되어 있다.

**검토 4 (후속 항목 누락)**: `spec-sync-auth-gaps.md`(LDAP/SAML 미구현)·`security-jwt-secret-fallback.md`(JWT 기본 키 부팅 정책)·`auth-config-webhook-followups.md` 등 auth 관련 in-progress 항목들은 본 변경이 다루는 refresh 토큰 회전 원자성과 직교하여 무효화되는 후속 항목이 없다.

**검토 5 (worktree 충돌)**: `2-auth.md` 를 동시에 수정하는 다른 worktree 없음 확인. `spec/data-flow/` 내 다른 파일을 수정하는 worktree 중 활성(ACTIVE)인 것은 `unified-model-mgmt-5af7ee` 하나이나 파일 비겹침 확인.

worktree 충돌 후보 6건 중 stale 5건 skip, active 1건은 파일 비겹침으로 §5 적용 제외.

---

## 위험도

NONE
