import { Injectable, Logger } from '@nestjs/common';
import { SecretResolverService } from '../../../secret-store/secret-resolver.service';
import type {
  ChannelMessage,
  ChannelUpdate,
  ChatChannelAdapter,
  ChatChannelConfig,
  ChatChannelInternalEvent,
  EiaEvent,
  SendResult,
  SetupResult,
} from '../../types';
import { SlackClient } from './slack-client';
import { renderSlackEvent } from './slack-message.renderer';
import { parseSlackUpdate } from './slack-update.parser';
import type { ChannelButton } from '../../types';

/**
 * Slack Chat Channel Adapter.
 *
 * Spec [providers/slack.md] — Web API + Events API + Interactivity 기반 Webhook-mode 어댑터.
 *
 * Spec 의 핵심 결정:
 *   - Webhook-mode only (R-S-3). Socket Mode 는 v2.
 *   - DM 첫 메시지 자동 start (R-S-9). slash command 는 보조 명령.
 *   - typing no-op (R-S-5). Slack Web API 미지원.
 *   - Form 다단계 텍스트 시퀀스 (Convention §4 / R-S-6). modal 은 v2.
 *   - inboundSigningRef = signing secret HMAC (R-S-1). Telegram server-issued 와 달리 사용자 입력.
 *     `SetupResult.issuedInboundSigning` 은 항상 비움.
 *
 * Phase 1: 6함수 stub + signing 검증.
 * Phase 2 (현재): parseUpdate + setupChannel + Slack signing auth 경로.
 * Phase 3: renderNode + sendMessage (chat.postMessage / Block Kit / 시각형 v1 text).
 * Phase 4: bot token rotation 의 Slack 분기 + auth.revoke.
 */
@Injectable()
export class SlackAdapter implements ChatChannelAdapter {
  private readonly logger = new Logger(SlackAdapter.name);
  readonly provider = 'slack';

  constructor(
    private readonly client: SlackClient,
    private readonly secrets: SecretResolverService,
  ) {}

  private async resolveBotToken(config: ChatChannelConfig): Promise<string> {
    if (!config.botTokenRef) {
      throw new Error(
        'SlackAdapter: botTokenRef 미설정 — setupChannel 이전 상태.',
      );
    }
    return this.secrets.resolve(config.botTokenRef);
  }

  /**
   * Spec §3.1 — `auth.test` 로 bot identity 캐시.
   * Events API Request URL 은 Slack 앱 manifest 의 사전 등록 — 어댑터가 API 로 등록 안 함 (R-S-2).
   * `issuedInboundSigning` 은 비움 — Slack 의 signing secret 은 provider-issued (사용자 입력),
   * caller (TriggersService) 가 사용자 입력값을 직접 SecretResolver.store 로 보관.
   */
  async setupChannel(
    config: ChatChannelConfig,
    _callbackUrl: string,
  ): Promise<SetupResult> {
    const botToken = await this.resolveBotToken(config);
    const result = await this.client.authTest(botToken);
    if (!result.ok) {
      throw new Error(`Slack auth.test failed: ${result.error ?? 'unknown'}`);
    }
    const botId = result.user_id ?? result.bot_id;
    const username = result.user ?? result.bot_id ?? 'slack-bot';
    if (!botId) {
      throw new Error('Slack auth.test 응답에 user_id / bot_id 모두 없음');
    }
    const botIdentity = {
      // Slack 의 user_id 는 'U...' / bot_id 는 'B...' 형식 문자열. types 의 botId 가 number 라
      // 의미상 맞지 않지만 botIdentity slot 의 SoT 인 Convention §2.3 의 number 약속을 깨지 않기
      // 위해 hashCode 로 변환 (provider 별 한정 — Slack identity 의 의미는 username + teamId).
      botId: hashStringToInt(botId),
      username,
      teamId: result.team_id,
    };
    return {
      registeredAt: new Date().toISOString(),
      identity: { botId: botIdentity.botId, username, teamId: result.team_id },
      configUpdates: { botIdentity },
      // Slack 은 provider-issued — 발급한 plaintext 없음.
    };
  }

  /**
   * Spec §3.2 — best-effort no-op. Slack 앱 uninstall 은 사용자가 workspace 에서 직접.
   * Bot token rotation 의 24h grace 종료 시 별 cron 이 `auth.revoke` 호출 — 본 함수 책임 아님.
   */
  teardownChannel(_config: ChatChannelConfig): Promise<void> {
    return Promise.resolve();
  }

  /**
   * Spec §4 — Events API / Interactivity / Slash Commands 3종 envelope 분기.
   * 본 함수는 pure — DB 미접근, 외부 API 미호출 (Convention §1.1).
   * url_verification 케이스는 null 반환 + caller (HooksService) 가 `{ challenge }` 200 응답.
   * file_shared 의 mimeType 은 placeholder 로 반환, caller 가 files.info 보강 (R-S-7).
   */
  parseUpdate(
    raw: unknown,
    _config: ChatChannelConfig,
  ): Promise<ChannelUpdate | null> {
    return Promise.resolve(parseSlackUpdate(raw));
  }

