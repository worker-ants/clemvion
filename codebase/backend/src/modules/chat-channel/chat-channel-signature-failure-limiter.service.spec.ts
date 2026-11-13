import { Logger } from '@nestjs/common';
import {
  ChatChannelSignatureFailureLimiterService,
  SIGNATURE_FAILURE_LIMIT_PER_MIN,
  SIGNATURE_FAILURE_WINDOW_SEC,
  makeSignatureFailureKey,
} from './chat-channel-signature-failure-limiter.service';

/**
 * 채팅 채널 인바운드의 서명 검증 실패 한도(NERV Task `CLE-T-ZC34Y0`). mock Redis 로 판정 · 기록 ·
 * fail-open 을 본다. 실제 Redis 위의 고정 창 동작은 `ChatChannelRateLimiterService` 와 같은 명령이다.
 */
describe('ChatChannelSignatureFailureLimiterService', () => {
  const TRIGGER_ID = 'trig-1';
  const IP = '203.0.113.7';
  const KEY = makeSignatureFailureKey(TRIGGER_ID, IP);

  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('키는 트리거와 IP 를 함께 담는다 — 다른 트리거의 실패가 섞이지 않는다', () => {
    expect(KEY).toBe('cc:sigfail:trig-1:203.0.113.7');
    expect(makeSignatureFailureKey('trig-2', IP)).not.toBe(KEY);
  });

  describe('isBlocked', () => {
    const limiterWith = (get: jest.Mock) =>
      new ChatChannelSignatureFailureLimiterService({ get } as never);

    it.each([
      ['기록이 없으면', null, false],
      ['한도 바로 아래면', String(SIGNATURE_FAILURE_LIMIT_PER_MIN - 1), false],
      ['한도에 닿으면', String(SIGNATURE_FAILURE_LIMIT_PER_MIN), true],
      ['한도를 넘으면', String(SIGNATURE_FAILURE_LIMIT_PER_MIN + 5), true],
      ['값이 숫자가 아니면', 'garbage', false],
    ])('%s %s → %s', async (_label, stored, expected) => {
      const get = jest.fn().mockResolvedValue(stored);

      await expect(limiterWith(get).isBlocked(TRIGGER_ID, IP)).resolves.toBe(
        expected,
      );
      expect(get).toHaveBeenCalledWith(KEY);
    });

    it('Redis 오류면 막지 않는다(fail-open)', async () => {
      const get = jest.fn().mockRejectedValue(new Error('redis down'));

      await expect(limiterWith(get).isBlocked(TRIGGER_ID, IP)).resolves.toBe(
        false,
      );
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('redis down'),
      );
    });

    it('Redis 가 없으면 막지 않는다', async () => {
      const limiter = new ChatChannelSignatureFailureLimiterService();

      await expect(limiter.isBlocked(TRIGGER_ID, IP)).resolves.toBe(false);
    });
  });

  describe('recordFailure', () => {
    function makeRedis(exec: jest.Mock) {
      const incr = jest.fn();
      const expire = jest.fn();
      const pipeline = jest.fn().mockReturnValue({ incr, expire, exec });
      return { redis: { pipeline } as never, incr, expire, pipeline };
    }

    it('INCR 과 EXPIRE(NX, 창 길이)를 한 pipeline 으로 보낸다', async () => {
      const { redis, incr, expire, pipeline } = makeRedis(
        jest.fn().mockResolvedValue([
          [null, 1],
          [null, 1],
        ]),
      );

      await new ChatChannelSignatureFailureLimiterService(redis).recordFailure(
        TRIGGER_ID,
        IP,
      );

      expect(pipeline).toHaveBeenCalledTimes(1);
      expect(incr).toHaveBeenCalledWith(KEY);
      expect(expire).toHaveBeenCalledWith(
        KEY,
        SIGNATURE_FAILURE_WINDOW_SEC,
        'NX',
      );
    });

    it.each([
      ['pipeline 이 거부되면', jest.fn().mockRejectedValue(new Error('boom'))],
      [
        'INCR 결과가 오류면',
        jest.fn().mockResolvedValue([[new Error('boom'), null]]),
      ],
    ])('%s 던지지 않고 경고만 남긴다', async (_label, exec) => {
      const { redis } = makeRedis(exec);

      await expect(
        new ChatChannelSignatureFailureLimiterService(redis).recordFailure(
          TRIGGER_ID,
          IP,
        ),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('boom'));
    });

    it('Redis 가 없으면 아무것도 하지 않는다', async () => {
      await expect(
        new ChatChannelSignatureFailureLimiterService().recordFailure(
          TRIGGER_ID,
          IP,
        ),
      ).resolves.toBeUndefined();
    });
  });
});
