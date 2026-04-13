import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Repository } from 'typeorm';
import {
  ScheduleRunnerService,
  SCHEDULE_QUEUE,
} from './schedule-runner.service';
import { Schedule } from './entities/schedule.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';

describe('ScheduleRunnerService', () => {
  let service: ScheduleRunnerService;
  let nodeRepo: jest.Mocked<Repository<Node>>;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        ScheduleRunnerService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: { find: jest.fn(), findOne: jest.fn(), save: jest.fn() },
        },
        {
          provide: getRepositoryToken(Node),
          useValue: { findOne: jest.fn() },
        },
        {
          provide: getQueueToken(SCHEDULE_QUEUE),
          useValue: {
            upsertJobScheduler: jest.fn(),
            removeJobScheduler: jest.fn(),
          },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
      ],
    }).compile();

    service = moduleRef.get(ScheduleRunnerService);
    nodeRepo = moduleRef.get(getRepositoryToken(Node));
  });

  describe('resolveScheduleParameters', () => {
    const schedule: Schedule = {
      id: 's1',
      workspaceId: 'ws',
      triggerId: 't1',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      isActive: true,
      nextRunAt: new Date(),
      lastRunAt: null as unknown as Date,
      parameterValues: {
        region: 'kr',
        runAt: '{{ $now }}',
        scheduleId: '{{ $schedule.id }}',
        count: '5',
      },
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: undefined as never,
      trigger: undefined as never,
    };

    it('resolves $now and $schedule expressions and coerces types per schema', async () => {
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {
          parameters: [
            { name: 'region', type: 'string' },
            { name: 'runAt', type: 'string' },
            { name: 'scheduleId', type: 'string' },
            { name: 'count', type: 'number' },
          ],
        },
      } as unknown as Node);

      const fixedNow = new Date('2026-04-13T00:00:00Z');
      const result = await service.resolveScheduleParameters(
        schedule,
        'wf1',
        fixedNow,
      );

      expect(result).toEqual({
        region: 'kr',
        runAt: '2026-04-13T00:00:00.000Z',
        scheduleId: 's1',
        count: 5,
      });
    });

    it('returns raw resolved values when workflow has no parameter schema', async () => {
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {},
      } as unknown as Node);
      const result = await service.resolveScheduleParameters(
        { ...schedule, parameterValues: { foo: 'bar' } } as Schedule,
        'wf1',
      );
      expect(result).toEqual({});
    });

    it('returns empty object when parameterValues is empty', async () => {
      nodeRepo.findOne.mockResolvedValue(null);
      const result = await service.resolveScheduleParameters(
        { ...schedule, parameterValues: {} } as Schedule,
        'wf1',
      );
      expect(result).toEqual({});
    });

    it('falls back to pass-through values when required schema param is missing', async () => {
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {
          parameters: [
            { name: 'missing', type: 'string', required: true },
            { name: 'region', type: 'string' },
          ],
        },
      } as unknown as Node);

      const result = await service.resolveScheduleParameters(
        {
          ...schedule,
          parameterValues: { region: 'kr' },
        } as Schedule,
        'wf1',
      );
      // Validation failure → falls back to schema-less resolver which returns {}
      expect(result).toEqual({});
    });

    it('keeps raw string when limited expression evaluation fails', async () => {
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {
          parameters: [{ name: 'note', type: 'string' }],
        },
      } as unknown as Node);

      const result = await service.resolveScheduleParameters(
        {
          ...schedule,
          parameterValues: { note: '{{ $forbidden.access }}' },
        } as Schedule,
        'wf1',
      );
      // Unknown variable → evaluate throws → we keep original string
      expect(result.note).toBe('{{ $forbidden.access }}');
    });
  });
});
