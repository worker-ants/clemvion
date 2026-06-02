/**
 * RedisConnectionProvider 단위 테스트 (ai-review C-1).
 *
 * 8개 소비자가 의존하는 공유 command 연결 provider 의 전 분기를 검증한다:
 *  - getClient(): 첫 호출 lazy 생성 + 캐시 재사용, config 누락 throw
 *  - new Redis opts: password/tls 4분기 (있음/없음 조합)
 *  - getClientOrNull(): 정상 client / 누락 시 null (+ 최초 1회만 warn, INFO-4)
 *  - onModuleDestroy(): quit 호출 + client null reset, client 없을 때 안전 (W-2)
 *  - port === 0 이 유효값으로 처리됨 (W-10 — 누락 오인 안 함)
 *
 * `ioredis` 는 jest.mock 으로 대체 — 실제 연결 없이 `new Redis(opts)` 의
 * 생성자 인자와 `quit`/`on` 호출만 관찰한다.
 */
import { ConfigService } from '@nestjs/config';
import RedisDefault from 'ioredis';
import { RedisConnectionProvider } from './redis-connection.provider';

// ioredis default export 를 생성자 mock 으로 대체.
// 인스턴스마다 on/quit jest.fn 을 갖고, 마지막 생성자 인자를 노출한다.
const redisInstances: Array<{
  opts: unknown;
  on: jest.Mock;
  quit: jest.Mock;
  ping: jest.Mock;
}> = [];

jest.mock('ioredis', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation((opts: unknown) => {
      const inst = {
        opts,
        on: jest.fn(),
        quit: jest.fn().mockResolvedValue('OK'),
        ping: jest.fn().mockResolvedValue('PONG'),
      };
      redisInstances.push(inst);
      return inst;
    }),
  };
});

// jest.mock 으로 대체된 default export 를 생성자 mock 으로 캐스팅해 호출 횟수 검증.
const Redis = RedisDefault as unknown as jest.Mock;

/**
 * ConfigService stub — 주어진 map 의 키만 반환, 나머지는 undefined.
 */
function makeConfig(values: Record<string, unknown>): ConfigService {
  return {
    get: jest.fn((key: string) => values[key]),
  } as unknown as ConfigService;
}

