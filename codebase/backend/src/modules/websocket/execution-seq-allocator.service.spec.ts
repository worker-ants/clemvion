import { ExecutionSeqAllocator } from './execution-seq-allocator.service';

/**
 * ExecutionSeqAllocator 단위 테스트.
 *
 * execution 별 monotonic seq 발급의 두 경로를 검증한다:
 *  - Redis 정상: `INCR exec:seq:<id>` 단조 증가 + sliding TTL EXPIRE
 *  - Redis 장애: in-memory per-instance degraded fallback (logged, best-effort monotonic)
 *
 * Redis client 는 lazy `getClient()` 가 만든다. 본 테스트는 그 팩토리를 stub 으로
 * 주입해 ioredis 실연결 없이 INCR/EXPIRE/DEL 의 호출과 fallback 분기를 검증한다.
 */
describe('ExecutionSeqAllocator', () => {
  // configService stub — redis.host/port 등 존재 가정.
  function makeConfig(values: Record<string, unknown> = {}): {
    get: jest.Mock;
  } {
    const defaults: Record<string, unknown> = {
      'redis.host': 'localhost',
      'redis.port': 6379,
    };
    return {
      get: jest.fn((key: string) => values[key] ?? defaults[key]),
    };
  }

  type FakeRedis = {
    incr: jest.Mock;
    expire: jest.Mock;
    del: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
  };

  function makeRedis(overrides: Partial<FakeRedis> = {}): FakeRedis {
    const store = new Map<string, number>();
    return {
      incr: jest.fn(async (key: string) => {
        const n = (store.get(key) ?? 0) + 1;
        store.set(key, n);
        return n;
      }),
      expire: jest.fn(async () => 1),
      del: jest.fn(async () => 1),
      quit: jest.fn(async () => 'OK'),
      on: jest.fn(),
      ...overrides,
    };
  }

  /**
   * allocator 를 만들고, 내부 lazy getClient 를 주어진 redis stub 으로 치환한다.
   * getClient 는 private 이므로 인스턴스 메서드를 직접 monkey-patch.
   */
  function makeAllocator(
    redis: FakeRedis | null,
    config = makeConfig(),
  ): ExecutionSeqAllocator {
    const alloc = new ExecutionSeqAllocator(config as never);
    // private getClient 치환 — redis 가 null 이면 throw 로 장애 시뮬레이션.
    (alloc as unknown as { getClient: () => unknown }).getClient = () => {
      if (!redis) throw new Error('Redis unavailable (test)');
      return redis;
    };
    return alloc;
  }

  describe('Redis 정상 경로', () => {
    it('next() 가 첫 호출 시 1, 같은 execution 은 1,2,3 단조 증가', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      expect(await alloc.next('exec-1')).toBe(1);
      expect(await alloc.next('exec-1')).toBe(2);
      expect(await alloc.next('exec-1')).toBe(3);
      expect(redis.incr).toHaveBeenCalledWith('exec:seq:exec-1');
    });

    it('서로 다른 execution 은 독립 counter', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      expect(await alloc.next('exec-A')).toBe(1);
      expect(await alloc.next('exec-B')).toBe(1);
      expect(await alloc.next('exec-A')).toBe(2);
    });

    it('매 next() 가 sliding TTL EXPIRE 를 갱신', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      await alloc.next('exec-ttl');
      expect(redis.expire).toHaveBeenCalledWith(
        'exec:seq:exec-ttl',
        expect.any(Number),
      );
    });

    it('EXPIRE 실패는 INCR 로 발급된 seq 를 무효화하지 않는다 (swallow)', async () => {
      const redis = makeRedis({
        expire: jest.fn(async () => {
          throw new Error('EXPIRE failed');
        }),
      });
      const alloc = makeAllocator(redis);
      await expect(alloc.next('exec-e')).resolves.toBe(1);
    });
  });

  describe('Redis 장애 → in-memory degraded fallback', () => {
    it('Redis throw 시 in-memory per-execution 단조 증가로 degrade', async () => {
      const alloc = makeAllocator(null);
      expect(await alloc.next('exec-f')).toBe(1);
      expect(await alloc.next('exec-f')).toBe(2);
      expect(await alloc.next('exec-other')).toBe(1);
    });

    it('Redis 정상 발급 후 장애로 전환돼도 in-memory mirror 가 이어받아 monotonic 유지', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      // 정상 3회 (1,2,3) — mirror 가 high-water mark 3 으로 동기화.
      await alloc.next('exec-mix');
      await alloc.next('exec-mix');
      expect(await alloc.next('exec-mix')).toBe(3);
      // Redis 장애로 전환.
      (alloc as unknown as { getClient: () => unknown }).getClient = () => {
        throw new Error('Redis down');
      };
      // degraded 가 4 부터 이어받아야 한다 (1 로 reset 되어 충돌하면 안 됨).
      expect(await alloc.next('exec-mix')).toBe(4);
      expect(await alloc.next('exec-mix')).toBe(5);
    });
  });

  describe('release()', () => {
    it('release 후 같은 executionId 의 in-memory mirror 가 0 부터 재시작', async () => {
      const alloc = makeAllocator(null); // degraded path 로 mirror 동작 검증
      await alloc.next('exec-r'); // 1
      await alloc.next('exec-r'); // 2
      alloc.release('exec-r');
      expect(await alloc.next('exec-r')).toBe(1);
    });

    it('Redis 가용 시 release 가 best-effort DEL 호출', () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      // redisClient 를 미리 set (getClient 가 캐시하지 않는 stub 이므로 직접 주입)
      (alloc as unknown as { redisClient: unknown }).redisClient = redis;
      alloc.release('exec-del');
      expect(redis.del).toHaveBeenCalledWith('exec:seq:exec-del');
    });
  });
});
