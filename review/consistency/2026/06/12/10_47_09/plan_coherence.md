# Plan 정합성 검토 결과

검토 대상: `spec/5-system/1-auth.md`
검토 시점: 2026-06-12
검토 모드: spec draft (--spec)

---

## 발견사항

### [CRITICAL] `pr4b-kb-embedding-retire` active worktree가 동일 파일의 §4.1 Planned 액션 섹션을 반대 방향으로 수정 중

- **target 위치**: `spec/5-system/1-auth.md §4.1 Planned 표` + `§Rationale 4.1.A`
- **관련 plan**: `plan/in-progress/spec-draft-unified-model-management.md` (worktree `pr4b-kb-embedding-retire`, branch `claude/pr4b-kb-embedding-retire`)
- **상세**:
  - target (`spec-auth-hygiene` worktree)의 변경: §4.1 Planned 표에서 `password_change`·`2fa_enable/disable` (dot-prefix 없는 구표기) → `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` (dot-prefix + 과거분사 정규화)로 교정. `§Rationale 4.1.A`에 그 근거를 신규 추가.
  - `pr4b-kb-embedding-retire` worktree의 변경 (vs origin/main): **동일 §4.1 Planned 표**에서 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` → `password_change, 2fa_enable/disable` 로 **되돌리는** 방향이며, 동시에 `§Rationale 4.1.A` 전체(14줄)를 삭제하는 변경을 포함.
  - 두 worktree가 같은 섹션을 **서로 반대 방향으로 편집** 중 — merge 시 충돌 확정이며, 어느 쪽이 먼저 머지되더라도 나머지가 동일 섹션을 다시 건드려야 한다.
  - `pr4b-kb-embedding-retire`는 PR이 없으며(gh pr list 결과 []) Step 1·Step 2 모두 stale 신호 없음 → ACTIVE로 처리.
  - `spec-auth-hygiene` 변경(target)은 §4.1 규약("dot-prefix 필수") 상 올바른 교정이다. 그러나 `pr4b-kb-embedding-retire` 측은 구표기를 유지하므로 이 결정이 정식 합의되기 전 병행 편집은 혼선을 만든다.
- **제안**:
  1. `pr4b-kb-embedding-retire` 측의 `spec/5-system/1-auth.md` 변경 범위를 확인해 §4.1 Planned 표 교정이 이미 반영됐는지 조율한다.
  2. 어느 쪽이 먼저 머지될지 직렬화를 결정하거나, `pr4b-kb-embedding-retire`가 main 반영 후 리베이스 시 target 변경을 흡수하도록 plan frontmatter에 명시한다.

---

### [WARNING] `auth-config-webhook-followups.md §3` spec 보완 항목 중 `POST /api/auth-configs/:id/reveal` API 엔드포인트 행 추가가 target에서 간접적으로 해소

- **target 위치**: `spec/5-system/1-auth.md §5 API 엔드포인트` (target diff 중 `인증 설정(AuthConfig) CRUD 엔드포인트 ... 단일 SoT` 문단 추가)
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md §3` — "spec §5 API 엔드포인트 표에 `POST /api/auth-configs/:id/reveal` 행 추가" 를 미해소 항목으로 기록
- **상세**:
  - plan §3은 `reveal` 엔드포인트를 §5 표에 **직접 행으로 추가**하도록 요청하고 있다.
  - target은 대신 §5 끝에 "AuthConfig CRUD 엔드포인트는 설정 spec §A.4가 단일 SoT — 본 문서는 권한·감사만 다룬다" 라는 위임 문단을 추가하는 방식으로 처리했다. `reveal` 행을 직접 열거하지 않고 cross-reference로 대체한 것이다.
  - 이 접근이 §3 요청사항을 완전히 충족하는지, 아니면 `reveal` 행을 §5 표에 명시적으로 기재해야 하는지 plan과 정합을 명시적으로 표시해야 한다.
  - plan의 해당 체크박스는 아직 미완료([ ]) 상태이므로, target 변경이 이를 해소하는 것이라면 plan을 갱신해야 한다.
