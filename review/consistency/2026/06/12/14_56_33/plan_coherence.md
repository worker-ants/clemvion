# Plan 정합성 검토 — spec/5-system/15-chat-channel.md

검토 모드: spec draft (--spec)
Target: `spec/5-system/15-chat-channel.md`

---

## 발견사항

### [INFO] auth-config-webhook-followups §2 의 chatChannel isActive 재검토 요청 — target spec 이 이미 명확히 정의
- **target 위치**: `spec/5-system/15-chat-channel.md` §5.5 "비활성 trigger (chatChannel 경로)" 행 + R-CC-12 (d)
- **관련 plan**: `plan/in-progress/auth-config-webhook-followups.md` §2 — "실제 spec ↔ 코드 불일치인지, 아니면 chat-channel 의 의도된 동작인지 chat-channel 도메인에서 재검토 필요"
- **상세**: `auth-config-webhook-followups §2` 는 `HooksService` 의 `!trigger.isActive → 410` 체크가 chatChannel 분기보다 먼저 실행되어 비활성 chatChannel 트리거가 202 대신 410 을 반환하는 문제를 "chat-channel 도메인 재검토" 로 남겼다. target spec §5.5 는 이미 "비활성 trigger (chatChannel 경로)" 행에서 202 Accepted + inbound 서명 검증 수행 후 `!trigger.isActive` 시 202 silent skip 으로 명시 정의했고 R-CC-12 (d) Rationale 에도 근거가 기술돼 있다. spec 의 의도는 명확히 결정된 상태이며 §2 의 "재검토" 의문은 이미 해소됐다. 남은 것은 `spec-sync-chat-channel-gaps.md` §2 의 코드 미구현 추적이다.
- **제안**: `auth-config-webhook-followups §2` 의 "재검토 필요" 문구를 "spec 에서 202 silent skip 으로 이미 확정 (§5.5 + R-CC-12 (d)). 코드 구현은 `spec-sync-chat-channel-gaps.md §2` 에서 추적" 으로 갱신 권장 (INFO — 차단 불요).

---

### [INFO] spec-sync-chat-channel-gaps.md 의 worktree `spec-sync-audit` — branch/worktree 모두 소멸
- **target 위치**: `spec-sync-chat-channel-gaps.md` frontmatter `worktree: spec-sync-audit`
- **관련 plan**: `plan/in-progress/spec-sync-chat-channel-gaps.md`
- **상세**: `spec-sync-audit` branch 가 로컬/원격 모두에 존재하지 않으며, `.claude/worktrees/` 에도 해당 디렉토리가 없다. Step 1 (merge-base ancestor) 검사 결과: ACTIVE (non-stale) — squash merge 후 branch 삭제 패턴 가능성. Step 2: `gh pr list --head spec-sync-audit` 결과 empty (PR 도 없음). Step 3 fallback: active 로 보수적 처리. 그러나 branch 와 worktree 물리 디렉토리가 모두 없는 상태이므로 실질적으로 이 plan 에서 `worktree: spec-sync-audit` 값은 stale sentinel 이다. plan 내 미완료 체크박스 4개 (CCH-CV-03 (b), §5.5 비활성 202, CCH-NF-03, rotate-bot-token 3필드) 가 추적되고 있으므로 plan 자체는 유효하다.
  - stale 판정 cascade: Step 1 — ACTIVE (비-ancestor), Step 2 — empty (PR 미존재), Step 3 fallback — active 처리
- **제안**: `spec-sync-chat-channel-gaps.md` frontmatter 의 `worktree: spec-sync-audit` 를 `worktree: (unstarted)` 또는 실제 작업 worktree 로 정정 권장. 미착수 항목이므로 `(unstarted)` 로 초기화 후 착수 시 worktree 배정.

---

### [INFO] target 의 §5.5 비활성 trigger 202 정의 — spec-sync-chat-channel-gaps §2 코드 미구현 추적 정합 확인
- **target 위치**: `spec/5-system/15-chat-channel.md` §5.5 "비활성 trigger (chatChannel 경로)" 행
- **관련 plan**: `plan/in-progress/spec-sync-chat-channel-gaps.md` §2
- **상세**: target spec 이 비활성 trigger 의 202 silent skip 을 명시하고, `spec-sync-chat-channel-gaps.md` 가 "코드 미구현" 으로 추적 중이다. target 이 이 행동을 결정하는 것은 plan 에서 "결정 필요" 로 열어둔 것을 우회하는 것이 아니라 — plan 은 코드 갭을 추적하는 것이며 spec 은 이미 정의했다. 정합 이상 없음. 메모로만 기록.
- **제안**: 이상 없음 (확인용 INFO).

---

