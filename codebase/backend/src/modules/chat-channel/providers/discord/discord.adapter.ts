import { Injectable, Logger } from '@nestjs/common';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type {
  ChannelButton,
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import { DiscordClient } from './discord-client';
import { renderDiscordEvent } from './discord-message.renderer';
import { parseDiscordUpdate } from './discord-update.parser';

/**
 * Discord Chat Channel Adapter.
 *
 * Spec [providers/discord.md] — REST + Interactions Webhook 기반.
 *
 * Spec 의 핵심 결정:
 *   - Interactions Webhook only (R-D-3). Gateway 는 v2.
 *   - DM only (R-D-4). guild 채널 차단.
 *   - typing native (`POST /channels/{id}/typing`, 10초).
 *   - Form 다단계 (Convention §4 / R-D-6). modal 은 v2.
 *   - inboundSigningRef = ed25519 public key (R-D-1). provider-issued (사용자 입력).
 *     `SetupResult.issuedInboundSigning` 은 항상 비움.
 *   - R-CC-13: 자유 텍스트 DM 미수신 → reply 는 `/workflow reply` slash 또는 modal TEXT_INPUT.
 */
@Injectable()
export class DiscordAdapter implements ChatChannelAdapter {
  private readonly logger = new Logger(DiscordAdapter.name);
  readonly provider = 'discord';

  constructor(
    private readonly client: DiscordClient,
    private readonly secrets: SecretResolverService,
  ) {}

  private async resolveBotToken(config: ChatChannelConfig): Promise<string> {
    if (!config.botTokenRef) {
      throw new Error(
        'DiscordAdapter: botTokenRef 미설정 — setupChannel 이전 상태.',
      );
    }
    return this.secrets.resolve(config.botTokenRef);
  }

  /**
   * Spec §3.1 — `GET /applications/@me` 로 bot identity + verify_key 검증.
   * Interactions Endpoint URL 은 Discord Developer Portal 사전 등록 (R-D-2). 어댑터가 API 등록 안 함.
   * `PUT /applications/{app_id}/commands` bulk overwrite 로 slash commands 등록.
   * `issuedInboundSigning` 은 비움 — Discord public key 는 사용자 입력.
   */
  async setupChannel(
    config: ChatChannelConfig,
    _callbackUrl: string,
  ): Promise<SetupResult> {
    const botToken = await this.resolveBotToken(config);
    const app = await this.client.getApplicationMe(botToken);
    if ('code' in app && app.code != null) {
      throw new Error(
        `Discord getApplicationMe failed: ${app.message ?? 'unknown'}`,
      );
    }
    const application = app as {
      id: string;
      name: string;
      verify_key?: string;
    };
    if (!application.id) {
      throw new Error('Discord application 응답에 id 누락');
    }
    // slash command bulk overwrite — default prefix '/workflow'.
    const slashPrefix = config.languageHints?.slashPrefix ?? 'workflow';
    await this.client.putApplicationCommands(botToken, application.id, [
      {
        name: slashPrefix,
        description: 'Workflow assistant',
        type: 1,
        options: [
          { name: 'start', type: 1, description: 'Start a new conversation' },
          {
            name: 'cancel',
            type: 1,
            description: 'Cancel the active conversation',
          },
          { name: 'help', type: 1, description: 'Show help' },
          {
            name: 'reply',
            type: 1,
            description: 'Reply to the active AI conversation',
            options: [
              {
                name: 'message',
                type: 3,
                description: 'Reply text',
                required: true,
              },
            ],
          },
        ],
      },
    ]);
    return {
      registeredAt: new Date().toISOString(),
      identity: { applicationId: application.id, name: application.name },
      configUpdates: {
        botIdentity: {
          botId: hashStringToInt(application.id),
          username: application.name,
        },
      },
    };
  }

  /**
   * Spec §3.2 — slash command bulk overwrite 를 빈 배열로 호출 → 등록 해제. best-effort.
   * Interactions Endpoint URL 자체는 사용자가 Portal 에서 직접 비워야 함.
   */
  async teardownChannel(config: ChatChannelConfig): Promise<void> {
    try {
      const botToken = await this.resolveBotToken(config);
      const appId = String(config.botIdentity?.botId ?? '');
      if (!appId) return;
      await this.client.putApplicationCommands(botToken, appId, []);
    } catch (err) {
      this.logger.warn(
        `DiscordAdapter.teardownChannel best-effort 실패: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /**
   * Spec §4 — Interactions Webhook envelope 분기 (PING / APPLICATION_COMMAND / MESSAGE_COMPONENT
   * / MODAL_SUBMIT). PING 케이스는 null → caller (HooksService) 가 { type: 1 } 200 응답.
   */
  parseUpdate(
    raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    return Promise.resolve(parseDiscordUpdate(raw));
  }

  /**
   * Spec §5 — 5종 EIA event → ChannelMessage. conversationKey 는 dispatcher 보정.
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return Promise.resolve(renderDiscordEvent(event, config));
  }

  /**
   * Spec §3 / §5 — ChannelMessage → Discord REST 호출 분기.
   *   - text → POST /channels/{id}/messages (content)
   *   - buttons → content + components (ACTION_ROW + BUTTON)
   *   - form_prompt → content + hint note
   *   - image → fallbackText (v1 multipart upload 미구현)
   *   - typing → POST /channels/{id}/typing (R-D-5 native)
   */
  async sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult> {
    const botToken = await this.resolveBotToken(config);
    const channel = message.conversationKey;
    if (!channel) {
      throw new Error('DiscordAdapter.sendMessage: conversationKey 누락');
    }
    if (message.body.kind === 'typing') {
      const res = await this.client.postChannelTyping(botToken, channel);
      if (!res.ok) {
        // typing 실패는 silent — UX-only.
        this.logger.warn(`Discord typing 실패 (channel=${channel})`);
      }
      return { externalMsgId: '', sentAt: new Date().toISOString() };
    }
    if (message.body.kind === 'text') {
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: message.body.text,
      });
      return wrapSendResult(res, 'postChannelMessage');
    }
    if (message.body.kind === 'buttons') {
      const components = buildComponents(message.body.buttons);
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: message.body.text,
        components,
      });
      return wrapSendResult(res, 'postChannelMessage(buttons)');
    }
    if (message.body.kind === 'form_prompt') {
      const hintNote = message.body.hint ? `\n_(${message.body.hint})_` : '';
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: `${message.body.label}${hintNote}`,
      });
      return wrapSendResult(res, 'postChannelMessage(form_prompt)');
    }
    if (message.body.kind === 'image') {
      const text = message.body.caption ?? message.body.fallbackText;
      const res = await this.client.postChannelMessage(botToken, channel, {
        content: text,
      });
      return wrapSendResult(res, 'postChannelMessage(image fallback)');
    }
    return { externalMsgId: '', sentAt: new Date().toISOString() };
  }

  /**
   * Spec §4.2 — Discord Interactivity 3초 ack 는 HooksController 의 HTTP response (type 5/6) 로
   * 즉시 반환. 본 함수는 noop — 비동기 후속 갱신은 별 PATCH /webhooks/.../messages/@original
   * 호출 (Phase 후속 v2).
   */
  ackInteraction(
    _update: ChannelUpdate,
    _config: ChatChannelConfig,
  ): Promise<void> {
    return Promise.resolve();
  }
}

function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** ChannelButton[] → Discord ACTION_ROW + BUTTON components (Spec §5.2). */
function buildComponents(buttons: ChannelButton[]): unknown[] {
  // 5 buttons / row, 최대 5 rows.
  const rows: unknown[] = [];
  for (let i = 0; i < Math.min(buttons.length, 25); i += 5) {
    const slice = buttons.slice(i, i + 5);
    rows.push({
      type: 1,
      components: slice.map((b) => {
        if (b.type === 'link' && b.url) {
          return {
            type: 2,
            style: 5,
            label: b.label,
            url: b.url,
          };
        }
        const style = b.style === 'primary' ? 1 : b.style === 'danger' ? 4 : 2;
        return {
          type: 2,
          style,
          label: b.label,
          custom_id: b.id,
        };
      }),
    });
  }
  return rows;
}

function wrapSendResult(
  res: { id?: string; ok?: boolean; code?: number; message?: string },
  context: string,
): SendResult {
  if ('code' in res && res.code != null) {
    throw new Error(`Discord ${context} failed: ${res.message ?? 'unknown'}`);
  }
  return {
    externalMsgId: res.id ?? '',
    sentAt: new Date().toISOString(),
  };
}
