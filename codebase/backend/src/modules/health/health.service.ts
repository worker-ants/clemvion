import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import type Redis from 'ioredis';
import { RedisConnectionProvider } from '../../common/redis/redis-connection.provider';

@Injectable()
export class HealthService {
  private redis: Redis;
  private startTime: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly redisConn: RedisConnectionProvider,
  ) {
    // 공유 command 연결 (INFO-12) — RedisConnectionProvider 가 host/port/password/tls
    // config 를 한 곳에서 관리·소유·종료. /health 의 redis ping 도 이 단일 연결 사용.
    this.redis = this.redisConn.getClient();
    this.startTime = Date.now();
  }

  // 공유 connection 은 RedisConnectionProvider 가 소유·종료 (INFO-12) — 본 서비스는 quit 안 함.

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

    // Redis check
    try {
      const redisStart = Date.now();
      await this.redis.ping();
      checks.redis = { status: 'healthy', latency: Date.now() - redisStart };
    } catch {
      checks.redis = { status: 'unhealthy' };
      overallStatus = 'unhealthy';
    }

    return {
      status: overallStatus,
      version: '1.0.0',
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
      checks,
    };
  }
}
