import {
  InteractionTokenService,
  IEXT_PREFIX,
  ITK_PREFIX,
  INTERACTION_TOKEN_AUDIENCE,
} from './interaction-token.service';
import { sign } from 'jsonwebtoken';

type Mock = jest.Mock;

function makeRedisMock(): Record<string, Mock> {
  return {
    get: jest.fn(),
    set: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  };
}

const TEST_SECRET = 'unit-test-secret-must-be-long-enough-32b';

function makeService(redis?: Record<string, Mock>) {
  // ConfigService 형식의 최소 mock — interaction.jwtSecret 만 반환.
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'interaction.jwtSecret') return TEST_SECRET;
      if (key === 'redis.host') return undefined; // 직접 주입 redis 사용 강제
      return undefined;
    }),
  };
  return new InteractionTokenService(config as never, redis as never);
}

describe('InteractionTokenService — iext_* (per_execution)', () => {
  let redis: Record<string, Mock>;
  let service: InteractionTokenService;

  beforeEach(() => {
    redis = makeRedisMock();
    service = makeService(redis);
  });

  it('issuePerExecution — iext_ prefix + valid JWT + expiresAt 1h default', async () => {
    const before = Date.now();
    const result = await service.issuePerExecution('exec-1');
    const after = Date.now();
    expect(result.token).toMatch(new RegExp(`^${IEXT_PREFIX}`));
    expect(result.jti).toMatch(/^[a-f0-9]{32}$/);
    const expMs = Date.parse(result.expiresAt);
    expect(expMs - before).toBeGreaterThanOrEqual(60 * 60 * 1000 - 1000);
    expect(expMs - after).toBeLessThanOrEqual(60 * 60 * 1000 + 1000);
  });

  it('issuePerExecution — ttlSec 옵션으로 짧은 토큰 발급', async () => {
    const result = await service.issuePerExecution('exec-1', { ttlSec: 60 });
    const expMs = Date.parse(result.expiresAt);
    expect(expMs - Date.now()).toBeLessThanOrEqual(61 * 1000);
  });

  it('issuePerExecution — executionId 누락 시 reject', async () => {
    await expect(service.issuePerExecution('')).rejects.toThrow();
  });

  it('verifyPerExecution — 발급한 토큰을 자기 호출에서 valid 로 검증', async () => {
    redis.get.mockResolvedValue(null);
    const { token, jti } = await service.issuePerExecution('exec-A');
    const v = await service.verifyPerExecution(token);
    expect(v.valid).toBe(true);
    expect(v.executionId).toBe('exec-A');
    expect(v.jti).toBe(jti);
  });

  it('verifyPerExecution — expectedExecutionId 매칭 검증', async () => {
    redis.get.mockResolvedValue(null);
    const { token } = await service.issuePerExecution('exec-A');
    const ok = await service.verifyPerExecution(token, 'exec-A');
    expect(ok.valid).toBe(true);
    const mismatch = await service.verifyPerExecution(token, 'exec-OTHER');
    expect(mismatch.valid).toBe(false);
    expect(mismatch.reason).toBe('scope_mismatch');
  });

  it('verifyPerExecution — prefix 누락 / 빈 문자열 → malformed', async () => {
    const r1 = await service.verifyPerExecution('not-a-token');
    expect(r1).toEqual({ valid: false, reason: 'malformed' });
    const r2 = await service.verifyPerExecution('');
    expect(r2.valid).toBe(false);
  });

  it('verifyPerExecution — 위조 서명 / 잘못된 secret → malformed', async () => {
    const bogus = `${IEXT_PREFIX}${sign({ sub: 'exec-X', aud: INTERACTION_TOKEN_AUDIENCE, jti: 'x' }, 'wrong-secret', { algorithm: 'HS256', expiresIn: 60 })}`;
    const v = await service.verifyPerExecution(bogus);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('malformed');
  });

  it('verifyPerExecution — audience 다르면 audience_mismatch', async () => {
    const wrongAud = `${IEXT_PREFIX}${sign({ sub: 'exec-X', aud: 'wrong-aud', jti: 'x' }, TEST_SECRET, { algorithm: 'HS256', expiresIn: 60 })}`;
    const v = await service.verifyPerExecution(wrongAud);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('audience_mismatch');
  });

  it('verifyPerExecution — 만료된 토큰 → expired', async () => {
    const expired = `${IEXT_PREFIX}${sign({ sub: 'exec-X', aud: INTERACTION_TOKEN_AUDIENCE, jti: 'x' }, TEST_SECRET, { algorithm: 'HS256', expiresIn: -1 })}`;
    const v = await service.verifyPerExecution(expired);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('expired');
  });

  it('verifyPerExecution — Redis 에 jti blacklist 등재되어 있으면 blacklisted', async () => {
    redis.get.mockResolvedValue('1');
    const { token } = await service.issuePerExecution('exec-A');
    const v = await service.verifyPerExecution(token);
    expect(v.valid).toBe(false);
    expect(v.reason).toBe('blacklisted');
    expect(redis.get).toHaveBeenCalledWith(
      expect.stringContaining('iext:blacklist:'),
    );
  });

  it('verifyPerExecution — Redis 없으면 fail-open (blacklist 검사 skip)', async () => {
    const noRedis = makeService(undefined);
    const { token } = await noRedis.issuePerExecution('exec-A');
    const v = await noRedis.verifyPerExecution(token);
    expect(v.valid).toBe(true);
  });

  it('verifyPerExecution — Redis 가 throw 해도 fail-open (시스템 가용성 우선)', async () => {
    redis.get.mockRejectedValue(new Error('ECONNREFUSED'));
    const { token } = await service.issuePerExecution('exec-A');
    const v = await service.verifyPerExecution(token);
    expect(v.valid).toBe(true);
  });

  it('revokePerExecution — Redis SET EX 호출', async () => {
    redis.set.mockResolvedValue('OK');
    await service.revokePerExecution('jti-1', 1800);
    expect(redis.set).toHaveBeenCalledWith(
      'iext:blacklist:jti-1',
      '1',
      'EX',
      1800,
    );
  });

  it('revokePerExecution — Redis 없으면 no-op (warn 만)', async () => {
    const noRedis = makeService(undefined);
    await expect(
      noRedis.revokePerExecution('jti-X', 60),
    ).resolves.toBeUndefined();
  });

  it('revokePerExecution — ttl<=0 면 최소 1초 보장 (Redis ttl 무효 입력 차단)', async () => {
    redis.set.mockResolvedValue('OK');
    await service.revokePerExecution('jti-2', -5);
    expect(redis.set).toHaveBeenCalledWith(
      'iext:blacklist:jti-2',
      '1',
      'EX',
      1,
    );
  });

  describe('refreshPerExecution', () => {
    it('만료 30분 이내 토큰 → 신규 발급 + 기존 jti blacklist', async () => {
      redis.get.mockResolvedValue(null);
      redis.set.mockResolvedValue('OK');
      // 만료까지 600초 남은 토큰
      const { token: oldToken, jti: oldJti } = await service.issuePerExecution(
        'exec-A',
        { ttlSec: 600 },
      );
      const result = await service.refreshPerExecution(oldToken);
      if ('valid' in result && result.valid === false) {
        throw new Error('expected fresh token');
      }
      expect(result.token).toMatch(new RegExp(`^${IEXT_PREFIX}`));
      expect(result.jti).not.toBe(oldJti);
      // 기존 jti 가 blacklist 된 호출 확인
      expect(redis.set).toHaveBeenCalledWith(
        `iext:blacklist:${oldJti}`,
        '1',
        'EX',
        expect.any(Number),
      );
    });

    it('만료 30분 초과 토큰 → not_in_window 거부', async () => {
      redis.get.mockResolvedValue(null);
      // 50분 남은 토큰
      const { token } = await service.issuePerExecution('exec-A', {
        ttlSec: 3000,
      });
      const result = await service.refreshPerExecution(token);
      expect(result).toMatchObject({ valid: false, reason: 'not_in_window' });
    });

    it('만료된 토큰 → expired', async () => {
      const expired = `${IEXT_PREFIX}${sign({ sub: 'exec-X', aud: INTERACTION_TOKEN_AUDIENCE, jti: 'x' }, TEST_SECRET, { algorithm: 'HS256', expiresIn: -1 })}`;
      const result = await service.refreshPerExecution(expired);
      expect(result).toMatchObject({ valid: false, reason: 'expired' });
    });

    it('blacklisted 토큰 → blacklisted', async () => {
      redis.get.mockResolvedValue('1');
      const { token } = await service.issuePerExecution('exec-A', {
        ttlSec: 600,
      });
      const result = await service.refreshPerExecution(token);
      expect(result).toMatchObject({ valid: false, reason: 'blacklisted' });
    });
  });

  describe('revokeAllForExecution — JTI tracking [Spec EIA §3.3 EIA-AU-04]', () => {
    function makeServiceWithRepo(repo: {
      find: Mock;
      insert: Mock;
      delete: Mock;
    }) {
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'interaction.jwtSecret') return TEST_SECRET;
          if (key === 'redis.host') return undefined;
          return undefined;
        }),
      };
      return new InteractionTokenService(
        config as never,
        redis as never,
        repo as never,
      );
    }

    it('Repository 미주입 → no-op + revoked:0', async () => {
      const result = await service.revokeAllForExecution('exec-1');
      expect(result.revoked).toBe(0);
    });

    it('jti 없으면 revoked:0 — DELETE 도 skip (terminal event 마다 호출되므로 불필요 쿼리 회피)', async () => {
      const repo = {
        find: jest.fn().mockResolvedValue([]),
        insert: jest.fn(),
        delete: jest.fn().mockResolvedValue({ affected: 0 }),
      };
      const svc = makeServiceWithRepo(repo);
      const result = await svc.revokeAllForExecution('exec-1');
      expect(result.revoked).toBe(0);
      // 발급된 jti 0건이면 단일 find 후 early-return — DELETE 미호출.
      expect(repo.delete).not.toHaveBeenCalled();
    });

    it('만료된 jti 는 Redis 등재 skip — ttl > 0 인 것만 blacklist', async () => {
      redis.set.mockResolvedValue('OK');
      const now = Date.now();
      const repo = {
        find: jest.fn().mockResolvedValue([
          { jti: 'expired-jti', expAt: new Date(now - 1000) }, // 이미 만료
          { jti: 'alive-jti', expAt: new Date(now + 60_000) }, // 60s 남음
        ]),
        insert: jest.fn(),
        delete: jest.fn().mockResolvedValue({ affected: 2 }),
      };
      const svc = makeServiceWithRepo(repo);
      const result = await svc.revokeAllForExecution('exec-1');
      expect(result.revoked).toBe(1);
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(
        'iext:blacklist:alive-jti',
        '1',
        'EX',
        expect.any(Number),
      );
      expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' });
    });

    it('Repository delete throw 해도 fail-open (warn 만)', async () => {
      redis.set.mockResolvedValue('OK');
      const repo = {
        find: jest
          .fn()
          .mockResolvedValue([
            { jti: 'j1', expAt: new Date(Date.now() + 60_000) },
          ]),
        insert: jest.fn(),
        delete: jest.fn().mockRejectedValue(new Error('db down')),
      };
      const svc = makeServiceWithRepo(repo);
      // throw 가 아니라 정상 return (revoked 는 1)
      const result = await svc.revokeAllForExecution('exec-1');
      expect(result.revoked).toBe(1);
    });
  });

  describe('issuePerExecution — execution_token INSERT [JTI tracking]', () => {
    it('Repository 주입 시 INSERT 호출 (jti + executionId + expAt)', async () => {
      const repo = {
        find: jest.fn(),
        insert: jest.fn().mockResolvedValue({ identifiers: [] }),
        delete: jest.fn(),
      };
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'interaction.jwtSecret') return TEST_SECRET;
          if (key === 'redis.host') return undefined;
          return undefined;
        }),
      };
      const svc = new InteractionTokenService(
        config as never,
        redis as never,
        repo as never,
      );
      const result = await svc.issuePerExecution('exec-X', { ttlSec: 60 });
      expect(repo.insert).toHaveBeenCalledWith({
        jti: result.jti,
        executionId: 'exec-X',
        expAt: expect.any(Date),
      });
    });

    it('Repository insert throw → fail-open (warn, 토큰은 정상 반환)', async () => {
      const repo = {
        find: jest.fn(),
        insert: jest.fn().mockRejectedValue(new Error('db locked')),
        delete: jest.fn(),
      };
      const config = {
        get: jest.fn((key: string) => {
          if (key === 'interaction.jwtSecret') return TEST_SECRET;
          if (key === 'redis.host') return undefined;
          return undefined;
        }),
      };
      const svc = new InteractionTokenService(
        config as never,
        redis as never,
        repo as never,
      );
      const result = await svc.issuePerExecution('exec-X');
      expect(result.token).toMatch(new RegExp(`^${IEXT_PREFIX}`));
    });
  });

  describe('RedisConnectionProvider 공유 경로 (W-5)', () => {
    // injectedRedis (2번째 인자) 없이 redisConn (4번째 인자) 만으로 blacklist
    // 검사가 공유 provider 경로를 타는지 검증한다.
    function makeConfig() {
      return {
        get: jest.fn((key: string) => {
          if (key === 'interaction.jwtSecret') return TEST_SECRET;
          if (key === 'redis.host') return undefined;
          return undefined;
        }),
      };
    }
    function makeRedisConn(client: unknown) {
      return {
        getClient: () => client,
        getClientOrNull: () => client,
      };
    }

    it('redisConn 주입 시 blacklist GET 이 공유 client 로 수행된다', async () => {
      const sharedRedis = makeRedisMock();
      sharedRedis.get.mockResolvedValue('1'); // blacklisted
      const svc = new InteractionTokenService(
        makeConfig() as never,
        undefined, // injectedRedis 없음 — 공유 provider 경로 강제
        undefined,
        makeRedisConn(sharedRedis) as never,
      );
      const { token } = await svc.issuePerExecution('exec-shared');
      const v = await svc.verifyPerExecution(token);
      expect(v.valid).toBe(false);
      expect(v.reason).toBe('blacklisted');
      expect(sharedRedis.get).toHaveBeenCalledWith(
        expect.stringContaining('iext:blacklist:'),
      );
    });

    it('redisConn 이 null 반환(공유 미가용) → blacklist 검사 skip (fail-open valid)', async () => {
      const svc = new InteractionTokenService(
        makeConfig() as never,
        undefined,
        undefined,
        makeRedisConn(null) as never,
      );
      const { token } = await svc.issuePerExecution('exec-nored');
      const v = await svc.verifyPerExecution(token);
      expect(v.valid).toBe(true);
    });
  });
});

