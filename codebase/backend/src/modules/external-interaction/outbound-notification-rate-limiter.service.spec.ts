import {
  OutboundNotificationRateLimiterService,
  makeOutboundKey,
} from './outbound-notification-rate-limiter.service';
import type Redis from 'ioredis';

/** INCR + EXPIRE(NX) 단일 pipeline 을 흉내내는 in-memory fake Redis. */
function makeFakeRedis() {
  const store = new Map<string, number>();
  const fake = {
    pipeline: jest.fn(() => {
      const cmds: Array<() => Promise<[null, number]>> = [];
      const pipe = {
        incr: jest.fn((key: string) => {
          cmds.push(async () => {
            const next = (store.get(key) ?? 0) + 1;
            store.set(key, next);
            return [null, next];
          });
          return pipe;
        }),
        expire: jest.fn(() => {
          cmds.push(async () => [null, 1]);
          return pipe;
        }),
        exec: jest.fn(async () => Promise.all(cmds.map((fn) => fn()))),
      };
      return pipe;
    }),
  } as unknown as Redis & { store: Map<string, number> };
  return fake;
}

function makeSvc(redis: Redis | null): OutboundNotificationRateLimiterService {
  return new OutboundNotificationRateLimiterService(
    redis as unknown as Redis | undefined,
    undefined,
  );
}

describe('OutboundNotificationRateLimiterService', () => {
  it('한도(60/분) 이내는 exceeded=false, 초과(61번째)는 true', async () => {
    const svc = makeSvc(makeFakeRedis());
    for (let i = 0; i < OutboundNotificationRateLimiterService.LIMIT_PER_MINUTE; i++) {
      expect(await svc.consume('trg-1')).toBe(false);
    }
    expect(await svc.consume('trg-1')).toBe(true); // 61번째 초과
  });

  it('trigger 별 독립 카운트', async () => {
    const svc = makeSvc(makeFakeRedis());
    for (let i = 0; i < OutboundNotificationRateLimiterService.LIMIT_PER_MINUTE; i++) {
      await svc.consume('trg-1');
    }
    expect(await svc.consume('trg-1')).toBe(true);
    expect(await svc.consume('trg-2')).toBe(false); // 다른 trigger 는 fresh
  });

  it('INCR+EXPIRE(NX) 를 단일 pipeline 으로 원자 발행', async () => {
    const redis = makeFakeRedis();
    const svc = makeSvc(redis);
    await svc.consume('trg-1');
    expect(redis.pipeline).toHaveBeenCalledTimes(1);
    const pipe = (redis.pipeline as jest.Mock).mock.results[0].value;
    expect(pipe.incr).toHaveBeenCalledWith(makeOutboundKey('trg-1'));
    expect(pipe.expire).toHaveBeenCalledWith(
      makeOutboundKey('trg-1'),
      OutboundNotificationRateLimiterService.WINDOW_SEC,
      'NX',
    );
  });

  it('Redis 미가용 시 fail-open (exceeded=false)', async () => {
    const svc = makeSvc(null);
    expect(svc.isAvailable()).toBe(false);
    expect(await svc.consume('trg-1')).toBe(false);
  });

  it('Redis 오류 시 fail-open (exceeded=false)', async () => {
    const redis = makeFakeRedis();
    (redis.pipeline as jest.Mock).mockImplementationOnce(() => ({
      incr: jest.fn().mockReturnThis(),
      expire: jest.fn().mockReturnThis(),
      exec: jest.fn().mockRejectedValueOnce(new Error('redis down')),
    }));
    const svc = makeSvc(redis);
    expect(await svc.consume('trg-1')).toBe(false);
  });
});
