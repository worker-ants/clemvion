---
worktree: (assigned at impl-start)
started: 2026-05-24
owner: developer (TBD)
status: backlog
---

# Discord Chat Channel Adapter — 구현 (스켈레톤)

본 plan 은 [`spec/4-nodes/7-trigger/providers/discord.md`](../../spec/4-nodes/7-trigger/providers/discord.md) 의 Discord adapter 를 backend / frontend 에 구현하는 후속 작업이다. spec 단계는 [`plan/in-progress/spec-slack-discord-chat-channel.md`](./spec-slack-discord-chat-channel.md) 가 완료.

**상태: backlog** — `status: backlog` 이며, 본 worktree 진입은 [`chat-channel-slack-impl`](./chat-channel-slack-impl.md) 완료 후 사용자 결정에 의해 trigger (순차 진행).

## 진입 조건

- [ ] [`plan/complete/spec-slack-discord-chat-channel.md`](../complete/spec-slack-discord-chat-channel.md) 로 이동 완료 (spec PR merged)
- [ ] [`plan/complete/chat-channel-slack-impl.md`](../complete/chat-channel-slack-impl.md) 로 이동 완료 (Slack impl 의 adapter / registry / dispatcher 패턴이 두 번째 provider 도입 검증 완료)
- [ ] 사용자가 Discord impl 진행 명시적 결정
- [ ] worktree 생성: `.claude/tools/ensure-worktree.sh chat-channel-discord-impl`

## 참조

- **Spec SoT**: [`spec/4-nodes/7-trigger/providers/discord.md`](../../spec/4-nodes/7-trigger/providers/discord.md)
- **공통 인터페이스**: [`spec/conventions/chat-channel-adapter.md`](../../spec/conventions/chat-channel-adapter.md)
- **시스템 spec**: [`spec/5-system/15-chat-channel.md`](../../spec/5-system/15-chat-channel.md) (특히 [R-CC-13](../../spec/5-system/15-chat-channel.md#r-cc-13-discord-v1--cch-mp-01------interactions-webhook-only--2026-05-24) — v1 의 CCH-MP-01 부분 유예)
- **Sibling impl plan**: [`chat-channel-slack-impl`](./chat-channel-slack-impl.md) (registry / dispatcher 등록 패턴 follow)
- **Template plan**: [`plan/complete/chat-channel-impl.md`](../complete/chat-channel-impl.md)

## Phase 구조 (진입 시 상세 작성)

### Phase 0 — 사전 검토
- [ ] `/consistency-check --impl-prep spec/4-nodes/7-trigger/providers/discord.md`
- [ ] `code:` frontmatter 준비

### Phase 1 — Foundation
- [ ] `DiscordAdapter` skeleton
- [ ] `DiscordClient` HTTP wrapper (REST v10 + interaction response 분기)
- [ ] `ChannelAdapterRegistry` 에 `'discord'` 등록
- [ ] `publicKeyRef` config 필드 처리

### Phase 2 — Inbound (parseUpdate + ed25519 verify)
- [ ] Interactions Webhook envelope 분기 (type 1=PING / 2=APPLICATION_COMMAND / 3=MESSAGE_COMPONENT / 5=MODAL_SUBMIT)
- [ ] PING handshake (`{ type: 1 }` 200 응답)
- [ ] `X-Signature-Ed25519` + `X-Signature-Timestamp` ed25519 verify + 5분 replay window (Node `crypto.verify('ed25519', ...)`)
- [ ] Slash command sub-command 매핑 (`start` / `cancel` / `reply` / `help`)
- [ ] MODAL_SUBMIT TEXT_INPUT → `text_message` normalize (R-CC-13 의 inbound 부분 유예 해결 경로 (b))

### Phase 3 — Outbound (renderNode + sendMessage)
- [ ] AI Multi Turn → `POST /channels/{id}/messages` markdown + 2000 char 분할 + "Reply" 버튼 첨부
- [ ] Button Presentation → Components ACTION_ROW + BUTTON (style 1/2/4)
- [ ] Form 다단계 (Convention §4) — 각 field 별 ACTION_ROW (TEXT_INPUT modal trigger 또는 SELECT_MENU)
- [ ] Carousel / Chart / Table v1 — markdown monospace + embed image fallback
- [ ] Typing → `POST /channels/{id}/typing`
- [ ] DM 채널 생성 (`POST /users/@me/channels`) + channel_id 캐시

### Phase 4 — Bot token rotation API
- [ ] `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 provider=discord 경로
- [ ] 24h grace 종료 시점 cron 확장

### Phase 5 — Test + UI
- [ ] Unit/integration tests (parseUpdate / renderNode / ed25519 verify / sendMessage)
- [ ] E2E test (fake Discord server)
- [ ] Frontend trigger drawer 에 `discord` provider 옵션 + `publicKeyRef` 입력 UI
- [ ] i18n 키 `triggers.chatChannel.discord.*`
- [ ] User guide page `codebase/frontend/src/content/docs/triggers/discord-setup.md` 신설 — `MESSAGE_CREATE` 미수신 / file 필드 사실상 미지원 / `/workflow reply` 사용법 안내

### Phase 6 — `_overview.md §2 → §1` 승격 + plan complete

## 위험

- v1 Interactions Webhook only 의 결과로 자유 텍스트 DM 미수신 (R-D-3 / R-CC-13). 사용자 reply 경로가 modal/slash 로 제한됨 — UX 가이드가 필수.
- Form `file` 필드 사실상 미지원 (R-D-7 / R-D-9). frontend 노드 정의 검증에서 warning 표시 필요.
- ed25519 verify 의 latency — Node `crypto.verify` 가 `signingSecret` HMAC 보다 약간 무겁지만 CCH-NF-01 50ms budget 안.
- Gateway 미사용으로 `chat-channel-discord-gateway` v2 plan 의 trigger 조건 점검 (사용자 요청 / 자연 대화 강제 필요 시).
