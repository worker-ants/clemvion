import { ExecutionsService } from './executions.service';
import { ExecutionStatus } from './entities/execution.entity';

/**
 * 테스트용 entity-like 픽스처. `Partial<Execution>` 을 쓰면 nullable 컬럼 타입이 어긋나
 * 캐스팅 지옥이 생기므로, 이 모듈 안에서만 쓰는 평탄 타입으로 정의한다.
 * jest mock 의 반환 경계에서 unknown 으로 캐스팅해 service 가 Execution 으로 받아들이게 한다.
 */
type FakeExec = {
  id: string;
  workflowId: string;
  triggerId: string | null;
  executedBy: string | null;
  parentExecutionId: string | null;
  status: ExecutionStatus;
  startedAt: Date;
  finishedAt: Date | null;
  durationMs: number | null;
  inputData: Record<string, unknown> | null;
  outputData: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  recursionDepth: number;
  executionPath: string[];
  trigger: { id: string; type: string; name: string } | null;
  executor: { id: string; name: string | null } | null;
};

const baseFake = (overrides: Partial<FakeExec>): FakeExec => ({
  id: 'e0',
  workflowId: 'w1',
  triggerId: null,
  executedBy: null,
  parentExecutionId: null,
  status: ExecutionStatus.COMPLETED,
  startedAt: new Date('2026-05-04T10:00:00.000Z'),
  finishedAt: new Date('2026-05-04T10:00:01.000Z'),
  durationMs: 1000,
  inputData: null,
  outputData: null,
  error: null,
  recursionDepth: 0,
  executionPath: [],
  trigger: null,
  executor: null,
  ...overrides,
});

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let executionRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
  };
  let nodeExecutionRepo: { find: jest.Mock };
  let engine: { cancelWaitingExecution: jest.Mock };

  const buildListQB = (rows: FakeExec[], total = rows.length) => {
    const qb: Record<string, jest.Mock> = {};
    qb.leftJoin = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.andWhere = jest.fn().mockReturnValue(qb);
    qb.orderBy = jest.fn().mockReturnValue(qb);
    qb.skip = jest.fn().mockReturnValue(qb);
    qb.take = jest.fn().mockReturnValue(qb);
    qb.getManyAndCount = jest.fn().mockResolvedValue([rows, total]);
    return qb;
  };

  type ParentRawRow = { parent_id: string; workflow_name: string | null };
  const buildParentNameQB = (rows: ParentRawRow[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.innerJoin = jest.fn().mockReturnValue(qb);
    qb.select = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  beforeEach(() => {
    executionRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
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
      const row = baseFake({
        id: 'e1',
        triggerId: 't1',
        durationMs: 3200,
        startedAt,
        finishedAt,
        trigger: { id: 't1', type: 'schedule', name: '매일 오전 9시 보고서' },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

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

    it('maps webhook-trigger execution with triggerSource=webhook', async () => {
      const row = baseFake({
        id: 'e-wh',
        triggerId: 't-wh',
        trigger: { id: 't-wh', type: 'webhook', name: 'Stripe payment hook' },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].triggerSource).toBe('webhook');
      expect(data[0].triggerLabel).toBe('Stripe payment hook');
    });

    it('maps manual execution with executor name as label and never exposes email', async () => {
      const row = baseFake({
        id: 'e2',
        executedBy: 'u1',
        status: ExecutionStatus.RUNNING,
        finishedAt: null,
        durationMs: null,
        executor: { id: 'u1', name: 'Alice' },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].triggerSource).toBe('manual');
      expect(data[0].triggerLabel).toBe('Alice');
      expect(data[0].executedBy).toBe('u1');
      // 라벨에 이메일 같은 PII 가 절대 들어가서는 안 된다.
      expect(JSON.stringify(data[0])).not.toMatch(/@/);
    });

    it('subworkflow execution loads parent workflow.name once via batch QB and uses it as label', async () => {
      const childA = baseFake({
        id: 'c1',
        workflowId: 'wChild',
        parentExecutionId: 'p1',
        recursionDepth: 1,
      });
      const childB = baseFake({
        id: 'c2',
        workflowId: 'wChild',
        parentExecutionId: 'p1',
        recursionDepth: 1,
      });
      const parentNameQB = buildParentNameQB([
        { parent_id: 'p1', workflow_name: 'Parent Workflow' },
      ]);
      executionRepo.createQueryBuilder
        .mockReturnValueOnce(buildListQB([childA, childB]) as unknown)
        .mockReturnValueOnce(parentNameQB as unknown);

      const { data } = await service.findByWorkflow('wChild', {});
      expect(data).toHaveLength(2);
      for (const d of data) {
        expect(d.triggerSource).toBe('subworkflow');
        expect(d.triggerLabel).toBe('Parent Workflow');
      }
      // 부모 lookup 은 1회의 배치 쿼리만 (N+1 방지)
      expect(parentNameQB.getRawMany).toHaveBeenCalledTimes(1);
      expect(parentNameQB.where).toHaveBeenCalledWith(
        'pe.id IN (:...ids)',
        expect.objectContaining({ ids: ['p1'] }),
      );
    });

    it('handles mixed parentExecutionIds (multiple parents) in a single page', async () => {
      const c1 = baseFake({
        id: 'c1',
        workflowId: 'wChild',
        parentExecutionId: 'p1',
      });
      const c2 = baseFake({
        id: 'c2',
        workflowId: 'wChild',
        parentExecutionId: 'p2',
      });
      const c3 = baseFake({
        id: 'c3',
        workflowId: 'wChild',
        parentExecutionId: 'p1',
      });
      const parentNameQB = buildParentNameQB([
        { parent_id: 'p1', workflow_name: 'Parent A' },
        { parent_id: 'p2', workflow_name: 'Parent B' },
      ]);
      executionRepo.createQueryBuilder
        .mockReturnValueOnce(buildListQB([c1, c2, c3]) as unknown)
        .mockReturnValueOnce(parentNameQB as unknown);

      const { data } = await service.findByWorkflow('wChild', {});
      const labelById = Object.fromEntries(
        data.map((d) => [d.id, d.triggerLabel]),
      );
      expect(labelById).toEqual({
        c1: 'Parent A',
        c2: 'Parent B',
        c3: 'Parent A',
      });
      // 중복 제거되어 두 부모만 IN 절에 포함
      expect(parentNameQB.where).toHaveBeenCalledWith(
        'pe.id IN (:...ids)',
        expect.objectContaining({
          ids: expect.arrayContaining(['p1', 'p2']),
        }),
      );
    });

    it('does not run parent-name batch query when no subworkflow rows exist', async () => {
      const row = baseFake({
        id: 'e3',
        executedBy: 'u1',
        executor: { id: 'u1', name: 'Alice' },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      await service.findByWorkflow('w1', {});
      // list QB 1회만 생성, parent batch QB 미생성
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('falls back to triggerSource=unknown when triggerId is set but Trigger relation is missing', async () => {
      const row = baseFake({
        id: 'e4',
        triggerId: 't1',
        trigger: null,
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].triggerSource).toBe('unknown');
      expect(data[0].triggerLabel).toBeNull();
    });
  });
});
