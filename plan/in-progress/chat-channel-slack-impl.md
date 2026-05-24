---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: developer
status: in-progress
---

# Slack Chat Channel Adapter — 구현

본 plan 은 [`spec/4-nodes/7-trigger/providers/slack.md`](../../spec/4-nodes/7-trigger/providers/slack.md) 의 Slack adapter 를 backend / frontend 에 구현. spec 단계는 [`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) + [`plan/complete/spec-chat-channel-inbound-signing-rename.md`](../complete/spec-chat-channel-inbound-signing-rename.md) 가 완료.

사용자 결정 (2026-05-24): spec PR push 없이 본 worktree 에 stacked 로 impl 진행. push 는 사용자 별도 명령 시.

## 진입 조건

- [x] [`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) — local main 기준 complete (PR push 는 별도)
- [x] [`plan/complete/spec-chat-channel-inbound-signing-rename.md`](../complete/spec-chat-channel-inbound-signing-rename.md) — naming 통합 완료
- [x] 사용자가 Slack impl 진행 명시적 결정 (2026-05-24)
- [x] worktree — `spec-slack-discord-chat-channel-bb4d35` 에 stacked 진입 (spec 작업과 같은 branch)

## 참조

- **Spec SoT**: [`spec/4-nodes/7-trigger/providers/slack.md`](../../spec/4-nodes/7-trigger/providers/slack.md)
- **공통 인터페이스**: [`spec/conventions/chat-channel-adapter.md`](../../spec/conventions/chat-channel-adapter.md)
- **시스템 spec**: [`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md)
- **Template plan**: [`plan/complete/chat-channel-impl.md`](../complete/chat-channel-impl.md) (Telegram 의 5 phase PR-A~E 구조 follow)

## Phase 구조 (Telegram template follow)

### Phase 0 — 사전 검토 ✅
- [x] `/consistency-check --impl-prep spec/4-nodes/7-trigger/providers/slack.md` 호출 — review/consistency/2026/05/24/12_06_30/. BLOCK: NO (CRITICAL 3건은 모두 false positive)
- [x] W-1 spec patch (botIdentity.teamId Convention 추가)

### Phase 1 — Foundation ✅ (commit 1da8e483)
- [x] `SlackAdapter` skeleton + `SlackClient` HTTP wrapper + types
- [x] `ChannelAdapterRegistry` 에 'slack' 등록
- [x] `slack-signing.ts` HMAC-SHA256 검증 (constant-time + 5분 replay window) + 13 test

### Phase 2 — Inbound (parseUpdate + auth) ✅ (commit 7b31269a)
- [x] `slack-update.parser.ts` — Events API / Interactivity / Slash Commands 3종 envelope 분기 (pure)
- [x] DM-only 필터 + bot/subtype 무시 + idempotencyKey 분기 (event_id / trigger_id)
- [x] file_shared mimeType placeholder + R-S-7 normative 흐름
- [x] `setupChannel` (auth.test → botIdentity + teamId 캐시, issuedInboundSigning 비움)
- [x] `ChatChannelInboundAuthenticator.verify` 에 Slack 분기 — HMAC-SHA256 검증
- [x] `HooksService` rawBody 전달 + url_verification handshake (`{ challenge }` 200 응답)
- [x] `HooksController` 가 challenge 케이스 root-level JSON 직접 응답 (TransformInterceptor 우회)

### Phase 3 — Outbound (renderNode + sendMessage) ✅
- [x] `slack-message.renderer.ts` — 5종 EIA event 분기 (ai_message / completed / failed / cancelled / waiting_for_input)
- [x] AI Multi Turn → text + 3500 char 분할 + continued suffix
- [x] Button Presentation → Block Kit actions block (style primary/danger)
- [x] Form 다단계 첫 필드 → form_prompt + hint (Block Kit input 은 v2 modal)
- [x] Carousel / Chart / Table v1 mrkdwn monospace fallback
- [x] Typing no-op (R-S-5)
- [x] `chat.postMessage` 분기 + ok=false throw + conversationKey 검증

### Phase 4 — Bot token rotation API ✅
- [x] 기존 `TriggersService.rotateBotToken` 가 provider-agnostic → Slack adapter 6함수 구현으로 자동 통과 (setupChannel 재호출 → auth.test 신 token 검증 → inboundSigningRef 변경 없음 — Slack 은 provider-issued)
- [x] (별 plan) `auth.revoke` 24h grace cron — CCH-SE-04-C 영역 → [`chat-channel-slack-impl-followup-e2e.md`](./chat-channel-slack-impl-followup-e2e.md) 로 인계

### Phase 5 — Test + UI ✅
- [x] Unit tests (parseUpdate 23 + renderer 11 + signing 13 + adapter 10 + authenticator Slack 4)
- [x] E2E test → [`chat-channel-slack-impl-followup-e2e.md`](./chat-channel-slack-impl-followup-e2e.md) 로 인계 (frontmatter `pending_plans:` 등록 완료)
- [x] Frontend trigger drawer providerLabel('slack') 추가
- [x] i18n 키 `triggers.chatChannel.providerSlack` (ko/en)
- [x] User guide page → followup plan 으로 분리

### Phase 6 — `_overview.md §1 supported` 승격
- [x] **followup plan 의 책임**: e2e + user guide 완료 후 `_overview.md §2 → §1` 승격 + slack.md frontmatter `status: partial → implemented`. **현재 status: partial** (spec frontmatter 에 `pending_plans:` 로 followup 등록 완료).

## 위험

- Slack signing secret 입력 UX — 사용자가 Slack 앱 manifest 의 Request URL 도 동시에 설정해야 함 (R-S-2). UI 가이드 안내 필요.
- v1 = Webhook-mode only (R-S-3). Socket Mode 가 필요한 케이스 (private network) 는 v2.
- Form `file` 필드 — `files.info` 호출이 추가 round-trip 이므로 `parseUpdate` → `HooksService.handleChatChannelUpdate` 의 latency budget (CCH-NF-01 50ms) 안에 들어가는지 측정 필요.
