import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';

describe('HealthController', () => {
  let controller: HealthController;
  let service: HealthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: HealthService,
          useValue: {
            check: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    service = module.get<HealthService>(HealthService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should return health status', async () => {
    const mockResponse = {
      status: 'healthy',
      version: '1.0.0',
      uptime: 100,
      checks: {
        database: { status: 'healthy', latency: 5 },
        redis: { status: 'healthy', latency: 2 },
      },
    };
    jest.spyOn(service, 'check').mockResolvedValue(mockResponse);

    const result = await controller.check();
    expect(result).toEqual(mockResponse);
    expect(result.status).toBe('healthy');
    expect(result.checks.database.status).toBe('healthy');
    expect(result.checks.redis.status).toBe('healthy');
  });

  it('should return unhealthy when database fails', async () => {
    const mockResponse = {
      status: 'unhealthy',
      version: '1.0.0',
      uptime: 100,
      checks: {
        database: { status: 'unhealthy' },
        redis: { status: 'healthy', latency: 2 },
      },
    };
    jest.spyOn(service, 'check').mockResolvedValue(mockResponse);

    const result = await controller.check();
    expect(result.status).toBe('unhealthy');
  });
});
