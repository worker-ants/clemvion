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
| 텔레그램 봇 위의 데이터 시각화 | 사용자 명령 → 워크플로우가 Chart 렌더 → `sendPhoto` 로 차트 전송 + 선택 버튼 |

### 3. 요구사항 (CCH-* prefix)

#### 3.1 어댑터 라이프사이클

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-AD-01 | Webhook 트리거 `config.chatChannel` 의 `provider` 필드로 어댑터 선택 (v1: `telegram`) | 필수 |
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
| CCH-CV-05 | v1 은 single-user DM 만 지원. group/supergroup/channel update 는 어댑터가 거부 (`languageHints.groupChatRefusal` 안내 후 무시) | 필수 |

#### 3.3 노드 → 채널 UI 매핑

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-MP-01 | [AI Multi Turn](../4-nodes/3-ai/1-ai-agent.md) 의 `execution.ai_message` → 채널 텍스트 메시지 1건 이상으로 변환 (provider 별 길이 제한 분할) | 필수 |
| CCH-MP-02 | [Button Presentation](../4-nodes/6-presentation/0-common.md) 의 `execution.waiting_for_input` (interactionType=buttons) → 채널의 inline keyboard 로 변환. tap → `click_button` 명령 | 필수 |
| CCH-MP-03 | [Form](../4-nodes/6-presentation/4-form.md) 의 `execution.waiting_for_input` (interactionType=form) → 다단계 prompt 시퀀스 (필드별 한 줄 질문). 검증 실패 시 그 필드만 재질문 ([EIA-RL-03](./14-external-interaction-api.md#34-신뢰성·일관성)) | 필수 |
| CCH-MP-04 | Carousel / Chart / Table 의 `execution.waiting_for_input` → 서버사이드 이미지 렌더 + caption + 텍스트 fallback. v1 = chart only, carousel/table 은 SSR 인프라 정비 후 후속 PR. 본 요구사항은 단계적 — chart 는 PR-D 1차에 필수, carousel/table 은 후속 plan | 필수 (단계적) |
| CCH-MP-05 | Form 필드 `type` 별 채널 keyboard hint — `number` → 숫자 키패드, `phone` → share_contact, `file` → upload prompt 등. 없는 keyboard 는 일반 text input | 권장 |

#### 3.4 신뢰성 / 보안

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| CCH-SE-01 | 어댑터의 외부 API 호출 (sendMessage 등) 에 5초 타임아웃 + 3회 지수 백오프 재시도. 최종 실패 시 trigger 의 `chat_channel_health` 를 `degraded` 로 갱신 ([§3.4.2](#342-trigger-테이블-신규-컬럼)). 자동 비활성화 금지 ([WH-MG-04 / EIA-NX-07](./12-webhook.md#34-관리) 와 동일 정책) | 필수 |
| CCH-SE-02 | 인터랙션 명령 처리는 EIA `Idempotency-Key` 를 어댑터가 자동 발급 (텔레그램 `update_id` 기반). 동일 `update_id` 30초 안 재도착은 무시 | 필수 |
| CCH-SE-03 | 어댑터의 외부 API secret (텔레그램 bot token) 은 trigger config 의 별도 secret store reference 에 보관. config JSONB 평문 금지 — [EIA-AU-01](./14-external-interaction-api.md#33-인증) 의 `wsk_*` 보관 정책과 동일. **v1 구현 단계 한정 예외**: `notification.signing.secret` 와 동일하게 `config.chatChannel.botToken` plaintext stub 으로 출발 (§4.1 주석 참조). v2 secret store 분리는 별 plan `spec-update-chat-channel-bot-token-stub` 에서 추적 | 필수 (v2; v1 은 §4.1 plaintext stub) |
| CCH-SE-04 | Bot token rotation API (`POST /api/triggers/:id/chat-channel/rotate-bot-token`) — old token 은 24h grace 동안 병행 받음 (텔레그램의 경우 setWebhook 재호출). 동사를 `rotate-bot-token` 으로 한 이유는 EIA 의 `rotate-secret` (HMAC signing secret) 과 자원 의미가 다르기 때문 (외부 provider bot token vs HMAC secret) — URL 만으로 의도 구별 가능 | 권장 |

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
    "provider": "telegram",                    // 어댑터 식별자 (v1: "telegram")
    "botTokenRef": "secret://triggers/:id/bot-token",  // secret store reference (CCH-SE-03). v1 stub: notification.signing.secret 와 동일 plaintext 보관 — 실제 구현 단계에서는 `config.chatChannel.botToken` 평문 필드로 stub. secret store 경로 분리는 별 plan `spec-update-chat-channel-bot-token-stub` 추적
    "secretToken": "AbCd…",                     // Telegram setWebhook 의 secret_token (server-issued 32 chars). HMAC 미지원 provider 의 webhook 인증 — provider 별 unused
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

`chatChannel` 미존재 = 일반 webhook 트리거 (기존 동작 그대로). 본 필드는 [Webhook §2.2](./12-webhook.md#22-config-필드-구조) 의 `config` JSONB 안에 위치.

`botTokenRef` 는 [EIA §7.1](./14-external-interaction-api.md#71-trigger-엔티티-확장) 의 `config.notification.signing.secret` 와 동일 보안 정책 — 향후 암호화 컬럼으로 분리. v1 은 JSONB 평문 금지 + secret reference 만 보관.

### 4.2 Trigger 테이블 신규 컬럼

[Spec 1-data-model §2.8](../1-data-model.md#28-trigger) 와 동시 갱신 (본 spec 과 spec/1-data-model.md 가 한 PR 에 묶임).

```sql
ALTER TABLE trigger
  ADD COLUMN chat_channel_health     VARCHAR(16) NOT NULL DEFAULT 'unknown',  -- 'unknown'|'healthy'|'degraded'
  ADD COLUMN chat_channel_last_error TEXT NULL,
  ADD COLUMN chat_channel_setup_at   TIMESTAMPTZ NULL,
  ADD COLUMN chat_channel_token_v2   TEXT NULL,   -- rotation grace 기간 (24h) 동안 사용되는 신규 bot token reference. semantic: bot token reference (외부 provider 자원) — notification_secret_v2 (HMAC signing secret) 와 의미 상이하나 컬럼 명명 패턴은 동일 유지 (Rationale §R-K)
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

**리스너 dedup / 라이프사이클 정책** (v1 부터 의무):

- `setupChannel()` 호출 시 동일 `triggerId` 의 기존 in-process listener 가 있으면 제거 후 새 listener 등록 — `setupChannel` 의 멱등성 ([Convention §1.1](../conventions/chat-channel-adapter.md#11-6함수-책임--부작용--멱등성)) 보장.
- `teardownChannel()` 호출 시 해당 `triggerId` 의 listener 를 반드시 해제 — 누락 시 비활성화된 trigger 에 메시지 중복 발송 위험.
- listener 등록은 항상 `(triggerId, provider)` 단위 키. 같은 trigger 가 provider 를 바꾸는 경우는 v1 미지원 (재생성으로 처리) — listener key 충돌 가능성 차단.

후속 추적: 위 분리 리팩토링은 두 번째 provider 가 도입될 때 `chat-channel-dispatcher-split` plan 으로 신설.

### R9. CCH-CV-03 `running` 케이스의 큐잉 vs 즉시 안내 (2026-05-22)

대안:
1. **(채택) 즉시 안내 + update 무시 (큐 미적재)**: `running` / `pending` 구간이 일반적으로 짧고 (수 초 ~ 수십 초), 사용자가 다음 입력 시점은 대개 `waiting_for_input` 도달 후이다. 사용자 메시지를 큐에 적재했다가 `waiting_for_input` 도달 시 재발사하면 (a) execution 의 input 시퀀스 가정과 충돌 가능 (워크플로우 노드가 그 입력을 기대하지 않은 시점에 입력 사건 발생), (b) 사용자가 같은 메시지를 두 번 보낸 경우 dedup 책임 모호.
2. **(기각) Redis 큐에 임시 적재 → `waiting_for_input` 도달 시 자동 재발사**: 위 (a)/(b) 이슈 + 큐 TTL / 폐기 정책 / 순서 정렬 등 추가 메커니즘 필요. v1 의 단순성과 어긋남.
3. **(기각) `waiting_for_input` 도달까지 HTTP 연결 보류**: WH-NF-01 의 200ms 응답 시한과 정면 충돌. 텔레그램이 webhook 응답 지연 시 retry 폭주.

근거: v1 단순성 + 사용자 mental model ("처리 중에 보낸 메시지는 다시 보내야 함" 이 봇 UX 의 일반적 기대). [CCH-NF-03](#35-비기능-요구사항) 의 rate-limit 큐 정책은 **다른 트리거 조건** (`분당 60건 초과 시 적재`) 으로, 본 케이스 (`execution running 중 사용자 메시지 도착`) 와 정책 방향이 다른 것은 정당하다 (전자는 외부 사용자 폭주 방어, 후자는 execution life-cycle 정합).

후속 단순화 (v2): `waiting_for_input` 직전 노드가 LLM 호출 등 긴 latency 인 경우 사용자가 답답함을 느낄 수 있음 — `sendChatAction(typing)` 주기적 발송 정책을 별 plan 으로 검토.

### R-K. `chat_channel_token_v2` 컬럼 명명의 semantic 비대칭 (2026-05-21)

`notification_secret_v2` 는 HMAC signing secret 의 v2 (rotation grace 기간 신규 secret), `chat_channel_token_v2` 는 외부 provider bot token reference 의 v2 (rotation grace 기간 신규 token). 두 컬럼은 의미상 직교 (signing secret vs external bot token) 하지만 **명명 패턴은 동일 유지** (`<channel>_<resource>_v2`). 명명 일관성 우선 — 의미 차이는 컬럼 description 으로 명시. 향후 공용 rotation 패턴 통합 검토 시 두 컬럼 모두 영향.
