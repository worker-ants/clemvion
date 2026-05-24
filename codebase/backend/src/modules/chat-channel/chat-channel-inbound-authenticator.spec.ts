import { UnauthorizedException } from '@nestjs/common';
import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { ChatChannelConfig } from './types';

function makeSecretsMock(
  resolveImpl?: (ref: string) => Promise<string>,
): jest.Mocked<SecretResolverService> {
  return {
    resolve: jest.fn(resolveImpl ?? (async () => 'expected-token')),
    store: jest.fn(),
    rotate: jest.fn(),
    delete: jest.fn(),
    deleteByPrefix: jest.fn(),
    exists: jest.fn(),
  } as unknown as jest.Mocked<SecretResolverService>;
}

const TELEGRAM_CONFIG: ChatChannelConfig = {
  provider: 'telegram',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

describe('ChatChannelInboundAuthenticator', () => {
  describe('Telegram', () => {
    it('정상 — header 와 resolved plaintext 일치', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'expected-token',
        }),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).toHaveBeenCalledWith(
        TELEGRAM_CONFIG.inboundSigningRef,
      );
    });

    it('실패 — header 불일치 시 UnauthorizedException', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'wrong-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('실패 — inboundSigningRef resolve 실패 시 UnauthorizedException (raw error 미노출)', async () => {
      const secrets = makeSecretsMock(async () => {
        throw new Error('secret store unavailable');
      });
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'any',
        }),
      ).rejects.toMatchObject({
        response: { code: 'AUTH_FAILED' },
      });
    });

    it('skip — inboundSigningRef 미설정 시 검증 통과', async () => {
      const secrets = makeSecretsMock();
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify(
          't1',
          {
            provider: 'telegram',
            botTokenRef: 'secret://triggers/t1/bot-token',
          },
          {},
        ),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).not.toHaveBeenCalled();
    });

    it('skip — header 누락 + inboundSigningRef 있음 시 비교 실패 → 401', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('non-telegram provider', () => {
    it('Telegram 외 provider 는 어댑터 자체 검증 위임 → noop', async () => {
      const secrets = makeSecretsMock();
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      const slackConfig: ChatChannelConfig = {
        provider: 'slack',
        botTokenRef: 'secret://triggers/t1/bot-token',
      };
      await expect(
        authenticator.verify('t1', slackConfig, {
          'x-slack-signature': 'v0=abc',
        }),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).not.toHaveBeenCalled();
    });
  });
});
