import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { TriggersService } from './triggers.service';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';

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
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn(),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
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

    const result = (await service.findOneDetail(
      't1',
      'ws',
    )) as unknown as Record<string, unknown>;

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
  let authConfigRepo: jest.Mocked<Repository<AuthConfig>>;

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
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn(),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    authConfigRepo = moduleRef.get(getRepositoryToken(AuthConfig));
  });

  it('create — authConfigId 가 같은 워크스페이스면 통과', async () => {
    authConfigRepo.findOne.mockResolvedValue({
      id: 'ac-1',
      workspaceId: 'ws',
    } as AuthConfig);
    await service.create('ws', {
      workflowId: 'wf-1',
      type: 'webhook',
      name: 'hook',
      authConfigId: 'ac-1',
    });
    expect(authConfigRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'ac-1', workspaceId: 'ws' },
    });
    expect(triggerRepo.create).toHaveBeenCalled();
  });

  it('create — authConfigId 가 다른 워크스페이스(미존재)면 AUTH_CONFIG_NOT_FOUND + create 미호출', async () => {
    authConfigRepo.findOne.mockResolvedValue(null);
    const err = await service
      .create('ws', {
        workflowId: 'wf-1',
        type: 'webhook',
        name: 'hook',
        authConfigId: 'other-ws-ac',
      })
      .catch((e: unknown) => e as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'AUTH_CONFIG_NOT_FOUND',
    });
    expect(triggerRepo.create).not.toHaveBeenCalled();
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

  it('create — 기존 config 보존 + notification 병합 + inline 인증 키 strip', async () => {
    await service.create('ws', {
      workflowId: 'wf-1',
      type: 'webhook',
      name: 'hook',
      // method 는 비인증 키 → 보존. hmacAlgorithm/bearerToken 은 폐기된 inline 인증
      // 키 → strip (인증은 authConfigId 로만; spec 5-system/12-webhook.md §2.2).
      config: { method: 'POST', hmacAlgorithm: 'sha256', bearerToken: 'x' },
      notification: {
        url: 'https://customer.example.com/cb',
        events: ['execution.completed'],
      },
    });

    expect(triggerRepo.create).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          method: 'POST',
          notification: expect.any(Object),
        }),
      }),
    );
    const createdConfig = (
      triggerRepo.create.mock.calls[0][0] as { config: Record<string, unknown> }
    ).config;
    expect(createdConfig).not.toHaveProperty('hmacAlgorithm');
    expect(createdConfig).not.toHaveProperty('bearerToken');
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

  it('update — schedule 타입은 name·isActive 외 키를 거부 (VALIDATION_ERROR)', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't-sch',
      workspaceId: 'ws',
      type: 'schedule',
      name: 'daily',
      config: {},
    } as unknown as Trigger);

    await expect(
      service.update('t-sch', 'ws', { endpointPath: '/new-path' }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        details: {
          field: 'type',
          disallowed: expect.arrayContaining(['endpointPath']),
        },
      },
    });
  });

  it('update — schedule 타입은 복수 거부 필드 조합도 disallowed 배열에 모두 포함', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't-sch',
      workspaceId: 'ws',
      type: 'schedule',
      name: 'daily',
      config: {},
    } as unknown as Trigger);

    await expect(
      service.update('t-sch', 'ws', {
        endpointPath: '/new-path',
        config: { authType: 'hmac' },
      }),
    ).rejects.toMatchObject({
      response: {
        code: 'VALIDATION_ERROR',
        details: {
          field: 'type',
          disallowed: expect.arrayContaining(['endpointPath', 'config']),
        },
      },
    });
  });

  it('update — schedule 타입의 name 변경은 허용', async () => {
    triggerRepo.findOne.mockResolvedValue({
      id: 't-sch',
      workspaceId: 'ws',
      type: 'schedule',
      name: 'old',
      config: {},
    } as unknown as Trigger);

    const result = await service.update('t-sch', 'ws', {
      name: 'renamed',
      isActive: false,
    });
    expect(result.name).toBe('renamed');
    expect(result.isActive).toBe(false);
    expect(triggerRepo.save).toHaveBeenCalledTimes(1);
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
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn(),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
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

describe('TriggersService — setupChatChannel secret store 경로 (SUMMARY#12)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let secrets: jest.Mocked<SecretResolverService>;
  let mockAdapter: { setupChannel: jest.Mock };
  let adapterRegistry: jest.Mocked<ChannelAdapterRegistry>;

  const baseTrigger = {
    id: 'trig-1',
    workspaceId: 'ws-1',
    type: 'webhook',
    endpointPath: 'hook-abc',
    config: {},
    chatChannelHealth: 'unknown',
    chatChannelLastError: null,
  } as unknown as Trigger;

  beforeEach(async () => {
    mockAdapter = {
      setupChannel: jest.fn().mockResolvedValue({
        configUpdates: { botIdentity: { botId: 111, username: 'bot' } },
        issuedInboundSigning: 'issued-secret-xyz',
      }),
    };
    adapterRegistry = {
      has: jest.fn().mockReturnValue(true),
      get: jest.fn().mockReturnValue(mockAdapter),
    } as unknown as jest.Mocked<ChannelAdapterRegistry>;

    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn().mockResolvedValue(baseTrigger),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn((t: Trigger) => Promise.resolve(t)),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: adapterRegistry,
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    secrets = moduleRef.get(SecretResolverService);
  });

  it('setupChatChannel 성공 — secrets.rotate 2회 호출 (botToken + webhookSecret) (SUMMARY#12-a)', async () => {
    const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
    triggerRepo.findOne.mockResolvedValue(trigger);

    await service.update('trig-1', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    // botToken 저장
    expect(secrets.rotate).toHaveBeenCalledWith(
      'secret://triggers/trig-1/bot-token',
      'ws-1',
      '111:TestToken',
    );
    // issuedInboundSigning 저장
    expect(secrets.rotate).toHaveBeenCalledWith(
      'secret://triggers/trig-1/inbound-signing',
      'ws-1',
      'issued-secret-xyz',
    );
    // chatChannelHealth = healthy
    expect(triggerRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatChannelHealth: 'healthy' }),
    );
  });

  it('issuedInboundSigning 없을 때 webhookSecret rotate 미호출 (SUMMARY#12-b)', async () => {
    mockAdapter.setupChannel.mockResolvedValueOnce({
      configUpdates: {},
      // issuedInboundSigning 없음
    });
    const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
    triggerRepo.findOne.mockResolvedValue(trigger);

    await service.update('trig-1', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    const rotateCalls = (secrets.rotate as jest.Mock).mock.calls;
    const webhookCalls = rotateCalls.filter(([ref]) =>
      (ref as string).includes('inbound-signing'),
    );
    expect(webhookCalls).toHaveLength(0);
  });

  it('setupChannel throw 시 chatChannelHealth=degraded + warn 로그 (SUMMARY#12-c)', async () => {
    mockAdapter.setupChannel.mockRejectedValueOnce(
      new Error('Telegram API error'),
    );
    const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
    triggerRepo.findOne.mockResolvedValue(trigger);

    await service.update('trig-1', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    // botToken 은 이미 저장됨 (setupChannel 실패 이전)
    expect(secrets.rotate).toHaveBeenCalledWith(
      'secret://triggers/trig-1/bot-token',
      'ws-1',
      '111:TestToken',
    );
    // degraded 상태로 저장
    expect(triggerRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatChannelHealth: 'degraded' }),
    );
  });

  // [Spec providers/_overview.md §1 v1 supported: telegram / slack / discord]
  // [secret-store.md §5.5 (b) provider-issued plaintext 흐름]
  describe('provider-issued inbound-signing (slack/discord)', () => {
    const SLACK_SIGNING_SECRET = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6'; // hex 32
    const DISCORD_PUBLIC_KEY =
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'; // hex 64

    beforeEach(() => {
      // slack/discord adapter 의 setupChannel 은 issuedInboundSigning 을 비움 (provider-issued).
      mockAdapter.setupChannel.mockResolvedValue({
        configUpdates: { botIdentity: { botId: 222, username: 'slackbot' } },
        // issuedInboundSigning 없음
      });
    });

    it('slack — valid plaintext → rotate(botToken) + rotate(inboundSigning, plaintext) 2회 + inboundSigningRef 가 config 에 set', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await service.update('trig-1', 'ws-1', {
        chatChannel: {
          provider: 'slack',
          botToken: 'xoxb-fake-token',
          inboundSigningPlaintext: SLACK_SIGNING_SECRET,
        },
      });

      // botToken 저장
      expect(secrets.rotate).toHaveBeenCalledWith(
        'secret://triggers/trig-1/bot-token',
        'ws-1',
        'xoxb-fake-token',
      );
      // provider-issued inbound-signing plaintext 저장 (setupChannel 호출 전)
      expect(secrets.rotate).toHaveBeenCalledWith(
        'secret://triggers/trig-1/inbound-signing',
        'ws-1',
        SLACK_SIGNING_SECRET,
      );
      // healthy 상태로 저장 + chatChannel.inboundSigningRef 가 config 에 반영
      expect(triggerRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          chatChannelHealth: 'healthy',
          config: expect.objectContaining({
            chatChannel: expect.objectContaining({
              inboundSigningRef: 'secret://triggers/trig-1/inbound-signing',
            }),
          }),
        }),
      );
    });

    it('slack — plaintext 누락 → 400 VALIDATION_ERROR (details.field=inboundSigningPlaintext)', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await expect(
        service.update('trig-1', 'ws-1', {
          chatChannel: { provider: 'slack', botToken: 'xoxb-fake-token' },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: { field: 'inboundSigningPlaintext' },
        }),
      });
    });

    it('slack — 잘못된 hex 형식 → 400 VALIDATION_ERROR', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await expect(
        service.update('trig-1', 'ws-1', {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-fake-token',
            inboundSigningPlaintext: 'too-short-not-hex',
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: { field: 'inboundSigningPlaintext' },
        }),
      });
    });

    it('discord — valid plaintext (hex 64) → 200 + ref 가 config 에 set', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await service.update('trig-1', 'ws-1', {
        chatChannel: {
          provider: 'discord',
          botToken: 'discord-bot-token',
          inboundSigningPlaintext: DISCORD_PUBLIC_KEY,
        },
      });

      expect(secrets.rotate).toHaveBeenCalledWith(
        'secret://triggers/trig-1/inbound-signing',
        'ws-1',
        DISCORD_PUBLIC_KEY,
      );
      expect(triggerRepo.update).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ chatChannelHealth: 'healthy' }),
      );
    });

    it('discord — 잘못된 hex 64 형식 → 400 VALIDATION_ERROR', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await expect(
        service.update('trig-1', 'ws-1', {
          chatChannel: {
            provider: 'discord',
            botToken: 'discord-bot-token',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET, // hex 32 — too short for discord
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: { field: 'inboundSigningPlaintext' },
        }),
      });
    });

    it('telegram — inboundSigningPlaintext 입력 시 400 (server-issued 만 허용)', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await expect(
        service.update('trig-1', 'ws-1', {
          chatChannel: {
            provider: 'telegram',
            botToken: '111:TestToken',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET,
          },
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'VALIDATION_ERROR',
          details: { field: 'inboundSigningPlaintext' },
        }),
      });
    });

    it('slack — plaintext 가 trigger.config 에 흘러가지 않음 (SS-SE-01)', async () => {
      const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
      triggerRepo.findOne.mockResolvedValue(trigger);

      await service.update('trig-1', 'ws-1', {
        chatChannel: {
          provider: 'slack',
          botToken: 'xoxb-fake-token',
          inboundSigningPlaintext: SLACK_SIGNING_SECRET,
        },
      });

      // (a) 최종 update 시 plaintext 가 config 에 없어야 함.
      const updateCalls = (triggerRepo.update as jest.Mock).mock.calls;
      const lastUpdatePatch = updateCalls[updateCalls.length - 1][1] as {
        config?: { chatChannel?: Record<string, unknown> };
      };
      const persistedChatChannel = lastUpdatePatch.config?.chatChannel ?? {};
      expect(persistedChatChannel).not.toHaveProperty(
        'inboundSigningPlaintext',
      );
      expect(persistedChatChannel).not.toHaveProperty('botToken');

      // (b) 최초 save 시점 plaintext 가 config 에 없어야 함 —
      // stripChatChannelPlaintext 가 mergeExternalConfig 전에 호출됐음을 검증
      // (DB JSONB 일시 기록 회피 — adapter 미등록 early-return 경로 SS-SE-01 보장).
      const saveCalls = (triggerRepo.save as jest.Mock).mock.calls;
      const firstSaved = saveCalls[0][0] as {
        config?: { chatChannel?: Record<string, unknown> };
      };
      const initialChatChannel = firstSaved.config?.chatChannel ?? {};
      expect(initialChatChannel).not.toHaveProperty('inboundSigningPlaintext');
      expect(initialChatChannel).not.toHaveProperty('botToken');
    });
  });
});

