import { AuditLogsService } from '../audit-logs/audit-logs.service';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Provider } from '@nestjs/common';
import { In, Repository } from 'typeorm';
import { TriggersService } from './triggers.service';
import { Trigger } from './entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { Schedule } from '../schedules/entities/schedule.entity';
import { AuthConfig } from '../auth-configs/entities/auth-config.entity';
import { ChannelAdapterRegistry } from '../chat-channel/channel-adapter.registry';
import { ChannelListenerRegistry } from '../chat-channel/channel-listener.registry';
import { SecretResolverService } from '../secret-store/secret-resolver.service';
import { ScheduleRunnerService } from '../schedules/schedule-runner.service';

/**
 * [SUMMARY W-3] createBaseProviders — Secret rotation / itk revoke / setupChatChannel
 * describe 블록들이 공유하는 프로바이더 설정 헬퍼.
 * triggerRepo mock 은 suite마다 메서드가 달라 개별 override 후 spread 한다.
 */
function createBaseProviders(
  triggerRepoMock: Record<string, unknown>,
): Provider[] {
  return [
    TriggersService,
    {
      provide: getRepositoryToken(Trigger),
      useValue: triggerRepoMock,
    },
    { provide: getRepositoryToken(Execution), useValue: {} },
    // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다. 이 팩토리는
    // 모듈 레벨이라 describe 스코프의 공유 mock 을 참조할 수 없어 매번 새로 만든다.
    { provide: AuditLogsService, useValue: { record: jest.fn() } },
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
  ];
}

describe('TriggersService.findOneDetail', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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

describe('TriggersService.findAll — schedule 목록 enrichment (V-10)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;

  function mockQb(rows: Trigger[]): void {
    const qb = {
      leftJoinAndSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      offset: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(rows.length),
      getMany: jest.fn().mockResolvedValue(rows),
    };
    (triggerRepo.createQueryBuilder as jest.Mock).mockReturnValue(qb);
  }

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        TriggersService,
        {
          provide: getRepositoryToken(Trigger),
          useValue: { createQueryBuilder: jest.fn() },
        },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          useValue: { find: jest.fn() },
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

  it('여러 schedule 행을 단일 IN 배치로 enrichment 하고 webhook 행은 건드리지 않는다 (N+1 회피)', async () => {
    const next1 = new Date('2026-05-06T00:00:00Z');
    const next2 = new Date('2026-05-07T09:00:00Z');
    // schedule 2건 + webhook 1건 — per-row findOne 루프로 퇴행하면 find 가
    // 2회 호출돼 아래 toHaveBeenCalledTimes(1) 가 깨진다(배치성의 실질 가드).
    mockQb([
      {
        id: 's-trig-1',
        workspaceId: 'ws',
        type: 'schedule',
        name: 'daily',
      } as unknown as Trigger,
      {
        id: 'w-trig',
        workspaceId: 'ws',
        type: 'webhook',
        name: 'hook',
      } as unknown as Trigger,
      {
        id: 's-trig-2',
        workspaceId: 'ws',
        type: 'schedule',
        name: 'weekly',
      } as unknown as Trigger,
    ]);
    scheduleRepo.find.mockResolvedValue([
      {
        id: 's1',
        triggerId: 's-trig-1',
        workspaceId: 'ws',
        cronExpression: '0 9 * * *',
        timezone: 'Asia/Seoul',
        nextRunAt: next1,
      } as unknown as Schedule,
      {
        id: 's2',
        triggerId: 's-trig-2',
        workspaceId: 'ws',
        cronExpression: '0 9 * * 1',
        timezone: 'UTC',
        nextRunAt: next2,
      } as unknown as Schedule,
    ]);

    const result = await service.findAll('ws', { page: 1, limit: 20 });

    // 두 schedule 행이 있어도 조회는 IN [양쪽 id] 배치 1회 — per-row 였다면 2회.
    expect(scheduleRepo.find).toHaveBeenCalledTimes(1);
    expect(scheduleRepo.find).toHaveBeenCalledWith({
      where: { triggerId: In(['s-trig-1', 's-trig-2']), workspaceId: 'ws' },
    });
    const rows = result.data as unknown as Array<Record<string, unknown>>;
    const sched1 = rows.find((r) => r.id === 's-trig-1')!;
    expect(sched1.cronExpression).toBe('0 9 * * *');
    expect(sched1.timezone).toBe('Asia/Seoul');
    expect(sched1.nextRunAt).toBe(next1);
    const sched2 = rows.find((r) => r.id === 's-trig-2')!;
    expect(sched2.cronExpression).toBe('0 9 * * 1');
    expect(sched2.nextRunAt).toBe(next2);
    const hook = rows.find((r) => r.id === 'w-trig')!;
    expect(hook.cronExpression).toBeUndefined();
  });

  it('schedule 행이 없으면 schedule 조회를 skip', async () => {
    mockQb([
      {
        id: 'w-trig',
        workspaceId: 'ws',
        type: 'webhook',
        name: 'hook',
      } as unknown as Trigger,
    ]);
    await service.findAll('ws', { page: 1, limit: 20 });
    expect(scheduleRepo.find).not.toHaveBeenCalled();
  });

  it('schedule 행이 있으나 매칭 schedule row 부재 시 cron 필드 없이 반환', async () => {
    mockQb([
      {
        id: 's-trig',
        workspaceId: 'ws',
        type: 'schedule',
        name: 'daily',
      } as unknown as Trigger,
    ]);
    scheduleRepo.find.mockResolvedValue([]);
    const result = await service.findAll('ws', { page: 1, limit: 20 });
    const row = (result.data as unknown as Array<Record<string, unknown>>)[0];
    expect(row.cronExpression).toBeUndefined();
    expect(row.nextRunAt).toBeUndefined();
  });
});

