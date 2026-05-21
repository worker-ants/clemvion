import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TriggersService } from './triggers.service';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';

describe('TriggersService.findOneDetail', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getRepositoryToken(Execution),
          useValue: {},
        },
        {
          provide: getRepositoryToken(Schedule),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
      ],
    }).compile();

    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
  });

  it('schedule 타입 + 매칭 schedule 존재 시 cron/timezone/nextRunAt을 평탄화하여 반환', async () => {
    const nextRunAt = new Date('2026-05-06T00:00:00Z');
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'schedule',
      name: '매일 날씨 알림',
    } as unknown as Trigger);
    scheduleRepo.findOne.mockResolvedValue({
      id: 's1',
      triggerId: 't1',
      workspaceId: 'ws',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      nextRunAt,
    } as unknown as Schedule);

    const result = await service.findOneDetail('t1', 'ws');

    expect(scheduleRepo.findOne).toHaveBeenCalledWith({
      where: { triggerId: 't1', workspaceId: 'ws' },
    });
    expect(result).toEqual(
      expect.objectContaining({
        id: 't1',
        type: 'schedule',
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        nextRunAt,
      }),
    );
  });

  it('schedule 타입인데 매칭 schedule이 없으면 트리거를 그대로 반환 (cron 필드 없음)', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'schedule',
      name: '매일 날씨 알림',
    } as unknown as Trigger);
    scheduleRepo.findOne.mockResolvedValue(null);

    const result = (await service.findOneDetail('t1', 'ws')) as Record<
      string,
      unknown
    >;

    expect(result.id).toBe('t1');
    expect(result.cronExpression).toBeUndefined();
    expect(result.timezone).toBeUndefined();
    expect(result.nextRunAt).toBeUndefined();
  });

  it('webhook 타입은 schedule 조회를 skip', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't2',
      workspaceId: 'ws',
      type: 'webhook',
      name: '웹훅',
    } as unknown as Trigger);

    const result = await service.findOneDetail('t2', 'ws');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ id: 't2', type: 'webhook' }),
    );
  });

  it('manual 타입은 schedule 조회를 skip', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't3',
      workspaceId: 'ws',
      type: 'manual',
      name: '수동',
    } as unknown as Trigger);

    const result = await service.findOneDetail('t3', 'ws');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ id: 't3', type: 'manual' }),
    );
  });

  it('트리거가 존재하지 않으면 RESOURCE_NOT_FOUND NotFoundException을 throw', async () => {
    triggerRepo.findOne.mockResolvedValue(null);

    await expect(service.findOneDetail('missing', 'ws')).rejects.toMatchObject({
      response: { code: 'RESOURCE_NOT_FOUND' },
    });
    await expect(service.findOneDetail('missing', 'ws')).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
  });
});

describe('TriggersService — notification/interaction config 병합 (External Interaction API)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            create: jest.fn((x: Partial<Trigger>) => x as Trigger),
            save: jest.fn((x: Trigger) => Promise.resolve(x)),
            findOne: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        { provide: getRepositoryToken(Schedule), useValue: {} },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
      ],
    }).compile();

    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
  });

  it('create — notification/interaction 을 config JSONB 안으로 병합 (1급 컬럼 아님)', async () => {
    const result = await service.create('ws', {
      workflowId: 'wf-1',
      type: 'webhook',
      name: 'hook',
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
      },
      interaction: { enabled: true, tokenStrategy: 'per_execution' },
    });

    expect(triggerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws',
        config: expect.objectContaining({
          notification: {
            url: 'https://customer.example.com/cb',
            events: ['execution.completed'],
          },
          interaction: { enabled: true, tokenStrategy: 'per_execution' },
        }),
      }),
    );
    // 1급 컬럼으로 들어가지 않았는지 (entity 상의 notification/interaction 프로퍼티 없음)
    expect(result).not.toHaveProperty('notification');
    expect(result).not.toHaveProperty('interaction');
  });

  it('create — 기존 config 와 notification/interaction 이 함께 병합', async () => {
    await service.create('ws', {
      workflowId: 'wf-1',
      type: 'webhook',
      name: 'hook',
      config: { method: 'POST', hmacAlgorithm: 'sha256' },
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
      },
    });

    expect(triggerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          method: 'POST',
          hmacAlgorithm: 'sha256',
          notification: expect.any(Object),
        }),
      }),
    );
  });

  it('create — notification.url 이 사설 IP 면 INVALID_NOTIFICATION_URL', async () => {
    await expect(
      service.create('ws', {
        workflowId: 'wf-1',
        type: 'webhook',
        name: 'hook',
        notification: {
          url: 'https://192.168.0.1/x',
          events: ['execution.completed'],
        },
      }),
    ).rejects.toMatchObject({
      response: { code: 'INVALID_NOTIFICATION_URL' },
    });
    expect(triggerRepo.create).not.toHaveBeenCalled();
  });

  it('create — notification.url 이 https 미사용 → INVALID_NOTIFICATION_URL', async () => {
    const orig = process.env.ALLOW_HTTP_HOOKS;
    delete process.env.ALLOW_HTTP_HOOKS;
    try {
      await expect(
        service.create('ws', {
          workflowId: 'wf-1',
          type: 'webhook',
          name: 'hook',
          notification: {
            url: 'http://customer.example.com/cb',
            events: ['execution.completed'],
          },
        }),
      ).rejects.toMatchObject({
        response: { code: 'INVALID_NOTIFICATION_URL' },
      });
    } finally {
      if (orig !== undefined) process.env.ALLOW_HTTP_HOOKS = orig;
    }
  });

  it('update — notification 미명시면 기존 config.notification 유지', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'webhook',
      name: 'old',
      config: {
        notification: {
          url: 'https://old.example.com',
          events: ['execution.failed'],
        },
        interaction: { enabled: true },
      },
    } as unknown as Trigger);

    const result = await service.update('t1', 'ws', { name: 'new' });
    expect(result.name).toBe('new');
    expect(result.config).toEqual(
      expect.objectContaining({
        notification: {
          url: 'https://old.example.com',
          events: ['execution.failed'],
        },
        interaction: { enabled: true },
      }),
    );
  });

  it('update — notification 명시 시 기존 값 대체', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't1',
      workspaceId: 'ws',
      type: 'webhook',
      name: 'old',
      config: {
        notification: {
          url: 'https://old.example.com',
          events: ['execution.failed'],
        },
      },
    } as unknown as Trigger);

    const result = await service.update('t1', 'ws', {
      notification: {
        url: 'https://new.example.com/cb',
        events: ['execution.completed'],
      },
    });
    expect(result.config.notification).toEqual({
      url: 'https://new.example.com/cb',
      events: ['execution.completed'],
    });
  });
});

