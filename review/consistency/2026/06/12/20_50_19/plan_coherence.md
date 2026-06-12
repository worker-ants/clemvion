# Plan 정합성 검토 — spec-draft-refactor-04-security-drift

검토 모드: --spec  
Target: `plan/in-progress/spec-draft-refactor-04-security-drift.md`  
기준 branch: main (HEAD `0dba8de5`)  
Active worktrees: `chat-channel-followups-residual-1be5d3`, `chat-channel-gaps-e5e3e8`, `refactor-04-security-286de9`

---

## 발견사항

- **[WARNING]** `refactor/04-security.md` 에 미착수 체크박스가 남아있어 target 과 상태 불일치
  - target 위치: target plan 본문 전체 — M-5·m-3·M-3·M-6·M-1·m-2 를 "이미 구현 완료"로 전제
  - 관련 plan: `plan/in-progress/refactor/04-security.md` — M-1(`- [ ] 미착수`), M-3(`- [ ] 결정 대기 (사용자)`), M-5(`- [ ] 미착수`), M-6(`- [ ] 미착수`), m-2(`- [ ] 미착수`), m-3(`- [ ] 미착수`)
  - 상세: PR #570(OPEN)은 위 6건을 구현하고 SPEC-DRIFT 후속을 planner 에 위임한다고 선언했다. 그러나 `refactor/04-security.md` 의 체크박스는 아직 `- [ ]` 상태 그대로다. Target plan 이 해당 구현을 "완료"로 전제하고 spec 문서화만 하는 것은 PR #570 내용상 올바르나, 04-security 인덱스를 읽는 사람이 "미착수·결정 대기"로 오해하는 불일치가 있다. 특히 M-3 의 `결정 대기 (사용자)` 주석은 PR #570 이 이미 옵션 B(safe-regex)로 확정·구현했음에도 남아있어 혼동을 준다.
  - 제안: target plan 머지 후 (또는 머지 전 별도 커밋으로) `refactor/04-security.md` 의 M-1·M-3·M-5·M-6·m-2·m-3 를 `- [x] ✅ 완료 (PR #570)` 로 갱신한다. M-3 의 "결정 대기 (사용자)" 주석에는 "사용자 승인 옵션 B (safe-regex) 로 구현 완료" 를 추기한다.

- **[WARNING]** `auth-config-webhook-followups.md §3` IP 정책 항목이 target 완료 후 후속 갱신 필요
  - target 위치: 변경 내역 §1 — `spec/5-system/1-auth.md §2.3` 에 CF-Connecting-IP opt-in 정책(TRUST_CF_CONNECTING_IP) 작성
  - 관련 plan: `plan/in-progress/auth-config-webhook-followups.md §3` — "spec/5-system/12-webhook.md 에 IP 추출 정책 (CF-Connecting-IP → X-Forwarded-For → req.ip) 명시 또는 `1-auth.md §2.3` cross-reference"
  - 상세: target 이 1-auth.md §2.3 에 IP 추출 정책의 SoT 를 기록하면, auth-config-webhook-followups §3 의 "또는 1-auth.md §2.3 cross-reference" 경로가 충족된다. 단, 해당 plan 체크박스는 완료로 표기되지 않은 채 남는다. target 이 SoT 를 작성하는 것은 올바른 선행 작업이나, 이후 §3 담당자가 12-webhook.md 에서 §2.3 cross-reference 1줄만 추가하면 되는 easier path 임을 plan 에 명시해야 충돌 방지가 된다.
  - 제안: target plan 완료 시 또는 직후 `auth-config-webhook-followups.md §3` IP 항목에 "1-auth.md §2.3 SoT 기록 완료(spec-draft-refactor-04-security-drift) — 12-webhook.md 에 cross-reference 1줄 추가만 잔여" 주석을 추가한다.

