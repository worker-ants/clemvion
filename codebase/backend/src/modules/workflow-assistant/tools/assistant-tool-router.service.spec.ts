import {
  AssistantToolRouter,
  ExploreDispatchContext,
  SchemaCacheEntry,
} from './assistant-tool-router.service';
import { ShadowSnapshot, ShadowWorkflow } from './shadow-workflow';

/**
 * M-3 1단계 추출 단위 테스트. `AssistantToolRouter` 는 `streamMessage` 의
 * explore dispatch + kind 분류를 분리한 무상태 collaborator 다. 도구 행위
 * 계약(SSE 순서·§10 가드)은 통합 테스트(`workflow-assistant-stream.service.spec.ts`)
 * 가 그대로 커버하고, 여기서는 라우팅/캐시/위임 로직만 격리 검증한다.
 */

function makeShadow(snapshot: ShadowSnapshot): ShadowWorkflow {
  return { snapshot: () => snapshot } as unknown as ShadowWorkflow;
}

function makeExploreTools() {
  return {
    getNodeSchema: jest.fn(),
    listIntegrations: jest.fn(),
    listWorkflows: jest.fn(),
    getWorkflow: jest.fn(),
    listKnowledgeBases: jest.fn(),
    getWorkflowExecutions: jest.fn(),
    getExecutionDetails: jest.fn(),
  };
}

function makeCtx(
  shadow: ShadowWorkflow,
  overrides: Partial<ExploreDispatchContext> = {},
): ExploreDispatchContext {
  return {
    shadow,
    workspaceId: 'ws-1',
    currentWorkflowId: 'wf-1',
    schemaCache: new Map<string, SchemaCacheEntry>(),
    ...overrides,
  };
}

const EMPTY_SNAPSHOT: ShadowSnapshot = { nodes: [], edges: [] };

