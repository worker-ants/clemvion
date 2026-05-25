# Plan 정합성 검토 결과

검토 모드: 구현 착수 전 검토 (--impl-prep, scope=spec/5-system/15-chat-channel.md)
검토 대상: `spec/5-system/15-chat-channel.md`
검토 일시: 2026-05-25

---

## 발견사항

### [INFO] spec frontmatter `pending_plans` 에 이미 머지된 plan 2건 잔류

- target 위치: `spec/5-system/15-chat-channel.md` lines 18-25 (frontmatter `pending_plans` 필드)
- 관련 plan: `plan/in-progress/chat-channel-error-notify.md`, `plan/in-progress/chat-channel-outbound-still-broken.md`
- 상세: spec 의 `pending_plans` 목록에 `chat-channel-error-notify.md` 가 기재되어 있으나, 해당 plan 의 worktree 브랜치 `claude/chat-channel-error-notify-6d37ec` 는 Step 2 PR state 검사 결과 MERGED 상태. `chat-channel-outbound-still-broken.md` 의 worktree `chat-channel-outbound-still-broken-afe293` 도 MERGED. 두 plan 이 다루던 CCH-ERR-* 요구사항과 outbound 진단/fix 내용은 이미 PR #322 / #319 / #323 을 통해 spec 및 codebase 에 반영 완료 (spec line 94-106 의 §3.5 CCH-ERR-* 절 확인). `pending_plans` 는 갱신되지 않아 stale 상태.
- 제안: 다음 project-planner 사이클에서 spec frontmatter `pending_plans` 에서 `chat-channel-error-notify.md` 와 `chat-channel-outbound-still-broken.md` 를 제거. 두 plan 파일도 `plan/complete/` 로 `git mv` 처리 필요 (chat-channel-outbound-still-broken 은 plan 자체가 이미 [x] 체크리스트 완료 상태임을 확인).

---

### [INFO] `spec-draft-chat-channel-error-notify.md` plan 이 `status: draft` 로 잔류

- target 위치: `plan/in-progress/spec-draft-chat-channel-error-notify.md` (frontmatter `status: draft (consistency-check pending)`)
- 관련 plan: `plan/in-progress/spec-draft-chat-channel-error-notify.md`
- 상세: 이 draft plan 은 worktree `chat-channel-error-notify-6d37ec` 를 사용하며 `target_specs` 에 `spec/5-system/15-chat-channel.md` 를 포함. 그러나 해당 worktree 브랜치는 MERGED. draft 에서 제안한 CCH-ERR-* 절은 현재 spec §3.5 (lines 94-106) 에 이미 반영됨. spec-draft plan 자체가 정리되지 않은 채 `in-progress` 에 잔류.
- 제안: `plan/in-progress/spec-draft-chat-channel-error-notify.md` 를 `plan/complete/` 로 이동하거나 삭제. 본 draft 의 내용은 spec 에 이미 반영 완료.

---

### [INFO] `chat-channel-form-native-modal.md` 의 미해결 진입 조건 — 현재 impl-prep 범위와 직교

- target 위치: `spec/5-system/15-chat-channel.md` §3.3 CCH-MP-01 (line 77), §4.1 `uiMapping.formMode` (line 211), `spec/conventions/chat-channel-adapter.md` R4
- 관련 plan: `plan/in-progress/chat-channel-form-native-modal.md`
- 상세: `chat-channel-form-native-modal.md` 는 Convention §4 R4 ("Form 다단계 시퀀스 강제") 번복을 진입 조건으로 가지며, 세 가지 unresolved 체크리스트가 모두 미완료 (`[ ]`). 현재 spec 의 `CCH-MP-01` 은 `render_form` 을 명시적으로 "별 plan 추적" 으로 제외하고 있으며, Convention R4 가 multi_step 강제를 결정으로 유지하고 있다. 이는 충돌이 아니라 의도적 deferred 분리. 단, impl-prep 대상자가 Form 관련 구현 (CCH-MP-03 또는 `formMode`) 을 착수한다면 `chat-channel-form-native-modal.md` 의 진입 조건 미해결 상태가 설계 결정 gap 이 됨.
- 제안: 본 impl-prep 의 구현 범위가 Form / native modal 과 관련 없다면 영향 없음. Form 관련 구현 착수 예정이라면 사용자에게 `chat-channel-form-native-modal.md` 의 세 진입 조건 결정을 먼저 요청하고, Convention R4 번복 여부를 합의한 후 착수.

