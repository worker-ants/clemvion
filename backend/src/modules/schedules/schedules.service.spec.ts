import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SchedulesService } from './schedules.service';
import { Schedule } from './entities/schedule.entity';
import { Trigger } from '../triggers/entities/trigger.entity';
import { ExecutionEngineService } from '../execution-engine/execution-engine.service';
import { ScheduleRunnerService } from './schedule-runner.service';

describe('SchedulesService.runNow', () => {
  let service: SchedulesService;
  let scheduleRepo: jest.Mocked<Repository<Schedule>>;
  let engine: jest.Mocked<ExecutionEngineService>;
  let runner: jest.Mocked<
    Pick<ScheduleRunnerService, 'resolveScheduleParameters'>
  >;

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        SchedulesService,
        {
          provide: getRepositoryToken(Schedule),
          useValue: {
            findOne: jest.fn(),
            save: jest.fn(),
            create: jest.fn(),
            remove: jest.fn(),
            createQueryBuilder: jest.fn(),
          },
        },
        {
          provide: getRepositoryToken(Trigger),
          useValue: { create: jest.fn(), save: jest.fn(), delete: jest.fn() },
        },
        {
          provide: ExecutionEngineService,
          useValue: { execute: jest.fn() },
        },
        {
          provide: ScheduleRunnerService,
          useValue: {
            resolveScheduleParameters: jest.fn(),
            registerJob: jest.fn(),
            removeJob: jest.fn(),
          },
        },
      ],
    }).compile();

    service = moduleRef.get(SchedulesService);
    scheduleRepo = moduleRef.get(getRepositoryToken(Schedule));
    engine = moduleRef.get(ExecutionEngineService);
    runner = moduleRef.get(ScheduleRunnerService);
  });

  it('resolves parameterValues via runner before executing', async () => {
    scheduleRepo.findOne.mockResolvedValue({
      id: 's1',
      workspaceId: 'ws',
      triggerId: 't1',
      cronExpression: '0 9 * * *',
      timezone: 'Asia/Seoul',
      isActive: true,
      parameterValues: { region: 'kr' },
      trigger: { workflowId: 'wf1' },
    } as unknown as Schedule);

    runner.resolveScheduleParameters.mockResolvedValue({ region: 'kr' });
    engine.execute.mockResolvedValue('exec-42');

    const res = await service.runNow('s1', 'ws', 'user-1');

    expect(res).toEqual({ executionId: 'exec-42' });
    const resolveMock = runner.resolveScheduleParameters;
    expect(resolveMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: 's1' }),
      'wf1',
    );
    const executeMock = engine.execute;
    expect(executeMock).toHaveBeenCalledWith(
      'wf1',
      { __triggerSource: 'schedule', parameters: { region: 'kr' } },
      { executedBy: 'user-1' },
    );
  });
});
