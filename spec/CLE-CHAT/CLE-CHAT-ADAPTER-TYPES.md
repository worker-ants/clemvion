---
id: "CLE-CHAT-ADAPTER-TYPES"
title: "채팅 채널 어댑터 규약 — 이벤트와 데이터 타입"
type: "convention"
version: 1
status: "approved"
requirements: []
basis_superseded: false
parent: "CLE-CHAT-ADAPTER"
ancestors: ["CLE-VISION", "CLE-IX", "CLE-CHAT", "CLE-CHAT-ADAPTER"]
area: "CLE-CHAT"
content_hash: "681e3e10b0d1f0498dae491a9d7bc188280f3cb7d6020e6a97ab66499b7404b7"
read_as: "approved_fallback"
task: "CLE-T-55J6ZX"
source_paths: []
mirror_sha256: "bc52b0562e1c20d2fc9edb4f4381663353a2a3a7837b8f6b4540416fce1515f7"
etag: "sha256-564543a79e5a1b34a986132b0dcadf491f23a5ae264e2b83b84b6e7fb482d0ef"
---
## 개요

이 문서는 [채팅 채널 어댑터 규약](CLE-CHAT-ADAPTER.md) 의 하위 문서로 채널 어댑터가 받는 입력 이벤트(`EiaEvent`·`ChatChannelInternalEvent`)와 입출력 데이터 타입(`ChannelUpdate`·`ChannelMessage`·`ChatChannelConfig`·`SetupResult`·`SendResult`)을 정한다. 네이티브 모달 타입은 [Form 입력 흐름](CLE-CHAT-ADAPTER-FORM.md) 이, 인터랙션 기본 응답 타입은 [인터페이스와 함수 책임](CLE-CHAT-ADAPTER-IFACE.md) 이 정한다.

## 입력 이벤트

### EiaEvent

`EiaEvent` 는 [EIA 알림 웹훅](../CLE-IX/CLE-EIA-NOTIFY.md) 이 정한 아웃바운드 이벤트 다섯 가지의 union 이다. 새 타입을 만들지 않고 EIA 페이로드 모양을 그대로 쓴다(R3).

```typescript
type EiaEvent =
  | { type: "execution.waiting_for_input"; executionId: string; triggerId: string; workflowId: string;
      node: { id: string; type: string; interactionType: "form" | "buttons" | "ai_conversation" | "ai_form_render" };
      interaction: { /* ... */ };
      context: { formConfig?: unknown; buttonConfig?: unknown; conversationConfig?: unknown; conversationThread?: unknown };
      timestamp: string; seq: number }
  | { type: "execution.ai_message"; executionId: string; triggerId: string; workflowId: string;
      message: string; turnCount: number; messages: unknown[]; metadata?: unknown;
      /** AI 에이전트 render_* 표시 도구 턴에만 실린다. */
      presentations?: PresentationPayload[];
      timestamp: string; seq: number }
  | { type: "execution.completed"; executionId: string; triggerId: string; workflowId: string; status: "completed";
      result?: { outputs?: unknown }; durationMs?: number | null; timestamp: string; seq: number }
  | { type: "execution.failed"; executionId: string; triggerId: string; workflowId: string; status: "failed";
      error: { code: string | null; message: string; nodeId: string | null; details?: unknown } | string;
      durationMs?: number | null; timestamp: string; seq: number }
  | { type: "execution.cancelled"; executionId: string; triggerId: string; workflowId: string; status: "cancelled";
      result: { cancelledBy: "user" | "system" | "timeout" }; error?: { code: string; message?: string };
      durationMs?: number | null; timestamp: string; seq: number };
```

