import { Logger } from '@nestjs/common';
import {
  PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN,
  PASSWORD_RECHECK_FAILURE_WINDOW_SEC,
  PasswordRecheckFailureLimiterService,
  RECORD_PASSWORD_RECHECK_FAILURE_LUA,
  makePasswordRecheckFailureKey,
} from './password-recheck-failure-limiter.service';

/**
 * 비밀번호 재확인 실패의 사용자 단위 한도(NERV Task `CLE-T-CJ7HB1`). mock Redis 로 판정 · 기록 · fail-open 을 본다.
 * 실제 Redis 위에서 라우트 여럿이 한 카운터를 함께 쓰는지는 e2e(`password-recheck-shared-limit.e2e-spec.ts`)가 본다.
 */
describe('PasswordRecheckFailureLimiterService', () => {
  const USER_ID = 'user-1';
  const KEY = makePasswordRecheckFailureKey(USER_ID);

  let warnSpy: jest.SpyInstance;
  beforeEach(() => {
    warnSpy = jest
      .spyOn(Logger.prototype, 'warn')
      .mockImplementation(() => undefined);
  });
  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('키는 사용자 하나에 하나다 — 라우트를 담지 않아 어느 라우트의 실패든 같은 키를 센다', () => {
    expect(KEY).toBe('auth:password-recheck-failures:user-1');
    expect(makePasswordRecheckFailureKey('user-2')).not.toBe(KEY);
  });

  it('한도는 라우트별 민감 tier 와 같은 분당 10회다', () => {
    expect(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN).toBe(10);
    expect(PASSWORD_RECHECK_FAILURE_WINDOW_SEC).toBe(60);
  });

  describe('isBlocked', () => {
    const limiterWith = (get: jest.Mock) =>
      new PasswordRecheckFailureLimiterService({ get } as never);

    it.each([
      ['기록이 없으면', null, false],
      [
        '한도 바로 아래면',
        String(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN - 1),
        false,
      ],
      ['한도에 닿으면', String(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN), true],
      [
        '한도를 넘으면',
        String(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN + 3),
        true,
      ],
      ['값이 숫자가 아니면', 'garbage', false],
    ])('%s %s → %s', async (_label, stored, expected) => {
      const get = jest.fn().mockResolvedValue(stored);

      await expect(limiterWith(get).isBlocked(USER_ID)).resolves.toBe(expected);
      expect(get).toHaveBeenCalledWith(KEY);
    });

    it('Redis 오류면 막지 않는다(fail-open)', async () => {
      const get = jest.fn().mockRejectedValue(new Error('redis down'));

      await expect(limiterWith(get).isBlocked(USER_ID)).resolves.toBe(false);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
    });

    it('Redis 가 없으면 막지 않는다', async () => {
      await expect(
        new PasswordRecheckFailureLimiterService().isBlocked(USER_ID),
      ).resolves.toBe(false);
    });
  });

  describe('recordFailure', () => {
    const limiterWith = (evalFn: jest.Mock) =>
      new PasswordRecheckFailureLimiterService({ eval: evalFn } as never);

    it('사용자 키 하나를 창 길이 TTL 로 센다', async () => {
      const evalFn = jest.fn().mockResolvedValue(1);

      await limiterWith(evalFn).recordFailure(USER_ID);

      expect(evalFn).toHaveBeenCalledWith(
        RECORD_PASSWORD_RECHECK_FAILURE_LUA,
        1,
        KEY,
        String(PASSWORD_RECHECK_FAILURE_WINDOW_SEC),
      );
      expect(warnSpy).not.toHaveBeenCalled();
    });

    it('이 실패로 한도에 닿으면 경고 로그를 한 번 남긴다', async () => {
      const evalFn = jest
        .fn()
        .mockResolvedValueOnce(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN)
        .mockResolvedValueOnce(PASSWORD_RECHECK_FAILURE_LIMIT_PER_MIN + 1);
      const limiter = limiterWith(evalFn);

      await limiter.recordFailure(USER_ID);
      await limiter.recordFailure(USER_ID);

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('한도'));
    });

    it('Redis 오류는 삼킨다', async () => {
      const evalFn = jest.fn().mockRejectedValue(new Error('redis down'));

      await expect(
        limiterWith(evalFn).recordFailure(USER_ID),
      ).resolves.toBeUndefined();
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('fail-open'),
      );
    });

    it('Redis 가 없으면 아무것도 하지 않는다', async () => {
      await expect(
        new PasswordRecheckFailureLimiterService().recordFailure(USER_ID),
      ).resolves.toBeUndefined();
    });
  });

  it('Lua 스크립트는 첫 실패이거나 TTL 이 없을 때만 창 길이 TTL 을 건다', () => {
    expect(RECORD_PASSWORD_RECHECK_FAILURE_LUA).toContain("redis.call('INCR'");
    expect(RECORD_PASSWORD_RECHECK_FAILURE_LUA).toContain(
      "c == 1 or redis.call('TTL', KEYS[1]) == -1",
    );
  });
});
