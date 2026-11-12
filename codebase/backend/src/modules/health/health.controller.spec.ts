import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import request from 'supertest';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TransformInterceptor } from '../../common/interceptors/transform.interceptor';
import { wrapDataSchema } from '../../common/swagger';
import { HealthCheckDto } from './dto/responses/health-response.dto';

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

// 근거: [로깅과 헬스 체크 「/api/health 응답」](CLE-OBS-LOGGING#apihealth-응답),
// [에러 응답과 클라이언트 처리](CLE-API-ERROR) 규칙 1 의 헬스 체크 503 예외.
describe('HealthController (HTTP wire — 응답 봉투)', () => {
  let app: INestApplication;
  const check = jest.fn();

  beforeEach(() => check.mockReset());

  afterEach(async () => {
    if (app) await app.close();
  });

  // 운영과 같이 TransformInterceptor 를 전역(APP_INTERCEPTOR)으로 건다.
  const boot = async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: HealthService, useValue: { check } },
        { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  };

  it('healthy 200 → { data: { status, version, uptime, checks } }', async () => {
    check.mockResolvedValue(HEALTHY);
    await boot();
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ data: HEALTHY });
  });

  it('unhealthy 503 도 에러 봉투가 아니라 200 과 같은 { data } 본문이다', async () => {
    check.mockResolvedValue(UNHEALTHY);
    await boot();
    const res = await request(app.getHttpServer()).get('/health').expect(503);
    expect(res.body).toEqual({ data: UNHEALTHY });
    expect(res.body).not.toHaveProperty('error');
  });

  it('/health/live 200 → { data: { status: "ok" } }', async () => {
    await boot();
    const res = await request(app.getHttpServer())
      .get('/health/live')
      .expect(200);
    expect(res.body).toEqual({ data: { status: 'ok' } });
  });
});

// `@nestjs/swagger` 가 응답 데코레이터 메타데이터를 싣는 키(`DECORATORS.API_RESPONSE`).
const SWAGGER_API_RESPONSE_METADATA = 'swagger/apiResponse';

const advertisedResponses = (
  handler: (...args: never[]) => unknown,
): Record<string, { schema?: unknown; type?: unknown }> =>
  (Reflect.getMetadata(SWAGGER_API_RESPONSE_METADATA, handler) as
    Record<string, { schema?: unknown; type?: unknown }> | undefined) ?? {};

describe('HealthController (OpenAPI 응답 문서 = wire 형태)', () => {
  it('readiness 503 을 200 과 같은 { data: HealthCheckDto } 로 문서화한다', () => {
    const responses = advertisedResponses(HealthController.prototype.check);
    expect(responses['503']?.schema).toEqual(wrapDataSchema(HealthCheckDto));
    expect(responses['503']?.type).toBeUndefined();
    expect(responses['200']?.schema).toEqual(responses['503']?.schema);
  });

  it('liveness 200 을 { data: { status: "ok" } } 로 문서화한다', () => {
    const responses = advertisedResponses(HealthController.prototype.live);
    expect(responses['200']?.schema).toEqual({
      type: 'object',
      required: ['data'],
      properties: {
        data: {
          type: 'object',
          required: ['status'],
          properties: { status: { type: 'string', example: 'ok' } },
        },
      },
    });
  });
});
