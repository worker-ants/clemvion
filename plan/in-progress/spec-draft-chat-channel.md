---
worktree: chat-channel-telegram-0c106c
started: 2026-05-21
owner: project-planner
---

# Spec Draft: Chat Channel 어댑터 + Telegram 첫 구현

본 draft 는 5개 spec 변경(3 신설 + 2 개정)의 핵심 결정과 본문 요지를 정리한다. `consistency-check --spec` 호출 후 `spec/` 로 반영한다.

---

## 1. 배경 / 합의된 설계

사용자가 텔레그램 봇 토큰만 등록하면 워크플로우가 **챗봇처럼 동작**하는 통합 기능을 원함. 현재 [External Interaction API (EIA)](../../spec/5-system/14-external-interaction-api.md) 가 generic webhook + notification + REST/SSE 표면을 제공하지만, 사용자가 텔레그램 ↔ EIA 변환층을 직접 운영해야 함 (= 현재 "프론트오피스 별도 시스템 구축"). 이 변환층을 서버사이드 어댑터로 격리해 사용자 부담을 0으로 만드는 것이 목표.

**합의된 설계 결정** (사용자 turn 1~2 에서 확정):

1. **새 트리거 유형 추가 X** — Webhook 트리거 `config` 에 `chatChannel` 옵션을 얹는 형태. 트리거 유형 카탈로그는 Manual / Webhook 2종 그대로 유지.
2. **Chat Channel 은 EIA 의 consumer** — outbound notification 구독 + inbound `interact` REST 호출만 사용. 새 명령 경로·새 토큰 family 도입 금지.
3. **첫 어댑터는 Telegram**. 후속 Slack/카카오/Discord 가 같은 인터페이스로 확장 가능하도록 일반화.
4. **인터랙션 노드 4종 모두 1차에 매핑** — AI Multi Turn / Button Presentation / Form / Carousel·Chart·Table.

---

## 2. 변경 대상 spec (6개)

### 2.1 신설 — `spec/5-system/15-chat-channel.md`

Chat Channel 의 **일급 시스템 컨셉**. adapter lifecycle, identity/conversation 매핑, EIA 와의 관계, 비기능 요구사항.

### 2.2 신설 — `spec/conventions/chat-channel-adapter.md`

Adapter 가 구현해야 하는 **6함수 규약** (`parseUpdate` / `setupChannel` / `teardownChannel` / `renderNode` / `sendMessage` / `ackInteraction`) + 데이터 타입 (`ChannelUpdate`, `ChannelMessage`, `ConversationKey`, `EiaEvent` union).

### 2.3 신설 — `spec/4-nodes/7-trigger/providers/telegram.md`

**텔레그램 어댑터의 구체 정의** — Bot API 호출 (`setWebhook` / `sendMessage` / `answerCallbackQuery` / `sendPhoto` / `sendChatAction`), inline keyboard 매핑, callback_query 처리, 4096자 분할, `/start` · `/cancel` 명령, group chat 거부, 4종 노드의 UI 매핑.

> 위치 선택: `4-nodes/7-trigger/` 아래에 `providers/` 서브디렉토리를 신설. 다른 provider (Slack, 카카오) 가 추가될 때 같은 서브디렉토리에 형제 파일로 추가. `cafe24-api-catalog/` 가 `conventions/` 아래에 서브디렉토리를 둔 패턴을 참고 (확장형 카탈로그). 트리거 노드 자체 spec (`1-manual-trigger.md` 등) 과 provider 어댑터를 같은 폴더에 두는 이유는 채널 어댑터가 Webhook 트리거의 config 한 갈래로만 존재하기 때문 — 별도 노드가 아니라 트리거 설정의 종속 객체.
>
> providers 서브디렉토리에는 v1 단계에서는 `telegram.md` 1개만 두고, 신규 provider 가 추가될 때 인덱스 파일 (`_overview.md`) 신설 여부를 재논의. 단일 provider 단계에서 인덱스 파일은 over-engineering.

### 2.4 개정 — `spec/5-system/12-webhook.md`

- §2.2 `config` JSON 에 `chatChannel` 필드 추가.
- §3.4 관리 표에 `WH-MG-08` 행 추가 (chatChannel 옵션 — Chat Channel spec 으로 위임).
- §3.3 처리 흐름 다이어그램에 chatChannel 분기 추가 — `parseUpdate` 완료 후 `202 Accepted` 즉시 반환 시점을 명시 (W4 해소).
- Rationale 에 한 행 추가 (위치 결정 근거는 15-chat-channel 의 Rationale 로 위임).

### 2.5 개정 — `spec/5-system/14-external-interaction-api.md`

- §2 사용 시나리오 표에 새 행 "Chat Channel via Webhook (Telegram 등)" 추가. **기존 "외부 챗봇 위에 워크플로우 얹기" 행은 유지** ("사용자가 직접 변환층 구현 (advanced)" 로 정제). 사용자가 어댑터 없이도 EIA 를 직접 소비하는 케이스가 여전히 유효 (W3 해소).
- §3.3 **신규 행 추가** — `EIA-AU-08`: **In-process trusted caller (Chat Channel 어댑터 등) 는 토큰 발급/검증을 우회할 수 있다**. 우회는 `InteractionService.interact()` (현행 public 메서드, 코드 SoT 확인) 의 in-process 직접 호출 경로에 한정되며, HTTP 표면을 거치지 않는다. 외부 HTTP 호출은 EIA-IN-06 의 `interaction token` 인증을 그대로 따른다 (C1 해소).
- §R4 의 "Telegram bot 사용 시 per_trigger 가 편하다" 예시를 **수정** — "사용자가 직접 변환층을 구현하는 advanced 케이스 한정. 서버사이드 어댑터 ([Spec Chat Channel](./15-chat-channel.md)) 가 있는 경우는 토큰 사이클 자체가 우회되므로 해당 없음." (C1 해소)
- §R10 (단일 sink 정책의 확장) 에 한 줄 추가 — "Chat Channel adapter 도 NotificationDispatcher 와 **동일 facade 계층** 의 추가 in-process subscriber 로 위치. 엔진 내부를 직접 우회하지 않으며, 실행 엔진 §4.4 의 단일 sink 정책을 깨지 않는다. 구독 메커니즘은 NotificationDispatcher 의 **after-commit hook** 가 노출하는 in-process EventEmitter 를 어댑터가 listener 로 attach 하는 방식 (Redis pub/sub 우회 — 같은 process 안에서는 EventEmitter 가 충분)." (C2 해소)

### 2.6 개정 — `spec/1-data-model.md` (신규 변경 대상)

- §2.8 Trigger 필드 표에 `chat_channel_*` 5개 컬럼 행 추가 (`chat_channel_health` / `chat_channel_last_error` / `chat_channel_setup_at` / `chat_channel_token_v2` / `chat_channel_rotated_at`). `notification_*` 컬럼과 동일 패턴 (W1·I12 해소 — `_v2_ref` 가 아니라 `_v2` 로 통일).
- §2.8 의 `config` 필드 설명에 `chatChannel` 서브 필드를 추가 — Chat Channel spec §3.4.1 로 위임 (cross-link).

---

## 3. 15-chat-channel.md 본문 핵심

### 3.1 Overview

- "Chat Channel" 정의 — 사용자가 운영하는 외부 chat 플랫폼 (Telegram, Slack, 카카오 등) 의 update ↔ 워크플로우 input/output 을 양방향 변환하는 서버사이드 어댑터.
- EIA 와의 관계: Chat Channel 은 EIA outbound notification 의 in-process subscriber + EIA inbound interact 호출의 in-process caller. 새 인증 family / 새 endpoint 도입 안 함.
- 트리거 유형 추가 안 함 — Webhook 트리거의 `config.chatChannel` 한 갈래로만 존재.

