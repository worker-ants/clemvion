import Redis from 'ioredis';
import { PublicWebhookQuotaService } from './public-webhook-quota.service';

/** incr/expire 만 흉내내는 in-memory fake Redis. */
function makeFakeRedis() {
  const store = new Map<string, number>();
  const expires: string[] = [];
  return {
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
  } as unknown as Redis & { store: Map<string, number>; expires: string[] };
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
    expect((redis as unknown as { expires: string[] }).expires).toEqual([
      'wh:rl:min:ip-a',
      'wh:rl:hour:ip-a',
    ]);
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
      store.set('wh:rl:min:ip-c', 0);
      last = await svc.consumeStart('ip-c');
    }
    expect(last).toEqual({ allowed: false, reason: 'hourly_new' });
  });

  it('Redis incr 오류 → fail-open', async () => {
    const redis = makeFakeRedis();
    (redis.incr as jest.Mock).mockRejectedValueOnce(new Error('conn lost'));
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const r = await svc.consumeStart('ip-d');
    expect(r).toEqual({ allowed: true, reason: null });
  });

  it('config override 로 한도 조정', async () => {
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
});
