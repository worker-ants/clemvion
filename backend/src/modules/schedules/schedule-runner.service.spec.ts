import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';
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
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;
  let engine: jest.Mocked<ExecutionEngineService>;

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
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
    engine = moduleRef.get(ExecutionEngineService);
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
        { ...schedule, parameterValues: { foo: 'bar' } },
        'wf1',
      );
      expect(result).toEqual({});
    });

    it('returns empty object when parameterValues is empty', async () => {
      nodeRepo.findOne.mockResolvedValue(null);
      const result = await service.resolveScheduleParameters(
        { ...schedule, parameterValues: {} },
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
        },
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
        },
        'wf1',
      );
      // Unknown variable → evaluate throws → we keep original string
      expect(result.note).toBe('{{ $forbidden.access }}');
    });
  });

  describe('process() — cron 자동 실행', () => {
    // cron 발화로 만들어진 Execution 행은 schedule.triggerId 를 반드시 채워야
    // "최근 실행" 화면이 출처를 schedule 로 분류한다 (deriveExecutionTrigger).

    const baseSchedule: Schedule = {
      id: 's1',
      workspaceId: 'ws',
      triggerId: 'trigger-uuid',
      cronExpression: '*/5 * * * *',
      timezone: 'Asia/Seoul',
      isActive: true,
      nextRunAt: new Date(),
      lastRunAt: null as unknown as Date,
      parameterValues: {},
      createdAt: new Date(),
      updatedAt: new Date(),
      workspace: undefined as never,
      trigger: { workflowId: 'wf1' } as never,
    };

    const job = {
      data: { scheduleId: 's1', workspaceId: 'ws' },
    } as Job<{ scheduleId: string; workspaceId: string }>;

    it('passes { triggerId: schedule.triggerId } to executionEngineService.execute', async () => {
      scheduleRepo.findOne.mockResolvedValue(baseSchedule);
      scheduleRepo.save.mockImplementation((s) => Promise.resolve(s as Schedule));
      nodeRepo.findOne.mockResolvedValue({
        id: 'n',
        workflowId: 'wf1',
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        config: {},
      } as unknown as Node);
      engine.execute.mockResolvedValue('exec-1');

      await service.process(job);

      expect(engine.execute).toHaveBeenCalledWith(
        'wf1',
        expect.objectContaining({ parameters: expect.any(Object) }),
        { triggerId: 'trigger-uuid' },
      );
    });

    it('skips when schedule is inactive', async () => {
      scheduleRepo.findOne.mockResolvedValue({
        ...baseSchedule,
        isActive: false,
      });

      await service.process(job);

      expect(engine.execute).not.toHaveBeenCalled();
    });

    it('skips when schedule has no associated workflow', async () => {
      scheduleRepo.findOne.mockResolvedValue({
        ...baseSchedule,
        trigger: undefined as never,
      });

      await service.process(job);

      expect(engine.execute).not.toHaveBeenCalled();
    });
  });
});
