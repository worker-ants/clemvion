/**
 * Chat Channel 어댑터의 공통 타입.
 *
 * SoT:
 *   - [spec/conventions/chat-channel-adapter.md] — 6함수 인터페이스 + 데이터 타입 union
 *   - [spec/5-system/15-chat-channel.md] — 시스템 동작·lifecycle·EIA 관계
 *   - [spec/4-nodes/7-trigger/providers/telegram.md] — 텔레그램 구체 명세
 */

import type { PresentationPayload } from '../../shared/conversation-thread/conversation-thread.types';

/**
 * Trigger.config.chatChannel 의 in-memory representation.
 *
 * Breaking change (SUMMARY#26): `botToken`(plaintext) → `botTokenRef`,
 * `secretToken` → `secretTokenRef` (2026-05-22).
 * Breaking change (spec-chat-channel-inbound-signing-rename, 2026-05-24):
 *   `secretTokenRef` → `inboundSigningRef`. Slack/Discord provider 와 단일 슬롯 공유 —
 *   자원 성격·검증 알고리즘은 backend 의 provider 분기 책임.
 * 미배포 전제 — DB 에 기존 plaintext row 없음. read-path fallback 없음
 * (레거시 row 는 webhook 수신 시 botTokenRef=undefined → skip).
 */
export interface ChatChannelConfig {
  /** 어댑터 식별자 (lower-case kebab-case). v1: 'telegram'. spec-only: 'slack' / 'discord'. */
  provider: string;

  /**
   * Secret store reference — `secret://triggers/{id}/bot-token`.
   * setupChannel 이전(최초 생성 시)에는 undefined. rotate-bot-token 엔드포인트가 채운다.
   *
   * @see spec/conventions/secret-store.md §1
   */
  botTokenRef?: string;

  /**
   * Inbound webhook 출처 검증용 자료의 secret store reference.
   * `secret://triggers/{id}/inbound-signing`. provider 무관 단일 슬롯 — 검증 알고리즘은 backend 의
   * provider 분기 책임:
   *   - Telegram: shared secret (server-issued). setupChannel 의 issuedInboundSigning 이 저장되면 채워진다.
   *     `X-Telegram-Bot-Api-Secret-Token` 헤더 동일성 검증.
   *   - Slack: HMAC-SHA256 signing secret (provider-issued, 사용자 입력). `X-Slack-Signature` HMAC 검증.
   *   - Discord: ed25519 application public key (provider-issued, 사용자 입력). `X-Signature-Ed25519` verify.
   * 미설정 시 webhook 인증 skip (legacy / setupChannel 전 trigger).
   *
   * @see spec/conventions/chat-channel-adapter.md §2.3
   * @see spec/conventions/secret-store.md §1
   */
  inboundSigningRef?: string;

  /**
   * setupChannel 결과 캐시 (read-only after creation).
   * `teamId` 는 workspace/team 개념을 가진 provider (Slack workspace, Discord guild) 만 채움.
   * Telegram 등 단일 namespace provider 는 비움.
   */
  botIdentity?: { botId: number; username: string; teamId?: string };

  uiMapping?: {
    /**
     * Form 입력 표면 선택. default "auto".
     * - "auto": supportsNativeForm provider + 전 필드 modal 수용 타입 + fields ≤ 5 → native modal, 아니면 다단계.
     * - "native_modal": modal 우선 (위 조건 미충족 시 다단계 fallback).
     * - "multi_step": 항상 다단계 (modal 지원 provider 에서도 강제 — opt-out).
     * SoT: spec/conventions/chat-channel-adapter.md §2.3 / §4.1 / R-CCA-8.
     */
    formMode?: 'multi_step' | 'native_modal' | 'auto';
    visualNode?: 'photo' | 'text_only';
    buttonLayout?: 'auto' | 'vertical' | 'horizontal';
  };

  /** CCH-NF-03 override. default 60. */
  rateLimitPerMinute?: number;

  /**
   * `languageHints` 미설정 키의 default 문구 locale 선택. default "ko".
   * 어댑터의 lookup 순서: (1) `languageHints[key]` override → (2) 본 locale 의 default
   * 문구 → (3) 'ko' fallback.
   *
   * @see spec/5-system/15-chat-channel.md §4.1 / §4.1.1 (KO/EN default 12 문구 표)
   * @see spec/conventions/chat-channel-adapter.md §2.3
   */
  languageLocale?: 'ko' | 'en';

