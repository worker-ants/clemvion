import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  credentialRejectedError,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import type { TelegramApiResponse } from './telegram-client';
import { TelegramClient } from './telegram-client';
import { parseTelegramUpdate } from './telegram-update.parser';
import {
  renderTelegramMessages,
  escapeMarkdownV2,
} from './telegram-message.renderer';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';

/**
 * Telegram Chat Channel Adapter.
 *
 * Spec [providers/telegram.md]:
 *   - setupChannel: setWebhook + getMe
 *   - teardownChannel: deleteWebhook (best-effort)
 *   - parseUpdate: Telegram Update → ChannelUpdate (pure, side-effect free)
 *   - renderNode: EiaEvent → ChannelMessage[] (pure, side-effect free)
 *   - sendMessage: sendMessage / sendPhoto / sendChatAction (HTTP)
 *   - ackInteraction: answerCallbackQuery (button_callback 만 의무)
 *
 * Phase 1: parseUpdate + setupChannel + teardownChannel + AI Multi Turn 텍스트 sendMessage.
 * Phase 2: AI Multi Turn 전체 flow + e2e.
 * Phase 3: Button Presentation.
 * Phase 4: Form.
 * Phase 5: Chart sendPhoto.
 */
/**
 * Telegram 이 **자격 증명 거부**로 쓰는 `error_code` 값 — Bot API 는 HTTP status 를 응답
 * **body 의 `error_code`** 에 그대로 싣는다(`{"ok":false,"error_code":401,…}`). client 가 4xx
 * body 를 그대로 반환하므로 어댑터에서 status 를 볼 수 있다.
 *
 * `error_code` 는 **Telegram 원본 응답 필드**이고 우리 `Error.code` 판별자와 다른 이름이다
 * ([spec/conventions/chat-channel-adapter.md §1.1.2] 의 네임스페이스 표).
 */
const TELEGRAM_CREDENTIAL_REJECTED_STATUSES: readonly number[] = [401, 403];

/**
 * Bot API 실패 응답 → throw 할 `Error`. 자격 증명 거부면 `code` 를 부착한다 (§1.1.2).
 *
 * message 형식은 **바꾸지 않는다** — 호출자의 한시적 401/403 fallback 과 기존 테스트가 그
 * 문구를 본다. `error_code` 가 없는 경우(body 파싱 실패·재시도 소진 합성 응답)는 generic 이라
 * 호출자가 502 로 다룬다.
 */
function telegramApiError(
  method: string,
  res: TelegramApiResponse<unknown>,
): Error {
  const message = `Telegram ${method} failed: ${res.description ?? 'unknown'}`;
  return res.error_code !== undefined &&
    TELEGRAM_CREDENTIAL_REJECTED_STATUSES.includes(res.error_code)
    ? credentialRejectedError(message)
    : new Error(message);
}

/**
 * 답한 `callback_query_id` 를 기억하는 시간(ms). 이 시간 안에 같은 클릭이 다시 오면(재전송 · 중복 · 처리한
 * 클릭의 재도착) `answerCallbackQuery` 를 다시 부르지 않는다. 재도착 억제 창(30초)보다 길게 잡는다.
 */
export const TELEGRAM_ANSWERED_CALLBACK_TTL_MS = 60_000;

/** 기억하는 `callback_query_id` 수의 상한. 넘치면 가장 오래 기억한 것부터 잊는다. */
export const TELEGRAM_ANSWERED_CALLBACK_MAX = 10_000;

/**
 * 답한 `callback_query_id` 를 파드 메모리에 잠시 기억한다. 같은 클릭에 두 번 답하지 않게 해서
 * `answerCallbackQuery` 호출과 봇 토큰 조회를 클릭 하나에 한 번으로 묶는다(NERV Task `CLE-T-0JEQRY`).
 * 파드마다 따로 기억하므로 여러 파드에 나뉘어 온 재전송에는 파드 수만큼까지 답할 수 있다.
 */
class AnsweredCallbackIds {
  private readonly expiresAt = new Map<string, number>();

