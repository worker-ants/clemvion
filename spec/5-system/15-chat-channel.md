---
id: chat-channel
status: partial
code:
  - codebase/backend/src/modules/chat-channel/**
  - codebase/backend/src/modules/triggers/dto/chat-channel-config.dto.ts
  - codebase/backend/src/modules/triggers/triggers.service.ts
  - codebase/backend/src/modules/triggers/triggers.controller.ts
  - codebase/backend/src/modules/hooks/hooks.service.ts
  - codebase/backend/src/modules/hooks/hooks.controller.ts
  - codebase/backend/test/chat-channel-slack.e2e-spec.ts
  - codebase/backend/test/chat-channel-discord.e2e-spec.ts
  - codebase/backend/test/chat-channel-trigger-create.e2e-spec.ts
  - codebase/frontend/src/app/(main)/triggers/page.tsx
  - codebase/frontend/src/components/triggers/trigger-detail-drawer.tsx
  - codebase/frontend/src/lib/i18n/dict/ko/triggers.ts
  - codebase/frontend/src/lib/i18n/dict/en/triggers.ts
pending_plans:
  - plan/in-progress/chat-channel-dispatcher-split.md
  - plan/in-progress/chat-channel-discord-gateway.md
  - plan/in-progress/chat-channel-slack-socket-mode.md
  - plan/in-progress/chat-channel-form-native-modal.md
  - plan/in-progress/chat-channel-visual-ssr-png.md
  - plan/in-progress/chat-channel-secret-store-infra.md
---

# Spec: Chat Channel (외부 chat 플랫폼 ↔ 워크플로우 서버사이드 어댑터)

> 관련 문서: [Spec External Interaction API](./14-external-interaction-api.md) · [Spec Webhook 트리거](./12-webhook.md) · [Spec 데이터 모델](../1-data-model.md#28-trigger) · [Convention Chat Channel Adapter](../conventions/chat-channel-adapter.md) · [Spec Telegram Adapter](../4-nodes/7-trigger/providers/telegram.md) · [Spec Trigger 공통 규약](../4-nodes/7-trigger/0-common.md) · [Spec WebSocket 프로토콜](./6-websocket-protocol.md) · [Spec Conversation Thread](../conventions/conversation-thread.md)

---

## Overview (제품 정의)

### 1. 개요

워크플로우가 외부 chat 플랫폼 (Telegram, Slack, 카카오 등) 의 봇 위에 챗봇 형태로 동작하도록 만드는 **서버사이드 어댑터 계층**. 사용자는 봇 토큰만 등록하면 워크플로우가 챗봇처럼 동작한다 — 외부 update 의 inbound 변환, 워크플로우의 outbound 응답을 채널 메시지로 변환하는 두 방향 모두 어댑터가 처리.

[Spec External Interaction API (EIA)](./14-external-interaction-api.md) 는 generic webhook + notification + REST/SSE 표면을 제공하지만, 외부 chat 플랫폼과 통합하려면 사용자가 직접 변환층을 운영해야 한다. Chat Channel 은 그 변환층을 server-side 에서 **EIA 의 consumer 로 격리한 편의 레이어** 다. 새 트리거 유형을 추가하지 않고 **Webhook 트리거 `config.chatChannel` 한 옵션** 으로 동작한다.

### 2. 사용 시나리오

| 시나리오 | 설명 |
|---|---|
| 텔레그램 봇 위의 AI 어시스턴트 | 사용자가 `/start` → 워크플로우 시작 → AI Multi Turn 노드와 자연 대화 → 결과 안내 |
| 텔레그램 봇 위의 결재 흐름 | 사용자가 메시지 → 워크플로우가 Form 노드로 필드별 질문 → 마지막에 결과 통보 |
| 텔레그램 봇 위의 데이터 시각화 | 사용자 명령 → 워크플로우가 Chart / Table / Carousel 렌더 → v1: MarkdownV2 monospace 텍스트 표현 + 선택 버튼 (v2: SSR PNG `sendPhoto`) |

### 3. 요구사항 (CCH-* prefix)

#### 3.1 어댑터 라이프사이클

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-AD-01 | Webhook 트리거 `config.chatChannel` 의 `provider` 필드로 어댑터 선택. supported provider 는 [`providers/_overview.md §1`](../4-nodes/7-trigger/providers/_overview.md#1-supported-providers-v1) 단일 진실 (v1 supported: `telegram` / `slack` / `discord` — 2026-05-24 갱신, PR #300 정합) | 필수 |
| CCH-AD-02 | Trigger enable / 신규 생성 시 어댑터의 `setupChannel()` 자동 호출 (텔레그램은 `setWebhook`) | 필수 |
| CCH-AD-03 | Trigger disable / 삭제 시 어댑터의 `teardownChannel()` 자동 호출 | 필수 |
| CCH-AD-04 | Webhook 진입점 ([`POST /api/hooks/:endpointPath`](./12-webhook.md#31-webhook-수신-엔드포인트)) 핸들러는 `config.chatChannel` 가 있으면 raw body 를 `parseUpdate(raw)` 로 통과시켜 워크플로우 input 으로 변환. [WH-NF-01](./12-webhook.md#4-비기능-요구사항) 의 200ms 응답 시한을 깨지 않도록 `parseUpdate` 50ms (CCH-NF-01) + 트리거 조회 + `202 Accepted` 반환의 순서로 처리 | 필수 |
| CCH-AD-05 | EIA outbound notification 의 `execution.waiting_for_input` / `execution.ai_message` / `execution.completed` / `execution.failed` / `execution.cancelled` 이벤트를 어댑터가 **NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach** → `renderNode(payload)` → `sendMessage()` 호출. 실행 엔진의 단일 sink 정책을 깨지 않음 (어댑터는 NotificationDispatcher 와 동일 facade 계층). [EIA §R10](./14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장-2026-05-21) | 필수 |
| CCH-AD-06 | 인터랙션 응답 (텔레그램 reply / inline_keyboard tap / 다단계 form answer) 도착 → 어댑터가 [`InteractionService.interact(ctx, dto)`](../../codebase/backend/src/modules/external-interaction/interaction.service.ts) 를 **in-process 직접 호출**. HTTP 표면을 거치지 않음 (network round-trip 회피 + 토큰 발급 우회). 우회 정당화는 [EIA §3.3 EIA-AU-08](./14-external-interaction-api.md#33-인증) — trusted in-process caller 예외 | 필수 |

#### 3.2 Identity / Conversation 매핑

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-CV-01 | 채널의 `(provider, conversationKey)` ↔ 워크스페이스 conversation thread 1:1 매핑 (텔레그램: `(bot_id, chat_id)`) | 필수 |
| CCH-CV-02 | 첫 메시지 또는 `/start` 명령 도착 시 conversation thread 자동 생성 + 워크플로우 신규 execution 시작 | 필수 |
| CCH-CV-03 | 같은 conversation 의 두 번째 이후 메시지는 execution 상태별 분기 처리: (a) `waiting_for_input` → 인터랙션 명령으로 forwarding, (b) `running`/`pending` (waiting_for_input 미도달) → 채널에 `languageHints.executionStillRunning` 안내 메시지 발송 + update 무시 (대기 큐 미적재, 202 ack — 정당화는 Rationale R9), (c) `completed`/`failed`/`cancelled` 또는 conversation 없음 → 새 execution 시작. `running` 케이스의 안내 default 문구 = "워크플로우가 처리 중입니다. 잠시만 기다려 주세요." | 필수 |
| CCH-CV-04 | conversation thread metadata 가 아니라 §3.4.3 의 Redis `ChannelConversation` 레코드에 `channelUserKey` (텔레그램: `user_id`) 저장 — multi-user 확장 대비. [Conversation Thread spec](../conventions/conversation-thread.md) 자료구조는 변경하지 않음 | 권장 |
| CCH-CV-05 | v1 은 single-user DM 만 지원. group/supergroup/channel update 도착 시 `parseUpdate` 가 `null` 반환 ([Convention §1.1](../conventions/chat-channel-adapter.md#11-6함수-책임--부작용--멱등성) 의 side-effect free 계약 유지) → 호출자 (`HooksService`) 가 `chat.type !== 'private'` 분기에서 `languageHints.groupChatRefusal` 안내를 `sendMessage` 별 호출로 발송 후 update 무시. 안내 발송 책임 = 어댑터 X, 호출자 O | 필수 |

#### 3.3 노드 → 채널 UI 매핑

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-MP-01 | [AI Multi Turn](../4-nodes/3-ai/1-ai-agent.md) 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환 (provider 별 길이 제한 분할) | 필수 |
| CCH-MP-02 | [Button Presentation](../4-nodes/6-presentation/0-common.md) 의 `execution.waiting_for_input` (interactionType=buttons) → 채널의 inline keyboard 로 변환. tap → `click_button` 명령 | 필수 |
| CCH-MP-03 | [Form](../4-nodes/6-presentation/4-form.md) 의 `execution.waiting_for_input` (interactionType=form) → 다단계 prompt 시퀀스 (필드별 한 줄 질문). 검증 실패 시 그 필드만 재질문 ([EIA-RL-03](./14-external-interaction-api.md#34-신뢰성·일관성)) | 필수 |
| CCH-MP-04 | Carousel / Chart / Table 의 `execution.waiting_for_input` → 채널 메시지로 변환. **`uiMapping.visualNode` enum 분기 적용** (`"text" \| "photo" \| "auto"`, default `"auto"`). **v1 정책** (MarkdownV2 텍스트/monospace 표현): `text` / `auto` 모두 chart 는 데이터로부터 monospace mini bar chart 텍스트 합성, table 은 monospace MarkdownV2 표 (column 너비 정렬 + row cap), carousel 은 카드 N장 sequential ChannelMessage (`auto` 는 카드별 image url 있으면 `sendPhoto`, 없으면 `sendMessage`; `text` 는 image url 무시하고 항상 텍스트 카드). v1 에서 `photo` 선택 시 fallback to text + warning 로그 (`chat_channel_health` 변경 없음 — 정상 fallback). **v2 정책** (SSR PNG, 별 plan `chat-channel-visual-ssr-png` 추적): `photo` / `auto` 모두 SSR 인프라 도입 후 `sendPhoto` 로 본격 이미지 렌더로 격상 — `output.rendered` snapshot 폐기 (D5 / 2026-05-17) 이후 어댑터가 raw 데이터로부터 직접 SSR 책임. enum 별 노드타입 매트릭스 SoT 는 [providers/telegram.md §5.4](../4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04) | 필수 (v1 MarkdownV2 텍스트, v2 PNG) |
| CCH-MP-05 | Form 필드 `type` 별 채널 keyboard hint — `number` → 숫자 키패드, `phone` → share_contact, `file` → upload prompt 등. 없는 keyboard 는 일반 text input | 권장 |

#### 3.4 신뢰성 / 보안

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-SE-01 | 어댑터의 외부 API 호출 (sendMessage 등) 에 5초 타임아웃 + 3회 지수 백오프 재시도. 최종 실패 시 trigger 의 `chat_channel_health` 를 `degraded` 로 갱신 ([§3.4.2](#342-trigger-테이블-신규-컬럼)). 자동 비활성화 금지 ([WH-MG-04 / EIA-NX-07](./12-webhook.md#34-관리) 와 동일 정책) | 필수 |
| CCH-SE-02 | 인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급 (텔레그램 `update_id` 기반). 동일 `update_id` 30초 안 재도착은 무시 | 필수 |
| CCH-SE-03 | 어댑터의 외부 API secret (provider 별 bot token) 과 inbound webhook 출처 검증용 자료 (Telegram secret_token / Slack signing secret / Discord public key) 는 [`SecretResolver`](../conventions/secret-store.md) 가 관리하는 secret store 에 backend AES-256-GCM 으로 암호화 보관 — config JSONB 평문 금지. `config.chatChannel` 에는 ref 만 ([`botTokenRef`](#41-triggerconfigchatchannel) / `inboundSigningRef`) 저장. ref 형식은 [secret-store.md §1](../conventions/secret-store.md#1-uri-scheme) — `secret://triggers/{triggerId}/{bot-token,inbound-signing}`. DB 는 ciphertext (BYTEA) 만 본다 | 필수 |
| CCH-SE-04 | Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) — old token 은 24h grace 동안 병행 받음 (텔레그램의 경우 setWebhook 재호출). 동사를 `rotate-bot-token` 으로 한 이유는 EIA 의 `rotate-secret` (HMAC signing secret) 과 자원 의미가 다르기 때문 (외부 provider bot token vs HMAC secret) — URL 만으로 의도 구별 가능 | 권장 |
| CCH-SE-04-C | `rotate-bot-token` 완료 후 `chat_channel_token_v2` 의 v2 ref 는 24h grace 경과 시 `ChatChannelTokenRotatorService` (매시간 cron — `NotificationSecretRotatorService` 와 동일 패턴) 가 다음을 수행한다: (1) v2 ref 의 secret_store row 삭제 (`secrets.delete(v2Ref)`), (2) `chat_channel_token_v2 = NULL` / `chat_channel_rotated_at = NULL` 저장. primary `botTokenRef` 의 plaintext 는 `rotate-bot-token` 시점에 이미 신 token 으로 교체되므로 v2 → primary 승격은 별도 단계가 아니다 | 필수 (v2 cron) |

#### 3.5 비기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-NF-01 | 어댑터의 inbound 변환 latency: `parseUpdate` ↔ 워크플로우 input 평균 50ms 이내. [WH-NF-01](./12-webhook.md#4-비기능-요구사항) 의 200ms 안에 인증·trigger 조회와 합산해 들어가야 함 | 필수 |
| CCH-NF-02 | 어댑터의 outbound 변환 latency: NotificationDispatcher 이벤트 수신 ↔ 채널 sendMessage 호출 평균 200ms 이내 | 필수 |
| CCH-NF-03 | 채널당 분당 최대 60건 inbound (텔레그램 Bot API 의 group rate limit 과 정합). 초과분은 어댑터의 chat 단위 큐에 적재, 폭주 시 가장 오래된 update 부터 폐기하지 않고 `chat_channel_health=degraded` 표시 | 필수 |

---

## 3. 처리 흐름

### 3.1 전체 시퀀스 (Telegram 예시)

```
[Telegram 사용자]
   │ /start, 텍스트, button tap 등
   ▼
[Telegram Bot API] ── webhook ──▶ [POST /api/hooks/:endpointPath]
                                           │
                                           ▼
                                  HooksController.handle()
                                           │
                                config.chatChannel ? yes
                                           │
                                           ▼
                                  TelegramAdapter.parseUpdate(raw)    ◀── 50ms 이내 (CCH-NF-01)
                                           │
                                  ┌────────┴────────┐
                                  │                 │
                              새 conversation   기존 conversation (활성 execution)
                                  │                 │
                                  ▼                 ▼
                            ExecutionEngine    InteractionService.interact()
                            .execute()              (in-process,
                              (kicked off)          token bypass — EIA-AU-08)
                                  │                 │
                                  └────────┬────────┘
                                           │
                                           ▼
                                  HTTP `202 Accepted` 즉시 반환    ◀── WH-NF-01 200ms 이내
                                           │
                              (백그라운드 — TX commit 후 fire)
                                           ▼
                                  NotificationDispatcher (after-commit EventEmitter)
                                  ├─ execution.waiting_for_input
                                  ├─ execution.ai_message
                                  ├─ execution.completed
                                  ├─ execution.failed
                                  └─ execution.cancelled
                                           │
                              ChatChannelAdapter.subscribe(emitter)
                              (NotificationDispatcher 와 동일 facade 계층 —
                               엔진 §4.4 단일 sink 정책 유지)
                                           │
                                           ▼
                                  TelegramAdapter.renderNode(payload)    ◀── 200ms 이내 (CCH-NF-02)
                                           │
                                           ▼
                                  TelegramAdapter.sendMessage()
                                           │
                                           ▼
                                  Telegram Bot API (sendMessage / sendPhoto / answerCallbackQuery)
                                           │
                                           ▼
                                  [Telegram 사용자] 메시지 / 키보드 수신
```

### 3.2 사이드 채널 명시

어댑터의 outbound subscription 은 **NotificationDispatcher 가 노출하는 in-process EventEmitter** 의 listener 로 attach (Redis pub/sub 우회 — 같은 process 안에서는 EventEmitter 가 충분). 외부 HTTP notification 와 채널 emit 은 **같은 after-commit hook 에서 fan-out** 되어 둘 다 [EIA-RL-04](./14-external-interaction-api.md#34-신뢰성·일관성) (TX commit 후 발송) 와 정합. 어댑터가 엔진 내부 코드를 호출하지 않음 — facade 원칙 유지.

[EIA §R10](./14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장-2026-05-21) 가 본 spec 의 추가 facade 사용을 명시. 본 spec 의 어댑터는 R10 의 "엔진 외부 facade 단일 위치" 원칙을 깨지 않는다.

### 3.3 SSE 어댑터와의 병존

[EIA §R10](./14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장-2026-05-21) 의 SSE 어댑터는 Redis pub/sub 으로 WebsocketService 가 발행한 이벤트를 구독한다 (다중 인스턴스 환경에서 외부 SSE 클라이언트가 임의 인스턴스에 접속할 수 있어야 함). Chat Channel 어댑터는 같은 process 안의 NotificationDispatcher 가 fan-out 하는 EventEmitter 를 구독한다 — 두 어댑터는 같은 facade 계층의 별도 listener 로 병존한다 (Redis pub/sub 과 in-process EventEmitter 가 동시 운영).

---

## 4. 데이터 모델

### 4.1 `Trigger.config.chatChannel`

```jsonc
{
  "chatChannel": {
    "provider": "telegram",                    // 어댑터 식별자 — providers/_overview.md §1 단일 진실 (v1 supported: telegram / slack / discord)
    "botToken": "<provider 발급 plaintext>",   // 입력 전용 — POST /api/triggers 요청 body 한정. service 가 SecretResolver.store 로 옮긴 뒤 strip — 응답·DB JSONB 미노출 (SS-SE-01). telegram=BotFather `\d+:[A-Za-z0-9_-]+` / slack=`xoxb-*` / discord=Developer Portal Bot Token
    "inboundSigningPlaintext": "<provider-issued plaintext>",  // 입력 전용, slack/discord 한정 (telegram 은 server-issued 자동 발급). slack=lowercase hex 32 chars (signing secret) / discord=lowercase hex 64 chars (ed25519 application public key). 입력 후 service 가 SecretResolver.store(inboundSigningRef, plaintext) → strip. telegram 입력 시 400 VALIDATION_ERROR(field='inboundSigningPlaintext'). SoT: conventions/secret-store.md §5.5 (b)
    "botTokenRef":      "secret://triggers/{triggerId}/bot-token",       // 응답·DB JSONB 보관 ref. provider 공통 (CCH-SE-03 / conventions/secret-store.md). botToken plaintext 는 응답 strip
    "inboundSigningRef": "secret://triggers/{triggerId}/inbound-signing",  // 응답·DB JSONB 보관 ref. provider 공통 단일 슬롯 — 검증 알고리즘은 backend 의 provider 분기 책임. Telegram: server-issued shared secret (setupChannel 의 randomBytes 발급) / Slack: HMAC-SHA256 signing secret (사용자 inboundSigningPlaintext 입력) / Discord: ed25519 public key (사용자 inboundSigningPlaintext 입력). SoT: conventions/chat-channel-adapter.md §2.3
    "botIdentity": {                            // setupChannel 결과 캐시 (read-only after creation)
      "botId": 123456789,
      "username": "myworkflow_bot"
    },
    "uiMapping": {                              // optional — 노드 → 채널 UI 매핑 옵션
      "formMode": "multi_step",                 // 현재 v1 은 multi_step 만 (다단계 시퀀스)
      "visualNode": "auto",                     // "text" | "photo" | "auto" (default "auto"). Carousel/Chart/Table 시각 렌더 모드. v1 photo 선택 시 fallback to text + warning. legacy "text_only" 는 read-time 에 "text" 로 normalize. 상세 [chat-channel-adapter.md §2.3](../conventions/chat-channel-adapter.md#23-chatchannelconfig) + telegram §5.4
      "buttonLayout": "auto"                    // "auto" | "vertical" | "horizontal"
    },
    "rateLimitPerMinute": 60,                   // CCH-NF-03 override
    "languageHints": {                          // 봇이 보내는 자체 안내 메시지 i18n
      "groupChatRefusal":      "이 봇은 1:1 대화만 지원합니다.",
      "executionStarted":      "워크플로우를 시작합니다…",
      "executionCompleted":    "워크플로우가 완료되었습니다.",
      "executionStillRunning": "워크플로우가 처리 중입니다. 잠시만 기다려 주세요.",  // CCH-CV-03 의 running 케이스 안내 default
      "help":                  "사용 가능한 명령: /start, /cancel, /help"            // §7 명령 처리의 /help default
    }
  }
}
```

`chatChannel` 미존재 = 일반 webhook 트리거 (기존 동작 그대로). 본 필드는 [Webhook §2.2](./12-webhook.md#22-config-필드-구조) 의 `config` JSONB 안에 위치.

`botTokenRef` / `inboundSigningRef` 는 모두 [`secret-store.md`](../conventions/secret-store.md) 의 `SecretResolver` 가 resolve — config JSONB 에는 ref 만, plaintext 는 backend AES-256-GCM 으로 암호화되어 `secret_store` 테이블의 `encrypted BYTEA` 컬럼에 보관. [EIA §7.1](./14-external-interaction-api.md#71-trigger-엔티티-확장) 의 `notification.signing.secretRef` 와 동일 정책 + 동일 백엔드. `inboundSigningRef` 의 provider 별 자원 성격·발급 주체·검증 알고리즘은 [`conventions/chat-channel-adapter.md §2.3 ChatChannelConfig`](../conventions/chat-channel-adapter.md#23-chatchannelconfig) 가 단일 진실 (Telegram = server-issued shared secret / Slack = HMAC key / Discord = ed25519 public key).

### 4.2 Trigger 테이블 신규 컬럼

[Spec 1-data-model §2.8](../1-data-model.md#28-trigger) 와 동기화 완료 (5개 신규 컬럼 + `hasBotToken` derived 필드 cross-link 모두 반영).

```sql
ALTER TABLE trigger
  ADD COLUMN chat_channel_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',  -- 'unknown'|'healthy'|'degraded'
  ADD COLUMN chat_channel_last_error TEXT NULL,
  ADD COLUMN chat_channel_setup_at   TIMESTAMPTZ NULL,
  ADD COLUMN chat_channel_token_v2   TEXT NULL,   -- rotation grace (24h) 동안 old bot token 백업 용 [secret store ref](../conventions/secret-store.md) (`secret://triggers/{id}/bot-token.v2`). 컬럼은 ref 만 보관 — plaintext 는 secret_store 테이블의 암호화 컬럼. 24h 후 ChatChannelTokenRotatorService (CCH-SE-04-C) 가 ref + secret_store row 정리. semantic: bot token reference — notification_secret_v2 와 의미 상이하나 명명 패턴 동일 (Rationale §R-K)
  ADD COLUMN chat_channel_rotated_at TIMESTAMPTZ NULL;
```

`chat_channel_health` 의 enum (`unknown`/`healthy`/`degraded`) 은 `notification_health` 와 완전 동일 — 향후 공용 DB 타입 통합 검토 대상.

Flyway 마이그레이션 슬롯 번호는 PR-A 착수 직전 [`spec/conventions/migrations.md`](../conventions/migrations.md) 에서 예약.

### 4.3 ChannelConversation (in-memory + Redis cache)

```
key:    chat-channel:{triggerId}:{conversationKey}   (텔레그램: chat_id)
value:  {
  executionId:    string | null,    // 활성 execution. terminal 후 null
  threadId:       string,           // conversation thread id (현재 v1 은 "default")
  channelUserKey: string,           // 텔레그램 user_id
  startedAt:      ISO8601,
  lastUpdateAt:   ISO8601
}
TTL: 7일 (사용자 이탈 시 자동 만료)
```

- conversationKey 는 어댑터별로 다름 (텔레그램: `chat_id`, Slack: `channel_id`+`thread_ts`, 카카오: `user_id`).
- 같은 `triggerId + conversationKey` 의 두 번째 메시지는 활성 execution 이 있으면 forwarding, 없으면 새 execution 시작.
- Redis key 패턴: `chat-channel:{triggerId}:{conversationKey}` — 콜론 separator + 계층형 (다른 모듈의 prefix 와 충돌 없음).

`channelUserKey` 는 **본 Redis ChannelConversation 레코드에만 보관**한다. [`spec/conventions/conversation-thread.md`](../conventions/conversation-thread.md) 의 `ConversationThread` 자료구조 자체에는 추가 필드를 도입하지 않음 — multi-user 확장 (v2) 시점에 재논의.

---

## 5. Identity / 보안

### 5.1 인증

- **Webhook 진입점**: [WH-SC-02 HMAC 서명](./12-webhook.md#42-hmac-서명) (provider 가 지원하는 경우) 또는 endpoint UUID 의 randomness 에 의존. 텔레그램은 HMAC 미지원이므로 `secret_token` 파라미터를 `setWebhook` 시 등록해 `X-Telegram-Bot-Api-Secret-Token` 헤더로 검증 (구체는 [providers/telegram §6](../4-nodes/7-trigger/providers/telegram.md#6-보안)).
- **EIA inbound facade**: 어댑터가 인터랙션 명령을 보낼 때 EIA 의 외부 토큰 (`iext_*` / `itk_*`) 발급을 우회하고 [`InteractionService.interact(ctx: InteractionRequestContext, dto: InteractDto)`](../../codebase/backend/src/modules/external-interaction/interaction.service.ts) 를 직접 in-process 호출. EIA HTTP 표면은 외부 클라이언트 전용 — 어댑터는 같은 process 안의 trusted caller. 우회 자체는 [EIA §3.3 EIA-AU-08](./14-external-interaction-api.md#33-인증) 의 명시적 예외 조항에 근거.
- **구현 단계의 접근 제어**: `InteractionRequestContext` 의 `scope: 'in_process_trusted'` 플래그가 set 된 경우만 token 검증 단계 (`tokenService.verify`) 를 skip. 외부 HTTP guard 는 ctx 합성 시 이 플래그를 절대 set 하지 않는다. 본 플래그의 추가는 [`InteractionRequestContext` 의 `tokenFamily` 확장이 아니라 별도 필드 도입] — `tokenFamily` 는 토큰 종류 식별용이고 `scope` 는 caller 의 신뢰 영역 식별용으로 직교적 의미를 가짐.

### 5.2 SSRF

어댑터의 outbound API URL 은 provider 별 고정 (`api.telegram.org`). [EIA-NX-10 SSRF 화이트리스트](./14-external-interaction-api.md#31-outbound-notification-notification-webhook) 와 별도 — 사용자 제어 URL 아님.

### 5.3 EIA §R5 (외부 WebSocket 보류) 와의 관계

EIA §R5 의 "외부 WebSocket 보류" 결정은 **외부 표면** 의 채널 다양화 결정. Chat Channel 어댑터는 외부 표면을 추가하지 않으므로 §R5 의 재논의 트리거 조건과 무관 (어댑터는 in-process subscriber).

### 5.4 Bot Token Rotation API 응답 계약

[CCH-SE-04](#34-신뢰성--보안) 의 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 의 응답 형식.

**요청** (body):
```jsonc
{
  "newBotToken": "<bot-father-issued-token>"   // 필수 — 신규 Bot Father 토큰
}
```

**성공 응답 (200 OK)** — [API Convention §5.1](./2-api-convention.md) 의 `{ data }` 래퍼 + `TransformInterceptor` 적용:
```jsonc
{
  "data": {
    "triggerId": "<trigger-id>",
    "rotatedAt": "<ISO8601>",
    "chatChannelHealth": "healthy",            // setupChannel 재호출 결과
    "botIdentity": { "botId": 123456789, "username": "myworkflow_bot" }  // getMe 캐시 갱신 결과
  }
}
```

**실패 응답** — [API Convention §5.3](./2-api-convention.md) 의 `{ error: { code, message, details? } }` 표준 에러 envelope 적용:

| HTTP | error.code | 사유 |
|---|---|---|
| 404 | `TRIGGER_NOT_FOUND` | trigger 미존재 또는 워크스페이스 권한 없음 |
| 400 | `CHAT_CHANNEL_NOT_CONFIGURED` | `config.chatChannel` 미설정 트리거 |
| 400 | `CHAT_CHANNEL_PROVIDER_UNKNOWN` | registry 에 미등록 provider |
| 400 | `BOT_TOKEN_INVALID` | 신규 토큰 형식 위반 또는 `getMe` 401/403 |
| 502 | `CHAT_CHANNEL_SETUP_FAILED` | Telegram `setWebhook` API 호출 실패 (재시도 후에도 실패) |

24h grace 동안 old token 병행 수신은 [CCH-SE-04](#34-신뢰성--보안) 규약에 따라 `chat_channel_token_v2` 컬럼 (§4.2) + setWebhook 재호출 (텔레그램 특성) 으로 구현한다.

### 5.4.1 Bot Token 변경 single-path 정책

Bot token 의 신규 등록·변경은 **single-path** 로 일원화된다:

| 시점 | 메커니즘 | 비고 |
|---|---|---|
| 최초 트리거 생성 (`POST /api/triggers`) | `setupChannel()` 의 부수효과로 `botTokenRef` 신설. 입력 body 의 `config.chatChannel.botToken` plaintext 를 받아 `SecretResolver.store()` 로 저장 후 ref 로 교체 | 처음 한 번 |
| 트리거 활성화 (`PATCH /api/triggers/:id/toggle` true) | `setupChannel()` 재호출 — 기존 `botTokenRef` 그대로 사용 | token 변경 없음 |
| 토큰 변경 (rotation) | **항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token` 만 사용**. PATCH body 의 `config.chatChannel.botTokenRef` 변경은 400 `VALIDATION_ERROR` (`details.field='botTokenRef'`) 로 차단 | 24h grace 적용 |

PATCH 차단의 정당화: PATCH 로 직접 `botTokenRef` 교체 시 (a) 외부 provider (텔레그램) 측에 등록된 webhook 은 그대로라 즉시 수신 단절, (b) rotate API 의 24h grace 정책 일관성이 깨짐, (c) audit log 가 `trigger.update` 와 `chat-channel.rotate-bot-token` 으로 mixed. 따라서 single-path.

[`spec/2-navigation/2-trigger-list.md §3`](../2-navigation/2-trigger-list.md#3-api) 의 PATCH 설명에는 "`config.chatChannel.botTokenRef` 는 PATCH 로 변경 불가 — rotate API 사용" cross-link 가 추가된다.

### 5.4.2 응답 DTO derived 필드 — `hasBotToken`

`GET /api/triggers/:id` 응답의 `config.chatChannel` 객체에는 **`hasBotToken: boolean`** 파생 필드가 포함된다:

- 규칙: `botTokenRef IS NOT NULL → hasBotToken: true`, 아니면 `false`.
- 용도: UI 가 "재발급" 버튼을 활성화할지, "신규 등록 form" 을 보여줄지 판별.
- 위치: 응답 DTO 전용 derived 필드 — **DB 컬럼 아님**, [Convention §2.3](../conventions/chat-channel-adapter.md#23-chatchannelconfig) 의 in-memory `ChatChannelConfig` type 에도 포함하지 않음 (변환 layer 는 backend response interceptor 책임).
- 보안: `botTokenRef` 자체와 `botToken` plaintext 는 응답에 절대 미포함. `hasBotToken` 만 노출 — UI 는 ref 의 존재만 알면 충분.

`spec/1-data-model.md §2.8` Trigger 의 `config` JSONB 설명 하단에 동일 cross-link 한 줄 추가.

---

### 5.5 Inbound HTTP Contract

`POST /api/hooks/:endpointPath` 의 chat channel 경로 (`config.chatChannel` 설정 트리거) 응답 정책은 다음 케이스 매트릭스로 정의된다. 일반 webhook 경로 (chatChannel 미설정) 는 [Spec Webhook §3.1](./12-webhook.md#31-webhook-수신-엔드포인트) 그대로 — 두 경로의 응답 정책 분리는 의도된 것 (provider 특성 차이, Rationale R-CC-12 참조).

| 케이스 | HTTP | 본문 | 어댑터 행동 |
|---|---|---|---|
| private chat → 정상 update (새 execution 시작) | `202 Accepted` | `{ executionId }` ([12-webhook §7 step 10](./12-webhook.md#7-처리-흐름) 와 동일 형식) | execution 시작 |
| private chat → 정상 update (기존 execution forwarding) | `202 Accepted` | `{ ignored: true }` ([12-webhook §7 step 7e](./12-webhook.md#7-처리-흐름) 와 정합) | InteractionService.interact 호출 (새 execution 미생성) |
| group/supergroup/channel chat | `202 Accepted` | `{ ignored: true }` | `languageHints.groupChatRefusal` 안내 sendMessage 발송 |
| `from.is_bot === true` (또는 Slack `bot_id` / Discord `member.user.bot === true`) | `202 Accepted` | `{ ignored: true }` | silent skip |
| `parseUpdate` 미지원 update type | `202 Accepted` | `{ ignored: true }` | silent skip ([12-webhook §7 step 7c](./12-webhook.md#7-처리-흐름) 와 동일) |
| **비활성 trigger (chatChannel 경로)** | **`202 Accepted`** | **`{ ignored: true }`** | silent skip — WH-EP-07 의 예외. 일반 webhook 경로는 여전히 410 Gone |
| 트리거 미존재 (잘못된 endpointPath) | `404 Not Found` | 표준 에러 envelope ([API Convention §5.3](./2-api-convention.md)) | — chatChannel 경로도 동일, [WH-RS-02](./12-webhook.md#3-api-명세) 와 일치. endpointPath 자체가 부재인 경우 2xx 는 stale webhook 영구 잔존을 유발 |
| Webhook 인증 실패 (Telegram `X-Telegram-Bot-Api-Secret-Token` 누락/불일치 · Slack `X-Slack-Signature` HMAC mismatch · Discord `X-Signature-Ed25519` verify 실패) | `401 Unauthorized` | 표준 에러 envelope | WH-SC-04 와 일치. chatChannel 비활성 트리거도 인증은 그대로 수행 — auth 실패 시 401 (Rationale R-CC-12 (d)) |
| 어댑터 내부 에러 (sendMessage 실패 등) | `202 Accepted` | `{ ignored: true }` 또는 `{ executionId }` (실패 단계에 따라) | 백그라운드 처리, `chat_channel_health='degraded'` 갱신 |
| **Slack URL Verification** (`type: "url_verification"`) | **`200 OK`** | `{ challenge: <받은 값> }` JSON | provider-specific 예외 (§5.5.1) — Slack 이 challenge 응답을 추출해야 함. [slack.md §3.1](../4-nodes/7-trigger/providers/slack.md#31-setupchannel-구체) 참조 |
| **Slack Interactivity ack** (`payload.type ∈ {block_actions, view_submission, ...}`) | **`200 OK`** | 빈 body 또는 `{ response_action }` | provider-specific 예외 (§5.5.1) — Slack 의 3초 ack 시한, `202` 미인정 |
| **Discord PING** (`type: 1`) | **`200 OK`** | `{ type: 1 }` JSON | provider-specific 예외 (§5.5.1) — Discord Interactions endpoint 등록 시 1회 + 주기적 발송. [discord.md §3.1](../4-nodes/7-trigger/providers/discord.md#31-setupchannel-구체) 참조 |
| **Discord Interactivity ack** (`type ∈ {2, 3, 5}`) | **`200 OK`** | `{ type: 5 | 6 }` (DEFERRED) 또는 `{ type: 4, data: {...} }` (immediate) | provider-specific 예외 (§5.5.1) — Discord 의 3초 ack 시한 |

`error envelope` 형식은 [Spec API Convention §5.3](./2-api-convention.md) (`{ error: { code, message, details? } }`) 단일 진실 참조.

### 5.5.1 Provider-specific 응답 예외 정책

`202 Accepted` 고정 정책의 예외 (Slack URL Verification / Slack Interactivity ack / Discord PING / Discord Interactivity ack) 는 다음 두 조건 모두 충족 시에만 허용된다:

1. **Provider 가 특정 응답 형식만 success 로 인정** — Telegram 처럼 2xx 자유가 아닌 case.
2. **Provider spec 본문에 사유와 응답 본문 형식이 명시** — `providers/<name>.md` §3.x 또는 §6 의 인라인 명시.

본 정책의 신규 case 추가는 provider spec 갱신 + 본 표 동시 갱신 의무 (Convention §7 변경 관리 정신 적용).

---

## 6. EIA 와의 관계 (단일 표 SoT)

| EIA 요구사항 | Chat Channel 위에서의 해석 |
|---|---|
| [EIA-NX-* outbound notification](./14-external-interaction-api.md#31-outbound-notification-notification-webhook) | 어댑터가 in-process subscriber. HTTP POST + HMAC 검증 단계 우회 (network round-trip 없음). `seq` 정렬·`X-Clemvion-Delivery` dedup 은 어댑터 코드 안에 내장 |
| [EIA-IN-* inbound interaction](./14-external-interaction-api.md#32-inbound-interaction-rest--sse) | 어댑터가 in-process caller. `submit_form` / `click_button` / `submit_message` / `end_conversation` / `cancel` 5종 동일 |
| [EIA-AU-* 인증](./14-external-interaction-api.md#33-인증) | 어댑터는 외부 토큰 family (`iext_*` / `itk_*`) 발급/검증을 우회 — [EIA-AU-08](./14-external-interaction-api.md#33-인증) 의 명시적 예외 조항 적용. EIA HTTP 표면은 외부 클라이언트 전용 |
| [EIA-RL-* 신뢰성](./14-external-interaction-api.md#34-신뢰성·일관성) | 동일 적용. 특히 EIA-RL-03 (form 검증 실패 시 waiting_for_input 유지) 가 CCH-MP-03 의 "그 필드만 재질문" 의 기반 |
| [EIA-NF-* 비기능](./14-external-interaction-api.md#35-비기능-요구사항) | latency 는 어댑터의 한 단계 추가 (CCH-NF-01 / CCH-NF-02). 채널 외부 API 호출이 추가되므로 EIA NF 위에 어댑터 NF 가 누적 |

---

## 7. 구현 파일 구조

```
codebase/backend/src/modules/
  chat-channel/
    chat-channel.module.ts
    channel-adapter.registry.ts            # provider 문자열 ↔ adapter 인스턴스
    chat-channel.dispatcher.ts             # NotificationDispatcher EventEmitter listener
    chat-channel.controller.ts             # POST /api/triggers/:id/chat-channel/rotate-bot-token
    channel-conversation.service.ts        # Redis ChannelConversation CRUD
    providers/
      telegram/
        telegram.adapter.ts                 # ChatChannelAdapter 구현
        telegram-client.ts                  # Bot API HTTP client
        telegram-update.parser.ts           # parseUpdate
        telegram-message.renderer.ts        # renderNode
        telegram.dto.ts
  hooks/
    hooks.controller.ts                    # 기존 — config.chatChannel 분기 추가
    hooks.service.ts                       # 기존 — adapter dispatch 추가
  triggers/
    triggers.service.ts                    # 기존 — setupChannel / teardownChannel 호출 추가
    dto/create-trigger.dto.ts              # 기존 — chatChannel 필드 추가
```

`chat-channel/` 모듈은 [`external-interaction/`](./14-external-interaction-api.md#10-구현-파일-구조) 모듈과 동등한 facade 계층에 위치한다 — 둘 다 엔진 외부.

---

## 8. 호환성

- `Trigger.config.chatChannel` 미존재 시 = 일반 webhook 트리거 (기존 동작 그대로). 기존 트리거 영향 없음.
- 신규 컬럼 5개 (`chat_channel_*`) 추가. NOT NULL DEFAULT 가 지정되어 있어 기존 row 영향 없음.
- 신규 endpoint `POST /api/triggers/:id/chat-channel/rotate-bot-token` 추가 — 기존 endpoint 변경 없음.
- 내부 `InteractionService.interact()` 의 메서드 시그니처는 그대로. `InteractionRequestContext` 에 `scope?: 'in_process_trusted'` optional 필드만 추가 (외부 HTTP guard 의 ctx 합성은 변경 없음).
- `NotificationDispatcher` 가 `EventEmitter` 인터페이스를 외부에 노출하는 메서드 (`onEvent(handler)` 등) 신설 — 기존 HTTP 발송 경로에는 변경 없음.

---

## Rationale

### R1. 새 트리거 유형 신설하지 않음 (2026-05-21)

대안:
1. **(채택) Webhook 트리거 + `chatChannel` config**: 트리거 유형 카탈로그 유지 (Manual / Webhook / Schedule 3종 그대로), 어댑터는 config 한 갈래. 사용자 멘탈모델 = "텔레그램 어댑터를 켠 Webhook 트리거".
2. **(기각) `Chat Channel Trigger` 신규 노드**: 트리거 종류가 N+1 로 늘어남. webhook 트리거와 90% 공통이라 코드 중복.
3. **(기각) 어댑터 인터페이스 X, 텔레그램 1급 모듈**: Slack/카카오 요청 시 같은 모듈 N개 반복. 인터페이스를 1개 추상으로만 두면 layer 1개로 차단됨.

근거: 사용자 명시 입장 + EIA spec 의 facade 원칙과 정합. Schedule 트리거는 본 spec 의 chatChannel 옵션을 사용하지 않으므로 (외부 chat 플랫폼의 inbound update 가 아니라 cron 기반 fire) 영향 없음.

### R2. Chat Channel 을 EIA 의 consumer 로만 위치 (2026-05-21)

EIA HTTP 표면을 새로 만들지 않고 in-process facade 호출만 사용. 이유:
- HTTP round-trip 회피 (latency CCH-NF-02 200ms 안에 들어가려면 round-trip 1회 절감 필요)
- 토큰 발급/검증 우회 — 어댑터는 trusted in-process caller
- 단일 inbound 명령 facade ([EIA §10 `external-interaction.module.ts`](./14-external-interaction-api.md#10-구현-파일-구조)) 가 외부 HTTP 와 in-process 호출 둘 다 수용

대안 (기각): 어댑터도 EIA HTTP endpoint 를 호출 — 동일 process 안에서 자기 HTTP 표면을 호출하는 의미 없는 round-trip + 토큰 사이클 부담.

### R3. v1 single-user DM 만 지원 (2026-05-21)

group chat 은 multi-user 매핑이 복잡 (어느 사용자가 답한 것? `conversation thread metadata.userKey` 가 단일 값 가정과 충돌). v1 은 1:1 DM 만 — group chat 은 어댑터가 명시적으로 거부. 후속 v2 에서 multi-user thread 도입 시 재논의.

### R4. NotificationDispatcher EventEmitter subscription 메커니즘 (2026-05-21)

대안:
1. **(채택) NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener 로 attach**: 같은 process 안에서는 외부 인프라 없이 가장 단순. NotificationDispatcher 의 after-commit hook 가 이미 단일 진입점.
2. **(기각) Redis pub/sub**: 같은 process 안에서는 round-trip 낭비. 다중 인스턴스 환경에서는 어차피 NotificationDispatcher 자체가 외부 HTTP 호출로 fan-out 하므로, 어댑터 sub 도 같은 process 의 listener 로 attach 하면 됨.
3. **(기각) 별 after-commit hook 추가**: 엔진 §4.4 의 단일 sink 정책 위반 — 어댑터가 엔진 코드를 알아야 함.

근거: EIA §R10 의 "엔진 외부 facade 단일 위치" 원칙 유지 + 단순한 구현 (`emitter.on('execution.waiting_for_input', adapter.onEvent)`).

SSE 어댑터의 Redis pub/sub 경로와의 병존은 §3.3 명시.

### R5. provider 디렉토리 위치 — `4-nodes/7-trigger/providers/` (2026-05-21)

대안:
1. **(채택) `4-nodes/7-trigger/providers/<name>.md`**: 트리거 노드 컨텍스트 안에서 발견 가능. 같은 폴더 안에 `0-common.md` / `1-manual-trigger.md` 와 형제 위치 — 자연스러운 navigation.
2. **(기각) `5-system/chat-channel-providers/<name>.md`**: chat-channel 자체는 시스템 레이어 (15-) 지만 어댑터 구체는 트리거 config 갈래라서 시스템 레이어보다는 트리거 영역에 더 가깝다.
3. **(기각) `conventions/chat-channel-providers/<name>.md`**: convention 은 형식 규약 (cafe24-api-metadata 와 유사). 텔레그램 어댑터는 형식이 아니라 구체 구현 명세 — convention 이 아님.

providers 서브디렉토리에는 v1 단계에서 `_overview.md` 1개 + `telegram.md` 1개로 시작. 두 번째 provider (Slack 등) 가 추가될 때 `_overview.md` 를 갱신해 catalog 패턴으로 발전.

### R6. `chat-channel-adapter.md` 를 `spec/conventions/` 에 두는 정당화 (2026-05-21)

`spec/conventions/` 는 **다른 spec 이 참조하는 형식·인터페이스 규약** 을 모은다. 기존 거주자:
- `node-output.md` — 모든 노드 핸들러가 따르는 출력 5필드 규약
- `conversation-thread.md` — AI Agent / Presentation 노드가 따르는 thread 자료구조 규약
- `cafe24-api-metadata.md` — 모든 Cafe24 endpoint 메타데이터의 row shape 규약

`chat-channel-adapter.md` 는 **모든 channel provider 어댑터가 구현해야 하는 6함수 인터페이스 + 데이터 타입 union** 을 정의 — 위 세 거주자와 같은 layer (= "복수 구체 구현이 따르는 공통 계약"). 세 spec 의 역할 분리:

| 파일 | 역할 |
|---|---|
| `conventions/chat-channel-adapter.md` | **함수 시그니처 + 데이터 타입 계약** (다중 provider 의 공통 SoT) |
| `5-system/15-chat-channel.md` (본 spec) | **시스템 동작·lifecycle·EIA 관계·요구사항 ID** (구현 무관 시스템 정의) |
| `4-nodes/7-trigger/providers/telegram.md` | **텔레그램 어댑터의 구체 구현 명세** (Bot API 매핑, 명령, UI 매핑) |

이 분리는 cafe24 의 [`conventions/cafe24-api-metadata.md`](../conventions/cafe24-api-metadata.md) (형식 규약) + [`4-nodes/4-integration/4-cafe24.md`](../4-nodes/4-integration/4-cafe24.md) (시스템·노드 정의) + [`conventions/cafe24-api-catalog/`](../conventions/cafe24-api-catalog/) (구체 endpoint 카탈로그) 의 3분할과 동일한 구조다.

### R7. `rotate-bot-token` 동사 (2026-05-21)

EIA 의 [`notification/rotate-secret`](./14-external-interaction-api.md#31-outbound-notification-notification-webhook) (HMAC signing secret rotation) 와 다른 자원이므로 `rotate-secret` 동사 재사용은 의미 혼동을 유발한다. `rotate-bot-token` 으로 명시화하면 URL 만으로 어떤 자원의 rotation 인지 즉시 식별 가능. [`spec/5-system/2-api-convention.md`](./2-api-convention.md) 의 RPC 스타일 (`/notification/rotate-secret`, `/interaction/revoke-token`) 과 동일 패턴 (`/<resource>/<verb>-<noun>`).

### R8. NotificationDispatcher 분리 — provider 증가 시점에 재검토 (2026-05-22)

현재 v1 설계에서 `NotificationDispatcher` 는 세 가지 fan-out 갈래를 단일 클래스에 담는다:

1. **외부 HTTP POST** (`EIA-NX-*`) — `notification.url` 등록 trigger 에 대한 outbound webhook
2. **Redis pub/sub** — 다중 인스턴스 환경의 SSE 어댑터 fan-out
3. **In-process EventEmitter** — Chat Channel 어댑터 in-process subscriber (CCH-AD-05)

이 단일 클래스 구조는 v1 의 단순함을 우선한 의도된 결정 (R4 NotificationDispatcher subscription 메커니즘). 하지만 (a) Chat Channel provider 가 2개 이상으로 늘어나거나 (b) 새 in-process subscriber 유형이 추가될 때는 `ChannelDispatcher` (EventEmitter 전담 in-process bus) 를 `NotificationDispatcher` 에서 분리하는 리팩토링이 권장된다 — 단일 책임 원칙 + 테스트 격리.

**리스너 dedup / 라이프사이클 정책 — v1 vs v2 적용 시점**:

- **v1 (현 구조)**: `ChatChannelDispatcher` 가 `WebsocketService.executionEvents$` Subject 를 모듈 단위 1회만 subscribe (`onModuleInit`) → 모듈 종료 시 unsubscribe (`onModuleDestroy`). 모든 trigger event 가 동일 listener 로 들어와 dispatcher 내부에서 `trigger.config.chatChannel` 분기 처리. **per-trigger listener 가 없으므로 dedup 자체가 무의미** — 정책은 향후 분리 시점에 적용.
- **v2 (provider ≥ 2 분리 후)**:
  - `setupChannel()` 호출 시 동일 `triggerId` 의 기존 in-process listener 가 있으면 제거 후 새 listener 등록 — `setupChannel` 의 멱등성 ([Convention §1.1](../conventions/chat-channel-adapter.md#11-6함수-책임--부작용--멱등성)) 보장.
  - `teardownChannel()` 호출 시 해당 `triggerId` 의 listener 를 반드시 해제 — 누락 시 비활성화된 trigger 에 메시지 중복 발송 위험.
  - listener 등록은 항상 `(triggerId, provider)` 단위 키. 같은 trigger 가 provider 를 바꾸는 경우는 미지원 (재생성으로 처리) — listener key 충돌 가능성 차단.

후속 추적: 위 분리 리팩토링은 두 번째 provider (Slack / KakaoTalk 등) 도입 결정 시 `chat-channel-dispatcher-split` plan 으로 진입. plan 자체는 본 PR 에서 stub 신설 완료, **trigger 조건 미충족 상태** 로 보류.

### R9. CCH-CV-03 `running` 케이스의 큐잉 vs 즉시 안내 (2026-05-22)

대안:
1. **(채택) 즉시 안내 + update 무시 (큐 미적재)**: `running` / `pending` 구간이 일반적으로 짧고 (수 초 ~ 수십 초), 사용자가 다음 입력 시점은 대개 `waiting_for_input` 도달 후이다. 사용자 메시지를 큐에 적재했다가 `waiting_for_input` 도달 시 재발사하면 (a) execution 의 input 시퀀스 가정과 충돌 가능 (워크플로우 노드가 그 입력을 기대하지 않은 시점에 입력 사건 발생), (b) 사용자가 같은 메시지를 두 번 보낸 경우 dedup 책임 모호.
2. **(기각) Redis 큐에 임시 적재 → `waiting_for_input` 도달 시 자동 재발사**: 위 (a)/(b) 이슈 + 큐 TTL / 폐기 정책 / 순서 정렬 등 추가 메커니즘 필요. v1 의 단순성과 어긋남.
3. **(기각) `waiting_for_input` 도달까지 HTTP 연결 보류**: WH-NF-01 의 200ms 응답 시한과 정면 충돌. 텔레그램이 webhook 응답 지연 시 retry 폭주.

근거: v1 단순성 + 사용자 mental model ("처리 중에 보낸 메시지는 다시 보내야 함" 이 봇 UX 의 일반적 기대). [CCH-NF-03](#35-비기능-요구사항) 의 rate-limit 큐 정책은 **다른 트리거 조건** (`분당 60건 초과 시 적재`) 으로, 본 케이스 (`execution running 중 사용자 메시지 도착`) 와 정책 방향이 다른 것은 정당하다 (전자는 외부 사용자 폭주 방어, 후자는 execution life-cycle 정합).

후속 단순화 (v2): `waiting_for_input` 직전 노드가 LLM 호출 등 긴 latency 인 경우 사용자가 답답함을 느낄 수 있음 — `sendChatAction(typing)` 주기적 발송 정책을 별 plan 으로 검토.

### Rationale ID 컨벤션 (2026-05-23)

본 절 신규 항목은 **`R-CC-N` prefix** (`CC` = Chat Channel) 를 사용한다. 본 파일에는 `[EIA §R10]` 등 외부 spec 의 Rationale 참조가 다수 있어 (line 33, 138, 353 등), 신규 로컬 Rationale 에 prefix 없는 `R10/R11/R12` 를 쓰면 검토자가 외부 참조와 혼동할 위험이 있어 prefix 채택. 기존 `R1~R9` / `R-K` 는 하위 호환 위해 그대로 유지 (rename 시 cross-link 깨짐 위험).

### R-CC-10. Bot Token 변경 single-path (rotate API only) (2026-05-23)

대안:
1. **(채택) single-path**: 토큰 변경은 항상 `POST /api/triggers/:id/chat-channel/rotate-bot-token`. PATCH body 의 `botTokenRef` 변경은 차단.
2. **(기각) PATCH + rotate 양쪽 허용**: [`spec/2-navigation/2-trigger-list.md` Rationale R-2](../2-navigation/2-trigger-list.md#r-2-webhook-hmac-secret-입력-vs-rotate-분리-2026-05-22) 의 hmacSecret 패턴과 정렬되나, 자원 성격이 다르다 — hmacSecret 는 우리가 보유한 server-side HMAC signing secret 으로 PATCH 직접 교체 시 외부 수신자 (cafe24 등) 가 새 키를 동기화하기 전에 검증 실패 ↔ botToken 은 외부 provider (텔레그램) 측에 등록된 토큰으로, PATCH 직접 교체는 우리 DB 만 갱신하고 텔레그램 측은 그대로라 수신이 즉시 깨짐. PATCH 와 rotate 의 두 경로 공존 시 grace 24h 정책 일관성 깨짐 + audit log mixing.
3. **(기각) PATCH 만 허용**: rotate API 의 24h grace 기능 (CCH-SE-04) 이 제공하는 무중단 회전을 잃음.

근거: R-2 와 다른 결론을 내리는 정당화는 **자원의 위치 (server-side 보유 vs external provider 측 등록)** 차이. single-path 는 grace 정책 일관성·audit log 단일성·UX 명확성 모두 확보.

### R-CC-11. `uiMapping.visualNode` enum 교체 (`text_only`→`text` + `auto` 신설) (2026-05-23)

대안:
1. **(채택) 3-enum** (`"text" | "photo" | "auto"`, default `"auto"`): default 가 합리적 휴리스틱 (chart/table → text, carousel imageUrl 있으면 photo). 사용자가 명시적으로 선택하지 않아도 합리적 동작. text_only → text rename 으로 photo / auto 와 동급 단어 통일.
2. **(기각) 2-enum 유지** (`"photo" | "text_only"`): default 가 명확하지 않음. v2 SSR 인프라 도입 시 photo 가 default 가 되는 게 자연스러우나 v1 단계에서는 photo fallback to text 가 필요해 default 결정이 모호.
3. **(기각) `auto` 만 단일 mode**: 사용자가 강제로 text 또는 photo 를 원할 때 (예: 데이터 가독성 우선 / 시각적 임팩트 우선) 표현 못함.

세부:
- (a) `text_only` → `text` rename: 영문 일관성 (`photo` / `auto` 와 동급 단어). 운영 영향은 어댑터의 read-time normalize (`text_only` → `text`) 로 흡수.
- (b) `auto` 신설: v1 단계에서도 사용자가 사전 판단 없이 합리적 default 동작을 받도록 한다.
- (c) chart/table 의 `auto` 동작이 v2 에서도 text 우선인 이유: 데이터 정밀도가 PNG 보다 monospace text 가 더 가독적 (수치 정확 표시).
- (d) `photo` v1 fallback 의 health 변경 없음 이유: `chatChannelHealth=degraded` 는 외부 API 실패 신호. v1 인프라 미도입은 사용자 error 가 아니라 정상 fallback.
- (e) `text` enum 의 carousel imageUrl 무시 이유: 사용자가 명시적으로 "텍스트만" 을 선택했으므로 imageUrl 이 있어도 `sendMessage` 만 발송 (UX 의도 존중). `auto` 는 imageUrl 있으면 `sendPhoto` 로 자동 분기.

`spec/conventions/chat-channel-adapter.md §7` (변경 관리) 의 "두 외부 spec 동시 갱신 의무" + 컨벤션 파일 자체 = 3 파일을 한 commit 으로 묶음. `providers/_overview.md` catalog 는 provider 목록 변경이 아니라 enum 한 필드 변경이라 갱신 불필요 (Convention §7 의 catalog 갱신 조항은 provider 추가/제거 시점에 적용).

### R-CC-12. Inbound HTTP Contract — `202 Accepted` 고정 + `401` (auth) / `404` (endpointPath) 예외 (2026-05-23)

대안:
1. **(채택) `202 Accepted` 고정 + `401` (auth 실패) + `404` (endpointPath 미존재)**: 기존 [12-webhook.md §7 step 7c·step 10](./12-webhook.md#7-처리-흐름) 가 이미 `202 Accepted` 를 SoT 로 정의 — spec 일관성 유지.
2. **(기각) `200 OK` 신규 도입**: 텔레그램은 2xx 응답을 모두 success 로 인식하므로 200/202 차이는 텔레그램 측에 무관. 신규 도입 시 §7 step 7c 도 함께 변경해야 하는데 그게 더 큰 변경 — 변경 최소화 원칙 위배.
3. **(기각) WH-EP-07 의 410 Gone 정책 그대로 적용**: chat-channel provider 가 non-2xx 응답 시 webhook 자동 비활성화 + retry 폭주를 유발 (Telegram Bot API documented behavior). 운영 영향 큼.

세부:
- (a) **`202` 고정 (200 대신) 이유**: [WH-RS-01](./12-webhook.md#4-비기능-요구사항) (202 Accepted 가 webhook 수신 응답 표준) 와 정합. 기존 SoT 채택.
- (b) **2xx 고정 이유**: 텔레그램 Bot API 가 non-2xx 응답 시 webhook 자동 비활성화 + retry 폭주. 일반 webhook 경로의 410 Gone 정책 (WH-EP-07) 은 외부 호출자가 사람이거나 일반 HTTP client 인 가정 — chat-channel provider 는 그 가정에서 벗어남.
- (c) **WH-EP-07 의 일반 정책 유지 이유**: chatChannel 미사용 webhook 트리거 (cafe24, custom HTTP 클라이언트 등) 는 명시적 404/410 응답이 디버깅·UX 에 필요. 두 경로의 응답 정책 분리는 정당하다 (provider 특성 차이). 본 결정은 [12-webhook.md](./12-webhook.md) 의 "처리 흐름 분기만 정의" 범위 안에 포함됨 (chatChannel 분기가 기존 `config.chatChannel` 유무 분기의 자연스러운 확장).
- (d) **auth 실패 401 의 이유**: silent 2xx 도 가능하나 (a) 공격자가 brute-force 시 차이를 알 수 없게 하는 보안 이점은 있음. 그러나 운영자가 "왜 봇이 응답 안 함" 디버깅 시 401 가시성이 필요. (b) 텔레그램은 secret_token 검증 실패 시 retry 하지 않음을 documented behavior 로 의존 — non-2xx retry 폭주 위험 없음.
- (e) **404 케이스는 일반 webhook 경로와 동일** — endpointPath 자체가 존재하지 않으면 2xx 가 stale webhook 무한 잔존을 유발 ([WH-RS-02](./12-webhook.md#3-api-명세) 와 동일 정책).

### R-K. `chat_channel_token_v2` 컬럼 명명의 semantic 비대칭 (2026-05-21)

`notification_secret_v2` 는 HMAC signing secret 의 v2 (rotation grace 기간 신규 secret), `chat_channel_token_v2` 는 외부 provider bot token reference 의 v2 (rotation grace 기간 신규 token). 두 컬럼은 의미상 직교 (signing secret vs external bot token) 하지만 **명명 패턴은 동일 유지** (`<channel>_<resource>_v2`). 명명 일관성 우선 — 의미 차이는 컬럼 description 으로 명시. 향후 공용 rotation 패턴 통합 검토 시 두 컬럼 모두 영향.

### R-CC-13. Discord v1 의 CCH-MP-01 부분 유예 — Interactions Webhook only 의 결과 (2026-05-24)

[CCH-MP-01](#33-노드--채널-ui-매핑) 은 "AI Multi Turn 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환" 을 **필수** 요구사항으로 정의한다. Discord provider v1 ([`providers/discord.md` R-D-3](../4-nodes/7-trigger/providers/discord.md#r-d-3-v1--interactions-webhook-only-gateway--v2-2026-05-24)) 은 Interactions Webhook only 정책 (Gateway WebSocket 미사용) 결과 [Discord `MESSAGE_CREATE` event](https://discord.com/developers/docs/topics/gateway-events#message-create) 를 수신할 수 없다. 따라서:

- **Outbound (서버 → 사용자)**: CCH-MP-01 outbound 의무 완전 충족 — `POST /channels/{id}/messages` 로 `execution.ai_message` 전송 가능 (Discord §5.1).
- **Inbound (사용자 → 서버)**: 자유 텍스트 reply 입력 경로가 제약됨. 사용자 reply 는 **(a) `/<prefix> reply <message>` slash command text option** 또는 **(b) Modal TEXT_INPUT (`Reply` button 클릭 후)** 으로만 가능 — 일반 DM 텍스트 (`MESSAGE_CREATE`) 미수신.

이는 CCH-MP-01 의 "AI Multi Turn 의 자연 대화" UX 가 Discord v1 에서 **Telegram / Slack 과 다른 입력 흐름** 으로 동작함을 의미한다. 본 spec 의 CCH-MP-01 정의 자체는 미변경 (provider 가 의무를 충족하는 방식의 차이) — Discord provider spec 의 §5.1 + R-D-3 에서 자기 부분 유예를 normative 하게 기술. 완전 자연 대화는 v2 Gateway plan ([`chat-channel-discord-gateway`](../../plan/in-progress/chat-channel-discord-gateway.md) — 후속 trigger) 진입 시 해소.

대안 (기각):
- CCH-MP-01 본문에 "Gateway 미사용 provider 는 모달/slash 입력 허용" 예외 절 추가 — provider 한계가 시스템 spec 에 누수. R-D-9 의 동일 정신 (provider 한계는 provider spec Rationale 에).
- Discord v1 도 Gateway 도입 — R-D-3 기각 사유 (long-lived connection 관리 부담) 그대로 적용.

### R-CC-14. PR #300 정합 catch-up — CCH-AD-01 의 "impl pending" 문구 제거 (2026-05-24)

`§3.1 CCH-AD-01` 의 "v1 supported: `telegram` / v1 spec-defined: `slack`, `discord` — impl pending" 진술이 PR #300 (`feat(chat-channel): slack + discord providers (v1 supported)`) 머지 후 stale 상태로 남아 있었다. `_overview.md §1` 은 PR #300 시점부터 셋 다 `supported (v1)` 로 표기되어 있어 두 spec 문서가 같은 사실에 대해 상반된 상태를 기술하는 spec-internal drift 가 발생했다.

본 catch-up:
- CCH-AD-01 의 "v1 supported: telegram / v1 spec-defined: slack, discord — impl pending" → "v1 supported: telegram / slack / discord — 2026-05-24 갱신, PR #300 정합"
- 새 결정 신설·기존 결정 번복 아님. `_overview.md §1` 의 supported 선언이 단일 진실 — 본 spec 은 정합 cross-link.

발견 경로: `plan/in-progress/trigger-create-multi-provider-ui.md` 의 GUI 구현 착수 직전 `/consistency-check --impl-prep` (`review/consistency/2026/05/24/18_21_47/SUMMARY.md` C-2) 가 BLOCK. 사용자 결정 (2026-05-24) 으로 본 구현 PR 안에 spec 정정 commit 을 함께 포함.
