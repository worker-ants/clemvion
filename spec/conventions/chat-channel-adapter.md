---
id: chat-channel-adapter
status: spec-only
code: []
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
   * EIA outbound 이벤트 → 외부 채널 메시지 변환.
   * NotificationDispatcher 의 in-process EventEmitter listener 가 호출. Side-effect free.
   */
  renderNode(event: EiaEvent, config: ChatChannelConfig): Promise<ChannelMessage[]>;

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
}
```

### 1.1 6함수 책임 / 부작용 / 멱등성

| 함수 | 책임 | 부작용 | 멱등성 |
|---|---|---|---|
| `setupChannel` | 외부 채널의 inbound hook 등록 (텔레그램 `setWebhook`) + bot identity 조회 | 외부 API 호출 1회 이상 | yes — 같은 config 재호출 OK |
| `teardownChannel` | 외부 채널의 hook 해제. 부분 실패 OK (best-effort) | 외부 API 호출 | yes |
| `parseUpdate` | raw body → `ChannelUpdate \| null`. DB 미접근, 외부 API 미호출. 무시 대상은 `null` — **`null` 의 의미는 "어댑터가 해석 불가/무시"** 단일 의미. 호출자(`HooksService`) 가 raw body 에서 provider-specific 메타 (예: 텔레그램 `chat.type`, `from.is_bot`) 를 확인해 안내 메시지 발송 여부를 결정한다 (어댑터는 side-effect free 유지). 안내 발송 책임 = 호출자 | none | pure |
| `renderNode` | EIA payload → `ChannelMessage[]`. side-effect free | none | pure |
| `sendMessage` | 외부 API 호출. 재시도·rate limit 책임 | 외부 API 호출 | dedup 책임은 caller (EIA 의 `seq` + `X-Clemvion-Delivery` 그대로 어댑터 안에서 활용) |
| `ackInteraction` | provider 가 요구하는 ack (텔레그램 `answerCallbackQuery`). provider 에 따라 noop 가능 — 함수 자체는 의무지만 구현체는 비어 있을 수 있음 | 외부 API 호출 (provider 의존) | yes |
| `revokeBotToken?` (옵션) | 이전 bot token 의 외부 provider 측 revocation (Slack `auth.revoke` 등). provider 가 revocation API 를 제공하면 구현, 아니면 미구현 (`undefined`). best-effort — 실패는 swallow | 외부 API 호출 (provider 의존, 옵션) | yes |

### 1.2 EiaEvent 입력

`EiaEvent` 는 [EIA §6 outbound notification payload](../5-system/14-external-interaction-api.md#6-api-명세--outbound-notification) 의 5종 union — 별 신규 타입 정의 없이 EIA spec 의 payload shape 을 재사용 (drift 회피):

```typescript
type EiaEvent =
  | { type: "execution.waiting_for_input"; /* EIA §6.2 */ executionId: string; triggerId: string; workflowId: string; node: { id: string; type: string; interactionType: "form" | "buttons" | "ai_conversation" }; interaction: { /* ... */ }; context: { formConfig?: unknown; buttonConfig?: unknown; conversationConfig?: unknown; conversationThread?: unknown }; timestamp: string; seq: number }
  | { type: "execution.ai_message";        /* EIA §6.5 (ai_message) + WS §4.4 */ executionId: string; triggerId: string; workflowId: string; message: string; turnCount: number; messages: unknown[]; metadata?: unknown; llmCalls?: unknown[]; timestamp: string; seq: number }
  | { type: "execution.completed";         /* EIA §6.3 */ executionId: string; triggerId: string; workflowId: string; result: { outputs: unknown; finalNodeId: string; finalPort: string }; durationMs: number; timestamp: string; seq: number }
  | { type: "execution.failed";            /* EIA §6.4 */ executionId: string; triggerId: string; workflowId: string; error: { code: string; message: string; nodeId: string | null; details?: unknown }; durationMs: number; timestamp: string; seq: number }
  | { type: "execution.cancelled";         /* EIA §6.5 (cancelled) */ executionId: string; triggerId: string; workflowId: string; result: { cancelledBy: "user" | "system" | "timeout" }; durationMs: number; timestamp: string; seq: number };
```

내부 필드의 SoT 는 EIA §6 의 각 페이로드 형식. 본 컨벤션은 어댑터 입력으로 union 만 정의.

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
    | { kind: "contact_share"; phone: string };                  // share_contact
  idempotencyKey: string;          // provider 가 update id 등에서 도출 (텔레그램: update_id)
  receivedAt: string;              // ISO8601
}
```