  /** 처음 보는 id 면 기억하고 `true`, 이미 기억하는 id 면 `false` 를 돌려준다. */
  remember(id: string): boolean {
    const now = Date.now();
    this.evictExpired(now);
    if (this.expiresAt.has(id)) return false;
    this.expiresAt.set(id, now + TELEGRAM_ANSWERED_CALLBACK_TTL_MS);
    if (this.expiresAt.size > TELEGRAM_ANSWERED_CALLBACK_MAX) {
      // Map 은 넣은 순서를 지키므로 첫 키가 가장 오래된 id 다.
      const [oldest] = this.expiresAt.keys();
      this.expiresAt.delete(oldest);
    }
    return true;
  }

  forget(id: string): void {
    this.expiresAt.delete(id);
  }

  /** 기억 시간이 모두 같아 넣은 순서가 곧 만료 순서다. 앞에서부터 만료된 것만 지운다. */
  private evictExpired(now: number): void {
    for (const [id, expiresAt] of this.expiresAt) {
      if (expiresAt > now) break;
      this.expiresAt.delete(id);
    }
  }
}

@Injectable()
export class TelegramAdapter implements ChatChannelAdapter {
  readonly provider = 'telegram';
  /** Telegram 은 native form modal 미지원 (Mini App 격상은 별도 작업) — 항상 §4.2 다단계. */
  readonly supportsNativeForm = false;
  private readonly logger = new Logger(TelegramAdapter.name);
  private readonly answeredCallbacks = new AnsweredCallbackIds();

  constructor(
    private readonly client: TelegramClient,
    private readonly secrets: SecretResolverService,
  ) {}

  /**
   * secret store 에서 bot token 를 resolve 한다.
   *
   * @param config ChatChannelConfig — `botTokenRef` 필드를 사용.
   * @returns plaintext bot token.
   * @throws NotFoundException `botTokenRef` 가 없거나 secret store 에 row 미존재 시.
   * @throws Error('Secret decryption failed') 복호화 실패 시.
   */
  private async resolveBotToken(config: ChatChannelConfig): Promise<string> {
    if (!config.botTokenRef) {
      throw new NotFoundException(
        'TelegramAdapter: botTokenRef 미설정 — setupChannel 이전 상태.',
      );
    }
    return this.secrets.resolve(config.botTokenRef);
  }