  /**
   * 봇이 보내는 자체 안내 메시지 i18n.
   *
   * **Breaking change (2026-05-25)**: 이전 단일 키 `executionFailed` (+ `{{code}}` / `{{message}}`
   * placeholder) 는 더 이상 사용되지 않습니다. 기존 DB 의 `executionFailed` 키는 silently ignored
   * 되며, 아래 6 키로 마이그레이션하세요.
   *
   * CCH-ERR-* 6 키 (spec/5-system/15-chat-channel.md §4.1.1):
   *   - `executionFailedThirdParty4xx` — HTTP 4xx 오류 (placeholder: `{statusCode}`)
   *   - `executionFailedThirdParty5xx` — HTTP 5xx 오류 (placeholder: `{statusCode}`)
   *   - `executionFailedThirdParty`    — 기타 외부 서비스 오류
   *   - `executionFailedTimeout`       — 처리 시간 초과
   *   - `executionFailedRateLimit`     — Rate limit 초과
   *   - `executionFailedInternal`      — 내부 서비스 오류 (fallback)
   *
   * 기타 안내 키 (CCH-ERR-* 외):
   *   - `formOpenLabel`  — native modal `form_modal` 버튼 라벨 (§4.1)
   *   - `sessionExpired` — §7.5 rehydration 실패(`RESUME_*`) 시 graceful 세션 만료 안내 (§4.1.1)
   *
   * @deprecated `executionFailed` 단일 키 + `{{code}}`/`{{message}}` placeholder 는 제거됨.
   *   6 키 체계로 마이그레이션 필요. runtime 에서 deprecation 경고 로그 발생.
   * @see spec/5-system/15-chat-channel.md §4.1 / §4.1.1
   */
  languageHints?: Record<string, string>;
}

/** Inbound — 외부 채널 update 를 워크플로우 input 으로 변환한 결과. */
export interface ChannelUpdate {
  /** 어댑터별 conversation 식별자 (텔레그램: chat_id 문자열). */
  conversationKey: string;
  /** 사용자 식별자 (텔레그램: user_id 문자열). */
  channelUserKey: string;
  command: ChannelCommand;
  /** Provider 가 update id 등에서 도출. 텔레그램: update_id. */
  idempotencyKey: string;
  /** ISO8601. */
  receivedAt: string;
}

export type ChannelCommand =
  | { kind: 'start' }
  | { kind: 'cancel' }
  | { kind: 'text_message'; text: string }
  | { kind: 'button_callback'; callbackData: string; callbackQueryId: string }
  | { kind: 'file_upload'; fileId: string; mimeType: string }
  | { kind: 'contact_share'; phone: string }
  /**
   * §4.1 native modal 게이팅 — "양식 작성하기" 버튼 클릭. 어댑터가 이 시점에만 가용한
   * trigger_id (Slack) / interaction token (Discord) 을 `openContext` 에 담아 반환.
   * HooksService 가 conversation state 의 pendingFormModal 필드로 modal 을 연다.
   * SoT: spec/conventions/chat-channel-adapter.md §4.1.
   */
  | { kind: 'open_form_modal'; openContext: Record<string, string> }
  /**
   * §4.1 native modal 일괄 제출 — Slack view_submission / Discord MODAL_SUBMIT.
   * `fields` = { [fieldName]: rawValue } (parseUpdate 가 pure normalize).
   * SoT: spec/conventions/chat-channel-adapter.md §2.1 / §4.1.
   */
  | { kind: 'form_submission'; fields: Record<string, string> };

/** Outbound — 워크플로우 이벤트를 외부 채널 메시지로 변환한 결과. */
export interface ChannelMessage {
  conversationKey: string;
  body: ChannelMessageBody;
  /** 옵션 — provider 별 reply / threading. */
  replyToExternalId?: string;
}

export type ChannelMessageBody =
  | { kind: 'text'; text: string; chunked?: boolean }
  | { kind: 'buttons'; text: string; buttons: ChannelButton[] }
  | {
      kind: 'form_prompt';
      fieldName: string;
      label: string;
      hint?: KeyboardHint;
    }
  /**
   * §4.1 native modal 경로 — "양식 작성하기" 버튼 메시지. server push 시점엔 trigger_id/
   * interaction token 이 없어 modal 을 즉시 못 열기 때문에, 버튼으로 사용자 클릭을 유도한 뒤
   * 그 시점에 modal 을 연다. `formConfig` = EIA waiting_for_input.context.formConfig 원본
   * (어댑터가 modal view 합성 시 fields shape 으로 읽음).
   * SoT: spec/conventions/chat-channel-adapter.md §2.2 / §4.1.
   */
  | { kind: 'form_modal'; openLabel: string; formConfig: unknown }
  | { kind: 'image'; bytes: Buffer; caption?: string; fallbackText: string }
  | { kind: 'typing' };

