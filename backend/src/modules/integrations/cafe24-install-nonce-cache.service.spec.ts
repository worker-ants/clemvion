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

  // W-39 — HMAC prefix(8자) 만으로 키를 만들기 때문에, 첫 8자가 동일하고
  // 나머지가 다른 두 HMAC 은 동일 nonce key 로 합쳐진다. 즉 두 번째 호출이
  // 실제론 다른 HMAC 임에도 replay 로 마킹된다. 이건 의도된 trade-off
  // (충돌 확률 64^8 = 2.8e14 로 사실상 무시 가능) 이지만, 그 trade-off 가
  // 변동 없이 유지된다는 invariant 를 회귀로 박제한다 — 누군가 prefix 길이
  // 를 손대거나 키 전략을 바꾸면 본 테스트가 명시적 신호를 준다.
  it('HMAC prefix collision: same first-8-chars maps to same nonce key (documented trade-off)', async () => {
    redis.set.mockResolvedValueOnce('OK').mockResolvedValueOnce(null);
    const first = await cache.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'AAAA1234-payload-one',
    });
    const second = await cache.isReplay({
      mallId: 'myshop',
      timestamp: '1700000000',
      hmac: 'AAAA1234-payload-two-DIFFERENT',
    });

    expect(first).toBe(false);
    expect(second).toBe(true);

    const keys = redis.set.mock.calls.map((c) => c[0] as string);
    expect(keys[0]).toBe(keys[1]);
    expect(keys[0]).toContain(':AAAA1234');
  });
});