- 필드의 기준은 EIA 페이로드다. 종결 세 가지(`completed`·`failed`·`cancelled`)의 필드 집합과 행동 계약도 EIA 가 기준이다. 위 variant 는 그것을 TypeScript 로 옮긴 것이고, 어긋나면 EIA 가 맞다. 필드 집합 표와 행동 계약은 두 곳에 적었다가 실제로 어긋난 적이 있어 여기서 다시 나열하지 않는다. 이벤트 봉투는 평평한 WebSocket 계열이고 `result` 중첩은 유지된다.
- `waiting_for_input` 의 `node`·`interaction`·`context` 는 EIA 의 논리 표기다. 실제 wire 는 `waitingNodeId`·`waitingNodeType`·`interactionType`·`nodeOutput` 같은 평평한 필드이고, dispatcher 가 `toChatChannelEvent` 로 바꿔 채널 어댑터에 넘긴다. `node.type` 은 `waitingNodeType` 에서 온다. `interactionType` 이 `buttons` 인 노드는 Template·Carousel·Table·Chart 가운데 하나라 시각형 메시지를 붙일지는 `interactionType` 만으로 정할 수 없고 `node.type` 을 본다. `interaction` 블록은 EIA 에서 아직 보내지 않는다(미구현).
- 입력 대기 표면(`interactionType`)은 네 값이다([인터랙션 타입 레지스트리](../CLE-IX/CLE-IX-TYPES.md)). `ai_form_render` 는 AI 에이전트 `render_form` 의 블로킹 하위 상태이고 채팅 채널에서는 `ai_conversation` 과 같은 경로다. 채널 어댑터는 서버 안 소비자라 네 값을 받는다. 현재 구현(dispatcher)도 그대로 넘기고, 레지스트리가 이 위치들을 값별 분기 위치로 등록한다([인터랙션 타입 레지스트리 §서버 안 소비자: 채팅 채널](../CLE-IX/CLE-IX-TYPES.md#서버-안-소비자-채팅-채널)). EIA 외부 경로에서 `ai_form_render` 가 어떻게 보이는지는 [인터랙션 타입 레지스트리 §미결 사항](../CLE-IX/CLE-IX-TYPES.md#미결-사항) 에서 다룬다.
- 디버그 전용 `llmCalls` 는 fanout 단계에서 지워져 채널 어댑터에 오지 않는다([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md)).
- `presentations` 의 기준은 [AI 에이전트 노드 출력과 디버그](../CLE-NODE-AI/CLE-NODE-AGENT-OUTPUT.md) 다.
- `completed` 의 `result` 가 선택인 이유: 현재 발행은 `status` 와 `durationMs` 를 채우고 `result.outputs` 만 미구현이다. `cancelled` 의 `result.cancelledBy` 는 발행 타입이 필수로 강제한다([EIA 알림 웹훅 「종결 이벤트 필드 집합」](../CLE-IX/CLE-EIA-NOTIFY.md#종결-이벤트-필드-집합)). `durationMs` 는 2026-08-15 에 종결 세 가지 모두 구현됐고, 모르면 `null` 이다.
- `failed` 의 `error` 가 `| string` 을 품는 이유는 따로 있다. 발행은 2026-08-14 부터 모든 경로가 object(`toTerminalErrorPayload`)다. union 은 배포 경계에서 재생되는 옛 이벤트를 받으려고 일부러 남겼다. 지우면 그 창 동안 실행 실패 안내가 조용히 빠진다.

### ChatChannelInternalEvent

채널 어댑터가 EIA 다섯 가지 밖에 더 받는 서버 안 이벤트다. EIA 클라이언트 SDK 에 드러나지 않고 EIA 알림 웹훅 허용 목록과도 별개다. 구독 원천은 단일 sink `WebsocketService.executionEvents$` 다.

```typescript
type ChatChannelInternalEvent =
  | {
      type: "execution.node.completed";   // 내부 union 판별자. WebSocket 이벤트와 이름은 같고 모양은 다르다. 채팅 채널 안에서만 소비
      executionId: string;
      triggerId: string;
      workflowId: string;
      node: { id: string; type: "carousel" | "table" | "chart" | "template"; label?: string };
      /**
       * 노드 출력(NodeHandlerOutput) 전체(= NodeExecution.outputData)다.
       * 도메인 값은 한 겹 아래 output.output 에 있다(예: Template 의 {rendered, …}, Carousel 의 {items, …}).
       * dispatcher 가 wire 의 p.output 을 그대로 넘기기 때문이다.
       */
      output: Record<string, unknown>;
      meta?: Record<string, unknown>;
      timestamp: string;
      seq: number;
    };
```

- `type` 은 이 union 의 판별자다. 같은 이름의 WebSocket 이벤트([WebSocket 이벤트와 명령](../CLE-API/CLE-API-WS-EVENTS.md))는 `nodeId`·`nodeType`·`nodeLabel` 이 평평한 wire 모양이고 `triggerId`·`workflowId` 가 없다. dispatcher 가 `toChatChannelEvent` 에서 이 모양으로 바꾼다.
- 필드 대응: `nodeId` → `node.id`, `nodeType` → `node.type`, `nodeLabel` → `node.label`(있을 때만)이고 `output`·`meta` 는 그대로 옮긴다. `triggerId`·`workflowId` 는 fan-out 이벤트 payload 의 같은 이름 필드에서 읽고, 없으면 이벤트를 버린다. `seq` 는 fan-out 이벤트의 순번이다. `timestamp` 는 payload 값이고 없으면 변환 시각이다.
- `output` 은 노드 출력 전체라 `output.rendered` 를 바로 읽으면 `undefined` 다. 도메인 값은 `output.output` 에 있다. 노드 출력과 wire 의 구분 기준은 [노드 출력 규약](../CLE-NODE/CLE-NODE-OUTPUT.md) 이다.
- `node.type` 은 표시 전용 Presentation 네 가지뿐이다. Form, AI 에이전트, LLM, Code 같은 다른 노드는 받지 않는다.
- 버튼 때문에 입력 대기로 들어간 경우(`nodeExec.outputData.status === 'waiting_for_input'`)는 미리 걸러 낸다. 그 경우는 `execution.waiting_for_input`(buttons)이 따로 나간다. 현재 구현은 dispatcher 가 이벤트를 바꿀 때(`toChatChannelEvent`) 이 거름을 한다.

## 데이터 타입

### ChannelUpdate

채널 어댑터 입력 쪽 공통 타입이다.

```typescript
interface ChannelUpdate {
  conversationKey: string;        // 대화 키(Telegram: chat_id)
  channelUserKey: string;         // 채널 사용자 키(Telegram: user_id)
  command:
    | { kind: "start" }                                          // /start
    | { kind: "cancel" }                                         // /cancel
    | { kind: "text_message"; text: string }                     // 일반 텍스트
    | { kind: "button_callback"; callbackData: string; callbackQueryId: string; messageId?: string }
        // 인라인 키보드 탭. callbackQueryId 는 ackInteraction(answerCallbackQuery) 대상(Telegram).
        // ack 의무가 없는 프로바이더(Slack·Discord)는 빈 문자열.
        // messageId(선택)는 버튼이 달린 원본 메시지 id. ack 뒤 키보드를 지워 중복 클릭을 막는다(Telegram callback_query.message.message_id)
    | { kind: "file_upload"; fileId: string; mimeType: string; filename?: string; urlPrivate?: string }
        // 파일 첨부. filename·urlPrivate(선택)는 enrichInbound 가 채운다(Slack files.info)
    | { kind: "contact_share"; phone: string }                   // 연락처 공유
    | { kind: "open_form_modal"; openContext: Record<string, string> }
        // 네이티브 모달 게이팅, "양식 작성하기" 버튼 클릭. openContext 는 이 시점에만 쓸 수 있는
        // trigger_id(Slack)·interaction token(Discord). HooksService 가 openFormModal 로 모달을 연다
    | { kind: "form_submission"; fields: Record<string, string> }; // 네이티브 모달 일괄 제출(Slack view_submission, Discord MODAL_SUBMIT)
  idempotencyKey: string;         // 중복 제거 키. 프로바이더 update id 등에서 만든다(Telegram: update_id)
  receivedAt: string;             // ISO8601
  responseUrl?: string;           // 선택. Slack 인터랙션 payload 의 response_url. ackInteraction 이 원본 메시지 갱신에 쓴다
}
```

`form_submission` 평탄화는 `parseUpdate` 안에서 한다. 프로바이더별 모달 제출 payload(Slack `view.state.values`, Discord `data.components[].components[]`)를 `{ [fieldName]: rawValue }` 로 편다. 순수 계약은 지키고 payload 변환만 한다. 선택 필드가 비어 있으면 그 키를 뺀다(다단계 질문에서 선택 필드를 답하지 않은 경우와 같이 `submit_form(data)` 에 넣지 않는다). 서버 쪽 필수·형식 검증은 EIA `submit_form` 계약이 기준이다.

### ChannelMessage

채널 어댑터 출력 쪽 공통 타입이다.

```typescript
interface ChannelMessage {
  conversationKey: string;
  body:
    | { kind: "text"; text: string; chunked?: boolean }
    | { kind: "buttons"; text: string; buttons: ChannelButton[] }
    | { kind: "form_prompt"; fieldName: string; label: string; hint?: KeyboardHint }
    | { kind: "form_modal"; openLabel: string; formConfig: unknown }  // "양식 열기" 버튼 메시지. 클릭하면 채널 어댑터가 formConfig 로 모달을 만든다
    | { kind: "image"; bytes: Buffer; caption?: string; fallbackText: string }
    | { kind: "typing" };                // sendChatAction 등
  replyToExternalId?: string;            // 선택. 프로바이더별 답장·스레드
}

interface ChannelButton {
  id: string;                            // EIA click_button 의 buttonId
  label: string;
  type: "callback" | "link";             // callback → click_button, link → 외부 URL
  url?: string;                          // type=link
  style?: "primary" | "danger" | "none"; // 선택. 시각 강조. 프로바이더별 매핑(Discord PRIMARY·DANGER, Telegram ✅·⚠️ 라벨 접두). 없으면 프로바이더 기본
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

`form_modal` 은 Form 입력 대기가 네이티브 모달 경로로 갈 때 `renderNode` 가 만드는 "양식 작성하기" 버튼 메시지 1건이다. 서버가 먼저 보내는 시점에는 `trigger_id`·interaction token 이 없어 모달을 바로 열 수 없으므로([R-CCA-8](CLE-CHAT-ADAPTER-FORM.md#r-cca-8-네이티브-폼-모달-예외-필드-5개-이하-모달-하나)), 버튼으로 사용자 클릭을 받고 그 클릭을 `open_form_modal` 명령으로 해석해 `HooksService` 가 `openFormModal` 로 연다.

- `openLabel`: 버튼 라벨. `languageHints.formOpenLabel` 덮어쓰기 → `languageLocale` 기본값(KO "양식 작성하기", EN "Open form") → `ko` 순서로 찾는다.
- `formConfig`: `execution.waiting_for_input.context.formConfig` 원본(`fields[]` 포함). 타입은 EIA 가 기준이라 `unknown` 으로 둔다(R3). 채널 어댑터가 클릭 때 [Form 노드](../CLE-NODE-PRES/CLE-NODE-FORM.md) 의 fields 모양으로 읽어 프로바이더 모달 view(Slack input block, Discord `TEXT_INPUT`)로 바꾼다.

### ChatChannelConfig

`Trigger.config.chatChannel` 의 메모리 표현이다. 필드 계약은 [채팅 채널 데이터와 흐름](CLE-CHAT-DATA.md) 이 기준이고 여기서는 타입 시그니처만 둔다.

채널 어댑터가 받는 설정은 저장된 값 그대로가 아니다. 읽기 관문(`chat-channel-secret-refs.ts` 의 `readTriggerChatChannelConfig`)이 시크릿 참조를 트리거 id 로 다시 만든 사본이다([시크릿 저장소 「규칙」](../CLE-INT/CLE-INT-SECRET.md#규칙) 24). 읽기 관문은 저장값에서 참조의 있음 · 없음만 읽는다. 없는 참조를 붙이지 않고 있는 참조를 지우지 않는다. 채널 어댑터는 받은 참조를 그대로 `resolve` 한다.

```typescript
interface ChatChannelConfig {
  provider: string;
  /**
   * 시크릿 참조(secret://triggers/{id}/bot-token). 평문은 채널 어댑터의 부수 효과 함수가 SecretResolver 로 푼다.
   * 선택: 트리거 최초 생성 시점(setupChannel·rotate-bot-token 이전)에는 undefined.
   * 옛 행은 웹훅 수신 때 botTokenRef === undefined 면 건너뛴다.
   */
  botTokenRef?: string;
  /**
   * 인바운드 서명 자료 참조(secret://triggers/{id}/inbound-signing). 프로바이더 공통 단일 슬롯이고,
   * 검증 알고리즘과 발급 주체는 백엔드가 프로바이더별로 나눈다(아래 표).
   * 선택: 서명 자료 없이 URL 무작위성만으로 인증하는 프로바이더가 생길 수 있어 ? 로 둔다.
   * 1차 범위의 세 채널 프로바이더는 규약상 필수다. 참조가 없는 행의 임시 동작은 아래 표 뒤 문단.
   */
  inboundSigningRef?: string;
  /**
   * setupChannel 결과 캐시. botId·username 은 공통이고 teamId 는 workspace·team 개념이 있는
   * 프로바이더(Slack workspace, Discord guild 등)만 채운다.
   * publicKey(선택)는 Discord GET /applications/@me 의 verify_key 캐시(ed25519 공개키, 비민감).
   */
  botIdentity?: { botId: number; username: string; teamId?: string; publicKey?: string };
  uiMapping?: {
    /** Form 입력 표면. 기본 "auto". 뜻은 Form 입력 흐름. 옛 DB 값 "multi_step" 은 뜻이 같다(상위 호환). */
    formMode?: "multi_step" | "native_modal" | "auto";
    /**
     * 시각형 노드 표시 모드. 기본 "auto". KeyboardHint 의 "text"(입력 힌트)와 ChannelMessage.body.kind 의
     * "text"(메시지 종류)와 뜻이 다르다. "photo" 로 보내는 이미지는 body.kind "image" 메시지가 된다.
     * 1차 범위에서는 photo 를 골라도 텍스트로 대신 보내고 warning 로그를 남긴다.
     * DB 의 옛 "text_only" 는 채널 어댑터가 읽을 때 "text" 로 바꾼다(마이그레이션 전 과도기).
     */
    visualNode?: "text" | "photo" | "auto";
    buttonLayout?: "auto" | "vertical" | "horizontal";
  };
  rateLimitPerMinute?: number;
  /**
   * languageHints 가 비어 있는 키의 기본 문구 locale. 기본 "ko".
   * 찾는 순서: (1) languageHints[key] → (2) 이 locale 의 기본 문구 → (3) "ko".
   * 이 조회는 채널 어댑터 책임이다. classifyExecutionFailure 는 key 만 정한다.
   */
  languageLocale?: "ko" | "en";
  /**
   * 안내 문구 덮어쓰기. 키와 기본 문구는 채팅 채널 데이터와 흐름의 안내 문구 기본값이 정한다.
   * 메시지로 보내는 문구 말고 웹훅 HTTP 응답 본문에 싣는 문구도 있다
   * (defaultInteractionResponse 가 쓰는 Discord · Slack 슬래시 명령의 commandReceived·help).
   */
  languageHints?: Record<string, string>;
}
```

`inboundSigningRef` 의 프로바이더별 성격은 다음과 같다. 동작 기준은 각 프로바이더 문서의 보안 절이다.

| 프로바이더 | 자원 성격 | 발급 주체 | 검증 알고리즘 |
|---|---|---|---|
| Telegram | shared secret(서버 발급) | 채널 어댑터 `setupChannel` 의 `randomBytes` | `X-Telegram-Bot-Api-Secret-Token` 헤더 동일성 |
| Slack | HMAC-SHA256 signing secret | Slack 앱 설치 때 발급, 사용자가 직접 입력 | `X-Slack-Signature` = HMAC-SHA256(secret, "v0:" + ts + ":" + body) |
| Discord | ed25519 application public key | Discord Developer Portal 발급, 사용자가 직접 입력 | `X-Signature-Ed25519` ed25519 검증(raw body + timestamp) |

1차 범위의 세 채널 프로바이더는 규약상 모두 서명 자료가 필수다. 저장된 `inboundSigningRef` 가 없는 행(옛 행 등)에서 서명 검증을 건너뛰는 지금 구현은 `CLE-T-AAGZRW` 가 정할 때까지의 임시 동작이다([미결 사항](CLE-CHAT-ADAPTER.md#미결-사항)). 그런 행이 생기는 길은 [채팅 채널 데이터와 흐름 §인바운드 서명 자료 참조가 없는 행](CLE-CHAT-DATA.md#인바운드-서명-자료-참조가-없는-행) 에 적었다.

`languageHints` 의 키 가운데 웹훅 HTTP 응답 본문에 싣는 문구(슬래시 명령의 `commandReceived` 와 `help`)는 `sendMessage` 로 보내지 않으므로 `escapeControlText` 를 거치지 않는다. Discord 는 이 문구를 그대로 싣는다. Slack 은 응답 `text` 가 mrkdwn 으로 렌더되므로 채널 어댑터가 `escapeControlText` 와 같은 규칙(`&` `<` `>`)으로 escape 해 싣는다. 기본값과 찾는 순서는 다른 키와 같다([채팅 채널 데이터와 흐름 「안내 문구 기본값」](CLE-CHAT-DATA.md#안내-문구-기본값)).

### SetupResult와 SendResult

```typescript
interface SetupResult {
  registeredAt: string;               // ISO8601
  externalHookUrl?: string;           // 채널 어댑터별 디버깅용(Telegram getWebhookInfo 결과)
  identity?: Record<string, unknown>; // botId, username 등(config.botIdentity 에 캐시)
  /** setupChannel 동안 확정한 config 갱신분(botIdentity 등). issuedInboundSigning 평문은 여기 넣지 않는다. */
  configUpdates?: Partial<ChatChannelConfig>;
  /**
   * setupChannel 직후 한 번만 드러나는 인바운드 서명 자료 평문. 서버 발급만 해당한다
   * (1차 범위에서는 Telegram 이 setWebhook.secret_token 을 randomBytes 로 만든다).
   * 호출자(ChatChannelBinderService.setupChatChannel, TriggersService 가 생성·수정 경로에서 부른다)가
   * 곧바로 SecretResolver.rotate(secret://triggers/{id}/inbound-signing, ...) 로 저장하고
   * 참조를 inboundSigningRef 에 넣는다. 평문이 config 로 흘러가지 않게 분리한다(시크릿 저장소 규칙 14).
   * Slack·Discord 처럼 사용자가 직접 입력하는(프로바이더 발급) 경우는 채우지 않는다.
   */
  issuedInboundSigning?: string;
}

interface SendResult {
  externalMsgId: string;              // 프로바이더가 붙인 메시지 id(Telegram message_id)
  sentAt: string;                     // ISO8601
}
```

## Rationale

### R3 EiaEvent 를 별도 타입으로 정의하지 않고 EIA 에 맡긴다

EIA 페이로드가 기준이다. 이 규약의 `EiaEvent` 는 union 모양을 정하고 필드는 EIA 를 TypeScript 로 옮겨 적은 사본이다. 어긋나면 EIA 가 맞다. 새 타입을 따로 정의하지 않는 것은 두 문서 사이의 타입 어긋남을 피하려는 것이다. 필드를 바꿀 때는 늘 EIA 가 먼저다.
