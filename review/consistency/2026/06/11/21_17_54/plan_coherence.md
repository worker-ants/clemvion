# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system)
대상 target 문서: `spec/5-system` (전체 디렉토리)
기준 plan: `plan/in-progress/auth-config-webhook-followups.md` §1 — AuthConfig CRUD audit 기록

---

## 발견사항

### [INFO] auth-config-webhook-followups §1 선결 조건 (AUDIT_ACTIONS 상수 추가) 이미 완료

- target 위치: `plan/in-progress/auth-config-webhook-followups.md` 의 미커밋 변경 내 "선결(audit 표기): AUDIT_ACTIONS 에 AUTH_CONFIG_CREATE 등 추가 선행 필요" 체크리스트
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §1 노트 "구현 시 AUDIT_ACTIONS 에 AUTH_CONFIG_CREATE 등 상수를 먼저 추가해야 한다"
- 상세: 해당 선결 조건은 PR #543 (`fix(audit): audit action 상수 강제(G-01) + execution.re_run 개명(G-02)`, commit d1cf5cdc) 에서 `audit-action.const.ts` 신설 및 `AUDIT_ACTIONS` union SoT 완성이 main 에 병합됨. 현재 `AUDIT_ACTIONS` 에는 `AUTH_CONFIG_REVEAL` 만 있고 `AUTH_CONFIG_CREATE/UPDATE/DELETE/REGENERATE` 는 아직 없으나, PR #543 이 **상수 파일 자체를 마련**했으므로 추가 작업의 선결 인프라는 갖춰진 상태다. plan 파일이 "선결 필요" 로 남겨 둔 이유(상수 파일 미존재)는 해소됐다 — 추가 constants 만 append 하면 된다.
- 제안: `auth-config-webhook-followups.md` §1 의 "선결(audit 표기)" 노트에서 "audit-action.const.ts 신설" 부분을 완료 처리하고 "상수 파일 존재, AUTH_CONFIG_CREATE 등 4종 추가만 필요" 로 갱신 권장. 차단되는 항목 없음.

---

### [WARNING] plan 파일 미커밋 수정본과 실제 파일 상태 불일치

- target 위치: worktree `.claude/worktrees/audit-coverage-naming` 의 `plan/in-progress/auth-config-webhook-followups.md` (unstaged modified)
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` frontmatter `worktree: (unstarted)` / `status: backlog` (HEAD 기준)
- 상세: 현재 worktree 에는 `auth-config-webhook-followups.md` 에 대한 **미커밋 수정**이 있다. 수정본은 `worktree: .claude/worktrees/audit-coverage-naming (branch claude/auth-config-audit)` + `status: in-progress` 로 frontmatter 를 변경하나, HEAD 버전은 여전히 `worktree: (unstarted)` / `status: backlog` 다. 이 상태에서 `--impl-prep` 검토는 "착수 선언됨" 을 전제로 진행되나, 공식 plan 파일에는 미착수로 기록되어 있어 추적 정합성이 깨진다. 또한 `claude/auth-config-audit` 브랜치는 `claude/audit-coverage-naming` 와 동일 commit(d1cf5cdc)을 가리키며, `claude/audit-coverage-naming` 는 이미 PR #543 으로 squash-merge 됐다(PR state: MERGED).
- 제안: 구현 착수 전에 `auth-config-webhook-followups.md` 수정본을 커밋해 plan 의 `worktree`·`status` 를 공식화하거나, 새 worktree/branch 를 생성해 거기서 착수 선언 커밋을 남길 것. 현재 worktree 브랜치가 이미 main 에 머지된 상태이므로 새 branch 권장.

---

### [INFO] spec/5-system/1-auth.md §4.1 Planned 항목이 현 구현 의도와 정합

- target 위치: `spec/5-system/1-auth.md §4.1` Planned 테이블 — `auth_config.create, auth_config.update, auth_config.delete, auth_config.regenerate`
- 관련 plan: `plan/in-progress/auth-config-webhook-followups.md` §1
- 상세: 현재 spec §4.1 은 `auth_config.create/update/delete/regenerate` 를 **Planned** 로 표기하고 있고, `AUDIT_ACTIONS` 에는 이들 상수가 없다. 구현 착수 시 ① `AUDIT_ACTIONS` 에 4종 추가, ② `AuthConfigsService` 4개 메서드에 `record()` 추가, ③ spec §4.1 Planned→구현됨 이동의 3단계를 거쳐야 하며, 현재 spec 은 그 의도를 명시하고 있어 충돌 없음. 미해결 결정으로 남겨진 항목이 없다.
- 제안: 추적 목적 메모 수준. 구현 전 `--impl-prep` 게이트 자체는 BLOCK 사유 없음.

---

### [INFO] spec-sync-auth-gaps plan 과 중복 없음

- target 위치: `plan/in-progress/auth-config-webhook-followups.md` §1 (auth_config CRUD audit)
- 관련 plan: `plan/in-progress/spec-sync-auth-gaps.md`
- 상세: `spec-sync-auth-gaps.md` 는 LDAP/SAML 미구현만 추적하며, auth_config audit 기록 갭은 "본 spec 의 다른 미구현 갭은 `auth-config-webhook-followups.md` 가 추적" 으로 명시적으로 위임 처리되어 있다. 양 plan 의 범위가 중복되지 않는다.
- 제안: 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 탐색 결과:

**직접 충돌 후보 없음** — `auth-config-webhook-followups.md` §1 을 다루는 다른 active worktree 가 없다. `spec/5-system/1-auth.md` 를 수정한 마지막 브랜치(`claude/audit-coverage-naming`)가 이미 머지됐고 현재 작업 영역과 겹치는 active worktree 가 없다.

Stale 판정이 적용된 후보:

- `claude/audit-coverage-naming` (현 worktree 브랜치) — Step 1: git ancestor = ACTIVE (squash-merge라 hash 불일치), Step 2: PR #543 state = MERGED → **stale**. 현 worktree 에서 새 구현 착수 시 별 브랜치 필요.
- `claude/prod-fail-closed-guards` (spec/5-system/1-auth.md 최근 수정) — Step 1: ACTIVE (squash-merge), Step 2: PR #539 state = MERGED → **stale**.

두 브랜치 모두 stale. 이들의 worktree 가 활성으로 남아 있을 이유 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system` 구현 착수 전(--impl-prep) plan 정합성 관점에서 CRITICAL·차단급 충돌은 없다. `auth-config-webhook-followups.md` §1 의 선결 조건(AUDIT_ACTIONS 상수 파일 마련)은 PR #543 으로 이미 해소됐고, spec §4.1 의 Planned 항목과 구현 의도가 일치한다. 다만 현재 worktree 의 plan 파일이 미커밋 수정본(status: in-progress) 과 HEAD(status: backlog) 간 불일치 상태라 착수 선언을 공식화하지 않은 문제가 WARNING 수준으로 남는다. 또한 현 worktree 브랜치(`claude/audit-coverage-naming`)가 squash-merge 완료 상태이므로 실제 구현은 새 브랜치에서 진행해야 한다. worktree 충돌 후보 2건(`claude/audit-coverage-naming`, `claude/prod-fail-closed-guards`)은 모두 stale(squash-merge 완료) 로 판정해 skip했다.

---

## 위험도

LOW
