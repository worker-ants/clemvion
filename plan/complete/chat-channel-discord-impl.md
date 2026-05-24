---
worktree: spec-slack-discord-chat-channel-bb4d35
started: 2026-05-24
owner: developer
status: completed
---

# Discord Chat Channel Adapter — 구현 ✅

본 plan 은 [`spec/4-nodes/7-trigger/providers/discord.md`](../../spec/4-nodes/7-trigger/providers/discord.md) 의 Discord adapter 를 backend / frontend 에 구현. spec 단계는 [`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) + [`plan/complete/spec-chat-channel-inbound-signing-rename.md`](../complete/spec-chat-channel-inbound-signing-rename.md) 가 완료. Slack impl ([`plan/complete/chat-channel-slack-impl.md`](../complete/chat-channel-slack-impl.md)) 의 패턴을 그대로 따름.

사용자 결정 (2026-05-24): Slack followup 완료 직후 stacked 진행. 동일 worktree.

## 진입 조건 ✅

- [x] `spec-slack-discord-chat-channel` complete
- [x] `spec-chat-channel-inbound-signing-rename` complete
- [x] `chat-channel-slack-impl` complete (Slack 패턴 검증 완료)
- [x] `chat-channel-slack-impl-followup-e2e` complete
- [x] 사용자가 Discord impl 진행 명시적 결정

## 참조

- **Spec SoT**: [`spec/4-nodes/7-trigger/providers/discord.md`](../../spec/4-nodes/7-trigger/providers/discord.md)
- **공통 인터페이스**: [`spec/conventions/chat-channel-adapter.md`](../../spec/conventions/chat-channel-adapter.md)
- **시스템 spec**: [`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md) (특히 R-CC-13)
- **Sibling impl plan**: [`chat-channel-slack-impl`](../complete/chat-channel-slack-impl.md)

## Phase 구조 ✅

### Phase 0 — 사전 검토 ✅
- [x] 본 commit 의 impl-prep 검토 — Slack 의 결과를 transitively 적용 (Discord 도 같은 worktree 의 connected work, false positive 가능성 동일). spec frontmatter 의 `pending_plans:` 미사용.

### Phase 1 — Foundation ✅
- [x] `DiscordAdapter` skeleton + `DiscordClient` HTTP wrapper (REST v10)
- [x] `ChannelAdapterRegistry` 에 `'discord'` 등록 (`ChatChannelModule` constructor)
- [x] `inboundSigningRef` config 필드 처리 (Slack 와 단일 슬롯 공유)
- [x] `discord-signing.ts` ed25519 verify (SubjectPublicKeyInfo DER prefix wrapping) + 10 test

### Phase 2 — Inbound (parseUpdate + ed25519 verify) ✅
- [x] Interactions Webhook envelope 분기 (type 1=PING / 2=APPLICATION_COMMAND / 3=MESSAGE_COMPONENT / 5=MODAL_SUBMIT)
- [x] PING handshake — `HooksService.handleChatChannelWebhook` 가 `discordPing: true` 반환 → `HooksController` 가 `{ type: 1 }` 200 응답
- [x] `X-Signature-Ed25519` + `X-Signature-Timestamp` ed25519 verify + 5분 replay window
- [x] Slash command sub-command 매핑 (`start` / `cancel` / `help` / `reply`)
- [x] MODAL_SUBMIT TEXT_INPUT → `text_message` normalize (R-CC-13 inbound (b))
- [x] DM only filter (channel.type !== 1) + bot user 무시

### Phase 3 — Outbound (renderNode + sendMessage) ✅
- [x] AI Multi Turn → `POST /channels/{id}/messages` content + 2000 char 분할
- [x] Button Presentation → Components ACTION_ROW + BUTTON (style 1/2/4/5)
- [x] Form 다단계 (Convention §4) — form_prompt + hint note
- [x] Carousel / Chart / Table v1 — markdown monospace fallback
- [x] Typing → `POST /channels/{id}/typing` (R-D-5 native)
- [x] Image → fallbackText 로 text 발송 (v1 multipart 미구현)

### Phase 4 — Bot token rotation API ✅
- [x] 기존 `TriggersService.rotateBotToken` 가 provider-agnostic → Discord adapter 6함수 구현으로 자동 통과 (setupChannel 재호출 → `auth.test` 동등인 `getApplicationMe` 신 token 검증)
- 24h grace cron (별 plan `chat-channel-auth-revoke-cron`) — Slack/Discord/Telegram 공유 후속 작업

### Phase 5 — Test + UI ✅
- [x] Unit tests (parseUpdate 13 + signing 10 + adapter 9 — 총 32 new)
- [x] E2E test — `codebase/backend/test/chat-channel-discord.e2e-spec.ts` (PING / 401 / 미지원 type / guild 차단)
- [x] Frontend trigger drawer 의 providerLabel('discord') 추가
- [x] i18n 키 `triggers.chatChannel.providerDiscord` (ko/en)
- [x] User guide page `06-integrations-and-config/discord.mdx` + en

### Phase 6 — `_overview.md §1 supported` 승격 ✅
- [x] `_overview.md §1 supported` 표에 `discord` 행 추가 (총 3 provider supported)
- [x] `_overview.md §2 Spec-defined / impl-pending` 표 비움 (none)
- [x] `discord.md` frontmatter `status: spec-only → implemented` + `code:` 16 파일

## 위험 / 한계 (구현된 v1)

- 자유 텍스트 DM 미수신 (R-D-3 / R-CC-13) — `/workflow reply` slash 또는 modal TEXT_INPUT 으로만 reply
- Form `file` 필드 사실상 미지원 (R-D-9) — user guide 안내
- Gateway v2 plan (`chat-channel-discord-gateway`) — 자연 대화 강제 필요 시 trigger
- Modal Form native (`chat-channel-form-native-modal` v2) — Convention §4 다단계 시퀀스 예외 절 추가 필요
- 24h grace cron (`chat-channel-auth-revoke-cron`) — Telegram/Slack/Discord 공유 후속 plan
