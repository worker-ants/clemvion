/**
 * HealthService 단위 테스트 (ai-review W-1).
 *
 * 검증 분기:
 *  - Redis 정상: ping 성공 → checks.redis healthy
 *  - Redis ping 실패: checks.redis unhealthy + overall unhealthy
 *  - Redis 미설정(getClientOrNull null): checks.redis 'unconfigured' + overall unhealthy,
 *    그리고 생성자가 throw 하지 않아 앱 부팅이 막히지 않음 (W-1 핵심)
 *  - DB 실패 분기
 */
import { HealthService } from './health.service';
import type { DataSource } from 'typeorm';
import type { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

type RedisStub = { ping: jest.Mock };

function makeDataSource(ok = true): DataSource {
  return {
    query: jest.fn(async () => {
      if (!ok) throw new Error('db down');
      return [{ '?column?': 1 }];
    }),
  } as unknown as DataSource;
}

/** redisClient=null 이면 getClientOrNull 이 null 을 반환 (config 누락 시뮬레이션). */
function makeRedisConn(redisClient: RedisStub | null): RedisConnectionProvider {
  return {
    getClientOrNull: jest.fn(() => redisClient),
    getClient: jest.fn(() => {
      if (!redisClient) throw new Error('redis unavailable');
      return redisClient;
    }),
  } as unknown as RedisConnectionProvider;
}

describe('HealthService', () => {
  it('Redis 정상 → checks.redis healthy, overall healthy', async () => {
    const redis: RedisStub = { ping: jest.fn().mockResolvedValue('PONG') };
    const service = new HealthService(
      makeDataSource(true),
      makeRedisConn(redis),
    );
    const result = await service.check();
    expect(result.status).toBe('healthy');
    expect(result.checks.redis.status).toBe('healthy');
    expect(redis.ping).toHaveBeenCalledTimes(1);
  });

  it('Redis ping 실패 → checks.redis unhealthy, overall unhealthy', async () => {
    const redis: RedisStub = {
      ping: jest.fn().mockRejectedValue(new Error('timeout')),
    };
    const service = new HealthService(
      makeDataSource(true),
      makeRedisConn(redis),
    );
    const result = await service.check();
    expect(result.status).toBe('unhealthy');
    expect(result.checks.redis.status).toBe('unhealthy');
  });

  it('W-1: Redis 미설정(null) → 생성자 throw 없음 + checks.redis unconfigured', async () => {
    // getClientOrNull 이 null → 생성자에서 throw 하지 않아야 한다 (앱 부팅 안전).
    let service: HealthService | undefined;
    expect(() => {
      service = new HealthService(makeDataSource(true), makeRedisConn(null));
    }).not.toThrow();
    const result = await service!.check();
    expect(result.checks.redis.status).toBe('unconfigured');
    expect(result.status).toBe('unhealthy');
  });

  it('DB 실패 → checks.database unhealthy, overall unhealthy', async () => {
    const redis: RedisStub = { ping: jest.fn().mockResolvedValue('PONG') };
    const service = new HealthService(
      makeDataSource(false),
      makeRedisConn(redis),
    );
    const result = await service.check();
    expect(result.checks.database.status).toBe('unhealthy');
    expect(result.status).toBe('unhealthy');
  });

  it('uptime/version 필드 형태', async () => {
    const redis: RedisStub = { ping: jest.fn().mockResolvedValue('PONG') };
    const service = new HealthService(
      makeDataSource(true),
      makeRedisConn(redis),
    );
    const result = await service.check();
    expect(result.version).toBe('1.0.0');
    expect(typeof result.uptime).toBe('number');
    expect(result.uptime).toBeGreaterThanOrEqual(0);
  });
});
