import { ExecutionsService } from './executions.service';
import { Execution, ExecutionStatus } from './entities/execution.entity';

type AnyExec = Partial<Execution> & {
  trigger?: { id: string; type: string; name: string } | null;
  executor?: { id: string; name: string | null; email: string | null } | null;
};

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let executionRepo: {
    createQueryBuilder: jest.Mock;
    find: jest.Mock;
    findOne: jest.Mock;
    save: jest.Mock;
  };
  let nodeExecutionRepo: { find: jest.Mock };
  let engine: { cancelWaitingExecution: jest.Mock };

  const buildQB = (rows: AnyExec[], total = rows.length) => {
    const qb: Record<string, jest.Mock> = {} as Record<string, jest.Mock>;
    qb.leftJoin = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.skip = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    qb.getCount = jest.fn().mockResolvedValue(total);
    qb.getMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  beforeEach(() => {
    executionRepo = {
      createQueryBuilder: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      findOne: jest.fn(),
      save: jest.fn(),
    };
    nodeExecutionRepo = { find: jest.fn() };
    engine = { cancelWaitingExecution: jest.fn() };
    service = new ExecutionsService(
      executionRepo as never,
      nodeExecutionRepo as never,
      engine as never,
    );
  });

  describe('findByWorkflow → DTO mapping', () => {
    it('maps schedule-trigger execution with triggerSource=schedule and Trigger.name as label', async () => {
      const startedAt = new Date('2026-05-04T10:00:00.000Z');
      const finishedAt = new Date('2026-05-04T10:00:03.200Z');
      const row: AnyExec = {
        id: 'e1',
        workflowId: 'w1',
        triggerId: 't1',
        executedBy: null as never,
        parentExecutionId: null as never,
        status: ExecutionStatus.COMPLETED,
        startedAt,
        finishedAt,
        durationMs: 3200,
        inputData: null as never,
        outputData: null as never,
        error: null as never,
        recursionDepth: 0,
        executionPath: [],
        trigger: { id: 't1', type: 'schedule', name: '매일 오전 9시 보고서' },
        executor: null,
      };
      executionRepo.createQueryBuilder.mockReturnValue(buildQB([row]));

      const result = await service.findByWorkflow('w1', {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0]).toMatchObject({
        id: 'e1',
        workflowId: 'w1',
        triggerId: 't1',
        triggerSource: 'schedule',
        triggerLabel: '매일 오전 9시 보고서',
        status: ExecutionStatus.COMPLETED,
        durationMs: 3200,
      });
      expect(result.data[0].startedAt).toBe(startedAt.toISOString());
      expect(result.data[0].finishedAt).toBe(finishedAt.toISOString());
    });

    it('maps manual execution with executor name as label', async () => {
      const row: AnyExec = {
        id: 'e2',
        workflowId: 'w1',
        triggerId: null as never,
        executedBy: 'u1',
        parentExecutionId: null as never,
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(),
        finishedAt: null as never,
        durationMs: null as never,
        recursionDepth: 0,
        executionPath: [],
        executor: { id: 'u1', name: 'Alice', email: 'a@x.com' },
        trigger: null,
      };
      executionRepo.createQueryBuilder.mockReturnValue(buildQB([row]));

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].triggerSource).toBe('manual');
      expect(data[0].triggerLabel).toBe('Alice');
      expect(data[0].executedBy).toBe('u1');
    });

    it('subworkflow execution loads parent workflow.name once via batch query and uses it as label', async () => {
      const childA: AnyExec = {
        id: 'c1',
        workflowId: 'wChild',
        triggerId: null as never,
        executedBy: null as never,
        parentExecutionId: 'p1',
        status: ExecutionStatus.COMPLETED,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 100,
        recursionDepth: 1,
        executionPath: [],
        trigger: null,
        executor: null,
      };
      const childB: AnyExec = { ...childA, id: 'c2', parentExecutionId: 'p1' };
      executionRepo.createQueryBuilder.mockReturnValue(
        buildQB([childA, childB]),
      );
      executionRepo.find.mockResolvedValue([
        { id: 'p1', workflow: { name: 'Parent Workflow' } },
      ]);

      const { data } = await service.findByWorkflow('wChild', {});
      expect(data).toHaveLength(2);
      for (const d of data) {
        expect(d.triggerSource).toBe('subworkflow');
        expect(d.triggerLabel).toBe('Parent Workflow');
      }
      // 부모 실행의 workflow.name 은 batch 1회만 조회 (N+1 방지)
      expect(executionRepo.find).toHaveBeenCalledTimes(1);
    });

    it('does not query parent workflows when no subworkflow rows exist', async () => {
      const row: AnyExec = {
        id: 'e3',
        workflowId: 'w1',
        triggerId: null as never,
        executedBy: 'u1',
        parentExecutionId: null as never,
        status: ExecutionStatus.COMPLETED,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 50,
        recursionDepth: 0,
        executionPath: [],
        executor: { id: 'u1', name: 'Alice', email: 'a@x.com' },
        trigger: null,
      };
      executionRepo.createQueryBuilder.mockReturnValue(buildQB([row]));

      await service.findByWorkflow('w1', {});
      expect(executionRepo.find).not.toHaveBeenCalled();
    });

    it('falls back to triggerSource=unknown when triggerId is set but Trigger relation is missing', async () => {
      const row: AnyExec = {
        id: 'e4',
        workflowId: 'w1',
        triggerId: 't1',
        executedBy: null as never,
        parentExecutionId: null as never,
        status: ExecutionStatus.COMPLETED,
        startedAt: new Date(),
        finishedAt: new Date(),
        durationMs: 10,
        recursionDepth: 0,
        executionPath: [],
        trigger: null,
        executor: null,
      };
      executionRepo.createQueryBuilder.mockReturnValue(buildQB([row]));

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].triggerSource).toBe('unknown');
      expect(data[0].triggerLabel).toBeNull();
    });
  });
});
