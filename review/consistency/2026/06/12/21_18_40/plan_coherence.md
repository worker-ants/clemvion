# Plan 정합성 검토 결과

검토 모드: 구현 완료 후 (--impl-done, scope=spec/5-system, diff-base=origin/main)
Target 문서: `spec/5-system/` (worktree `refactor-04-security-286de9`)

---

## 발견사항

### [WARNING] `spec/5-system/1-auth.md §1.5.D` Rationale 신설 — `security-backlog-invitation-token-hash.md` 의 "사용자 결정 필요" 항목과 충돌

- **target 위치**: `spec/5-system/1-auth.md`, 추가된 `### 1.5.D — 워크스페이스 초대 토큰을 raw 로 저장하는 이유 (vs 이메일·재설정 토큰의 SHA-256 해시)` 섹션 (Rationale 블록 내, diff +행)
- **관련 plan**: `plan/in-progress/security-backlog-invitation-token-hash.md` §작업 범위 step 1 — "`spec/5-system/1-auth.md §1.5.D` Rationale 검토 — 해시 저장 전환 결정 여부 명시", §주의사항 — "기존 미만료 토큰 처리 전략 확정 없이 자동 수정 금지 (사용자 결정 필요)"
- **상세**: `security-backlog-invitation-token-hash.md` 는 §1.5.D Rationale 섹션을 "해시 저장 전환 결정 여부 명시"의 결과물로 기획하며, "사용자 결정 필요"를 명시 주의사항으로 걸어 두었다. 이번 diff 는 §1.5.D 를 "raw 로 저장하는 이유" — 즉 raw 유지 결정을 정당화하는 방향으로 미리 작성했다. 이는 백로그 plan 이 사용자에게 유보해 둔 결정(raw 유지 vs 해시 전환)을 일방적으로 raw 유지로 확정하는 효과를 낳는다. 실질 보안 위험도(현재 완화 수단 충분)나 설계 우선순위(priority: low)를 고려하면 충돌 강도가 높지 않지만, plan 이 명문화한 "사용자 결정 필요" 절차를 우회한 것은 플랜 정합성 위반이다.
- **제안**: (A) 이번 §1.5.D 신설을 "raw 유지 결정 확정"으로 간주하고 `security-backlog-invitation-token-hash.md` 를 "raw 유지 승인, 해시 전환 불진행"으로 갱신 후 `plan/complete/` 이동 또는 백로그 보관; 또는 (B) §1.5.D 내용을 "현재 raw 저장 동작 설명 + 해시 전환 검토 여지 명시"로 톤을 조정해 backlog plan 의 결정 공간을 보존.

---

### [CRITICAL] `hooks.service.ts`·`hooks.service.spec.ts` 동시 수정 — active worktree `chat-channel-gaps-e5e3e8` 와 경합

- **target 위치**: `codebase/backend/src/modules/hooks/hooks.service.ts` 및 `hooks.service.spec.ts` (refactor-04-security-286de9 diff 포함)
- **관련 plan**: `plan/in-progress/spec-sync-chat-channel-gaps.md` (worktree `chat-channel-gaps-e5e3e8`, branch `claude/chat-channel-gaps-e5e3e8`, PR OPEN)
- **상세**: `refactor-04-security-286de9` 는 `hooks.service.ts` 파일 하단 `extractClientIp` 함수를 `shouldTrustCfConnectingIp()` opt-in 분기로 수정한다(refactor 04 m-3). `chat-channel-gaps-e5e3e8` 는 같은 파일의 중단 `handleChatChannelWebhook` 내 `isActiveExecution` → `getActiveExecutionStatus` 리팩터링을 포함한다(CCH-CV-03). 논리적 hunk 충돌은 없으나 양 worktree 가 동일 파일을 수정 중이므로 머지 순서에 따라 git conflict 가 발생한다. `hooks.service.spec.ts` 도 양쪽이 모두 수정하므로 테스트 파일 병합 충돌 가능성이 높다. stale 판정 cascade: Step 1 ACTIVE, Step 2 PR OPEN → **active worktree 로 확인**.
- **제안**: 두 PR 중 하나를 먼저 머지한 뒤 나머지가 main rebase 후 conflict 재해소. `chat-channel-gaps-e5e3e8` 가 PR OPEN 심사 중이므로 병합 순서를 사전 조율해야 한다.

