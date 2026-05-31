---
id: chat-channel-adapter
status: partial
code:
  - codebase/backend/src/modules/chat-channel/**
pending_plans:
  - plan/in-progress/chat-channel-discord-gateway.md
  - plan/in-progress/chat-channel-slack-socket-mode.md
  - plan/in-progress/chat-channel-visual-ssr-png.md
---

# CONVENTION: Chat Channel Adapter

> 관련 문서: [Spec Chat Channel](../5-system/15-chat-channel.md) · [Spec Telegram Adapter](../4-nodes/7-trigger/providers/telegram.md) · [Spec External Interaction API](../5-system/14-external-interaction-api.md) · [Spec Trigger 공통 규약](../4-nodes/7-trigger/0-common.md) · [Spec WebSocket 프로토콜 §4.4](../5-system/6-websocket-protocol.md#44-사용자-입력-대기-이벤트-상세-executionwaiting_for_input)

본 컨벤션은 외부 chat 플랫폼 (Telegram, Slack, 카카오 등) 어댑터가 구현해야 하는 **함수 시그니처 + 데이터 타입 계약**을 정의한다. 모든 provider 어댑터는 본 인터페이스를 만족해야 [Spec Chat Channel](../5-system/15-chat-channel.md) 의 시스템 동작과 자동 정합한다. 구체 provider 의 동작 명세는 `spec/4-nodes/7-trigger/providers/<name>.md` 가 단일 진실.

---

## 1. Adapter Interface

```typescript
interface ChatChannelAdapter {
  /** 채널 식별자. config.chatChannel.provider 와 1:1. lower-case kebab-case. */
  readonly provider: string;

  /**
   * provider 가 native form UI (Slack `views.open` modal / Discord MODAL) 를 지원하는지.
   * `true` 면 `uiMapping.formMode` 가 `auto`/`native_modal` 이고 form 의 모든 필드가 해당 provider 의
   * modal 수용 가능 타입이며 `fields.length <= 5` 일 때 §4.1 native modal 경로를 탄다.
   * `false` (Telegram 등) 는 항상 §4.2 다단계.
   * 본 플래그의 값은 각 어댑터 구현체가 선언하며 (§5 신규 어댑터 절차 step 5), provider 별 modal 수용
   * field type 범위는 `providers/<name>.md §5.3` 가 SoT. 설계 근거: §R-CCA-8.
   */
  readonly supportsNativeForm: boolean;

  /**
   * Trigger 생성/활성화 시 1회 호출. 외부 채널의 webhook/long-poll 등록.
   * @returns 어댑터별 setup 결과 (예: bot identity 등) — 일부는 config 에 캐시됨.
   */
  setupChannel(config: ChatChannelConfig, callbackUrl: string): Promise<SetupResult>;

  /** Trigger 비활성화/삭제 시 호출. 외부 hook 해제. 부분 실패 OK (best-effort). */
  teardownChannel(config: ChatChannelConfig): Promise<void>;

  /**
   * 외부 채널 → 워크플로우 input 변환. webhook 진입점이 호출.
   * Side-effect free (DB 미접근, 외부 API 미호출). 무시 대상 (group chat, 봇 자기 메시지 등) 은 `null` 반환.
   */
  parseUpdate(raw: unknown, config: ChatChannelConfig): Promise<ChannelUpdate | null>;

  /**
   * EIA outbound 이벤트 + chat-channel-internal 이벤트 → 외부 채널 메시지 변환.
   * 단일 sink `WebsocketService.executionEvents$` 를 직접 구독하는 `ChatChannelDispatcher` (NotificationDispatcher 와 형제 listener) 가 호출. Side-effect free.
   * 입력 union: §1.2 `EiaEvent` (EIA §6 5종) + §1.3 `ChatChannelInternalEvent` (chat-channel-internal).
   * 어댑터 구현체는 `event.type` discriminated union 분기로 처리. SoT: §R-CCA-7.
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]>;

  /**
   * 외부 채널 API 호출 (sendMessage / sendPhoto / answerCallbackQuery 등).
   * 재시도·rate limit·error handling 책임.
   */
  sendMessage(message: ChannelMessage, config: ChatChannelConfig): Promise<SendResult>;

  /**
   * 일부 채널은 인터랙션 receipt ack 가 의무 (텔레그램 answerCallbackQuery).
   * inbound interact 명령 처리 직후 호출. ack 가 의무가 아닌 provider 는 noop 구현 가능.
   */
  ackInteraction(update: ChannelUpdate, config: ChatChannelConfig): Promise<void>;

  /**
   * (옵션) Bot token rotation 시 *이전* token 을 외부 provider 측에서 revoke.
   *
   * Slack 의 `auth.revoke` 처럼 외부 provider 가 token revocation API 를 제공하는 경우 구현.
   * Telegram / Discord 처럼 revocation 이 의미 없거나 제공되지 않는 provider 는 미구현 (undefined).
   * 호출자 (`TriggersService.rotateBotToken`) 는 본 메서드 존재 여부를 type-guard 로 확인 후 best-effort
   * 호출 — 실패해도 rotation 자체는 진행 (24h grace 안에 v2 token 은 새 token 으로 작동).
   *
   * @param oldBotToken — rotation 직전 보유했던 plaintext bot token.
   * @returns 외부 API 응답 무관 void. 내부 에러는 caller 에 propagate 하지 않고 swallow (logger.warn).
   */
  revokeBotToken?(oldBotToken: string): Promise<void>;

  /**
   * (옵션, `supportsNativeForm=true` 한정) §4.1 native modal open.
   * `open_form_modal` command 도착 시 `HooksService` 가 호출 — conversation state 의
   * `pendingFormModal.fields` + `openContext` (trigger_id / interaction token) 로 modal 합성.
   * Slack 은 `views.open` API 호출 후 `httpResponse` 비움, Discord 는 modal 을 webhook HTTP
   * 응답 body (`{ type: 9 }`) 로 반환 (`OpenFormModalResult.httpResponse`).
   * 호출자가 `ackInteraction` 이 아닌 이유: §R-CCA-8 (b) — ackInteraction 시그니처는 form 필드 미보유.
   */
  openFormModal?(params: OpenFormModalParams): Promise<OpenFormModalResult>;

  /**
   * (옵션, `supportsNativeForm=true` 한정) §4.1 modal 제출의 provider HTTP 응답 합성.
   * EIA `submit_form` 호출은 `HooksService` 담당. 본 메서드는 ack / 검증 실패 재표시 body 만 합성 (pure).
   */
  buildFormSubmissionResponse?(params: {
    config: ChatChannelConfig;
    validationError?: { field?: string; message: string };
  }): FormSubmissionResult;
}
```

### 1.1 6함수 책임 / 부작용 / 멱등성

| 함수 | 책임 | 부작용 | 멱등성 |
|---|---|---|---|
| `setupChannel` | 외부 채널의 inbound hook 등록 (텔레그램 `setWebhook`) + bot identity 조회 | 외부 API 호출 1회 이상 | yes — 같은 config 재호출 OK |
| `teardownChannel` | 외부 채널의 hook 해제. 부분 실패 OK (best-effort) | 외부 API 호출 | yes |
| `parseUpdate` | raw body → `ChannelUpdate \| null`. DB 미접근, 외부 API 미호출. 무시 대상은 `null` — **`null` 의 의미는 "어댑터가 해석 불가/무시"** 단일 의미. 호출자(`HooksService`) 가 raw body 에서 provider-specific 메타 (예: 텔레그램 `chat.type`, `from.is_bot`) 를 확인해 안내 메시지 발송 여부를 결정한다 (어댑터는 side-effect free 유지). 안내 발송 책임 = 호출자 | none | pure |
| `renderNode` | `EiaEvent \| ChatChannelInternalEvent` payload → `ChannelMessage[]`. side-effect free. 입력 union 은 §1.2 / §1.3 정의. SoT: §R-CCA-7 (union 확장 근거) | none | pure |
| `sendMessage` | 외부 API 호출. 재시도·rate limit 책임 | 외부 API 호출 | dedup 책임은 caller (EIA 의 `seq` + `X-Clemvion-Delivery` 그대로 어댑터 안에서 활용) |
| `ackInteraction` | provider 가 요구하는 ack (텔레그램 `answerCallbackQuery`). provider 에 따라 noop 가능 — 함수 자체는 의무지만 구현체는 비어 있을 수 있음 | 외부 API 호출 (provider 의존) | yes |
| `revokeBotToken?` (옵션) | 이전 bot token 의 외부 provider 측 revocation (Slack `auth.revoke` 등). provider 가 revocation API 를 제공하면 구현, 아니면 미구현 (`undefined`). best-effort — 실패는 swallow | 외부 API 호출 (provider 의존, 옵션) | yes |
| `openFormModal?` (옵션, `supportsNativeForm=true` 한정) | §4.1 native modal 게이팅 — `form_modal` 버튼 클릭 (`open_form_modal` command) 시 modal open. Slack 은 `views.open(trigger_id, view)` API 호출, Discord 는 webhook HTTP 응답 body `{ type: 9 }` MODAL 반환 (`OpenFormModalResult.httpResponse`). 호출자 = `HooksService` (modal 합성에 conversation state 의 `pendingFormModal.fields` 가 필요하므로 — `ackInteraction(update, config)` 시그니처는 form 필드 미보유, §R-CCA-8 b 참조) | 외부 API 호출 또는 HTTP 응답 body 합성 (provider 의존) | yes |
| `buildFormSubmissionResponse?` (옵션, `supportsNativeForm=true` 한정) | §4.1 modal 제출 (`form_submission` command) 의 provider HTTP 응답 합성 — EIA `submit_form` 호출은 `HooksService` 담당, 본 메서드는 ack (Slack 빈 200 / Discord `{ type: 4 }` ephemeral) 또는 검증 실패 재표시 body (Slack `response_action: errors`) 만 합성. pure (외부 호출 없음, body 합성만) | none | pure |

### 1.2 EiaEvent 입력

`EiaEvent` 는 [EIA §6 outbound notification payload](../5-system/14-external-interaction-api.md#6-api-명세--outbound-notification) 의 5종 union — 별 신규 타입 정의 없이 EIA spec 의 payload shape 을 재사용 (drift 회피):

```typescript
type EiaEvent =
  | { type: "execution.waiting_for_input"; /* EIA §6.2 */ executionId: string; triggerId: string; workflowId: string; node: { id: string; type: string; interactionType: "form" | "buttons" | "ai_conversation" | "ai_form_render" /* SoT: [interaction-type-registry §1](./interaction-type-registry.md#1-waitinginteractiontype) — 4종 (ai_form_render = ai-agent render_form blocking sub-state). chat channel 안에서는 ai_conversation 과 동일 경로. */ }; interaction: { /* ... */ }; context: { formConfig?: unknown; buttonConfig?: unknown; conversationConfig?: unknown; conversationThread?: unknown }; timestamp: string; seq: number }
  | { type: "execution.ai_message";        /* EIA §6.5 (ai_message) + WS §4.4 */ executionId: string; triggerId: string; workflowId: string; message: string; turnCount: number; messages: unknown[]; metadata?: unknown; llmCalls?: unknown[]; /** AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉. SoT: [Spec AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반) / [EIA §6.5 line 536](../5-system/14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message). */ presentations?: PresentationPayload[]; timestamp: string; seq: number }
  | { type: "execution.completed";         /* EIA §6.3 */ executionId: string; triggerId: string; workflowId: string; result: { outputs: unknown; finalNodeId: string; finalPort: string }; durationMs: number; timestamp: string; seq: number }
  | { type: "execution.failed";            /* EIA §6.4 */ executionId: string; triggerId: string; workflowId: string; error: { code: string; message: string; nodeId: string | null; details?: unknown }; durationMs: number; timestamp: string; seq: number }
  | { type: "execution.cancelled";         /* EIA §6.5 (cancelled) */ executionId: string; triggerId: string; workflowId: string; result: { cancelledBy: "user" | "system" | "timeout" }; durationMs: number; timestamp: string; seq: number };