describe('TriggersService — notification/interaction config 병합 (External Interaction API)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let authConfigRepo: jest.Mocked<Repository<AuthConfig>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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
    await service.create(
      'ws',
      {
        workflowId: 'wf-1',
        type: 'webhook',
        name: 'hook',
        authConfigId: 'ac-1',
      },
      'u-spec',
    );
    expect(authConfigRepo.findOne).toHaveBeenCalledWith({
      where: { id: 'ac-1', workspaceId: 'ws' },
    });
    expect(triggerRepo.create).toHaveBeenCalled();
  });

  it('create — authConfigId 가 다른 워크스페이스(미존재)면 AUTH_CONFIG_NOT_FOUND + create 미호출', async () => {
    authConfigRepo.findOne.mockResolvedValue(null);
    const err = await service
      .create(
        'ws',
        {
          workflowId: 'wf-1',
          type: 'webhook',
          name: 'hook',
          authConfigId: 'other-ws-ac',
        },
        'u-spec',
      )
      .catch((err_: unknown) => err_ as BadRequestException);
    expect(err).toBeInstanceOf(BadRequestException);
    expect((err as BadRequestException).getResponse()).toMatchObject({
      code: 'AUTH_CONFIG_NOT_FOUND',
    });
    expect(triggerRepo.create).not.toHaveBeenCalled();
  });

  it('create — notification/interaction 을 config JSONB 안으로 병합 (1급 컬럼 아님)', async () => {
    const result = await service.create(
      'ws',
      {
        workflowId: 'wf-1',
        type: 'webhook',
        name: 'hook',
        notification: {
          url: 'https://customer.example.com/cb',
          events: ['execution.completed'],
        },
        interaction: { enabled: true, tokenStrategy: 'per_execution' },
      },
      'u-spec',
    );

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
    await service.create(
      'ws',
      {
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
      },
      'u-spec',
    );

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
      service.create(
        'ws',
        {
          workflowId: 'wf-1',
          type: 'webhook',
          name: 'hook',
          notification: {
            url: 'https://192.168.0.1/x',
            events: ['execution.completed'],
          },
        },
        'u-spec',
      ),
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
        service.create(
          'ws',
          {
            workflowId: 'wf-1',
            type: 'webhook',
            name: 'hook',
            notification: {
              url: 'http://customer.example.com/cb',
              events: ['execution.completed'],
            },
          },
          'u-spec',
        ),
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

    const result = await service.update('t1', 'ws', { name: 'new' }, 'u-spec');
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
      service.update('t-sch', 'ws', { endpointPath: '/new-path' }, 'u-spec'),
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
      service.update(
        't-sch',
        'ws',
        {
          endpointPath: '/new-path',
          config: { authType: 'hmac' },
        },
        'u-spec',
      ),
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

    const result = await service.update(
      't-sch',
      'ws',
      {
        name: 'renamed',
        isActive: false,
      },
      'u-spec',
    );
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

    const result = await service.update(
      't1',
      'ws',
      {
        notification: {
          url: 'https://new.example.com/cb',
          events: ['execution.completed'],
        },
      },
      'u-spec',
    );
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
      providers: createBaseProviders({
        findOne: jest.fn(),
        save: jest.fn((t: Trigger) => Promise.resolve(t)),
        createQueryBuilder: jest.fn(),
      }),
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
    const result = await service.rotateNotificationSecret('t1', 'ws', 'user-1');
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
      service.rotateNotificationSecret('t1', 'ws', 'user-1'),
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
    const result = await service.revokePerTriggerToken('t1', 'ws', 'user-1');
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
      service.revokePerTriggerToken('t1', 'ws', 'user-1'),
    ).rejects.toMatchObject({
      response: { code: 'NOT_PER_TRIGGER_STRATEGY' },
    });
  });

  it('revokePerTriggerToken — interaction 미설정 시 NOT_PER_TRIGGER_STRATEGY', async () => {
    triggerRepo.findOne.mockResolvedValue(makeTrigger({}));
    await expect(
      service.revokePerTriggerToken('t1', 'ws', 'user-1'),
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
      // [리뷰 C3 fix] 승격은 평문 기록이 아니라 secret store canonical ref 회전 + secretRef 연결.
      expect(triggerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSecretV2: null,
          notificationRotatedAt: null,
          config: expect.objectContaining({
            notification: expect.objectContaining({
              signing: expect.objectContaining({
                secretRef: `secret://triggers/${old.id}/notification-signing`,
              }),
            }),
          }),
        }),
      );
      const savedSigning = (
        (triggerRepo.save as jest.Mock).mock.calls[0][0] as Trigger
      ).config as {
        notification: { signing: Record<string, unknown> };
      };
      expect(savedSigning.notification.signing.secret).toBeUndefined();
    });

    it('대상 0건 → no-op', async () => {
      mockQueryBuilder([]);
      const result = await service.promoteRotatedNotificationSecrets();
      expect(result.promoted).toBe(0);
      expect(triggerRepo.save).not.toHaveBeenCalled();
    });

    it('notification config 부재 trigger → v2/rotatedAt 클리어 + save (W-2 fix)', async () => {
      // [SUMMARY W-2] notification config 없이 v2 컬럼이 채워진 비정상 데이터.
      // 매 cron skip 으로 평문이 영구 잔류하지 않도록 v2/rotatedAt 를 클리어해야 한다.
      const stale = makeTrigger({});
      stale.notificationSecretV2 = 'wsk_newsecret';
      stale.notificationRotatedAt = new Date(Date.now() - 25 * 60 * 60 * 1000);
      mockQueryBuilder([stale]);

      const result = await service.promoteRotatedNotificationSecrets();
      expect(result.promoted).toBe(0);
      // 클리어 후 save 가 한 번 호출 (평문 영구 잔류 방지)
      expect(triggerRepo.save).toHaveBeenCalledTimes(1);
      expect(triggerRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationSecretV2: null,
          notificationRotatedAt: null,
        }),
      );
      // [testing-W-3] skip 경로에서 원래 config 는 변경 없어야 한다
      const savedTrigger = (triggerRepo.save as jest.Mock).mock
        .calls[0][0] as Trigger;
      expect(savedTrigger.config).toEqual({});
    });

    it('secrets.rotate 실패 시 예외가 전파된다 (testing-W-2)', async () => {
      // [testing-W-2] secrets.rotate 실패 시 에러 계약 — rethrow 로 BullMQ job retry 유도.
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

      // secrets 는 모듈에서 꺼내야 한다 — Secret rotation describe 의 beforeEach 가
      // createBaseProviders 의 기본 rotate mock(jest.fn()) 을 사용한다.
      const secretsService = (
        service as unknown as {
          secrets: { rotate: jest.Mock };
        }
      ).secrets;
      secretsService.rotate.mockRejectedValueOnce(new Error('store error'));

      await expect(service.promoteRotatedNotificationSecrets()).rejects.toThrow(
        'store error',
      );
      // 실패 전까지 save 는 호출되지 않았어야 한다 (partial save 없음)
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

    // [SUMMARY W-3] createBaseProviders 재사용 — ChannelAdapterRegistry 와
    // SecretResolverService 는 이 suite 특화 mock 으로 override.
    const baseProviders = createBaseProviders({
      findOne: jest.fn().mockResolvedValue(baseTrigger),
      update: jest.fn().mockResolvedValue(undefined),
      save: jest.fn((t: Trigger) => Promise.resolve(t)),
      createQueryBuilder: jest.fn(),
    });
    const overrideIdx = (token: unknown) =>
      baseProviders.findIndex(
        (p) => 'provide' in p && (p as { provide: unknown }).provide === token,
      );
    baseProviders[overrideIdx(ChannelAdapterRegistry)] = {
      provide: ChannelAdapterRegistry,
      useValue: adapterRegistry,
    };
    baseProviders[overrideIdx(SecretResolverService)] = {
      provide: SecretResolverService,
      useValue: {
        resolve: jest.fn(),
        store: jest.fn(),
        rotate: jest.fn().mockResolvedValue(undefined),
        delete: jest.fn(),
        deleteByPrefix: jest.fn().mockResolvedValue(0),
        exists: jest.fn(),
      },
    };

    const moduleRef = await Test.createTestingModule({
      providers: baseProviders,
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    secrets = moduleRef.get(SecretResolverService);
  });

  it('setupChatChannel 성공 — secrets.rotate 2회 호출 (botToken + webhookSecret) (SUMMARY#12-a)', async () => {
    const trigger = { ...baseTrigger, config: {} } as unknown as Trigger;
    triggerRepo.findOne.mockResolvedValue(trigger);

    await service.update(
      'trig-1',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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

    await service.update(
      'trig-1',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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

    await service.update(
      'trig-1',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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

      await service.update(
        'trig-1',
        'ws-1',
        {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-fake-token',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET,
          },
        },
        'u-spec',
      );

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
        service.update(
          'trig-1',
          'ws-1',
          {
            chatChannel: { provider: 'slack', botToken: 'xoxb-fake-token' },
          },
          'u-spec',
        ),
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
        service.update(
          'trig-1',
          'ws-1',
          {
            chatChannel: {
              provider: 'slack',
              botToken: 'xoxb-fake-token',
              inboundSigningPlaintext: 'too-short-not-hex',
            },
          },
          'u-spec',
        ),
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

      await service.update(
        'trig-1',
        'ws-1',
        {
          chatChannel: {
            provider: 'discord',
            botToken: 'discord-bot-token',
            inboundSigningPlaintext: DISCORD_PUBLIC_KEY,
          },
        },
        'u-spec',
      );

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
        service.update(
          'trig-1',
          'ws-1',
          {
            chatChannel: {
              provider: 'discord',
              botToken: 'discord-bot-token',
              inboundSigningPlaintext: SLACK_SIGNING_SECRET, // hex 32 — too short for discord
            },
          },
          'u-spec',
        ),
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
        service.update(
          'trig-1',
          'ws-1',
          {
            chatChannel: {
              provider: 'telegram',
              botToken: '111:TestToken',
              inboundSigningPlaintext: SLACK_SIGNING_SECRET,
            },
          },
          'u-spec',
        ),
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

      await service.update(
        'trig-1',
        'ws-1',
        {
          chatChannel: {
            provider: 'slack',
            botToken: 'xoxb-fake-token',
            inboundSigningPlaintext: SLACK_SIGNING_SECRET,
          },
        },
        'u-spec',
      );

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
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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

    await service.update(
      'trig-tg',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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

    await service.update(
      'trig-tg',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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

    await service.update(
      'trig-tg',
      'ws-1',
      {
        chatChannel: { provider: 'telegram', botToken: '111:TestToken' },
      },
      'u-spec',
    );

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
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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
    await service.remove('trig-42', 'ws-1', 'u-spec');

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
  let auditLogs: { record: jest.Mock };

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
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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
    auditLogs = moduleRef.get(AuditLogsService) as unknown as {
      record: jest.Mock;
    };
  });

  /**
   * **감사 기록 — 성공/실패 양쪽.**
   *
   * 이 자리가 셋 중 유일하게 비어 있었다: 다른 두 회전은 `TriggersService — 감사 로깅`
   * describe 에 회귀가 있는데 `rotateBotToken` 만 없었고, 그 결과 **감사 호출을 통째로
   * 지우는 뮤턴트가 81건 전부 GREEN** 이었다(ai-review `12_22_23` testing CRITICAL —
   * requirement·security 도 같은 자리를 독립 지적).
   *
   * 여기 두는 이유는 6단계 mock 이 이미 갖춰진 describe 라서다 — 실패 경로를 실제 단계
   * 실패로 만들 수 있는 유일한 자리다.
   */
  it('감사 — 성공 시 trigger.chat_channel_bot_token_rotated 를 남긴다', async () => {
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'u-bot');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        userId: 'u-bot',
        // 문자열로 박는다 — 상수를 참조하면 상수를 잘못 바꿔도 함께 따라가 통과한다.
        action: 'trigger.chat_channel_bot_token_rotated',
        resourceType: 'trigger',
        resourceId: TRIGGER_ID,
      }),
    );
  });

  it('감사 — 오케스트레이션이 중간에 실패하면 남기지 않는다', async () => {
    // setupChannel(4단계) 실패 → 컬럼 갱신(6단계)에 도달하지 못한다. 여기서 감사가
    // 남으면 "회전됐다" 는 거짓 기록이 되고 사고 조사가 틀린 타임라인을 그린다.
    mockAdapter.setupChannel.mockRejectedValueOnce(new Error('telegram down'));

    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'u-bot'),
    ).rejects.toBeDefined();

    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  it('정상 — old token resolve → v2 백업 → primary rotate → setupChannel → webhook secret store → trigger 갱신', async () => {
    const result = await service.rotateBotToken(
      TRIGGER_ID,
      WORKSPACE_ID,
      NEW_TOKEN,
      'user-1',
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

  it('§5.4 — 성공 응답에 triggerId / chatChannelHealth / botIdentity 3필드 동봉', async () => {
    mockAdapter.setupChannel.mockResolvedValueOnce({
      registeredAt: new Date().toISOString(),
      configUpdates: { botIdentity: { botId: 999, username: 'rotatedbot' } },
      issuedInboundSigning: ISSUED_SECRET,
    });
    const result = await service.rotateBotToken(
      TRIGGER_ID,
      WORKSPACE_ID,
      NEW_TOKEN,
      'user-1',
    );
    expect(result).toEqual(
      expect.objectContaining({
        triggerId: TRIGGER_ID,
        chatChannelHealth: 'healthy',
        botIdentity: { botId: 999, username: 'rotatedbot' },
      }),
    );
    expect(typeof result.rotatedAt).toBe('string');
  });

  it('§5.4 — setupChannel 이 botIdentity 미반환 시 botIdentity=null', async () => {
    mockAdapter.setupChannel.mockResolvedValueOnce({
      registeredAt: new Date().toISOString(),
      configUpdates: {},
      issuedInboundSigning: ISSUED_SECRET,
    });
    const result = await service.rotateBotToken(
      TRIGGER_ID,
      WORKSPACE_ID,
      NEW_TOKEN,
      'user-1',
    );
    expect(result.botIdentity).toBeNull();
  });

  it('첫 rotation — old token resolve 실패 시 v2 백업 skip + chatChannelTokenV2=null', async () => {
    secrets.resolve.mockRejectedValueOnce(new Error('not found'));
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'user-1');
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
    await service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'user-1');
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
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'user-1'),
    ).rejects.toMatchObject({
      response: { code: 'CHAT_CHANNEL_NOT_CONFIGURED' },
    });
  });

  it('provider 미등록 시 BadRequestException', async () => {
    adapterRegistry.has.mockReturnValueOnce(false);
    await expect(
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'user-1'),
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
      service.rotateBotToken(TRIGGER_ID, WORKSPACE_ID, NEW_TOKEN, 'user-1'),
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
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
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

    await service.update('trig-1', 'ws-1', { isActive: false }, 'u-spec');

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

    await service.update('trig-1', 'ws-1', { isActive: true }, 'u-spec');

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
      service.update('trig-1', 'ws-1', { isActive: false }, 'u-spec'),
    ).resolves.toBeDefined();
    expect(scheduleRepo.save).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
    expect(runner.registerJob).not.toHaveBeenCalled();
  });

  it('isActive 미포함 PATCH (schedule 타입, name 만) → schedule 동기 경로 미진입', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());

    await service.update('trig-1', 'ws-1', { name: 'renamed' }, 'u-spec');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(runner.registerJob).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
  });

  it('webhook 타입 PATCH isActive → schedule 동기 경로 미진입', async () => {
    triggerRepo.findOne.mockResolvedValue({
      ...scheduleTrigger(),
      type: 'webhook',
    } as Trigger);

    await service.update('trig-1', 'ws-1', { isActive: false }, 'u-spec');

    expect(scheduleRepo.findOne).not.toHaveBeenCalled();
    expect(runner.removeJob).not.toHaveBeenCalled();
  });

  it('DELETE (schedule 타입) → trigger 삭제 전 removeJob 으로 BullMQ 엔트리 정리', async () => {
    triggerRepo.findOne.mockResolvedValue(scheduleTrigger());
    scheduleRepo.findOne.mockResolvedValue(scheduleRow());

    await service.remove('trig-1', 'ws-1', 'u-spec');

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

    await service.remove('trig-1', 'ws-1', 'u-spec');

    expect(runner.removeJob).not.toHaveBeenCalled();
    expect(triggerRepo.remove).toHaveBeenCalled();
  });
});

