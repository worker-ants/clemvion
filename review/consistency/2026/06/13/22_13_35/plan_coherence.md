# Plan 정합성 검토 결과

target: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md`
검토 시각: 2026-06-13

---

## 발견사항

### [INFO] target 의 B-1 (user.* ipAddress 동반) 은 부분적으로 현재 worktree 변경과 겹침
- **target 위치**: B-1 §변경 4 — `spec/data-flow/1-audit.md §1.1` 의 user.* 행에 `· ipAddress 동반(포렌식)` 추가
- **관련 plan**: `plan/in-progress/spec-draft-pwchange-revoke-user-ip.md` (target 자체) 와 현재 worktree `claude/audit-user-actions`
- **상세**: 현재 worktree(`claude/audit-user-actions`)가 `spec/data-flow/1-audit.md §1.1`의 user.* 행 5줄을 이미 추가·수정했다. 그러나 해당 커밋에는 `ipAddress 동반(포렌식)` 표기가 포함되지 않았다. B-1이 요구하는 추가는 현재 worktree가 건드린 같은 표의 같은 행에 적용된다. worktree가 머지되기 전에 B-1을 반영하면 충돌 없이 동일 라인에 추가가 가능하나, 머지 이후에 별도 worktree에서 반영하면 병합이 간단하다. 현재는 두 작업이 동일 파일의 인접 영역을 대상으로 하므로, B-1 spec 반영은 현재 worktree가 머지된 뒤 수행하거나, 동일 worktree 내 추가 커밋으로 포함시키는 것이 안전하다.
- **제안**: `claude/audit-user-actions` 머지 완료 후 `spec-draft-pwchange-revoke-user-ip.md` 의 spec 반영 작업을 착수할 것. 또는 동일 worktree 내에서 B-1 spec 수정을 연속 커밋으로 포함해도 무방.

### [INFO] target 의 A-1 (세션 revoke 정책) 은 `spec/5-system/1-auth.md` §2.3 미변경 영역 대상 — 경합 없음
- **target 위치**: A-1 변경 1·2·3 — `spec/5-system/1-auth.md §2.3` 표 행 추가 + `§4.3 session_revoked` 확장 + `Rationale §2.3.C` 신설
- **관련 plan**: `auth-config-webhook-followups.md` (§3 spec 보완 항목이 `spec/5-system/1-auth.md §5` 를 건드리나 §2.3/§4.3/Rationale 와는 다른 섹션)
- **상세**: 현재 `claude/audit-user-actions` 는 `spec/5-system/1-auth.md §4.1` "구현됨" 행 이동(user.* 를 Planned→구현됨으로 승격)만 변경했다. §2.3 세션 정책 표·§4.3 `session_revoked` 설명·`Rationale §2.3.C` 는 해당 branch에서 미변경이다. `auth-config-webhook-followups.md`의 §3 spec 보완(§5 API 엔드포인트 표, webhook IP 정책)도 A-1이 건드리는 §2.3/§4.3/Rationale 와 겹치지 않는다. 따라서 A-1 적용 시 spec 파일 충돌 위험 없음.
- **제안**: 추적 메모만 — A-1 착수 전에 `claude/audit-user-actions`가 머지됐는지 확인 후 진행하면 rebase 없이 클린하게 적용 가능.

### [INFO] `spec-draft-unified-model-management.md` 의 `spec/5-system/1-auth.md §4.1` 변경 — worktree MERGED, 중복 경합 없음
- **target 위치**: A-1·B-1 모두 `spec/5-system/1-auth.md` 변경 포함
- **관련 plan**: `plan/in-progress/spec-draft-unified-model-management.md` (worktree `unified-model-mgmt-5af7ee`)
- **상세**: `unified-model-mgmt-5af7ee` branch 는 PR #541 로 MERGED 완료. worktree stale 판정 Step 2에서 확인. 현재 main 에 반영된 상태이므로 경합 없음.
- **제안**: 해당 worktree cleanup 권장 (아래 stale skip 목록 참고).

### [INFO] `auth-config-webhook-followups.md` worktree(claude/auth-config-audit) — MERGED, stale
- **target 위치**: B-1 은 `spec/data-flow/1-audit.md §1.1` 변경 포함
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` — worktree `.claude/worktrees/audit-coverage-naming` (branch `claude/auth-config-audit`)
- **상세**: PR Step 2 검사 결과 `MERGED`. 동 plan의 §2 chatChannel·§1 완료 항목이 `spec/data-flow/1-audit.md` 를 이미 갱신한 상태로 main에 반영됨. target 의 B-1이 건드리는 user.* 행 ipAddress 주석은 해당 PR에 포함되지 않았으므로, target의 B-1 변경과 충돌 없음.
- **제안**: stale worktree cleanup 권장.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 stale 판정으로 skip 된 항목:

- `audit-coverage-naming` (branch `claude/auth-config-audit`) — Step 2: PR MERGED
- `unified-model-mgmt-5af7ee` (branch `claude/unified-model-mgmt-5af7ee`) — Step 2: PR #541 MERGED
- `spec-sync-audit` / `spec-sync-audit-998544` (branch `claude/spec-sync-audit-998544`) — Step 2: PR #516 MERGED

위 3개 worktree는 모두 활성으로 남아있을 이유가 없다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

target `spec-draft-pwchange-revoke-user-ip.md` 는 진행 중인 plan 들과 심각한 정합 충돌을 일으키지 않는다. A-1(비밀번호 변경 시 세션 revoke 정책 — `spec/5-system/1-auth.md §2.3·§4.3·Rationale §2.3.C` 추가)은 현재 active worktree가 건드리지 않은 영역이다. B-1(`spec/data-flow/1-audit.md §1.1` user.* 행에 `ipAddress 동반` 주석 추가)은 현재 active worktree `claude/audit-user-actions`가 동일 표에 user.* 행 자체를 추가했으므로 **병렬 적용 시 병합 충돌 가능성**이 있다 — B-1은 해당 worktree 머지 완료 후 적용하는 것이 안전하다. 미해결 결정 우회·선행 조건 미해소·중복 작업은 없다. stale skip: 충돌 후보 3건 모두 stale(MERGED), active 1건(`claude/audit-user-actions`) 은 B-1 과 같은 파일 인접 영역이나 CRITICAL 수준 충돌 아님.

---

## 위험도

LOW