describe('TriggersService.findOneDetail (helper)', () => {
  // placeholder for original suite structure — 위 새 describe 들이 동일 모듈 안에 있어
  // closing brace 정렬을 위한 빈 describe (실제 테스트 없음, lint 무시).
  it.skip('structural anchor', () => {
    expect(true).toBe(true);
  });
});

describe('TriggersService — Secret rotation / itk revoke [Spec EIA §3.1·§3.3]', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn((t: Trigger) => Promise.resolve(t)),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        { provide: getRepositoryToken(Schedule), useValue: {} },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
  });

  function makeTrigger(config: Record<string, unknown>): Trigger {
    return {
      id: 't1',
      workspaceId: 'ws',
      type: 'webhook',
      name: 'hook',
      config,
      notificationSecretV2: null,
      notificationRotatedAt: null,
    } as unknown as Trigger;
  }

  it('rotateNotificationSecret — 새 wsk_* secret 발급 + v2 컬럼 저장', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        notification: {
          url: 'https://x.com/cb',
          events: ['execution.completed'],
        },
      }),
    );
    const result = await service.rotateNotificationSecret('t1', 'ws');
    expect(result.secret).toMatch(/^wsk_[a-f0-9]{64}$/);
    expect(typeof result.rotatedAt).toBe('string');
    expect(triggerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationSecretV2: result.secret,
        notificationRotatedAt: expect.any(Date),
      }),
    );
  });

  it('rotateNotificationSecret — notification 미설정 시 NOTIFICATION_NOT_CONFIGURED', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger({}));
    await expect(
      service.rotateNotificationSecret('t1', 'ws'),
    ).rejects.toMatchObject({
      response: { code: 'NOTIFICATION_NOT_CONFIGURED' },
    });
  });

  it('revokePerTriggerToken — 새 itk_* + config.interaction.triggerToken 교체', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        interaction: {
          enabled: true,
          tokenStrategy: 'per_trigger',
          triggerToken: 'itk_old',
        },
      }),
    );
    const result = await service.revokePerTriggerToken('t1', 'ws');
    expect(result.token).toMatch(/^itk_[a-f0-9]{64}$/);
    expect(triggerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          interaction: expect.objectContaining({ triggerToken: result.token }),
        }),
      }),
    );
  });

  it('revokePerTriggerToken — per_execution 전략이면 NOT_PER_TRIGGER_STRATEGY', async () => {
    triggerRepo.findOne.mockResolvedValue(
      makeTrigger({
        interaction: { enabled: true, tokenStrategy: 'per_execution' },
      }),
    );
    await expect(
      service.revokePerTriggerToken('t1', 'ws'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_PER_TRIGGER_STRATEGY' },
    });
  });

  it('revokePerTriggerToken — interaction 미설정 시 NOT_PER_TRIGGER_STRATEGY', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger({}));
    await expect(
      service.revokePerTriggerToken('t1', 'ws'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_PER_TRIGGER_STRATEGY' },
    });
  });

  describe('promoteRotatedNotificationSecrets — grace 24h 종료 cron', () => {
    function mockQueryBuilder(triggers: Trigger[]): void {
      const qb = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(triggers),
      };
      (triggerRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
    }

    it('grace 경과 trigger 의 v2 → primary 승격', async () => {
      const old = makeTrigger({
        notification: {
          url: 'https://x.com/cb',
          events: ['execution.completed'],
          signing: { algorithm: 'hmac-sha256', secret: 'wsk_old' },
        },
      });
      old.notificationSecretV2 = 'wsk_new';
      old.notificationRotatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockQueryBuilder([old]);
      const result = await service.promoteRotatedNotificationSecrets();
      expect(result.promoted).toBe(1);
      expect(triggerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSecretV2: null,
          notificationRotatedAt: null,
          config: expect.objectContaining({
            notification: expect.objectContaining({
              signing: expect.objectContaining({ secret: 'wsk_new' }),
            }),
          }),
        }),
      );
    });

    it('대상 0건 → no-op', async () => {
      mockQueryBuilder([]);
      const result = await service.promoteRotatedNotificationSecrets();
      expect(result.promoted).toBe(0);
      expect(triggerRepo.save).not.toHaveBeenCalled();
    });
  });
});