export interface ChannelButton {
  /** EIA click_button 의 buttonId. */
  id: string;
  label: string;
  type: 'callback' | 'link';
  /** type=link 일 때만. */
  url?: string;
  /** 옵션 — primary/danger/none 시각. */
  style?: 'primary' | 'danger' | 'none';
}

export type KeyboardHint =
  | 'text'
  | 'number'
  | 'email'
  | 'phone'
  | 'date'
  | 'file_upload'
  | 'share_contact';

/**
 * §4.1 native modal 이 필요로 하는 form 필드 정의 (formConfig.fields[] 의 정규화 shape).
 * Form spec §1 config 의 부분집합 — modal view 합성 + modal 수용 타입 판정에 필요한 필드만.
 * SoT: spec/4-nodes/6-presentation/4-form.md §1 / spec/conventions/chat-channel-adapter.md §2.2.
 */
export interface FormModalField {
  name: string;
  label: string;
  type: string;
  required?: boolean;
  description?: string;
  /** select / radio 의 선택지. */
  options?: Array<{ label: string; value: string }>;
}

/**
 * §4.1 native modal open 파라미터 — HooksService 가 `open_form_modal` command 처리 시
 * conversation state 의 pendingFormModal 필드 + parseUpdate 의 openContext 로 합성.
 */
export interface OpenFormModalParams {
  config: ChatChannelConfig;
  /** parseUpdate 가 추출한 provider 별 토큰 (Slack: { triggerId } / Discord: { interactionId, interactionToken }). */
  openContext: Record<string, string>;
  fields: FormModalField[];
  conversationKey: string;
  nodeId: string;
}

/**
 * §4.1 native modal open 결과 — provider 비대칭 흡수.
 * - Slack: `views.open` API 호출 후 `httpResponse` undefined (webhook 응답은 일반 ack).
 * - Discord: modal 을 webhook HTTP 응답 body (`{ type: 9, data }`) 로 열어야 하므로 본 필드로 반환
 *   → HooksController 가 res.json 으로 직접 전송.
 */
export interface OpenFormModalResult {
  httpResponse?: unknown;
}

/**
 * §4.1 native modal 제출 처리 결과 — provider 비대칭 HTTP 응답.
 * - Slack view_submission: 성공 시 빈 200, 검증 실패 시 `{ response_action: 'errors', errors }`.
 * - Discord MODAL_SUBMIT: ack (type 4/5) 또는 검증 실패 시 후속 안내.
 */
export interface FormSubmissionResult {
  /** provider 가 webhook 응답 body 로 돌려줄 JSON (Slack response_action / Discord ack). undefined 면 일반 ack. */
  httpResponse?: unknown;
}

/**
 * EiaEvent — NotificationDispatcher 의 in-process subscriber 가 받는 5종 union.
 * 실제 SoT 는 [spec/5-system/14-external-interaction-api.md §6] 의 payload shape — 본 타입은
 * 어댑터가 분기하기 위한 형식 union 만 정의. payload 내부는 unknown 으로 두고 어댑터가 spec
 * 본문을 참조해 narrowing.
 */
export type EiaEvent =
  | EiaWaitingForInputEvent
  | EiaAiMessageEvent
  | EiaCompletedEvent
  | EiaFailedEvent
  | EiaCancelledEvent;

/**
 * Routing context fields shared by ALL chat-channel events (EIA outbound 5종 +
 * chat-channel-internal). Dispatcher fan-out · per-trigger registry · seq
 * ordering · timestamp display 가 본 fields 에 의존.
 *
 * 본 base 는 EIA event 와 internal event 가 공유하는 routing layer 의 SoT.
 * EIA-specific identity 는 `EiaEventBase` (본 base 의 alias) 가 표현하고,
 * internal-specific identity 는 `ChatChannelInternalEventBase` (역시 alias) 가
 * 표현해 타입 경계 분리 — 두 도메인의 의미 차이를 명시 (W12 fix, 2026-05-25).
 */