```

내부 필드의 SoT 는 EIA §6 의 각 페이로드 형식. 본 컨벤션은 어댑터 입력으로 union 만 정의.

### 1.3 ChatChannelInternalEvent 입력

chat-channel 어댑터가 EIA outbound 5종 외에 추가로 구독하는 **in-process 이벤트**. 외부 SDK 미노출 — EIA §6.1 outbound HTTP webhook 화이트리스트와는 별도 표면. 구독 소스: 단일 sink `WebsocketService.executionEvents$` (R8 — NotificationDispatcher·SseAdapter 와 동일 facade 계층의 형제 listener) — chat-channel `Dispatcher` 가 presentation 노드 한정 sub-filter 로 attach.

```typescript
type ChatChannelInternalEvent =
  | {
      type: "execution.node.completed";
      // SoT: WS §4.4 execution.node.completed — same event name, consumed as chat-channel-internal.
      // EIA §6.1 outbound 5종 화이트리스트는 변경 없음. 외부 SDK 미노출.
      executionId: string;
      triggerId: string;
      workflowId: string;
      node: { id: string; type: "carousel" | "table" | "chart" | "template"; label?: string };
      /** NodeHandlerOutput.output — 예: Template 의 `{rendered, ...}`, Carousel 의 `{items, ...}`. */
      output: Record<string, unknown>;
      meta?: Record<string, unknown>;
      timestamp: string;
      seq: number;
    };
```

`node.type` 은 4종 display-only presentation 한정 (form 제외, AI Agent / LLM / code 등 비-presentation 노드 무시). filter 책임은 어댑터 (sub-filter). blocking 진입 케이스 (`nodeExec.outputData.status === 'waiting_for_input'`) 도 어댑터 sub-filter 가 사전 제외 — 그 케이스는 `execution.waiting_for_input` (interactionType=buttons) 이 별도로 발사.

근거: §R-CCA-7 (`renderNode` 시그니처 union 확장 근거).

---

## 2. 데이터 타입

### 2.1 ChannelUpdate (inbound)

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
    | { kind: "contact_share"; phone: string }                   // share_contact
    | { kind: "form_submission"; fields: Record<string, string> }; // §4.1 native modal 일괄 제출 (Slack view_submission / Discord MODAL_SUBMIT)
  idempotencyKey: string;          // provider 가 update id 등에서 도출 (텔레그램: update_id)
  receivedAt: string;              // ISO8601
}
```