### [INFO] chat-channel-discord-gateway / chat-channel-slack-socket-mode — v2 미결 결정, target spec 과 충돌 없음
- **target 위치**: `spec/5-system/15-chat-channel.md` R-CC-13, §3.1 CCH-AD-01
- **관련 plan**: `plan/in-progress/chat-channel-discord-gateway.md`, `plan/in-progress/chat-channel-slack-socket-mode.md`
- **상세**: 두 plan 은 v2 Gateway/Socket Mode 도입을 위한 "사용자 결정 필요" 진입 조건 (WebSocket 인프라 도입, R-D-3/R-S-3 번복 정당화 등) 이 미충족 상태로 backlog 에 있다. target spec 은 R-CC-13 에서 Discord v1 CCH-MP-01 부분 유예를 명시하고 있으며, v2 해소를 "후속 작업" 으로 열어두고 있다. target 이 이 v2 결정을 일방적으로 내리지 않으므로 충돌 없음. worktree 는 모두 `(unstarted)` — 경합 없음.
- **제안**: 이상 없음.

---

### [INFO] chat-channel-visual-ssr-png — 결정 #1 (SSR 라이브러리 선정) 미결, target spec 충돌 없음
- **target 위치**: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-04 ("v2 정책 SSR PNG")
- **관련 plan**: `plan/in-progress/chat-channel-visual-ssr-png.md` 결정 항목 #1 (SSR 라이브러리 선정, 사용자 escalate 대기)
- **상세**: target spec §3.3 CCH-MP-04 는 v2 SSR PNG 격상을 "v2 정책" 으로 명시하되 구체 라이브러리를 특정하지 않는다 — plan 의 미결 #1 을 일방적으로 결정하지 않음. worktree `(unstarted)`. 충돌 없음.
- **제안**: 이상 없음.

---

## Stale 으로 skip 한 worktree (의무)

worktree 충돌 후보로 식별된 항목 중 stale 판정 cascade 처리 결과:

| worktree | branch | 판정 |
|---|---|---|
| `audit-sot-hygiene-8fc5f1` | `claude/audit-sot-hygiene-8fc5f1` | Step 2 PR #552 MERGED → **stale** |
| `plan-cleanup-impl-done-4c9d96` | `claude/plan-cleanup-impl-done-4c9d96` | Step 2 PR #556 MERGED → **stale** |
| `pr4b-kb-embedding-retire` | `claude/pr4b-kb-embedding-retire` | Step 2 PR #558 MERGED → **stale** |
| `spec-audit-action-prose` | `claude/spec-audit-action-prose` | Step 2 PR #554 MERGED → **stale** |
| `spec-auth-hygiene` | `claude/spec-auth-hygiene` | Step 2 PR #560 MERGED → **stale** |
| `spec-ragsources-content` | `claude/spec-ragsources-content` | Step 2 PR #557 MERGED → **stale** |
| `test-code-http-hardening-10aad3` | `claude/test-code-http-hardening-10aad3` | Step 2 PR #555 MERGED → **stale** |
| `unified-model-mgmt-plan-close` | `claude/unified-model-mgmt-plan-close` | Step 2 PR #562 MERGED → **stale** |
| `code-node-followups-close-a30e7c` | `claude/code-node-followups-close-a30e7c` | Step 2 PR #565 MERGED → **stale** |
| `code-node-followups-finalize-f50a7d` | `claude/code-node-followups-finalize-f50a7d` | Step 2 PR #564 MERGED → **stale** |

위 9개 worktree 는 모두 PR 이 MERGED 상태 — squash merge 패턴으로 Step 1 ancestor 검사를 통과하지 못했을 뿐, 실제로는 main 에 포함된 상태다. `./cleanup-worktree-all.sh --yes --force` 실행 권장.

**`spec-sync-audit` (spec-sync-chat-channel-gaps.md frontmatter)**: branch 로컬/원격 모두 없음, worktree 디렉토리 없음. Step 1: ACTIVE (non-ancestor), Step 2: empty (PR 미존재), Step 3: active 로 보수적 처리. 실질적으로 defunct worktree 참조 — plan frontmatter 정정 권장 (위 INFO 항목 참조).

---

## 요약

`spec/5-system/15-chat-channel.md` 는 `pending_plans` 4건 (`chat-channel-discord-gateway`, `chat-channel-slack-socket-mode`, `chat-channel-visual-ssr-png`, `spec-sync-chat-channel-gaps`) 과 정합 이상 없다. target spec 이 v2 결정 (Discord Gateway, Slack Socket Mode, SSR PNG 라이브러리 선정) 을 일방적으로 내리지 않으며, `spec-sync-chat-channel-gaps` 의 코드 미구현 4건 (`CCH-CV-03 (b)`, `§5.5 비활성 202`, `CCH-NF-03`, rotate-bot-token 3필드)은 spec 이 이미 의도를 확정한 상태에서 구현 갭을 추적 중이다. `auth-config-webhook-followups §2` 의 "chat-channel 도메인 재검토 필요" 는 target spec 이 이미 §5.5 + R-CC-12 (d) 로 명확히 답하고 있으므로 plan 문구 갱신이 권장된다. worktree 충돌 후보 10건 중 stale 10건 skip (all MERGED), active 0건 분석.

---

## 위험도

NONE

STATUS: OK
