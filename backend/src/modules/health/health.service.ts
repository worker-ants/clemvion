import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { InjectDataSource } from '@nestjs/typeorm';
import Redis from 'ioredis';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class HealthService {
  private redis: Redis;
  private startTime: number;

  constructor(
    @InjectDataSource() private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
  ) {
    this.redis = new Redis({
      host: this.configService.get<string>('redis.host'),
      port: this.configService.get<number>('redis.port'),
      lazyConnect: true,
    });
    this.startTime = Date.now();
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
