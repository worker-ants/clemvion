import { Cafe24InstallRateLimitService } from './cafe24-install-rate-limit.service';

type Mock = jest.Mock;

function makeRedisMock(): Record<string, Mock> {
  return {
    get: jest.fn(),
    eval: jest.fn().mockResolvedValue(1),
    quit: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Cafe24InstallRateLimitService', () => {
  let redis: Record<string, Mock>;
  let svc: Cafe24InstallRateLimitService;

  beforeEach(() => {
    redis = makeRedisMock();
    svc = new Cafe24InstallRateLimitService(undefined, redis as never);
  });

  describe('isLockedOut', () => {
    it('no counter (GET null) → false', async () => {
      redis.get.mockResolvedValue(null);
      expect(await svc.isLockedOut('1.2.3.4')).toBe(false);
      expect(redis.get).toHaveBeenCalledWith('cafe24:install:fail:1.2.3.4');
    });

    it('below threshold → false', async () => {
      redis.get.mockResolvedValue(
        String(Cafe24InstallRateLimitService.FAIL_THRESHOLD - 1),
      );
      expect(await svc.isLockedOut('1.2.3.4')).toBe(false);
    });

    it('at threshold → true (locked out)', async () => {
      redis.get.mockResolvedValue(
        String(Cafe24InstallRateLimitService.FAIL_THRESHOLD),
      );
      expect(await svc.isLockedOut('1.2.3.4')).toBe(true);
    });

    it('above threshold → true', async () => {
      redis.get.mockResolvedValue(
        String(Cafe24InstallRateLimitService.FAIL_THRESHOLD + 5),
      );
      expect(await svc.isLockedOut('1.2.3.4')).toBe(true);
    });

    it('graceful degradation on Redis error → false (fail-open)', async () => {
      redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
      expect(await svc.isLockedOut('1.2.3.4')).toBe(false);
    });

    it('undefined ip → false without touching Redis', async () => {
      expect(await svc.isLockedOut(undefined)).toBe(false);
      expect(redis.get).not.toHaveBeenCalled();
    });

    it('no Redis configured → false (fail-open)', async () => {
      const noRedis = new Cafe24InstallRateLimitService(undefined, undefined);
      expect(await noRedis.isLockedOut('1.2.3.4')).toBe(false);
    });
  });

  describe('recordFailure', () => {
    it('atomic INCR+EXPIRE via Lua with key + window TTL', async () => {
      await svc.recordFailure('1.2.3.4');
      expect(redis.eval).toHaveBeenCalledWith(
        expect.stringContaining('INCR'),
        1,
        'cafe24:install:fail:1.2.3.4',
        String(Cafe24InstallRateLimitService.FAIL_WINDOW_SEC),
      );
    });

    it('graceful degradation on Redis error → no throw', async () => {
      redis.eval.mockRejectedValue(new Error('ECONNREFUSED'));
      await expect(svc.recordFailure('1.2.3.4')).resolves.toBeUndefined();
    });

    it('undefined ip → no-op (eval not called)', async () => {
      await svc.recordFailure(undefined);
      expect(redis.eval).not.toHaveBeenCalled();
    });

    it('no Redis configured → no-op', async () => {
      const noRedis = new Cafe24InstallRateLimitService(undefined, undefined);
      await expect(noRedis.recordFailure('1.2.3.4')).resolves.toBeUndefined();
    });
  });

  describe('constants', () => {
    it('exposes FAIL_THRESHOLD and FAIL_WINDOW_SEC matching spec §9.8', () => {
      expect(Cafe24InstallRateLimitService.FAIL_THRESHOLD).toBe(10);
      expect(Cafe24InstallRateLimitService.FAIL_WINDOW_SEC).toBe(600);
    });
  });
});