describe('TriggersService.promoteRotatedNotificationSecrets — secret store 경유 승격 (리뷰 C3)', () => {
  let service: TriggersService;
  let triggerRepo: { createQueryBuilder: jest.Mock; save: jest.Mock };
  let secrets: { rotate: jest.Mock };

  const CANONICAL_REF = 'secret://triggers/trig-1/notification-signing';
  const baseTrigger = (signing: Record<string, unknown> | undefined) =>
    ({
      id: 'trig-1',
      workspaceId: 'ws-1',
      type: 'webhook',
      notificationSecretV2: 'wsk_newsecret',
      notificationRotatedAt: new Date('2026-06-01T00:00:00Z'),
      config: signing
        ? { notification: { url: 'https://example.com/hook', signing } }
        : {},
    }) as unknown as Trigger;

  async function build(candidates: Trigger[]) {
    triggerRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue(candidates),
      })),
      save: jest.fn(async (t: Trigger) => t),
    };
    secrets = { rotate: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        // 감사 로깅은 부수 효과 — 대상 동작의 단언을 흐리지 않도록 mock 한다.
        // 실제 기록 여부는 audit 전용 describe 가 따로 단언한다.
        { provide: AuditLogsService, useValue: { record: jest.fn() } },
        TriggersService,
        { provide: getRepositoryToken(Trigger), useValue: triggerRepo },
        { provide: getRepositoryToken(Execution), useValue: {} },
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn().mockResolvedValue(null),
            save: jest.fn(),
          },
        },
        { provide: getRepositoryToken(AuthConfig), useValue: {} },
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
            rotate: secrets.rotate,
            delete: jest.fn(),
            deleteByPrefix: jest.fn().mockResolvedValue(0),
            exists: jest.fn(),
          },
        },
      ],
    }).compile();
    service = moduleRef.get(TriggersService);
  }

  it('secretRef 보유 trigger → canonical ref 로 secrets.rotate + 평문 미기록 + v2 클리어', async () => {
    const trigger = baseTrigger({
      algorithm: 'sha256',
      secretRef: CANONICAL_REF,
    });
    await build([trigger]);

    const result = await service.promoteRotatedNotificationSecrets(
      new Date('2026-06-10T00:00:00Z').getTime(),
    );

    expect(result.promoted).toBe(1);
    expect(secrets.rotate).toHaveBeenCalledWith(
      CANONICAL_REF,
      'ws-1',
      'wsk_newsecret',
    );
    const saved = triggerRepo.save.mock.calls[0][0] as Trigger;
    const signing = (
      saved.config as { notification: { signing: Record<string, unknown> } }
    ).notification.signing;
    expect(signing.secretRef).toBe(CANONICAL_REF);
    expect(signing.secret).toBeUndefined(); // 평문을 config 에 남기지 않는다
    expect(saved.notificationSecretV2).toBeNull();
    expect(saved.notificationRotatedAt).toBeNull();
  });

  it('legacy 평문 secret 만 보유 trigger → canonical ref 신설 + 평문 키 제거', async () => {
    const trigger = baseTrigger({ algorithm: 'sha256', secret: 'old-plain' });
    await build([trigger]);

    await service.promoteRotatedNotificationSecrets(
      new Date('2026-06-10T00:00:00Z').getTime(),
    );

    expect(secrets.rotate).toHaveBeenCalledWith(
      CANONICAL_REF,
      'ws-1',
      'wsk_newsecret',
    );
    const saved = triggerRepo.save.mock.calls[0][0] as Trigger;
    const signing = (
      saved.config as { notification: { signing: Record<string, unknown> } }
    ).notification.signing;
    expect(signing.secretRef).toBe(CANONICAL_REF);
    expect(signing.secret).toBeUndefined();
  });

  it('notification config 부재 trigger → v2/rotatedAt 클리어 + save (W-2 fix)', async () => {
    // [SUMMARY W-2] 비정상 데이터(config 부재 + v2 컬럼 존재) — 매 cron skip 으로
    // 평문이 영구 잔류하지 않도록 v2/rotatedAt 를 클리어하고 경고 로그를 남긴다.
    const trigger = baseTrigger(undefined);
    await build([trigger]);

    const result = await service.promoteRotatedNotificationSecrets(
      new Date('2026-06-10T00:00:00Z').getTime(),
    );

    expect(result.promoted).toBe(0);
    expect(secrets.rotate).not.toHaveBeenCalled();
    // [testing-W-3] save 가 호출되어 v2/rotatedAt 가 null 로 클리어됐는지 확인
    expect(triggerRepo.save).toHaveBeenCalledTimes(1);
    expect(triggerRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({
        notificationSecretV2: null,
        notificationRotatedAt: null,
      }),
    );
  });
});