export interface ChatChannelEventBase {
  executionId: string;
  triggerId: string;
  workflowId: string;
  seq: number;
  timestamp: string;
}

/**
 * EIA outbound notification event base (§6). EIA SDK 가 외부 webhook payload 로
 * 받는 5종 이벤트 공통 필드. `ChatChannelEventBase` 의 alias — routing context
 * 가 동일하지만 의미는 "외부 표면" 한정 (외부 SDK consume).
 */
export type EiaEventBase = ChatChannelEventBase;

export interface EiaWaitingForInputEvent extends EiaEventBase {
  type: 'execution.waiting_for_input';
  node: {
    id: string;
    type: string;
    /**
     * SoT: [spec/conventions/interaction-type-registry.md §1 `WaitingInteractionType`](../../../../spec/conventions/interaction-type-registry.md#1-waitinginteractiontype).
     * 4종 — `ai_form_render` 는 ai-agent 의 render_form blocking 진입 (sub-state of ai_conversation).
     * chat channel 안에서는 `ai_conversation` 과 동일 경로로 처리 (renderer 의 switch fallthrough).
     */
    interactionType: 'form' | 'buttons' | 'ai_conversation' | 'ai_form_render';
  };
  interaction: Record<string, unknown>;
  context: {
    formConfig?: unknown;
    buttonConfig?: unknown;
    conversationConfig?: unknown;
    conversationThread?: unknown;
  };
}

export interface EiaAiMessageEvent extends EiaEventBase {
  type: 'execution.ai_message';
  message: string;
  turnCount: number;
  messages?: unknown[];
  metadata?: unknown;
  llmCalls?: unknown[];
  /**
   * AI Agent `render_*` 표현 도구 호출 turn 에서만 동봉.
   * SoT: [spec/conventions/chat-channel-adapter.md §1.2 line 89](../../../../spec/conventions/chat-channel-adapter.md#12-eiaevent-입력)
   *      / [spec/4-nodes/3-ai/1-ai-agent.md §7.10](../../../../spec/4-nodes/3-ai/1-ai-agent.md#710-presentation-payload-render_-운반)
   *      / [spec/5-system/14-external-interaction-api.md §6.5 line 536](../../../../spec/5-system/14-external-interaction-api.md#65-페이로드--executioncancelled--executionai_message).
   *
   * 4종 display-only (`carousel`/`table`/`chart`/`template`) 만 본 필드로 채널 발화 대상.
   * `render_form` (`type === 'form'`) 은 별 plan `chat-channel-form-native-modal` 추적.
   */
  presentations?: PresentationPayload[];
}

export interface EiaCompletedEvent extends EiaEventBase {
  type: 'execution.completed';
  result: { outputs?: unknown; finalNodeId?: string; finalPort?: string };
  durationMs?: number;
}

export interface EiaFailedEvent extends EiaEventBase {
  type: 'execution.failed';
  error: {
    code: string;
    message: string;
    nodeId?: string | null;
    details?: unknown;
  };
  durationMs?: number;
}

export interface EiaCancelledEvent extends EiaEventBase {
  type: 'execution.cancelled';
  result: { cancelledBy?: 'user' | 'system' | 'timeout' };
  /**
   * §7.5 rehydration 실패로 인한 system cancel 의 사유 코드. `RESUME_*`
   * (CHECKPOINT_MISSING / FAILED / INCOMPATIBLE_STATE) 면 어댑터가 generic
   * "취소" 대신 graceful "세션 만료 — 새 대화 시작" 안내를 렌더한다. 사용자
   * cancel 등 일반 취소에는 부재.
   */
  error?: { code: string; message?: string };
  durationMs?: number;
}

/**
 * Chat-channel-internal in-process event — EIA outbound 5종 화이트리스트 (§6.1)
 * 외 추가로 chat-channel adapter 가 구독하는 이벤트. 외부 SDK 미노출.
 *
 * SoT:
 *   - [spec/conventions/chat-channel-adapter.md §1.3](../../../../spec/conventions/chat-channel-adapter.md#13-chatchannelinternalevent-입력-2026-05-25-신설)
 *   - [spec/5-system/15-chat-channel.md §3.1 CCH-AD-07](../../../../spec/5-system/15-chat-channel.md#31-실행-엔진과의-연결)
 *   - [spec/conventions/chat-channel-adapter.md §R-CCA-7](../../../../spec/conventions/chat-channel-adapter.md#r-cca-7)
 *
 * 구독 소스: R8 의 in-process fan-out 채널 (`WebsocketService.executionEvents$` Subject)
 * — chat-channel `Dispatcher` 가 presentation 노드 한정 sub-filter 로 attach.
 *
 * 현재 단일 variant — `execution.node.completed` (presentation 노드 4종 비-blocking).
 * 추가 variant 가 필요해지면 본 union 에 행 추가.
 */
