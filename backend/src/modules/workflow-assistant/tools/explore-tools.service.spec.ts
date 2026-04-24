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

type Row = Record<string, unknown>;

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

function makeQueryBuilder(finalRows: Row[] = [], finalCount = 0) {
  const qb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(finalRows),
    getCount: jest.fn().mockResolvedValue(finalCount),
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
    it('returns recent executions with node stats, scoped by workspace + workflow', async () => {
      const { svc, repos } = makeService();
      repos.workflow.findOne.mockResolvedValue({
        id: CURRENT_WF,
        workspaceId: WORKSPACE,
        name: 'Order Cancellation',
      });
      const qb = makeQueryBuilder([
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
      ]);
      repos.execution.createQueryBuilder.mockReturnValue(qb);
      repos.nodeExecution.find.mockResolvedValue([
        { id: 'ne-1', executionId: 'ex-1', status: 'completed' },
        { id: 'ne-2', executionId: 'ex-1', status: 'failed' },
        { id: 'ne-3', executionId: 'ex-2', status: 'completed' },
        { id: 'ne-4', executionId: 'ex-2', status: 'completed' },
      ]);

      const result = (await svc.getWorkflowExecutions(
        WORKSPACE,
        CURRENT_WF,
      )) as Row;

      expect(result.ok).toBe(true);
      expect(result.workflowName).toBe('Order Cancellation');
      expect(qb.where).toHaveBeenCalledWith('e.workflow_id = :workflowId', {
        workflowId: CURRENT_WF,
      });
      expect(qb.limit).toHaveBeenCalledWith(10);
      const items = result.items as Row[];
      expect(items).toHaveLength(2);
      expect(items[0]).toMatchObject({
        id: 'ex-1',
        status: 'failed',
        nodeStats: { total: 2, completed: 1, failed: 1 },
      });
      expect(items[1].nodeStats).toEqual({ total: 2, completed: 2, failed: 0 });
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
      const qb = makeQueryBuilder([]);
      repos.execution.createQueryBuilder.mockReturnValue(qb);
      repos.nodeExecution.find.mockResolvedValue([]);

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
    const OTHER_EX = '22222222-2222-4222-8222-222222222222';
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

    it('returns EXECUTION_NOT_IN_SCOPE when id belongs to another workflow and has no parent link to current', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne
        .mockResolvedValueOnce(
          mockExecution({ workflowId: OTHER_WF, parentExecutionId: null }),
        )
        // 두 번째 findOne 은 parent lookup — 부모도 없는 케이스 보장
        .mockResolvedValueOnce(null);
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
        // 1) 조회 대상 실행: 다른 workflowId 지만 parentExecutionId 가 현재 WF 의 실행
        .mockResolvedValueOnce(
          mockExecution({
            workflowId: OTHER_WF,
            parentExecutionId: PARENT_EX,
          }),
        )
        // 2) 스코프 검사용 parent lookup — 현재 WF
        .mockResolvedValueOnce({
          id: PARENT_EX,
          workflowId: CURRENT_WF,
        });
      repos.nodeExecution.find.mockResolvedValue([]);
      repos.execution.find.mockResolvedValue([]); // no children

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
      repos.nodeExecution.find.mockResolvedValue([
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
      expect(timeline[1]).toMatchObject({ status: 'running', durationMs: null });
    });

    it('masks sensitive fields in inputData / outputData / error (recursive)', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(
        mockExecution({
          inputData: { apiKey: 'sk-abcd1234', headers: { Authorization: 'Bearer tok_xyz_0001' } },
          outputData: { nested: { token: 'shhhh_leaf_9999' } },
          error: null,
        }),
      );
      repos.nodeExecution.find.mockResolvedValue([
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

    it('emits subExecutionsTruncatedDepth=1 when a direct child has deeper descendants', async () => {
      const { svc, repos } = makeService();
      repos.execution.findOne.mockResolvedValueOnce(mockExecution());
      repos.nodeExecution.find.mockResolvedValue([]);
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
      // 자식 실행의 timeline 조회는 두 번째 nodeExecutionRepo.find 호출.
      repos.nodeExecution.find.mockResolvedValue([]);
      const deeperQb = makeQueryBuilder([], 1);
      repos.execution.createQueryBuilder.mockReturnValue(deeperQb);

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
      repos.nodeExecution.find.mockResolvedValue([]);
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
      const deeperQb = makeQueryBuilder([], 0);
      repos.execution.createQueryBuilder.mockReturnValue(deeperQb);

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
