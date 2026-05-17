import { ExploreToolsService } from './explore-tools.service';

/**
 * spec: spec/3-workflow-editor/4-ai-assistant.md §4.1 · §4.1.1 의 read-only
 * 실행 조회 도구 2종을 검증한다. DB 레이어는 jest mock 으로 대체하고, 서비스가
 * 스펙의 응답 envelope · 스코프 정책 · 민감 필드 마스킹 · 에러 코드를 지키는지
 * 확인한다. 기존 탐색 도구 6종은 본 파일의 관심사가 아니며, end-to-end 경로는
 * workflow-assistant-stream.service.spec.ts 에서 별도로 검증한다.
 */

const WORKSPACE = 'ws-1';
const CURRENT_WF = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OTHER_WF = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const THIRD_WF = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

type Row = Record<string, unknown>;

interface QueryBuilder {
  select: jest.Mock;
  addSelect: jest.Mock;
  where: jest.Mock;
  andWhere: jest.Mock;
  orderBy: jest.Mock;
  groupBy: jest.Mock;
  addGroupBy: jest.Mock;
  limit: jest.Mock;
  getMany: jest.Mock;
  getRawMany: jest.Mock;
}

interface FakeRepo {
  findOne: jest.Mock;
  find: jest.Mock;
  createQueryBuilder: jest.Mock;
}

function makeRepo(): FakeRepo {
  return {
    findOne: jest.fn(),
    find: jest.fn(),
    createQueryBuilder: jest.fn(),
  };
}

function makeQueryBuilder(
  opts: { many?: Row[]; raw?: Row[] } = {},
): QueryBuilder {
  const qb: QueryBuilder = {
    select: jest.fn().mockReturnThis(),
    addSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    groupBy: jest.fn().mockReturnThis(),
    addGroupBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(opts.many ?? []),
    getRawMany: jest.fn().mockResolvedValue(opts.raw ?? []),
  };
  return qb;
}

function makeService(): {
  svc: ExploreToolsService;
  repos: {
    workflow: FakeRepo;
    node: FakeRepo;
    edge: FakeRepo;
    integration: FakeRepo;
    kb: FakeRepo;
    execution: FakeRepo;
    nodeExecution: FakeRepo;
  };
} {
  const repos = {
    workflow: makeRepo(),
    node: makeRepo(),
    edge: makeRepo(),
    integration: makeRepo(),
    kb: makeRepo(),
    execution: makeRepo(),
    nodeExecution: makeRepo(),
  };
  const svc = new ExploreToolsService(
    repos.workflow as never,
    repos.node as never,
    repos.edge as never,
    repos.integration as never,
    repos.kb as never,
    repos.execution as never,
    repos.nodeExecution as never,
    { listDefinitions: jest.fn(), getComponent: jest.fn() } as never,
  );
  return { svc, repos };
}

