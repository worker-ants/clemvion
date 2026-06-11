import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

const HEALTHY = {
  status: 'healthy',
  version: '1.0.0',
  uptime: 100,
  checks: {
    database: { status: 'healthy', latency: 5 },
    redis: { status: 'healthy', latency: 2 },
  },
};

const UNHEALTHY = {
  status: 'unhealthy',
  version: '1.0.0',
  uptime: 100,
  checks: {
    database: { status: 'unhealthy' },
    redis: { status: 'healthy', latency: 2 },
  },
};

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;
  let mockRes: Response;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check: jest.fn() } }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
    mockRes = { status: jest.fn().mockReturnThis() } as unknown as Response;
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('GET /api/health (readiness)', () => {
    it('healthy → body 반환 + HTTP 200', async () => {
      jest.spyOn(service, 'check').mockResolvedValue(HEALTHY);

      const result = await controller.check(mockRes);

      expect(result).toEqual(HEALTHY);
      expect(mockRes.status).toHaveBeenCalledWith(HttpStatus.OK);
    });

    it('unhealthy → body(구조 보존) 반환 + HTTP 503', async () => {
      jest.spyOn(service, 'check').mockResolvedValue(UNHEALTHY);

      const result = await controller.check(mockRes);

      // body 는 그대로 유지 (GlobalExceptionFilter shape 로 변형되지 않음)
      expect(result).toEqual(UNHEALTHY);
      expect(result.status).toBe('unhealthy');
      expect(mockRes.status).toHaveBeenCalledWith(
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    });
  });

  describe('GET /api/health/live (liveness)', () => {
    it('의존성 점검 없이 항상 { status: "ok" } 반환', () => {
      expect(controller.live()).toEqual({ status: 'ok' });
      // HealthService.check 를 호출하지 않는다
      expect(service.check).not.toHaveBeenCalled();
    });
  });
});

describe('HealthController (HTTP wire — status code)', () => {
  let app: INestApplication;
  const check = jest.fn();

  beforeEach(() => check.mockReset());

  afterEach(async () => {
    if (app) await app.close();
  });

  const boot = async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: HealthService, useValue: { check } }],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  };

  it('healthy → 실제 HTTP 200 + body 구조 검증', async () => {
    check.mockResolvedValue(HEALTHY);
    await boot();
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body.status).toBe('healthy');
    // unhealthy 케이스와 대칭 — checks 내부 구조까지 검증
    expect(res.body.checks.database.status).toBe('healthy');
    expect(res.body.checks.redis.status).toBe('healthy');
  });

  it('unhealthy → 실제 HTTP 503 + body 유지', async () => {
    check.mockResolvedValue(UNHEALTHY);
    await boot();
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body.status).toBe('unhealthy');
    expect(res.body.checks.database.status).toBe('unhealthy');
  });

  it('/health/live → 항상 HTTP 200', async () => {
    check.mockResolvedValue(UNHEALTHY); // 의존성이 죽어도 liveness 는 200
    await boot();
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body.status).toBe('ok');
    expect(check).not.toHaveBeenCalled();
  });
});