**`form_submission` normalize 책임**: provider 별 modal submit payload (Slack `view.state.values` / Discord `data.components[].components[]`) 를 `{ [fieldName]: rawValue }` 로 평탄화하는 책임은 `parseUpdate` **안**에서 수행한다 — pure 계약 (DB·외부 API 미접근) 을 유지하며 payload 변환만 한다. optional 필드가 빈 입력이면 해당 key 를 생략한다 (§4.2 다단계 시퀀스의 optional 필드 미답변과 동일 정책 — `submit_form(data)` 에 미포함). server-side 필수/형식 검증은 EIA `submit_form` 계약이 단일 진실.

### 2.2 ChannelMessage (outbound)

```typescript
interface ChannelMessage {
  conversationKey: string;
  body:
    | { kind: "text"; text: string; chunked?: boolean }
    | { kind: "buttons"; text: string; buttons: ChannelButton[] }
    | { kind: "form_prompt"; fieldName: string; label: string; hint?: KeyboardHint }
    | { kind: "form_modal"; openLabel: string; formConfig: unknown }  // §4.1 — "양식 열기" 버튼 메시지. 클릭 시 어댑터가 formConfig 로 modal view 합성
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

**`form_modal` 의 의미**: `execution.waiting_for_input` (interactionType=form) 이 §4.1 native modal 경로로 분기될 때 어댑터 `renderNode` 가 합성하는 "양식 작성하기" 버튼 메시지 1건이다. server-initiated push 시점에는 trigger_id/interaction token 이 없어 modal 을 즉시 못 열기 때문에 (§R-CCA-8 대안 4), 버튼으로 사용자 클릭 interaction 을 유도하고 그 클릭이 `open_form_modal` command 로 parse 되면 `HooksService` 가 `openFormModal` (§1.1) 로 modal 을 연다. 필드 구성은 다음과 같다:
- `openLabel`: 버튼 라벨. `languageHints.formOpenLabel` override → `languageLocale` default (KO "양식 작성하기" / EN "Open form") → 'ko' fallback ([§2.3 languageLocale](#23-chatchannelconfig) lookup 순서).
- `formConfig`: §1.2 `EiaEvent` 의 `execution.waiting_for_input.context.formConfig` 원본 (`fields[]` 포함) — type 은 EIA spec §6.2 가 SoT 이므로 `unknown` 으로 두고 (R3 drift 회피), 어댑터가 클릭 시점에 [Form spec §1](../4-nodes/6-presentation/4-form.md#1-설정-config) 의 fields shape 으로 읽어 provider native modal view (Slack input blocks / Discord TEXT_INPUT) 로 변환한다.

### 2.3 ChatChannelConfig

`Trigger.config.chatChannel` 의 in-memory representation. 구조는 [Spec Chat Channel §4.1](../5-system/15-chat-channel.md#41-triggerconfigchatchannel) 의 단일 진실을 따른다 (drift 회피 — 본 컨벤션은 type signature 만 가리킴).

```typescript
interface ChatChannelConfig {
  provider: string;
  /** secret store ref (`secret://triggers/{id}/bot-token`). plaintext 는 어댑터의 side-effect 함수가 SecretResolver 로 resolve. */
  botTokenRef: string;
  /**
   * Inbound webhook 출처 검증용 자료의 ref (`secret://triggers/{id}/inbound-signing`).
   * Provider 무관 단일 슬롯이며, 검증 알고리즘과 발급 주체는 backend 가 provider 별로 분기:
   *
   * | provider | 자원 성격 | 발급 주체 | 검증 알고리즘 |
   * |---|---|---|---|
   * | Telegram | shared secret (server-issued) | 어댑터 `setupChannel` 의 `randomBytes` | `X-Telegram-Bot-Api-Secret-Token` 헤더 동일성 |
   * | Slack    | HMAC-SHA256 signing secret    | Slack 앱 install 시 발급, 사용자 manual 입력 | `X-Slack-Signature` = HMAC-SHA256(secret, "v0:" + ts + ":" + body) |
   * | Discord  | ed25519 application public key | Discord Developer Portal 발급, 사용자 manual 입력 | `X-Signature-Ed25519` ed25519 verify (raw body + timestamp) |
   *
   * Provider 별 동작 SoT — [`providers/telegram.md §6`](../4-nodes/7-trigger/providers/telegram.md#6-보안) · [`providers/slack.md §6`](../4-nodes/7-trigger/providers/slack.md#6-보안) · [`providers/discord.md §6`](../4-nodes/7-trigger/providers/discord.md#6-보안).
   *
   * Optional — provider 에 따라 inbound 인증을 별도 자료 없이 (예: webhook URL 의 randomness 만으로)
   * 처리하는 case 가 있을 수 있어 `?` 유지. 단 v1 의 세 provider 는 모두 본 ref 가 필수다.
   */
  inboundSigningRef?: string;
  /**
   * setupChannel 결과 캐시 — provider 가 발급한 bot identity.
   * `botId` / `username` 은 모든 provider 공통. `teamId` 는 workspace/team 개념을 가진 provider
   * (Slack workspace, Discord guild 등) 만 채움 — Telegram 등 단일 namespace provider 는 비움.
   */
  botIdentity?: { botId: number; username: string; teamId?: string };
  uiMapping?: {
    /**
     * Form 입력 표면 선택. default "auto".
     * - "auto": `supportsNativeForm === true` && form 의 모든 필드가 provider modal 수용 타입 &&
     *   `fields.length <= 5` → §4.1 native modal, 아니면 §4.2 다단계.
     * - "native_modal": modal 우선. 위 조건 미충족 (fields > 5 / 미지원 타입 포함 / supportsNativeForm=false)
     *   시 §4.2 다단계 fallback.
     * - "multi_step": 항상 §4.2 다단계 (modal 지원 provider 에서도 강제 — 채널 간 UX 통일 선호 사용자 opt-out).
     * 기존 단일 리터럴 "multi_step" 의 상위 호환 확장 — legacy DB 값 "multi_step" 은 의미 동일.
     * SoT(설계 근거): §R-CCA-8.
     */
    formMode?: "multi_step" | "native_modal" | "auto";
    /**
     * 시각 렌더 모드 — 동 파일 §2.2 KeyboardHint 의 'text' (입력 hint) 와 의미 다름.
     * default 는 `auto`. v1 photo 선택 시 fallback to text + warning 로그 (Spec Chat Channel §3.3 CCH-MP-04 · providers/telegram.md §5.4).
     * DB 에 저장된 legacy 'text_only' 값은 어댑터가 read-time 에 'text' 로 normalize (마이그레이션 완료 전 과도기 정책).
     */
    visualNode?: "text" | "photo" | "auto";
    buttonLayout?: "auto" | "vertical" | "horizontal";
  };
  rateLimitPerMinute?: number;
  /**
   * `languageHints` 미설정 키의 default 문구 locale 선택. default "ko".
   * 어댑터의 lookup 순서: (1) `languageHints[key]` override → (2) 본 locale 의 default 문구
   * → (3) 'ko' fallback. 본 lookup 책임은 어댑터 — Convention §3.1 의 `classifyExecutionFailure`
   * helper 는 `key` 만 결정 (locale 무관).
   *
   * @see spec/5-system/15-chat-channel.md §4.1.1 (KO/EN default 12 문구 표)
   */
  languageLocale?: "ko" | "en";
  languageHints?: Record<string, string>;
}
```

### 2.4 SetupResult / SendResult

```typescript
interface SetupResult {
  registeredAt: string;             // ISO8601
  externalHookUrl?: string;          // 어댑터별 디버깅용 (텔레그램 getWebhookInfo 결과)
  identity?: Record<string, unknown>; // botId, username 등 (config.botIdentity 에 캐시)
  /**
   * 어댑터가 setupChannel 동안 확정한 config 갱신분 (botIdentity 등). issuedInboundSigning
   * plaintext 는 본 필드에 흘리지 않음 — 별도 필드로 분리.
   */
  configUpdates?: Partial<ChatChannelConfig>;
  /**
   * setupChannel 직후 1회만 노출되는 inbound-signing 자료의 plaintext (server-issued 한정 — 현재
   * v1 에서는 Telegram 만 `setWebhook.secret_token` 을 어댑터가 `randomBytes` 로 발급). caller
   * (`TriggersService.setupChatChannel`) 가 즉시 `SecretResolver.store(secret://triggers/{id}/inbound-signing, ...)`
   * 로 보관 후 ref 를 config 의 `inboundSigningRef` 에 set 한다. plaintext 가 config 에
   * 흘러들어가지 않도록 분리 — SS-SE-01 정책 적용.
   *
   * Slack / Discord 처럼 사용자가 manual 입력 (provider-issued) 하는 provider 는 본 필드를 채우지
   * 않는다 — 사용자 입력값이 직접 caller 의 `SecretResolver.store` 로 들어가고 ref 만 config 에 set.
   */
  issuedInboundSigning?: string;
}

