import {
  createHmac,
  generateKeyPairSync,
  sign as cryptoSign,
} from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { ChatChannelInboundAuthenticator } from './chat-channel-inbound-authenticator';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import type { ChatChannelSignatureFailureLimiterService } from './chat-channel-signature-failure-limiter.service';
import type { BusinessMetricsService } from '../metrics/business-metrics.service';
import { ChatChannelConfig } from './types';

type LimiterMock = {
  isBlocked: jest.Mock<Promise<boolean>, [string, string]>;
  recordFailure: jest.Mock<Promise<boolean>, [string, string]>;
};

/** 실패 한도 mock. 기본은 한도에 닿지 않은 상태다. */
function makeLimiterMock(): LimiterMock {
  return {
    isBlocked: jest.fn<Promise<boolean>, [string, string]>(async () => false),
    recordFailure: jest.fn<Promise<boolean>, [string, string]>(
      async () => false,
    ),
  };
}

function asLimiter(
  limiter: LimiterMock,
): ChatChannelSignatureFailureLimiterService {
  return limiter as unknown as ChatChannelSignatureFailureLimiterService;
}

/** 한도에 닿지 않은 mock 한도기를 쓰는 인증기. 한도 상태가 필요한 케이스는 직접 만든다. */
function makeAuthenticator(
  secrets: SecretResolverService,
  limiter: LimiterMock = makeLimiterMock(),
  metrics?: MetricsMock,
): ChatChannelInboundAuthenticator {
  return new ChatChannelInboundAuthenticator(
    secrets,
    asLimiter(limiter),
    metrics as unknown as BusinessMetricsService | undefined,
  );
}

type MetricsMock = { recordChatChannelSignatureFailureLimit: jest.Mock };