describe('AssistantToolRouter', () => {
  describe('classifyKind', () => {
    let router: AssistantToolRouter;
    beforeEach(() => {
      router = new AssistantToolRouter(makeExploreTools() as never);
    });

    it('classifies read-only tools as explore', () => {
      for (const name of [
        'get_node_schema',
        'list_integrations',
        'list_workflows',
        'get_workflow',
        'get_current_workflow',
        'list_knowledge_bases',
        'get_workflow_executions',
        'get_execution_details',
        'verify_workflow',
      ]) {
        expect(router.classifyKind(name)).toBe('explore');
      }
    });

    it('classifies plan / edit / finish tools', () => {
      expect(router.classifyKind('propose_plan')).toBe('plan');
      expect(router.classifyKind('clear_plan')).toBe('plan');
      expect(router.classifyKind('add_node')).toBe('edit');
      expect(router.classifyKind('add_edge')).toBe('edit');
      expect(router.classifyKind('remove_node')).toBe('edit');
      expect(router.classifyKind('finish')).toBe('finish');
    });

    it('falls back to edit for unregistered tools', () => {
      expect(router.classifyKind('totally_unknown_tool')).toBe('edit');
    });
  });

  describe('dispatchExplore', () => {
    let router: AssistantToolRouter;
    let exploreTools: ReturnType<typeof makeExploreTools>;

    beforeEach(() => {
      exploreTools = makeExploreTools();
      router = new AssistantToolRouter(exploreTools as never);
    });

    it('serves get_current_workflow from the shadow snapshot without touching ExploreToolsService', async () => {
      const snapshot: ShadowSnapshot = {
        nodes: [
          {
            id: 'n1',
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
        ],
        edges: [],
      };
      const { result, reviewCompleted } = await router.dispatchExplore(
        'get_current_workflow',
        {},
        makeCtx(makeShadow(snapshot)),
      );
      expect(reviewCompleted).toBe(false);
      const r = result as { ok: boolean; nodes: unknown[] };
      expect(r.ok).toBe(true);
      expect(r.nodes).toHaveLength(1);
      expect(exploreTools.getNodeSchema).not.toHaveBeenCalled();
    });

    it('verify_workflow returns ok and signals reviewCompleted when every node/edge is covered', async () => {
      const snapshot: ShadowSnapshot = {
        nodes: [
          {
            id: 'n1',
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
        ],
        edges: [
          {
            id: 'e1',
            sourceNodeId: 'n1',
            sourcePort: 'out',
            targetNodeId: 'n1',
            targetPort: 'in',
            type: 'data',
          },
        ],
      };
      const { result, reviewCompleted } = await router.dispatchExplore(
        'verify_workflow',
        { verifiedNodeIds: ['n1'], verifiedEdgeIds: ['e1'] },
        makeCtx(makeShadow(snapshot)),
      );
      expect(reviewCompleted).toBe(true);
      expect((result as { ok: boolean }).ok).toBe(true);
      expect(result).toMatchObject({
        verifiedNodeCount: 1,
        verifiedEdgeCount: 1,
      });
    });

    it('verify_workflow returns VERIFY_INCOMPLETE and does NOT signal reviewCompleted when ids are missing', async () => {
      const snapshot: ShadowSnapshot = {
        nodes: [
          {
            id: 'n1',
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            id: 'n2',
            type: 'http_request',
            category: 'action',
            label: 'Call',
            positionX: 1,
            positionY: 1,
            config: {},
          },
        ],
        edges: [],
      };
      const { result, reviewCompleted } = await router.dispatchExplore(
        'verify_workflow',
        { verifiedNodeIds: ['n1'], verifiedEdgeIds: [] },
        makeCtx(makeShadow(snapshot)),
      );
      expect(reviewCompleted).toBe(false);
      expect(result).toMatchObject({
        ok: false,
        error: 'VERIFY_INCOMPLETE',
        missingNodeIds: ['n2'],
      });
    });

    it('delegates generic explore tools to ExploreToolsService with workspace + workflow scope', async () => {
      exploreTools.listIntegrations.mockResolvedValue([{ id: 'i1' }]);
      const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
      const { result, reviewCompleted } = await router.dispatchExplore(
        'list_integrations',
        { category: 'crm' },
        ctx,
      );
      expect(reviewCompleted).toBe(false);
      expect(exploreTools.listIntegrations).toHaveBeenCalledWith('ws-1', 'crm');
      expect(result).toEqual([{ id: 'i1' }]);
    });

    it('passes excludeId = currentWorkflowId for list_workflows', async () => {
      exploreTools.listWorkflows.mockResolvedValue([]);
      await router.dispatchExplore(
        'list_workflows',
        { search: 'foo', limit: 5 },
        makeCtx(makeShadow(EMPTY_SNAPSHOT)),
      );
      expect(exploreTools.listWorkflows).toHaveBeenCalledWith('ws-1', {
        search: 'foo',
        limit: 5,
        excludeId: 'wf-1',
      });
    });

    describe('get_node_schema turn-scoped cache', () => {
      it('first call delegates and caches (hits=1)', async () => {
        exploreTools.getNodeSchema.mockResolvedValue({ ok: true, type: 'x' });
        const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
        const { result } = await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        expect(exploreTools.getNodeSchema).toHaveBeenCalledTimes(1);
        expect(result).toEqual({ ok: true, type: 'x' });
        expect(ctx.schemaCache.get('http_request')).toEqual({
          result: { ok: true, type: 'x' },
          hits: 1,
        });
      });

      it('second call returns cached result + warning without re-delegating (hits=2)', async () => {
        exploreTools.getNodeSchema.mockResolvedValue({ ok: true, type: 'x' });
        const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
        await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        const { result } = await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        expect(exploreTools.getNodeSchema).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
          ok: true,
          warning: 'REDUNDANT_SCHEMA_LOOKUP',
          cached: true,
        });
      });

      it('third call hard-stops with REDUNDANT_SCHEMA_LOOKUP error (hits=3)', async () => {
        exploreTools.getNodeSchema.mockResolvedValue({ ok: true, type: 'x' });
        const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
        await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        const { result } = await router.dispatchExplore(
          'get_node_schema',
          { type: 'http_request' },
          ctx,
        );
        expect(exploreTools.getNodeSchema).toHaveBeenCalledTimes(1);
        expect(result).toMatchObject({
          ok: false,
          error: 'REDUNDANT_SCHEMA_LOOKUP',
        });
      });

      it('bypasses the cache for non-string type args (no key, delegates every call)', async () => {
        exploreTools.getNodeSchema.mockResolvedValue({ ok: true });
        const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
        await router.dispatchExplore('get_node_schema', { type: 123 }, ctx);
        await router.dispatchExplore('get_node_schema', { type: 123 }, ctx);
        // typeArg === '' → no cache key → 매 호출 위임, 하드스톱 미적용.
        expect(exploreTools.getNodeSchema).toHaveBeenCalledTimes(2);
        expect(ctx.schemaCache.size).toBe(0);
      });
    });

    it('returns UNKNOWN_EXPLORE_TOOL for an unregistered explore tool name', async () => {
      const { result, reviewCompleted } = await router.dispatchExplore(
        'totally_unknown_explore',
        {},
        makeCtx(makeShadow(EMPTY_SNAPSHOT)),
      );
      expect(reviewCompleted).toBe(false);
      expect(result).toEqual({ ok: false, error: 'UNKNOWN_EXPLORE_TOOL' });
    });

    it('delegates get_workflow with mode=full when requested, summary otherwise', async () => {
      exploreTools.getWorkflow.mockResolvedValue({ ok: true });
      const ctx = makeCtx(makeShadow(EMPTY_SNAPSHOT));
      await router.dispatchExplore(
        'get_workflow',
        { id: 'w2', mode: 'full' },
        ctx,
      );
      expect(exploreTools.getWorkflow).toHaveBeenLastCalledWith(
        'ws-1',
        'w2',
        'full',
      );
      await router.dispatchExplore('get_workflow', { id: 'w3' }, ctx);
      expect(exploreTools.getWorkflow).toHaveBeenLastCalledWith(
        'ws-1',
        'w3',
        'summary',
      );
    });

    it('verify_workflow on an empty canvas passes (nothing to cover) and signals reviewCompleted', async () => {
      const { result, reviewCompleted } = await router.dispatchExplore(
        'verify_workflow',
        { verifiedNodeIds: [], verifiedEdgeIds: [] },
        makeCtx(makeShadow(EMPTY_SNAPSHOT)),
      );
      expect(reviewCompleted).toBe(true);
      expect(result).toMatchObject({
        ok: true,
        verifiedNodeCount: 0,
        verifiedEdgeCount: 0,
      });
    });
  });
});