interface SendResult {
  externalMsgId: string;            // provider 가 부여한 메시지 ID (텔레그램 message_id)
  sentAt: string;                   // ISO8601
}
```

---

## 3. EIA / Internal Event → renderNode 매핑

`renderNode(event)` 가 처리해야 하는 EIA 외부 5종 + chat-channel-internal 이벤트와 출력 `ChannelMessage[]`. 외부 EIA outbound HTTP webhook 표면 (EIA §6.1) 은 5종 그대로 — 본 표의 마지막 행 (`execution.node.completed` chat-channel-internal) 은 §1.3 `ChatChannelInternalEvent` 입력으로 별도 표면:

| Event type | 입력 payload | 출력 ChannelMessage 시퀀스 |
|---|---|---|
| `execution.waiting_for_input` (interactionType=form) | `formConfig.fields[]` | **formMode 분기** (§4): (a) **native modal** (§4.1) — `supportsNativeForm` && 전 필드 modal 수용 타입 && `fields ≤ 5` && `formMode ≠ multi_step`: `form_modal` 1건 (양식 열기 버튼) → 클릭 시 어댑터가 modal open → submit 시 `form_submission` 일괄 수집 → EIA `submit_form` 단일 호출. (b) **다단계** (§4.2) — 그 외: 첫 필드 `form_prompt` 1건, 이후 응답마다 다음 필드 |
| `execution.waiting_for_input` (interactionType=buttons) | `buttonConfig.buttons[]` + `buttonConfig.nodeOutput` | `buttons` 1건. node output 이 시각형 (carousel/table/chart) 이면 그 앞에 시각 ChannelMessage 시퀀스 추가 — `uiMapping.visualNode` enum 분기 적용 (`text` / `photo` / `auto`, default `auto`). provider 별 v1 fallback 정책 (텔레그램: [§5.4](../4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04) MarkdownV2 텍스트/monospace) 또는 v2 SSR PNG. v1 에서 `photo` 선택 시 fallback to text + warning 로그 (`chat_channel_health` 변경 없음 — 정상 fallback) |
| `execution.waiting_for_input` (interactionType=ai_conversation) | — (silent) | **빈 array** — chat channel 에서 silent. 이유: ai-agent multi-turn 의 매 turn 마다 (a) `execution.ai_message` event 가 응답 본문을 emit, (b) 직후 `waiting_for_input(ai_conversation).conversationConfig.message` 가 같은 본문을 echo (frontend reconcile 용도). chat channel 에 둘 다 발송하면 사용자에게 동일 메시지 2회 도착. messaging app UX 에서 텍스트 입력 자체가 default prompt 이므로 awaitingInput 안내도 발송 안 함. 본 결정은 [Rationale R-CCA-6](#r-cca-6-ai_conversation--ai_form_render-waiting-chat-channel-silent-정책) 참조 |
| `execution.waiting_for_input` (interactionType=ai_form_render) | — (silent) | ai_conversation 과 동일 경로 — **빈 array**. ai_form_render 는 ai-agent 의 render_form blocking sub-state ([interaction-type-registry §1](./interaction-type-registry.md#1-waitinginteractiontype)). v2 의 chat channel form 인라인 처리는 후속 |
| `execution.ai_message` | `message` (필수) + `presentations?[]` (옵션) | `text` 1건+ (chunked 가능) + (presentations 가 비어있지 않으면) 5종 presentation 각각을 v1 fallback 으로 렌더해 ChannelMessage 시퀀스로 text 뒤에 **sequential `await`** 추가 발송 (`Promise.all` 금지 — provider rate limit + 표시 순서 보장). 4종 display-only (`carousel`/`table`/`chart`/`template`) 는 [§5.4 v1 fallback](../4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04) (CCH-MP-04 와 동일) 재사용. `render_form` (`presentations[*].type === 'form'`) 은 **v1 임시 텍스트 fallback** — fields 목록 + 답변 안내 텍스트로 발화 ([R-CC-17](../5-system/15-chat-channel.md#r-cc-17)). v2 가 native modal/Mini App 으로 격상하기 전까지 임시 정책. SoT: [AI Agent §7.10](../4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반) / [EIA §6.5 line 536](../5-system/14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message). |
| `execution.completed` | `result.outputs` | `text` 1건 — `languageHints.executionCompleted` 또는 result 의 summary |
| `execution.failed` | `error.code` + `error.details.statusCode` (다른 필드 사용 금지) | `text` 1건 — 분류 helper [§3.1](#31-execution-failed-분류-알고리즘) 결과 `(key, placeholders)` → `languageHints[key]` lookup + placeholder 치환. [Spec Chat Channel §3.5 CCH-ERR-*](../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 가 시스템 의무 SoT |
| `execution.cancelled` | `cancelledBy` | `text` 1건 |
| `execution.node.completed` (presentation 노드 한정, **chat-channel-internal** — §1.3 `ChatChannelInternalEvent`) | `node.type ∈ {template, carousel, table, chart}` + `output` | `template`: `output.rendered` 를 `text` 1건 (MarkdownV2 escape). `carousel`/`table`/`chart`: §5.4 v1 fallback 의 `renderCarouselFallback`/`renderTableFallback`/`renderChartFallback` 그대로 재사용. **buttons 가 있는 (blocking) 케이스는 `execution.waiting_for_input` (interactionType=buttons) 행이 별도 처리** — 어댑터 sub-filter 가 `nodeExec.outputData.status === 'waiting_for_input'` 인 케이스를 사전 필터링. `form` 노드는 항상 blocking 이라 본 row 대상 아님. SoT: [Spec Chat Channel §3.1 CCH-AD-07](../5-system/15-chat-channel.md#31-실행-엔진과의-연결) / §3.3 CCH-MP-06. |

### 3.1 Execution Failed 분류 알고리즘

`execution.failed` 이벤트를 사용자 안내 메시지로 변환하기 전, **provider-invariant pure function** 이 `(key, placeholders)` 를 결정한다. 어댑터 (`renderNode`) 는 본 helper 결과로 [Spec Chat Channel §4.1 `languageHints`](../5-system/15-chat-channel.md#41-triggerconfigchatchannel) 의 i18n template 을 lookup·치환하여 `text` ChannelMessage 1건을 합성한다.

```typescript
interface ExecutionFailureClass {
  /** languageHints lookup key — Spec Chat Channel §4.1 의 6 키 중 1개. */
  key:
    | "executionFailedThirdParty4xx"
    | "executionFailedThirdParty5xx"
    | "executionFailedThirdParty"
    | "executionFailedTimeout"
    | "executionFailedRateLimit"
    | "executionFailedInternal";
  /** i18n template placeholder 치환값. 화이트리스트 = `{statusCode}` 1종 (정수). */
  placeholders: { statusCode?: number };
}