export type ChatChannelInternalEvent = EiaNodeCompletedEvent;

/**
 * 비-blocking presentation 노드 (`carousel`/`table`/`chart`/`template`) 완료 시
 * chat-channel-internal listener 가 픽업하는 이벤트.
 *
 * `node.type` 은 4종 display-only presentation 한정 — form 제외, AI Agent / LLM /
 * code 등 비-presentation 노드는 sub-filter 가 제외. blocking 진입 케이스
 * (`output.status === 'waiting_for_input'`) 도 사전 제외 — 그 흐름은
 * `execution.waiting_for_input` (interactionType=buttons) 행이 처리.
 */
export interface EiaNodeCompletedEvent extends ChatChannelEventBase {
  type: 'execution.node.completed';
  node: {
    id: string;
    type: 'carousel' | 'table' | 'chart' | 'template';
    label?: string;
  };
  /** NodeHandlerOutput.output — 예: Template `{rendered, ...}`, Carousel `{items, ...}`. */
  output: Record<string, unknown>;
  meta?: Record<string, unknown>;
}

export interface SetupResult {
  registeredAt: string;
  externalHookUrl?: string;
  identity?: Record<string, unknown>;
  /**
   * 어댑터가 setupChannel 동안 발급한 inbound-signing 자료의 일회성 plaintext (server-issued 한정).
   * caller 가 받아 secret store 에 저장 후 `inboundSigningRef` 를 config 에 기록.
   * null/undefined 이면 webhook 검증 자료 미발급 — Slack/Discord 처럼 provider-issued (사용자 입력)
   * 인 경우 본 필드는 항상 비어 있고, 사용자 입력 plaintext 가 직접 caller 의 secret store 로 들어간다.
   */
  issuedInboundSigning?: string;
  /** 어댑터가 setWebhook 결과로 갱신할 botIdentity 등 non-secret 필드. */
  configUpdates?: Partial<ChatChannelConfig>;
}

export interface SendResult {
  externalMsgId: string;
  sentAt: string;
}

