import {
  ExecutionsService,
  MAX_EXECUTION_PATH_ROWS,
} from './executions.service';
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
  // executionPath 컬럼은 V035 에서 제거됐으며 별도 execution_node_log 테이블로
  // 이행됐다. fixture 에는 더 이상 포함하지 않는다.
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
  trigger: null,
  executor: null,
  ...overrides,
});

describe('ExecutionsService', () => {
  let service: ExecutionsService;
  let executionRepo: {
    createQueryBuilder: jest.Mock;
    findOne: jest.Mock;
    manager: { transaction: jest.Mock };
  };
  let nodeExecutionRepo: { find: jest.Mock; createQueryBuilder: jest.Mock };
  let executionNodeLogRepo: { find: jest.Mock };
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

  // C-7: node_execution status 집계 (Nodes 열). loadNodeExecutionCounts 가
  // 호출하는 nodeExecutionRepository.createQueryBuilder 의 그룹 쿼리 mock.
  type NodeCountRow = {
    executionId: string;
    total: string;
    completed: string;
    failed: string;
  };
  const buildNodeCountQB = (rows: NodeCountRow[]) => {
    const qb: Record<string, jest.Mock> = {};
    qb.select = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.groupBy = jest.fn().mockReturnValue(qb);
    qb.getRawMany = jest.fn().mockResolvedValue(rows);
    return qb;
  };

  beforeEach(() => {
    // findById 가 `executionRepository.manager.transaction(...)` 안에서 SELECT
    // 두 개를 묶어 atomic snapshot 을 보장한다 (Carousel disabled stuck Phase
    // 3 fix). transaction mock 은 callback 을 즉시 실행하면서 manager 로
    // queryBuilder / find 호출을 기존 repo mock 으로 라우팅 — 호출 추적과
    // 응답 shape 이 그대로 유지된다.
    const transactionImpl = async (...args: unknown[]): Promise<unknown> => {
      const cb = args.find((a) => typeof a === 'function') as (
        m: unknown,
      ) => Promise<unknown>;
      const manager = {
        createQueryBuilder: (..._a: unknown[]) =>
          executionRepo.createQueryBuilder(),
        find: (entity: unknown, opts: unknown) => {
          // Route by entity name. `name` is the class name string.
          const ctor = entity as { name?: string } | undefined;
          if (ctor?.name === 'ExecutionNodeLog') {
            return executionNodeLogRepo.find(opts);
          }
          return nodeExecutionRepo.find(opts);
        },
      };
      return cb(manager);
    };
    executionRepo = {
      createQueryBuilder: jest.fn(),
      findOne: jest.fn(),
      manager: { transaction: jest.fn(transactionImpl) },
    } as unknown as typeof executionRepo;
    nodeExecutionRepo = {
      find: jest.fn(),
      // 기본: 집계 행 없음 → 모든 count 0. 특정 테스트가 mockReturnValueOnce 로 override.
      createQueryBuilder: jest.fn(() => buildNodeCountQB([])),
    } as unknown as typeof nodeExecutionRepo;
    executionNodeLogRepo = { find: jest.fn().mockResolvedValue([]) };
    engine = { cancelWaitingExecution: jest.fn() };
    service = new ExecutionsService(
      executionRepo as never,
      nodeExecutionRepo as never,
      executionNodeLogRepo as never,
      { find: jest.fn() } as never, // nodeRepository (re-run inputOverride 검증용)
      engine as never,
      { getComponent: jest.fn() } as never, // nodeComponentRegistry (dry-run gate)
      { record: jest.fn() } as never, // auditLogsService (re_run_initiated)
      { getMemberRole: jest.fn() } as never, // workspacesService (RR-PL-06)
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

    it('maps node execution counts (Nodes 열) from grouped aggregate query', async () => {
      const row = baseFake({ id: 'e-cnt', triggerId: 't1' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );
      nodeExecutionRepo.createQueryBuilder.mockReturnValueOnce(
        buildNodeCountQB([
          { executionId: 'e-cnt', total: '5', completed: '3', failed: '1' },
        ]) as never,
      );

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0]).toMatchObject({
        totalNodeCount: 5,
        completedNodeCount: 3,
        failedNodeCount: 1,
      });
    });

    it('defaults node counts to 0 when no node_execution rows exist', async () => {
      const row = baseFake({ id: 'e-zero', triggerId: 't1' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );
      // nodeExecutionRepo.createQueryBuilder 기본 mock → 빈 집계.

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0]).toMatchObject({
        totalNodeCount: 0,
        completedNodeCount: 0,
        failedNodeCount: 0,
      });
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

    it('orderBy uses entity property names (camelCase), not DB column names', async () => {
      // Regression: leftJoin + skip/take + orderBy(snake_case) 조합에서
      // TypeORM 이 메타데이터 lookup 에 실패해 'databaseName' 에러를 일으켰던 케이스.
      const row = baseFake({ id: 'eo' });
      const listQB = buildListQB([row]);
      executionRepo.createQueryBuilder.mockReturnValueOnce(listQB as unknown);

      await service.findByWorkflow('w1', { sort: 'started_at', order: 'desc' });
      expect(listQB.orderBy).toHaveBeenCalledWith('e.startedAt', 'DESC');

      const listQB2 = buildListQB([row]);
      executionRepo.createQueryBuilder.mockReturnValueOnce(listQB2 as unknown);
      await service.findByWorkflow('w1', { sort: 'duration_ms', order: 'asc' });
      expect(listQB2.orderBy).toHaveBeenCalledWith('e.durationMs', 'ASC');

      const listQB3 = buildListQB([row]);
      executionRepo.createQueryBuilder.mockReturnValueOnce(listQB3 as unknown);
      await service.findByWorkflow('w1', {
        sort: 'finished_at',
        order: 'desc',
      });
      expect(listQB3.orderBy).toHaveBeenCalledWith('e.finishedAt', 'DESC');
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

  // PR-B — findById 가 V035 의 execution_node_log 에서 (execution_id, id)
  // 정렬로 executionPath 를 채운다. 기존 list 응답은 N+1 회피로 빈 배열.
  describe('findById → execution_node_log 기반 executionPath 채움', () => {
    const buildSingleQB = (row: FakeExec | null) => {
      const qb: Record<string, jest.Mock> = {};
      qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
      qb.leftJoin = jest.fn().mockReturnValue(qb);
      qb.addSelect = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.getOne = jest.fn().mockResolvedValue(row);
      return qb;
    };

    it('executionNodeLogRepo.find 결과의 nodeId 배열을 executionPath 로 노출', async () => {
      const row = baseFake({ id: 'eF1' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([
        { nodeId: 'n1' },
        { nodeId: 'n2' },
        { nodeId: 'n3' },
      ]);

      const result = (await service.findById('eF1')) as {
        executionPath: string[];
        executionPathTruncated: boolean;
      };
      expect(result.executionPath).toEqual(['n1', 'n2', 'n3']);
      expect(result.executionPathTruncated).toBe(false);
      expect(executionNodeLogRepo.find).toHaveBeenCalledWith({
        where: { executionId: 'eF1' },
        order: { id: 'ASC' },
        select: { nodeId: true },
        take: MAX_EXECUTION_PATH_ROWS,
      });
    });

    it('execution_node_log 비어있으면 executionPath 는 빈 배열', async () => {
      const row = baseFake({ id: 'eF2' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([]);

      const result = (await service.findById('eF2')) as {
        executionPath: string[];
        executionPathTruncated: boolean;
      };
      expect(result.executionPath).toEqual([]);
      expect(result.executionPathTruncated).toBe(false);
    });

    it('execution_node_log 가 상한과 동일 길이로 돌아오면 executionPathTruncated=true', async () => {
      // pathRows.length >= MAX_EXECUTION_PATH_ROWS 면 그 너머의 행이 잘렸을 수
      // 있음을 UI 에 알린다 (Review 후속 #6).
      const row = baseFake({ id: 'eF3' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue(
        Array.from({ length: MAX_EXECUTION_PATH_ROWS }, (_, i) => ({
          nodeId: `n${i}`,
        })),
      );

      const result = (await service.findById('eF3')) as {
        executionPath: string[];
        executionPathTruncated: boolean;
      };
      expect(result.executionPath.length).toBe(MAX_EXECUTION_PATH_ROWS);
      expect(result.executionPathTruncated).toBe(true);
    });

    it('종결 상태 (completed) 첫 findById 결과를 인스턴스 캐시에 보관, 2회차는 DB 미조회 (W-27)', async () => {
      const row = baseFake({
        id: 'eF-cached',
        status: ExecutionStatus.COMPLETED,
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([{ nodeId: 'n1' }]);

      const first = await service.findById('eF-cached');
      expect(first.executionPath).toEqual(['n1']);
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);

      // 2회차 — createQueryBuilder 가 다시 호출되지 않아야 한다.
      const second = await service.findById('eF-cached');
      expect(second).toBe(first); // 동일 참조 반환 (캐시 hit)
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
    });

    it('진행 중 상태 (running) 는 캐시하지 않음 — 매번 DB 재조회', async () => {
      const row = baseFake({
        id: 'eF-running',
        status: ExecutionStatus.RUNNING,
      });
      executionRepo.createQueryBuilder.mockReturnValue(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([]);

      await service.findById('eF-running');
      await service.findById('eF-running');
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    });

    it('invalidateSnapshotCache 호출 후엔 캐시 무효화 — DB 재조회', async () => {
      const completedRow = baseFake({
        id: 'eF-inv',
        status: ExecutionStatus.COMPLETED,
      });
      executionRepo.createQueryBuilder.mockReturnValue(
        buildSingleQB(completedRow) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([]);

      await service.findById('eF-inv');
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      service.invalidateSnapshotCache('eF-inv');
      await service.findById('eF-inv');
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(2);
    });

    it('list 응답 (findByWorkflow) 의 executionPath 는 N+1 회피로 빈 배열', async () => {
      const row = baseFake({ id: 'eL1' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );
      // 의도적으로 log 에 데이터가 있어도 list 는 호출하지 않음.
      executionNodeLogRepo.find.mockResolvedValue([{ nodeId: 'n9' }]);

      const { data } = await service.findByWorkflow('w1', {});
      expect(data[0].executionPath).toEqual([]);
      // list 경로에서는 log repo 가 호출되지 않아야 한다 (N+1 회피).
      expect(executionNodeLogRepo.find).not.toHaveBeenCalled();
    });
  });
});