/**
 * Pure function. Side-effect free. Provider-invariant.
 * 입력 화이트리스트 (CCH-ERR-02): `event.error.code` + `event.error.details?.statusCode` 만.
 *
 * 타입 안전성: §1.2 의 `EiaEvent` union 에서 `details: unknown` 로 선언되어 있으므로,
 * 본 helper 는 `statusCode` 접근 전 런타임 type-guard 수행 의무 —
 * `typeof details === 'object' && details !== null && 'statusCode' in details && typeof (details as any).statusCode === 'number'`.
 * 가드 실패 시 `placeholders.statusCode` omit (undefined).
 */
function classifyExecutionFailure(event: Extract<EiaEvent, { type: "execution.failed" }>): ExecutionFailureClass;
```

**카테고리 매핑** (`error.code` enum 의 SoT 는 [`spec/5-system/3-error-handling.md §1.4 / §3.2`](../5-system/3-error-handling.md#14-워크플로우-실행-에러)):

| `error.code` | 추가 조건 | 결과 `key` | placeholders |
|---|---|---|---|
| `HTTP_4XX` | `details.statusCode` ∈ [400, 499] (있으면) | `executionFailedThirdParty4xx` | `{ statusCode }` (없으면 omit) |
| `HTTP_5XX` | `details.statusCode` ∈ [500, 599] (있으면) | `executionFailedThirdParty5xx` | `{ statusCode }` (없으면 omit) |
| `HTTP_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `HTTP_TRANSPORT_FAILED` | — | `executionFailedThirdParty` | `{}` |
| `LLM_RATE_LIMIT` | — | `executionFailedRateLimit` | `{}` |
| `LLM_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `LLM_CALL_FAILED` · `LLM_RESPONSE_INVALID` · `MAX_COLLECTION_RETRIES_EXCEEDED` | — | `executionFailedThirdParty` | `{}` |
| `EMAIL_SEND_FAILED` | — | `executionFailedThirdParty` | `{}` |
| `EXECUTION_TIMEOUT` (engine) · `CODE_TIMEOUT` | — | `executionFailedTimeout` | `{}` |
| `CODE_EXECUTION_FAILED` · `SUB_WORKFLOW_FAILED` · `DB_*` · `RECURSION_DEPTH_EXCEEDED` · `MAX_ITERATIONS_EXCEEDED` · `CYCLE_DETECTED` · `INVALID_EXPRESSION` · `VARIABLE_NOT_FOUND` · `TYPE_MISMATCH` · `ERROR_PORT_FALLBACK` | — | `executionFailedInternal` | `{}` |
| 그 외 모든 code (`error.code === null` 포함) | unknown — fallback | `executionFailedInternal` | `{}` (+ backend `warn` 로그, CCH-ERR-04) |

**`statusCode` placeholder omit 규칙**: `details.statusCode` 가 missing 이거나 정수가 아닌 경우 (type-guard 실패), `4xx`/`5xx` 분기 자체는 `error.code` (`HTTP_4XX`/`HTTP_5XX`) 만으로 결정한다 (HTTP 노드 핸들러는 `error.code` 와 `details.statusCode` 를 일관되게 set 한다고 가정 — 노드 핸들러 계약). placeholder 가 omit 되면 어댑터는 template 의 `{statusCode}` 토큰을 `"?"` 로 치환 (또는 `({statusCode})` 괄호 segment 전체 제거 — 어댑터 자유). 사용자 영향 ≈ 0.

**위치**: 본 helper 는 `codebase/backend/src/modules/chat-channel/shared/execution-failure-classifier.ts` 한 파일로 구현. 어댑터별 호출만 (provider-specific 분기 없음).

**locale 분기 책임**: 본 helper 는 `key` 만 결정 — locale 별 default 문구 lookup 은 어댑터 책임 ([Spec Chat Channel §4.1.1](../5-system/15-chat-channel.md#411-languagehints-default-문구--ko--en) 의 KO/EN 표). 어댑터의 lookup 순서: (1) `languageHints[key]` override → (2) `config.chatChannel.languageLocale` 의 default → (3) 'ko' fallback. helper 는 locale 무관 (key 자체는 locale 과 직교).

---

## 4. Form 입력 시퀀스 규약

`execution.waiting_for_input` (interactionType=form) 도착 시 어댑터는 `uiMapping.formMode` + `supportsNativeForm` capability + 필드 구성으로 두 경로 중 하나를 택한다:

- **§4.1 native modal** — `supportsNativeForm === true` && `formMode !== "multi_step"` && form 의 모든 필드가 해당 provider 의 modal 수용 타입 (`providers/<name>.md §5.3` SoT) && `formConfig.fields.length <= 5`.
- **§4.2 다단계 텍스트 시퀀스** — 그 외 모든 경우 (Telegram 등 modal 미지원 / fields > 5 / modal 비수용 타입 포함 / 사용자 `multi_step` opt-out). 기존 규약.

진입 조건 평가는 어댑터 책임이며, modal 진입 실패 (사용자가 버튼 미클릭 / modal dismiss) 시에도 execution 은 waiting 유지 — 어댑터는 §4.2 로 자동 강등하지 않고 버튼 메시지를 유지한다 (사용자 재클릭 가능). EIA waiting timeout 정책에 위임 (별도 신설 없음).

### 4.1 Native modal 경로

provider 가 native form UI (Slack `views.open` / Discord MODAL) 를 지원할 때 5 fields 이하 form 을 단일 modal 로 처리한다. trigger_id (Slack 3초) / interaction token (Discord 15분) 가용성 제약 때문에 **버튼 게이팅** 이 필수:

```
1. form 도착 → renderNode 가 form_modal ChannelMessage 1건 합성 (openLabel 버튼 + formConfig 동봉).
   conversation state 에 pendingForm = { fields, mode: "native_modal" } 저장.
2. 사용자가 버튼 클릭 → provider interaction 도착 → parseUpdate 가 open_form_modal command 반환
   (openContext = Slack { triggerId } 3초 / Discord { interactionId, interactionToken } 15분)
   → HooksService 가 openFormModal (§1.1) 로 즉시 modal open
     (Slack views.open(trigger_id, view) / Discord interaction response type:9 MODAL).
   view 는 fields[] 를 provider native input 으로 변환 (providers/<name>.md §5.3 표). block_id/custom_id = fieldName.
3. modal 작성 후 submit → Slack view_submission / Discord MODAL_SUBMIT
   → parseUpdate 가 { kind: "form_submission", fields } 로 일괄 normalize (§2.1).
