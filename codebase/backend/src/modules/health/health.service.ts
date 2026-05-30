import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService implements OnModuleDestroy {
  private redis: Redis;
  private startTime: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    // redis.config 의 password/tls 옵션을 누락 없이 전달 — cafe24-install-nonce-cache
    // / continuation-bus 의 동일 패턴과 일치. AUTH 운영 환경에서 /health 의 redis
    // 체크가 ECONNREFUSED 로 false-negative unhealthy 가 되던 잠복 결함 해소.
    const password = this.configService.get<string>('redis.password');
    const tls = this.configService.get<boolean>('redis.tls');
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      ...(password ? { password } : {}),
      ...(tls ? { tls: {} } : {}),
      lazyConnect: true,
    });
    this.startTime = Date.now();
  }

  onModuleDestroy(): void {
    // 모듈 종료 시 ioredis 연결을 정리 — connection leak 방지.
    void this.redis.quit();
  }

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