- **제안**: `auth-config-webhook-followups.md §3`의 해당 항목을 target 변경 방식(cross-reference 위임)으로 해소됨으로 체크하거나, reveal 행의 직접 열거가 여전히 필요하다면 target에 추가한다.

---

### [WARNING] `spec-sync-auth-gaps.md` pending_plans 참조 조건 — target 변경이 해소하는 갭과 무관하게 유지

- **target 위치**: `spec/5-system/1-auth.md` frontmatter `pending_plans`
- **관련 plan**: `plan/in-progress/spec-sync-auth-gaps.md` (LDAP/SAML 미구현 추적)
- **상세**:
  - target의 frontmatter는 `pending_plans: [plan/in-progress/auth-config-webhook-followups.md, plan/in-progress/spec-sync-auth-gaps.md]`를 그대로 유지하고 있다.
  - target 변경 내용(§4.1 Planned 액션 정규화, §5 엔드포인트 행 추가, §Rationale 항목 추가, Production fail-closed 가드 OAUTH_STUB_MODE/LLM_STUB_MODE 문단 추가)은 `spec-sync-auth-gaps.md`가 추적하는 LDAP/SAML 미구현과 무관하다.
  - `auth-config-webhook-followups.md §3` 일부가 target에서 해소될 경우 해당 plan의 남은 미해소 항목(§2 chatChannel 순서 이슈, §4 reveal rate limiting 등)이 여전히 있으므로 pending_plans 항목 유지는 적절하다.
  - 다만 §3의 일부 항목이 target에서 해소된다면, plan 자체의 체크박스 갱신이 누락되면 pending_plans 참조 존재 검증 테스트(`spec-pending-plan-existence`)에서는 여전히 통과하지만, 진행 상황 추적이 불명확해진다.
- **제안**: target 머지 후 `auth-config-webhook-followups.md §3`에서 해소된 항목(cross-reference 위임으로 처리한 reveal 행 추가 요청)을 체크 완료로 표기하거나 명시적으로 "위임 방식으로 해소됨" 주석을 달아 plan 정합성을 유지한다.

---

### [INFO] `spec-audit-action-prose` worktree — `spec/5-system/1-auth.md` 미접촉, 이슈 없음

`spec-audit-action-prose` (branch `claude/spec-audit-action-prose`)는 `spec/5-system/1-auth.md`를 수정하지 않는다 (diff 결과 없음). 충돌 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 3건 중 stale 판정된 항목:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 2 PR `MERGED`
- `test-code-http-hardening-10aad3` (branch `claude/test-code-http-hardening-10aad3`) — Step 2 PR `MERGED`

두 worktree 모두 PR이 MERGED 상태이므로 활성 작업으로 볼 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

active 후보로 분류된 항목:

- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1 ACTIVE, Step 2 PR 없음 ([] 반환) → Step 3 fallback: ACTIVE로 처리. stale 판정 cascade Step 1/2 모두 음성. active로 처리 — 실제 stale이면 `cleanup-worktree-all.sh` 실행 후 재검토 권장.

---

## 요약

`spec/5-system/1-auth.md`의 target 변경(§4.1 Planned 액션 dot-prefix 정규화, §5 엔드포인트 행 보강, §Rationale 4.1.A 신설, Production fail-closed 가드 OAUTH_STUB_MODE/LLM_STUB_MODE 추가)은 `spec-sync-auth-gaps.md`(LDAP/SAML 추적)와 직접 충돌하지 않는다. 그러나 `pr4b-kb-embedding-retire` worktree가 동일 파일의 §4.1 Planned 표를 **반대 방향**으로 수정 중(구표기 `password_change` 유지 + Rationale 4.1.A 삭제)이어서 직렬화가 필요한 CRITICAL 충돌이 존재한다. `auth-config-webhook-followups.md §3` 의 reveal 엔드포인트 행 추가 요청은 target이 cross-reference 위임 방식으로 부분 해소했으나 plan 체크박스가 미갱신이다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 분석.

---

## 위험도

CRITICAL
