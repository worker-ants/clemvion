import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import { TelegramClient } from './telegram-client';
import { parseTelegramUpdate } from './telegram-update.parser';
import { renderTelegramMessages } from './telegram-message.renderer';

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

  constructor(private readonly client: TelegramClient) {}

  async setupChannel(
    config: ChatChannelConfig,
    callbackUrl: string,
  ): Promise<SetupResult> {
    const secretToken =
      config.secretToken ?? randomBytes(24).toString('base64url');
    const setup = await this.client.setWebhook(config.botToken, {
      url: callbackUrl,
      secret_token: secretToken,
      allowed_updates: ['message', 'callback_query'],
      drop_pending_updates: true,
    });
    if (!setup.ok) {
      throw new Error(
        `Telegram setWebhook failed: ${setup.description ?? 'unknown'}`,
      );
    }
    const me = await this.client.getMe(config.botToken);
    if (!me.ok || !me.result) {
      throw new Error(
        `Telegram getMe failed: ${me.description ?? 'unknown'}`,
      );
    }
    return {
      registeredAt: new Date().toISOString(),
      identity: { botId: me.result.id, username: me.result.username },
      configUpdates: {
        secretToken,
        botIdentity: { botId: me.result.id, username: me.result.username },
      },
    };
  }

  async teardownChannel(config: ChatChannelConfig): Promise<void> {
    // best-effort — 실패해도 trigger 비활성화는 진행한다.
    const res = await this.client.deleteWebhook(config.botToken, {
      drop_pending_updates: true,
    });
    if (!res.ok) {
      this.logger.warn(
        `Telegram deleteWebhook failed (best-effort): ${res.description ?? 'unknown'}`,
      );
    }
  }

  async parseUpdate(
    raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    return parseTelegramUpdate(raw);
  }

  async renderNode(
    event: EiaEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return renderTelegramMessages(event, config);
  }

  async sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult> {
    const chatId = message.conversationKey;
    switch (message.body.kind) {
      case 'text': {
        const res = await this.client.sendMessage(config.botToken, {
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
        const res = await this.client.sendChatAction(config.botToken, {
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
      case 'buttons':
      case 'form_prompt':
      case 'image':
        // Phase 3 / 4 / 5 에서 구현. v1 PR-A 는 text + typing 만.
        throw new Error(
          `TelegramAdapter.sendMessage: body.kind=${message.body.kind} 는 후속 phase 에서 구현 (Phase 3/4/5)`,
        );
    }
  }

  async ackInteraction(
    update: ChannelUpdate,
    config: ChatChannelConfig,
  ): Promise<void> {
    // Phase 3 (PR-B) — button_callback 도착 시 answerCallbackQuery.
    if (update.command.kind !== 'button_callback') return;
    await this.client.answerCallbackQuery(config.botToken, {
      callback_query_id: update.command.callbackQueryId,
    });
  }
}
