import { Logger } from '@nestjs/common';
import {
  ChatChannelSignatureFailureLimiterService,
  RECORD_SIGNATURE_FAILURE_LUA,
  SIGNATURE_FAILURE_LIMIT_PER_MIN,
  SIGNATURE_FAILURE_WINDOW_SEC,
  makeSignatureFailureKey,
} from './chat-channel-signature-failure-limiter.service';

/**
 * 채팅 채널 인바운드의 서명 검증 실패 한도(NERV Task `CLE-T-ZC34Y0` · `CLE-T-CC3GPN`). mock Redis 로
 * 판정 · 기록 · fail-open 을 본다. 실제 Redis 위의 고정 창 동작은 e2e 가 본다.
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

  // 근거: NERV Task `CLE-T-CC3GPN`. INCR 과 TTL 을 한 Lua 스크립트로 실행해 TTL 없는 키가 남지 않게 한다.
  // 스크립트 자체의 동작(첫 실패 · TTL 이 빠진 키에 창 길이를 건다)은 실제 Redis 를 쓰는
  // `test/chat-channel-signature-failure-limit.e2e-spec.ts` 가 본다.
  describe('recordFailure', () => {
    const limiterWithEval = (evalFn: jest.Mock) =>
      new ChatChannelSignatureFailureLimiterService({ eval: evalFn } as never);

    it('INCR 과 TTL 보정을 Lua 스크립트 하나로 보낸다', async () => {
      const evalFn = jest.fn().mockResolvedValue(1);

      await limiterWithEval(evalFn).recordFailure(TRIGGER_ID, IP);

      expect(evalFn).toHaveBeenCalledTimes(1);
      expect(evalFn).toHaveBeenCalledWith(
        RECORD_SIGNATURE_FAILURE_LUA,
        1,
        KEY,
        String(SIGNATURE_FAILURE_WINDOW_SEC),
      );
    });

    it('스크립트는 첫 실패이거나 TTL 이 없는 키에만 창 길이를 건다', () => {
      expect(RECORD_SIGNATURE_FAILURE_LUA).toMatch(
        /redis\.call\('INCR', KEYS\[1\]\)/,
      );
      expect(RECORD_SIGNATURE_FAILURE_LUA).toMatch(
        /c == 1 or redis\.call\('TTL', KEYS\[1\]\) == -1/,
      );
      expect(RECORD_SIGNATURE_FAILURE_LUA).toMatch(
        /redis\.call\('EXPIRE', KEYS\[1\], ARGV\[1\]\)/,
      );
    });

    it('한도에 닿은 실패에서만 경고를 한 번 남긴다', async () => {
      const evalFn = jest
        .fn()
        .mockResolvedValueOnce(SIGNATURE_FAILURE_LIMIT_PER_MIN - 1)
        .mockResolvedValueOnce(SIGNATURE_FAILURE_LIMIT_PER_MIN)
        .mockResolvedValueOnce(SIGNATURE_FAILURE_LIMIT_PER_MIN + 1);
      const limiter = limiterWithEval(evalFn);

      for (let i = 0; i < 3; i += 1) {
        await limiter.recordFailure(TRIGGER_ID, IP);
      }

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(`trigger=${TRIGGER_ID}`),
      );
      // IP 는 로그에 남기지 않는다.
      expect(warnSpy).not.toHaveBeenCalledWith(expect.stringContaining(IP));
    });

    it('Redis 오류면 던지지 않고 경고만 남긴다(fail-open)', async () => {
      const evalFn = jest.fn().mockRejectedValue(new Error('boom'));

      await expect(
        limiterWithEval(evalFn).recordFailure(TRIGGER_ID, IP),
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
