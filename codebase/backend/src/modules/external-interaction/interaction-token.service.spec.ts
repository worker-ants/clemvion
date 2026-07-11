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

  describe('reconcileTerminalRevocations — at-least-once sweep [Spec EIA §3.4 EIA-RL-06 / R15]', () => {
    function makeQB(rows: Array<{ executionId: string }>) {
      const qb: Record<string, Mock> = {};
      ['innerJoin', 'where', 'select', 'distinct', 'limit'].forEach((m) => {
        qb[m] = jest.fn().mockReturnValue(qb);
      });
      qb.getRawMany = jest.fn().mockResolvedValue(rows);
      return qb;
    }

    function makeService(repo: Record<string, unknown>) {
      const config = {
        get: jest.fn((key: string) =>
          key === 'interaction.jwtSecret' ? TEST_SECRET : undefined,
        ),
      };
      return new InteractionTokenService(
        config as never,
        redis as never,
        repo as never,
      );
    }

    it('Repository 미주입 → no-op (swept:0)', async () => {
      const result = await service.reconcileTerminalRevocations();
      expect(result).toEqual({ swept: 0, revoked: 0 });
    });

    it('terminal execution 의 잔존 토큰을 execution 별로 회수 (revokeAllForExecution 재사용)', async () => {
      redis.set.mockResolvedValue('OK');
      const qb = makeQB([{ executionId: 'exec-1' }, { executionId: 'exec-2' }]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest
          .fn()
          .mockResolvedValue([
            { jti: 'j1', expAt: new Date(Date.now() + 60_000) },
          ]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const svc = makeService(repo);

      const result = await svc.reconcileTerminalRevocations();

      // terminal status (completed/failed/cancelled) 만 sweep 대상
      expect(qb.where).toHaveBeenCalledWith(
        'e.status IN (:...terminal)',
        expect.objectContaining({
          terminal: expect.arrayContaining([
            'completed',
            'failed',
            'cancelled',
          ]),
        }),
      );
      expect(result.swept).toBe(2);
      expect(result.revoked).toBe(2); // execution 당 jti 1건
      expect(repo.find).toHaveBeenCalledTimes(2);
      expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' });
      expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-2' });
      // distinct executionId 만 + 기본 batchLimit(500) clamp
      expect(qb.select).toHaveBeenCalledWith('et.executionId', 'executionId');
      expect(qb.distinct).toHaveBeenCalledWith(true);
      expect(qb.limit).toHaveBeenCalledWith(500);
    });

    it('batchLimit 은 [1, 1000] 으로 clamp — 과대 입력 방어', async () => {
      const qb = makeQB([]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest.fn(),
        delete: jest.fn(),
      };
      await makeService(repo).reconcileTerminalRevocations(999_999);
      expect(qb.limit).toHaveBeenCalledWith(1000);
    });

    it('batchLimit 하한 — 0/음수는 1 로 clamp', async () => {
      const qb = makeQB([]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest.fn(),
        delete: jest.fn(),
      };
      await makeService(repo).reconcileTerminalRevocations(0);
      expect(qb.limit).toHaveBeenCalledWith(1);
    });

    it('RECONCILE_CONCURRENCY(20) 초과 — 다중 청크 전부 처리·집계 정확', async () => {
      redis.set.mockResolvedValue('OK');
      const rows = Array.from({ length: 25 }, (_, i) => ({
        executionId: `exec-${i}`,
      }));
      const qb = makeQB(rows);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest
          .fn()
          .mockResolvedValue([
            { jti: 'j', expAt: new Date(Date.now() + 60_000) },
          ]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const result = await makeService(repo).reconcileTerminalRevocations();
      // 25건 = 청크(20) + 청크(5) 모두 처리 — 집계가 청크 경계에서 누락되지 않음
      expect(result.swept).toBe(25);
      expect(result.revoked).toBe(25);
      expect(repo.find).toHaveBeenCalledTimes(25);
    });

    it('이미 만료된 jti(ttl<=0)는 revoked 에 미집계 — revokeAll 위임 결과 반영', async () => {
      redis.set.mockResolvedValue('OK');
      const qb = makeQB([{ executionId: 'exec-1' }]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest
          .fn()
          .mockResolvedValue([
            { jti: 'expired', expAt: new Date(Date.now() - 1000) },
          ]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const result = await makeService(repo).reconcileTerminalRevocations();
      expect(result.swept).toBe(1);
      expect(result.revoked).toBe(0); // 만료된 jti 는 blacklist SET skip
      expect(redis.set).not.toHaveBeenCalled();
      // 만료 토큰이라도 execution_token row 는 정리한다 (sweep 재진입 회피)
      expect(repo.delete).toHaveBeenCalledWith({ executionId: 'exec-1' });
    });

    it('잔존 토큰 없음 → swept:0, revokeAll 미호출', async () => {
      const qb = makeQB([]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest.fn(),
        delete: jest.fn(),
      };
      const result = await makeService(repo).reconcileTerminalRevocations();
      expect(result).toEqual({ swept: 0, revoked: 0 });
      expect(repo.find).not.toHaveBeenCalled();
    });

    it('한 execution revoke 실패해도 다음 execution 계속 (fail-open)', async () => {
      redis.set.mockResolvedValue('OK');
      const qb = makeQB([{ executionId: 'bad' }, { executionId: 'good' }]);
      const repo = {
        createQueryBuilder: jest.fn().mockReturnValue(qb),
        find: jest
          .fn()
          .mockRejectedValueOnce(new Error('db blip'))
          .mockResolvedValueOnce([
            { jti: 'jg', expAt: new Date(Date.now() + 60_000) },
          ]),
        delete: jest.fn().mockResolvedValue({ affected: 1 }),
      };
      const result = await makeService(repo).reconcileTerminalRevocations();
      expect(result.swept).toBe(2);
      expect(result.revoked).toBe(1); // good 만 성공, bad 는 fail-open skip
    });
  });

  describe('findIdleWebchatExecutionIds — idle-wait 회수 대상 조회 [Spec EIA §3.4 EIA-RL-07 / §R19]', () => {
    function makeQB(rows: Array<{ executionId: string }>) {
      const qb: Record<string, Mock> = {};
      [
        'innerJoin',
        'where',
        'andWhere',
        'groupBy',
        'having',
        'select',
        'limit',
      ].forEach((m) => {
        qb[m] = jest.fn().mockReturnValue(qb);
      });
      qb.getRawMany = jest.fn().mockResolvedValue(rows);
      return qb;
    }

    function makeService(repo: Record<string, unknown>) {
      const config = {
        get: jest.fn((key: string) =>
          key === 'interaction.jwtSecret' ? TEST_SECRET : undefined,
        ),
      };
      return new InteractionTokenService(
        config as never,
        redis as never,
        repo as never,
      );
    }

    it('Repository 미주입 → 빈 배열', async () => {
      // 3번째 인자(executionTokenRepository) 미주입.
      const config = {
        get: jest.fn(() => TEST_SECRET),
      };
      const svc = new InteractionTokenService(
        config as never,
        redis as never,
        undefined as never,
      );
      expect(await svc.findIdleWebchatExecutionIds(1000)).toEqual([]);
    });

    it('waiting + auth_config_id IS NULL + MAX(exp_at)<threshold 로 executionId 조회', async () => {
      const qb = makeQB([{ executionId: 'e1' }, { executionId: 'e2' }]);
      const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };

      const ids = await makeService(repo).findIdleWebchatExecutionIds(3600000);

      expect(ids).toEqual(['e1', 'e2']);
      // 조건 3종 배선 확인.
      expect(qb.innerJoin).toHaveBeenCalledWith('et.execution', 'e');
      expect(qb.innerJoin).toHaveBeenCalledWith('e.trigger', 't');
      expect(qb.where).toHaveBeenCalledWith(
        'e.status = :waiting',
        expect.objectContaining({ waiting: 'waiting_for_input' }),
      );
      expect(qb.andWhere).toHaveBeenCalledWith('t.authConfigId IS NULL');
      expect(qb.having).toHaveBeenCalledWith(
        'MAX(et.expAt) < :threshold',
        expect.objectContaining({ threshold: expect.any(Date) }),
      );
    });

    it('batchLimit 은 [1, 1000] 로 clamp', async () => {
      const qb = makeQB([]);
      const repo = { createQueryBuilder: jest.fn().mockReturnValue(qb) };
      await makeService(repo).findIdleWebchatExecutionIds(1000, 99999);
      expect(qb.limit).toHaveBeenCalledWith(1000);
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

  // PR-B2a follow-up (W1 hardening) — secret 미설정 fail-closed (prod). OAUTH/LLM
  // STUB_MODE 부팅 가드 패턴. dev/test 는 비보안 fallback 유지.
  describe('constructor — secret 미설정 시 prod fail-closed', () => {
    const OLD_ENV = process.env.NODE_ENV;
    const OLD_INT = process.env.INTERACTION_JWT_SECRET;
    const OLD_JWT = process.env.JWT_SECRET;
    const noSecretConfig = { get: jest.fn(() => undefined) };
    afterEach(() => {
      process.env.NODE_ENV = OLD_ENV;
      if (OLD_INT === undefined) delete process.env.INTERACTION_JWT_SECRET;
      else process.env.INTERACTION_JWT_SECRET = OLD_INT;
      if (OLD_JWT === undefined) delete process.env.JWT_SECRET;
      else process.env.JWT_SECRET = OLD_JWT;
    });

    it('NODE_ENV=production + secret 전무 → 생성자 throw (fail-closed)', () => {
      delete process.env.INTERACTION_JWT_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'production';
      expect(
        () =>
          new InteractionTokenService(
            noSecretConfig as never,
            undefined as never,
          ),
      ).toThrow(/NODE_ENV=production/);
    });

    it('NODE_ENV!=production + secret 전무 → throw 안 함 (dev fallback)', () => {
      delete process.env.INTERACTION_JWT_SECRET;
      delete process.env.JWT_SECRET;
      process.env.NODE_ENV = 'test';
      expect(
        () =>
          new InteractionTokenService(
            noSecretConfig as never,
            undefined as never,
          ),
      ).not.toThrow();
    });
  });
});

// refactor M-6 (review W1) — raw process.env fallback 제거 후 핵심 계약:
// interaction.jwtSecret 미설정 시 jwt.secret(=JWT_SECRET) 으로 fallback 함을 고정.
describe('InteractionTokenService — secret fallback chain (refactor M-6)', () => {
  it('interaction.jwtSecret 미설정 → jwt.secret 으로 서명/검증 round-trip', async () => {
    const FALLBACK = 'jwt-fallback-secret-long-enough-32bytes-xx';
    const config = {
      get: jest.fn((key: string) =>
        key === 'jwt.secret' ? FALLBACK : undefined,
      ),
    };
    const redis = makeRedisMock();
    const svc = new InteractionTokenService(config as never, redis as never);

    const { token } = await svc.issuePerExecution('exec-fb');
    const result = await svc.verifyPerExecution(token);

    expect(result.valid).toBe(true);
    expect(result.executionId).toBe('exec-fb');
    // interaction.jwtSecret 를 먼저 조회한 뒤 jwt.secret 으로 fallback 한 체인을 확인.
    expect(config.get).toHaveBeenCalledWith('interaction.jwtSecret');
    expect(config.get).toHaveBeenCalledWith('jwt.secret');
  });

  // review I17: interaction.jwtSecret 가 설정되면 그 값을 우선하고 jwt.secret 은 조회조차 안 함(`??` 단락).
  it('interaction.jwtSecret 설정 시 우선 사용하고 jwt.secret 은 조회하지 않는다', async () => {
    const PRIMARY = 'interaction-primary-secret-long-enough-32b';
    const config = {
      get: jest.fn((key: string) =>
        key === 'interaction.jwtSecret' ? PRIMARY : 'SHOULD-NOT-BE-USED',
      ),
    };
    const redis = makeRedisMock();
    const svc = new InteractionTokenService(config as never, redis as never);

    const { token } = await svc.issuePerExecution('exec-primary');
    const result = await svc.verifyPerExecution(token);

    expect(result.valid).toBe(true);
    expect(config.get).toHaveBeenCalledWith('interaction.jwtSecret');
    // `??` 단락 평가: 좌측이 truthy 라 jwt.secret 은 조회되지 않아야 한다.
    expect(config.get).not.toHaveBeenCalledWith('jwt.secret');
  });
});