/**
 * 회귀: triggers.service 가 webhook callbackUrl 을 조립할 때
 * 등록되지 않은 config key (`app.publicBaseUrl` / `publicBaseUrl`) 를 읽어
 * 항상 http://localhost:3000 fallback 으로 떨어졌고, 그 결과 Telegram setWebhook 이
 * "An HTTPS URL must be provided for webhook" 로 거절되어 trigger 가 degraded 로 저장됐다.
 * `app.config.ts` 가 등록하는 canonical key 는 `app.url` 이다.
 */
describe('TriggersService — webhook callbackUrl 조립 (app.url 사용 회귀 방지)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let mockAdapter: { setupChannel: jest.Mock };
  let configGet: jest.Mock;

  const baseTrigger = {
    id: 'trig-tg',
    workspaceId: 'ws-1',
    type: 'webhook',
    endpointPath: 'hook-abc',
    config: {},
    chatChannelHealth: 'unknown',
    chatChannelLastError: null,
  } as unknown as Trigger;

  async function buildService(getImpl: (key: string) => unknown) {
    configGet = jest.fn(getImpl);
    mockAdapter = {
      setupChannel: jest.fn().mockResolvedValue({
        configUpdates: { botIdentity: { botId: 111, username: 'bot' } },
        issuedInboundSigning: 'issued-secret-xyz',
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn().mockResolvedValue(baseTrigger),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn((t: Trigger) => Promise.resolve(t)),
            createQueryBuilder: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: {
            has: jest.fn().mockReturnValue(true),
            get: jest.fn().mockReturnValue(mockAdapter),
          },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        { provide: ConfigService, useValue: { get: configGet } },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
  }

  it('app.url=https://workflow-api.getit.co.kr 가 set 되어 있으면 adapter.setupChannel 이 https callback URL 로 호출된다', async () => {
    await buildService((key) =>
      key === 'app.url' ? 'https://workflow-api.getit.co.kr' : undefined,
    );

    await service.update('trig-tg', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    expect(mockAdapter.setupChannel).toHaveBeenCalledWith(
      expect.anything(),
      'https://workflow-api.getit.co.kr/api/hooks/hook-abc',
    );
    expect(triggerRepo.update).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ chatChannelHealth: 'healthy' }),
    );
  });

  it('config 가 `app.url` key 를 읽는다 (registered key) — 미등록 alias 는 무시', async () => {
    // 운영 회귀 재현: app.publicBaseUrl 같은 key 에만 값이 있고 app.url 은 비어 있는 경우,
    // 코드는 절대 publicBaseUrl 을 fallback 으로 쓰지 말아야 한다 (해당 key 는 등록된 적이 없다).
    await buildService((key) =>
      key === 'app.publicBaseUrl' || key === 'publicBaseUrl'
        ? 'https://should-not-be-used.example.com'
        : undefined,
    );

    await service.update('trig-tg', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    const passedCallback = mockAdapter.setupChannel.mock.calls[0][1] as string;
    expect(passedCallback).not.toContain('should-not-be-used.example.com');
    // app.url 이 undefined 이면 fallback (http://localhost:3011) 로 떨어져야 한다.
    expect(passedCallback).toBe('http://localhost:3011/api/hooks/hook-abc');
    // 그리고 ConfigService 는 'app.url' 을 적어도 한 번은 조회해야 한다.
    expect(configGet).toHaveBeenCalledWith('app.url');
  });

  it('endpointPath 의 leading slash 와 baseUrl 의 trailing slash 가 정규화된다', async () => {
    await buildService((key) =>
      key === 'app.url' ? 'https://workflow-api.getit.co.kr/' : undefined,
    );
    triggerRepo.findOne.mockResolvedValue({
      ...baseTrigger,
      endpointPath: '/hook-abc',
    } as unknown as Trigger);

    await service.update('trig-tg', 'ws-1', {
      chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
    });

    expect(mockAdapter.setupChannel).toHaveBeenCalledWith(
      expect.anything(),
      'https://workflow-api.getit.co.kr/api/hooks/hook-abc',
    );
  });
});

describe('TriggersService.remove — deleteByPrefix 호출 검증 (SUMMARY#13)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let secrets: jest.Mocked<SecretResolverService>;

  const trigger = {
    id: 'trig-42',
    workspaceId: 'ws-1',
    config: {},
  } as unknown as Trigger;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn().mockResolvedValue(trigger),
            remove: jest.fn().mockResolvedValue(undefined),
            update: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn(),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(2),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    secrets = moduleRef.get(SecretResolverService);
  });

  it('remove 시 deleteByPrefix 를 올바른 prefix 로 호출 (SUMMARY#13)', async () => {
    await service.remove('trig-42', 'ws-1');

    expect(secrets.deleteByPrefix).toHaveBeenCalledWith(
      'secret://triggers/trig-42/',
    );
    expect(triggerRepo.remove).toHaveBeenCalledWith(trigger);
  });
});

