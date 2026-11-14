import { createHmac } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import type { ChatChannelSignatureFailureLimiterService } from './chat-channel-signature-failure-limiter.service';
import { ChatChannelConfig } from './types';

type LimiterMock = {
  isBlocked: jest.Mock<Promise<boolean>, [string, string]>;
  recordFailure: jest.Mock<Promise<void>, [string, string]>;
};

/** 실패 한도 mock. 기본은 한도에 닿지 않은 상태다. */
function makeLimiterMock(): LimiterMock {
  return {
    isBlocked: jest.fn<Promise<boolean>, [string, string]>(async () => false),
    recordFailure: jest.fn<Promise<void>, [string, string]>(
      async () => undefined,
    ),
  };
}

function asLimiter(
  limiter: LimiterMock,
): ChatChannelSignatureFailureLimiterService {
  return limiter as unknown as ChatChannelSignatureFailureLimiterService;
}

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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'wrong-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('실패 — 같은 길이 다른 토큰 (timing-safe compare mismatch) → 401', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
      // 'expected-token' 과 동일 길이(14) — 길이 가드를 통과해
      // timingSafeEqual mismatch 경로를 탄다.
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'xxxxxxxxxxxxxx',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('실패 — inboundSigningRef resolve 실패 시 UnauthorizedException (raw error 미노출)', async () => {
      const secrets = makeSecretsMock(async () => {
        throw new Error('secret store unavailable');
      });
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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

  // 근거: NERV Task `CLE-T-ZC34Y0` · `CLE-T-A5T8D6` · `CLE-T-CC3GPN`. 채팅 채널 트리거는 전역 요청 한도에서
  // 빠지므로 (트리거, 클라이언트 IP) 쌍의 서명 검증 실패를 분당 세고, 한도에 닿으면 검증 없이 401 로 답한다.
  // 서명 검증과 실패 한도는 이 인증기 한 곳에 있다. 키의 IP 는 CF-Connecting-IP(신뢰 설정) → req.ip 이고
  // XFF 첫 값은 쓰지 않는다(2026-11-14 답 A).
  describe('서명 검증 실패 한도', () => {
    const IP = '203.0.113.50';
    const SPOOFED = '198.51.100.99';
    const BAD_HEADERS = {
      'x-telegram-bot-api-secret-token': 'wrong-token-xx',
      'x-forwarded-for': `${SPOOFED}, ${IP}`,
    };
    const GOOD_HEADERS = {
      'x-telegram-bot-api-secret-token': 'expected-token',
      'x-forwarded-for': `${SPOOFED}, ${IP}`,
    };
    let envSnapshot: NodeJS.ProcessEnv;
    let secrets: jest.Mocked<SecretResolverService>;
    let limiter: LimiterMock;
    let authenticator: ChatChannelInboundAuthenticator;

    beforeEach(() => {
      envSnapshot = { ...process.env };
      delete process.env.TRUST_CF_CONNECTING_IP;
      secrets = makeSecretsMock(async () => 'expected-token');
      limiter = makeLimiterMock();
      authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(limiter),
      );
    });
    afterEach(() => {
      process.env = envSnapshot;
    });

    it('한도에 닿은 쌍은 서명을 검증하지 않고 401 로 답하고 다시 세지 않는다', async () => {
      limiter.isBlocked.mockResolvedValueOnce(true);

      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, GOOD_HEADERS, '', IP),
      ).rejects.toMatchObject({
        status: 401,
        response: {
          code: 'AUTH_FAILED',
          message: 'Too many failed signature checks',
        },
      });
      expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
      expect(secrets.resolve).not.toHaveBeenCalled();
      // 막힌 요청을 세면 창이 끝나도 계속 막힐 수 있다.
      expect(limiter.recordFailure).not.toHaveBeenCalled();
    });

    it('서명 검증이 실패하면 그 쌍의 실패를 하나 세고 같은 401 을 던진다', async () => {
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, '', IP),
      ).rejects.toMatchObject({
        status: 401,
        response: { message: 'Invalid Telegram secret token' },
      });
      expect(limiter.recordFailure).toHaveBeenCalledTimes(1);
      expect(limiter.recordFailure).toHaveBeenCalledWith('t1', IP);
    });

    it('키의 IP 는 XFF 첫 값이 아니라 req.ip 다', async () => {
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, '', IP),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(limiter.isBlocked).not.toHaveBeenCalledWith('t1', SPOOFED);
      expect(limiter.recordFailure).not.toHaveBeenCalledWith('t1', SPOOFED);
    });

    it('CF 신뢰 설정이 켜져 있으면 CF-Connecting-IP 로 센다', async () => {
      process.env.TRUST_CF_CONNECTING_IP = 'true';

      await expect(
        authenticator.verify(
          't1',
          TELEGRAM_CONFIG,
          { ...BAD_HEADERS, 'cf-connecting-ip': '192.0.2.10' },
          '',
          '10.0.0.1',
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(limiter.recordFailure).toHaveBeenCalledWith('t1', '192.0.2.10');
    });

    it('서명 검증을 통과하면 세지 않는다', async () => {
      await authenticator.verify('t1', TELEGRAM_CONFIG, GOOD_HEADERS, '', IP);

      expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
      expect(limiter.recordFailure).not.toHaveBeenCalled();
    });

    it('401 이 아닌 오류는 세지 않는다', async () => {
      const crash = new TypeError('verify crashed');
      jest
        .spyOn(
          authenticator as unknown as {
            verifySignature: (...args: unknown[]) => Promise<void>;
          },
          'verifySignature',
        )
        .mockRejectedValueOnce(crash);

      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, '', IP),
      ).rejects.toBe(crash);
      expect(limiter.recordFailure).not.toHaveBeenCalled();
    });

    it('클라이언트 IP 를 알 수 없으면 한도를 보지도 세지도 않는다 — 한 버킷을 함께 쓰지 않는다', async () => {
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, ''),
      ).rejects.toBeInstanceOf(UnauthorizedException);

      expect(limiter.isBlocked).not.toHaveBeenCalled();
      expect(limiter.recordFailure).not.toHaveBeenCalled();
    });
  });

  describe('미지원 provider', () => {
    it('알려지지 않은 provider 는 noop (Discord 등 후속 phase 에서 추가)', async () => {
      const secrets = makeSecretsMock();
      const authenticator = new ChatChannelInboundAuthenticator(
        secrets,
        asLimiter(makeLimiterMock()),
      );
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
