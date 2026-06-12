### 발견사항

- **[CRITICAL]** `pr4b-kb-embedding-retire` (PR #558 OPEN) 의 `spec/5-system/1-auth.md` 기저가 stale — target 을 덮어쓰는 위험
  - target 위치: `spec/5-system/1-auth.md §4.1 Planned 표` (라인 366) + `Rationale §4.1.A` (라인 593–609)
  - 관련 plan: `pr4b-kb-embedding-retire` 워크트리 (PR #558, OPEN). `git diff HEAD claude/pr4b-kb-embedding-retire -- spec/5-system/1-auth.md` 로 확인.
  - 상세: PR #552 (`audit-sot-hygiene-8fc5f1`, squash-merge) 가 main 에 `spec/5-system/1-auth.md §4.1` 을 갱신했다 — Planned 인증 액션을 `password_change, 2fa_enable/disable`(dot-prefix 없음)에서 `user.password_changed`·`user.2fa_enabled`·`user.2fa_disabled` 로 정규화하고 Rationale §4.1.A 를 신설했다. 그런데 `pr4b-kb-embedding-retire` 는 PR #552 가 main 에 들어오기 **이전** 의 `1-auth.md` 를 베이스로 삼고 있다. squash merge 로 인해 `git merge-base --is-ancestor` Step 1 은 ACTIVE 를 반환하지만 PR #552 는 이미 MERGED 상태다. 따라서 PR #558 이 rebase 없이 그대로 머지되면:
    - `§4.1 Planned 표`의 인증 액션 행이 구 표기(`password_change, 2fa_enable/disable`)로 되돌아간다.
    - `Rationale §4.1.A` 전체 섹션(dot-prefix 통일 근거)이 삭제된다.
    - `§4.1 읽기측 계약` 블록쿼트도 삭제된다.
    - 이 세 변경은 `spec-code-cross-audit-2026-06-10.md G-01/G-02` 에서 확정한 규약 결정을 무효화한다.
  - 제안: PR #558 (`pr4b-kb-embedding-retire`) 을 main 에 **rebase** 한 뒤 `1-auth.md` 충돌을 해소하고 target 의 §4.1.A 를 보존한다. 머지 담당자가 `git rebase origin/main` 후 diff 를 확인해야 한다.

- **[WARNING]** `auth-config-webhook-followups.md §3` 에서 요청한 `POST /api/auth-configs/:id/reveal` 의 §5 API 엔드포인트 표 추가가 target 에 반영되지 않았음
  - target 위치: `spec/5-system/1-auth.md §5 API 엔드포인트` 표 (라인 424–459)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3 spec 보완 — 첫 번째 불릿`
  - 상세: `auth-config-webhook-followups.md §3` 은 `§5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행이 없음을 지적하며 project-planner 보완을 요청했다. target(`spec/5-system/1-auth.md`) 의 §5 표를 확인하면 해당 행이 여전히 없다 — 마지막 라인인 "초대 발송·재발송..." 참조 주석만 있을 뿐, reveal 엔드포인트 자체는 §3.2 Rationale 에만 언급된다. plan §3 의 이 항목은 미해소 상태이며 본 target draft 에서 해소할 기회가 있었으나 누락됐다.
  - 제안: target `§5 API 엔드포인트` 표에 `POST /api/auth-configs/:id/reveal` 행 추가 (설명: "Auth Config 평문 노출. Admin+. 비밀번호 재확인 + audit 기록 필수. `spec §3.2` Auth Config Reveal 권한 분리 참조"). `auth-config-webhook-followups.md §3` 의 해당 불릿을 체크 처리한다.

- **[WARNING]** `auth-config-webhook-followups.md §3` 의 IP 추출 정책·fail-closed 명시 요청이 `spec/5-system/12-webhook.md` 대상이나 cross-reference 를 담당하는 `1-auth.md §2.3` 에도 아직 반영되지 않음
  - target 위치: `spec/5-system/1-auth.md §2.3 세션 정책` 클라이언트 IP 행 (라인 300)
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3 — 두 번째 불릿`
  - 상세: plan §3 는 IP 추출 정책(CF-Connecting-IP → X-Forwarded-For → req.ip)을 `1-auth.md §2.3` 에 cross-reference 로 추가하거나 `12-webhook.md` 에 명시하라고 요청했다. target `§2.3` 의 "클라이언트 IP" 행(라인 300)은 이미 해당 폴백 순서를 기술하고 있으나, ip_whitelist fail-closed 동작("clientIp 불명 시 거부")이 명시되지 않았다. plan 이 기대한 fail-closed 동작 명시 및 webhook 측 cross-reference 는 target 에서 해소되지 않았다.
  - 제안: `auth-config-webhook-followups.md §3` 이 요청한 항목 중 `1-auth.md §2.3` 관련 부분(ip_whitelist fail-closed 동작)은 target 에서 보완 가능하다. `12-webhook.md` 대상 항목은 별도 spec 편집으로 해소한다.

- **[INFO]** `security-backlog-invitation-token-hash.md` 가 `spec_impact: spec/5-system/1-auth.md` 를 선언하고 있으나 아직 unstarted — 충돌 없음, 추적용
  - target 위치: `spec/5-system/1-auth.md §1.5.D Rationale` (라인 591–597)
  - 관련 plan: `plan/in-progress/security-backlog-invitation-token-hash.md`
  - 상세: 본 plan 은 초대 토큰 raw 저장 → SHA-256 해시 전환을 검토하는 백로그이며 착수 전 사용자 결정이 선행돼야 한다고 명시돼 있다. target 의 §1.5.D Rationale 는 raw 저장 유지 근거를 상세히 기술하며 plan 이 기대하는 §1.5.D 재검토 대상 텍스트를 보존하고 있다. 충돌은 없으나, target 에 §1.5.D 가 변경되는 경우 plan 과 연동이 필요함을 주의한다.

---

### Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 3건 중 2건이 stale 판정으로 skip:

- `audit-sot-hygiene-8fc5f1` (branch `claude/audit-sot-hygiene-8fc5f1`) — Step 1: ACTIVE (squash merge 로 hash 불일치), Step 2: PR #552 MERGED → **stale**
- `test-code-http-hardening-10aad3` (branch `claude/test-code-http-hardening-10aad3`) — Step 1: ACTIVE (squash merge), Step 2: PR #555 MERGED → **stale**

두 worktree 모두 이미 main 에 합류된 squash merge 의 정리되지 않은 worktree. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

활성으로 분석한 1건:
- `pr4b-kb-embedding-retire` (branch `claude/pr4b-kb-embedding-retire`) — Step 1: ACTIVE, Step 2: PR #558 OPEN → active. CRITICAL 발견사항 참조.

---

### 요약

`spec/5-system/1-auth.md`(target)의 내용은 `spec-sync-auth-gaps.md`(LDAP/SAML 미구현 추적)·`auth-config-webhook-followups.md` 와 전반적으로 정합하며, §1 완료(PR #547) 이후 남은 §2~4 미착수 항목을 조용히 방치하고 있는 상태다. 다만 CRITICAL 이슈가 1건 있다: OPEN PR #558(`pr4b-kb-embedding-retire`)이 PR #552 squash-merge 이전 베이스의 `1-auth.md` 를 포함하고 있어 머지 시 §4.1.A Rationale 삭제 + Planned 인증 액션 표 구 표기 회귀가 발생한다. WARNING 2건은 `auth-config-webhook-followups.md §3` 의 미해소 spec 보완 요청(reveal 엔드포인트 §5 표 누락, IP 정책 fail-closed 명시 누락)이다. worktree 충돌 후보 3건 중 stale 2건 skip, active 1건 분석.

---

### 위험도

HIGH