function makeMetricsMock(): MetricsMock {
  return { recordChatChannelSignatureFailureLimit: jest.fn() };
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

const SLACK_CONFIG_WITH_SECRET: ChatChannelConfig = {
  provider: 'slack',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

const DISCORD_CONFIG_WITH_KEY: ChatChannelConfig = {
  provider: 'discord',
  botTokenRef: 'secret://triggers/t1/bot-token',
  inboundSigningRef: 'secret://triggers/t1/inbound-signing',
};

/** 지금 시각(초)에 `offsetSec` 를 더한 timestamp 헤더 값. */
function nowSec(offsetSec = 0): string {
  return String(Math.floor(Date.now() / 1000) + offsetSec);
}

/** Slack v0 서명. node:crypto 의 createHmac 으로 합성한다. */
function signSlack(body: string, ts: string, secret: string): string {
  const hmac = createHmac('sha256', secret)
    .update(`v0:${ts}:${body}`)
    .digest('hex');
  return `v0=${hmac}`;
}

/** Discord ed25519 키 쌍. 공개 키는 SPKI DER 의 마지막 32바이트(raw)를 hex 로 둔다. */
function makeDiscordKeypair(): {
  publicKeyHex: string;
  sign: (data: string) => string;
} {
  const { privateKey, publicKey } = generateKeyPairSync('ed25519');
  const spki = publicKey.export({ format: 'der', type: 'spki' });
  return {
    publicKeyHex: spki.subarray(spki.length - 32).toString('hex'),
    sign: (data: string) =>
      cryptoSign(null, Buffer.from(data, 'utf8'), privateKey).toString('hex'),
  };
}

const DISCORD_KEY = makeDiscordKeypair();

describe('ChatChannelInboundAuthenticator', () => {
  describe('Telegram', () => {
    it('정상 — header 와 resolved plaintext 일치', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {
          'x-telegram-bot-api-secret-token': 'wrong-token',
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('실패 — 같은 길이 다른 토큰 (timing-safe compare mismatch) → 401', async () => {
      const secrets = makeSecretsMock(async () => 'expected-token');
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
      await expect(
        authenticator.verify('t1', TELEGRAM_CONFIG, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe('Slack', () => {
    it('정상 — signature + timestamp + rawBody 검증 통과', async () => {
      const SECRET = 'slack-test-secret';
      const secrets = makeSecretsMock(async () => SECRET);
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
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
      const authenticator = makeAuthenticator(secrets);
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

  describe('Discord', () => {
    it('정상 — ed25519 서명 + timestamp + rawBody 검증 통과', async () => {
      const secrets = makeSecretsMock(async () => DISCORD_KEY.publicKeyHex);
      const authenticator = makeAuthenticator(secrets);
      const body = '{"type":2}';
      const ts = nowSec();
      await expect(
        authenticator.verify(
          't1',
          DISCORD_CONFIG_WITH_KEY,
          {
            'x-signature-ed25519': DISCORD_KEY.sign(ts + body),
            'x-signature-timestamp': ts,
          },
          body,
        ),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).toHaveBeenCalledWith(
        DISCORD_CONFIG_WITH_KEY.inboundSigningRef,
      );
    });

    it('실패 — resolve 실패 시 UnauthorizedException (raw error 미노출)', async () => {
      const secrets = makeSecretsMock(async () => {
        throw new Error('secret store unavailable');
      });
      const authenticator = makeAuthenticator(secrets);
      await expect(
        authenticator.verify(
          't1',
          DISCORD_CONFIG_WITH_KEY,
          {
            'x-signature-ed25519': 'ab'.repeat(64),
            'x-signature-timestamp': nowSec(),
          },
          '{}',
        ),
      ).rejects.toMatchObject({
        response: { code: 'AUTH_FAILED', message: 'Invalid Discord signature' },
      });
    });

    it('skip — inboundSigningRef 미설정 시 검증 통과 (legacy)', async () => {
      const secrets = makeSecretsMock();
      const authenticator = makeAuthenticator(secrets);
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
    let metrics: MetricsMock;
    let authenticator: ChatChannelInboundAuthenticator;

    beforeEach(() => {
      envSnapshot = { ...process.env };
      delete process.env.TRUST_CF_CONNECTING_IP;
      secrets = makeSecretsMock(async () => 'expected-token');
      limiter = makeLimiterMock();
      metrics = makeMetricsMock();
      authenticator = makeAuthenticator(secrets, limiter, metrics);
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

    // 근거: NERV Task `CLE-T-5GVB9N`. 한도로 거절한 요청 수와 한도에 닿은 횟수를 지표로 센다.
    describe('지표', () => {
      it('한도로 거절한 요청마다 rejected 를 하나 센다', async () => {
        limiter.isBlocked.mockResolvedValueOnce(true);

        await expect(
          authenticator.verify('t1', SLACK_CONFIG_WITH_SECRET, {}, '', IP),
        ).rejects.toBeInstanceOf(UnauthorizedException);

        expect(
          metrics.recordChatChannelSignatureFailureLimit,
        ).toHaveBeenCalledTimes(1);
        expect(
          metrics.recordChatChannelSignatureFailureLimit,
        ).toHaveBeenCalledWith('slack', 'rejected');
      });

      it('이 실패로 한도에 닿았을 때만 reached 를 하나 센다', async () => {
        limiter.recordFailure
          .mockResolvedValueOnce(false)
          .mockResolvedValueOnce(true);

        for (let i = 0; i < 2; i += 1) {
          await expect(
            authenticator.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, '', IP),
          ).rejects.toBeInstanceOf(UnauthorizedException);
        }

        expect(
          metrics.recordChatChannelSignatureFailureLimit,
        ).toHaveBeenCalledTimes(1);
        expect(
          metrics.recordChatChannelSignatureFailureLimit,
        ).toHaveBeenCalledWith('telegram', 'reached');
      });

      it('서명이 맞으면 세지 않는다', async () => {
        await authenticator.verify('t1', TELEGRAM_CONFIG, GOOD_HEADERS, '', IP);

        expect(
          metrics.recordChatChannelSignatureFailureLimit,
        ).not.toHaveBeenCalled();
      });

      it('지표 서비스가 없어도 검증 결과는 같다', async () => {
        limiter.recordFailure.mockResolvedValueOnce(true);
        const plain = makeAuthenticator(secrets, limiter);

        await expect(
          plain.verify('t1', TELEGRAM_CONFIG, BAD_HEADERS, '', IP),
        ).rejects.toMatchObject({ status: 401 });
      });
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

    // 공개 입력으로는 401 이 아닌 오류를 만들 수 없다. 시크릿 조회 실패는 401 로 바꾸고, Slack · Discord 서명
    // 함수는 형식 오류와 crypto 예외에 false 를 돌려준다. 그래서 private `verifySignature` 를 spy 해 그 오류를
    // 흉내 낸다. 메서드 이름이 바뀌면 `jest.spyOn` 이 던지므로 이 테스트가 조용히 무력해지지는 않는다.
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

    // 근거: NERV Task `CLE-T-WQ88BG`. 한도는 provider 와 무관하게 `verify` 한 곳에서 센다. provider 마다
    // 서명이 틀린 요청이 실패 하나로 세지는지 본다. 아래 두 표의 같은 provider 행은 서명의 한 부분만 다르다.
    type SignedRequest = {
      config: ChatChannelConfig;
      secret: string;
      headers: Record<string, string>;
      rawBody: string;
    };
    const BODY = '{"type":2,"text":"hi"}';
    const OTHER_BODY = '{"type":2,"text":"bye"}';
    /** 5분 replay 창 밖의 timestamp 오프셋(초). */
    const STALE = -10 * 60;
    const telegramRequest = (token: string): SignedRequest => ({
      config: TELEGRAM_CONFIG,
      secret: 'expected-token',
      headers: { 'x-telegram-bot-api-secret-token': token },
      rawBody: '',
    });
    const slackRequest = (signedBody: string, offsetSec = 0): SignedRequest => {
      const ts = nowSec(offsetSec);
      return {
        config: SLACK_CONFIG_WITH_SECRET,
        secret: 'slack-test-secret',
        headers: {
          'x-slack-signature': signSlack(signedBody, ts, 'slack-test-secret'),
          'x-slack-request-timestamp': ts,
        },
        rawBody: BODY,
      };
    };
    const discordRequest = (
      signedBody: string,
      offsetSec = 0,
    ): SignedRequest => {
      const ts = nowSec(offsetSec);
      return {
        config: DISCORD_CONFIG_WITH_KEY,
        secret: DISCORD_KEY.publicKeyHex,
        headers: {
          'x-signature-ed25519': DISCORD_KEY.sign(ts + signedBody),
          'x-signature-timestamp': ts,
        },
        rawBody: BODY,
      };
    };
    function authenticatorFor(
      req: SignedRequest,
    ): ChatChannelInboundAuthenticator {
      secrets = makeSecretsMock(async () => req.secret);
      return makeAuthenticator(secrets, limiter);
    }

    it.each<[string, string, () => SignedRequest, string]>([
      [
        'telegram',
        '토큰 불일치',
        () => telegramRequest('wrong-token-xx'),
        'Invalid Telegram secret token',
      ],
      [
        'slack',
        'rawBody HMAC 불일치',
        () => slackRequest(OTHER_BODY),
        'Invalid Slack signature',
      ],
      [
        'slack',
        'timestamp 가 5분 창 밖',
        () => slackRequest(BODY, STALE),
        'Invalid Slack signature',
      ],
      [
        'discord',
        'rawBody 서명 불일치',
        () => discordRequest(OTHER_BODY),
        'Invalid Discord signature',
      ],
      [
        'discord',
        'timestamp 가 5분 창 밖',
        () => discordRequest(BODY, STALE),
        'Invalid Discord signature',
      ],
    ])(
      '%s — %s 이면 실패 하나를 세고 401 을 던진다',
      async (_provider, _label, makeRequest, message) => {
        const req = makeRequest();
        const auth = authenticatorFor(req);

        await expect(
          auth.verify('t1', req.config, req.headers, req.rawBody, IP),
        ).rejects.toMatchObject({
          status: 401,
          response: { code: 'AUTH_FAILED', message },
        });
        expect(secrets.resolve).toHaveBeenCalledWith(
          req.config.inboundSigningRef,
        );
        expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
        expect(limiter.recordFailure).toHaveBeenCalledTimes(1);
        expect(limiter.recordFailure).toHaveBeenCalledWith('t1', IP);
      },
    );

    // 위 표의 대조군이다. 서명이 맞으면 같은 요청이 통과하고 세지 않는다.
    it.each<[string, () => SignedRequest]>([
      ['telegram', () => telegramRequest('expected-token')],
      ['slack', () => slackRequest(BODY)],
      ['discord', () => discordRequest(BODY)],
    ])(
      '%s — 서명이 맞으면 통과하고 세지 않는다',
      async (_provider, makeRequest) => {
        const req = makeRequest();
        const auth = authenticatorFor(req);

        await expect(
          auth.verify('t1', req.config, req.headers, req.rawBody, IP),
        ).resolves.toBeUndefined();
        expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
        expect(limiter.recordFailure).not.toHaveBeenCalled();
      },
    );

    // 서명 참조가 없으면 검증을 건너뛰므로 셀 실패가 없다. 한도 조회는 provider · 서명 참조와 상관없이
    // 검증 앞에서 한 번 한다(지금 동작을 고정한다).
    it.each(['telegram', 'slack', 'discord'])(
      '%s — 서명 참조가 없으면 검증을 건너뛰고 세지 않는다',
      async (provider) => {
        await expect(
          authenticator.verify(
            't1',
            { provider, botTokenRef: 'secret://triggers/t1/bot-token' },
            {
              'x-telegram-bot-api-secret-token': 'wrong-token-xx',
              'x-slack-signature': 'v0=' + 'f'.repeat(64),
              'x-slack-request-timestamp': nowSec(),
              'x-signature-ed25519': 'ab'.repeat(64),
              'x-signature-timestamp': nowSec(),
            },
            BODY,
            IP,
          ),
        ).resolves.toBeUndefined();
        expect(secrets.resolve).not.toHaveBeenCalled();
        expect(limiter.isBlocked).toHaveBeenCalledTimes(1);
        expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
        expect(limiter.recordFailure).not.toHaveBeenCalled();
      },
    );

    it('검증을 맡지 않는 provider 는 서명 참조가 있어도 통과하고 세지 않는다', async () => {
      await expect(
        authenticator.verify(
          't1',
          { ...TELEGRAM_CONFIG, provider: 'line' },
          {},
          BODY,
          IP,
        ),
      ).resolves.toBeUndefined();
      expect(secrets.resolve).not.toHaveBeenCalled();
      expect(limiter.isBlocked).toHaveBeenCalledTimes(1);
      expect(limiter.isBlocked).toHaveBeenCalledWith('t1', IP);
      expect(limiter.recordFailure).not.toHaveBeenCalled();
    });
  });
});