describe('RedisConnectionProvider', () => {
  beforeEach(() => {
    redisInstances.length = 0;
    Redis.mockClear();
  });

  describe('getClient()', () => {
    it('첫 호출 시 client 를 생성하고 host/port opts 를 전달한다', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'localhost', 'redis.port': 6379 }),
      );
      const client = provider.getClient();
      expect(Redis).toHaveBeenCalledTimes(1);
      expect(redisInstances).toHaveLength(1);
      expect(redisInstances[0].opts).toMatchObject({
        host: 'localhost',
        port: 6379,
        enableReadyCheck: true,
        maxRetriesPerRequest: 3,
        lazyConnect: true,
      });
      // 'error' 이벤트 핸들러가 한 곳에서 등록된다.
      expect(redisInstances[0].on).toHaveBeenCalledWith(
        'error',
        expect.any(Function),
      );
      expect(client).toBe(redisInstances[0]);
    });

    it('두 번째 호출은 캐시된 동일 인스턴스를 재사용한다 (새 Redis 생성 안 함)', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'localhost', 'redis.port': 6379 }),
      );
      const a = provider.getClient();
      const b = provider.getClient();
      expect(a).toBe(b);
      expect(Redis).toHaveBeenCalledTimes(1);
    });

    it('host 누락 시 throw', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.port': 6379 }),
      );
      expect(() => provider.getClient()).toThrow(/redis\.host/);
      expect(Redis).not.toHaveBeenCalled();
    });

    it('port 누락(undefined) 시 throw', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'localhost' }),
      );
      expect(() => provider.getClient()).toThrow(/redis\.port/);
      expect(Redis).not.toHaveBeenCalled();
    });

    it('W-10: port === 0 은 유효값 — 누락으로 오인하지 않는다', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'localhost', 'redis.port': 0 }),
      );
      expect(() => provider.getClient()).not.toThrow();
      expect(redisInstances[0].opts).toMatchObject({ port: 0 });
    });

    describe('password / tls 4분기 → new Redis opts', () => {
      it('password 없음 + tls 없음 → 두 키 모두 미포함', () => {
        const provider = new RedisConnectionProvider(
          makeConfig({ 'redis.host': 'h', 'redis.port': 6379 }),
        );
        provider.getClient();
        const opts = redisInstances[0].opts as Record<string, unknown>;
        expect(opts).not.toHaveProperty('password');
        expect(opts).not.toHaveProperty('tls');
      });

      it('password 있음 + tls 없음 → password 만 포함', () => {
        const provider = new RedisConnectionProvider(
          makeConfig({
            'redis.host': 'h',
            'redis.port': 6379,
            'redis.password': 'secret',
          }),
        );
        provider.getClient();
        const opts = redisInstances[0].opts as Record<string, unknown>;
        expect(opts.password).toBe('secret');
        expect(opts).not.toHaveProperty('tls');
      });

      it('password 없음 + tls 있음 → tls:{} 만 포함', () => {
        const provider = new RedisConnectionProvider(
          makeConfig({
            'redis.host': 'h',
            'redis.port': 6379,
            'redis.tls': true,
          }),
        );
        provider.getClient();
        const opts = redisInstances[0].opts as Record<string, unknown>;
        expect(opts.tls).toEqual({});
        expect(opts).not.toHaveProperty('password');
      });

      it('password 있음 + tls 있음 → 둘 다 포함', () => {
        const provider = new RedisConnectionProvider(
          makeConfig({
            'redis.host': 'h',
            'redis.port': 6379,
            'redis.password': 'secret',
            'redis.tls': true,
          }),
        );
        provider.getClient();
        const opts = redisInstances[0].opts as Record<string, unknown>;
        expect(opts.password).toBe('secret');
        expect(opts.tls).toEqual({});
      });
    });
  });

  describe('getClientOrNull()', () => {
    it('정상 config → client 반환 (getClient 와 동일 인스턴스)', () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'h', 'redis.port': 6379 }),
      );
      const client = provider.getClientOrNull();
      expect(client).toBe(redisInstances[0]);
    });

    it('config 누락 → null 반환 (throw 안 함)', () => {
      const provider = new RedisConnectionProvider(makeConfig({}));
      expect(provider.getClientOrNull()).toBeNull();
    });

    it('INFO-4: config 누락 반복 호출 시 warn 은 최초 1회만', () => {
      const provider = new RedisConnectionProvider(makeConfig({}));
      const warnSpy = jest
        .spyOn(
          (provider as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      provider.getClientOrNull();
      provider.getClientOrNull();
      provider.getClientOrNull();
      expect(warnSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('onModuleDestroy()', () => {
    it('생성된 client 를 quit 하고 캐시를 null 로 reset (W-2)', async () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'h', 'redis.port': 6379 }),
      );
      provider.getClient();
      const inst = redisInstances[0];
      await provider.onModuleDestroy();
      expect(inst.quit).toHaveBeenCalledTimes(1);
      // reset 검증: destroy 이후 getClient 는 새 인스턴스를 만든다.
      provider.getClient();
      expect(Redis).toHaveBeenCalledTimes(2);
    });

    it('client 가 없을 때 안전하게 no-op (quit 호출 없음)', async () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'h', 'redis.port': 6379 }),
      );
      await expect(provider.onModuleDestroy()).resolves.toBeUndefined();
      expect(redisInstances).toHaveLength(0);
    });

    it('quit 이 reject 해도 swallow (throw 안 함)', async () => {
      const provider = new RedisConnectionProvider(
        makeConfig({ 'redis.host': 'h', 'redis.port': 6379 }),
      );
      provider.getClient();
      redisInstances[0].quit.mockRejectedValueOnce(new Error('quit failed'));
      await expect(provider.onModuleDestroy()).resolves.toBeUndefined();
    });
  });
});
