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

## Phase 구조 (Telegram template follow — 진입 시 상세 작성)

### Phase 0 — 사전 검토
- [ ] `/consistency-check --impl-prep spec/4-nodes/7-trigger/providers/slack.md` 호출
- [ ] [`spec/conventions/spec-impl-evidence.md`](../../spec/conventions/spec-impl-evidence.md) 의 `code:` frontmatter 채우기 준비

### Phase 1 — Foundation
- [ ] `SlackAdapter` skeleton (`ChatChannelAdapter` interface 구현)
- [ ] `SlackClient` HTTP wrapper (Web API + Events API + Interactivity 분기)
- [ ] `ChannelAdapterRegistry` 에 `'slack'` 등록 (`ChatChannelModule.onModuleInit`)
- [ ] `signingSecretRef` config 필드 처리 (DTO + SecretResolver 호출)

### Phase 2 — Inbound (parseUpdate + auth)
- [ ] Events API envelope 분기 (DM message / file_shared / app_mention / url_verification)
- [ ] Interactivity payload 분기 (block_actions / view_submission v2 skip)
- [ ] Slash commands 분기 (`/<prefix> start|cancel|help` + 자유 text)
- [ ] `X-Slack-Signature` HMAC-SHA256 + 5분 replay window 검증 (HooksController guard)
- [ ] URL Verification handshake (`{ challenge }` 200 응답)
- [ ] HooksService 가 `files.info` 후속 호출로 mimeType 보강 (R-S-7 normative 흐름)

### Phase 3 — Outbound (renderNode + sendMessage)
- [ ] AI Multi Turn → `chat.postMessage` mrkdwn + 3500 char 분할
- [ ] Button Presentation → Block Kit `actions` block
- [ ] Form 다단계 (Convention §4) — field type 별 Block Kit hint
- [ ] Carousel / Chart / Table v1 — mrkdwn monospace + image_block fallback
- [ ] Typing no-op

### Phase 4 — Bot token rotation API
- [ ] `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 provider=slack 경로
- [ ] `auth.revoke` 24h grace 종료 시점 cron (`ChatChannelTokenRotatorService` 확장)

### Phase 5 — Test + UI
- [ ] Unit/integration tests (parseUpdate / renderNode / adapter / HMAC verify)
- [ ] E2E test (fake Slack server)
- [ ] Frontend trigger drawer 의 provider select 에 `slack` 옵션 + `signingSecretRef` 입력 UI
- [ ] i18n 키 `triggers.chatChannel.slack.*` (ko/en)
- [ ] User guide page `codebase/frontend/src/content/docs/triggers/slack-setup.md` 신설

### Phase 6 — `_overview.md §2 → §1` 승격 + plan complete
- [ ] `spec/4-nodes/7-trigger/providers/_overview.md §2` 의 `slack` 행 제거 + §1 supported 표에 `supported (v1)` 추가
- [ ] `spec/4-nodes/7-trigger/providers/slack.md` frontmatter `code:` 에 구현 경로 cross-link
- [ ] 본 plan `git mv` 로 `plan/complete/` 이동

## 위험

- Slack signing secret 입력 UX — 사용자가 Slack 앱 manifest 의 Request URL 도 동시에 설정해야 함 (R-S-2). UI 가이드 안내 필요.
- v1 = Webhook-mode only (R-S-3). Socket Mode 가 필요한 케이스 (private network) 는 v2.
- Form `file` 필드 — `files.info` 호출이 추가 round-trip 이므로 `parseUpdate` → `HooksService.handleChatChannelUpdate` 의 latency budget (CCH-NF-01 50ms) 안에 들어가는지 측정 필요.