4. client-side 검증 (전 필드 type/pattern/minLength — provider native 검증 우선 활용 후 어댑터 schema 검증)
   → 통과 시 EIA submit_form (data: fields) 단일 호출.
5. server-side 검증 실패 (400 VALIDATION_FAILED + fieldErrors) → modal 을 error 와 함께 재표시:
   - Slack: view_submission 응답으로 { response_action: "errors", errors: { <block_id>: <msg> } } (modal 유지).
   - Discord: 후속 메시지의 버튼 재노출로 modal 재open 유도 (Interactions 응답 후 동일 modal 재전송 불가 — providers/discord.md §5.3 SoT).
6. 성공 시 다음 EIA 이벤트로 진행.
```

native modal 도 provider native 검증 (Slack input `min_length`/`max_length`, Discord TEXT_INPUT `min_length`/`max_length`/`required`) 을 우선 활용하고, 그 외 schema 검증 (pattern/email 등) 은 submit 직후 어댑터가 수행 — 실패 시 step 5 의 error 재표시 경로. §4.2 의 "잘못된 필드만 다시" 정신은 modal 에서도 동일 (전체 modal 유지, 틀린 필드만 error 강조).

### 4.2 다단계 텍스트 시퀀스

`execution.waiting_for_input` (interactionType=form) 을 어댑터가 **필드별 순차 prompt** 로 풀어낸다. 본 시퀀스는 modal 미지원/비대상 form 에서 모든 어댑터가 동일하게 구현한다:

```
1. formConfig.fields[0] → form_prompt 발송. "현재 필드 인덱스" 를 conversation state 에 저장 (currentFieldIdx=0)
2. 사용자 응답 (text_message / contact_share 등) → adapter 가 EIA submit_form 을 즉시 호출하지 않고 자체 버퍼에 채움 (partialFormData[fields[0].name] = value)
3. 필드 단위 클라이언트-side 검증 (type / pattern / minLength 등 schema 차원)
   - 실패 → 같은 필드의 `form_prompt` ChannelMessage 를 dispatcher 가 다시 발송. `parseUpdate` 자체는
     pure 계약 (side-effect free) 을 유지하므로 어댑터가 직접 `sendMessage` 를 호출하지 않는다 —
     재질문 `ChannelMessage` 생성·발송 책임은 호출자 (ChatChannelDispatcher / HooksService).
   - 성공 → currentFieldIdx++, 다음 필드 prompt
4. 마지막 필드 응답 + 클라이언트-side 검증 통과 → EIA submit_form (data: partialFormData) 호출
5. EIA 가 server-side 검증 실패 (400 VALIDATION_FAILED + fieldErrors) 응답 시
   → fieldErrors[0].field 를 currentFieldIdx 로 되돌리고 그 필드 재질문
   (EIA-RL-03 활용 — execution 상태 유지)
