import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
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
 *   - Telegram: `X-Telegram-Bot-Api-Secret-Token` 헤더 ↔ `config.secretTokenRef` resolve 비교.
 *     `secretTokenRef` 미설정 시 검증 skip (legacy / setupChannel 전 trigger).
 *   - 다른 provider: 어댑터별 자체 검증 (HMAC 등) — 본 클래스는 noop.
 */
@Injectable()
export class ChatChannelInboundAuthenticator {
  private readonly logger = new Logger(ChatChannelInboundAuthenticator.name);

  constructor(private readonly secrets: SecretResolverService) {}

  /**
   * 검증 실패 시 `UnauthorizedException` throw. 성공 시 void.
   *
   * @param triggerId — 로그용
   * @param config — `ChatChannelConfig` (provider, secretTokenRef 등)
   * @param headers — webhook request headers (lowercased key)
   */
  async verify(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
  ): Promise<void> {
    if (config.provider === 'telegram') {
      await this.verifyTelegram(triggerId, config, headers);
      return;
    }
    // 다른 provider 는 어댑터마다 자체 검증 — 본 클래스에서는 통과.
  }

  private async verifyTelegram(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
  ): Promise<void> {
    // secretTokenRef 미설정 시 검증 skip (legacy / setupChannel 전 trigger).
    if (!config.secretTokenRef) return;

    const headerToken = headers['x-telegram-bot-api-secret-token'] ?? '';
    let expected: string;
    try {
      expected = await this.secrets.resolve(config.secretTokenRef);
    } catch (err) {
      this.logger.warn(
        `Telegram secret_token resolve 실패 (trigger=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
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
}
