import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import { TelegramClient } from './telegram-client';
import { parseTelegramUpdate } from './telegram-update.parser';
import { renderTelegramMessages } from './telegram-message.renderer';
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
@Injectable()
export class TelegramAdapter implements ChatChannelAdapter {
  readonly provider = 'telegram';
  private readonly logger = new Logger(TelegramAdapter.name);

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
      throw new Error(
        `Telegram setWebhook failed: ${setup.description ?? 'unknown'}`,
      );
    }
    const me = await this.client.getMe(botToken);
    if (!me.ok || !me.result) {
      throw new Error(`Telegram getMe failed: ${me.description ?? 'unknown'}`);
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
    // best-effort — 실패해도 trigger 비활성화는 진행한다.
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
          text: escapePromptText(message.body.label),
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
          text: escapePromptText(fallback),
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
    }
  }

  async ackInteraction(
    update: ChannelUpdate,
    config: ChatChannelConfig,
  ): Promise<void> {
    // PR-B — button_callback 도착 시 answerCallbackQuery (텔레그램 의무 — 안 하면 모바일 로딩 indicator 지속).
    if (update.command.kind !== 'button_callback') return;
    const botToken = await this.resolveBotToken(config);
    await this.client.answerCallbackQuery(botToken, {
      callback_query_id: update.command.callbackQueryId,
    });
  }
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

/**
 * form_prompt 의 label 은 renderer 가 escape 하지 않은 그대로 전달 (renderer 본문은 raw, sendMessage
 * 단계에서 MarkdownV2 escape). text body 와 다른 흐름 — text 는 renderer 가 사전 escape 함.
 */
function escapePromptText(text: string): string {
  // text-renderer 와 같은 escape 적용.
  return text.replace(/([_*[\]()~`>#+\-=|{}.!])/g, '\\$1');
}
