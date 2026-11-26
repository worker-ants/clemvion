import { afterEach, describe, expect, it, jest } from '@jest/globals';
import { ThrottlerStorageService } from '@nestjs/throttler';
import type Redis from 'ioredis';

import type { BusinessMetricsService } from '../../modules/metrics/business-metrics.service';
import type { RedisConnectionProvider } from '../redis/redis-connection.provider';
import {
  REDIS_THROTTLER_COMMAND_TIMEOUT_MS,
  REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS,
  RedisThrottlerStorage,
  type RedisThrottlerTiming,
  throttleBlockKey,
  throttleHitKey,
} from './redis-throttler.storage';

type EvalFn = (...args: unknown[]) => Promise<unknown>;

function makeStorage(opts: {
  client?: { eval: EvalFn } | null;
  metrics?: Pick<BusinessMetricsService, 'recordRedisFailOpen'>;
  timing?: RedisThrottlerTiming;
}) {
  const redisConn = {
    getClientOrNull: jest.fn(() => (opts.client ?? null) as Redis | null),
  } as unknown as RedisConnectionProvider;
  const storage = new RedisThrottlerStorage(
    redisConn,
    opts.metrics as BusinessMetricsService | undefined,
    opts.timing,
  );
  return { storage, redisConn };
}