describe('TriggersService — 감사 로깅 (trigger.*)', () => {
  let service: TriggersService;
  let triggerRepo: jest.Mocked<Repository<Trigger>>;
  let auditLogs: { record: jest.Mock };

  const webhookTrigger = {
    id: 'trg-1',
    workspaceId: 'ws-1',
    type: 'webhook',
    name: 'W',
    config: {},
  } as unknown as Trigger;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: createBaseProviders({
        findOne: jest.fn().mockResolvedValue(webhookTrigger),
        update: jest.fn().mockResolvedValue(undefined),
        save: jest.fn(async (t: Trigger) => ({ ...webhookTrigger, ...t })),
        create: jest.fn((t: Partial<Trigger>) => t as Trigger),
        remove: jest.fn().mockResolvedValue(undefined),
        createQueryBuilder: jest.fn(),
      }),
    }).compile();
    service = moduleRef.get(TriggersService);
    triggerRepo = moduleRef.get(getRepositoryToken(Trigger));
    // createBaseProviders 는 모듈 레벨이라 describe 스코프 mock 을 못 받는다 —
    // 주입된 인스턴스를 컨테이너에서 되찾아 단언 대상으로 삼는다.
    auditLogs = moduleRef.get(AuditLogsService) as unknown as {
      record: jest.Mock;
    };
  });

  it('create 는 trigger.created 를 details.type 과 함께 남긴다', async () => {
    (triggerRepo.create as jest.Mock).mockReturnValue(webhookTrigger);
    (triggerRepo.save as jest.Mock).mockResolvedValue(webhookTrigger);

    await service.create(
      'ws-1',
      { workflowId: 'wf-1', type: 'webhook', name: 'W' } as never,
      'u-c',
    );

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'u-c',
        action: 'trigger.created',
        resourceType: 'trigger',
        details: { type: 'webhook' },
      }),
    );
  });

  it('update 는 trigger.updated 를 남긴다', async () => {
    (triggerRepo.save as jest.Mock).mockResolvedValue(webhookTrigger);

    await service.update('trg-1', 'ws-1', { name: 'W2' } as never, 'u-u');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-u',
        action: 'trigger.updated',
        resourceId: 'trg-1',
        details: { type: 'webhook' },
      }),
    );
  });

  /**
   * **회전/폐기 3종 — CRUD 와 같은 자리에서 전수로 본다.**
   *
   * 이 셋은 Editor+ 가 부를 수 있는 특권 작업이고 실행되면 기존 자격증명이 무효화되는데,
   * 2026-08-11 까지 `recordAudit` 호출이 **0건**이었다(실측). 계정 탈취 후의 조용한 시크릿
   * 교체를 `audit_log` 만으로 재구성할 수 없던 자리다.
   *
   * 액션명을 문자열로 **박아서** 단언한다 — `AUDIT_ACTIONS.X` 를 쓰면 상수를 잘못 바꿔도
   * 테스트가 함께 따라가 통과한다(자기 자신과 비교하는 셈).
   */
  it('rotateNotificationSecret 는 trigger.notification_secret_rotated 를 남긴다', async () => {
    (triggerRepo.findOne as jest.Mock).mockResolvedValue({
      ...webhookTrigger,
      config: { notification: { url: 'https://x.test/cb', events: [] } },
    });

    await service.rotateNotificationSecret('trg-1', 'ws-1', 'u-rot');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'u-rot',
        action: 'trigger.notification_secret_rotated',
        resourceType: 'trigger',
        resourceId: 'trg-1',
      }),
    );
  });

  it('revokePerTriggerToken 는 trigger.interaction_token_revoked 를 남긴다', async () => {
    (triggerRepo.findOne as jest.Mock).mockResolvedValue({
      ...webhookTrigger,
      config: { interaction: { tokenStrategy: 'per_trigger' } },
    });

    await service.revokePerTriggerToken('trg-1', 'ws-1', 'u-rev');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'u-rev',
        // **`*_rotated` 가 아니다** — 이전 토큰이 즉시 무효화되므로 회전과 구분한다.
        action: 'trigger.interaction_token_revoked',
        resourceId: 'trg-1',
      }),
    );
  });

  /**
   * **실패하면 남기지 않는다.** 회전이 던졌는데 감사 row 만 남으면 "회전됐다" 는 거짓
   * 기록이 되고, 사고 조사에서 그 행을 근거로 잘못된 타임라인을 그린다.
   */
  it('rotateNotificationSecret 가 던지면 감사를 남기지 않는다', async () => {
    (triggerRepo.findOne as jest.Mock).mockResolvedValue({
      ...webhookTrigger,
      config: {}, // notification 미설정 → NOTIFICATION_NOT_CONFIGURED
    });

    await expect(
      service.rotateNotificationSecret('trg-1', 'ws-1', 'u-rot'),
    ).rejects.toBeDefined();

    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  /**
   * **위 테스트만으로는 부족하다** — 거기서 던지는 것은 `save()` 앞의 *검증* 예외라,
   * `recordAudit` 를 검증 뒤·저장 앞으로 옮기는 뮤턴트가 그대로 GREEN 으로 산다
   * (ai-review `12_37_14` testing 이 두 메서드 모두에서 생존을 실측). 그 뮤턴트가 곧
   * 원래 잡으려던 결함 — "상태는 안 바뀌었는데 감사에는 회전됐다고 남는다" — 이다.
   *
   * 그래서 실패 지점을 **`save()` 자체**로 옮겨 자매 둘을 같은 자리에서 고정한다.
   * `create`/`update` 가 이미 쓰는 패턴(아래 "저장이 실패하면 …")과 같은 형태다.
   *
   * **자매를 각각 자기 `it()` 로 세운다.** 처음엔 둘을 한 블록에 담았는데, 그러면 앞
   * 단언이 깨지는 순간 뒤 절반은 실행조차 안 된다 — 뮤테이션을 두 번 따로 돌려야 했던
   * 이유가 그것이고, "자매를 한 자리에 몰아 놓아 하나가 다른 하나를 가린다" 는 이 PR 이
   * 세 번 반복한 형태다. 진단하는 문장만 쓰고 구조는 그대로 두면 다음 사람이 이 파일을
   * 본떠 같은 함정을 재현한다 (ai-review `12_56_06` maintainability WARNING · testing INFO).
   *
   * 회전 3종 중 `rotateBotToken` 은 6단계 mock 이 필요해 자기 describe 에 따로 있다.
   */
  it('rotateNotificationSecret — 저장이 실패하면 감사를 남기지 않는다', async () => {
    (triggerRepo.save as jest.Mock).mockRejectedValue(new Error('db down'));
    (triggerRepo.findOne as jest.Mock).mockResolvedValue({
      ...webhookTrigger,
      // validation 을 통과해야 `save()` 까지 간다 — 여기서 걸리면 검증 예외를 보는
      // 위 테스트와 같아져 이 테스트의 존재 이유가 사라진다.
      config: { notification: { url: 'https://x.example/hook' } },
    });

    await expect(
      service.rotateNotificationSecret('trg-1', 'ws-1', 'u-rot'),
    ).rejects.toThrow('db down');

    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  it('revokePerTriggerToken — 저장이 실패하면 감사를 남기지 않는다', async () => {
    (triggerRepo.save as jest.Mock).mockRejectedValue(new Error('db down'));
    (triggerRepo.findOne as jest.Mock).mockResolvedValue({
      ...webhookTrigger,
      config: { interaction: { tokenStrategy: 'per_trigger' } },
    });

    await expect(
      service.revokePerTriggerToken('trg-1', 'ws-1', 'u-rev'),
    ).rejects.toThrow('db down');

    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  it('create 는 secret 마이그레이션 **전에** 기록한다 (W6 순서 고정)', async () => {
    // 이 순서가 뒤집히면 secret store 호출이 실패했을 때 트리거는 생겼는데 감사가 안 남는다.
    // 코드로만 맞춰두면 리팩터링이 조용히 되돌려도 테스트는 GREEN 이다 — 순서를 고정한다.
    const order: string[] = [];
    (triggerRepo.create as jest.Mock).mockReturnValue(webhookTrigger);
    (triggerRepo.save as jest.Mock).mockImplementation(async () => {
      order.push('commit');
      return webhookTrigger;
    });
    auditLogs.record.mockImplementation(async () => {
      order.push('audit');
    });
    const secrets = service as unknown as {
      normalizeNotificationSecretRef: (t: unknown) => Promise<void>;
    };
    const origNorm = secrets.normalizeNotificationSecretRef.bind(service);
    secrets.normalizeNotificationSecretRef = async (t: unknown) => {
      order.push('secret');
      return origNorm(t);
    };

    await service.create(
      'ws-1',
      { workflowId: 'wf-1', type: 'webhook', name: 'W' } as never,
      'u-o',
    );

    expect(order).toEqual(['commit', 'audit', 'secret']);
  });

  it('chatChannel 분기가 있어도 기록은 **한 번**이다 (W5 회귀)', async () => {
    // 분기별로 recordAudit 을 두던 시절엔 chat_channel 트리거가 감사 2행을 남겼다.
    const chatTrigger = {
      ...webhookTrigger,
      type: 'chat_channel',
      config: { chatChannel: { provider: 'slack' } },
    } as unknown as Trigger;
    (triggerRepo.create as jest.Mock).mockReturnValue(chatTrigger);
    (triggerRepo.save as jest.Mock).mockResolvedValue(chatTrigger);
    (triggerRepo.findOne as jest.Mock).mockResolvedValue(chatTrigger);

    await service
      .create(
        'ws-1',
        {
          workflowId: 'wf-1',
          type: 'chat_channel',
          name: 'C',
          config: { chatChannel: { provider: 'slack' } },
        } as never,
        'u-cc',
      )
      .catch(() => undefined); // 어댑터 미등록 시 setup 이 던져도 기록 횟수는 검증 대상

    const created = auditLogs.record.mock.calls.filter(
      (c: unknown[]) =>
        (c[0] as { action?: string }).action === 'trigger.created',
    );
    expect(created).toHaveLength(1);
  });

  it('update 는 schedule 역동기화(BullMQ) **전에** 기록한다 (C1 회귀)', async () => {
    // 4차 리뷰가 잡은 자리다. 같은 함수의 다른 두 외부 호출은 감사 뒤에 있었는데
    // syncScheduleActivation 만 앞에 남아, schedule 타입 + isActive 변경 경로에서만
    // 불변식이 깨져 있었다. registerJob 이 throw 하면 트리거는 커밋됐는데 감사가 유실된다.
    const order: string[] = [];
    const scheduleTrigger = {
      ...webhookTrigger,
      type: 'schedule',
    } as unknown as Trigger;
    (triggerRepo.findOne as jest.Mock).mockResolvedValue(scheduleTrigger);
    (triggerRepo.save as jest.Mock).mockImplementation(async () => {
      order.push('commit');
      return scheduleTrigger;
    });
    auditLogs.record.mockImplementation(async () => {
      order.push('audit');
    });
    const svc = service as unknown as {
      syncScheduleActivation: (t: unknown, a: boolean) => Promise<void>;
    };
    svc.syncScheduleActivation = async () => {
      order.push('bullmq');
    };

    await service.update('trg-1', 'ws-1', { isActive: false } as never, 'u-s');

    expect(order).toEqual(['commit', 'audit', 'bullmq']);
  });

  it('저장이 실패하면 감사를 남기지 않는다 (create/update)', async () => {
    // 자매 모듈 3개는 이 불변식을 갖고 있는데 여기만 없었다 — 하필 순서 버그(C1)가
    // 실제로 났던 파일이라 회귀 방지 가치가 크다.
    (triggerRepo.create as jest.Mock).mockReturnValue(webhookTrigger);
    (triggerRepo.save as jest.Mock).mockRejectedValue(new Error('db down'));

    await expect(
      service.create(
        'ws-1',
        { workflowId: 'wf-1', type: 'webhook', name: 'W' } as never,
        'u-f',
      ),
    ).rejects.toThrow('db down');
    expect(auditLogs.record).not.toHaveBeenCalled();

    await expect(
      service.update('trg-1', 'ws-1', { name: 'W2' } as never, 'u-f'),
    ).rejects.toThrow('db down');
    expect(auditLogs.record).not.toHaveBeenCalled();
  });

  it('remove 는 삭제 **전에** 읽은 type 을 남긴다', async () => {
    // TypeORM `remove` 는 엔티티의 id 를 지운다 — 삭제 후 읽으면 undefined 가 감사에 남는다.
    const entity: Record<string, unknown> = { ...webhookTrigger };
    triggerRepo.findOne.mockResolvedValue(entity as unknown as Trigger);
    (triggerRepo.remove as jest.Mock).mockImplementation(async () => {
      delete entity.id;
      delete entity.type;
    });

    await service.remove('trg-1', 'ws-1', 'u-9');

    expect(auditLogs.record).toHaveBeenCalledWith(
      expect.objectContaining({
        workspaceId: 'ws-1',
        userId: 'u-9',
        action: 'trigger.deleted',
        resourceType: 'trigger',
        resourceId: 'trg-1',
        details: { type: 'webhook' },
      }),
    );
  });
});
