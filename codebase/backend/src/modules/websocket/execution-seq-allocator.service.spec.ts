import { ExecutionSeqAllocator } from './execution-seq-allocator.service';

/**
 * ExecutionSeqAllocator 단위 테스트.
 *
 * execution 별 monotonic seq 발급의 두 경로를 검증한다:
 *  - Redis 정상: `INCR exec:seq:<id>` 단조 증가 + sliding TTL EXPIRE
 *  - Redis 장애: in-memory per-instance degraded fallback (logged, best-effort monotonic)
 *
 * 공유 command 연결은 RedisConnectionProvider 가 소유한다. 본 테스트는 provider mock
 * 또는 private getClient() monkey-patch 로 ioredis 실연결 없이 INCR/EXPIRE/DEL 의 호출과
 * fallback 분기를 검증한다.
 */
describe('ExecutionSeqAllocator', () => {
  // RedisConnectionProvider stub — getClient/getClientOrNull 가 주어진 client 를 반환.
  // client=null 이면 getClient 가 throw (config 누락/장애 시뮬레이션), getClientOrNull 은 null.
  function makeRedisConn(client: unknown = null): {
    getClient: jest.Mock;
    getClientOrNull: jest.Mock;
  } {
    return {
      getClient: jest.fn(() => {
        if (!client) throw new Error('Redis unavailable (test)');
        return client;
      }),
      getClientOrNull: jest.fn(() => client ?? null),
    };
  }

  type PipelineOp = [string, ...unknown[]];
  type FakeRedis = {
    del: jest.Mock;
    quit: jest.Mock;
    on: jest.Mock;
    pipeline: jest.Mock;
    /** 모든 pipeline 에 누적 기록된 op 목록 (검증용). */
    __pipelineOps: PipelineOp[];
  };

  /**
   * `next()` 는 `pipeline().incr(key).expire(key, ttl).exec()` 단일 round-trip 을
   * 사용한다. fake 는 store 를 공유하는 pipeline 빌더를 제공하고, exec() 가
   * ioredis 와 동일한 `[[err, result], ...]` 튜플 배열을 반환한다.
   */
  function makeRedis(overrides: Partial<FakeRedis> = {}): FakeRedis {
    const store = new Map<string, number>();
    const ops: PipelineOp[] = [];
    const incrImpl = (key: string): number => {
      const n = (store.get(key) ?? 0) + 1;
      store.set(key, n);
      return n;
    };
    return {
      del: jest.fn(async () => 1),
      quit: jest.fn(async () => 'OK'),
      on: jest.fn(),
      __pipelineOps: ops,
      pipeline: jest.fn(() => {
        const builder: Record<string, unknown> = {};
        const local: PipelineOp[] = [];
        builder.incr = (key: string) => {
          local.push(['incr', key]);
          ops.push(['incr', key]);
          return builder;
        };
        builder.expire = (key: string, ttl: number) => {
          local.push(['expire', key, ttl]);
          ops.push(['expire', key, ttl]);
          return builder;
        };
        builder.exec = jest.fn(async () =>
          local.map((op) =>
            op[0] === 'incr' ? [null, incrImpl(op[1] as string)] : [null, 1],
          ),
        );
        return builder;
      }),
      ...overrides,
    };
  }

  /**
   * allocator 를 만든다. 공유 연결은 RedisConnectionProvider mock 으로 주입하되,
   * 본 테스트는 추가로 private getClient 를 monkey-patch 해 explicit redis stub 의
   * 호출·fallback 분기를 직접 검증한다 (redis=null 이면 throw 로 장애 시뮬레이션).
   * release() 의 best-effort DEL 은 provider.getClientOrNull() 경로를 쓰므로
   * provider mock 도 같은 stub 을 반환하도록 구성한다.
   */
  function makeAllocator(redis: FakeRedis | null): ExecutionSeqAllocator {
    const alloc = new ExecutionSeqAllocator(makeRedisConn(redis) as never);
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
      // 단일 round-trip pipeline 으로 INCR 발행됨.
      expect(redis.pipeline).toHaveBeenCalledTimes(3);
      expect(redis.__pipelineOps).toContainEqual(['incr', 'exec:seq:exec-1']);
    });

    it('서로 다른 execution 은 독립 counter', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      expect(await alloc.next('exec-A')).toBe(1);
      expect(await alloc.next('exec-B')).toBe(1);
      expect(await alloc.next('exec-A')).toBe(2);
    });

    it('매 next() 가 sliding TTL EXPIRE 를 같은 pipeline 에서 갱신', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      await alloc.next('exec-ttl');
      expect(redis.__pipelineOps).toContainEqual([
        'expire',
        'exec:seq:exec-ttl',
        expect.any(Number),
      ]);
    });

    it('EXPIRE 실패(pipeline 의 expire 튜플 err)는 INCR seq 를 무효화하지 않는다 (swallow)', async () => {
      // pipeline.exec() 가 [[null, seq], [expireErr, null]] 을 반환하는 경우.
      const redis = makeRedis({
        pipeline: jest.fn(() => {
          const b: Record<string, unknown> = {};
          b.incr = () => b;
          b.expire = () => b;
          b.exec = jest.fn(async () => [
            [null, 1],
            [new Error('EXPIRE failed'), null],
          ]);
          return b;
        }),
      });
      const alloc = makeAllocator(redis);
      await expect(alloc.next('exec-e')).resolves.toBe(1);
    });

    it('pipeline.exec() reject (연결 실패) 시 degraded fallback', async () => {
      const redis = makeRedis({
        pipeline: jest.fn(() => {
          const b: Record<string, unknown> = {};
          b.incr = () => b;
          b.expire = () => b;
          b.exec = jest.fn(async () => {
            throw new Error('Connection lost');
          });
          return b;
        }),
      });
      const alloc = makeAllocator(redis);
      expect(await alloc.next('exec-x')).toBe(1); // in-memory degraded
      expect(await alloc.next('exec-x')).toBe(2);
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

  describe('동시성 regression — 같은 execution 의 동시 next() 가 중복·역전 없이 유일', () => {
    // plan §4: 분산 race regression. atomic INCR 계약에 의존 — 같은 executionId 의
    // 동시 emit 이 다른 발급을 받아야 한다 (중복 0, 1..N 빠짐없이). Redis INCR 의
    // 원자성을 fake 가 재현(JS 단일 스레드 + get/set 사이 await 없음)해 계약을 고정한다.
    it('100개 동시 next() → 1..100 유일 집합 (중복·누락 0)', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      const seqs = await Promise.all(
        Array.from({ length: 100 }, () => alloc.next('exec-race')),
      );
      const unique = new Set(seqs);
      expect(unique.size).toBe(100); // 중복 0
      expect(Math.min(...seqs)).toBe(1);
      expect(Math.max(...seqs)).toBe(100); // 1..100 빠짐없이 (gap 0)
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
      // makeAllocator 의 provider mock 이 getClientOrNull 로 같은 redis 를 반환.
      const alloc = makeAllocator(redis);
      alloc.release('exec-del');
      expect(redis.del).toHaveBeenCalledWith('exec:seq:exec-del');
    });
  });

  describe('getClient — redis 설정 누락 시', () => {
    it('공유 연결 미가용(provider getClient throw) 시 next() 가 throw 를 잡아 degraded fallback (엔진 emit 중단 없음)', async () => {
      // 실제 getClient 경로 (monkey-patch 안 함) → redisConn.getClient() 가 throw → catch → degraded.
      const alloc = new ExecutionSeqAllocator(makeRedisConn(null) as never);
      expect(await alloc.next('exec-nocfg')).toBe(1);
      expect(await alloc.next('exec-nocfg')).toBe(2);
    });
  });

  describe('RedisConnectionProvider 위임 경로 (W-6, monkey-patch 없음)', () => {
    // makeAllocator 는 검증 편의를 위해 private getClient 를 monkey-patch 하지만,
    // 본 블록은 monkey-patch 없이 실제 redisConn.getClient() 위임만으로 INCR 가
    // 공유 provider 의 client 를 타는지 직접 검증한다 (provider mock 단일 레이어).
    it('provider.getClient() 가 반환한 client 로 INCR pipeline 수행', async () => {
      const redis = makeRedis();
      const conn = makeRedisConn(redis);
      const alloc = new ExecutionSeqAllocator(conn as never);
      expect(await alloc.next('exec-deleg')).toBe(1);
      expect(await alloc.next('exec-deleg')).toBe(2);
      expect(conn.getClient).toHaveBeenCalled();
      expect(redis.__pipelineOps).toContainEqual([
        'incr',
        'exec:seq:exec-deleg',
      ]);
    });

    it('release() 가 provider.getClientOrNull() 의 client 로 DEL 수행', () => {
      const redis = makeRedis();
      const conn = makeRedisConn(redis);
      const alloc = new ExecutionSeqAllocator(conn as never);
      alloc.release('exec-deleg-del');
      expect(conn.getClientOrNull).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith('exec:seq:exec-deleg-del');
    });
  });

  describe('seqKeyTtlSeconds — EXECUTION_SEQ_TTL_SECONDS env 분기', () => {
    const ENV = 'EXECUTION_SEQ_TTL_SECONDS';
    const orig = process.env[ENV];
    afterEach(() => {
      if (orig === undefined) delete process.env[ENV];
      else process.env[ENV] = orig;
    });

    function ttlOf(alloc: ExecutionSeqAllocator): number {
      return (alloc as unknown as { seqKeyTtlSeconds: number })
        .seqKeyTtlSeconds;
    }

    it('양수 정수 env → 채택', () => {
      process.env[ENV] = '3600';
      expect(ttlOf(new ExecutionSeqAllocator(makeRedisConn() as never))).toBe(
        3600,
      );
    });

    it('NaN/음수/0 env → default 86400', () => {
      for (const bad of ['abc', '-5', '0']) {
        process.env[ENV] = bad;
        expect(ttlOf(new ExecutionSeqAllocator(makeRedisConn() as never))).toBe(
          86_400,
        );
      }
    });

    it('미설정 → default 86400', () => {
      delete process.env[ENV];
      expect(ttlOf(new ExecutionSeqAllocator(makeRedisConn() as never))).toBe(
        86_400,
      );
    });
  });

  describe('onModuleDestroy', () => {
    it('in-memory mirror 반납 + 공유 client 는 quit 하지 않음 (RedisConnectionProvider 소관, INFO-12)', async () => {
      const redis = makeRedis();
      const alloc = makeAllocator(redis);
      await alloc.next('exec-d'); // mirror 채움
      alloc.onModuleDestroy();
      // 공유 연결이므로 본 서비스는 quit 하지 않는다.
      expect(redis.quit).not.toHaveBeenCalled();
      expect(
        (alloc as unknown as { fallbackCounters: Map<string, number> })
          .fallbackCounters.size,
      ).toBe(0);
    });

    it('redis 미가용이어도 안전 종료 (TypeError 없음)', () => {
      const alloc = makeAllocator(null);
      expect(() => alloc.onModuleDestroy()).not.toThrow();
    });
  });
});