describe('RedisThrottlerStorage', () => {
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  describe('키', () => {
    it('Redis 키는 throttle 도메인 아래 hit · block 용도로 나뉜다 (CLE-ENG-REDIS 규칙 1)', () => {
      expect(throttleHitKey('abc')).toBe('throttle:hit:abc');
      expect(throttleBlockKey('abc')).toBe('throttle:block:abc');
    });
  });

  describe('Redis 가 답할 때', () => {
    it('스크립트에 두 키와 ttl · limit · blockDuration(ms)을 넘기고 결과를 초 단위 레코드로 바꾼다', async () => {
      const evalMock = jest.fn<EvalFn>().mockResolvedValue([3, 59_001, 0, 0]);
      const { storage } = makeStorage({ client: { eval: evalMock } });

      const record = await storage.increment(
        'k1',
        60_000,
        100,
        60_000,
        'default',
      );

      expect(evalMock).toHaveBeenCalledTimes(1);
      const args = evalMock.mock.calls[0];
      expect(typeof args[0]).toBe('string');
      expect(args.slice(1)).toEqual([
        2,
        'throttle:hit:k1',
        'throttle:block:k1',
        60_000,
        100,
        60_000,
      ]);
      expect(record).toEqual({
        totalHits: 3,
        timeToExpire: 60,
        isBlocked: false,
        timeToBlockExpire: 0,
      });
    });

    it('차단 결과는 isBlocked=true 와 남은 차단 시간(초, 올림)으로 돌려준다', async () => {
      const evalMock = jest
        .fn<EvalFn>()
        .mockResolvedValue([101, 1_500, 1, 1_500]);
      const { storage } = makeStorage({ client: { eval: evalMock } });

      const record = await storage.increment(
        'k1',
        60_000,
        100,
        60_000,
        'default',
      );

      expect(record).toEqual({
        totalHits: 101,
        timeToExpire: 2,
        isBlocked: true,
        timeToBlockExpire: 2,
      });
    });

    it('Redis 가 정상이면 지표를 세지 않고 메모리 저장소를 쓰지 않는다', async () => {
      const recordRedisFailOpen = jest.fn();
      const memory = jest.spyOn(ThrottlerStorageService.prototype, 'increment');
      const { storage } = makeStorage({
        client: {
          eval: jest.fn<EvalFn>().mockResolvedValue([1, 60_000, 0, 0]),
        },
        metrics: { recordRedisFailOpen },
      });

      await storage.increment('k1', 60_000, 100, 60_000, 'default');

      expect(recordRedisFailOpen).not.toHaveBeenCalled();
      expect(memory).not.toHaveBeenCalled();
    });
  });

  describe('Redis 를 쓸 수 없을 때 메모리 저장소로 내려간다', () => {
    it('Redis 가 설정되지 않았으면(클라이언트 null) 메모리 저장소로 세고 지표는 세지 않는다', async () => {
      const recordRedisFailOpen = jest.fn();
      const memory = jest.spyOn(ThrottlerStorageService.prototype, 'increment');
      const { storage } = makeStorage({
        client: null,
        metrics: { recordRedisFailOpen },
      });

      const first = await storage.increment('k1', 60_000, 1, 60_000, 'default');
      const second = await storage.increment(
        'k1',
        60_000,
        1,
        60_000,
        'default',
      );

      expect(memory).toHaveBeenCalledTimes(2);
      expect(first.isBlocked).toBe(false);
      // 메모리 저장소도 한도를 건다. 제한이 꺼지지 않는다.
      expect(second.isBlocked).toBe(true);
      expect(recordRedisFailOpen).not.toHaveBeenCalled();
      storage.onApplicationShutdown();
    });

    it('Redis 명령이 실패하면 그 요청을 메모리 저장소로 세고 throttler · incr_failed 를 한 번 센다', async () => {
      const recordRedisFailOpen = jest.fn();
      const evalMock = jest
        .fn<EvalFn>()
        .mockRejectedValue(new Error('ECONNREFUSED'));
      const memory = jest.spyOn(ThrottlerStorageService.prototype, 'increment');
      const { storage } = makeStorage({
        client: { eval: evalMock },
        metrics: { recordRedisFailOpen },
      });

      const record = await storage.increment(
        'k1',
        60_000,
        100,
        60_000,
        'default',
      );

      expect(memory).toHaveBeenCalledWith('k1', 60_000, 100, 60_000, 'default');
      expect(record.totalHits).toBe(1);
      expect(record.isBlocked).toBe(false);
      expect(recordRedisFailOpen).toHaveBeenCalledTimes(1);
      expect(recordRedisFailOpen).toHaveBeenCalledWith(
        'throttler',
        'incr_failed',
      );
      storage.onApplicationShutdown();
    });

    it('Redis 가 제한 시간 안에 답하지 않으면 메모리 저장소로 센다', async () => {
      jest.useFakeTimers();
      const recordRedisFailOpen = jest.fn();
      const evalMock = jest.fn<EvalFn>(() => new Promise(() => undefined));
      const { storage } = makeStorage({
        client: { eval: evalMock },
        metrics: { recordRedisFailOpen },
      });

      let settled = false;
      const pending = storage
        .increment('k1', 60_000, 100, 60_000, 'default')
        .finally(() => {
          settled = true;
        });
      await jest.advanceTimersByTimeAsync(
        REDIS_THROTTLER_COMMAND_TIMEOUT_MS - 1,
      );
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      const record = await pending;

      expect(record.totalHits).toBe(1);
      expect(recordRedisFailOpen).toHaveBeenCalledWith(
        'throttler',
        'incr_failed',
      );
      storage.onApplicationShutdown();
    });

    it('주입한 제한 시간이 있으면 그 시간까지 Redis 응답을 기다린다', async () => {
      jest.useFakeTimers();
      const evalMock = jest.fn<EvalFn>(() => new Promise(() => undefined));
      const { storage } = makeStorage({
        client: { eval: evalMock },
        timing: { commandTimeoutMs: 2_000, retryAfterFailureMs: 5_000 },
      });

      let settled = false;
      const pending = storage
        .increment('k1', 60_000, 100, 60_000, 'default')
        .finally(() => {
          settled = true;
        });
      await jest.advanceTimersByTimeAsync(1_999);
      expect(settled).toBe(false);
      await jest.advanceTimersByTimeAsync(1);
      expect((await pending).totalHits).toBe(1);
      storage.onApplicationShutdown();
    });

    it('주입한 재시도 대기가 있으면 실패 뒤 그 시간 동안만 Redis 를 부르지 않는다', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const evalMock = jest
        .fn<EvalFn>()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue([1, 60_000, 0, 0]);
      const { storage } = makeStorage({
        client: { eval: evalMock },
        timing: { commandTimeoutMs: 250, retryAfterFailureMs: 100 },
      });

      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      now += 99;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(1);

      now += 1;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);
      storage.onApplicationShutdown();
    });

    it.each([
      ['배열이 아님', 'OK'],
      ['길이가 다름', [1, 2, 3]],
      ['숫자가 아님', ['x', 60_000, 0, 0]],
    ])(
      '응답 모양이 다르면(%s) 실패로 보고 메모리 저장소로 센다',
      async (_label, reply) => {
        const recordRedisFailOpen = jest.fn();
        const { storage } = makeStorage({
          client: { eval: jest.fn<EvalFn>().mockResolvedValue(reply) },
          metrics: { recordRedisFailOpen },
        });

        const record = await storage.increment(
          'k1',
          60_000,
          100,
          60_000,
          'default',
        );

        expect(record.totalHits).toBe(1);
        expect(recordRedisFailOpen).toHaveBeenCalledWith(
          'throttler',
          'incr_failed',
        );
        storage.onApplicationShutdown();
      },
    );

    it('실패 뒤 대기 시간 동안은 Redis 를 다시 부르지 않고, 지나면 다시 Redis 로 센다', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const recordRedisFailOpen = jest.fn();
      const evalMock = jest
        .fn<EvalFn>()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockResolvedValue([1, 60_000, 0, 0]);
      const { storage } = makeStorage({
        client: { eval: evalMock },
        metrics: { recordRedisFailOpen },
      });

      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS - 1;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(1);
      // 대기 중 메모리로 센 요청은 Redis 실패가 아니라서 세지 않는다.
      expect(recordRedisFailOpen).toHaveBeenCalledTimes(1);

      now += 1;
      const record = await storage.increment(
        'k1',
        60_000,
        100,
        60_000,
        'default',
      );
      expect(evalMock).toHaveBeenCalledTimes(2);
      expect(record.timeToExpire).toBe(60);
      storage.onApplicationShutdown();
    });

    it('대기가 끝나면 한 요청만 Redis 를 다시 부르고, 그 응답을 기다리는 동안 온 요청은 메모리로 센다', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      let resolveProbe: (value: unknown) => void = () => undefined;
      const evalMock = jest
        .fn<EvalFn>()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveProbe = resolve;
            }),
        )
        .mockResolvedValue([2, 60_000, 0, 0]);
      const memory = jest.spyOn(ThrottlerStorageService.prototype, 'increment');
      const { storage } = makeStorage({ client: { eval: evalMock } });
      const logger = (
        storage as unknown as {
          logger: { warn: (m: string) => void; log: (m: string) => void };
        }
      ).logger;
      jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);

      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
      const probe = storage.increment('k1', 60_000, 100, 60_000, 'default');
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);
      expect(memory).toHaveBeenCalledTimes(2);

      resolveProbe([1, 60_000, 0, 0]);
      expect(log).not.toHaveBeenCalled();
      await expect(probe).resolves.toMatchObject({ totalHits: 1 });
      expect(log).toHaveBeenCalledTimes(1);
      // 다시 붙은 뒤에는 대기 없이 Redis 로 센다.
      await expect(
        storage.increment('k1', 60_000, 100, 60_000, 'default'),
      ).resolves.toMatchObject({ totalHits: 2 });
      expect(evalMock).toHaveBeenCalledTimes(3);
      expect(memory).toHaveBeenCalledTimes(2);
      // 복구 뒤 일반 성공 요청은 복구 로그를 다시 남기지 않는다.
      expect(log).toHaveBeenCalledTimes(1);
      storage.onApplicationShutdown();
    });

    it('장애 전에 시작한 요청이 장애 중에 늦게 성공해도 대기를 풀지 않는다', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      let rejectA: (err: Error) => void = () => undefined;
      let resolveB: (value: unknown) => void = () => undefined;
      const evalMock = jest
        .fn<EvalFn>()
        .mockImplementationOnce(
          () =>
            new Promise((_resolve, reject) => {
              rejectA = reject;
            }),
        )
        .mockImplementationOnce(
          () =>
            new Promise((resolve) => {
              resolveB = resolve;
            }),
        )
        .mockResolvedValue([1, 60_000, 0, 0]);
      const { storage } = makeStorage({ client: { eval: evalMock } });
      const logger = (
        storage as unknown as {
          logger: { warn: (m: string) => void; log: (m: string) => void };
        }
      ).logger;
      jest.spyOn(logger, 'warn').mockImplementation(() => undefined);
      const log = jest.spyOn(logger, 'log').mockImplementation(() => undefined);

      const a = storage.increment('k1', 60_000, 100, 60_000, 'default');
      const b = storage.increment('k1', 60_000, 100, 60_000, 'default');
      rejectA(new Error('ECONNRESET'));
      await a;
      resolveB([1, 60_000, 0, 0]);
      await b;

      // B 가 성공했어도 probe 가 아니므로 복구 로그도 없고 대기도 그대로다.
      expect(log).not.toHaveBeenCalled();
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);

      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(3);
      expect(log).toHaveBeenCalledTimes(1);
      storage.onApplicationShutdown();
    });

    it('재시도(probe)가 제한 시간을 넘기면 대기를 새로 걸고 경고를 다시 남긴다', async () => {
      jest.useFakeTimers();
      let now = Date.now();
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const evalMock = jest
        .fn<EvalFn>()
        .mockRejectedValueOnce(new Error('ECONNREFUSED'))
        .mockImplementationOnce(() => new Promise(() => undefined))
        .mockResolvedValue([1, 60_000, 0, 0]);
      const recordRedisFailOpen = jest.fn();
      const { storage } = makeStorage({
        client: { eval: evalMock },
        metrics: { recordRedisFailOpen },
      });
      const warn = jest
        .spyOn(
          (storage as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
      const probe = storage.increment('k1', 60_000, 100, 60_000, 'default');
      await jest.advanceTimersByTimeAsync(REDIS_THROTTLER_COMMAND_TIMEOUT_MS);
      await probe;

      expect(warn).toHaveBeenCalledTimes(2);
      expect(recordRedisFailOpen).toHaveBeenCalledTimes(2);
      // 대기가 새로 걸렸다.
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);
      storage.onApplicationShutdown();
    });

    it('동시에 실패한 요청은 지표를 요청마다 세고 경고 로그는 한 번만 남긴다', async () => {
      const recordRedisFailOpen = jest.fn();
      const rejecters: Array<(err: Error) => void> = [];
      const evalMock = jest.fn<EvalFn>(
        () =>
          new Promise((_resolve, reject) => {
            rejecters.push(reject);
          }),
      );
      const { storage } = makeStorage({
        client: { eval: evalMock },
        metrics: { recordRedisFailOpen },
      });
      const warn = jest
        .spyOn(
          (storage as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      const calls = [1, 2, 3].map(() =>
        storage.increment('k1', 60_000, 100, 60_000, 'default'),
      );
      expect(evalMock).toHaveBeenCalledTimes(3);
      rejecters.forEach((reject) => reject(new Error('ECONNRESET')));
      await Promise.all(calls);

      expect(recordRedisFailOpen).toHaveBeenCalledTimes(3);
      expect(warn).toHaveBeenCalledTimes(1);
      storage.onApplicationShutdown();
    });

    it('다시 부른 Redis 도 실패하면 경고를 다시 남기고 또 대기한다', async () => {
      let now = 1_000_000;
      jest.spyOn(Date, 'now').mockImplementation(() => now);
      const evalMock = jest.fn<EvalFn>().mockRejectedValue(new Error('down'));
      const { storage } = makeStorage({ client: { eval: evalMock } });
      const warn = jest
        .spyOn(
          (storage as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);
      expect(warn).toHaveBeenCalledTimes(2);

      now += REDIS_THROTTLER_RETRY_AFTER_FAILURE_MS - 1;
      await storage.increment('k1', 60_000, 100, 60_000, 'default');
      expect(evalMock).toHaveBeenCalledTimes(2);
      storage.onApplicationShutdown();
    });

    it('지표 서비스가 없어도 메모리 저장소로 센다', async () => {
      const { storage } = makeStorage({
        client: {
          eval: jest.fn<EvalFn>().mockRejectedValue(new Error('down')),
        },
      });

      await expect(
        storage.increment('k1', 60_000, 100, 60_000, 'default'),
      ).resolves.toMatchObject({ totalHits: 1, isBlocked: false });
      storage.onApplicationShutdown();
    });
  });

  it('종료 때 메모리 저장소를 정리한다', () => {
    const shutdown = jest.spyOn(
      ThrottlerStorageService.prototype,
      'onApplicationShutdown',
    );
    const { storage } = makeStorage({ client: null });

    storage.onApplicationShutdown();

    expect(shutdown).toHaveBeenCalledTimes(1);
  });
});
