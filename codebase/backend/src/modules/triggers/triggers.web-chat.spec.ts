import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { Provider } from '@nestjs/common';
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
 * 웹채팅 콘솔 follow-up: (3) `?interactionEnabled=true` 서버 필터,
 * (2) `config.interaction.appearance` per-instance 외형 서버 저장.
 * SoT: spec/7-channel-web-chat/5-admin-console.md §2·§4.
 */

function otherProviders(): Provider[] {
  return [
    { provide: getRepositoryToken(Execution), useValue: {} },
    {
      provide: getRepositoryToken(Schedule),
      useValue: { findOne: jest.fn().mockResolvedValue(null), save: jest.fn() },
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

async function makeService(
  triggerRepoMock: Record<string, unknown>,
): Promise<TriggersService> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      TriggersService,
      { provide: getRepositoryToken(Trigger), useValue: triggerRepoMock },
      ...otherProviders(),
    ],
  }).compile();
  return moduleRef.get(TriggersService);
}

describe('TriggersService.findAll — interactionEnabled 필터 (follow-up 3)', () => {
  function makeQb() {
    const qb: Record<string, jest.Mock> = {
      leftJoinAndSelect: jest.fn(() => qb),
      where: jest.fn(() => qb),
      andWhere: jest.fn(() => qb),
      orderBy: jest.fn(() => qb),
      offset: jest.fn(() => qb),
      limit: jest.fn(() => qb),
      getCount: jest.fn().mockResolvedValue(0),
      getMany: jest.fn().mockResolvedValue([]),
    };
    return qb;
  }

  it('interactionEnabled=true 면 config.interaction.enabled JSONB 절을 추가한다', async () => {
    const qb = makeQb();
    const service = await makeService({
      createQueryBuilder: jest.fn(() => qb),
    });
    await service.findAll('ws-1', { interactionEnabled: true });
    expect(qb.andWhere).toHaveBeenCalledWith(
      expect.stringContaining("config->'interaction'->>'enabled'"),
      { interactionEnabled: true },
    );
  });

  it('interactionEnabled 미지정이면 해당 절을 추가하지 않는다', async () => {
    const qb = makeQb();
    const service = await makeService({
      createQueryBuilder: jest.fn(() => qb),
    });
    await service.findAll('ws-1', {});
    const interactionClause = qb.andWhere.mock.calls.find(
      ([sql]) => typeof sql === 'string' && sql.includes("'interaction'"),
    );
    expect(interactionClause).toBeUndefined();
  });
});

describe('TriggersService — config.interaction.appearance 저장 (follow-up 2)', () => {
  it('create 시 interaction.appearance 가 config 에 보존된다', async () => {
    const service = await makeService({
      create: jest.fn((x: unknown) => x),
      save: jest.fn(async (x: Record<string, unknown>) => ({
        id: 't-new',
        ...x,
      })),
      findOne: jest.fn(),
      update: jest.fn(),
    });
    const appearance = {
      primaryColor: '#5B4FE9',
      position: 'bottom-right',
      headerTitle: 'Bot',
    };
    const result = await service.create('ws-1', {
      type: 'webhook',
      workflowId: 'wf-1',
      name: 'n',
      endpointPath: 'ep',
      interaction: {
        enabled: true,
        tokenStrategy: 'per_execution',
        appearance,
      },
    } as never);
    expect(
      (result.config as { interaction?: { appearance?: unknown } }).interaction
        ?.appearance,
    ).toEqual(appearance);
  });

  it('update 시 interaction 전체(enabled·tokenStrategy·appearance)를 교체 저장한다', async () => {
    const existing = {
      id: 't-1',
      workspaceId: 'ws-1',
      type: 'webhook',
      config: {
        interaction: { enabled: true, tokenStrategy: 'per_execution' },
      },
    };
    const service = await makeService({
      findOne: jest.fn().mockResolvedValue(existing),
      save: jest.fn(async (x: Record<string, unknown>) => x),
      update: jest.fn(),
    });
    const appearance = { primaryColor: '#112233', welcomeText: '안녕하세요' };
    const result = await service.update('t-1', 'ws-1', {
      interaction: {
        enabled: true,
        tokenStrategy: 'per_execution',
        appearance,
      },
    } as never);
    const interaction = (
      result.config as { interaction?: Record<string, unknown> }
    ).interaction;
    expect(interaction?.appearance).toEqual(appearance);
    expect(interaction?.enabled).toBe(true);
    expect(interaction?.tokenStrategy).toBe('per_execution');
  });
});
