/**
 * Chat Channel 어댑터의 공통 타입.
 *
 * SoT:
 *   - [spec/conventions/chat-channel-adapter.md] — 6함수 인터페이스 + 데이터 타입 union
 *   - [spec/5-system/15-chat-channel.md] — 시스템 동작·lifecycle·EIA 관계
 *   - [spec/4-nodes/7-trigger/providers/telegram.md] — 텔레그램 구체 명세
 */

/**
 * Trigger.config.chatChannel 의 in-memory representation.
 *
 * Breaking change (SUMMARY#26): `botToken`(plaintext) → `botTokenRef`,
 * `secretToken` → `secretTokenRef`. 미배포 전제 — DB 에 기존 plaintext row 없음.
 * read-path fallback 없음 (레거시 row 는 webhook 수신 시 botTokenRef=undefined → skip).
 */
export interface ChatChannelConfig {
  /** 어댑터 식별자 (lower-case kebab-case). v1: 'telegram'. */
  provider: string;

  /**
   * Secret store reference — `secret://triggers/{id}/bot-token`.
   * setupChannel 이전(최초 생성 시)에는 undefined. rotate-bot-token 엔드포인트가 채운다.
   *
   * @see spec/conventions/secret-store.md §1
   */
  botTokenRef?: string;

  /**
   * Webhook 인증용 server-issued secret 의 secret store reference.
   * `secret://triggers/{id}/webhook-secret`. setupChannel 결과 issuedSecretToken 이
   * 저장되면 채워진다. 미설정 시 webhook 인증 skip.
   */
  secretTokenRef?: string;

  /** setupChannel 결과 캐시 (read-only after creation). */
  botIdentity?: { botId: number; username: string };

  uiMapping?: {
    formMode?: 'multi_step';
    visualNode?: 'photo' | 'text_only';
    buttonLayout?: 'auto' | 'vertical' | 'horizontal';
  };

  /** CCH-NF-03 override. default 60. */
  rateLimitPerMinute?: number;

  /** 봇이 보내는 자체 안내 메시지 i18n. */
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
  | { kind: 'contact_share'; phone: string };

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

export interface EiaEventBase {
  executionId: string;
  triggerId: string;
  workflowId: string;
  seq: number;
  timestamp: string;
}

export interface EiaWaitingForInputEvent extends EiaEventBase {
  type: 'execution.waiting_for_input';
  node: {
    id: string;
    type: string;
    interactionType: 'form' | 'buttons' | 'ai_conversation';
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
  durationMs?: number;
}

export interface SetupResult {
  registeredAt: string;
  externalHookUrl?: string;
  identity?: Record<string, unknown>;
  /**
   * 어댑터가 setupChannel 동안 발급한 webhook secret 의 일회성 plaintext.
   * caller 가 받아 secret store 에 저장 후 `secretTokenRef` 를 config 에 기록.
   * null/undefined 이면 webhook secret 미발급 (caller 가 rotate 미호출).
   */
  issuedSecretToken?: string;
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
  setupChannel(
    config: ChatChannelConfig,
    callbackUrl: string,
  ): Promise<SetupResult>;
  teardownChannel(config: ChatChannelConfig): Promise<void>;
  parseUpdate(
    raw: unknown,
    config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null>;
  renderNode(
    event: EiaEvent,
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
}
