import { timingSafeEqual } from 'node:crypto';
import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { extractUnspoofableClientIp } from '../auth/utils/client-ip';
import { verifyDiscordSignature } from './providers/discord/discord-signing';
import { verifySlackSignature } from './providers/slack/slack-signing';
import { hasInboundSigningRef } from './chat-channel-secret-refs';
import { ChatChannelSignatureFailureLimiterService } from './chat-channel-signature-failure-limiter.service';
import { ChatChannelConfig } from './types';

/**
 * 채팅 채널 인바운드 웹훅의 서명 검증과 서명 실패 한도.
 *
 * 둘을 한 클래스에 둔다(NERV Task `CLE-T-A5T8D6`). 서명 참조가 있는 채팅 채널 트리거는 전역 요청 한도에서
 * 빠지므로 실패 한도가 그 자리를 대신한다. 검증과 한도가 떨어져 있으면 한쪽만 고쳐 그 짝이 깨지기 쉽다.
 * HooksService 는 `verify` 하나만 부른다.
 *
 * 호출 시점: HooksService.handleChatChannelWebhook 진입 직후, parseUpdate 이전.
 *
 * 실패 한도(CHAT-CORE-GATE R-CC-34, NERV Task `CLE-T-ZC34Y0` · `CLE-T-CC3GPN`):
 *   - 키는 (트리거, 클라이언트 IP) 쌍이다. 분당 실패가 한도에 닿으면 서명을 검증하지 않고 401 로 답한다.
 *   - 클라이언트 IP 는 `extractUnspoofableClientIp` 로 읽는다. `CF-Connecting-IP`(신뢰 설정일 때) 다음
 *     `req.ip` 이고, 보내는 쪽이 정할 수 있는 `X-Forwarded-For` 첫 값은 쓰지 않는다.
 *   - IP 를 알 수 없으면 한도를 보지도 세지도 않는다. 모든 요청이 한 버킷을 함께 쓰면 공격자 한 명이
 *     정상 update 까지 막을 수 있어서다.
 *   - 401 만 센다. 그 밖의 오류는 서명이 틀렸다는 뜻이 아니다.
 *
 * provider 별 서명 검증:
 *   - Telegram: `X-Telegram-Bot-Api-Secret-Token` 헤더 ↔ `config.inboundSigningRef` resolve 비교.
 *   - Slack: `X-Slack-Signature` HMAC-SHA256(secret, "v0:" + ts + ":" + raw_body) + 5분 replay window.
 *   - Discord: `X-Signature-Ed25519` · `X-Signature-Timestamp` ed25519 검증.
 *   - 세 provider 모두 `inboundSigningRef` 가 없으면 검증을 건너뛴다(legacy · setupChannel 전 트리거).
 */
@Injectable()
export class ChatChannelInboundAuthenticator {
  private readonly logger = new Logger(ChatChannelInboundAuthenticator.name);

  constructor(
    private readonly secrets: SecretResolverService,
    private readonly failureLimiter: ChatChannelSignatureFailureLimiterService,
  ) {}

  /**
   * 검증 실패 시 `UnauthorizedException` throw. 성공 시 void.
   *
   * @param triggerId — 실패 한도 키 · 로그용
   * @param config — `ChatChannelConfig` (provider, inboundSigningRef 등)
   * @param headers — webhook request headers (lowercased key)
   * @param rawBody — Slack · Discord 서명 검증용 raw request body (string). Telegram 은 무시.
   * @param requestIp — Express `req.ip`(`trust proxy` 적용 값). 실패 한도 키의 IP 다.
   */
  async verify(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
    rawBody = '',
    requestIp?: string,
  ): Promise<void> {
    const clientIp = extractUnspoofableClientIp(headers, requestIp);
    if (
      clientIp &&
      (await this.failureLimiter.isBlocked(triggerId, clientIp))
    ) {
      this.logger.debug(
        `chat-channel 서명 실패 한도에 닿아 검증 없이 401 로 답한다 (trigger=${triggerId})`,
      );
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Too many failed signature checks',
      });
    }
    try {
      await this.verifySignature(triggerId, config, headers, rawBody);
    } catch (err) {
      if (err instanceof UnauthorizedException && clientIp) {
        await this.failureLimiter.recordFailure(triggerId, clientIp);
      }
      throw err;
    }
  }

  private async verifySignature(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<void> {
    if (config.provider === 'telegram') {
      await this.verifyTelegram(triggerId, config, headers);
      return;
    }
    if (config.provider === 'slack') {
      await this.verifySlack(triggerId, config, headers, rawBody);
      return;
    }
    if (config.provider === 'discord') {
      await this.verifyDiscord(triggerId, config, headers, rawBody);
      return;
    }
    // 다른 provider 는 어댑터마다 자체 검증 — 본 클래스에서는 통과.
  }

  private async verifyDiscord(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
    rawBody: string,
  ): Promise<void> {
    if (!hasInboundSigningRef(config)) return;
    const signature = headers['x-signature-ed25519'] ?? '';
    const timestamp = headers['x-signature-timestamp'] ?? '';
    let publicKeyHex: string;
    try {
      publicKeyHex = await this.secrets.resolve(config.inboundSigningRef);
    } catch (err) {
      this.logger.warn(
        `Discord inbound-signing resolve 실패 (trigger=${triggerId}): ${err instanceof Error ? err.message : String(err)}`,
      );
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Discord signature',
      });
    }
    if (!verifyDiscordSignature(rawBody, signature, timestamp, publicKeyHex)) {
      throw new UnauthorizedException({
        code: 'AUTH_FAILED',
        message: 'Invalid Discord signature',
      });
    }
  }

  private async verifyTelegram(
    triggerId: string,
    config: ChatChannelConfig,
    headers: Record<string, string>,
  ): Promise<void> {
    // inboundSigningRef 미설정 시 검증 skip (legacy / setupChannel 전 trigger).
    if (!hasInboundSigningRef(config)) return;

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
    // constant-time compare — timing side-channel 차단. 길이가 다르면
    // timingSafeEqual 가 throw 하므로 사전 길이 비교로 거른다 (Slack signing 동일 패턴).
    const headerBuf = Buffer.from(headerToken, 'utf8');
    const expectedBuf = Buffer.from(expected, 'utf8');
    if (
      headerBuf.length !== expectedBuf.length ||
      !timingSafeEqual(headerBuf, expectedBuf)
    ) {
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
    if (!hasInboundSigningRef(config)) return;
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
