import { Logger, ServiceUnavailableException } from '@nestjs/common';

import {
  ExecutionsService,
  MAX_EXECUTION_PATH_ROWS,
  SNAPSHOT_CACHE_MAX_ENTRIES,
} from './executions.service';
import { ExecutionStatus } from './entities/execution.entity';
import { PG_INT4_MAX } from '../../shared/utils/terminal-duration';

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

  // `findById` 계열의 단건 조회 QueryBuilder 스텁. `buildListQB`/`buildParentNameQB`/
  // `buildNodeCountQB` 와 같은 최상위 자리에 둔다 — 종전에는 두 describe 가 토씨 하나
  // 다르지 않은 구현을 각자 선언해, 체인이 바뀌면 두 곳을 따로 고쳐야 했다.
  const buildSingleQB = (row: FakeExec | null) => {
    const qb: Record<string, jest.Mock> = {};
    qb.leftJoinAndSelect = jest.fn().mockReturnValue(qb);
    qb.leftJoin = jest.fn().mockReturnValue(qb);
    qb.addSelect = jest.fn().mockReturnValue(qb);
    qb.where = jest.fn().mockReturnValue(qb);
    qb.getOne = jest.fn().mockResolvedValue(row);
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
    engine = {
      // C-1 — cancelWaitingExecution 은 async + ContinuationPublishResult 반환.
      cancelWaitingExecution: jest
        .fn()
        .mockResolvedValue({ queued: true, jobId: 'job-cancel' }),
    };
    service = new ExecutionsService(
      executionRepo as never,
      nodeExecutionRepo as never,
      executionNodeLogRepo as never,
      { find: jest.fn() } as never, // nodeRepository (re-run inputOverride 검증용)
      engine as never,
      { getComponent: jest.fn() } as never, // nodeComponentRegistry (dry-run gate)
      { record: jest.fn() } as never, // auditLogsService (execution.re_run)
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

    /**
     * `snapshotCache` 는 256건 상한 LRU 다. 상한 자체를 검사하는 테스트가 **한 건도 없었다**
     * (`grep -rn "snapshotCache" --include="*.spec.ts"` → 0건) — 캐시가 무한히 자라도,
     * evict 가 최신 키를 지워도 아무도 몰랐다.
     *
     * **경계값으로 고정한다.** 257번째 삽입이 첫 키를 밀어내는지(= 상한이 실제로 작동),
     * 그리고 밀려나는 것이 **가장 오래된 키**인지(= LRU 방향이 맞음)를 함께 본다.
     * 방향을 안 보면 "무언가 하나 지운다" 만 고정돼 최신 키를 지우는 회귀가 통과한다.
     *
     * private 메서드를 직접 부르지 않고 `findById` 를 통해 넣는다 — 캐시 적재 배선 자체는
     * 위 W-27 테스트가 이미 덮으므로, 여기서는 그 위에 상한/방향만 얹는다.
     */
    it('snapshotCache 상한 값 자체를 고정 — 심볼만 쓰면 변경이 조용히 통과한다', () => {
      expect(SNAPSHOT_CACHE_MAX_ENTRIES).toBe(256);
    });

    it('snapshotCache 는 256건 상한 — 257번째가 가장 오래된 키를 evict', async () => {
      executionRepo.createQueryBuilder.mockImplementation(
        () =>
          buildSingleQB(
            baseFake({ status: ExecutionStatus.COMPLETED }),
          ) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);
      executionNodeLogRepo.find.mockResolvedValue([]);

      // 상한까지 채운다 (e-0 … e-255).
      for (let i = 0; i < SNAPSHOT_CACHE_MAX_ENTRIES; i += 1) {
        await service.findById(`e-${i}`);
      }
      const afterFill = executionRepo.createQueryBuilder.mock.calls.length;
      expect(afterFill).toBe(SNAPSHOT_CACHE_MAX_ENTRIES);

      // 상한 안에서는 전부 hit — DB 재조회 0건.
      await service.findById('e-0');
      await service.findById('e-255');
      expect(executionRepo.createQueryBuilder.mock.calls.length).toBe(
        afterFill,
      );

      // 257번째 삽입 → evict 1건.
      await service.findById('e-256');
      expect(executionRepo.createQueryBuilder.mock.calls.length).toBe(
        afterFill + 1,
      );

      // 밀려난 것은 **가장 오래된** 키여야 한다. 위에서 e-0 을 읽어 LRU 를 갱신했으므로
      // 이제 가장 오래된 것은 e-1 이다 — 이 단언이 LRU 방향을 가른다.
      await service.findById('e-1');
      expect(executionRepo.createQueryBuilder.mock.calls.length).toBe(
        afterFill + 2, // miss → 재조회
      );
      await service.findById('e-0');
      expect(executionRepo.createQueryBuilder.mock.calls.length).toBe(
        afterFill + 2, // 여전히 hit — 최근 사용이라 살아남았다
      );
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

    // Carousel disabled stuck 회귀 — blocking 노드는 봉투(outputData.status=
    // 'waiting_for_input')를 먼저 저장하고 status 컬럼은 'running' 으로 둔 뒤
    // waitForXxx 가 atomic 전이한다. 그 사이 snapshot 이 읽히면 같은 row 가
    // status='running' + outputData.status='waiting_for_input' 인 intra-row
    // inconsistent. findById 가 봉투 status 를 surface 해 정규화해야 frontend 의
    // ne.status 기반 reconciliation 이 waiting UI 를 wipe/누락하지 않는다.
    it("blocking 노드의 status='running' + outputData.status='waiting_for_input' 를 waiting_for_input 으로 정규화", async () => {
      const row = baseFake({ id: 'eW1', status: ExecutionStatus.RUNNING });
      // INFO#9: mockReturnValueOnce 로 통일 — 단일 호출 테스트에서 영구 mock 불필요.
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne-carousel',
          nodeId: 'carousel-node',
          status: 'running', // 컬럼은 아직 RUNNING (pre-park window)
          outputData: {
            config: { buttons: [{ id: 'b1', type: 'port', label: 'A' }] },
            output: {},
            status: 'waiting_for_input', // 봉투는 waiting
            meta: { interactionType: 'buttons' },
          },
        },
      ]);
      executionNodeLogRepo.find.mockResolvedValue([
        { nodeId: 'carousel-node' },
      ]);

      const result = (await service.findById('eW1')) as {
        nodeExecutions: { status: string }[];
      };
      expect(result.nodeExecutions[0].status).toBe('waiting_for_input');
    });

    // INFO#1: PENDING 상태 노드의 봉투 신호 채택 경로.
    it("blocking 노드의 status='pending' + outputData.status='waiting_for_input' 를 waiting_for_input 으로 정규화", async () => {
      const row = baseFake({ id: 'eW3', status: ExecutionStatus.RUNNING });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne-pending',
          nodeId: 'form-node',
          status: 'pending', // ← pending 상태에서도 봉투 채택해야 함
          outputData: {
            config: { fields: [] },
            output: {},
            status: 'waiting_for_input',
            meta: { interactionType: 'form' },
          },
        },
      ]);
      executionNodeLogRepo.find.mockResolvedValue([{ nodeId: 'form-node' }]);

      const result = (await service.findById('eW3')) as {
        nodeExecutions: { status: string }[];
      };
      expect(result.nodeExecutions[0].status).toBe('waiting_for_input');
    });

    it('terminal(completed) 노드의 stale outputData.status 는 정규화하지 않음', async () => {
      const row = baseFake({ id: 'eW2', status: ExecutionStatus.RUNNING });
      // INFO#9: mockReturnValueOnce 로 통일.
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne-done',
          nodeId: 'carousel-node',
          status: 'completed', // 이미 버튼 클릭 후 종결
          outputData: { status: 'waiting_for_input' }, // 봉투에 잔존하는 stale 문자열
        },
      ]);
      executionNodeLogRepo.find.mockResolvedValue([
        { nodeId: 'carousel-node' },
      ]);

      const result = (await service.findById('eW2')) as {
        nodeExecutions: { status: string }[];
      };
      expect(result.nodeExecutions[0].status).toBe('completed');
    });

    // INFO#4: 복수 nodeExecutions 혼합 케이스 — completed 노드는 그대로, running+봉투 만 정규화.
    it('복수 nodeExecutions 혼합 — completed 노드는 그대로, intra-row inconsistent 만 waiting_for_input 으로 정규화', async () => {
      const row = baseFake({ id: 'eW4', status: ExecutionStatus.RUNNING });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne-trigger',
          nodeId: 'trigger-node',
          status: 'completed', // 이미 완료 — 정규화 대상 아님
          outputData: null,
        },
        {
          id: 'ne-carousel',
          nodeId: 'carousel-node',
          status: 'running', // ← intra-row inconsistent
          outputData: {
            config: { buttons: [{ id: 'b1', type: 'port', label: 'Next' }] },
            output: {},
            status: 'waiting_for_input',
            meta: { interactionType: 'buttons' },
          },
        },
      ]);
      executionNodeLogRepo.find.mockResolvedValue([
        { nodeId: 'trigger-node' },
        { nodeId: 'carousel-node' },
      ]);

      const result = (await service.findById('eW4')) as {
        nodeExecutions: { nodeId: string; status: string }[];
      };
      const triggerNe = result.nodeExecutions.find(
        (ne) => ne.nodeId === 'trigger-node',
      );
      const carouselNe = result.nodeExecutions.find(
        (ne) => ne.nodeId === 'carousel-node',
      );
      expect(triggerNe?.status).toBe('completed'); // 변경 없음
      expect(carouselNe?.status).toBe('waiting_for_input'); // 정규화 적용
    });
  });

  // C-1 (06-concurrency) — WAITING 실행 stop 은 cancelWaitingExecution 의 publish
  // 결과를 동기 surface 한다. queued=false (Redis 장애) 면 503 으로 재시도 유도.
  describe('stop — WAITING_FOR_INPUT cancel (C-1)', () => {
    it('queued=true 면 cancel 후 갱신된 execution 을 반환 (throw 없음)', async () => {
      const waiting = baseFake({
        id: 'eW-ok',
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      const afterCancel = baseFake({
        id: 'eW-ok',
        status: ExecutionStatus.RUNNING,
      });
      executionRepo.findOne
        .mockResolvedValueOnce(waiting as unknown) // 최초 lookup
        .mockResolvedValueOnce(afterCancel as unknown); // cancel 후 re-fetch
      // engine.cancelWaitingExecution 기본 mock = { queued: true } (beforeEach).

      const result = await service.stop('eW-ok');
      expect(engine.cancelWaitingExecution).toHaveBeenCalledWith('eW-ok');
      // 종전엔 `toBe(afterCancel)` 였다. `stop` 이 응답 마스킹 관문
      // (`toResponseExecution`)을 거치면서 **복사본**을 돌려주므로 참조 동일성은 더 이상
      // 성립하지 않는다. 이 단언의 원래 의도는 *"stale 한 최초 lookup 이 아니라 cancel 후
      // 재조회 결과를 돌려준다"* 였으므로 그 의도를 내용 비교로 그대로 유지한다 —
      // 약화가 아니라 등가 교체다(아래 `not.toMatchObject` 가 stale 쪽을 배제한다).
      expect(result).toMatchObject({
        id: 'eW-ok',
        status: ExecutionStatus.RUNNING,
      });
      expect(result).not.toMatchObject({
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
    });

    it('queued=false 면 503 EXECUTION_ENQUEUE_FAILED throw (publish 실패 surface)', async () => {
      const waiting = baseFake({
        id: 'eW-503',
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      executionRepo.findOne.mockResolvedValueOnce(waiting as unknown);
      engine.cancelWaitingExecution.mockResolvedValueOnce({
        queued: false,
        jobId: null,
      });

      const err = await service.stop('eW-503').catch((err_: unknown) => err_);
      expect(err).toBeInstanceOf(ServiceUnavailableException);
      expect((err as ServiceUnavailableException).getStatus()).toBe(503);
      expect((err as ServiceUnavailableException).getResponse()).toMatchObject({
        code: 'EXECUTION_ENQUEUE_FAILED',
      });
      expect(engine.cancelWaitingExecution).toHaveBeenCalledWith('eW-503');
    });
  });

  // `duration_ms` 는 INTEGER(int4, ≈24.8일). 종전엔 무가드 뺄셈이라 그 상한을 넘으면
  // UPDATE 가 `integer out of range` 로 실패하고 **stop 이 먹지 않았다** — 종결 이벤트
  // 경로에서 CRITICAL 로 두 번 잡힌 것과 같은 연산이 이 자매 경로에 남아 있었다.
  describe('stop — duration int4 클램프', () => {
    it('24.8일을 넘긴 RUNNING 실행을 stop 해도 int4 상한으로 saturate 한다', async () => {
      const ancient = baseFake({
        id: 'e-old',
        status: ExecutionStatus.RUNNING,
        startedAt: new Date(Date.now() - (PG_INT4_MAX + 86_400_000)),
        finishedAt: null,
        durationMs: null,
      });
      executionRepo.findOne
        .mockResolvedValueOnce(ancient as unknown)
        .mockResolvedValueOnce(ancient as unknown);

      const set = jest.fn();
      const qb: Record<string, jest.Mock> = { set };
      qb.update = jest.fn().mockReturnValue(qb);
      set.mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
      executionRepo.createQueryBuilder.mockReturnValue(qb);

      await service.stop('e-old');

      const written = set.mock.calls[0][0] as { durationMs: number };
      expect(written.durationMs).toBe(PG_INT4_MAX);
    });
  });

  describe('getStatusById', () => {
    it('정상 조회 → status 반환 (id 로 조회)', async () => {
      executionRepo.findOne.mockResolvedValueOnce({
        id: 'e1',
        status: ExecutionStatus.RUNNING,
      } as unknown);
      await expect(service.getStatusById('e1')).resolves.toBe(
        ExecutionStatus.RUNNING,
      );
      expect(executionRepo.findOne).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'e1' } }),
      );
    });

    it('미존재 → null', async () => {
      executionRepo.findOne.mockResolvedValueOnce(null);
      await expect(service.getStatusById('nope')).resolves.toBeNull();
    });

    it('DB 예외 → null 로 흡수(throw 안 함) + logger.warn 로 가시화', async () => {
      const warn = jest
        .spyOn(Logger.prototype, 'warn')
        .mockImplementation(() => undefined);
      executionRepo.findOne.mockRejectedValueOnce(new Error('db down'));
      await expect(service.getStatusById('e2')).resolves.toBeNull();
      // silent 누락 방지 — 실패가 warn 으로 남아야 한다(executionId 포함).
      expect(warn).toHaveBeenCalledWith(expect.stringContaining('e2'));
      warn.mockRestore();
    });
  });

  /**
   * `Execution.error` 의 응답 egress 마스킹 (I1 결정 2026-08-16).
   *
   * ## 표면마다 **따로** 단언하는 이유
   *
   * 한 헬퍼를 부르니 한 번만 검증하면 된다고 생각하기 쉽다. 그러면 **한 표면에서
   * 호출을 지워도 스위트가 초록**이다 — 이 저장소가 *"자매 중 하나만"* 으로 반복해
   * 겪은 형태고, 이 결함을 등재한 트래커조차 **한 줄만** 지목했다.
   * 그래서 독립 표면과 재사용 경로를 각각 겨눈다.
   *
   * > 표면 목록·개수는 `ExecutionsService.toResponseExecution` 의 표가 정본이다 —
   * > 여기에 숫자를 다시 적지 않는다(적으면 표면이 늘 때 이 주석만 낡는다).
   */
  describe('Execution.error 응답 마스킹 — 표면 전수', () => {
    const LEAKY = {
      code: 'HTTP_ERROR',
      message: 'auth failed: Bearer sk-live-abc123def456',
    };
    const MASKED = { code: 'HTTP_ERROR', message: 'auth failed: ***' };

    it('① findById — 상세 조회 (GET /executions/:id · WS execution.snapshot 공용)', async () => {
      const row = baseFake({ id: 'eM1', error: { ...LEAKY } });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);

      const result = (await service.findById('eM1')) as unknown as {
        error: Record<string, unknown>;
      };
      expect(result.error).toEqual(MASKED);
    });

    it('①-b findById 의 마스킹은 **캐시 안쪽**이다 — 두 번째 조회(캐시 히트)도 마스킹', async () => {
      // 캐시 우회 경로가 원문을 돌려주는 것이 이 저장소의 반복 형태다("캐시 우회 4곳 중 1곳").
      // COMPLETED 는 writeSnapshotCache 대상이므로 2회차는 DB 를 타지 않는다.
      const row = baseFake({
        id: 'eM1c',
        status: ExecutionStatus.COMPLETED,
        error: { ...LEAKY },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);

      await service.findById('eM1c');
      const cached = (await service.findById('eM1c')) as unknown as {
        error: Record<string, unknown>;
      };
      // 2회차가 DB 를 타지 않았음을 확인 — 안 그러면 이 단언은 캐시를 검증하지 않는다.
      expect(executionRepo.createQueryBuilder).toHaveBeenCalledTimes(1);
      expect(cached.error).toEqual(MASKED);
    });

    it('② findByWorkflow — 목록 (toExecutionDto)', async () => {
      const row = baseFake({ id: 'eM2', error: { ...LEAKY } });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const result = await service.findByWorkflow('w1', {});
      expect(result.data[0].error).toEqual(MASKED);
    });

    it('③ getChain — chain 조회', async () => {
      const root = baseFake({ id: 'eM3', error: { ...LEAKY } });
      const chainQB: Record<string, jest.Mock> = {};
      chainQB.leftJoinAndSelect = jest.fn().mockReturnValue(chainQB);
      chainQB.where = jest.fn().mockReturnValue(chainQB);
      chainQB.orderBy = jest.fn().mockReturnValue(chainQB);
      chainQB.getOne = jest.fn().mockResolvedValue({
        ...root,
        workflow: { workspaceId: 'ws1' },
      });
      chainQB.getMany = jest.fn().mockResolvedValue([root]);
      executionRepo.createQueryBuilder.mockReturnValue(chainQB as unknown);

      const rows = await service.getChain('eM3', 'ws1', {
        sub: 'u1',
      } as never);
      expect(rows[0].error).toEqual(MASKED);
    });

    it('④ stop — 취소 응답', async () => {
      const running = baseFake({
        id: 'eM4',
        status: ExecutionStatus.RUNNING,
        error: null,
      });
      const cancelled = baseFake({
        id: 'eM4',
        status: ExecutionStatus.CANCELLED,
        error: { ...LEAKY },
      });
      executionRepo.findOne
        .mockResolvedValueOnce(running as unknown)
        .mockResolvedValueOnce(cancelled as unknown);

      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
      executionRepo.createQueryBuilder.mockReturnValue(qb as unknown);

      const result = await service.stop('eM4');
      expect(result.error).toEqual(MASKED);
    });

    it('④-b stop 의 `affected=0` 분기도 같은 관문을 지난다 (`return` 문이 셋이다)', async () => {
      const running = baseFake({
        id: 'eM4b',
        status: ExecutionStatus.RUNNING,
        error: null,
      });
      const raced = baseFake({
        id: 'eM4b',
        status: ExecutionStatus.CANCELLED,
        error: { ...LEAKY },
      });
      executionRepo.findOne
        .mockResolvedValueOnce(running as unknown)
        .mockResolvedValueOnce(raced as unknown);

      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      // 다른 요청이 먼저 상태를 바꾼 경우 — 별도 return 지점.
      qb.execute = jest.fn().mockResolvedValue({ affected: 0 });
      executionRepo.createQueryBuilder.mockReturnValue(qb as unknown);

      const result = await service.stop('eM4b');
      expect(result.error).toEqual(MASKED);
    });

    it('DB 원문은 건드리지 않는다 — egress-only (§R17)', async () => {
      // 입력 엔티티가 변이되면 같은 객체를 참조하는 DB write 경로가 마스킹된 값을 쓴다.
      const original = { ...LEAKY };
      const row = baseFake({ id: 'eM5', error: original });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);

      await service.findById('eM5');
      expect(original).toEqual(LEAKY);
      expect(row.error).toEqual(LEAKY);
    });

    /**
     * **형제 필드 우회** — 이 결함이 `--spec`(`16_32_42`) 에서 CRITICAL 로 잡혔다.
     *
     * `spec/1-data-model.md` §2.14 는 `Execution.error` 를 *"최초 failed NodeExecution 의
     * 에러 정보를 **복사**"* 로 정의한다. 즉 최상위 `error` 를 마스킹해도 **같은 문자열**이
     * `nodeExecutions[].error` 에 원문으로 남아 **같은 응답**으로 나간다 — 마스킹이
     * 겨냥하는 바로 그 케이스(실행 실패)에서 방어가 통째로 우회된다.
     */
    it('⑤ findById — nodeExecutions[].error 도 마스킹 (형제 필드 우회 차단)', async () => {
      const row = baseFake({ id: 'eM7', error: { ...LEAKY } });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      // §2.14 의 "복사" 관계 그대로 — 최상위와 **같은 값**이 노드 쪽에도 있다.
      nodeExecutionRepo.find.mockResolvedValue([
        { id: 'ne1', executionId: 'eM7', error: { ...LEAKY } },
      ]);

      const result = (await service.findById('eM7')) as unknown as {
        error: Record<string, unknown>;
        nodeExecutions: Array<{ error: Record<string, unknown> }>;
      };
      expect(result.error).toEqual(MASKED);
      // 최상위만 가리고 여기가 원문이면 방어가 아니라 방어처럼 보이는 것이다.
      expect(result.nodeExecutions[0].error).toEqual(MASKED);
    });

    it('⑤-b nodeExecutions 의 다른 필드는 보존한다 (마스킹이 행을 갈아끼우지 않는다)', async () => {
      const row = baseFake({ id: 'eM8' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne9',
          executionId: 'eM8',
          nodeId: 'n9',
          status: 'completed',
          error: null,
          outputData: { ok: true },
        },
      ]);

      const result = (await service.findById('eM8')) as unknown as {
        nodeExecutions: Array<Record<string, unknown>>;
      };
      expect(result.nodeExecutions[0]).toMatchObject({
        id: 'ne9',
        nodeId: 'n9',
        status: 'completed',
        outputData: { ok: true },
        error: null,
      });
    });

    /**
     * **copy-on-change 를 참조 동일성으로 고정한다** (`17_35_49` testing W1).
     *
     * 위 `⑤-b` 는 **값**만 비교하므로, 삼항을 지우고 다시 무조건 spread 로 되돌려도
     * 필드 값이 같아 **GREEN 이다** — 즉 최적화가 실제로 적용되는지 아무도 안 보고 있었다.
     * 그 최적화 자체가 직전 라운드(`17_12_34` performance W1)의 조치라 회귀 위험이 크다.
     * 참조가 같은지를 물어야 그 회귀가 RED 로 잡힌다.
     */
    it('⑤-c `error` 가 없는 행은 **원본 참조 그대로** 돌려준다 (무조건 spread 회귀 차단)', async () => {
      const row = baseFake({ id: 'eM8c' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      const clean = {
        id: 'ne-clean',
        executionId: 'eM8c',
        status: 'completed',
        error: null,
      };
      const failed = {
        id: 'ne-failed',
        executionId: 'eM8c',
        status: 'failed',
        error: { ...LEAKY },
      };
      nodeExecutionRepo.find.mockResolvedValue([clean, failed]);

      const result = (await service.findById('eM8c')) as unknown as {
        nodeExecutions: unknown[];
      };
      // `error` 없는 행 → 복제하지 않는다(참조 동일).
      expect(result.nodeExecutions[0]).toBe(clean);
      // `error` 있는 행 → 복제한다(원본 불변 + 마스킹된 새 객체).
      expect(result.nodeExecutions[1]).not.toBe(failed);
      expect(failed.error).toEqual(LEAKY);
      expect((result.nodeExecutions[1] as { error: unknown }).error).toEqual(
        MASKED,
      );
    });

    it('error 가 null 이면 null 그대로 (형태 변경 없음)', async () => {
      const row = baseFake({ id: 'eM6', error: null });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const result = await service.findByWorkflow('w1', {});
      expect(result.data[0].error).toBeNull();
    });
  });

  /**
   * `outputData` 응답 egress 마스킹 (§R17 잔여 ② 부분 해소 — 결정 2026-08-16).
   *
   * ## `inputData` 는 **의도적으로 대상이 아니다**
   *
   * 초안은 두 컬럼을 함께 마스킹했다가 **되돌렸다.** `inputData` 는 표시 전용이 아니라
   * Re-run 모달·에디터 "히스토리에서 불러오기" 가 읽어 **그대로 재제출**하는 값이라,
   * 마스킹하면 리터럴 `'***'` 가 새 실행의 실제 입력이 됐다(조용한 기능 오염).
   * 두 게이트가 독립으로 CRITICAL 을 냈고 소스 추적으로 확증했다.
   *
   * > **2026-08-20 — 카브아웃이 닫혔다.** 그 되돌림은 *"프런트가 마커를 감지해 재입력을
   * > 강제하는 가드"* 를 닫는 조건으로 달고 있었고(EIA §R17), 세 소비처가 전부 갖췄다 —
   * > 폼 프리필(#1181) · Re-run 모달(프리필 스킵 + 비어 있는 동안 제출 차단) · 에디터
   * > 히스토리 로드(마커 잔존 시 Run 차단). 그래서 **두 레벨이 같은 규칙**이 됐다.
   *
   * 이 describe 는 표면 전수를 고정한다 — 소스 정본은
   * `ExecutionsService.toResponseExecution` 의 마스킹 표.
   *
   * ## 왜 `error` 자매 describe 와 따로 두나
   *
   * `outputData` 에는 **앞선 마스킹 층**이 있다 — webhook ingestion 이 민감 헤더를
   * `[REDACTED]` 로 마스킹해 저장하고(12-webhook §5.3), 그건 4개 문서가 전제를 공유하는
   * 문서화된 계약이다. 그래서 여기엔 `error` 에 없는 단언이 하나 더 붙는다 — **마커 보존**.
   */
  describe('outputData + inputData 마스킹 — 표면 전수 (2026-08-20 부터 두 레벨 모두)', () => {
    const LEAKY_IN = {
      note: 'connect via postgres://admin:pw@db.internal/prod',
    };
    // `Bearer …` 를 쓴다. 초안은 `token=sk-live-abc123` 이었는데 **통과했다** —
    // `SECRET_LEAK_PATTERNS` 의 키워드 목록은 `access_token`/`refresh_token`/`id_token`/
    // `api_key` 는 담지만 **bare `token=` 은 없다**. 이 PR 이 만든 결함이 아니라 선존
    // 패턴 커버리지 갭이라(패턴 확장은 캐너리가 막는 별건) 트래커에 등재하고, 여기서는
    // 마스커가 실제로 잡는 값으로 "이 표면이 값-마스커를 지나는가" 만 겨눈다.
    const LEAKY_OUT = { body: 'upstream said Bearer sk-live-abc123' };

    it('① findById — 상세 조회', async () => {
      const row = baseFake({
        id: 'eD1',
        inputData: { ...LEAKY_IN },
        outputData: { ...LEAKY_OUT },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([]);

      const result = (await service.findById('eD1')) as unknown as {
        inputData: { note: string };
        outputData: { body: string };
      };
      expect(result.outputData.body).not.toContain('sk-live-abc123');
      expect(result.outputData.body).toContain('***');
      // `inputData` 도 마스킹된다 (2026-08-20 카브아웃 폐지 — 위 describe 주석 참조).
      expect(result.inputData.note).not.toContain('admin:pw');
      expect(result.inputData.note).toContain('***');
    });

    it('② findByWorkflow — 목록 (toExecutionDto)', async () => {
      const row = baseFake({
        id: 'eD2',
        inputData: { ...LEAKY_IN },
        outputData: { ...LEAKY_OUT },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const result = await service.findByWorkflow('w1', {});
      expect(JSON.stringify(result.data[0].outputData)).not.toContain(
        'sk-live-abc123',
      );
      expect(JSON.stringify(result.data[0].inputData)).not.toContain(
        'admin:pw',
      );
    });

    it('③ getChain — chain 조회', async () => {
      const root = baseFake({ id: 'eD3', outputData: { ...LEAKY_OUT } });
      const chainQB: Record<string, jest.Mock> = {};
      chainQB.leftJoinAndSelect = jest.fn().mockReturnValue(chainQB);
      chainQB.where = jest.fn().mockReturnValue(chainQB);
      chainQB.orderBy = jest.fn().mockReturnValue(chainQB);
      chainQB.getOne = jest
        .fn()
        .mockResolvedValue({ ...root, workflow: { workspaceId: 'ws1' } });
      chainQB.getMany = jest.fn().mockResolvedValue([root]);
      executionRepo.createQueryBuilder.mockReturnValue(chainQB as unknown);

      const rows = await service.getChain('eD3', 'ws1', { sub: 'u1' } as never);
      expect(JSON.stringify(rows[0].outputData)).not.toContain(
        'sk-live-abc123',
      );
    });

    it('④ stop — 취소 응답', async () => {
      const running = baseFake({
        id: 'eD4',
        status: ExecutionStatus.RUNNING,
        error: null,
      });
      const cancelled = baseFake({
        id: 'eD4',
        status: ExecutionStatus.CANCELLED,
        error: null,
        outputData: { ...LEAKY_OUT },
      });
      executionRepo.findOne
        .mockResolvedValueOnce(running as unknown)
        .mockResolvedValueOnce(cancelled as unknown);

      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
      executionRepo.createQueryBuilder.mockReturnValue(qb as unknown);

      const result = await service.stop('eD4');
      expect(JSON.stringify(result.outputData)).not.toContain('sk-live-abc123');
    });

    it('⑤ findById — nodeExecutions[].outputData 도 마스킹 (형제 필드 우회 차단)', async () => {
      const row = baseFake({ id: 'eD5' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      nodeExecutionRepo.find.mockResolvedValue([
        {
          id: 'ne1',
          executionId: 'eD5',
          error: null,
          inputData: { ...LEAKY_IN },
          outputData: { ...LEAKY_OUT },
        },
      ]);

      const result = (await service.findById('eD5')) as unknown as {
        nodeExecutions: Array<Record<string, unknown>>;
      };
      const ne = JSON.stringify(result.nodeExecutions[0]);
      expect(ne).not.toContain('sk-live-abc123');
      // **노드 레벨은 `inputData` 도 마스킹**한다 — 카브아웃은 Execution 레벨 한정이다.
      // 여기가 원문이면 WS emit(마스킹)과 REST 가 같은 store 슬롯에서 flip-flop 한다.
      expect(ne).not.toContain('admin:pw');
    });

    /**
     * **webhook ingestion 마커 보존** — 12-webhook §5.3 이 규정한 계약.
     *
     * 값-마스커가 이 마커를 `***` 로 덮으면 같은 헤더가 읽는 경로마다 다르게 보인다
     * (`$trigger.headers` 는 `[REDACTED]`, 실행 상세 API 는 `***`). 이 저장소가 마스킹
     * 연쇄 작업으로 없애 온 바로 그 병이라, 여기가 RED 면 계약이 깨졌다는 뜻이다.
     */
    it('⑥ ingestion 의 `[REDACTED]` 헤더 마커를 덮지 않는다 (12-webhook §5.3 계약)', async () => {
      // **`outputData` 로 겨눈다** — `inputData` 는 마스커를 아예 안 지나므로 거기서
      // 단언하면 "마커 보존" 이 아니라 "아무것도 안 함" 을 검증하는 vacuous 테스트가 된다.
      // 트리거 노드의 `output.request.headers` 가 ingestion 마커를 그대로 싣는 실제 형태다.
      const row = baseFake({
        id: 'eD6',
        outputData: {
          request: {
            headers: {
              authorization: '[REDACTED]',
              'content-type': 'application/json',
            },
          },
        },
      });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const result = await service.findByWorkflow('w1', {});
      const headers = (
        result.data[0].outputData as {
          request: { headers: Record<string, string> };
        }
      ).request.headers;
      expect(headers.authorization).toBe('[REDACTED]');
      expect(headers['content-type']).toBe('application/json');
    });

    /**
     * **copy-on-change 를 필드별로 가른다** (`23_08_19` testing W5).
     *
     * 판정이 `error` 단일 필드에서 두 필드 AND 비교로 넓어졌다. 값만 비교하는 테스트는
     * `outputData === ne.outputData` 항이 빠져도 GREEN 이다 — 참조 동일성으로 물어야
     * 그 뮤턴트가 RED 가 된다.
     *
     * **노드 레벨은 세 컬럼 전부 대상**이다 — 카브아웃은 `Execution` 레벨 한정이라
     * `inputData` 만 leaky 한 행도 복제되어야 한다. 이 방향을 고정해야 "노드 레벨까지
     * 카브아웃" 회귀(WS↔REST flip-flop)가 RED 로 잡힌다.
     */
    it('⑥-b copy-on-change — 노드 레벨은 세 컬럼 전부가 복제를 유발한다', async () => {
      const row = baseFake({ id: 'eD6b' });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildSingleQB(row) as unknown,
      );
      const clean = {
        id: 'ne-clean',
        executionId: 'eD6b',
        error: null,
        inputData: { orderId: 'A-1' },
        outputData: { ok: true },
      };
      const inputLeaky = {
        id: 'ne-in',
        executionId: 'eD6b',
        error: null,
        inputData: { note: 'Bearer sk-live-IN' },
        outputData: { ok: true },
      };
      const outputLeaky = {
        id: 'ne-out',
        executionId: 'eD6b',
        error: null,
        inputData: { orderId: 'A-2' },
        outputData: { note: 'Bearer sk-live-OUT' },
      };
      nodeExecutionRepo.find.mockResolvedValue([
        clean,
        inputLeaky,
        outputLeaky,
      ]);

      const result = (await service.findById('eD6b')) as unknown as {
        nodeExecutions: unknown[];
      };
      // 세 컬럼이 전부 무변화 → 복제하지 않는다.
      expect(result.nodeExecutions[0]).toBe(clean);
      // **`inputData` 만 leaky 해도 복제된다** — 노드 레벨은 그 컬럼도 마스킹 대상이다.
      // 여기가 RED 면 카브아웃이 노드 레벨까지 번졌다는 뜻이다(flip-flop 회귀 캐너리).
      expect(result.nodeExecutions[1]).not.toBe(inputLeaky);
      expect(
        JSON.stringify(
          (result.nodeExecutions[1] as { inputData: unknown }).inputData,
        ),
      ).not.toContain('sk-live-IN');
      // `outputData` 가 바뀌면 복제된다 (그 비교 항이 살아있다는 증거).
      expect(result.nodeExecutions[2]).not.toBe(outputLeaky);
      expect(
        JSON.stringify(
          (result.nodeExecutions[2] as { outputData: unknown }).outputData,
        ),
      ).not.toContain('sk-live-OUT');
      // 원본 엔티티는 불변 (egress-only).
      expect(outputLeaky.outputData.note).toBe('Bearer sk-live-OUT');
    });

    it('⑦ 정상 데이터는 손상되지 않는다 + DB 원문 불변 (egress-only)', async () => {
      const original = { orderId: 'A-1', qty: 3 };
      const row = baseFake({ id: 'eD7', outputData: original });
      executionRepo.createQueryBuilder.mockReturnValueOnce(
        buildListQB([row]) as unknown,
      );

      const result = await service.findByWorkflow('w1', {});
      expect(result.data[0].outputData).toEqual({ orderId: 'A-1', qty: 3 });
      expect(original).toEqual({ orderId: 'A-1', qty: 3 });
    });

    /**
     * **`inputData` 캐너리는 2026-08-20 부터 한 방향이다** — 두 레벨이 같은 규칙이 됐다.
     *
     * | 표면 | 고정하는 것 | 캐너리 |
     * |---|---|---|
     * | `Execution.inputData` | **마스킹** (카브아웃 폐지) | `①`(`findById`) · `②`(`findByWorkflow`) · `⑧`(`getChain`) · `⑧-b`(`stop`) |
     * | 노드 레벨 `inputData` | **마스킹** | `⑤` · `⑥-b` + `background-runs.service.spec.ts` |
     *
     * > **종전엔 방향이 갈렸다** — Execution 레벨은 *"원문"* 을 고정했다(관문이 붙으면
     * > Re-run 재제출이 `'***'` 로 오염되기 때문). 프런트 마커 가드가 그 오염 경로를
     * > 막으면서 반전했다. 노드 레벨 캐너리는 **그대로 둔다** — 그쪽이 고정하는 회귀
     * > (카브아웃이 노드 레벨까지 번져 WS↔REST flip-flop)는 여전히 유효하다.
     *
     * > 이 주석은 두 번 틀렸다: 초판은 *"네 표면"* 이라 적고 다섯을 나열했고
     * > (`00_23_57` documentation W1), 그 정정판은 `⑥-b`·background-runs 를 "비대상 고정"
     * > 으로 **오분류**했다(`10_26_58` W5) — 그 둘은 정반대를 고정한다. 개수·목록 대신
     * > **방향별로** 적는 이유다.
     */
    it('⑧ getChain 도 `inputData` 를 마스킹한다', async () => {
      const root = baseFake({ id: 'eD8', inputData: { ...LEAKY_IN } });
      const chainQB: Record<string, jest.Mock> = {};
      chainQB.leftJoinAndSelect = jest.fn().mockReturnValue(chainQB);
      chainQB.where = jest.fn().mockReturnValue(chainQB);
      chainQB.orderBy = jest.fn().mockReturnValue(chainQB);
      chainQB.getOne = jest
        .fn()
        .mockResolvedValue({ ...root, workflow: { workspaceId: 'ws1' } });
      chainQB.getMany = jest.fn().mockResolvedValue([root]);
      executionRepo.createQueryBuilder.mockReturnValue(chainQB as unknown);

      const rows = await service.getChain('eD8', 'ws1', { sub: 'u1' } as never);
      expect(JSON.stringify(rows[0].inputData)).not.toContain('admin:pw');
    });

    it('⑧-b stop 도 `inputData` 를 마스킹한다', async () => {
      const running = baseFake({
        id: 'eD8b',
        status: ExecutionStatus.RUNNING,
        error: null,
      });
      const cancelled = baseFake({
        id: 'eD8b',
        status: ExecutionStatus.CANCELLED,
        error: null,
        inputData: { ...LEAKY_IN },
      });
      executionRepo.findOne
        .mockResolvedValueOnce(running as unknown)
        .mockResolvedValueOnce(cancelled as unknown);

      const qb: Record<string, jest.Mock> = {};
      qb.update = jest.fn().mockReturnValue(qb);
      qb.set = jest.fn().mockReturnValue(qb);
      qb.where = jest.fn().mockReturnValue(qb);
      qb.andWhere = jest.fn().mockReturnValue(qb);
      qb.execute = jest.fn().mockResolvedValue({ affected: 1 });
      executionRepo.createQueryBuilder.mockReturnValue(qb as unknown);

      const result = await service.stop('eD8b');
      expect(JSON.stringify(result.inputData)).not.toContain('admin:pw');
    });
  });
});