- **[INFO]** `spec-fix-prod-guards-prose.md` 도 `spec/5-system/1-auth.md §Rationale` 를 수정 대상으로 포함
  - target 위치: 변경 내역 §1 — `1-auth.md` Rationale 2.3.B 신설
  - 관련 plan: `plan/in-progress/spec-fix-prod-guards-prose.md` SPEC-DRIFT 항목 — `1-auth.md §Rationale "Production fail-closed 가드"` 에 OAUTH_STUB_MODE·LLM_STUB_MODE bullet 추가
  - 상세: 두 plan 이 같은 파일의 `## Rationale` 섹션에 쓰지만 subsection 이 다르다 — target 은 신규 "Rationale 2.3.B"(SameSite/CSRF/CF-IP 근거), spec-fix-prod-guards-prose 는 기존 "Production fail-closed 가드" 항목 수정. 내용 충돌은 없다. spec-fix-prod-guards-prose 의 worktree 가 `(stale — prod-fail-closed-guards 제거됨)` 로 표기돼 실제 착수 여부가 불명확하므로, 동시 편집 시 rebase 로 충돌을 해소하면 된다.
  - 제안: 두 plan 이 같은 PR 에 포함되면 한 번에 처리. 별도 PR 시 §Rationale 편집 전 최신 main 을 rebase 하여 양쪽 subsection 이 공존하는지 확인한다.

- **[INFO]** `spec-sync-websocket-protocol-gaps.md` 의 `notifications:{userId}` emit 미구현 표기와 target 의 "fail-closed 선제" 표기 정합
  - target 위치: 변경 내역 §2 — `notifications:{userId}` 채널을 소유검증 표에 추가, "emit 미구현이나 fail-closed 선제"
  - 관련 plan: `plan/in-progress/spec-sync-websocket-protocol-gaps.md` 미구현 항목 — "`notifications:{userId}` 채널의 `notification.new` emit 경로 (채널 prefix 만 등록, emit 코드 부재, §4.4)"
  - 상세: target 의 "emit 미구현" 표기가 spec-sync-websocket-protocol-gaps 의 미구현 항목과 일치한다. target 이 해당 채널을 소유검증 표에 추가(authorizer 등록)함으로써 "§3.3 채널 목록 누락" 부분은 해소되고, emit 부재 자체는 여전히 미구현 항목으로 남는다. 정합하며 충돌 없음.
  - 제안: target 완료 후 spec-sync-websocket-protocol-gaps 의 해당 항목에 "§3.3 채널 등록은 spec-draft-refactor-04-security-drift 로 완료 — emit 경로 구현만 잔여" 주석 추가.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 중 stale 판정으로 분석에서 제외한 항목:

- `claude/auth-config-audit` (plan: `auth-config-webhook-followups.md`) — Step 1: ACTIVE (non-ancestor of main). Step 2: PR `claude/auth-config-audit` 상태 **MERGED** → stale (squash merge). 워크트리 디렉토리 `.claude/worktrees/audit-coverage-naming` 미존재 확인.
- `claude/prod-fail-closed-guards` (plan: `prod-fail-closed-guards.md`) — Step 1: branch 로컬 미존재. Step 2: PR 상태 **MERGED** → stale. 워크트리 디렉토리 미존재 확인.
- `claude/http-ssrf-all-auth` (plan: `http-ssrf-all-auth.md`) — Step 1: ACTIVE (non-ancestor). Step 2: PR 상태 **MERGED** → stale (squash merge).
- `spec-sync-audit` / `claude/spec-sync-audit` (plan: `spec-sync-websocket-protocol-gaps.md`, `spec-sync-structural-followups.md`) — Step 1: branch 로컬 미존재. Step 2: PR `claude/spec-sync-audit` 상태 **MERGED** → stale.

위 4개 worktree/branch 는 이미 머지된 PR 의 정리되지 않은 잔재다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

Target plan(`spec-draft-refactor-04-security-drift`)은 PR #570(OPEN)에서 구현된 보안 항목 6건의 spec 후행 정정 작업으로, 새 제품 결정 없이 기존 합의·구현된 동작을 문서화한다. 미해결 결정 우회나 active worktree 와의 파일 충돌은 없다. 주요 정합 이슈는 두 가지 WARNING 이다: (1) `refactor/04-security.md` 의 M-1/M-3/M-5/M-6/m-2/m-3 체크박스가 PR #570 구현에도 불구하고 미착수 상태 그대로여서 plan 상태 불일치 — target 완료 시 일괄 갱신 필요; (2) `auth-config-webhook-followups.md §3` IP 정책 항목이 target 완료 후 "12-webhook.md cross-reference만 잔여"로 갱신되어야 후속 담당자 혼동이 없다. worktree 충돌 후보 4건은 Step 2 GitHub PR MERGED 로 모두 stale 판정되어 분석에서 제외했다 (active 2건 분석, 충돌 없음).

---

## 위험도

LOW