/**
 * rotateBotToken — Controller 에서 위임된 6단계 오케스트레이션 검증.
 * 기존 chat-channel.controller.spec.ts 의 6단계 검증을 본 service 차원으로 이관.
 */
describe('TriggersService.rotateBotToken — 6단계 오케스트레이션', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let secrets: jest.Mocked<SecretResolverService>;
  let adapterRegistry: jest.Mocked<ChannelAdapterRegistry>;
  let mockAdapter: { setupChannel: jest.Mock };

  const WORKSPACE_ID = 'ws-1';
  const TRIGGER_ID = 'trig-1';
  const BOT_TOKEN_REF = 'secret://triggers/trig-1/bot-token';
  const SECRET_TOKEN_REF = 'secret://triggers/trig-1/inbound-signing';
  const OLD_TOKEN = '111111111:OldToken';
  const NEW_TOKEN = '222222222:NewToken';
  const ISSUED_SECRET = 'newWebhookSecret';

  beforeEach(async () => {
    mockAdapter = {
      setupChannel: jest.fn().mockResolvedValue({
        registeredAt: new Date().toISOString(),
        configUpdates: {},
        issuedInboundSigning: ISSUED_SECRET,
      }),
    };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn().mockResolvedValue({
              id: TRIGGER_ID,
              workspaceId: WORKSPACE_ID,
              endpointPath: 'hook-abc',
              config: {
                chatChannel: {
                  provider: 'telegram',
                  botTokenRef: BOT_TOKEN_REF,
                  inboundSigningRef: SECRET_TOKEN_REF,
                },
              },
            } as unknown as Trigger),
            update: jest.fn().mockResolvedValue(undefined),
            save: jest.fn((t: Trigger) => Promise.resolve(t)),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          // 역방향 동기화 도입 후 update(isActive)/remove 가 schedule lookup 을 수행 —
          // 본 suite 들은 schedule row 부재(graceful skip) 경로로 통과시킨다.
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: {
            has: jest.fn().mockReturnValue(true),
            get: jest.fn().mockReturnValue(mockAdapter),
          },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: { registerJob: jest.fn(), removeJob: jest.fn() },
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn().mockResolvedValue(OLD_TOKEN),
            store: jest.fn(),
            rotate: jest.fn().mockResolvedValue(undefined),
            delete: jest.fn(),
            deleteByPrefix: jest.fn(),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    secrets = moduleRef.get(SecretResolverService);
    adapterRegistry = moduleRef.get(ChannelAdapterRegistry);
  });

  it('정상 — old token resolve → v2 백업 → primary rotate → setupChannel → webhook secret store → trigger 갱신', async () => {
    const result = await service.rotateBotToken(
      TRIGGER_ID,
      WORKSPACE_ID,
      NEW_TOKEN,
    );
    expect(secrets.resolve).toHaveBeenCalledWith(BOT_TOKEN_REF);
    expect(secrets.rotate).toHaveBeenCalledWith(
      'secret://triggers/trig-1/bot-token.v2',
      WORKSPACE_ID,
      OLD_TOKEN,
    );
    expect(secrets.rotate).toHaveBeenCalledWith(
      BOT_TOKEN_REF,
      WORKSPACE_ID,
      NEW_TOKEN,
    );
    expect(mockAdapter.setupChannel).toHaveBeenCalled();
    expect(secrets.rotate).toHaveBeenCalledWith(
      SECRET_TOKEN_REF,
      WORKSPACE_ID,
      ISSUED_SECRET,
    );
    expect(triggerRepo.update).toHaveBeenCalledWith(
      { id: TRIGGER_ID },
      expect.objectContaining({
        chatChannelHealth: 'healthy',
        chatChannelTokenV2: 'secret://triggers/trig-1/bot-token.v2',
      }),
    );
    expect(result).toHaveProperty('rotatedAt');
  });

  it('첫 rotation — old token resolve 실패 시 v2 백업 skip + chatChannelTokenV2=null', async () => {
    secrets.resolve.mockRejectedValueOnce(new Error('not found'));
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN);
    // v2 ref rotate 미호출.
    const v2Calls = secrets.rotate.mock.calls.filter(([ref]) =>
      ref.endsWith('bot-token.v2'),
    );
    expect(v2Calls).toHaveLength(0);
    expect(triggerRepo.update).toHaveBeenCalledWith(
      { id: TRIGGER_ID },
      expect.objectContaining({ chatChannelTokenV2: null }),
    );
  });

  it('issuedInboundSigning 없을 때 inbound-signing ref rotate 미호출', async () => {
    mockAdapter.setupChannel.mockResolvedValueOnce({
      registeredAt: new Date().toISOString(),
      configUpdates: {},
    });
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN);
    const webhookSecretCalls = secrets.rotate.mock.calls.filter(([ref]) =>
      ref.includes('inbound-signing'),
    );
    expect(webhookSecretCalls).toHaveLength(0);
  });

  it('chatChannel 미설정 시 BadRequestException', async () => {
    triggerRepo.findOne.mockResolvedValueOnce({
      id: TRIGGER_ID,
      workspaceId: WORKSPACE_ID,
      endpointPath: 'hook-abc',
      config: {},
    } as unknown as Trigger);
    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_CHANNEL_NOT_CONFIGURED' },
    });
  });

  it('provider 미등록 시 BadRequestException', async () => {
    adapterRegistry.has.mockReturnValueOnce(false);
    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_CHANNEL_PROVIDER_UNKNOWN' },
    });
  });

  it('endpointPath 누락 시 BadRequestException', async () => {
    triggerRepo.findOne.mockResolvedValueOnce({
      id: TRIGGER_ID,
      workspaceId: WORKSPACE_ID,
      endpointPath: null,
      config: {
        chatChannel: {
          provider: 'telegram',
          botTokenRef: BOT_TOKEN_REF,
        },
      },
    } as unknown as Trigger);
    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_CHANNEL_ENDPOINT_REQUIRED' },
    });
  });
});