### 2.2 ChannelMessage (outbound)

```typescript
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
    formMode?: "multi_step";
    /**
     * 시각 렌더 모드 — 동 파일 §2.2 KeyboardHint 의 'text' (입력 hint) 와 의미 다름.
     * default 는 `auto`. v1 photo 선택 시 fallback to text + warning 로그 (Spec Chat Channel §3.3 CCH-MP-04 · providers/telegram.md §5.4).
     * DB 에 저장된 legacy 'text_only' 값은 어댑터가 read-time 에 'text' 로 normalize (마이그레이션 완료 전 과도기 정책 — 후속 developer plan 책임).
     */
    visualNode?: "text" | "photo" | "auto";
    buttonLayout?: "auto" | "vertical" | "horizontal";
  };
  rateLimitPerMinute?: number;
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

## 3. EIA Event → renderNode 매핑

`renderNode(event)` 가 처리해야 하는 5종 EIA 이벤트와 출력 `ChannelMessage[]`:

| EIA event type | 입력 payload | 출력 ChannelMessage 시퀀스 |
|---|---|---|
| `execution.waiting_for_input` (interactionType=form) | `formConfig.fields[]` | 다단계 — 첫 필드의 `form_prompt` 1건. 이후 응답마다 다음 필드 (§4) |
| `execution.waiting_for_input` (interactionType=buttons) | `buttonConfig.buttons[]` + `buttonConfig.nodeOutput` | `buttons` 1건. node output 이 시각형 (carousel/table/chart) 이면 그 앞에 시각 ChannelMessage 시퀀스 추가 — `uiMapping.visualNode` enum 분기 적용 (`text` / `photo` / `auto`, default `auto`). provider 별 v1 fallback 정책 (텔레그램: [§5.4](../4-nodes/7-trigger/providers/telegram.md#54-carousel--chart--table-cch-mp-04) MarkdownV2 텍스트/monospace) 또는 v2 SSR PNG (별 plan `chat-channel-visual-ssr-png`). v1 에서 `photo` 선택 시 fallback to text + warning 로그 (`chat_channel_health` 변경 없음 — 정상 fallback) |
| `execution.waiting_for_input` (interactionType=ai_conversation) | `conversationConfig.message` | `text` 1건 (provider 길이 제한 초과 시 chunked) |
| `execution.ai_message` | `message` | `text` 1건 (chunked 가능) |
| `execution.completed` | `result.outputs` | `text` 1건 — `languageHints.executionCompleted` 또는 result 의 summary |
| `execution.failed` | `error.code` + `error.details.statusCode` (다른 필드 사용 금지) | `text` 1건 — 분류 helper [§3.1](#31-execution-failed-분류-알고리즘) 결과 `(key, placeholders)` → `languageHints[key]` lookup + placeholder 치환. [Spec Chat Channel §3.5 CCH-ERR-*](../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 가 시스템 의무 SoT |
| `execution.cancelled` | `cancelledBy` | `text` 1건 |

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

---

## 4. Form 다단계 시퀀스 규약

`execution.waiting_for_input` (interactionType=form) 도착 시 어댑터는 **필드별 순차 prompt** 로 풀어낸다. 본 시퀀스는 모든 어댑터가 동일하게 구현한다:

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

### R1. 6함수 인터페이스의 책임 분리 (2026-05-21)

`parseUpdate` / `renderNode` 는 **pure 함수**, `setupChannel` / `teardownChannel` / `sendMessage` / `ackInteraction` 는 **side-effect 동반**. 이 분리는 어댑터 테스트 가능성을 결정 — pure 함수는 fixture 기반 단위 테스트, side-effect 함수는 mocked HTTP client 로 통합 테스트. cafe24 의 [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) 메타데이터 구조와 동일한 layer 분리 패턴.

### R2. 6함수 (5+1 ack) 의 의도 (2026-05-21)

ack 는 provider 별 의무 여부가 다르다 (텔레그램은 callback_query 에 `answerCallbackQuery` 의무, Slack 은 일반 reply 에 ack 없음). 6번째 함수로 분리한 이유:
1. **(채택) ackInteraction 을 별도 함수**: provider 가 구체 동작을 노출할 수 있음. noop 구현도 가능.
2. **(기각) sendMessage 안에 흡수**: 어댑터마다 sendMessage 의 책임이 N+1 → 복잡도 증가. noop provider 도 함수만 비울 수 있음 (단순).
3. **(기각) sendMessage 의 옵션 플래그**: 함수 signature 가 mixed concern.

### R3. EiaEvent 를 별 타입으로 정의하지 않고 EIA spec 위임 (2026-05-21)

EIA spec §6 의 payload 가 SoT — 본 컨벤션은 union 만 정의. 두 spec 간 type drift 회피. 구체 필드의 spec 갱신은 항상 EIA spec 우선.

### R4. Form 다단계 시퀀스를 컨벤션 차원에서 강제 (2026-05-21)

모든 어댑터가 같은 시퀀스를 따라야 사용자 경험이 채널 간 일관됨. provider 마다 native form UI 가 있을 수도 있지만 (Telegram Mini App, Slack Block Kit 등) v1 은 다단계 텍스트 시퀀스로 통일 — 컨벤션 차원 강제. native UI 분기는 v2 옵션.

### R5. Execution Failed 분류 helper 를 Convention 에 두는 이유 (2026-05-25)

대안:
1. **(채택) Convention §3.1 의 pure helper**: cross-provider 공통 알고리즘 — Form 다단계 시퀀스 (§4) 와 같은 layer. 어댑터별 중복 구현 회피. 분류 알고리즘 자체는 provider 와 무관 (input = EIA payload, output = i18n key + placeholders, 둘 다 provider invariant).
2. **(기각) 어댑터 인터페이스에 `renderError(event)` 신설**: R2 의 인터페이스 최소화 원칙 그대로 적용 — 6함수 인터페이스 (§1) drift 발생. 새 함수 추가는 모든 provider 어댑터의 contract 변경. 분류 자체가 provider invariant 이므로 함수 분리 이득 없음.
3. **(기각) Spec `15-chat-channel.md` 본문에 알고리즘 표 인라인**: Spec 본문은 요구사항·시스템 동작·EIA 관계 중심. 알고리즘 상세 (입력 타입 / fallback 규칙 / placeholder 정책) 는 형식 규약 — Convention 거주가 더 자연스러움. 본 분리는 cafe24 의 [`cafe24-api-metadata.md`](./cafe24-api-metadata.md) (형식 규약) ↔ [`4-nodes/4-integration/4-cafe24.md`](../4-nodes/4-integration/4-cafe24.md) (시스템·노드 정의) 의 분리 패턴과 동일.
4. **(기각) `error.message` 를 그대로 사용자에게 redact 해서 전달**: 노드 핸들러가 `error.message` 에 URL · query · DB 컬럼명 · stack · API key 일부를 흘릴 가능성. spec 차원 redact 가이드는 모든 노드 핸들러 audit 을 요구 — 비현실적. 대신 분류 결과 (`key`) 로 `languageHints[key]` 에 미리 검증된 generic 문구만 노출. 본 결정의 PII 위험 평가 상세는 [Spec Chat Channel R-CC-15 대안 2](../5-system/15-chat-channel.md#r-cc-15-execution-failed-안내--분류-입력-화이트리스트--placeholder-1종-정책-2026-05-25) 참조.

세부:
- (a) **`renderNode` 시그니처는 미변경** — 본 helper 결과는 어댑터 안에서 `renderNode` 가 직접 호출해 lookup·치환 후 `text` ChannelMessage 합성. dispatcher 가 분류 helper 와 renderNode 를 외부에서 chain 하지 않음 (provider 별 mrkdwn / MarkdownV2 / plain 텍스트 차이가 어댑터 안에서 흡수되어야 하므로).
- (b) **provider 별 텍스트 합성 차이** 는 각 `providers/<name>.md §5.6` 의 SoT. 분류 결과 (key + placeholders) 자체는 provider 무관.
- (c) **breaking change 표기**: §3 매핑 표의 `execution.failed` 행의 입력 계약이 기존 `error.message` → `error.code + details.statusCode` 로 교체된다. 기존 구현 (`renderNode` 의 `execution.failed` 처리) 는 본 컨벤션 갱신과 함께 갱신 대상 — backend 구현 PR (chat-channel-error-notify) 가 동반 처리한다.

---

## Changelog

| 날짜 | 내용 |
|---|---|
| 2026-05-21 | v1 — 6함수 인터페이스 최초 도입 (`setupChannel`, `teardownChannel`, `parseUpdate`, `renderNode`, `sendMessage`, `ackInteraction`). `ChatChannelConfig`, `ChannelUpdate`, `ChannelMessage`, `SetupResult`, `SendResult` 데이터 타입 정의. Form 다단계 시퀀스 규약 및 Adapter Registry 추가. |
| 2026-05-22 | (a) `EiaEvent` union 의 `execution.cancelled` 주석을 `/* EIA §6.5 (cancelled) */`, `execution.ai_message` 주석을 `/* EIA §6.5 (ai_message) + WS §4.4 */` 로 구분하여 가독성 개선 (동일 §6.5 섹션 참조이나 역할 명시). (b) `parseUpdate` 의 `null` 반환 의미를 §1.1 표에 단일 의미("어댑터 해석 불가/무시")로 명확화 + 안내 메시지 발송 책임이 호출자(HooksService/Dispatcher) 임을 명시. (c) `secretToken` 주석을 v1 plaintext stub → `spec-update-chat-channel-bot-token-stub` 별 plan 추적으로 명확화. (d) §4 Form 다단계 step 3 의 "같은 필드 재질문" 을 어댑터 sendMessage 직접 호출 금지(pure 유지) + dispatcher 가 ChannelMessage 발송으로 명확화 (spec-fix-chat-channel-behavior). |
| 2026-05-22 | §3 매핑 표의 시각형 노드 행을 v1 (MarkdownV2 fallback) / v2 (SSR PNG) 정책 분리로 명확화 — provider 별 fallback 구현은 텔레그램 §5.4 참조 (chat-channel-visual-impl). |
| 2026-05-22 | §2.3 `ChatChannelConfig` — `botToken`/`secretToken` 평문 stub 제거, `botTokenRef`/`secretTokenRef` 단일 형태로 정리. §2.4 `SetupResult` — `configUpdates` + `issuedSecretToken` 분리 정식화 (plaintext 가 config 에 흘러들지 않도록). [secret-store.md](./secret-store.md) convention 신설에 따른 동반 갱신 (chat-channel-secret-store-pgcrypto). |
| 2026-05-23 | §2.3 `visualNode` enum 교체 (`text_only`→`text` rename + `auto` 신설, default `auto`). §3 시각형 노드 매핑 행에 enum 분기 인용 추가. v1 photo 선택 시 fallback to text + warning 로그 정책. legacy `text_only` 값 read-time normalize 정책. `KeyboardHint` 'text' 와의 의미 구분 인라인 주석. spec-telegram-chat-channel-ui-polish. |
| 2026-05-24 | §2.3 `ChatChannelConfig` 에 provider-specific webhook 인증 ref 2종 optional 필드 추가 — `signingSecretRef?` (Slack HMAC, provider-issued) / `publicKeyRef?` (Discord ed25519 public key). 기존 `secretTokenRef?` 주석을 "다른 provider 는 별 필드 사용" 으로 명확화. 6함수 인터페이스 / 기타 데이터 타입 변경 없음. spec-slack-discord-chat-channel. |
| 2026-05-24 | §2.3 `ChatChannelConfig` 의 3 필드 (`secretTokenRef?` / `signingSecretRef?` / `publicKeyRef?`) 를 단일 role-based 필드 `inboundSigningRef?` 로 통합. provider 별 자원 성격·발급 주체·검증 알고리즘 분기 표를 주석으로 명시. §2.4 `SetupResult.issuedSecretToken` 도 `issuedInboundSigning` 으로 rename. 6함수 시그니처 변경 없음. Migration 불필요 (production data 없음). spec-chat-channel-inbound-signing-rename. |
| 2026-05-24 | §2.3 `ChatChannelConfig.botIdentity` 에 `teamId?: string` optional 필드 추가 — workspace/team 개념을 가진 provider (Slack workspace, Discord guild) 의 식별자 캐시용. Telegram 등 단일 namespace provider 는 비움. impl-prep cross-spec W-1 해소 (slack.md §3.1 와의 일치). |
| 2026-05-25 | §3 매핑 표 `execution.failed` 행 격상 — 입력 계약을 `error.message` (구) → `error.code + error.details.statusCode` (신) 로 교체 (**breaking change**: 기존 `renderNode(execution.failed)` 구현 갱신 의무, backend 구현 PR `chat-channel-error-notify` 가 동반). 출력은 분류 helper §3.1 결과 → `text` 1건. §3.1 "Execution Failed 분류 알고리즘" 신설 — pure function `classifyExecutionFailure` + `details: unknown` 런타임 type-guard 책임 + 카테고리 매핑 표 + `{statusCode}` placeholder 규약 + unknown fallback. Rationale R5 추가 (기존 `error.message` 접근 기각 사유 R-CC-15 대안 2 cross-ref 포함). 6함수 인터페이스 / 기타 데이터 타입 변경 없음. [`spec/5-system/15-chat-channel.md §3.5 CCH-ERR-*`](../5-system/15-chat-channel.md#35-실행-실패-사용자-안내-cch-err-) 동반 갱신. chat-channel-error-notify. |
