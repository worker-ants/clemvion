import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

/**
 * `/health` liveness/readiness 집계 서비스 (INFO-18).
 *
 * DB(`SELECT 1`) 와 공유 Redis 연결(`ping`) 을 점검해 단일 상태 객체로 묶는다.
 * Redis 는 {@link RedisConnectionProvider} 의 공유 command 연결을 재사용하며,
 * config 누락 시 앱 부팅을 막지 않도록 **생성자에서 `getClientOrNull()`** 로
 * lazy-degrade 한다 (W-1) — 다른 7개 소비자와 동일한 null-degrade 정책.
 *
 * {@link check} 반환 구조:
 * ```
 * {
 *   status: 'healthy' | 'unhealthy',   // 하나라도 비정상이면 'unhealthy'
 *   version: string,
 *   uptime: number,                    // 프로세스 가동 초
 *   checks: {
 *     database: { status: 'healthy' | 'unhealthy', latency?: number },
 *     redis:    { status: 'healthy' | 'unhealthy' | 'unconfigured', latency?: number },
 *   },
 * }
 * ```
 */
@Injectable()
export class HealthService {
  /** 공유 command 연결 — config 누락 시 null (W-1, null-degrade). */
  private redis: Redis | null;
  private startTime: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisConn: RedisConnectionProvider,
  ) {
    // 공유 command 연결 (INFO-12) — RedisConnectionProvider 가 host/port/password/tls
    // config 를 한 곳에서 관리·소유·종료. /health 의 redis ping 도 이 단일 연결 사용.
    // W-1: getClient() (eager throw) 대신 getClientOrNull() — Redis config 누락 시에도
    // 앱 부팅이 막히지 않고 /health 가 'unconfigured' 로 degrade 응답한다.
    this.redis = this.redisConn.getClientOrNull();
    this.startTime = Date.now();
  }

  // 공유 connection 은 RedisConnectionProvider 가 소유·종료 (INFO-12) — 본 서비스는 quit 안 함.

  /**
   * DB + Redis 헬스 점검 후 집계 상태 반환. Redis 미설정(null) 시 redis 체크는
   * `{ status: 'unconfigured' }` 로 표기하되 전체 status 는 'unhealthy' 로 내려
   * 외부 모니터가 미구성 상태를 감지할 수 있게 한다.
   */
  async check() {
    const checks: Record<string, { status: string; latency?: number }> = {};
    let overallStatus = 'healthy';

    // Database check
    try {
      const dbStart = Date.now();
      await this.dataSource.query('SELECT 1');
      checks.database = { status: 'healthy', latency: Date.now() - dbStart };
    } catch {
      checks.database = { status: 'unhealthy' };
      overallStatus = 'unhealthy';
    }

    // Redis check — config 누락 시 client 가 null (W-1).
    if (!this.redis) {
      checks.redis = { status: 'unconfigured' };
      overallStatus = 'unhealthy';
    } else {
      try {
        const redisStart = Date.now();
        await this.redis.ping();
        checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
      } catch {
        checks.redis = { status: 'unhealthy' };
        overallStatus = 'unhealthy';
      }
    }

    return {
      status: overallStatus,
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }
}
