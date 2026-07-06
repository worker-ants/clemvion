import {
  InteractionRateLimiterService,
  makeInteractKey,
  makeStatusKey,
} from './interaction-rate-limiter.service';
import type Redis from 'ioredis';

/**
 * In-memory fake Redis — EVAL(INCR+조건부 EXPIRE Lua) / TTL 만 지원. fixed-window 검증에 충분.
 * `eval` 은 서비스가 쓰는 Lua 시맨틱(INCR 후 count===1 이면 EXPIRE)을 그대로 모사한다.
 */
class FakeRedis {
  private counts = new Map<string, number>();
  private ttls = new Map<string, number>();
  eval = jest.fn(
    async (
      _script: string,
      _numKeys: number,
      key: string,
      windowSec: string,
    ): Promise<number> => {
      const next = (this.counts.get(key) ?? 0) + 1;
      this.counts.set(key, next);
      if (next === 1) this.ttls.set(key, Number(windowSec));
      return next;
    },
  );
  ttl = jest.fn(async (key: string): Promise<number> => {
    return this.ttls.get(key) ?? -1;
  });
}

function makeService(
  redis: FakeRedis | null,
  config?: Record<string, number>,
): InteractionRateLimiterService {
  const configService = config
    ? ({ get: (k: string) => config[k] } as never)
    : undefined;
  return new InteractionRateLimiterService(
    configService,
    redis as unknown as Redis | undefined,
    undefined,
  );
}

describe('InteractionRateLimiterService', () => {
  it('기본 한도 — interact 60/분, status 120/분', () => {
    const svc = makeService(new FakeRedis());
    expect(svc.limits).toEqual({
      interactPerMinute: 60,
      statusPerMinute: 120,
    });
  });

  it('config 로 한도 override', () => {
    const svc = makeService(new FakeRedis(), {
      'interaction.rateLimit.interactPerMinute': 10,
      'interaction.rateLimit.statusPerMinute': 20,
    });
    expect(svc.limits).toEqual({
      interactPerMinute: 10,
      statusPerMinute: 20,
    });
  });

  it('한도 이내 요청은 allowed=true', async () => {
    const svc = makeService(new FakeRedis(), {
      'interaction.rateLimit.interactPerMinute': 3,
      'interaction.rateLimit.statusPerMinute': 120,
    });
    for (let i = 0; i < 3; i++) {
      const r = await svc.consumeInteract('exec-1');
      expect(r.allowed).toBe(true);
    }
  });

  it('한도 초과 시 allowed=false + retryAfterSec = 잔여 TTL', async () => {
    const redis = new FakeRedis();
    const svc = makeService(redis, {
      'interaction.rateLimit.interactPerMinute': 2,
      'interaction.rateLimit.statusPerMinute': 120,
    });
    await svc.consumeInteract('exec-1'); // 1
    await svc.consumeInteract('exec-1'); // 2 (한도)
    const over = await svc.consumeInteract('exec-1'); // 3 (초과)
    expect(over.allowed).toBe(false);
    expect(over.retryAfterSec).toBe(60); // expire(key, 60) 로 설정된 TTL
  });

  it('INCR+EXPIRE 를 단일 원자 EVAL 로 실행 (fixed-window)', async () => {
    const redis = new FakeRedis();
    const svc = makeService(redis);
    await svc.consumeInteract('exec-1');
    await svc.consumeInteract('exec-1');
    await svc.consumeInteract('exec-1');
    // consume 마다 별도 INCR/EXPIRE 왕복이 아니라 EVAL 1회 — 비원자 window 제거.
    expect(redis.eval).toHaveBeenCalledTimes(3);
    // 첫 EVAL 이 windowSec=60 을 인자로 받아 TTL 을 건다 (내부 count===1 분기).
    expect(redis.eval).toHaveBeenCalledWith(
      expect.stringContaining('INCR'),
      1,
      makeInteractKey('exec-1'),
      '60',
    );
  });

  it('interact / status 는 독립 키로 카운트', async () => {
    const redis = new FakeRedis();
    const svc = makeService(redis, {
      'interaction.rateLimit.interactPerMinute': 1,
      'interaction.rateLimit.statusPerMinute': 1,
    });
    expect((await svc.consumeInteract('exec-1')).allowed).toBe(true);
    // 같은 execution 이라도 status 는 별도 버킷이라 여전히 허용
    expect((await svc.consumeStatus('exec-1')).allowed).toBe(true);
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      makeInteractKey('exec-1'),
      expect.any(String),
    );
    expect(redis.eval).toHaveBeenCalledWith(
      expect.any(String),
      1,
      makeStatusKey('exec-1'),
      expect.any(String),
    );
  });

  it('execution 별 독립 카운트 — 다른 execution 은 서로 영향 없음', async () => {
    const svc = makeService(new FakeRedis(), {
      'interaction.rateLimit.interactPerMinute': 1,
      'interaction.rateLimit.statusPerMinute': 120,
    });
    expect((await svc.consumeInteract('exec-1')).allowed).toBe(true);
    expect((await svc.consumeInteract('exec-1')).allowed).toBe(false);
    // 다른 execution 은 fresh
    expect((await svc.consumeInteract('exec-2')).allowed).toBe(true);
  });

  it('Redis 미가용 시 fail-open (allowed=true)', async () => {
    const svc = makeService(null);
    expect(svc.isAvailable()).toBe(false);
    const r = await svc.consumeInteract('exec-1');
    expect(r).toEqual({ allowed: true, retryAfterSec: 0 });
  });

  it('Redis 오류 시 fail-open (allowed=true)', async () => {
    const redis = new FakeRedis();
    redis.eval.mockRejectedValueOnce(new Error('redis down'));
    const svc = makeService(redis);
    const r = await svc.consumeInteract('exec-1');
    expect(r).toEqual({ allowed: true, retryAfterSec: 0 });
  });
});