  /**
   * Spec §5 인터랙션 노드 UI 매핑 (Phase 3).
   * 본 함수는 pure — ChannelMessage 합성만, sendMessage 가 실제 외부 호출.
   * conversationKey 는 dispatcher 가 보정 (Telegram renderer 와 동일 패턴).
   */
  renderNode(
    event: EiaEvent | ChatChannelInternalEvent,
    config: ChatChannelConfig,
  ): Promise<ChannelMessage[]> {
    return Promise.resolve(renderSlackEvent(event, config));
  }

  /**
   * Spec §3 / §5 — ChannelMessage 를 Slack chat.postMessage 호출로 분기.
   * typing → no-op (R-S-5). image → v1 미지원 (fallbackText 로 text 발송).
   */
  async sendMessage(
    message: ChannelMessage,
    config: ChatChannelConfig,
  ): Promise<SendResult> {
    if (message.body.kind === 'typing') {
      // Slack 은 server-initiated typing indicator 미지원. silent skip + dummy SendResult.
      return { externalMsgId: '', sentAt: new Date().toISOString() };
    }
    const botToken = await this.resolveBotToken(config);
    const channel = message.conversationKey;
    if (!channel) {
      throw new Error('SlackAdapter.sendMessage: conversationKey 누락');
    }

    if (message.body.kind === 'text') {
      const res = await this.client.chatPostMessage(botToken, {
        channel,
        text: message.body.text,
      });
      return wrapSendResult(res, 'chat.postMessage');
    }
    if (message.body.kind === 'buttons') {
      const blocks = buildActionsBlocks(
        message.body.text,
        message.body.buttons,
      );
      const res = await this.client.chatPostMessage(botToken, {
        channel,
        text: message.body.text,
        blocks,
      });
      return wrapSendResult(res, 'chat.postMessage(buttons)');
    }
    if (message.body.kind === 'form_prompt') {
      // v1 다단계 — 단순 text prompt + hint 표기 (Block Kit input 은 v2 modal).
      const hintNote = message.body.hint ? `\n_(${message.body.hint})_` : '';
      const res = await this.client.chatPostMessage(botToken, {
        channel,
        text: `${message.body.label}${hintNote}`,
      });
      return wrapSendResult(res, 'chat.postMessage(form_prompt)');
    }
    if (message.body.kind === 'image') {
      // v1 = files.uploadV2 미구현 — fallbackText 로 text 발송 (R-S §5.4).
      const text = message.body.caption ?? message.body.fallbackText;
      const res = await this.client.chatPostMessage(botToken, {
        channel,
        text,
      });
      return wrapSendResult(res, 'chat.postMessage(image fallback)');
    }
    // exhaustive guard.
    return { externalMsgId: '', sentAt: new Date().toISOString() };
  }

  /**
   * Spec §4.2 — Slack Interactivity 3초 ack 는 HooksController 의 HTTP response 로 즉시 반환.
   * 본 함수는 noop — 비동기 후속 갱신은 sendMessage 가 response_url 로 처리.
   */
  ackInteraction(
    _update: ChannelUpdate,
    _config: ChatChannelConfig,
  ): Promise<void> {
    return Promise.resolve();
  }

  /**
   * [Convention chat-channel-adapter §1 revokeBotToken 옵션] Bot token rotation 24h grace
   * 종료 시점에 이전 token 을 Slack `auth.revoke` API 로 무효화.
   *
   * - 외부 API 실패는 caller 에 propagate 하지 않고 swallow — caller (TriggersService) 의
   *   secret_store cleanup 을 차단하지 않는 best-effort.
   * - Telegram / Discord 등 다른 provider 는 본 메서드 미구현 (`undefined`).
   */
  async revokeBotToken(oldBotToken: string): Promise<void> {
    try {
      await this.client.authRevoke(oldBotToken);
    } catch {
      // best-effort — caller 가 swallow 보장하지만 방어적으로도 swallow.
    }
  }
}

/**
 * Slack 의 string id (`U...` / `B...`) 를 Convention 의 `botId: number` 슬롯에 채우기 위한
 * deterministic int hash. 충돌 가능성 무시할 수준 (32bit) + Slack workspace 내 unique 필요 없음
 * (caller 가 botId 를 키로 쓸 일 없음 — username + teamId 가 실제 식별자).
 */
function hashStringToInt(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i += 1) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/** Slack Block Kit actions block 으로 ChannelButton[] 변환 (Spec §5.2). */
function buildActionsBlocks(text: string, buttons: ChannelButton[]): unknown[] {
  return [
    { type: 'section', text: { type: 'mrkdwn', text } },
    {
      type: 'actions',
      elements: buttons.slice(0, 25).map((b) => {
        if (b.type === 'link' && b.url) {
          return {
            type: 'button',
            text: { type: 'plain_text', text: b.label },
            url: b.url,
          };
        }
        return {
          type: 'button',
          text: { type: 'plain_text', text: b.label },
          value: b.id,
          action_id: `btn_${b.id}`,
          ...(b.style === 'primary' || b.style === 'danger'
            ? { style: b.style }
            : {}),
        };
      }),
    },
  ];
}

function wrapSendResult(
  res: { ok: boolean; ts?: string; channel?: string; error?: string },
  context: string,
): SendResult {
  if (!res.ok) {
    throw new Error(`Slack ${context} failed: ${res.error ?? 'unknown'}`);
  }
  return {
    externalMsgId: res.ts ?? '',
    sentAt: new Date().toISOString(),
  };
}