describe('TriggersService — Schedule 역방향 동기화 (data-flow 10-triggers §1.4)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;
  let runner: { registerJob: jest.Mock; removeJob: jest.Mock };

  const scheduleTrigger = () =>
    ({
      id: 'trig-1',
      workspaceId: 'ws-1',
      type: 'schedule',
      name: 'daily',
      isActive: true,
      config: {},
    }) as unknown as Trigger;

  const scheduleRow = () =>
    ({
      id: 'sched-1',
      triggerId: 'trig-1',
      workspaceId: 'ws-1',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      isActive: true,
    }) as unknown as Schedule;

  beforeEach(async () => {
    runner = { registerJob: jest.fn(), removeJob: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(async (t: Trigger) => t),
            remove: jest.fn(),
          },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(async (s: Schedule) => s),
          },
        },
        {
          provide: getRepositoryToken(AuthConfig),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: ChannelAdapterRegistry,
          useValue: { has: jest.fn(() => false), get: jest.fn() },
        },
        {
          provide: ChannelListenerRegistry,
          useValue: {
            register: jest.fn(),
            unregister: jest.fn(),
            has: jest.fn(() => false),
            get: jest.fn(),
            size: jest.fn(() => 0),
            bulkRegister: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn(() => 'http://localhost:3000') },
        },
        {
          provide: ScheduleRunnerService,
          useValue: runner,
        },
        {
          provide: SecretResolverService,
          useValue: {
            resolve: jest.fn(),
            store: jest.fn(),
            rotate: jest.fn(),
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
  });

  it('PATCH isActive:false (schedule 타입) → schedule.is_active 동기 저장 + removeJob 호출', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());
    scheduleRepo.findOne.mockResolvedValue(scheduleRow());

    await service.update('trig-1', 'ws-1', { isActive: false });

    expect(scheduleRepo.findOne).toHaveBeenCalledWith({
      where: { triggerId: 'trig-1' },
    });
    expect(scheduleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sched-1', isActive: false }),
    );
    expect(runner.removeJob).toHaveBeenCalledWith('sched-1');
    expect(runner.registerJob).not.toHaveBeenCalled();
  });

  it('PATCH isActive:true (schedule 타입) → schedule.is_active 동기 저장 + registerJob 호출', async () => {
    triggerRepo.findOne.mockResolvedValue({
      ...scheduleTrigger(),
      isActive: false,
    } as Trigger);
    scheduleRepo.findOne.mockResolvedValue({
      ...scheduleRow(),
      isActive: false,
    } as Schedule);

    await service.update('trig-1', 'ws-1', { isActive: true });

    expect(scheduleRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sched-1', isActive: true }),
    );
    expect(runner.registerJob).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'sched-1', cronExpression: '0 9 * * *' }),
    );
    expect(runner.removeJob).not.toHaveBeenCalled();
  });

  it('schedule row 부재(고아 trigger) → graceful skip (throw 없음, runner 미호출)', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());
    scheduleRepo.findOne.mockResolvedValue(null);

    await expect(
      service.update('trig-1', 'ws-1', { isActive: false }),
    ).resolves.toBeDefined();
    expect(scheduleRepo.save).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
    expect(runner.registerJob).not.toHaveBeenCalled();
  });

  it('isActive 미포함 PATCH (schedule 타입, name 만) → schedule 동기 경로 미진입', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());

    await service.update('trig-1', 'ws-1', { name: 'renamed' });

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(runner.registerJob).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
  });

  it('webhook 타입 PATCH isActive → schedule 동기 경로 미진입', async () => {
    triggerRepo.findOne.mockResolvedValue({
      ...scheduleTrigger(),
      type: 'webhook',
    } as Trigger);

    await service.update('trig-1', 'ws-1', { isActive: false });

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
  });

  it('DELETE (schedule 타입) → trigger 삭제 전 removeJob 으로 BullMQ 엔트리 정리', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());
    scheduleRepo.findOne.mockResolvedValue(scheduleRow());

    await service.remove('trig-1', 'ws-1');

    expect(runner.removeJob).toHaveBeenCalledWith('sched-1');
    expect(triggerRepo.remove).toHaveBeenCalled();
    // removeJob 이 row 삭제보다 먼저 — 호출 순서 검증
    const removeJobOrder = runner.removeJob.mock.invocationCallOrder[0];
    const removeTriggerOrder = (triggerRepo.remove as jest.Mock).mock
      .invocationCallOrder[0];
    expect(removeJobOrder).toBeLessThan(removeTriggerOrder);
  });

  it('DELETE (webhook 타입) → removeJob 미호출', async () => {
    triggerRepo.findOne.mockResolvedValue({
      ...scheduleTrigger(),
      type: 'webhook',
    } as Trigger);

    await service.remove('trig-1', 'ws-1');

    expect(runner.removeJob).not.toHaveBeenCalled();
    expect(triggerRepo.remove).toHaveBeenCalled();
  });
});
