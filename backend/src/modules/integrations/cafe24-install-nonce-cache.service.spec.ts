import { Cafe24InstallNonceCache } from './cafe24-install-nonce-cache.service';

type Mock = jest.Mock;

function makeRedisMock(): Record<string, Mock> {
  return {
    set: jest.fn(),
    quit: jest.fn().mockResolvedValue(undefined),
  };
}

describe('Cafe24InstallNonceCache', () => {
  let redis: Record<string, Mock>;
  let cache: Cafe24InstallNonceCache;

  beforeEach(() => {
    redis = makeRedisMock();
    cache = new Cafe24InstallNonceCache(undefined, redis as never);
  });

  it('first observation: SETNX returns OK → isReplay=false', async () => {
    redis.set.mockResolvedValue('OK');
    const result = await cache.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'abcd1234abcd1234abcd1234abcd1234abcd1234abcd',
    });
    expect(result).toBe(false);
    expect(redis.set).toHaveBeenCalledWith(
      expect.stringContaining('cafe24:install:nonce:myshop:1700000000:abcd1234'),
      '1',
      'EX',
      Cafe24InstallNonceCache.TTL_SEC,
      'NX',
    );
  });

  it('replay: SETNX returns null (key exists) → isReplay=true', async () => {
    redis.set.mockResolvedValue(null);
    const result = await cache.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'AAAA1234AAAA1234AAAA1234AAAA1234AAAA1234AAAA',
    });
    expect(result).toBe(true);
  });

  it('graceful degradation on Redis error → isReplay=false', async () => {
    redis.set.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await cache.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'XXXX1234XXXX1234XXXX1234XXXX1234XXXX1234XXXX',
    });
    // Redis 통신 실패 → 옛 정책 (±5분 윈도우만) 로 fallback. boolean false.
    expect(result).toBe(false);
  });

  it('graceful degradation when Redis is not configured', async () => {
    const noRedis = new Cafe24InstallNonceCache();
    const result = await noRedis.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'abcd',
    });
    expect(result).toBe(false);
  });

  it('different (mall_id, timestamp, hmac) yield different keys', async () => {
    redis.set.mockResolvedValue('OK');
    await cache.isReplay({
      mallId: 'shop-a',
      timestamp: '1700000000',
      hmac: 'aaaaaaaa-rest',
    });
    await cache.isReplay({
      mallId: 'shop-b',
      timestamp: '1700000000',
      hmac: 'aaaaaaaa-rest',
    });
    await cache.isReplay({
      mallId: 'shop-a',
      timestamp: '1700000001',
      hmac: 'aaaaaaaa-rest',
    });
    await cache.isReplay({
      mallId: 'shop-a',
      timestamp: '1700000000',
      hmac: 'bbbbbbbb-rest',
    });

    const keys = redis.set.mock.calls.map((c) => c[0] as string);
    expect(new Set(keys).size).toBe(4);
  });

  it('close() closes the Redis connection', async () => {
    await cache.close();
    expect(redis.quit).toHaveBeenCalled();
  });
});