---

### [INFO] `spec-fix-prod-guards-prose.md` — `spec/5-system/1-auth.md` 추가 수정 예정, hunk 비중복

- **target 위치**: `spec/5-system/1-auth.md` (이번 diff 는 §2.1/§2.3/Rationale 2.3.B 수정)
- **관련 plan**: `plan/in-progress/spec-fix-prod-guards-prose.md` (worktree: stale — prod-fail-closed-guards 제거됨; W5/W8/W9/W10+SPEC-DRIFT 미착수) — SPEC-DRIFT 항목은 `1-auth.md §Rationale "Production fail-closed 가드"` 내 OAUTH_STUB/LLM_STUB 불릿 추가를 다룬다.
- **상세**: 이번 diff 는 `1-auth.md` 의 §2.1·§2.3·§Rationale 2.3.B 를 수정하며, `spec-fix-prod-guards-prose.md` 가 예정한 `§Rationale "Production fail-closed 가드"` 섹션과는 다른 위치다. hunk 중복 없음. 단 동일 파일을 후속 plan 도 수정할 예정이므로 `spec-fix-prod-guards-prose.md` 착수 시 rebase 기준 diff 확인 필요.
- **제안**: `spec-fix-prod-guards-prose.md` 착수 전 main 최신 기준으로 `1-auth.md` rebase 확인.

---

### [INFO] `auth-config-webhook-followups.md` worktree branch `claude/auth-config-audit` — stale skip

- Step 1: ACTIVE (merge-base ancestor 아님), Step 2: PR #547 MERGED → **stale**. 이 branch 의 `1-auth.md` §4.1 수정은 이미 main 에 포함. 이번 target diff 와 §4.1 hunk 경합 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보 검사 결과:

| worktree | branch | 판정 |
|----------|--------|------|
| `audit-coverage-naming` (물리 디렉토리 없음) | `claude/auth-config-audit` | Step 1 ACTIVE / Step 2 PR #547 MERGED → **stale** |
| `chat-channel-followups-residual-1be5d3` | `claude/chat-channel-followups-residual-1be5d3` | Step 1 ACTIVE / Step 2 PR MERGED → **stale**. `spec/5-system` 파일 미수정이라 §5번 충돌 후보 아님 |

`chat-channel-followups-residual-1be5d3` worktree 디렉토리는 물리적으로 존재하나 PR MERGED 상태. 활성으로 남아있을 이유가 없으면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system` 범위 이번 spec drift 정정(refactor 04 M-5·M-6·m-3)은 전반적으로 in-progress plan 들과 정합하다. 두 건의 주의 사항이 있다. 첫째(WARNING), `security-backlog-invitation-token-hash.md` 가 "사용자 결정 필요"로 유보해 둔 §1.5.D Rationale 항목을 이번 diff 가 "raw 유지 결정"으로 기정사실화하는 방향으로 작성했다 — plan 절차 우회이므로 해당 backlog plan 갱신 또는 §1.5.D 톤 조정이 필요하다. 둘째(CRITICAL), `hooks.service.ts` 및 `hooks.service.spec.ts` 를 active worktree `chat-channel-gaps-e5e3e8` (PR OPEN)와 이번 worktree 가 동시에 수정 중이라 머지 순서 조율 및 rebase 후 재검증이 필요하다. `spec/5-system` 내 spec 파일 hunk 중복은 없음. worktree 충돌 후보 검토: stale 2건 skip(`audit-coverage-naming` PR #547 MERGED, `chat-channel-followups-residual-1be5d3` PR MERGED), active 1건(`chat-channel-gaps-e5e3e8`) CRITICAL 분석.

---

## 위험도

MEDIUM