describe('InteractionTokenService — itk_* (per_trigger)', () => {
  let service: InteractionTokenService;
  beforeEach(() => {
    service = makeService();
  });

  it('issuePerTrigger — itk_ prefix + random 32 bytes hex', () => {
    const a = service.issuePerTrigger();
    const b = service.issuePerTrigger();
    expect(a).toMatch(new RegExp(`^${ITK_PREFIX}[a-f0-9]{64}$`));
    expect(b).toMatch(new RegExp(`^${ITK_PREFIX}[a-f0-9]{64}$`));
    expect(a).not.toBe(b);
  });

  it('verifyPerTrigger — 동일 토큰 timing-safe 통과', () => {
    const t = service.issuePerTrigger();
    expect(service.verifyPerTrigger(t, t)).toBe(true);
  });

  it('verifyPerTrigger — 다른 토큰 실패', () => {
    const a = service.issuePerTrigger();
    const b = service.issuePerTrigger();
    expect(service.verifyPerTrigger(a, b)).toBe(false);
  });

  it('verifyPerTrigger — prefix 미일치 / 비-문자열 false', () => {
    expect(service.verifyPerTrigger('random', 'random')).toBe(false);
    expect(service.verifyPerTrigger('iext_abc', 'iext_abc')).toBe(false);
    expect(service.verifyPerTrigger(123 as never, 'itk_abc')).toBe(false);
    expect(service.verifyPerTrigger('itk_abc', undefined as never)).toBe(false);
  });

  it('verifyPerTrigger — 길이 다른 두 토큰 — hash 비교로 통일되어 timing leak 없음', () => {
    const short = `${ITK_PREFIX}abc`;
    const long = `${ITK_PREFIX}${'a'.repeat(64)}`;
    expect(service.verifyPerTrigger(short, long)).toBe(false);
  });
});
