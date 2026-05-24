import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { verifySlackSignature } from './providers/slack/slack-signing';
import { ChatChannelConfig } from './types';

/**
 * Chat Channel inbound webhook 의 provider 별 인증 검증.
 *
 * NestJS Guard 와 동등한 의도(인증·인가만 책임) 의 별 클래스. HooksService 가 직접
 * 인증 로직을 가지지 않도록 분리 — 단위 테스트 격리 + provider 확장 시 단일 변경 지점.
 *
 * 호출 시점: HooksService.handleChatChannelWebhook 진입 직후, parseUpdate 이전.
 *
 * 현재 검증 정책:
 *   - Telegram: `X-Telegram-Bot-Api-Secret-Token` 헤더 ↔ `config.inboundSigningRef` resolve 비교.
 *     `inboundSigningRef` 미설정 시 검증 skip (legacy / setupChannel 전 trigger).
 *   - Slack: `X-Slack-Signature` HMAC-SHA256(secret, "v0:" + ts + ":" + raw_body) + 5분 replay
 *     window. `inboundSigningRef` 미설정 시 검증 skip (legacy — 보안 trade-off 는 운영자 책임).
 *   - 다른 provider: 어댑터별 자체 검증 (Discord ed25519 등) — Phase 별 추가.
 */
@Injectable()
export class ChatChannelInboundAuthenticator {
  private readonly logger = new Logger(ChatChannelInboundAuthenticator.name);

  constructor(private readonly secrets: SecretResolverService) {}

  /**
   * 검증 실패 시 `UnauthorizedException` throw. 성공 시 void.
   *
   * @param triggerId — 로그용
   * @param config — `ChatChannelConfig` (provider, inboundSigningRef 등)
   * @param headers — webhook request headers (lowercased key)
   * @param rawBody — Slack signing 검증용 raw request body (string). Telegram 은 무시.
   */
  async verify(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
    rawBody = '',
  ): Promise<void> {
    if (config.provider === 'telegram') {
      await this.verifyTelegram(triggerId, config, headers);
      return;
    }
    if (config.provider === 'slack') {
      await this.verifySlack(triggerId, config, headers, rawBody);
      return;
    }
    // 다른 provider 는 어댑터마다 자체 검증 — 본 클래스에서는 통과.
  }

  private async verifyTelegram(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
  ): Promise<void> {
    // inboundSigningRef 미설정 시 검증 skip (legacy / setupChannel 전 trigger).
    if (!config.inboundSigningRef) return;

    const headerToken = headers['x-telegram-bot-api-secret-token'] ?? '';
    let expected: string;
    try {
      expected = await this.secrets.resolve(config.inboundSigningRef);
    } catch (err) {
      this.logger.warn(
        `Telegram inbound-signing resolve 실패 (trigger=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Telegram secret token',
      });
    }
    if (headerToken !== expected) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Telegram secret token',
      });
    }
  }

  private async verifySlack(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<void> {
    if (!config.inboundSigningRef) return;
    const signature = headers['x-slack-signature'] ?? '';
    const timestamp = headers['x-slack-request-timestamp'] ?? '';
    let secret: string;
    try {
      secret = await this.secrets.resolve(config.inboundSigningRef);
    } catch (err) {
      this.logger.warn(
        `Slack inbound-signing resolve 실패 (trigger=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Slack signature',
      });
    }
    if (!verifySlackSignature(rawBody, signature, timestamp, secret)) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Slack signature',
      });
    }
  }
}