describe('ExploreToolsService — execution read tools', () => {
  describe('getWorkflowExecutions', () => {
    it('returns recent executions with node stats sourced from DB GROUP BY, scoped to workspace+workflow', async () => {
      const { svc, repos } = makeService();
      repos.workflow.findOne.mockResolvedValue({
        id: CURRENT_WF,
        workspaceId: WORKSPACE,
        name: 'Order Cancellation',
      });
      const listQb = makeQueryBuilder({
        many: [
          {
            id: 'ex-1',
            status: 'failed',
            startedAt: new Date('2026-04-24T10:00:00Z'),
            finishedAt: new Date('2026-04-24T10:00:03Z'),
            durationMs: 3200,
            triggerId: null,
          },
          {
            id: 'ex-2',
            status: 'completed',
            startedAt: new Date('2026-04-24T09:00:00Z'),
            finishedAt: new Date('2026-04-24T09:00:02Z'),
            durationMs: 2100,
            triggerId: null,
          },
        ],
      });
      const statsQb = makeQueryBuilder({
        raw: [
          { executionId: 'ex-1', status: 'completed', count: '1' },
          { executionId: 'ex-1', status: 'failed', count: '1' },
          { executionId: 'ex-2', status: 'completed', count: '2' },
        ],
      });
      // list 쿼리와 stats 쿼리는 각각 execution / nodeExecution 리포에서 호출.
      repos.execution.createQueryBuilder.mockReturnValue(listQb);
      repos.nodeExecution.createQueryBuilder.mockReturnValue(statsQb);

      const result = (await svc.getWorkflowExecutions(
        WORKSPACE,
        CURRENT_WF,
      )) as Row;

      expect(result.ok).toBe(true);
      expect(result.workflowName).toBe('Order Cancellation');
      expect(listQb.where).toHaveBeenCalledWith('e.workflow_id = :workflowId', {
        workflowId: CURRENT_WF,
      });
      expect(listQb.limit).toHaveBeenCalledWith(10);
      expect(statsQb.groupBy).toHaveBeenCalledWith('ne.execution_id');
      expect(statsQb.addGroupBy).toHaveBeenCalledWith('ne.status');
      const items = result.items as Row[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        id: 'ex-1',
        status: 'failed',
        nodeStats: { total: 2, completed: 1, failed: 1 },
      });
      expect(items[1].nodeStats).toEqual({
        total: 2,
        completed: 2,
        failed: 0,
      });
    });

    it('returns an empty items array (with nodeStats fallback) when no executions exist', async () => {
      const { svc, repos } = makeService();
      repos.workflow.findOne.mockResolvedValue({
        id: CURRENT_WF,
        workspaceId: WORKSPACE,
        name: 'Empty WF',
      });
      const listQb = makeQueryBuilder({ many: [] });
      const statsQb = makeQueryBuilder({ raw: [] });
      repos.execution.createQueryBuilder.mockReturnValue(listQb);
      repos.nodeExecution.createQueryBuilder.mockReturnValue(statsQb);

      const result = (await svc.getWorkflowExecutions(
        WORKSPACE,
        CURRENT_WF,
      )) as Row;

      expect(result.ok).toBe(true);
      expect(result.items).toEqual([]);
      // executionIds 가 비었을 때는 통계 쿼리 자체를 건너뛴다 — groupBy 미호출 확인.
      expect(statsQb.groupBy).not.toHaveBeenCalled();
    });

    it('rejects non-UUID workflowId with INVALID_ID before touching DB', async () => {
      const { svc, repos } = makeService();
      const result = (await svc.getWorkflowExecutions(
        WORKSPACE,
        'not-a-uuid',
      )) as Row;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_ID');
      expect(repos.workflow.findOne).not.toHaveBeenCalled();
    });

    it('returns WORKFLOW_NOT_FOUND if the workflow is outside the workspace', async () => {
      const { svc, repos } = makeService();
      repos.workflow.findOne.mockResolvedValue(null);
      const result = (await svc.getWorkflowExecutions(
        WORKSPACE,
        CURRENT_WF,
      )) as Row;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('WORKFLOW_NOT_FOUND');
      expect(repos.execution.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('clamps limit to [1, 50] and applies status filter only when recognized', async () => {
      const { svc, repos } = makeService();
      repos.workflow.findOne.mockResolvedValue({
        id: CURRENT_WF,
        workspaceId: WORKSPACE,
        name: 'wf',
      });
      const qb = makeQueryBuilder({ many: [] });
      const statsQb = makeQueryBuilder({ raw: [] });
      repos.execution.createQueryBuilder.mockReturnValue(qb);
      repos.nodeExecution.createQueryBuilder.mockReturnValue(statsQb);

      await svc.getWorkflowExecutions(WORKSPACE, CURRENT_WF, {
        limit: 999,
        status: 'failed',
      });
      expect(qb.limit).toHaveBeenLastCalledWith(50);
      expect(qb.andWhere).toHaveBeenCalledWith('e.status = :status', {
        status: 'failed',
      });

      qb.andWhere.mockClear();
      await svc.getWorkflowExecutions(WORKSPACE, CURRENT_WF, {
        limit: 0,
        status: 'bogus',
      });
      expect(qb.limit).toHaveBeenLastCalledWith(1);
      // unrecognized filter is silently dropped — no additional andWhere call.
      expect(qb.andWhere).not.toHaveBeenCalled();
    });
  });

  describe('getExecutionDetails', () => {
    const EX_ID = '11111111-1111-4111-8111-111111111111';
    const PARENT_EX = '33333333-3333-4333-8333-333333333333';

    function mockExecution(overrides: Row = {}): Row {
      return {
        id: EX_ID,
        workflowId: CURRENT_WF,
        status: 'failed',
        startedAt: new Date('2026-04-24T10:00:00Z'),
        finishedAt: new Date('2026-04-24T10:00:03Z'),
        durationMs: 3200,
        inputData: null,
        outputData: null,
        error: { message: 'Cannot read property output of null' },
        parentExecutionId: null,
        recursionDepth: 0,
        workflow: { id: CURRENT_WF, workspaceId: WORKSPACE, name: 'WF' },
        ...overrides,
      };
    }

    it('rejects non-UUID id with INVALID_ID', async () => {
      const { svc, repos } = makeService();
      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        'bogus',
      )) as Row;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('INVALID_ID');
      expect(repos.execution.findOne).not.toHaveBeenCalled();
    });

    it('returns EXECUTION_NOT_FOUND when id does not exist OR belongs to another workspace', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(null);
      let result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;
      expect(result.error).toBe('EXECUTION_NOT_FOUND');

      // Workspace mismatch should produce the same code (no leak).
      repos.execution.findOne.mockResolvedValueOnce(
        mockExecution({ workflow: { workspaceId: 'other-ws' } }),
      );
      result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;
      expect(result.error).toBe('EXECUTION_NOT_FOUND');
    });

    it('returns EXECUTION_NOT_IN_SCOPE when the execution has no parent link', async () => {
      const { svc } = makeService();
      const { repos } = makeService();
      const freshRepos = repos;
      const freshSvc = new ExploreToolsService(
        freshRepos.workflow as never,
        freshRepos.node as never,
        freshRepos.edge as never,
        freshRepos.integration as never,
        freshRepos.kb as never,
        freshRepos.execution as never,
        freshRepos.nodeExecution as never,
        { listDefinitions: jest.fn(), getComponent: jest.fn() } as never,
      );
      freshRepos.execution.findOne.mockResolvedValueOnce(
        mockExecution({ workflowId: OTHER_WF, parentExecutionId: null }),
      );
      const result = (await freshSvc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;
      expect(result.ok).toBe(false);
      expect(result.error).toBe('EXECUTION_NOT_IN_SCOPE');
      // 부모 조회는 호출되지 않아야 한다 (parentExecutionId === null 일 때 short-circuit).
      expect(freshRepos.execution.findOne).toHaveBeenCalledTimes(1);
      expect(svc).toBeDefined();
    });

    it('returns EXECUTION_NOT_IN_SCOPE when the parent execution belongs to a third workflow', async () => {
      // W2 review follow-up — 이전에는 parentExecutionId: null 경로만 검증했으나
      // "부모가 존재하지만 부모의 workflowId 가 현재 세션 WF 가 아닌" 보안 경계
      // 분기가 미검증이었다. 이 테스트가 그 누락된 경로를 덮는다.
      const { svc, repos } = makeService();
      repos.execution.findOne
        .mockResolvedValueOnce(
          mockExecution({
            workflowId: OTHER_WF,
            parentExecutionId: PARENT_EX,
          }),
        )
        .mockResolvedValueOnce({
          id: PARENT_EX,
          workflowId: THIRD_WF,
          workflow: { workspaceId: WORKSPACE },
        });

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(false);
      expect(result.error).toBe('EXECUTION_NOT_IN_SCOPE');
      expect(repos.execution.findOne).toHaveBeenCalledTimes(2);
    });

    it('returns EXECUTION_NOT_IN_SCOPE when the parent execution is in a different workspace', async () => {
      // 부모 chain 으로 cross-workspace 우회 시도 방어.
      const { svc, repos } = makeService();
      repos.execution.findOne
        .mockResolvedValueOnce(
          mockExecution({
            workflowId: OTHER_WF,
            parentExecutionId: PARENT_EX,
          }),
        )
        .mockResolvedValueOnce({
          id: PARENT_EX,
          workflowId: CURRENT_WF,
          workflow: { workspaceId: 'other-ws' },
        });

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(false);
      expect(result.error).toBe('EXECUTION_NOT_IN_SCOPE');
    });

    it('accepts direct-child sub-workflow execution when parent belongs to current workflow', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne
        .mockResolvedValueOnce(
          mockExecution({
            workflowId: OTHER_WF,
            parentExecutionId: PARENT_EX,
          }),
        )
        .mockResolvedValueOnce({
          id: PARENT_EX,
          workflowId: CURRENT_WF,
          workflow: { workspaceId: WORKSPACE },
        });
      repos.nodeExecution.find.mockResolvedValue([]);
      repos.execution.find.mockResolvedValue([]);
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(true);
      expect((result.execution as Row).parentExecutionId).toBe(PARENT_EX);
    });

    it('returns partial timeline for a running execution (finishedAt null, running node kept)', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(
        mockExecution({
          status: 'running',
          finishedAt: null,
          durationMs: null,
        }),
      );
      repos.nodeExecution.find.mockResolvedValueOnce([
        {
          id: 'ne-a',
          nodeId: 'n-a',
          status: 'completed',
          startedAt: new Date('2026-04-24T10:00:00Z'),
          finishedAt: new Date('2026-04-24T10:00:01Z'),
          durationMs: 900,
          inputData: {},
          outputData: { value: 1 },
          error: null,
          retryCount: 0,
          parentNodeExecutionId: null,
          node: { label: 'A', type: 'template' },
        },
        {
          id: 'ne-b',
          nodeId: 'n-b',
          status: 'running',
          startedAt: new Date('2026-04-24T10:00:02Z'),
          finishedAt: null,
          durationMs: null,
          inputData: {},
          outputData: null,
          error: null,
          retryCount: 0,
          parentNodeExecutionId: null,
          node: { label: 'B', type: 'http_request' },
        },
      ]);
      repos.execution.find.mockResolvedValue([]);
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(true);
      const execution = result.execution as Row;
      expect(execution.status).toBe('running');
      expect(execution.finishedAt).toBeNull();
      expect(execution.durationMs).toBeNull();
      const timeline = result.timeline as Row[];
      expect(timeline).toHaveLength(2);
      expect(timeline[1]).toMatchObject({
        status: 'running',
        durationMs: null,
      });
    });

    it('masks sensitive fields in inputData / outputData / error (recursive)', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(
        mockExecution({
          inputData: {
            apiKey: 'sk-abcd1234',
            headers: { Authorization: 'Bearer tok_xyz_0001' },
          },
          outputData: { nested: { token: 'shhhh_leaf_9999' } },
          error: null,
        }),
      );
      repos.nodeExecution.find.mockResolvedValueOnce([
        {
          id: 'ne-1',
          nodeId: 'n-1',
          status: 'failed',
          startedAt: new Date(),
          finishedAt: null,
          durationMs: null,
          inputData: { password: 'p@ss' },
          outputData: { clientSecret: 'abcdef012345' },
          error: { message: 'boom', context: { apiKey: 'inner_key_9876' } },
          retryCount: 0,
          parentNodeExecutionId: null,
          node: { label: 'X', type: 'http_request' },
        },
      ]);
      repos.execution.find.mockResolvedValue([]);
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      const exec = result.execution as Row;
      expect((exec.inputData as Row).apiKey).toBe('****1234');
      expect(((exec.inputData as Row).headers as Row).Authorization).toBe(
        '****0001',
      );
      expect(((exec.outputData as Row).nested as Row).token).toBe('****9999');
      const ne = (result.timeline as Row[])[0];
      expect((ne.inputData as Row).password).toBe('****');
      expect((ne.outputData as Row).clientSecret).toBe('****2345');
      expect(((ne.error as Row).context as Row).apiKey).toBe('****9876');
    });

    it('batches direct-child sub-workflow timelines into a single In() query and returns each child keyed by its own id', async () => {
      // I15 review follow-up — 이전에는 자식 1건만 검증했으나, 실제로는 다수
      // 자식 실행이 흔하고 (스위치 분기 per-case sub-workflow 등) 그때도 각
      // 자식의 timeline 이 올바르게 그룹핑되어야 한다.
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(mockExecution());
      // 본 실행 timeline (loadTimeline 의 첫 번째 find 호출)
      repos.nodeExecution.find.mockResolvedValueOnce([]);
      repos.execution.find.mockResolvedValueOnce([
        {
          id: 'child-a',
          workflowId: OTHER_WF,
          status: 'completed',
          startedAt: new Date('2026-04-24T10:00:00Z'),
          finishedAt: new Date('2026-04-24T10:00:01Z'),
          durationMs: 1000,
          inputData: null,
          outputData: null,
          error: null,
          parentExecutionId: EX_ID,
          recursionDepth: 1,
          workflow: { name: 'WF-A' },
        },
        {
          id: 'child-b',
          workflowId: OTHER_WF,
          status: 'failed',
          startedAt: new Date('2026-04-24T10:00:02Z'),
          finishedAt: new Date('2026-04-24T10:00:03Z'),
          durationMs: 1000,
          inputData: null,
          outputData: null,
          error: { message: 'fail' },
          parentExecutionId: EX_ID,
          recursionDepth: 1,
          workflow: { name: 'WF-B' },
        },
      ]);
      // loadTimelinesByExecutionIds 의 단일 배치 쿼리 (두 번째 nodeExecution.find)
      repos.nodeExecution.find.mockResolvedValueOnce([
        {
          id: 'ne-ax',
          executionId: 'child-a',
          nodeId: 'n-ax',
          status: 'completed',
          startedAt: new Date('2026-04-24T10:00:00Z'),
          finishedAt: new Date('2026-04-24T10:00:01Z'),
          durationMs: 1000,
          inputData: {},
          outputData: { ok: true },
          error: null,
          retryCount: 0,
          parentNodeExecutionId: null,
          node: { label: 'AX', type: 'template' },
        },
        {
          id: 'ne-bx',
          executionId: 'child-b',
          nodeId: 'n-bx',
          status: 'failed',
          startedAt: new Date('2026-04-24T10:00:02Z'),
          finishedAt: new Date('2026-04-24T10:00:03Z'),
          durationMs: 1000,
          inputData: {},
          outputData: null,
          error: { message: 'child boom' },
          retryCount: 0,
          parentNodeExecutionId: null,
          node: { label: 'BX', type: 'http_request' },
        },
      ]);
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(true);
      const subs = result.subExecutions as Row[];
      expect(subs).toHaveLength(2);
      expect((subs[0].execution as Row).workflowName as string).toBe('WF-A');
      expect((subs[0].timeline as Row[])[0].nodeLabel).toBe('AX');
      expect((subs[1].timeline as Row[])[0].nodeLabel).toBe('BX');
      // 자식 timeline 조회는 `find` 를 두 번(본 + 배치) 만 호출. 자식 수에 비례한
      // N+1 이 발생하지 않아야 한다.
      expect(repos.nodeExecution.find).toHaveBeenCalledTimes(2);
    });

    it('emits subExecutionsTruncatedDepth=1 when a direct child has deeper descendants', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(mockExecution());
      repos.nodeExecution.find.mockResolvedValueOnce([]); // 본 timeline
      repos.execution.find.mockResolvedValueOnce([
        {
          id: 'child-1',
          workflowId: OTHER_WF,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 100,
          inputData: null,
          outputData: null,
          error: null,
          parentExecutionId: EX_ID,
          recursionDepth: 1,
          workflow: { name: 'Sub WF' },
        },
      ]);
      repos.nodeExecution.find.mockResolvedValueOnce([]); // 자식 timeline 배치
      // 2-depth 자손 존재를 getMany 가 1건 반환으로 신호.
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [{ id: 'grandchild-1' }] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(true);
      expect(result.subExecutionsTruncatedDepth).toBe(1);
      const subs = result.subExecutions as Row[];
      expect(subs).toHaveLength(1);
      expect((subs[0].execution as Row).workflowName).toBe('Sub WF');
    });

    it('omits subExecutionsTruncatedDepth when children are leaves', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(mockExecution());
      repos.nodeExecution.find.mockResolvedValueOnce([]);
      repos.execution.find.mockResolvedValueOnce([
        {
          id: 'child-1',
          workflowId: OTHER_WF,
          status: 'completed',
          startedAt: new Date(),
          finishedAt: new Date(),
          durationMs: 10,
          inputData: null,
          outputData: null,
          error: null,
          parentExecutionId: EX_ID,
          recursionDepth: 1,
          workflow: { name: 'Leaf' },
        },
      ]);
      repos.nodeExecution.find.mockResolvedValueOnce([]);
      repos.execution.createQueryBuilder.mockReturnValue(
        makeQueryBuilder({ many: [] }),
      );

      const result = (await svc.getExecutionDetails(
        WORKSPACE,
        CURRENT_WF,
        EX_ID,
      )) as Row;

      expect(result.ok).toBe(true);
      expect(result.subExecutionsTruncatedDepth).toBeUndefined();
    });
  });
});
