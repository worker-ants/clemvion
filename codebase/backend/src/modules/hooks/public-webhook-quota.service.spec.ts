import Redis from 'ioredis';
import {
  PublicWebhookQuotaService,
  makeMinKey,
  makeHourKey,
  MINUTE_WINDOW_SEC,
  HOUR_WINDOW_SEC,
} from './public-webhook-quota.service';

/** INCR/EXPIRE/pipeline/quit 만 흉내내는 in-memory fake Redis. */
function makeFakeRedis() {
  const store = new Map<string, number>();
  const expires: string[] = [];
  const fakeRedis = {
    store,
    expires,
    incr: jest.fn(async (key: string) => {
      const next = (store.get(key) ?? 0) + 1;
      store.set(key, next);
      return next;
    }),
    expire: jest.fn(async (key: string, _sec: number) => {
      expires.push(key);
      return 1;
    }),
    on: jest.fn(),
    quit: jest.fn(async () => 'OK'),
    pipeline: jest.fn(() => {
      // pipeline mock: collects commands and exec() runs them in sequence
      const cmds: Array<() => Promise<[null, unknown]>> = [];
      const pipe = {
        incr: jest.fn((key: string) => {
          cmds.push(async () => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return [null, next] as [null, number];
          });
          return pipe;
        }),
        exec: jest.fn(async () => {
          const results = await Promise.all(cmds.map((fn) => fn()));
          return results;
        }),
      };
      return pipe;
    }),
  } as unknown as Redis & { store: Map<string, number>; expires: string[] };
  return fakeRedis;
}

describe('PublicWebhookQuotaService', () => {
  it('Redis 미주입(config 없음) → fail-open (항상 allowed)', async () => {
    const svc = new PublicWebhookQuotaService();
    expect(svc.isAvailable()).toBe(false);
    const r = await svc.consumeStart('1.2.3.4');
    expect(r).toEqual({ allowed: true, reason: null });
  });

  it('분당 한도 내 → allowed, 윈도우 첫 증가에만 expire', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const r = await svc.consumeStart('ip-a');
    expect(r.allowed).toBe(true);
    // min + hour 카운터 각각 첫 증가 → expire 2회
    // expire 는 incrWithWindow 내부에서 pipeline exec 후 직접 호출
    expect(redis.expire).toHaveBeenCalledWith(
      makeMinKey('ip-a'),
      MINUTE_WINDOW_SEC,
    );
    expect(redis.expire).toHaveBeenCalledWith(
      makeHourKey('ip-a'),
      HOUR_WINDOW_SEC,
    );
  });

  it('분당 한도 초과 → reason=startup_rate', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const limit = PublicWebhookQuotaService.DEFAULT_STARTUP_PER_MINUTE;
    let last = { allowed: true, reason: null as string | null };
    for (let i = 0; i < limit + 1; i++) {
      last = await svc.consumeStart('ip-b');
    }
    expect(last).toEqual({ allowed: false, reason: 'startup_rate' });
  });

  it('시간당 누적 초과 → reason=hourly_new (분당은 윈도우 리셋 가정)', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const store = (redis as unknown as { store: Map<string, number> }).store;
    // 분당 카운터를 매번 리셋해 startup_rate 에 안 걸리게 하고 hour 만 누적.
    const hourlyMax = PublicWebhookQuotaService.DEFAULT_HOURLY_NEW_MAX;
    let last = { allowed: true, reason: null as string | null };
    for (let i = 0; i < hourlyMax + 1; i++) {
      store.set(makeMinKey('ip-c'), 0);
      last = await svc.consumeStart('ip-c');
    }
    expect(last).toEqual({ allowed: false, reason: 'hourly_new' });
  });

  it('Redis pipeline exec 오류 → fail-open', async () => {
    const redis = makeFakeRedis();
    (redis.pipeline as jest.Mock).mockImplementationOnce(() => ({
      incr: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValueOnce(new Error('conn lost')),
    }));
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const r = await svc.consumeStart('ip-d');
    expect(r).toEqual({ allowed: true, reason: null });
  });

  it('startupPerMinute config override 로 한도 조정', async () => {
    const redis = makeFakeRedis();
    const config = {
      get: jest.fn((k: string) =>
        k === 'publicWebhook.startupPerMinute' ? 2 : undefined,
      ),
    } as unknown as import('@nestjs/config').ConfigService;
    const svc = new PublicWebhookQuotaService(config, redis);
    expect(svc.limits.startupPerMinute).toBe(2);
    await svc.consumeStart('ip-e');
    await svc.consumeStart('ip-e');
    const third = await svc.consumeStart('ip-e');
    expect(third).toEqual({ allowed: false, reason: 'startup_rate' });
  });

  it('hourlyNewMax config override 로 시간당 상한 조정 (Info#11)', async () => {
    const redis = makeFakeRedis();
    const store = (redis as unknown as { store: Map<string, number> }).store;
    const config = {
      get: jest.fn((k: string) => {
        if (k === 'publicWebhook.hourlyNewMax') return 3;
        return undefined;
      }),
    } as unknown as import('@nestjs/config').ConfigService;
    const svc = new PublicWebhookQuotaService(config, redis);
    expect(svc.limits.hourlyNewMax).toBe(3);

    let last = { allowed: true, reason: null as string | null };
    for (let i = 0; i < 4; i++) {
      store.set(makeMinKey('ip-f'), 0);
      last = await svc.consumeStart('ip-f');
    }
    expect(last).toEqual({ allowed: false, reason: 'hourly_new' });
  });

  it('onModuleDestroy — redis.quit 정상 호출 (Info#12)', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    await svc.onModuleDestroy();
    expect(redis.quit).toHaveBeenCalledTimes(1);
  });

  it('onModuleDestroy — redis.quit 예외 시 throw 없이 종료 (Info#12)', async () => {
    const redis = makeFakeRedis();
    (redis.quit as jest.Mock).mockRejectedValueOnce(new Error('quit error'));
    const svc = new PublicWebhookQuotaService(undefined, redis);
    await expect(svc.onModuleDestroy()).resolves.toBeUndefined();
  });

  it('key 포맷 상수 — makeMinKey/makeHourKey (Info#10)', () => {
    expect(makeMinKey('1.2.3.4')).toBe('wh:rl:min:1.2.3.4');
    expect(makeHourKey('1.2.3.4')).toBe('wh:rl:hour:1.2.3.4');
  });
});
