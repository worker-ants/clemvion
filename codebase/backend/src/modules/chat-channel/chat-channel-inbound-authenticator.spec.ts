import { createHmac } from 'node:crypto';
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

  describe('Slack', () => {
    const SLACK_CONFIG_WITH_SECRET: ChatChannelConfig = {
      provider: 'slack',
      botTokenRef: 'secret://triggers/t1/bot-token',
      inboundSigningRef: 'secret://triggers/t1/inbound-signing',
    };

    function signSlack(body: string, ts: string, secret: string): string {
      // node:crypto 의 createHmac 으로 v0 signature 합성.
      const hmac = createHmac('sha256', secret)
        .update(`v0:${ts}:${body}`)
        .digest('hex');
      return `v0=${hmac}`;
    }

    it('정상 — signature + timestamp + rawBody 검증 통과', async () => {
      const SECRET = 'slack-test-secret';
      const secrets = makeSecretsMock(async () => SECRET);
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      const body = '{"event":{"type":"message"}}';
      const ts = String(Math.floor(Date.now() / 1000));
      const sig = signSlack(body, ts, SECRET);
      await expect(
        authenticator.verify(
          't1',
          SLACK_CONFIG_WITH_SECRET,
          {
            'x-slack-signature': sig,
            'x-slack-request-timestamp': ts,
          },
          body,
        ),
      ).resolves.toBeUndefined();
    });

    it('실패 — signature mismatch → UnauthorizedException', async () => {
      const secrets = makeSecretsMock(async () => 'secret');
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      const ts = String(Math.floor(Date.now() / 1000));
      await expect(
        authenticator.verify(
          't1',
          SLACK_CONFIG_WITH_SECRET,
          {
            'x-slack-signature': 'v0=' + 'f'.repeat(64),
            'x-slack-request-timestamp': ts,
          },
          '{}',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('실패 — resolve 실패 시 UnauthorizedException (raw error 미노출)', async () => {
      const secrets = makeSecretsMock(async () => {
        throw new Error('secret store unavailable');
      });
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify(
          't1',
          SLACK_CONFIG_WITH_SECRET,
          {
            'x-slack-signature': 'v0=abc',
            'x-slack-request-timestamp': '0',
          },
          '{}',
        ),
      ).rejects.toMatchObject({
        response: { code: 'AUTH_FAILED' },
      });
    });

    it('skip — inboundSigningRef 미설정 시 검증 통과 (legacy)', async () => {
      const secrets = makeSecretsMock();
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify(
          't1',
          { provider: 'slack', botTokenRef: 'secret://triggers/t1/bot-token' },
          {},
          '',
        ),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).not.toHaveBeenCalled();
    });
  });

  describe('미지원 provider', () => {
    it('알려지지 않은 provider 는 noop (Discord 등 후속 phase 에서 추가)', async () => {
      const secrets = makeSecretsMock();
      const authenticator = new ChatChannelInboundAuthenticator(secrets);
      await expect(
        authenticator.verify(
          't1',
          { provider: 'discord', botTokenRef: 'r' },
          {},
        ),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).not.toHaveBeenCalled();
    });
  });
});