  async setupChannel(
    config: ChatChannelConfig,
    callbackUrl: string,
  ): Promise<SetupResult> {
    const botToken = await this.resolveBotToken(config);
    // 매 setupChannel 마다 새 inbound-signing 자료 발급 (Telegram = server-issued shared secret) — 재사용하지 않는다.
    const issuedInboundSigning = randomBytes(24).toString('base64url');
    const setup = await this.client.setWebhook(botToken, {
      url: callbackUrl,
      // Telegram API 의 `secret_token` 파라미터에 우리 inbound-signing 자료를 전달.
      // 파라미터 이름 (`secret_token`) 은 Telegram Bot API 의 외부 contract.
      secret_token: issuedInboundSigning,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    if (!setup.ok) {
      throw telegramApiError('setWebhook', setup);
    }
    const me = await this.client.getMe(botToken);
    if (!me.ok || !me.result) {
      throw telegramApiError('getMe', me);
    }
    return {
      registeredAt: new Date().toISOString(),
      identity: { botId: me.result.id, username: me.result.username },
      issuedInboundSigning,
      configUpdates: {
        botIdentity: { botId: me.result.id, username: me.result.username },
      },
    };
  }

  async teardownChannel(config: ChatChannelConfig): Promise<void> {
    // best-effort — 실패해도 트리거 삭제는 진행한다. 트리거를 끌 때는 부르지 않는다
    // ([채팅 채널 「어댑터 라이프사이클」](CLE-CHAT-CORE#어댑터-라이프사이클) REQ-CHAT-005).
    let botToken: string;
    try {
      botToken = await this.resolveBotToken(config);
    } catch {
      this.logger.warn(
        `TelegramAdapter.teardownChannel: botToken resolve 실패 — deleteWebhook skip (best-effort).`,
      );
      return;
    }
    const res = await this.client.deleteWebhook(botToken, {
      drop_pending_updates: true,
    });
    if (!res.ok) {
      this.logger.warn(
        `Telegram deleteWebhook failed (best-effort): ${res.description ?? 'unknown'}`,
      );
    }
  }

  parseUpdate(
    raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    return Promise.resolve(parseTelegramUpdate(raw));
  }

  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return Promise.resolve(renderTelegramMessages(event, config));
  }

  async sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult> {
    const chatId = message.conversationKey;
    const botToken = await this.resolveBotToken(config);
    switch (message.body.kind) {
      case 'text': {
        const res = await this.client.sendMessage(botToken, {
          chat_id: chatId,
          text: message.body.text,
          parse_mode: 'MarkdownV2',
        });
        if (!res.ok || !res.result) {
          throw new Error(
            `Telegram sendMessage failed: ${res.description ?? 'unknown'}`,
          );
        }
        return {
          externalMsgId: String(res.result.message_id),
          sentAt: new Date(res.result.date * 1000).toISOString(),
        };
      }
      case 'typing': {
        const res = await this.client.sendChatAction(botToken, {
          chat_id: chatId,
          action: 'typing',
        });
        if (!res.ok) {
          throw new Error(
            `Telegram sendChatAction failed: ${res.description ?? 'unknown'}`,
          );
        }
        return {
          externalMsgId: 'typing',
          sentAt: new Date().toISOString(),
        };
      }
      case 'buttons': {
        const layout = config.uiMapping?.buttonLayout ?? 'auto';
        const inlineKeyboard = buildInlineKeyboard(
          message.body.buttons,
          layout,
        );
        const res = await this.client.sendMessage(botToken, {
          chat_id: chatId,
          text: message.body.text,
          parse_mode: 'MarkdownV2',
          reply_markup: { inline_keyboard: inlineKeyboard },
        });
        if (!res.ok || !res.result) {
          throw new Error(
            `Telegram sendMessage(buttons) failed: ${res.description ?? 'unknown'}`,
          );
        }
        return {
          externalMsgId: String(res.result.message_id),
          sentAt: new Date(res.result.date * 1000).toISOString(),
        };
      }
      case 'form_prompt': {
        // Phase 4/PR-C: prompt + keyboard hint 별 reply_markup.
        const replyMarkup = buildFormReplyMarkup(message.body.hint);
        const res = await this.client.sendMessage(botToken, {
          chat_id: chatId,
          text: escapeMarkdownV2(message.body.label),
          parse_mode: 'MarkdownV2',
          ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
        });
        if (!res.ok || !res.result) {
          throw new Error(
            `Telegram sendMessage(form_prompt) failed: ${res.description ?? 'unknown'}`,
          );
        }
        return {
          externalMsgId: String(res.result.message_id),
          sentAt: new Date(res.result.date * 1000).toISOString(),
        };
      }
      case 'image': {
        // Phase 5/PR-D: sendPhoto. Bot API 는 multipart 또는 file_id/URL 모두 지원.
        // v1 은 buffer → multipart upload 경로 — telegram-client.ts 의 sendPhoto 가 photo 를 받음.
        // Note: Bot API multipart 의 정확한 multipart-form-data 구성은 별도 헬퍼 필요. 본 commit 의
        // 단순 구현은 photo 를 base64 data URL 로 보내거나 (Bot API 미지원) URL 로 호스팅 후 보내는
        // 두 옵션 중 후자. v1 stub: bytes 가 있으면 일단 caption + fallbackText 의 text 메시지로 fallback,
        // 실 buffer multipart 는 PR-D 의 별도 SSR/storage 인프라와 함께.
        const fallback = message.body.caption ?? message.body.fallbackText;
        const res = await this.client.sendMessage(botToken, {
          chat_id: chatId,
          text: escapeMarkdownV2(fallback),
          parse_mode: 'MarkdownV2',
        });
        if (!res.ok || !res.result) {
          throw new Error(
            `Telegram sendMessage(image fallback) failed: ${res.description ?? 'unknown'}`,
          );
        }
        return {
          externalMsgId: String(res.result.message_id),
          sentAt: new Date(res.result.date * 1000).toISOString(),
        };
      }
      case 'form_modal':
        // Telegram 은 supportsNativeForm=false — renderer 가 form_modal 을 내지 않으므로 도달 불가.
        // exhaustiveness 가드 (Convention §4.1: native modal 미지원 provider 는 §4.2 다단계).
        throw new Error(
          'Telegram 은 native form modal 미지원 (supportsNativeForm=false)',
        );
    }
  }

  async ackInteraction(
    update: ChannelUpdate,
    config: ChatChannelConfig,
  ): Promise<void> {
    // PR-B — button_callback 도착 시 answerCallbackQuery (텔레그램 의무 — 안 하면 모바일 로딩 indicator 지속).
    // 이미 답한 클릭이면 다시 답하지 않는다.
    if (update.command.kind !== 'button_callback') return;
    const answeredWith = await this.answerCallbackOnce(
      update.command.callbackQueryId,
      config,
    );
    // §5.2(3) — ack 후 원본 메시지의 inline_keyboard 제거(중복 클릭 차단). best-effort:
    // 메시지가 오래됐거나(48h) 이미 편집됐으면 실패할 수 있으나, 이는 ack 흐름을 막지 않는다.
    const messageId = update.command.messageId;
    if (messageId !== undefined) {
      const numericId = Number(messageId);
      // Telegram message_id 는 양의 정수. NaN/음수/0 은 무효 → editMessage skip.
      if (Number.isInteger(numericId) && numericId > 0) {
        const botToken = answeredWith ?? (await this.resolveBotToken(config));
        try {
          await this.client.editMessageReplyMarkup(botToken, {
            chat_id: update.conversationKey,
            message_id: numericId,
            reply_markup: { inline_keyboard: [] },
          });
        } catch (err) {
          this.logger.warn(
            `Telegram editMessageReplyMarkup 실패(무시): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
        }
      }
    }
  }

  /**
   * 버린 update 의 버튼 클릭에 answerCallbackQuery 만 보낸다(Spec CLE-CHAT-TELEGRAM REQ-TGRAM-011).
   * 중복 · 대화 단위 분당 한도 초과 · 실행 중 · 워크플로우 비활성처럼 처리하지 않은 클릭도 클라이언트의
   * 진행 표시를 지워야 한다. 키보드는 남긴다. 잠시 뒤 다시 누를 수 있어야 해서다(2026-11-12 사람 결정,
   * NERV 질문 `01a1d025-92b9-7782-8c6e-09705b4a117f`). `callback_query` 가 아닌 update 는 아무것도
   * 하지 않는다. 같은 클릭에는 한 번만 답한다(재전송 · 중복으로 버려진 클릭, 처리하며 이미 답한 클릭).
   * 실패는 호출자(HooksService)가 로그만 남긴다.
   */
  async ackDroppedUpdate(
    raw: unknown,
    config: ChatChannelConfig,
  ): Promise<void> {
    const callbackQueryId = readCallbackQueryId(raw);
    if (callbackQueryId === undefined) return;
    await this.answerCallbackOnce(callbackQueryId, config);
  }

  /**
   * 아직 답하지 않은 클릭이면 `answerCallbackQuery` 를 보낸다. 이미 답한 클릭이면 봇 토큰도 조회하지 않는다.
   * 봇 토큰 조회나 호출이 던지면 기억을 지운다. 같은 클릭이 다시 오면 다시 답을 시도한다.
   *
   * 봇 토큰은 캐시하지 않는다. 평문 토큰을 메모리에 두면 토큰 교체 · 폐기 뒤에도 옛 토큰을 쓰고, 같은 클릭의
   * 반복 조회는 이 메서드가 이미 없앤다(NERV Task `CLE-T-0JEQRY` 1번 결정).
   *
   * @returns 답을 보냈으면 그때 조회한 봇 토큰, 이미 답한 클릭이면 `undefined`.
   */
  private async answerCallbackOnce(
    callbackQueryId: string,
    config: ChatChannelConfig,
  ): Promise<string | undefined> {
    if (!this.answeredCallbacks.remember(callbackQueryId)) return undefined;
    try {
      const botToken = await this.resolveBotToken(config);
      await this.client.answerCallbackQuery(botToken, {
        callback_query_id: callbackQueryId,
      });
      return botToken;
    } catch (err) {
      this.answeredCallbacks.forget(callbackQueryId);
      throw err;
    }
  }

  /**
   * control-plane 안내 escape — telegram 은 `parse_mode: MarkdownV2` 로 발송하므로
   * MarkdownV2 예약문자를 backslash escape 한다 (renderNode 경로와 동일 규칙, escapeMarkdownV2).
   */
  escapeControlText(text: string): string {
    return escapeMarkdownV2(text);
  }
}

/** raw update 의 `callback_query.id`. 비었거나 문자열이 아니면 `undefined` 다. */
function readCallbackQueryId(raw: unknown): string | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const callbackQuery = (raw as { callback_query?: unknown }).callback_query;
  if (!callbackQuery || typeof callbackQuery !== 'object') return undefined;
  const id = (callbackQuery as { id?: unknown }).id;
  return typeof id === 'string' && id.length > 0 ? id : undefined;
}

/**
 * Spec [providers/telegram §5.2] — inline_keyboard 2D 배열 빌더.
 *
 * auto : 라벨 length 합 24자 이하인 버튼을 같은 row.
 * vertical : 1열 N행.
 * horizontal : 1행 N열 (최대 8개, 초과는 wrap).
 */
function buildInlineKeyboard(
  buttons: import('../../types').ChannelButton[],
  layout: 'auto' | 'vertical' | 'horizontal',
): Array<
  Array<{
    text: string;
    callback_data?: string;
    url?: string;
  }>
> {
  if (buttons.length === 0) return [];
  const decorate = (label: string, style?: string): string => {
    if (style === 'primary') return `✅ ${label}`;
    if (style === 'danger') return `⚠️ ${label}`;
    return label;
  };
  const toCell = (b: import('../../types').ChannelButton) => {
    const text = decorate(b.label, b.style);
    if (b.type === 'link' && b.url) return { text, url: b.url };
    return { text, callback_data: b.id };
  };
  switch (layout) {
    case 'vertical':
      return buttons.map((b) => [toCell(b)]);
    case 'horizontal': {
      const rows: Array<Array<ReturnType<typeof toCell>>> = [];
      const ROW_MAX = 8;
      for (let i = 0; i < buttons.length; i += ROW_MAX) {
        rows.push(buttons.slice(i, i + ROW_MAX).map(toCell));
      }
      return rows;
    }
    case 'auto':
    default: {
      const rows: Array<Array<ReturnType<typeof toCell>>> = [];
      let currentRow: Array<ReturnType<typeof toCell>> = [];
      let currentRowLen = 0;
      const ROW_LEN_LIMIT = 24;
      for (const b of buttons) {
        const cell = toCell(b);
        const addedLen = cell.text.length;
        if (currentRow.length > 0 && currentRowLen + addedLen > ROW_LEN_LIMIT) {
          rows.push(currentRow);
          currentRow = [];
          currentRowLen = 0;
        }
        currentRow.push(cell);
        currentRowLen += addedLen;
      }
      if (currentRow.length > 0) rows.push(currentRow);
      return rows;
    }
  }
}

/** Form keyboard hint 별 reply_markup. */
function buildFormReplyMarkup(
  hint: import('../../types').KeyboardHint | undefined,
): Record<string, unknown> | null {
  switch (hint) {
    case 'number':
      return {
        keyboard: [
          ['1', '2', '3'],
          ['4', '5', '6'],
          ['7', '8', '9'],
          ['.', '0'],
        ],
        one_time_keyboard: true,
        resize_keyboard: true,
      };
    case 'share_contact':
      return {
        keyboard: [[{ text: '📱 연락처 공유', request_contact: true }]],
        one_time_keyboard: true,
        resize_keyboard: true,
      };
    case 'file_upload':
      return {
        force_reply: true,
        input_field_placeholder: '파일을 업로드해주세요',
      };
    case 'date':
      return {
        force_reply: true,
        input_field_placeholder: 'YYYY-MM-DD',
      };
    case 'email':
    case 'phone':
    case 'text':
    case undefined:
    default:
      return null;
  }
}