---

## Stale 으로 skip 한 worktree (의무 — 0건이어도 명시)

worktree 충돌 후보 중 §worktree stale 판정 으로 skip 된 항목:

- `chat-channel-outbound-still-broken-afe293` (branch `claude/chat-channel-outbound-still-broken-afe293`) — Step 1: ACTIVE (ancestor 아님), Step 2: PR MERGED
- `fix-chat-channel-dispatcher-and-cafe24-warn-68da78` (branch `claude/fix-chat-channel-dispatcher-and-cafe24-warn-68da78`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-error-notify-6d37ec` (branch `claude/chat-channel-error-notify-6d37ec`) — Step 1: ACTIVE, Step 2: PR MERGED
- `telegram-chat-channel-spec-polish-49c49b` (branch `claude/telegram-chat-channel-spec-polish-49c49b`) — Step 1: ACTIVE, Step 2: PR MERGED
- `trigger-list-chat-channel-ui-d0c4a3` (branch `claude/trigger-list-chat-channel-ui-d0c4a3`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-runtime-fix-ed7061` (branch `claude/chat-channel-runtime-fix-ed7061`) — Step 1: ACTIVE, Step 2: PR MERGED
- `chat-channel-template-render-outbound-2f8164` (branch `claude/chat-channel-template-render-outbound-2f8164`) — Step 1: ACTIVE, Step 2: PR MERGED
- `telegram-carousel-button-click-5b52c1` (branch `claude/telegram-carousel-button-click-5b52c1`) — Step 1: ACTIVE, Step 2: PR MERGED
- `undici-autoselectfamily-b938d3` (branch `claude/undici-autoselectfamily-b938d3`) — Step 1: ACTIVE, Step 2: PR MERGED
- `update-logo-and-favicon-cb7b91` (branch `claude/update-logo-and-favicon-cb7b91`) — Step 1: ACTIVE, Step 2: PR MERGED
- `execution-context-rehydration-race-b9093d` (branch `claude/execution-context-rehydration-race-b9093d`) — Step 1: STALE (ancestor 검사 통과)
- `chat-channel-form-template-render-fix-82662a` (branch `claude/chat-channel-form-template-render-fix-82662a`, **현재 impl-prep 의 worktree**) — Step 1: STALE (main HEAD 와 동일 커밋 07398ea8)

위 worktree 들이 활성으로 남아있을 이유가 없다면 `./cleanup-worktree-all.sh --yes --force` 실행 권장.

---

## 요약

`spec/5-system/15-chat-channel.md` 는 현재 시점 (main HEAD 07398ea8, PR #328 반영) 기준으로 미해결 결정이 없고, active worktree 가 동시에 손대는 영역도 없다. 모든 chat-channel 관련 worktree 브랜치 (충돌 후보 12건) 는 MERGED PR 확인으로 stale 판정되어 §5번 검토 대상에서 전원 skip 했다. CCH-ERR-*, CCH-AD-07, CCH-MP-06, CCH-MP-01 presentations[] 등 최근 spec 변경은 모두 main 에 반영 완료. 잔여 INFO 사항은 (1) spec frontmatter `pending_plans` 2건 stale, (2) `spec-draft-chat-channel-error-notify.md` draft plan in-progress 잔류, (3) `chat-channel-form-native-modal.md` 의 form native modal 진입 조건 미해결 (현재 impl-prep 범위가 Form 미포함이면 무관) 이며, 구현 착수를 차단하는 CRITICAL / WARNING 발견 없음. worktree 충돌 후보 12건 중 stale 12건 skip, active 0건 분석.

---

## 위험도

NONE