/** Adapter interface — 모든 provider 어댑터 구현 의무. */
export interface ChatChannelAdapter {
  readonly provider: string;
  /**
   * provider 가 native form modal (Slack views.open / Discord MODAL) 을 지원하는지.
   * true 면 renderNode 의 form 분기가 modal-eligible form 에 대해 form_modal 메시지를 낸다.
   * false (Telegram) 는 항상 §4.2 다단계.
   * SoT: spec/conventions/chat-channel-adapter.md §1 / R-CCA-8.
   */
  readonly supportsNativeForm: boolean;
  setupChannel(
    config: ChatChannelConfig,
    callbackUrl: string,
  ): Promise<SetupResult>;
  teardownChannel(config: ChatChannelConfig): Promise<void>;
  parseUpdate(
    raw: unknown,
    config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null>;
  /**
   * EIA outbound 이벤트 + chat-channel-internal 이벤트 → 외부 채널 메시지 변환.
   * 입력 union: `EiaEvent` (EIA §6 5종) | `ChatChannelInternalEvent` (chat-channel-internal).
   * 어댑터 구현체는 `event.type` discriminated union 분기로 처리.
   * SoT: [spec/conventions/chat-channel-adapter.md §R-CCA-7](../../../../spec/conventions/chat-channel-adapter.md#r-cca-7).
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]>;
  sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult>;
  ackInteraction(
    update: ChannelUpdate,
    config: ChatChannelConfig,
  ): Promise<void>;

  /**
   * (옵션) Bot token rotation 시 *이전* token 을 외부 provider 측에서 revoke.
   * SoT: [spec/conventions/chat-channel-adapter.md §1] Adapter Interface 의 revokeBotToken?
   * 옵션 메서드. provider 가 revocation API 를 제공하면 구현 (Slack `auth.revoke`),
   * Telegram / Discord 처럼 없으면 미구현 (`undefined`). caller (`TriggersService.rotateBotToken`)
   * 는 본 메서드 존재 여부를 type-guard 로 확인 후 best-effort 호출.
   */
  revokeBotToken?(oldBotToken: string): Promise<void>;

  /**
   * (옵션, supportsNativeForm=true 어댑터 한정) §4.1 native modal open.
   * `open_form_modal` command 도착 시 HooksService 가 호출 — Slack 은 views.open API,
   * Discord 는 webhook HTTP 응답 body 로 modal 반환 (OpenFormModalResult.httpResponse).
   * SoT: spec/conventions/chat-channel-adapter.md §4.1.
   */
  openFormModal?(params: OpenFormModalParams): Promise<OpenFormModalResult>;

  /**
   * (옵션, supportsNativeForm=true 어댑터 한정) §4.1 native modal 제출의 provider HTTP 응답 합성.
   * EIA submit_form 호출은 HooksService 가 담당하고, 본 메서드는 provider 가 webhook 응답으로
   * 돌려줘야 하는 ack / 검증 실패 재표시 body 만 합성. validationError 가 있으면 재표시 body.
   * SoT: spec/conventions/chat-channel-adapter.md §4.1 step 5.
   */
  buildFormSubmissionResponse?(params: {
    config: ChatChannelConfig;
    validationError?: { field?: string; message: string };
  }): FormSubmissionResult;
}

/**
 * §4.1 native form modal 을 지원하는 어댑터 (Slack / Discord) 의 narrowed 인터페이스.
 * base `ChatChannelAdapter` 에서 옵션(`?`)인 `openFormModal` / `buildFormSubmissionResponse`
 * 를 필수로 좁히고, `supportsNativeForm` 을 `true` literal 로 고정. 호출 측은
 * `isNativeFormAdapter` type guard 로 narrowing 한 뒤 `?.` / `&&` 없이 직접 호출.
 * SoT: spec/conventions/chat-channel-adapter.md §4.1.
 */
export interface NativeFormAdapter extends ChatChannelAdapter {
  readonly supportsNativeForm: true;
  openFormModal(params: OpenFormModalParams): Promise<OpenFormModalResult>;
  buildFormSubmissionResponse(params: {
    config: ChatChannelConfig;
    validationError?: { field?: string; message: string };
  }): FormSubmissionResult;
}

/**
 * 런타임 type guard — 어댑터가 native form modal 경로를 지원하는지 (`supportsNativeForm===true`
 * + 두 옵션 메서드 모두 구현) 확인. true 면 `NativeFormAdapter` 로 narrowing.
 */
export function isNativeFormAdapter(
  adapter: ChatChannelAdapter,
): adapter is NativeFormAdapter {
  return (
    adapter.supportsNativeForm === true &&
    typeof adapter.openFormModal === 'function' &&
    typeof adapter.buildFormSubmissionResponse === 'function'
  );
}

/** Redis ChannelConversation 레코드 — Spec §4.3. */
export interface ChannelConversationState {
  /** 활성 execution. terminal 후 null. */
  executionId: string | null;
  /** Conversation thread id. v1 은 항상 'default'. */
  threadId: string;
  /** 채널 사용자 식별자 (텔레그램: user_id). */
  channelUserKey: string;
  /** ISO8601 — conversation 시작 시각. */
  startedAt: string;
  /** ISO8601 — 마지막 update 도착 시각. */
  lastUpdateAt: string;
  /**
   * Form 다단계 시퀀스 상태 (Phase 4 에서 사용 — Phase 1 에서는 미정의 유지).
   * `currentFieldIdx` 와 `partialFormData` 는 server-side validation 실패 시 복원에 사용.
   */
  formState?: {
    nodeId: string;
    currentFieldIdx: number;
    partialFormData: Record<string, unknown>;
  };
  /**
   * §4.1 native modal 진행 상태 — dispatcher 가 form_modal 메시지를 낼 때 저장.
   * 사용자가 "양식 작성하기" 버튼 클릭 (open_form_modal) 시 modal view 합성에, modal 제출
   * (form_submission) 시 submit_form 의 nodeId 에 사용. multi_step 경로는 본 필드 미사용 (formState 사용).
   * SoT: spec/conventions/chat-channel-adapter.md §4.1.
   */
  pendingFormModal?: {
    nodeId: string;
    fields: FormModalField[];
  };
}
