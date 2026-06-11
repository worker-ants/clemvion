# Plan 정합성 검토 결과

검토 범위: `spec/5-system` (구현 완료 후 검토, --impl-done, diff-base=origin/main)
대상 변경: `spec/5-system/1-auth.md` §4.1 (action naming 규약 + 구현됨/Planned 표 재편), `spec/data-flow/1-audit.md` §1.1 (writer 표 13개 call site 갱신)

---

## 발견사항

- **[INFO]** `auth-config-webhook-followups.md` §1 완료 선언과 target 정합 — 충돌 없음
  - target 위치: `spec/5-system/1-auth.md §4.1` 구현됨 표에 `auth_config.create/update/delete/regenerate` 추가, Planned 표에서 제거
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §1`
  - 상세: plan §1 체크리스트가 "spec §4.1 4종 Planned→구현됨 이동 + data-flow §1.1 writer 표 동기화" 를 완료 항목으로 기록하고 있으며, target 변경 내용이 이와 정확히 일치한다. 충돌 없음.
  - 제안: 조치 불요.

- **[INFO]** `auth-config-webhook-followups.md` §2·§3·§4 — target 범위 밖, 미착수 상태 유지
  - target 위치: 본 PR 에서 §2(chatChannel 처리 순서)·§3(spec 보완 항목 — reveal 엔드포인트 §5 표 추가 등)·§4(rate limiting) 는 변경하지 않음
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §2·§3·§4`
  - 상세: 이들은 본 PR 범위 밖으로 분명히 구분되어 있고, target 변경이 이 항목들을 건드리지 않아 정합하다.
  - 제안: 조치 불요.

- **[INFO]** `spec-sync-auth-gaps.md` — LDAP/SAML 미구현 항목에 영향 없음
  - target 위치: `spec/5-system/1-auth.md §1.3` 은 본 PR 에서 수정되지 않음
  - 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
  - 상세: target 변경이 §4.1 감사 로그 영역에 국한되고 §1.3 LDAP/SAML 미구현 추적에 영향을 주지 않는다.
  - 제안: 조치 불요.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 검토 결과: `spec/5-system/1-auth.md` 와 `spec/data-flow/1-audit.md` 를 **자체 commit** 에서 수정하는 active worktree 후보는 `claude/prod-fail-closed-guards` 와 `claude/unified-model-mgmt-pr4` 두 건이었다.

- `prod-fail-closed-guards` (branch `claude/prod-fail-closed-guards`) — Step 1: ancestor 아님(ACTIVE), Step 2: PR #539 **MERGED** → **stale**
- `unified-model-mgmt-pr4` (branch `claude/unified-model-mgmt-pr4`) — Step 1: ancestor 아님(ACTIVE), Step 2: PR #545 **MERGED** → **stale**

두 worktree 모두 PR 이 이미 squash-merge 로 종결됐다. main 에 이미 반영된 내용이며 활성 작업 없음. 해당 worktree 디렉토리가 남아 있다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

나머지 active worktree(`claude/ai-node-override-fields`, `claude/auth-refresh-rotation-atomic`, `claude/code-node-isolated-vm`, `claude/fix-embedding-test-dimension-a3d42a`, `claude/fix-model-configs-kind-400-88c8b4`)는 `origin/main` 베이스 파일을 그대로 carry 하고 있을 뿐, 해당 spec 파일에 자체 변경을 가하지 않으므로 경합 없음. `claude/http-ssrf-all-auth` 는 Step 1에서 ancestor 판정(STALE) 됐고 PR 도 발견되지 않으나 Step 1 에서 이미 stale 확정.

- `http-ssrf-all-auth` (branch `claude/http-ssrf-all-auth`) — Step 1: ancestor → **stale**

---

## 요약

target 변경(`spec/5-system/1-auth.md §4.1` + `spec/data-flow/1-audit.md §1.1`)은 `plan/in-progress/auth-config-webhook-followups.md §1` 의 완료 체크리스트에 명시된 작업과 완전히 정합한다. 미해결 결정을 일방적으로 우회하거나, 다른 plan 이 진행 중인 영역과 겹치거나, 후속 항목을 무효화하는 항목은 발견되지 않았다. worktree 충돌 후보 3건(prod-fail-closed-guards, unified-model-mgmt-pr4, http-ssrf-all-auth) 은 stale 판정으로 skip 됐으며, 나머지 active worktree 는 해당 spec 파일을 자체적으로 수정하지 않는다. stale skip 3건 포함 충돌 후보 전체 8건 중 active 충돌 0건.

## 위험도

NONE