6. 성공 시 다음 EIA waiting_for_input 또는 ai_message / completed 이벤트 도착
```

server-side validation 실패 시 어댑터가 currentFieldIdx 를 되돌리는 정책 덕분에 사용자는 "처음부터 다시" 가 아니라 "잘못된 필드만 다시" 답할 수 있다.

---

## 5. Adapter Registry

```typescript
interface ChannelAdapterRegistry {
  register(adapter: ChatChannelAdapter): void;
  get(provider: string): ChatChannelAdapter;
  has(provider: string): boolean;
}
```

`provider` 문자열은 lower-case, kebab-case (예: `"telegram"`, `"slack"`, `"kakao-talk"`). 신규 어댑터 추가 시:

1. `spec/4-nodes/7-trigger/providers/<name>.md` 신설 — 구체 명세
2. `codebase/backend/src/modules/chat-channel/providers/<name>/<name>.adapter.ts` 구현 — `ChatChannelAdapter` 구현
3. `ChatChannelModule` 의 onModuleInit 에서 registry 에 `register()`
4. `spec/4-nodes/7-trigger/providers/_overview.md` 인덱스에 새 provider 행 추가
5. `supportsNativeForm` capability (§1) 값을 어댑터 구현체에 선언 — native form modal (§4.1) 지원 여부. 지원 시 modal 수용 field type 범위를 `providers/<name>.md §5.3` 에 명시

---

## 6. 보안

- `botTokenRef` / `inboundSigningRef` 등 자격증명은 [`SecretResolver`](./secret-store.md) 가 관리하는 secret store 의 ref 만 보관 ([CCH-SE-03](../5-system/15-chat-channel.md#34-신뢰성--보안)). plaintext 는 config JSONB / 로그 / metric 에 절대 노출 금지 — `SetupResult.issuedInboundSigning` 1회 노출 외에는 어떤 경로로도 plaintext 가 어댑터 밖으로 흐르지 않는다.
- `sendMessage` 의 외부 API 호출은 provider 별 고정 URL 만 사용 (사용자 제어 URL 금지) — SSRF 차단.
- `parseUpdate` 는 raw body 의 trust 검증 후 호출 — 진입점 핸들러가 [WH-SC-02](../5-system/12-webhook.md#42-hmac-서명) 또는 provider 별 secret token (텔레그램 `X-Telegram-Bot-Api-Secret-Token`) 검증을 선행.

---

## 7. 변경 관리

본 컨벤션은 [Spec Chat Channel](../5-system/15-chat-channel.md) 의 시스템 동작과 짝지어 진화한다. 본 인터페이스 변경은 다음 두 spec 동시 갱신 의무:

- `spec/5-system/15-chat-channel.md` (시스템 정의)
- `spec/4-nodes/7-trigger/providers/<name>.md` (모든 구체 어댑터 명세)

`spec/4-nodes/7-trigger/providers/_overview.md` 의 catalog 도 함께 갱신.

---

## Rationale

> **Rationale ID 컨벤션**: 본 컨벤션 파일의 신규 Rationale 은 **`R-CCA-N` prefix** (`CCA` = Chat Channel Adapter) 를 사용한다. 기존 `R1~R4` 는 하위 호환 유지 (rename 시 cross-link 깨짐 위험). cross-file 인용 시에는 `[CCA §R-CCA-N]` 형태로 파일 prefix 명시. 이는 [Spec Chat Channel §3.1 Rationale ID 컨벤션](../5-system/15-chat-channel.md#rationale-id-컨벤션) 의 `R-CC-N` 패턴과 동일 정신 — Convention 파일은 별 prefix `R-CCA-N` 으로 충돌 방지.

### R1. 6함수 인터페이스의 책임 분리

`parseUpdate` / `renderNode` 는 **pure 함수**, `setupChannel` / `teardownChannel` / `sendMessage` / `ackInteraction` 는 **side-effect 동반**. 이 분리는 어댑터 테스트 가능성을 결정 — pure 함수는 fixture 기반 단위 테스트, side-effect 함수는 mocked HTTP client 로 통합 테스트. cafe24 의 [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) 메타데이터 구조와 동일한 layer 분리 패턴.

### R2. 6함수 (5+1 ack) 의 의도

ack 는 provider 별 의무 여부가 다르다 (텔레그램은 callback_query 에 `answerCallbackQuery` 의무, Slack 은 일반 reply 에 ack 없음). `ackInteraction` 을 별도 함수로 분리해 provider 가 구체 동작을 노출할 수 있게 한다 (noop 구현도 가능). `sendMessage` 안에 흡수하면 어댑터마다 sendMessage 의 책임이 늘어 복잡도가 증가하고, 옵션 플래그로 처리하면 함수 signature 가 mixed concern 이 된다.

### R3. EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임

EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec 간 type drift 회피. 구체 필드의 spec 갱신은 항상 EIA spec 우선.

### R4. Form 다단계 시퀀스를 컨벤션 차원에서 강제

모든 어댑터가 같은 시퀀스를 따라야 사용자 경험이 채널 간 일관됨. provider 마다 native form UI 가 있을 수도 있지만 (Telegram Mini App, Slack Block Kit 등) v1 의 **기본**은 다단계 텍스트 시퀀스로 통일 — 컨벤션 차원 강제. 일반적 native UI 분기는 v2 옵션이나, "지원 provider + 5 fields 이하 + 전 필드 modal 수용 타입" 의 제한 케이스만 v1 에서 예외적으로 native modal 을 허용한다 ([R-CCA-8](#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal)).

R4 가 예고한 "native UI 분기는 v2 옵션" 을 [R-CCA-8](#r-cca-8-native-form-modal-예외-절--5-fields-이하-single-modal) 로 실현 — §4.1 native modal 예외 절 신설. 이는 R4 가 기각한 대안의 재도입이 **아니라** R4 본문이 명시한 미래 경로의 활성화다. R4 의 핵심 가치 (다단계 시퀀스의 채널 간 일관성) 는 (a) `formMode: "multi_step"` opt-out, (b) modal 미지원 provider (Telegram, `supportsNativeForm=false`) 자동 다단계, (c) fields > 5 / modal 비수용 타입 포함 시 다단계 fallback 으로 보존된다 — modal 은 "지원 provider + 5 fields 이하 + 전 필드 modal 수용 타입" 한정 추가 표면.

### R-CCA-5. Execution Failed 분류 helper 를 Convention 에 두는 이유

분류 helper 는 Convention §3.1 의 pure helper 로 둔다 — cross-provider 공통 알고리즘이라 Form 다단계 시퀀스 (§4) 와 같은 layer 이며, 어댑터별 중복 구현을 회피한다. 분류 알고리즘 자체는 provider 와 무관 (input = EIA payload, output = i18n key + placeholders, 둘 다 provider invariant). 어댑터 인터페이스에 `renderError(event)` 를 신설하면 R2 의 인터페이스 최소화 원칙에 어긋나 6함수 인터페이스 (§1) drift 가 발생하고, 분류가 provider invariant 이므로 함수 분리 이득이 없다. Spec `15-chat-channel.md` 본문에 알고리즘 표를 인라인하지 않는 이유는 알고리즘 상세 (입력 타입 / fallback 규칙 / placeholder 정책) 가 형식 규약이라 Convention 거주가 더 자연스럽기 때문 — cafe24 의 [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) (형식 규약) ↔ [`4-nodes/4-integration/4-cafe24.md`](../4-nodes/4-integration/4-cafe24.md) (시스템·노드 정의) 분리 패턴과 동일. `error.message` 를 그대로 redact 해 전달하지 않는 이유는 노드 핸들러가 `error.message` 에 URL · query · DB 컬럼명 · stack · API key 일부를 흘릴 가능성 때문 — spec 차원 redact 가이드는 모든 노드 핸들러 audit 을 요구해 비현실적이라, 분류 결과 (`key`) 로 `languageHints[key]` 의 미리 검증된 generic 문구만 노출한다. 본 결정의 PII 위험 평가 상세는 [Spec Chat Channel R-CC-15 대안 2](../5-system/15-chat-channel.md#r-cc-15-execution-failed-안내--분류-입력-화이트리스트--placeholder-1종-정책) 참조.

세부:
- (a) **`renderNode` 시그니처는 미변경** — 본 helper 결과는 어댑터 안에서 `renderNode` 가 직접 호출해 lookup·치환 후 `text` ChannelMessage 합성. dispatcher 가 분류 helper 와 renderNode 를 외부에서 chain 하지 않음 (provider 별 mrkdwn / MarkdownV2 / plain 텍스트 차이가 어댑터 안에서 흡수되어야 하므로).
- (b) **provider 별 텍스트 합성 차이** 는 각 `providers/<name>.md §5.6` 의 SoT. 분류 결과 (key + placeholders) 자체는 provider 무관.

### R-CCA-6. `ai_conversation` / `ai_form_render` waiting — chat channel silent 정책

chat channel 에서는 silent — 빈 array 를 반환한다. ai-agent multi-turn 의 매 turn 흐름이 (a) `ai_message` event 로 응답 본문을 emit 한 후 (b) 직후 `waiting_for_input(ai_conversation).conversationConfig.message` 가 **같은 본문을 echo** (frontend reconcile 용도) 하므로, chat channel 어댑터가 둘 다 발송하면 **사용자에게 동일 메시지 2회 도착** 한다. chat channel 의 책임 분리: `ai_message` 가 응답 본문 발송, `waiting_for_input(ai_conversation)` 는 silent (다음 사용자 입력 대기 시그널만 — messaging app UX 에서 텍스트 입력 자체가 default prompt 이므로 별도 안내 불필요). `conversationConfig.message` 를 그대로 발송하면 ai-agent emit 동작과 결합해 항상 중복 발송된다. dispatcher dedup cache (content-based) 는 의도된 중복 발송 시나리오를 차단하는 단점이 있고, `ai-agent` emit 동작 변경 (`waiting_for_input.conversationConfig.message` 비우기) 은 `frontend` reconcile / hydration / `EIA SSE` 외부 consumer 가 `conversationConfig.message` 를 다르게 사용 중일 수 있어 cross-spec 영향이 크다.

세부:
- (a) **첫 turn 의 ai-agent 안내**: 정상 ai-agent 노드는 첫 turn 에 `ai_message` 를 emit 후 waiting. 첫 turn 에 `ai_message` 없이 waiting 만 emit 되는 시나리오는 본 spec 가정에서 정상 흐름 아님 (만약 발생하면 사용자는 텍스트 직접 입력하면 됨 — messaging app 의 default UX).
- (b) **chat channel UX**: messaging app 의 텍스트 입력 자체가 default prompt — 별도 "메시지를 보내주세요" 안내가 UX noise.
- (c) **buttons / form interactionType 영향 없음**: 본 정책은 `ai_conversation` / `ai_form_render` 만 silent. `buttons` / `form` 은 그대로 발송 (각각 inline_keyboard / form prompt 가 ai-agent 의 응답과 다른 자원).

### R-CCA-7. `renderNode` 시그니처 union 확장 — chat-channel-internal 이벤트 수용

chat-channel 어댑터가 EIA outbound 5종 외에 chat-channel-internal 이벤트 (`execution.node.completed` presentation 노드 한정) 도 처리해야 한다. 비-blocking presentation 노드 (Template body, buttons 없는 Carousel/Table/Chart) 의 본문이 외부 채널에 발화되도록 하기 위함.

`renderNode` 입력 union 을 확장한다 — `renderNode(event: EiaEvent | ChatChannelInternalEvent)`. 함수 개수 6 을 유지해 [R-CCA-5](#r-cca-5) 의 "새 함수 추가 = 인터페이스 drift" 정신을 보존한다. union 패턴은 이미 EIA §6 5종 union 으로 확립돼 있어 variant 1종 추가에 해당하며, provider 어댑터 구현체는 기존 EIA 5종 분기와 동일 패턴으로 `event.type` discriminated union 분기를 추가한다. 7번째 함수 `renderPresentationNode` 신설은 R-CCA-5 가 명시 기각한 "함수 개수 증가 = 모든 provider 어댑터 contract 변경" 패턴을 재현하므로 채택하지 않는다 (`ChatChannelInternalEvent` 처리의 provider 별 차이는 함수 *내부* 분기로 흡수 가능). `EiaEvent` union 자체에 `execution.node.completed` 를 추가하면 [R3](#r3-eiaevent-를-별-타입으로-정의하지-않고-eia-spec-위임) 의 "EIA spec §6 SoT, drift 회피" 에 위배되고 `EiaEvent` type name (EIA §6 outbound 5종) 의 의미 경계가 붕괴하므로, 별도 type `ChatChannelInternalEvent` 로 분리해 의미 경계를 보존한다. EIA §6.1 outbound HTTP webhook 화이트리스트를 6종으로 확장 (`node.completed` 외부 노출) 하지 않는 이유는 외부 SDK breaking change 이며 본 갭이 chat-channel 전용 UX 라 외부 표면 확장이 불필요하기 때문.

세부:

- (a) **구독 소스**: 단일 sink `WebsocketService.executionEvents$` (R8 — NotificationDispatcher·SseAdapter 와 동일 facade 계층의 형제 listener) 그대로 사용. presentation 노드 한정 sub-filter 만 어댑터 측에 추가. EIA R10 의 "단일 sink" 원칙 위배 아님 (어댑터는 기존 sink 의 consumer 한정, 새 sink 도입 없음).
- (b) **EIA-RL-04 (TX commit 후 발송) 정합**: `WebsocketService.emitToExecution` 이 실행 엔진 §4.4 의 단일 sink 로서 TX commit 후 호출됨. NotificationDispatcher after-commit hook 과 동일 fan-out 채널 — `execution.node.completed` 도 동일 보장.
- (c) **per-trigger `ChannelListenerRegistry`**: R8 의 미등록 trigger silent skip 가드 정책 그대로 적용 — `execution.node.completed` 도 동일 가드.
- (d) **blocking 케이스 사전 필터링**: presentation 노드가 buttons 로 인해 blocking 진입 (`nodeExec.outputData.status === 'waiting_for_input'`) 한 경우는 `execution.waiting_for_input` (interactionType=buttons) 이 별도 처리. 어댑터 sub-filter 가 본 케이스를 사전 제외 (중복 발송 방지).
- (e) **form 노드 제외**: form 노드는 항상 blocking — `execution.waiting_for_input` (interactionType=form/ai_form_render) 흐름이 처리. `node.type ∈ {template, carousel, table, chart}` 4종 한정.
- (f) **provider 별 렌더 차이 흡수**: Telegram 은 [§5.4 v1 fallback](../4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04) MarkdownV2, Slack/Discord 도 동일 fallback 정책. v2 SSR PNG 는 후속.

### R-CCA-8. Native form modal 예외 절 — 5 fields 이하 single modal

[R4](#r4-form-다단계-시퀀스를-컨벤션-차원에서-강제) 가 예고한 "native UI 분기는 v2 옵션" 의 실현. provider 가 native form UI (Slack `views.open` / Discord MODAL) 를 지원하면 5 fields 이하 form 을 단일 modal 로 처리 (§4.1).

formMode capability 기반 분기 + 버튼 게이팅 + 5 fields 한계를 택한다. `supportsNativeForm` capability (§1) 로 provider 능력을 표면화하고, `uiMapping.formMode` (`auto`/`native_modal`/`multi_step`) 로 사용자가 제어한다. modal 미오픈 시점 (server push) 제약은 `form_modal` 버튼 게이팅 (§4.1 step 1~2) 으로 해소하며, Telegram 은 `supportsNativeForm=false` 로 자동 §4.2 다단계를 유지해 R4 핵심 가치 (채널 간 일관성) 를 보존한다. 모든 provider 에 modal 을 강제하지 않는 이유는 Telegram 이 native modal 미지원 (Mini App 은 별도 큰 작업) 이라 채널 간 UX 분기가 과다해지고 R4 일관성 가치가 훼손되기 때문. fields > 5 를 multi-page modal 로 처리하지 않는 이유는 Discord modal 이 최대 5 ACTION_ROW × 1 TEXT_INPUT = **5 hard limit** 이라, Slack 이 더 많은 input block 을 지원하더라도 공통 분모를 5 로 통일해 provider 간 동작 일관성을 확보하기 위함 (5 초과는 §4.2 다단계가 단순·일관). 버튼 게이팅 없이 form 도착 즉시 modal 을 열지 못하는 이유는 `execution.waiting_for_input` 이 server-initiated push 라 그 시점에 trigger_id (Slack) / interaction token (Discord) 가 없어 modal open API 호출이 기술적으로 불가능하기 때문 — 반드시 사용자 interaction 으로 token 을 확보한 뒤 열어야 한다.

세부:

- (a) **modal 수용 field type 제약**: provider 별로 modal 이 수용하는 field type 이 다르다 — Slack modal 은 `plain_text_input`/`static_select`/`datepicker`/`checkboxes` 를 input block 으로 지원, Discord modal 은 **TEXT_INPUT 만** 지원 (SELECT_MENU/datepicker 는 modal 밖 component). 따라서 §4.1 진입 조건은 fields ≤ 5 외에 **"전 필드가 해당 provider 의 modal 수용 타입"** 도 포함한다 (각 `providers/<name>.md §5.3` SoT). Discord 의 경우 select/radio/checkbox/date 또는 file 필드가 1개라도 있으면 fields ≤ 5 여도 §4.2 다단계 fallback (file 은 [R-D-7/R-D-9](../4-nodes/7-trigger/providers/discord.md#r-d-7-v1-file-필드-사실상-미지원-r-d-3-의-결과) v1 미지원과 정합).
- (b) **modal open 은 전용 옵션 메서드 `openFormModal?` (+ `buildFormSubmissionResponse?`)** — `supportsNativeForm=true` provider 한정 옵션. `ackInteraction(update, config)` 시그니처는 **modal view 합성에 필요한 form 필드 (conversation state 의 `pendingFormModal.fields`) 를 받지 못하므로** (modal 합성은 fields + provider token 둘 다 필요, ack 시점엔 token 만), modal open 은 ackInteraction 내부 분기가 아닌 전용 옵션 메서드로 분리한다. R-CCA-5/R-CCA-7 의 "함수 추가 = 모든 provider contract 변경" 정신은 **옵션(`?`) 시그니처** 로 보존 — modal 미지원 provider (Telegram) 는 미구현, 기존 6함수 필수 계약 불변. `supportsNativeForm` 은 함수가 아닌 capability 플래그.
- (c) **server-side 검증 재표시**: §4.2 의 "잘못된 필드만 다시" 정신을 modal 에서도 유지 — Slack `response_action: errors`, Discord modal 재open (§4.1 step 5).
- (d) **production data 없음**: `formMode` default 를 `auto` 로 전환해도 기존 DB 의 `"multi_step"` 값은 의미 동일 (상위 호환 확장). production data 부재로 마이그레이션 불필요.
