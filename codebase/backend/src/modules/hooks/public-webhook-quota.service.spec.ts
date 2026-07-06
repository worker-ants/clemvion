import Redis from 'ioredis';
import {
  PublicWebhookQuotaService,
  makeMinKey,
  makeHourKey,
  MINUTE_WINDOW_SEC,
  HOUR_WINDOW_SEC,
  UNIDENTIFIED_IP_BUCKET,
} from './public-webhook-quota.service';

/** INCR/EXPIRE/pipeline/quit 만 흉내내는 in-memory fake Redis. */
function makeFakeRedis() {
  const store = new Map<string, number>();
  const expires: string[] = [];
  // pipeline 안에서 발행된 EXPIRE(NX) 호출 기록 — [key, sec, mode].
  const pipelineExpires: Array<[string, number, string | undefined]> = [];
  const fakeRedis = {
    store,
    expires,
    pipelineExpires,
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
        expire: jest.fn((key: string, sec: number, mode?: string) => {
          cmds.push(async () => {
            // EXPIRE NX 시맨틱 흉내: 기록만 남기고 1 반환.
            pipelineExpires.push([key, sec, mode]);
            return [null, 1] as [null, number];
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
  } as unknown as Redis & {
    store: Map<string, number>;
    expires: string[];
    pipelineExpires: Array<[string, number, string | undefined]>;
  };
  return fakeRedis;
}

describe('PublicWebhookQuotaService', () => {
  it('Redis 미주입(config 없음) → fail-open (항상 allowed)', async () => {
    const svc = new PublicWebhookQuotaService();
    expect(svc.isAvailable()).toBe(false);
    const r = await svc.consumeStart('1.2.3.4');
    expect(r).toEqual({ allowed: true, reason: null });
  });

  it('분당 한도 내 → allowed, INCR+EXPIRE(NX) 를 매 요청 단일 pipeline 으로(원자화)', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const r = await svc.consumeStart('ip-a');
    expect(r.allowed).toBe(true);
    // min + hour 각각 pipeline 에 EXPIRE NX 동봉 — 별도 왕복 없이 window TTL 설정.
    expect(redis.pipelineExpires).toContainEqual([
      makeMinKey('ip-a'),
      MINUTE_WINDOW_SEC,
      'NX',
    ]);
    expect(redis.pipelineExpires).toContainEqual([
      makeHourKey('ip-a'),
      HOUR_WINDOW_SEC,
      'NX',
    ]);
    // 비원자 별도-왕복 EXPIRE 는 더 이상 없어야 한다(TTL 유실 창 제거).
    expect(redis.expire).not.toHaveBeenCalled();
  });

  it('EXPIRE(NX) 는 첫 증가뿐 아니라 매 요청 pipeline 에 실린다 — TTL 유실 self-heal', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    await svc.consumeStart('ip-heal');
    await svc.consumeStart('ip-heal');
    // 두 요청 모두 min 키에 EXPIRE NX 를 실었다(NX 라 TTL 있으면 no-op — window 연장 안 함).
    const minExpires = redis.pipelineExpires.filter(
      ([k]) => k === makeMinKey('ip-heal'),
    );
    expect(minExpires.length).toBe(2);
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
      expire: jest.fn().mockReturnThis(),
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

  it('공유 connection 은 quit 하지 않는다 — 종료는 RedisConnectionProvider 소관 (INFO-12)', () => {
    // 옛 동작: 본 서비스가 onModuleDestroy 에서 자기 redis 를 quit 했다. 통합 후에는
    // 단일 공유 command 연결을 다른 소비자와 공유하므로 본 서비스가 quit 하면 안 된다.
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    expect(
      (svc as unknown as { onModuleDestroy?: unknown }).onModuleDestroy,
    ).toBeUndefined();
    expect(redis.quit).not.toHaveBeenCalled();
  });

  it('key 포맷 상수 — makeMinKey/makeHourKey (Info#10)', () => {
    expect(makeMinKey('1.2.3.4')).toBe('wh:rl:min:1.2.3.4');
    expect(makeHourKey('1.2.3.4')).toBe('wh:rl:hour:1.2.3.4');
  });

  it('UNIDENTIFIED_IP_BUCKET — 정상 IP 와 충돌하지 않는 sentinel 이며 공유 버킷 키를 만든다 (D-12)', () => {
    // sentinel 은 유효 IP 표기가 아니어야 정상 클라이언트가 공유 버킷에 섞이지 않는다.
    expect(UNIDENTIFIED_IP_BUCKET).toBe('__no_client_ip__');
    // 유효 IPv4·IPv6 표기 어느 쪽과도 충돌하지 않아야 정상 클라이언트가 공유 버킷에 섞이지 않는다.
    expect(/^\d{1,3}(\.\d{1,3}){3}$/.test(UNIDENTIFIED_IP_BUCKET)).toBe(false);
    expect(/^[0-9a-f:]+$/i.test(UNIDENTIFIED_IP_BUCKET)).toBe(false);
    expect(makeMinKey(UNIDENTIFIED_IP_BUCKET)).toBe(
      'wh:rl:min:__no_client_ip__',
    );
    expect(makeHourKey(UNIDENTIFIED_IP_BUCKET)).toBe(
      'wh:rl:hour:__no_client_ip__',
    );
  });

  it('UNIDENTIFIED_IP_BUCKET 으로 consumeStart — 일반 IP 처럼 카운트되어 미식별 트래픽이 한 버킷에 누적 (D-12)', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const r = await svc.consumeStart(UNIDENTIFIED_IP_BUCKET);
    expect(r.allowed).toBe(true);
    // 미식별 요청은 모두 동일 sentinel 키에 누적된다(단일 공유 버킷 = 보수적 완화 한도).
    expect(redis.store.get(makeMinKey(UNIDENTIFIED_IP_BUCKET))).toBe(1);
  });

  it('UNIDENTIFIED_IP_BUCKET 시간당 누적 초과 → reason=hourly_new (미식별 공유 버킷도 per-IP 와 동일 한도, D-12)', async () => {
    const redis = makeFakeRedis();
    const svc = new PublicWebhookQuotaService(undefined, redis);
    const store = (redis as unknown as { store: Map<string, number> }).store;
    // 분당 카운터를 매번 리셋해 startup_rate 에 안 걸리게 하고 hour 만 누적.
    const hourlyMax = PublicWebhookQuotaService.DEFAULT_HOURLY_NEW_MAX;
    let last = { allowed: true, reason: null as string | null };
    for (let i = 0; i < hourlyMax + 1; i++) {
      store.set(makeMinKey(UNIDENTIFIED_IP_BUCKET), 0);
      last = await svc.consumeStart(UNIDENTIFIED_IP_BUCKET);
    }
    expect(last).toEqual({ allowed: false, reason: 'hourly_new' });
  });
});