### 3.2 요구사항 (CCH-* prefix)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-AD-01 | Webhook 트리거 `config.chatChannel` 의 `provider` 필드로 어댑터 선택 (v1: `telegram`) | 필수 |
| CCH-AD-02 | Trigger enable / 신규 생성 시 어댑터의 `setupChannel()` 자동 호출 (텔레그램은 `setWebhook`) | 필수 |
| CCH-AD-03 | Trigger disable / 삭제 시 어댑터의 `teardownChannel()` 자동 호출 | 필수 |
| CCH-AD-04 | Webhook 진입점 (`POST /api/hooks/:endpointPath`) 핸들러는 `config.chatChannel` 가 있으면 raw body 를 `parseUpdate(raw)` 로 통과시켜 워크플로우 input 으로 변환 | 필수 |
| CCH-AD-05 | EIA outbound notification 의 `execution.waiting_for_input` / `execution.ai_message` / `execution.completed` / `execution.failed` / `execution.cancelled` 이벤트를 어댑터가 **NotificationDispatcher 의 after-commit EventEmitter 에 in-process listener 로 attach** → `renderNode(payload)` → `sendMessage()` 호출. 실행 엔진 §4.4 단일 sink 정책을 깨지 않음 (어댑터는 NotificationDispatcher 와 동일 facade 계층). [EIA §R10](../../spec/5-system/14-external-interaction-api.md#r10-websocketservice-단일-sink-정책의-확장-2026-05-21) | 필수 |
| CCH-AD-06 | 인터랙션 응답 (텔레그램 reply / inline_keyboard tap / 다단계 form answer) 도착 → 어댑터가 `InteractionService.interact(ctx, dto)` (현행 public 메서드, [코드 SoT](../../codebase/backend/src/modules/external-interaction/interaction.service.ts)) 를 **in-process 직접 호출**. HTTP 표면을 거치지 않음 (network round-trip 회피 + 토큰 발급 우회). 우회 정당화는 [EIA §3.3 EIA-AU-08](../../spec/5-system/14-external-interaction-api.md#33-인증) — trusted in-process caller 예외 | 필수 |
| CCH-CV-01 | 채널의 `(provider, conversationKey)` ↔ 워크스페이스 conversation thread 1:1 매핑 (텔레그램: `(bot_id, chat_id)`) | 필수 |
| CCH-CV-02 | 첫 메시지 또는 `/start` 명령 도착 시 conversation thread 자동 생성 + 워크플로우 신규 execution 시작 | 필수 |
| CCH-CV-03 | 같은 conversation 의 두 번째 이후 메시지는 **활성 execution 이 `waiting_for_input` 상태이면** 인터랙션 명령으로 forwarding, **종료된 execution 이면** 새 execution 시작 | 필수 |
| CCH-CV-04 | conversation thread metadata 에 `channelUserKey` (텔레그램: `user_id`) 저장 — multi-user 확장 대비 | 권장 |
| CCH-CV-05 | v1 은 single-user DM 만 지원. group chat update 는 어댑터가 거부 (sendMessage 로 안내 후 noop) | 필수 |
| CCH-MP-01 | AI Multi Turn 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환 (provider 별 길이 제한 분할) | 필수 |
| CCH-MP-02 | Button Presentation 의 `execution.waiting_for_input` (interactionType=buttons) → 채널의 inline keyboard 로 변환. tap → `click_button` 명령 | 필수 |
| CCH-MP-03 | Form 의 `execution.waiting_for_input` (interactionType=form) → 다단계 prompt 시퀀스 (필드별 한 줄 질문). 검증 실패 시 그 필드만 재질문 ([EIA-RL-03](../../spec/5-system/14-external-interaction-api.md#34-신뢰성·일관성)) | 필수 |
| CCH-MP-04 | Carousel / Chart / Table 의 `execution.waiting_for_input` → 서버사이드 이미지 렌더 + caption + 텍스트 fallback. Chart 는 기존 SVG→PNG 재사용, Carousel/Table 은 SSR (후속 PR 분리 권장) | 필수 |
| CCH-MP-05 | Form 필드 `type` 별 채널 keyboard hint — `number` → 숫자 키패드, `phone` → share_contact, `file` → upload prompt 등. 없는 keyboard 는 일반 text input | 권장 |
| CCH-SE-01 | 어댑터의 외부 API 호출 (sendMessage 등) 에 5초 타임아웃 + 3회 지수 백오프 재시도. 최종 실패 시 EIA 의 `notificationHealth=degraded` 패턴 차용 | 필수 |
| CCH-SE-02 | 인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급 (텔레그램 `update_id` 기반) | 필수 |
| CCH-SE-03 | 어댑터의 외부 API secret (텔레그램 bot token) 은 trigger config 의 별도 encrypted 컬럼 (또는 secret reference) 에 보관. config JSONB 평문 금지 | 필수 |
| CCH-SE-04 | Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) — old token 은 24h grace 동안 병행 받음 (텔레그램의 경우 setWebhook 재호출). 동사를 `rotate-bot-token` 으로 명시화한 이유는 EIA 의 `rotate-secret` (HMAC signing secret) 과 의미가 다른 자원 (외부 provider bot token) 임을 URL 만으로 식별 가능하게 하기 위함 (W2 해소) | 권장 |
| CCH-NF-01 | 어댑터의 inbound 변환 latency: parseUpdate ↔ 워크플로우 input 평균 50ms 이내 | 필수 |
| CCH-NF-02 | 어댑터의 outbound 변환 latency: EIA notification 수신 ↔ 채널 sendMessage 호출 평균 200ms 이내 | 필수 |
| CCH-NF-03 | 채널당 분당 최대 60건 inbound (텔레그램 Bot API 의 rate limit 과 정합) | 필수 |

### 3.3 처리 흐름 다이어그램

```
[Telegram 사용자]
   │ /start
   ▼
[Telegram Bot API] ── webhook ──▶ [POST /api/hooks/:endpointPath]
                                           │
                                           ▼
                                  HooksController.handle()
                                           │
                                config.chatChannel ? yes
                                           │
                                           ▼
                                  TelegramAdapter.parseUpdate(raw)        ◀── 50ms 이내 (CCH-NF-01)
                                           │
                                  ┌────────┴────────┐
                                  │                 │
                              새 conversation   기존 conversation
                                  │                 │
                                  ▼                 ▼
                            ExecutionEngine    InteractionService.interact()
                            .execute()              (in-process,
                              (kicked off)          token bypass — EIA-AU-08)
                                  │                 │
                                  └────────┬────────┘
                                           │
                                           ▼
                                  HTTP `202 Accepted` 즉시 반환     ◀── WH-NF-01 200ms 이내
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
                                  TelegramAdapter.renderNode(payload)     ◀── 200ms 이내 (CCH-NF-02)
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

> **사이드 채널 명시**: 어댑터의 outbound subscription 은 **NotificationDispatcher 가 노출하는 in-process EventEmitter** 의 listener 로 attach (Redis pub/sub 우회 — 같은 process 안에서는 EventEmitter 가 충분). 외부 HTTP notification 와 채널 emit 은 **같은 after-commit hook 에서 fan-out** 되어 둘 다 EIA-RL-04 (TX commit 후 발송) 와 정합. 어댑터가 엔진 내부 코드를 호출하지 않음 — facade 원칙 유지.

### 3.4 데이터 모델

#### 3.4.1 `Trigger.config.chatChannel`

```jsonc
{
  "chatChannel": {
    "provider": "telegram",                    // 어댑터 식별자 (v1: "telegram")
    "botTokenRef": "secret://triggers/:id/bot-token",  // secret store reference
    "botIdentity": {                            // setupChannel 결과 캐시 (read-only after creation)
      "botId": 123456789,
      "username": "myworkflow_bot"
    },
    "uiMapping": {                              // optional — 노드 → 채널 UI 매핑 옵션
      "formMode": "multi_step",                 // 현재 v1 은 multi_step 만 (다단계 시퀀스)
      "visualNode": "photo",                    // "photo" | "text_only" (Carousel/Chart/Table)
      "buttonLayout": "auto"                    // "auto" | "vertical" | "horizontal"
    },
    "rateLimitPerMinute": 60,                   // CCH-NF-03 override
    "languageHints": {                          // 봇이 보내는 자체 안내 메시지 i18n
      "groupChatRefusal": "이 봇은 1:1 대화만 지원합니다.",
      "executionStarted": "워크플로우를 시작합니다…",
      "executionCompleted": "워크플로우가 완료되었습니다."
    }
  }
}
```

`chatChannel` 미존재 = 일반 webhook 트리거 (기존 동작 그대로).

> `botTokenRef` 는 [EIA §7.1](../../spec/5-system/14-external-interaction-api.md#71-trigger-엔티티-확장) 의 `config.notification.signing.secret` 와 동일 보안 정책 — 향후 암호화 컬럼으로 분리. v1 은 JSONB 평문 금지 + secret reference 만 보관.

#### 3.4.2 신규 컬럼 ([Spec 1-data-model §2.8](../../spec/1-data-model.md#28-trigger) 동시 갱신)

`Trigger` 테이블 — `notification_*` 컬럼과 동일 명명 패턴:

```sql
ALTER TABLE trigger
  ADD COLUMN chat_channel_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',  -- 'unknown'|'healthy'|'degraded'
  ADD COLUMN chat_channel_last_error TEXT NULL,
  ADD COLUMN chat_channel_setup_at   TIMESTAMPTZ NULL,
  ADD COLUMN chat_channel_token_v2   TEXT NULL,   -- rotation grace 기간 (24h) 동안 사용되는 신규 bot token reference
  ADD COLUMN chat_channel_rotated_at TIMESTAMPTZ NULL;
```

> `chat_channel_health` 의 enum (`unknown`/`healthy`/`degraded`) 은 `notification_health` 와 완전 동일 — 향후 공용 DB 타입 통합 검토 (I13). `chat_channel_token_v2` 컬럼명은 의도적으로 `_v2_ref` 가 아닌 `_v2` 를 채택 (`notification_secret_v2` 와 일치, I12). 실제 컬럼이 secret 평문 대신 secret store reference 를 담는 것은 `notification_secret_v2` 와 동일한 향후 암호화 정책 따름.
>
> Flyway 마이그레이션 슬롯 번호는 PR-A 착수 직전 [`spec/conventions/migrations.md`](../../spec/conventions/migrations.md) 에서 예약 (I4).

#### 3.4.3 ChannelConversation (in-memory + Redis cache)

```
key:    chat-channel:{triggerId}:{conversationKey}   (텔레그램: chat_id)
value:  {
  executionId: string | null,    // 활성 execution. terminal 후 null
  threadId:    string,           // conversation thread id (현재 v1 은 "default")
  channelUserKey: string,        // 텔레그램 user_id
  startedAt:   ISO8601,
  lastUpdateAt: ISO8601
}
TTL: 7일 (사용자 이탈 시 자동 만료)
```

- conversationKey 는 어댑터별로 다름 (텔레그램: `chat_id`, Slack: `channel_id`+`thread_ts`, 카카오: `user_id`).
- 같은 `triggerId + conversationKey` 의 두 번째 메시지는 활성 execution 이 있으면 forwarding, 없으면 새 execution 시작.
- Redis key 패턴: `chat-channel:{triggerId}:{conversationKey}` — 콜론 separator + 계층형. 다른 모듈 (예: `cafe24:`, `bg-monitor:`) 과 동일 컨벤션.

> `channelUserKey` 는 **본 Redis ChannelConversation 레코드에만 보관**한다 (I2). [`spec/conventions/conversation-thread.md`](../../spec/conventions/conversation-thread.md) 의 `ConversationThread` 자료구조 자체에는 추가 필드를 도입하지 않음 — multi-user 확장 (v2) 시점에 재논의.

### 3.5 Identity / 보안

- **인증**: webhook 진입점은 [WH-SC-02 HMAC 서명](../../spec/5-system/12-webhook.md#42-hmac-서명) (provider 가 지원하는 경우) 또는 endpoint UUID 의 randomness 에 의존. 텔레그램은 HMAC 미지원이므로 `secret_token` 파라미터를 `setWebhook` 시 등록해 `X-Telegram-Bot-Api-Secret-Token` 헤더로 검증.
- **EIA inbound facade (W5·W9·C1 해소)**: 어댑터가 인터랙션 명령을 보낼 때 EIA 의 외부 토큰 (`iext_*` / `itk_*`) 발급을 우회하고 **`InteractionService.interact(ctx: InteractionRequestContext, dto: InteractDto)`** ([현행 public 메서드](../../codebase/backend/src/modules/external-interaction/interaction.service.ts), 코드가 SoT) 를 직접 in-process 호출. EIA HTTP 표면은 외부 클라이언트 전용. 어댑터는 같은 process 안의 trusted caller — 토큰 사이클이 불필요. 이 우회 자체는 [EIA §3.3 EIA-AU-08](../../spec/5-system/14-external-interaction-api.md#33-인증) (신규 추가) 의 명시적 예외 조항에 근거. `InteractionRequestContext` 는 어댑터가 직접 합성하되 (`scope: 'in_process_trusted'` 플래그 동봉) 외부 HTTP 경로에서는 해당 플래그가 절대 set 되지 않도록 컨트롤러 단계 guard 책임. **구현 단계의 접근 제어**: `interact()` 메서드는 public 유지하되, in-process flag 가 set 된 ctx 는 token 검증 단계 (`tokenService.verify`) 를 skip — 외부 HTTP guard 는 ctx 합성 시 in-process flag 를 절대 set 하지 않는다.
- **SSRF**: 어댑터의 outbound API URL 은 provider 별 고정 (`api.telegram.org`). [EIA-NX-10 SSRF 화이트리스트](../../spec/5-system/14-external-interaction-api.md#31-outbound-notification-notification-webhook) 와 별도 — 사용자 제어 URL 아님.
- **§R5 관계** (I5): EIA §R5 의 "외부 WebSocket 보류" 결정은 **외부 표면** 의 채널 다양화 결정. Chat Channel 어댑터는 외부 표면을 추가하지 않으므로 §R5 의 재논의 트리거 조건과 무관 (어댑터는 in-process subscriber).

### 3.6 EIA 와의 관계 (단일 표 SoT)

| EIA 요구사항 | Chat Channel 위에서의 해석 |
|---|---|
| [EIA-NX-* outbound notification](../../spec/5-system/14-external-interaction-api.md#31-outbound-notification-notification-webhook) | 어댑터가 in-process subscriber. HTTP POST + HMAC 검증 단계 우회 (network round-trip 없음). `seq` 정렬·`X-Clemvion-Delivery` dedup 은 어댑터 코드 안에 내장 |
| [EIA-IN-* inbound interaction](../../spec/5-system/14-external-interaction-api.md#32-inbound-interaction-rest--sse) | 어댑터가 in-process caller. `submit_form` / `click_button` / `submit_message` / `end_conversation` / `cancel` 5종 동일 |
| [EIA-AU-* 인증](../../spec/5-system/14-external-interaction-api.md#33-인증) | 어댑터는 외부 토큰 family (`iext_*` / `itk_*`) 발급/검증을 우회. EIA HTTP 표면은 외부 클라이언트 전용 — 어댑터는 같은 process 안의 trusted caller |
| [EIA-RL-* 신뢰성](../../spec/5-system/14-external-interaction-api.md#34-신뢰성·일관성) | 동일 적용. 특히 EIA-RL-03 (form 검증 실패 시 waiting_for_input 유지) 가 CCH-MP-03 의 "그 필드만 재질문" 의 기반 |
| [EIA-NF-* 비기능](../../spec/5-system/14-external-interaction-api.md#35-비기능-요구사항) | latency 는 어댑터의 한 단계 추가 (CCH-NF-01 / CCH-NF-02). 채널 외부 API 호출이 추가되므로 EIA NF 위에 어댑터 NF 가 누적 |

---

## 4. chat-channel-adapter.md 본문 핵심

### 4.1 Adapter Interface (TypeScript)

```typescript
interface ChatChannelAdapter {
  /** 채널 식별자. config.chatChannel.provider 와 1:1 */
  readonly provider: string;

  /**
   * Trigger 생성/활성화 시 1회 호출. 외부 채널의 webhook/long-poll 등록.
   * @returns externalHookUrl?: 채널이 알려주는 callback URL (디버깅용)
   */
  setupChannel(config: ChatChannelConfig, callbackUrl: string): Promise<SetupResult>;

  /** Trigger 비활성화/삭제 시 호출. setWebhook 해제 등 */
  teardownChannel(config: ChatChannelConfig): Promise<void>;

  /**
   * 외부 채널 → 워크플로우 input 변환. webhook 진입점이 호출.
   * @returns null 이면 무시 (group chat, 봇 자기 자신 메시지 등)
   */
  parseUpdate(raw: unknown, config: ChatChannelConfig): Promise<ChannelUpdate | null>;

  /**
   * EIA 이벤트 → 외부 채널 메시지 변환. NotificationDispatcher 의 in-process subscriber.
   * @returns 비어있으면 발송 생략
   */
  renderNode(event: EiaEvent, config: ChatChannelConfig): Promise<ChannelMessage[]>;

  /**
   * 외부 채널 API 호출 (sendMessage / sendPhoto / answerCallbackQuery 등).
   * 재시도·rate limit·error handling 책임.
   */
  sendMessage(message: ChannelMessage, config: ChatChannelConfig): Promise<SendResult>;

  /**
   * 일부 채널은 인터랙션 receipt ack 가 의무 (텔레그램 answerCallbackQuery).
   * inbound interact 명령 처리 직후 호출.
   */
  ackInteraction(update: ChannelUpdate, config: ChatChannelConfig): Promise<void>;
}
```

### 4.2 데이터 타입

`EiaEvent` (renderNode 의 입력) 는 [EIA §6 outbound notification payload](../../spec/5-system/14-external-interaction-api.md#6-api-명세--outbound-notification) 의 5종 union — 별도 신규 타입을 정의하지 않고 EIA spec 의 payload shape 을 재사용 (I11 해소):

```typescript
type EiaEvent =
  | { type: "execution.waiting_for_input"; /* EIA §6.2 */ executionId, triggerId, workflowId, node, interaction, context, timestamp, seq }
  | { type: "execution.ai_message";        /* EIA §6.5 + WS §4.4 ai_message */ message, turnCount, messages, ... }
  | { type: "execution.completed";         /* EIA §6.3 */ result, durationMs, ... }
  | { type: "execution.failed";            /* EIA §6.4 */ error, durationMs, ... }
  | { type: "execution.cancelled";         /* EIA §6.5 */ cancelledBy };
```

> 본 타입 정의는 `chat-channel-adapter.md` 본문에서 EIA spec 으로 위임 — drift 회피.

```typescript
interface ChannelUpdate {
  conversationKey: string;        // 어댑터별 conversation 식별자 (텔레그램: chat_id)
  channelUserKey: string;          // 사용자 식별자 (텔레그램: user_id)
  command:
    | { kind: "start" }                                          // /start
    | { kind: "cancel" }                                         // /cancel
    | { kind: "text_message"; text: string }                    // 일반 텍스트
    | { kind: "button_callback"; callbackData: string }         // inline_keyboard tap
    | { kind: "file_upload"; fileId: string; mimeType: string } // 파일 첨부
    | { kind: "contact_share"; phone: string };                  // share_contact
  idempotencyKey: string;          // provider 가 update id 등에서 도출 (텔레그램: update_id)
  receivedAt: string;              // ISO8601
}

interface ChannelMessage {
  conversationKey: string;
  body:
    | { kind: "text"; text: string; chunked?: boolean }
    | { kind: "buttons"; text: string; buttons: ChannelButton[] }
    | { kind: "form_prompt"; fieldName: string; label: string; hint?: KeyboardHint }
    | { kind: "image"; bytes: Buffer; caption?: string; fallbackText: string }
    | { kind: "typing" };          // sendChatAction 등
  replyToExternalId?: string;       // 옵션 — provider 별 reply / threading
}

interface ChannelButton {
  id: string;                       // EIA click_button 의 buttonId
  label: string;
  type: "callback" | "link";        // callback → click_button, link → 외부 URL
  url?: string;                     // type=link
}

type KeyboardHint =
  | "text"
  | "number"
  | "email"
  | "phone"
  | "date"
  | "file_upload"
  | "share_contact";
```

### 4.3 6함수 규약 (책임 + 부작용 + 멱등성)

| 함수 | 책임 | 부작용 | 멱등성 |
|---|---|---|---|
| `setupChannel` | 외부 채널의 inbound hook 등록 (텔레그램 `setWebhook`) + bot identity 조회 (`getMe`) | 외부 API 호출 1회 이상 | yes — 같은 config 재호출 OK |
| `teardownChannel` | 외부 채널의 hook 해제. 부분 실패 OK (best-effort) | 외부 API 호출 | yes |
| `parseUpdate` | raw body → `ChannelUpdate \| null`. side-effect free (DB 미접근, 외부 API 미호출). 무시 대상은 `null` 반환 | none | pure |
| `renderNode` | EIA payload → `ChannelMessage[]`. side-effect free | none | pure |
| `sendMessage` | 외부 API 호출. 재시도·rate limit 책임 | 외부 API 호출 | dedup 책임은 caller (EIA 의 `seq` + `X-Clemvion-Delivery` 그대로 어댑터 안에서 활용) |
| `ackInteraction` | provider 가 요구하는 ack (텔레그램 `answerCallbackQuery`). provider 에 따라 noop 가능 — 함수 자체는 의무지만 구현체는 비어 있을 수 있음 | 외부 API 호출 (provider 의존) | yes |

### 4.4 EIA Event → renderNode 매핑

`renderNode(event)` 가 처리해야 하는 EIA 이벤트:

| EIA event type | 입력 payload (EIA §6) | 출력 ChannelMessage 시퀀스 |
|---|---|---|
| `execution.waiting_for_input` (interactionType=form) | `formConfig.fields[]` | 다단계 — 첫 필드의 `form_prompt` 1건. 이후 응답마다 다음 필드 (CCH-MP-03) |
| `execution.waiting_for_input` (interactionType=buttons) | `buttonConfig.buttons[]` + `buttonConfig.nodeOutput` | `buttons` 1건. node output 이 시각형 (carousel/table/chart) 이면 그 앞에 `image` 1건 추가 |
| `execution.waiting_for_input` (interactionType=ai_conversation) | `conversationConfig.message` | `text` 1건 (4096자 초과 시 chunked) |
| `execution.ai_message` | `message` | `text` 1건 (chunked 가능) |
| `execution.completed` | `result.outputs` | `text` 1건 — `languageHints.executionCompleted` 또는 result 의 summary |
| `execution.failed` | `error.message` | `text` 1건 — 에러 안내 (사용자에게 안전한 형태로 redact) |
| `execution.cancelled` | `cancelledBy` | `text` 1건 |

### 4.5 Form 다단계 시퀀스 상세 (CCH-MP-03)

`execution.waiting_for_input` (interactionType=form) 도착 시 어댑터는 **필드별 순차 prompt** 로 풀어낸다:

```
1. formConfig.fields[0] → form_prompt 발송, "현재 필드 인덱스" 를 conversation state 에 저장 (currentFieldIdx=0)
2. 사용자 응답 (text_message) → adapter 가 EIA submit_form 을 호출하지 않고 자체 버퍼에 채움 (partialFormData[fields[0].name] = value)
3. validation: 필드 단위 클라이언트-side 검증 (type / pattern / minLength 등 schema 차원)
   - 실패 → 같은 필드 재질문
   - 성공 → currentFieldIdx++, 다음 필드 prompt
4. 마지막 필드 응답 + 클라이언트-side 검증 통과 → EIA submit_form (data: partialFormData) 호출
5. EIA 가 server-side 검증 실패 (400 VALIDATION_FAILED + fieldErrors) 응답 시
   → fieldErrors[0].field 를 currentFieldIdx 로 되돌리고 그 필드 재질문 (EIA-RL-03 활용 — execution 상태 유지)
6. 성공 시 다음 EIA waiting_for_input 또는 ai_message / completed 이벤트 도착
```

> server-side validation 실패 시 어댑터가 currentFieldIdx 를 되돌리는 정책 덕분에 사용자는 "처음부터 다시" 가 아니라 "잘못된 필드만 다시" 답할 수 있다.

### 4.6 Tool registry

```typescript
interface ChannelAdapterRegistry {
  register(adapter: ChatChannelAdapter): void;
  get(provider: string): ChatChannelAdapter;
}
```

`provider` 문자열은 lower-case, kebab-case (예: `"telegram"`, `"slack"`, `"kakao-talk"`). 신규 어댑터 추가 시 `providers/<name>.md` spec 신설 + 본 registry 에 register.

---

## 5. telegram.md 본문 핵심

### 5.1 Bot API 호출 매핑

| Chat Channel 함수 | Telegram Bot API |
|---|---|
| `setupChannel` | `POST /bot{token}/setWebhook` (url, secret_token, allowed_updates) + `GET /bot{token}/getMe` (botId / username 캐시) |
| `teardownChannel` | `POST /bot{token}/deleteWebhook` |
| `parseUpdate` | Telegram Update 객체 → `ChannelUpdate` (chat_id, from.id, text/callback_query/document 분기) |
| `sendMessage` (text) | `POST /bot{token}/sendMessage` (chat_id, text, parse_mode=MarkdownV2 escape) |
| `sendMessage` (buttons) | `sendMessage` + `reply_markup.inline_keyboard` |
| `sendMessage` (form_prompt) | `sendMessage` + 옵션 `reply_markup.keyboard` (text/숫자/share_contact) or remove_keyboard |
| `sendMessage` (image) | `POST /bot{token}/sendPhoto` (chat_id, photo, caption) |
| `sendMessage` (typing) | `POST /bot{token}/sendChatAction` (action=typing) |
| `ackInteraction` (button_callback) | `POST /bot{token}/answerCallbackQuery` (callback_query_id) |

### 5.2 명령 매핑

| 텔레그램 update | ChannelUpdate.command |
|---|---|
| `/start` (또는 `/start <param>`) | `{ kind: "start" }` |
| `/cancel` | `{ kind: "cancel" }` |
| 일반 텍스트 (`message.text`, 명령 아님) | `{ kind: "text_message", text }` |
| `callback_query` (inline_keyboard tap) | `{ kind: "button_callback", callbackData }` |
| `message.document` / `message.photo` / `message.video` | `{ kind: "file_upload", fileId, mimeType }` |
| `message.contact` (share_contact) | `{ kind: "contact_share", phone }` |
| `message.chat.type ∈ ('group', 'supergroup', 'channel')` | `null` 반환 → `languageHints.groupChatRefusal` 안내 발송 후 무시 |
| `message.from.is_bot === true` | `null` (다른 봇 메시지 무시) |

### 5.3 인터랙션 노드 UI 매핑 (CCH-MP-*)

#### 5.3.1 AI Multi Turn (CCH-MP-01)

- `execution.ai_message.message` → `sendMessage` (parse_mode=MarkdownV2 escape).
- 4096자 초과 시 단어/문장 경계로 분할, 마지막 chunk 직전까지는 `\n_(continued…)_` suffix.
- 응답 처리 직전에 `sendChatAction(action=typing)` 1회 (5초 자동 만료) — UX 개선.
- 사용자 reply → `submit_message` (단순 text_message 분기).

#### 5.3.2 Button Presentation (CCH-MP-02)

- `buttonConfig.buttons[]` → `inline_keyboard` 2D 배열. `uiMapping.buttonLayout` 에 따라:
  - `auto` (default): 라벨 총 length 가 24자 이하인 버튼은 같은 row, 초과는 새 row.
  - `vertical`: 1열 N행.
  - `horizontal`: 1행 N열 (최대 8개까지, 초과는 wrap).
- `inline_keyboard.callback_data` 필드에 `buttonId` 직접 저장 (텔레그램의 64 bytes 제한 안에서 UUID 충분).
- 버튼 시각: `style: 'primary'` → 이모지 ✅ prefix, `'danger'` → ⚠️, 그 외 plain.
- callback_query 도착 시:
  1. `answerCallbackQuery(callback_query_id)` 즉시 호출 (텔레그램 의무)
  2. EIA `click_button` 호출
  3. (옵션) 직전 메시지를 `editMessageReplyMarkup` 으로 키보드 제거 — 중복 클릭 차단

#### 5.3.3 Form (CCH-MP-03)

§4.5 의 다단계 시퀀스 정책 적용.

필드 type 별 keyboard hint:

| `field.type` | Telegram keyboard |
|---|---|
| `text` / `textarea` / `email` | force_reply (기본 입력) |
| `number` | `reply_keyboard` 의 숫자 패드 (1~0 + ".") |
| `select` / `radio` | `inline_keyboard` 로 선택지 노출 (Button 노드와 동일 패턴) |
| `checkbox` | 다중 select — 각 옵션 inline_keyboard + 완료 버튼 |
| `date` | force_reply + 형식 안내 (`YYYY-MM-DD`) — v1 은 native date picker 사용 안 함 |
| `file` | force_reply 후 file_upload 대기. `allowedMimeTypes` 검증은 어댑터에서 1차 |
| (특수) `phone` (custom validation rule) | `request_contact: true` 버튼 — share_contact |

#### 5.3.4 Carousel / Chart / Table (CCH-MP-04)

`buttonConfig.nodeOutput` 의 nodeType 에 따라:

| nodeType | 렌더 방식 | 후속 |
|---|---|---|
| `chart` | `output.rendered` 의 SVG → PNG 변환 (기존 chart 렌더러 재사용) → `sendPhoto` + caption (chart title) | 버튼이 있으면 그 다음 메시지로 `inline_keyboard` 발송 |
| `carousel` | SSR (headless chromium 또는 satori) 로 카드 1~5장을 1장의 collage PNG 으로 렌더 → `sendPhoto`. 카드 수 > 5 면 첫 5 + "외 N장" caption | 동일 |
| `table` | SSR 로 표 PNG 렌더 (rows ≤ 20 까지 1장, 초과는 첫 20 + "외 N행"). 텍스트 fallback 으로 markdown 표 1건 별도 발송 (시각 fallback) | 동일 |
| `template` | `output.rendered` 가 HTML 이면 SSR PNG, plain text 면 `sendMessage` (4096자 분할) | 동일 |

**v1 분리**: chart 는 PR-D 의 first 단계, carousel/table 은 SSR 인프라 정비 후 별 PR 권장 (telegram.md 본문에 "v1 = chart only, carousel/table 은 후속" 명시).

### 5.4 보안

- `botToken` 은 `botTokenRef` (secret store ref) 만 config 에 저장. 평문 금지.
- `setWebhook` 의 `secret_token` 파라미터를 등록 시점에 랜덤 발급 → 텔레그램이 모든 update 에 `X-Telegram-Bot-Api-Secret-Token` 헤더로 동봉 → 어댑터가 검증. 검증 실패 시 401.
- group chat / channel update 는 어댑터 진입점에서 차단 (CCH-CV-05) — `chat.type` 검사. `groupChatRefusal` 안내 발송 후 update 무시.
- 다른 봇이 보낸 메시지 (`from.is_bot === true`) 도 무시.

### 5.5 명령 처리

| 사용자 입력 | 어댑터 처리 |
|---|---|
| `/start` (활성 execution 없음) | 새 execution 시작 + `languageHints.executionStarted` 안내 |
| `/start` (활성 execution 있음) | 기존 execution 취소 후 새 execution 시작 (안내 메시지 1줄) |
| `/cancel` | 활성 execution 에 EIA `cancel` 호출. 없으면 noop + 안내 |
| `/help` | 봇 기본 도움말 (v1 은 정적 텍스트) |

### 5.6 비기능

- `sendMessage` 5초 타임아웃 + 3회 지수 백오프 (1s / 2s / 4s). 최종 실패 시 trigger 의 `chat_channel_health = degraded`.
- 텔레그램의 group rate limit (30 msg/sec across users, 1 msg/sec per chat) — 어댑터가 chat 단위 큐 + delay 적용.
- update_id 기반 dedup — 같은 update_id 가 30초 안에 두 번 도착하면 두 번째는 무시 (idempotency).

---

## 6. 12-webhook.md 개정 핵심

### 6.1 §2.2 config 필드 표 갱신

기존 `notification` / `interaction` 행 다음에 `chatChannel` 한 행 추가:

```jsonc
{
  // 기존 필드 ( authType / secret / bearerToken / hmacHeader / hmacAlgorithm / notification / interaction ) 유지

  "chatChannel": {
    "provider": "telegram",
    /* 상세는 Spec Chat Channel §3.4.1 */
  }
}
```

`chatChannel` 누락 시 일반 webhook 트리거 (기존 동작 그대로). 본 spec 은 위치만 가리키고 상세는 [Spec Chat Channel](../../spec/5-system/15-chat-channel.md#341-triggerconfigchatchannel) 로 위임.

### 6.2 §3.4 관리 표 추가 행

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| WH-MG-08 | 트리거 생성/수정 페이로드의 `chatChannel` 옵션 (외부 chat 플랫폼 어댑터 연결) — 상세는 [Spec Chat Channel §3.4](../../spec/5-system/15-chat-channel.md#34-데이터-모델) | 필수 |
| WH-MG-09 | 트리거 상세 화면에 `chatChannelHealth` 표시 (unknown / healthy / degraded) — [Spec Chat Channel §3.2 CCH-SE-01](../../spec/5-system/15-chat-channel.md#32-요구사항-cch--prefix) | 권장 |

### 6.3 §3.3 처리 흐름 다이어그램에 chatChannel 분기 (W4 해소)

기존 §3.3 의 본문 다이어그램에 분기 추가:

```
... 6. 인증 검증 통과 ...
7. config.chatChannel 가 있으면:
   a. ChannelAdapter = registry.get(config.chatChannel.provider)
   b. update = await adapter.parseUpdate(rawBody, config.chatChannel)     // 50ms 이내 (CCH-NF-01)
   c. update === null 이면 (group chat 등) → 202 Accepted + `{ ignored: true }` 즉시 반환 (Execution 미생성)
   d. 활성 ChannelConversation 조회 → 있으면 InteractionService.interact() in-process 호출
                                       없으면 ExecutionEngineService.execute() 시작
8. config.chatChannel 가 없으면: (기존 경로) resolveTriggerParameters → ExecutionEngineService.execute()
9. 202 Accepted 즉시 반환 (WH-NF-01 200ms 이내). execute() 는 백그라운드 fire-and-forget.
```

> 202 반환 시점은 **`parseUpdate` 직후 + `ExecutionEngine.execute()` 또는 `InteractionService.interact()` 호출 직후**. 두 후속 호출 모두 비동기 (engine 의 background 워커 / `interact()` 의 `continueExecution` 큐). `parseUpdate` 의 50ms 와 인증·trigger 조회의 ~100ms 합쳐도 WH-NF-01 의 200ms 안에 들어옴.

### 6.3 Rationale 한 줄 추가

기존 "외부 인터랙션 채널을 별도 spec 파일로 분리 (2026-05-21)" 다음에 한 항목:

> ### Chat Channel 어댑터 — 별도 spec 으로 분리 (2026-05-21)
>
> Webhook 트리거의 `config.chatChannel` 한 갈래로 동작하지만 어댑터 설계·provider 별 구체 정의가 분리되는 별 layer 이므로 [Spec Chat Channel](./15-chat-channel.md) 로 단일 진실 분리. 본 spec 은 cross-link 만.

---

## 7. 14-EIA.md 개정 핵심

### 7.1 §2 사용 시나리오 표 (행 병존, W3 해소)

기존 행은 **유지** ("사용자가 직접 변환층 구현 (advanced)" 로 정제) + 신규 행 **추가**:

| 시나리오 | 사용 채널 | 설명 |
|---------|---------|------|
| 서버-to-서버 자동화에서 사람 결재가 필요한 경우 | Notification only | (변경 없음) |
| **외부 챗봇 위에 워크플로우 얹기 — 사용자가 직접 변환층 구현 (advanced)** | Notification + Inbound | 봇 메시지 → webhook 으로 워크플로우 시작 → AI Multi Turn 진입 시 notification 으로 어시스턴트 응답 받기 → 사용자 메시지마다 REST `submit_message`. 서버사이드 어댑터를 사용하지 않는 fully-custom 통합. |
| **외부 챗봇 — 서버사이드 어댑터 사용 (Chat Channel via Webhook)** | Notification + Inbound (어댑터가 자동화) | Webhook 트리거 `config.chatChannel` 등록만으로 텔레그램 등과 자동 통합. 어댑터가 in-process subscriber 로 EIA outbound 를 받아 채널 메시지로 변환, in-process caller 로 EIA inbound 를 호출. 사용자 코드 0. 상세는 [Spec Chat Channel](./15-chat-channel.md) |
| 외부 SaaS 가 내장 chat 위젯 호스팅 | Inbound only (SSE + REST) | (변경 없음) |
| 단순 fire-and-forget 자동화 (인터랙션 없음) | 둘 다 미사용 | (변경 없음) |

> EIA 본 spec 은 변환층의 단일 진실. Chat Channel 은 이 표면을 server-side 어댑터로 자동화한 **편의 레이어** 임을 명시. 두 케이스 모두 유효 — 사용자가 어댑터 인터페이스를 따르지 않는 quirky 통합을 원하면 직접 변환층을 만들 수 있고, 표준 통합 (Telegram 등) 은 어댑터로 처리.

### 7.2 §3.3 인증 표 신규 행 (C1 해소)

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| EIA-AU-08 | **In-process trusted caller 예외** — 서버 process 내부의 신뢰 caller (예: [Spec Chat Channel](./15-chat-channel.md) 어댑터) 는 토큰 발급/검증을 우회할 수 있다. 우회는 `InteractionService.interact()` ([코드 SoT](../../codebase/backend/src/modules/external-interaction/interaction.service.ts)) 의 **in-process 직접 호출** 경로에 한정되며, HTTP 표면을 거치지 않는다. 외부 HTTP 호출은 EIA-IN-06 의 `interaction token` 인증을 그대로 따른다. 구현은 `InteractionRequestContext` 의 `scope: 'in_process_trusted'` 플래그로 분기하되, 외부 HTTP guard 는 이 플래그를 절대 set 하지 않는다 | 필수 |

### 7.3 §R4 의 Telegram 예시 수정 (C1 해소)

기존:
> `per_trigger` 가 더 편한 시나리오:
> - 다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — execution 별 토큰 교환 비용 회피

수정 후:
> `per_trigger` 가 더 편한 시나리오:
> - 다수 execution 을 동시에 다루는 봇 (Telegram bot 등) — execution 별 토큰 교환 비용 회피. **단, 본 시나리오는 사용자가 직접 변환층을 구현하는 advanced 케이스 한정** (§2 사용 시나리오 표 2행). 서버사이드 어댑터 ([Spec Chat Channel](./15-chat-channel.md)) 를 사용하는 경우는 EIA-AU-08 (§3.3) 의 in-process 우회로 토큰 사이클 자체가 적용되지 않는다.

### 7.4 §R10 (단일 sink 정책의 확장) 에 한 단락 추가 (C2 해소)

기존 §R10 의 마지막 단락 뒤에 한 단락 추가:

> **추가 facade 사례 — Chat Channel adapter (2026-05-21)**: [Spec Chat Channel](./15-chat-channel.md) 의 server-side 어댑터도 NotificationDispatcher 와 **동일 facade 계층** 의 추가 in-process subscriber 로 위치한다. 구체 구독 메커니즘은 **NotificationDispatcher 가 노출하는 in-process EventEmitter** 의 listener 로 attach (Redis pub/sub 우회 — 같은 process 안에서는 EventEmitter 가 충분). 외부 HTTP notification 와 어댑터의 채널 emit 은 같은 after-commit hook 에서 fan-out 되어 EIA-RL-04 (TX commit 후 발송) 정합. 어댑터는 엔진 내부 코드를 호출하지 않으며, 본 R10 의 **엔진 단일 sink + 외부 facade** 원칙을 깨지 않는다 — 기각된 대안 (NotificationDispatcher 를 엔진 내부에서 직접 호출) 과의 구조적 차이는 어댑터 역시 엔진 외부에서 NotificationDispatcher 가 emit 하는 결과만 받는다는 점.

---

## 8. Rationale 메모 (각 spec 의 ## Rationale 로 분산)

### R-A. 새 트리거 유형 신설 안 함 (15-chat-channel.md 에 기록)

검토 대안:
1. **(채택) Webhook 트리거 + `chatChannel` config**: 트리거 유형 카탈로그 유지, 어댑터는 config 한 갈래. 사용자 멘탈모델 = "텔레그램 어댑터를 켠 Webhook 트리거".
2. **(기각) `Chat Channel Trigger` 신규 노드**: 트리거 종류가 N+1 로 늘어남. webhook 트리거와 90% 공통이라 코드 중복.
3. **(기각) 어댑터 인터페이스 X, 텔레그램 1급 모듈**: Slack/카카오 요청 시 같은 모듈 N개 반복. 인터페이스를 1개 추상으로만 두면 layer 1개로 차단됨.

근거: 사용자 명시 입장 ("굳이 추가할 필요 없다고 생각해") + EIA spec 의 facade 원칙과 정합.

### R-B. Chat Channel 을 EIA 의 consumer 로만 위치 (15-chat-channel.md)

EIA HTTP 표면을 새로 만들지 않고 in-process facade 호출만 사용. 이유:
- HTTP round-trip 회피 (latency CCH-NF-02 200ms 안에 들어가려면 round-trip 1회 절감 필요)
- 토큰 발급/검증 우회 — 어댑터는 trusted in-process caller
- 단일 inbound 명령 facade ([EIA §10 `external-interaction.module.ts`](../../spec/5-system/14-external-interaction-api.md#10-구현-파일-구조)) 가 외부 HTTP 와 in-process 호출 둘 다 수용

대안 (기각): 어댑터도 EIA HTTP endpoint 를 호출 — 동일 process 안에서 자기 HTTP 표면을 호출하는 의미 없는 round-trip + 토큰 사이클 부담.

### R-C. v1 single-user DM 만 지원 (15-chat-channel.md)

group chat 은 multi-user 매핑이 복잡 (어느 사용자가 답한 것? `conversation thread metadata.userKey` 가 단일 값 가정과 충돌). v1 은 1:1 DM 만 — group chat 은 어댑터가 명시적으로 거부. 후속 v2 에서 multi-user thread 도입 시 재논의.

### R-D. Form 다단계 시퀀스 + 클라이언트 검증 + EIA-RL-03 활용 (chat-channel-adapter.md + telegram.md)

대안:
1. **(채택) 어댑터가 필드별 1문항씩 묻고, 모든 필드 모인 후 EIA submit_form 한 번**: 텔레그램의 channel 인 lazy form UI 와 자연스럽게 매핑. server-side validation 실패 시 fieldErrors[0].field 만 재질문.
2. **(기각) 한 번에 모든 필드를 JSON 형식 안내**: 사용자가 자유 텍스트로 JSON 을 작성하기 어렵고, 한 글자 오타로 전체 폼 거절됨.
3. **(기각) Telegram Mini App / Web App 으로 form**: v1 의 인프라 비용 너무 큼. Mini App 은 v2 옵션.

### R-E. Carousel/Table SSR 을 chart 와 분리해 후속 PR (telegram.md)

chart 는 이미 SVG 렌더가 있어 PNG 변환만 추가하면 됨. carousel/table 은 headless chromium 또는 satori 같은 SSR 인프라가 필요 — 다른 노드 (Email integration 등) 에도 영향. PR-D 의 first iteration 은 chart 만, carousel/table 은 follow-up plan 으로 분리.

### R-F. botToken secret store reference 정책 (15-chat-channel.md / telegram.md)

EIA §7.1 의 `notification.signing.secret` 와 동일 — config JSONB 평문 금지 + secret reference 만 보관. v1 은 reference 형식 (`secret://triggers/:id/bot-token`), 실제 secret store 구현은 follow-up.

### R-G. provider 디렉토리 위치 — `4-nodes/7-trigger/providers/` (15-chat-channel.md)

대안:
1. **(채택) `4-nodes/7-trigger/providers/<name>.md`**: 트리거 노드 컨텍스트 안에서 발견 가능. 같은 폴더 안에 `0-common.md` / `1-manual-trigger.md` 와 형제 위치 — 자연스러운 navigation.
2. **(기각) `5-system/chat-channel-providers/<name>.md`**: chat-channel 자체는 시스템 레이어 (15-) 지만 어댑터 구체는 트리거 config 갈래라서 시스템 레이어보다는 트리거 영역에 더 가깝다.
3. **(기각) `conventions/chat-channel-providers/<name>.md`**: convention 은 형식 규약 (cafe24-api-metadata 와 유사). 텔레그램 어댑터는 형식이 아니라 구체 구현 명세 — convention 이 아님.

### R-H. `chat-channel-adapter.md` 를 `spec/conventions/` 에 두는 정당화 (W6 해소)

`spec/conventions/` 는 **다른 spec 이 참조하는 형식·인터페이스 규약**을 모은다. 기존 거주자:
- `node-output.md` — 모든 노드 핸들러가 따르는 출력 5필드 규약
- `conversation-thread.md` — AI Agent / Presentation 노드가 따르는 thread 자료구조 규약
- `cafe24-api-metadata.md` — 모든 Cafe24 endpoint 메타데이터의 row shape 규약

`chat-channel-adapter.md` 는 **모든 channel provider 어댑터가 구현해야 하는 6함수 인터페이스 + 데이터 타입 union** 을 정의 — 위 세 거주자와 같은 layer (= "복수 구체 구현이 따르는 공통 계약"). `providers/telegram.md` 는 그 계약의 한 구현 명세, `15-chat-channel.md` 는 시스템 레이어의 lifecycle/identity/EIA 관계 — 세 spec 의 역할 분리:

| 파일 | 역할 |
|---|---|
| `conventions/chat-channel-adapter.md` | **함수 시그니처 + 데이터 타입 계약** (다중 provider 의 공통 SoT) |
| `5-system/15-chat-channel.md` | **시스템 동작·lifecycle·EIA 관계·요구사항 ID** (구현 무관 시스템 정의) |
| `4-nodes/7-trigger/providers/telegram.md` | **텔레그램 어댑터의 구체 구현 명세** (Bot API 매핑, 명령, UI 매핑) |

이 분리는 cafe24 의 [`conventions/cafe24-api-metadata.md`](../../spec/conventions/cafe24-api-metadata.md) (형식 규약) + [`4-nodes/4-integration/4-cafe24.md`](../../spec/4-nodes/4-integration/4-cafe24.md) (시스템·노드 정의) + [`conventions/cafe24-api-catalog/`](../../spec/conventions/cafe24-api-catalog/) (구체 endpoint 카탈로그) 의 3분할과 동일한 구조를 채택한 것이다.

### R-I. NotificationDispatcher EventEmitter subscription 메커니즘 (15-chat-channel.md, C2 해소)

대안:
1. **(채택) NotificationDispatcher 가 노출하는 in-process EventEmitter 의 listener 로 attach**: 같은 process 안에서는 외부 인프라 없이 가장 단순. NotificationDispatcher 의 after-commit hook 가 이미 단일 진입점.
2. **(기각) Redis pub/sub**: 같은 process 안에서는 round-trip 낭비. 다중 인스턴스 환경에서는 어차피 NotificationDispatcher 자체가 외부 HTTP 호출로 fan-out 하므로, 어댑터 sub 도 같은 process 의 listener 로 attach 하면 됨.
3. **(기각) 별도 after-commit hook 추가**: 엔진 §4.4 의 단일 sink 정책 위반 — 어댑터가 엔진 코드를 알아야 함.

근거: EIA §R10 의 "엔진 외부 facade 단일 위치" 원칙 유지 + 단순한 구현 (`emitter.on('execution.waiting_for_input', adapter.onEvent)`).

---

## 9. consistency-check 호출 계획

본 draft 작성 직후 `/consistency-check --spec` 호출. 5 sub-agent 가 검토할 1차 영역:

| Sub-agent | 1차 검토 포인트 |
|---|---|
| cross-spec-checker | EIA (14-) 와의 데이터 모델·요구사항 ID 충돌 / WebSocket protocol (6-) 의 명령·이벤트 매핑 정합 |
| rationale-continuity-checker | EIA §R10 의 "단일 sink 정책" 과 본 draft 의 어댑터 facade 위치 |
| convention-compliance-checker | 요구사항 ID prefix (CCH-*) / spec 3섹션 구조 / spec/conventions/ 규약 작성법 |
| plan-coherence-checker | `plan/in-progress/` 의 EIA / Trigger 관련 진행 plan 과의 충돌 (`eia-trigger-edit-ui` 등) |
| naming-collision-checker | `chatChannel` config 필드명 / `chat_channel_*` 컬럼명 / `CCH-*` ID / `provider: 'telegram'` 식별자 |

`Critical` 발견 시 본 draft 수정 후 재호출. `Warning` 은 본 draft 의 `## Rationale` 메모로 흡수.

---

## 10. 영향받지 않는 영역 (cross-check 용)

- `spec/4-nodes/3-ai/1-ai-agent.md` — AI Multi Turn 의 동작 자체는 변경 없음 (어댑터는 outbound 변환만)
- `spec/4-nodes/6-presentation/*` — Form / Button / Carousel 등 노드 spec 도 변경 없음 (어댑터가 외부 표현만 다름)
- `spec/conventions/conversation-thread.md` — thread 의 자료구조·source enum 변경 없음 (어댑터의 `channelUserKey` 는 Redis ChannelConversation 레코드에만 보관)
- `spec/5-system/4-execution-engine.md` — 실행 엔진 변경 없음 (어댑터는 NotificationDispatcher 의 EventEmitter listener 로 attach — 엔진 코드 미수정)
- `spec/5-system/6-websocket-protocol.md` — 내부 WS 채널 변경 없음
- `spec/5-system/2-api-convention.md` — 본 spec 의 endpoint (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) 는 기존 RPC 스타일 (`/notification/rotate-secret`, `/interaction/revoke-token`) 과 동일 패턴 → 컨벤션 변경 없음 (I8 해소)

> **Trigger 드로어 UI**: `chatChannel` 설정 패널과 `chatChannelHealth` 표시 UI 는 [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) 의 트리거 상세 드로어 spec 갱신이 필요 (I3). 본 v1 spec 의 12-webhook 개정에서 `WH-MG-08` / `WH-MG-09` 로 요구사항만 선언하고, UI 명세는 follow-up plan 으로 분리 (§11 PR-A 의 시작 전 또는 PR-A 안에서 처리).

---

## 11. 후속 plan (별 PR 분리 권고)

본 spec 이 머지된 후 구현은 다음 5 PR 로 분할:

- **PR-A**: Chat Channel adapter convention + Telegram AI Multi Turn 텍스트만
  - 사전 의무: Flyway 마이그레이션 슬롯 번호를 [`migrations.md`](../../spec/conventions/migrations.md) 에서 예약 (I4). `eia-jti-tracking` 등 EIA follow-up plan 과 머지 순서 조율 (I10).
  - 동반 작업: [`spec/2-navigation/2-trigger-list.md`](../../spec/2-navigation/2-trigger-list.md) 의 트리거 상세 드로어 spec 에 `chatChannel` 설정 패널 + `chatChannelHealth` 배지 추가 (I3).
- **PR-B**: Button Presentation → inline_keyboard
- **PR-C**: Form → 다단계 시퀀스
- **PR-D**: Carousel/Chart/Table → sendPhoto (chart 먼저, SSR 노드는 분리)
- **PR-E**: 안정화 (rate limit, retry, `/cancel`, file upload, secret rotation, group chat 거부)

각 PR 은 본 draft 의 해당 섹션을 `plan/in-progress/chat-channel-pr-*.md` 로 분리해서 추적.

### 11.1 진행 중 plan 과의 인지 사항 (I10)

- `eia-trigger-edit-ui` — chatChannel 편집 UI 가 누락된 채 진행될 위험. PR-A 의 동반 작업으로 trigger 드로어 spec 갱신 시 본 plan 의 작업 범위와 겹치는지 확인.
- `eia-secret-rotation-revoke-api` — EIA notification rotation grace 기간이 미결. 본 spec 의 CCH-SE-04 (24h grace) 와 정합성을 머지 시점에 재검토.
- `eia-distributed-seq-counter` — execution `seq` 의 분산 카운터 구현이 별 plan 으로 진행 중. 본 spec 의 어댑터는 `seq` 를 단순 dedup 으로만 사용 — `seq` 가 in-memory 든 Redis INCR 든 어느 쪽이어도 동작 가능 (직접 의존 없음).
