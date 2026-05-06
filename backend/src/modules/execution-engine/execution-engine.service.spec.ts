import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import {
  ExecutionEngineService,
  buildAiMessageDebugFromResumeState,
  buildConversationMetaFromResumeState,
} from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { ForEachExecutor } from './containers/foreach-executor';
import { LoopExecutor } from './containers/loop-executor';
import { ParallelExecutor } from './containers/parallel-executor';
import { WebsocketService } from '../websocket/websocket.service';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { RagSearchService } from '../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { McpClientService } from '../mcp/mcp-client.service';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge, EdgeType } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { NodeHandler } from '../../nodes/core/node-handler.interface';
import { ForEachHandler } from '../../nodes/logic/foreach/foreach.handler';
import { LoopHandler } from '../../nodes/logic/loop/loop.handler';
import { MapHandler } from '../../nodes/logic/map/map.handler';
import { AI_NO_LLM_PROVIDER_MESSAGE } from '../../nodes/ai/llm-provider-rule';

// Helper to flush pending promises (allow background execution to complete)
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve));
}

describe('ExecutionEngineService', () => {
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: {
    emitExecutionEvent: jest.Mock;
    emitNodeEvent: jest.Mock;
  };
  let mockConfigService: { get: jest.Mock };

  // Mock data
  const workflowId = 'workflow-1';
  const executionId = 'execution-1';

  const mockWorkflow: Partial<Workflow> = {
    id: workflowId,
    name: 'Test Workflow',
    isActive: true,
  };

  const mockNodes: Partial<Node>[] = [
    {
      id: 'node-1',
      workflowId,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Node 1',
      config: {},
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    },
    {
      id: 'node-2',
      workflowId,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Node 2',
      config: {},
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    },
    {
      id: 'node-3',
      workflowId,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Node 3',
      config: {},
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    },
  ];

  const mockEdges: Partial<Edge>[] = [
    {
      id: 'edge-1',
      workflowId,
      sourceNodeId: 'node-1',
      sourcePort: 'out',
      targetNodeId: 'node-2',
      targetPort: 'in',
      type: EdgeType.DATA,
    },
    {
      id: 'edge-2',
      workflowId,
      sourceNodeId: 'node-2',
      sourcePort: 'out',
      targetNodeId: 'node-3',
      targetPort: 'in',
      type: EdgeType.DATA,
    },
  ];

  // Mock handler
  const mockHandler: NodeHandler = {
    validate: () => ({ valid: true, errors: [] }),
    execute: jest.fn(async (input: unknown) => ({
      processed: true,
      input,
    })),
  };

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    const savedExecution: Partial<Execution> = {
      id: executionId,
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: {},
      executionPath: [],
      startedAt: new Date(),
    };

    mockExecutionRepo = {
      create: jest.fn().mockReturnValue({ ...savedExecution }),
      save: jest.fn().mockImplementation((entity: Partial<Execution>) => {
        return Promise.resolve({ ...savedExecution, ...entity });
      }),
      findOneBy: jest
        .fn()
        .mockResolvedValue({ ...savedExecution, executionPath: [] }),
      find: jest.fn().mockResolvedValue([]),
    };

    mockNodeExecutionRepo = {
      create: jest.fn().mockImplementation((data: Partial<NodeExecution>) => ({
        id: `ne-${data.nodeId}`,
        ...data,
        startedAt: new Date(),
      })),
      save: jest
        .fn()
        .mockImplementation((entity: Partial<NodeExecution>) =>
          Promise.resolve(entity),
        ),
      findOne: jest
        .fn()
        .mockImplementation(({ where }: { where: { nodeId: string } }) => {
          return Promise.resolve({
            id: `ne-${where.nodeId}`,
            executionId,
            nodeId: where.nodeId,
            status: NodeExecutionStatus.RUNNING,
            startedAt: new Date(),
          });
        }),
    };

    mockNodeRepo = {
      findBy: jest.fn().mockResolvedValue(mockNodes),
    };

    mockEdgeRepo = {
      findBy: jest.fn().mockResolvedValue(mockEdges),
    };

    mockWorkflowRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockWorkflow),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionEngineService,
        NodeHandlerRegistry,
        NodeComponentRegistry,
        ExecutionContextService,
        ErrorPolicyHandler,
        ExpressionResolverService,
        ForEachExecutor,
        LoopExecutor,
        ParallelExecutor,
        { provide: getRepositoryToken(Execution), useValue: mockExecutionRepo },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: mockNodeExecutionRepo,
        },
        { provide: getRepositoryToken(Node), useValue: mockNodeRepo },
        { provide: getRepositoryToken(Edge), useValue: mockEdgeRepo },
        { provide: getRepositoryToken(Workflow), useValue: mockWorkflowRepo },
        {
          provide: WebsocketService,
          useValue: {
            emitExecutionEvent: jest.fn(),
            emitNodeEvent: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: unknown) => {
              if (key === 'MAX_NODE_ITERATIONS') return 100;
              return defaultValue;
            }),
          },
        },
        {
          provide: LlmService,
          useValue: {
            resolveConfig: jest.fn(),
            chat: jest.fn(),
            embed: jest.fn(),
            hasDefaultLlmConfig: jest.fn().mockResolvedValue(false),
          },
        },
        {
          provide: RagSearchService,
          useValue: {
            search: jest.fn().mockResolvedValue([]),
            buildContext: jest
              .fn()
              .mockReturnValue({ context: '', sources: [] }),
          },
        },
        {
          provide: KnowledgeBaseService,
          useValue: {
            findById: jest.fn(),
          },
        },
        {
          provide: IntegrationsService,
          useValue: {
            getForExecution: jest.fn(),
            logUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
        {
          provide: McpClientService,
          useValue: {
            connect: jest.fn(),
          },
        },
        {
          provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
          useValue: {
            add: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
    handlerRegistry = module.get<NodeHandlerRegistry>(NodeHandlerRegistry);
    mockWebsocketService = module.get(WebsocketService);
    mockConfigService = module.get(ConfigService);

    // Register mock handler (clear previous calls)
    (mockHandler.execute as jest.Mock).mockClear();
    handlerRegistry.register('test_node', mockHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('executeInline — Sub-Workflow parent linking', () => {
    let contextService: ExecutionContextService;

    beforeEach(() => {
      contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
    });

    it('stamps parent_node_execution_id on every child created during inline run', async () => {
      mockNodeExecutionRepo.create.mockClear();
      const context = contextService.createContext(executionId, workflowId);

      await service.executeInline(
        workflowId,
        { foo: 'bar' },
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'workflow-node-row-1',
        },
      );

      // Every NodeExecution.create call inside the inline run must carry
      // the parent id we passed.
      const createCalls = mockNodeExecutionRepo.create.mock.calls as Array<
        [Partial<NodeExecution>]
      >;
      expect(createCalls.length).toBeGreaterThan(0);
      for (const [arg] of createCalls) {
        expect(arg.parentNodeExecutionId).toBe('workflow-node-row-1');
      }
    });

    it('restores context.parentNodeExecutionId after the inline run (happy path)', async () => {
      const context = contextService.createContext(executionId, workflowId);
      context.parentNodeExecutionId = 'outer-parent';

      await service.executeInline(
        workflowId,
        {},
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'inner-parent',
        },
      );

      expect(context.parentNodeExecutionId).toBe('outer-parent');
    });

    it('restores context.parentNodeExecutionId even when a child handler throws', async () => {
      const throwingHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(() => Promise.reject(new Error('boom'))),
      };
      handlerRegistry.register('test_node', throwingHandler);

      const context = contextService.createContext(executionId, workflowId);
      context.parentNodeExecutionId = 'outer-parent';

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'inner-parent',
          },
        ),
      ).rejects.toThrow();

      // finally block must restore regardless of success/failure.
      expect(context.parentNodeExecutionId).toBe('outer-parent');
    });
  });

  describe('executeBackgroundSubgraph', () => {
    it('forks context: mutating snapshot vars must not affect job snapshot', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_workflowId, _input, options) => {
          // Mutate the cloned context as if a body node ran.
          options.context.variables.touched = true;
          options.context.nodeOutputCache['extra-node'] = { v: 1 };
          return Promise.resolve(undefined);
        });

      const job = {
        executionId,
        parentNodeExecutionId: 'parent-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: { foo: 1 },
        variables: { keep: 'me' },
        nodeOutputCache: { 'node-1': { hello: 'world' } },
        expressionContext: { workspaceId: 'ws-1' },
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      };

      await service.executeBackgroundSubgraph(job);

      // Mutations stayed inside the inline execution context.
      expect(job.variables).toEqual({ keep: 'me' });
      expect(job.nodeOutputCache).toEqual({
        'node-1': { hello: 'world' },
      });
      expect(inlineSpy).toHaveBeenCalledWith(
        workflowId,
        { foo: 1 },
        expect.objectContaining({
          executionId,
          parentNodeExecutionId: 'parent-1',
          entryNodeIds: ['node-2'],
        }),
      );
      inlineSpy.mockRestore();
    });

    it('rejects when body exceeds maxDurationMs', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(resolve, 200)),
        );

      const job = {
        executionId,
        parentNodeExecutionId: 'parent-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        config: { notifyOnFailure: false, maxDurationMs: 50 },
      };

      await expect(service.executeBackgroundSubgraph(job)).rejects.toThrow(
        /maxDurationMs/,
      );
      inlineSpy.mockRestore();
    });

    it('does not apply timeout when maxDurationMs is 0', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      expect(inlineSpy).toHaveBeenCalled();
      inlineSpy.mockRestore();
    });

    it('forwards every body entry node id to executeInline so all forward-reachable body nodes get scheduled', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2', 'node-3', 'node-7'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      const passed = inlineSpy.mock.calls[0][2];
      expect(passed.entryNodeIds).toEqual(['node-2', 'node-3', 'node-7']);
      // executeInline runs the topological sort itself; we just verify that
      // the entry seeds reach it intact so the body subgraph can be expanded.
      inlineSpy.mockRestore();
    });

    it('stamps parentNodeExecutionId on every NodeExecution created during the body run', async () => {
      // Capture the parentNodeExecutionId that executeInline will use for
      // any child NodeExecution created during the body subgraph run.
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_workflowId, _input, options) => {
          // Mimic a body node creating a NodeExecution row — the engine's
          // createNodeExecution helper reads context.parentNodeExecutionId
          // when callers don't pass an explicit parent. executeInline sets
          // context.parentNodeExecutionId from options.parentNodeExecutionId.
          expect(options.parentNodeExecutionId).toBe('background-parent-row');
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'background-parent-row',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      expect(inlineSpy).toHaveBeenCalled();
      inlineSpy.mockRestore();
    });

    it('passes a fresh executedNodes Set so body execution does not collide with the main flow', async () => {
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockResolvedValue(undefined);

      await service.executeBackgroundSubgraph({
        executionId,
        parentNodeExecutionId: 'parent-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: { 'node-1': { from: 'main' } },
        expressionContext: {},
        config: { notifyOnFailure: false, maxDurationMs: 0 },
      });

      const passed = inlineSpy.mock.calls[0][2];
      // A new Set, not the main run's executedNodes — body must be free to
      // re-execute nodes that the main flow already executed (e.g. when the
      // user wires a body branch back through a node also reachable from main).
      expect(passed.executedNodes).toBeInstanceOf(Set);
      expect(passed.executedNodes.size).toBe(0);
      // The snapshot of nodeOutputCache from the main flow IS available to
      // the body via context, but it lives on the cloned context object —
      // not on the executedNodes set.
      expect(passed.context.nodeOutputCache).toEqual({
        'node-1': { from: 'main' },
      });
      inlineSpy.mockRestore();
    });
  });

  it('should return execution ID immediately', async () => {
    const result = await service.execute(workflowId, { data: 'test' });
    expect(result).toBe(executionId);
    expect(mockWorkflowRepo.findOneBy).toHaveBeenCalledWith({ id: workflowId });
    expect(mockExecutionRepo.create).toHaveBeenCalled();
    expect(mockExecutionRepo.save).toHaveBeenCalled();
  });

  describe('execute() — trigger metadata persistence', () => {
    // 트리거 출처(수동/스케줄/웹훅)를 Execution 행의 executedBy/triggerId 컬럼에
    // 정확히 기록해야 "최근 실행" 화면이 출처를 schedule/webhook 으로 분류할 수 있다
    // (deriveExecutionTrigger 헬퍼 + spec/2-navigation/6-execution-history.md §2.4).

    it('persists executedBy when options.executedBy is provided (manual run)', async () => {
      await service.execute(workflowId, { data: 'test' }, { executedBy: 'u1' });
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          executedBy: 'u1',
          triggerId: undefined,
        }),
      );
    });

    it('persists triggerId when options.triggerId is provided (schedule/webhook run)', async () => {
      await service.execute(
        workflowId,
        { parameters: {} },
        { triggerId: 'trigger-uuid' },
      );
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          triggerId: 'trigger-uuid',
          executedBy: undefined,
        }),
      );
    });

    it('leaves both executedBy and triggerId undefined when no options are provided', async () => {
      await service.execute(workflowId, {});
      expect(mockExecutionRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId,
          executedBy: undefined,
          triggerId: undefined,
        }),
      );
    });
  });

  it('should execute all nodes in background after returning', async () => {
    await service.execute(workflowId, { data: 'test' });

    // Wait for background execution to complete
    await flushPromises();

    // Nodes and edges should be loaded
    expect(mockNodeRepo.findBy).toHaveBeenCalledWith({ workflowId });
    expect(mockEdgeRepo.findBy).toHaveBeenCalledWith({ workflowId });

    // Handler execute should be called 3 times (once per node)
    expect(mockHandler.execute).toHaveBeenCalledTimes(3);

    // Node executions should be created for each node
    expect(mockNodeExecutionRepo.create).toHaveBeenCalledTimes(3);
  });

  it('should throw if workflow not found', async () => {
    mockWorkflowRepo.findOneBy.mockResolvedValue(null);

    await expect(service.execute('non-existent')).rejects.toThrow(
      'Workflow not found',
    );
  });

  it('should handle handler errors in background without rejecting execute()', async () => {
    const customNodes = mockNodes.map((n) => ({ ...n, type: 'unknown_type' }));
    mockNodeRepo.findBy.mockResolvedValue(customNodes);

    // execute() should resolve (not reject) since errors happen in background
    const result = await service.execute(workflowId);
    expect(result).toBe(executionId);

    // Wait for background execution to fail
    await flushPromises();

    // Execution should be marked as failed
    expect(mockExecutionRepo.save).toHaveBeenCalledWith(
      expect.objectContaining({ status: ExecutionStatus.FAILED }),
    );
  });

  it('should pass output from one node as input to the next', async () => {
    const calls: unknown[] = [];
    const tracingHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async (input: unknown) => {
        calls.push(input);
        return { step: calls.length, previousInput: input };
      }),
    };
    handlerRegistry.register('test_node', tracingHandler);

    await service.execute(workflowId, { initial: true });
    await flushPromises();

    // First node receives workflow input
    expect(calls[0]).toEqual({ initial: true });
    // Second node receives first node's output
    expect(calls[1]).toEqual({ step: 1, previousInput: { initial: true } });
    // Third node receives second node's output
    expect(calls[2]).toEqual({
      step: 2,
      previousInput: { step: 1, previousInput: { initial: true } },
    });
  });

  describe('WebSocket events', () => {
    it('should emit EXECUTION_STARTED event when execution begins', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.started',
        expect.objectContaining({ status: 'running' }),
      );
    });

    it('should emit EXECUTION_COMPLETED event after successful execution', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should emit NODE_STARTED and NODE_COMPLETED for each node', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // 3 nodes = 3 started + 3 completed = 6 node events
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledTimes(6);

      // Check first node started
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'execution.node.started',
        expect.objectContaining({ status: 'running' }),
      );

      // Check first node completed
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'execution.node.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should emit EXECUTION_FAILED on error in background', async () => {
      (mockHandler.execute as jest.Mock).mockRejectedValue(
        new Error('Node execution failed'),
      );

      // execute() returns normally (fire-and-forget)
      const result = await service.execute(workflowId);
      expect(result).toBe(executionId);

      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        expect.objectContaining({
          status: 'failed',
          error: 'Node execution failed',
        }),
      );
    });
  });

  describe('Form node blocking', () => {
    const formNodes: Partial<Node>[] = [
      {
        id: 'node-start',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'Start',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-form',
        workflowId,
        type: 'form',
        category: NodeCategory.PRESENTATION,
        label: 'Approval Form',
        config: {
          fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
          title: 'Approval',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-end',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'End',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const formEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-start',
        sourcePort: 'out',
        targetNodeId: 'node-form',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
      {
        id: 'edge-2',
        workflowId,
        sourceNodeId: 'node-form',
        sourcePort: 'out',
        targetNodeId: 'node-end',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    const formHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () => ({
        type: 'form',
        status: 'waiting_for_input',
        formConfig: {
          fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
          title: 'Approval',
        },
      })),
    };

    beforeEach(() => {
      // Reset the test_node handler implementation (may have been overridden by previous tests)
      (mockHandler.execute as jest.Mock).mockResolvedValue({ processed: true });
      mockNodeRepo.findBy.mockResolvedValue(formNodes);
      mockEdgeRepo.findBy.mockResolvedValue(formEdges);
      handlerRegistry.register('form', formHandler);
    });

    it('should pause at Form node and emit waiting_for_input event', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // Should emit waiting_for_input event
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.waiting_for_input',
        expect.objectContaining({
          status: 'waiting_for_input',
          waitingNodeId: 'node-form',
          waitingNodeType: 'form',
        }),
      );

      // End node should NOT have been executed yet (form is blocking)
      expect(mockHandler.execute).toHaveBeenCalledTimes(1); // only start node
    });

    it('should resume after continueExecution and complete all nodes', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // Resume with form data
      service.continueExecution(executionId, { approved: true });
      await flushPromises();

      // End node should now have been executed
      expect(mockHandler.execute).toHaveBeenCalledTimes(2); // start + end

      // Execution should be completed
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should emit EXECUTION_RESUMED (not EXECUTION_STARTED) when resuming from form', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // Clear mock to isolate resume events
      mockWebsocketService.emitExecutionEvent.mockClear();

      // Resume with form data
      service.continueExecution(executionId, { approved: true });
      await flushPromises();

      // Should emit execution.resumed, NOT execution.started
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.resumed',
        expect.objectContaining({ status: 'running' }),
      );
      // Ensure execution.started was NOT emitted during resume
      const startedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.started',
        );
      expect(startedCalls).toHaveLength(0);
    });

    it('should emit NODE_COMPLETED for the form node when resuming', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      mockWebsocketService.emitNodeEvent.mockClear();

      service.continueExecution(executionId, { approved: true });
      await flushPromises();

      // Form node should have a NODE_COMPLETED event
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-form',
        'execution.node.completed',
        expect.objectContaining({
          status: 'completed',
          nodeType: 'form',
        }),
      );
    });

    it('should throw when continueExecution called without pending continuation', async () => {
      expect(() => service.continueExecution('non-existent', {})).toThrow(
        'No pending continuation',
      );
    });

    it('should throw when continueAiConversation receives oversized message', async () => {
      // Set up a pending continuation first
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      const oversizedMessage = 'x'.repeat(10_001);
      expect(() =>
        service.continueAiConversation(executionId, oversizedMessage),
      ).toThrow('Message exceeds maximum length');
    });

    it('should throw when continueAiConversation called without pending continuation', () => {
      expect(() =>
        service.continueAiConversation('non-existent', 'hello'),
      ).toThrow('No pending continuation');
    });

    it('should handle cancellation of waiting execution', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // Cancel the waiting execution
      service.cancelWaitingExecution(executionId);
      await flushPromises();

      // Should emit cancelled event
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
    });
  });

  describe('AI Agent multi-turn — execution.ai_message emit shape', () => {
    // spec/5-system/6-websocket-protocol.md §4.4 — waiting_for_input emit
    // must carry `llmCalls` (array) + `durationMs` and must NOT carry the
    // legacy flat fields requestPayload / responsePayload that no shipping
    // frontend reads. This is the contract a regression here would silently
    // break; helper unit tests cover the transformation, this integration
    // test covers the emit call site.
    const aiNodes: Partial<Node>[] = [
      {
        id: 'node-agent',
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: { mode: 'multi_turn' },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const aiEdges: Partial<Edge>[] = [];

    function makeAiAgentHandler(processReturn: () => unknown): NodeHandler & {
      processMultiTurnMessage: jest.Mock;
      endMultiTurnConversation: jest.Mock;
    } {
      return {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { messages: [], message: '', turnCount: 0 },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            turnDebugHistory: [],
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
          },
        })),
        processMultiTurnMessage: jest.fn(async () => processReturn()),
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & {
        processMultiTurnMessage: jest.Mock;
        endMultiTurnConversation: jest.Mock;
      };
    }

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(aiNodes);
      mockEdgeRepo.findBy.mockResolvedValue(aiEdges);
    });

    it('emits messages snapshot, llmCalls, and durationMs (and omits removed flat fields) on resumed waiting turn', async () => {
      // Distinct values for per-call vs turn-total durationMs so the test
      // pinpoints which source the payload's top-level durationMs comes
      // from (must be the turn total, not the last LLM call's latency).
      const llmCall = {
        requestPayload: { messages: [{ role: 'user', content: 'hi' }] },
        responsePayload: {
          content: 'hello',
          model: 'test-model',
          usage: { inputTokens: 5, outputTokens: 2 },
        },
        durationMs: 90,
      };
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          message: 'hello',
          turnCount: 1,
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'hello' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [
            {
              turnIndex: 1,
              llmCalls: [llmCall],
              totalDurationMs: 120,
            },
          ],
        },
      }));
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      service.continueAiConversation(executionId, 'hi');
      await flushPromises();

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(1);
      const payload = aiMessageCalls[0][2] as Record<string, unknown>;

      // Frontend drops payloads missing this field — assert the engine
      // honors the contract (system role filtered, length > 0).
      expect(payload).toHaveProperty('messages');
      expect(Array.isArray(payload.messages)).toBe(true);
      expect((payload.messages as unknown[]).length).toBeGreaterThan(0);

      expect(payload).toMatchObject({
        nodeId: 'node-agent',
        message: 'hello',
        turnCount: 1,
        // turn-total (totalDurationMs), not the per-call llmCall.durationMs (90)
        durationMs: 120,
      });
      expect(payload.llmCalls).toEqual([llmCall]);

      // Dead fields removed in this branch alignment — guard against
      // accidental reintroduction.
      expect(payload).not.toHaveProperty('requestPayload');
      expect(payload).not.toHaveProperty('responsePayload');
    });

    it('preserves the full llmCalls sequence for tool-loop turns', async () => {
      const calls = [
        {
          requestPayload: { tool: 1 },
          responsePayload: { content: '' },
          durationMs: 30,
        },
        {
          requestPayload: { tool: 2 },
          responsePayload: { content: '' },
          durationMs: 40,
        },
        {
          requestPayload: { tool: 3 },
          responsePayload: { content: 'final' },
          durationMs: 50,
        },
      ];
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'final' },
          ],
          message: 'final',
          turnCount: 1,
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: 'hi' },
            { role: 'assistant', content: 'final' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          turnDebugHistory: [
            { turnIndex: 1, llmCalls: calls, totalDurationMs: 120 },
          ],
        },
      }));
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      service.continueAiConversation(executionId, 'hi');
      await flushPromises();

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(1);
      const payload = aiMessageCalls[0][2] as Record<string, unknown>;
      expect(payload).toHaveProperty('messages');
      expect(Array.isArray(payload.messages)).toBe(true);
      expect((payload.messages as unknown[]).length).toBeGreaterThan(0);
      expect(payload.llmCalls).toEqual(calls);
      expect(payload.llmCalls as unknown[]).toHaveLength(3);
      expect(payload.durationMs).toBe(120);
    });
  });

  describe('Template node expression resolution', () => {
    const varDeclNodes: Partial<Node>[] = [
      {
        id: 'node-trigger',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'Trigger',
        config: {},
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
      {
        id: 'node-template',
        workflowId,
        type: 'template',
        category: NodeCategory.PRESENTATION,
        label: 'Template',
        config: {
          template:
            'Hello {{ name }}, token: {{ $var.token }}, trigger: {{ $node["Trigger"].output.greeting }}',
          outputFormat: 'text',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];

    const varDeclEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-trigger',
        sourcePort: 'out',
        targetNodeId: 'node-template',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    let templateExecuteSpy: jest.Mock;

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(varDeclNodes);
      mockEdgeRepo.findBy.mockResolvedValue(varDeclEdges);

      // Trigger node outputs { name: 'Alice', greeting: 'Hi' }
      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn().mockResolvedValue({
          name: 'Alice',
          greeting: 'Hi',
        }),
      };
      handlerRegistry.register('test_node', triggerHandler);

      // Template handler: capture resolved config
      templateExecuteSpy = jest
        .fn<
          Promise<Record<string, unknown>>,
          [unknown, Record<string, unknown>]
        >()
        .mockImplementation((_input, config) =>
          Promise.resolve({
            type: 'template',
            format: config.outputFormat as string,
            content: config.template as string,
          }),
        );
      const templateHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: templateExecuteSpy,
      };
      handlerRegistry.register('template', templateHandler);
    });

    it('should resolve $var, $node, and input-data references in template config', async () => {
      // Inject variable into execution context

      const contextService: ExecutionContextService = (service as any)[
        'contextService'
      ];
      const origCreate = contextService.createContext.bind(contextService);
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, vars?: Record<string, unknown>) => {
            return origCreate(execId, wfId, { ...vars, token: 'xyz789' });
          },
        );

      await service.execute(workflowId, {});
      await flushPromises();

      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);

      const resolvedConfig = (
        templateExecuteSpy.mock.calls[0] as unknown[]
      )[1] as Record<string, unknown>;

      // {{ name }} resolved from input data (root-level spread)
      // {{ $var.token }} resolved from execution variables
      // {{ $node["Trigger"].output.greeting }} resolved from node output
      expect(resolvedConfig.template).toBe(
        'Hello Alice, token: xyz789, trigger: Hi',
      );
    });

    it('should not spread array input into expression context', async () => {
      // Make trigger return an array
      const arrayHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn().mockResolvedValue(['a', 'b', 'c']),
      };
      handlerRegistry.register('test_node', arrayHandler);

      // Template uses $input to reference array
      mockNodeRepo.findBy.mockResolvedValue([
        varDeclNodes[0],
        {
          ...varDeclNodes[1],
          config: {
            template: 'Data: {{ $input }}',
            outputFormat: 'text',
          },
        },
      ]);

      await service.execute(workflowId, {});
      await flushPromises();

      // Should still execute without error (array not spread)
      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);
    });

    it('should not override built-in context with input data keys', async () => {
      // Trigger outputs data with a key named "$var" (edge case)
      const conflictHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn().mockResolvedValue({
          $var: { token: 'overridden' },
          name: 'Bob',
        }),
      };
      handlerRegistry.register('test_node', conflictHandler);

      const contextService: ExecutionContextService = (service as any)[
        'contextService'
      ];
      const origCreate = contextService.createContext.bind(contextService);
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, vars?: Record<string, unknown>) => {
            return origCreate(execId, wfId, { ...vars, token: 'original' });
          },
        );

      mockNodeRepo.findBy.mockResolvedValue([
        varDeclNodes[0],
        {
          ...varDeclNodes[1],
          config: {
            template: '{{ $var.token }} {{ name }}',
            outputFormat: 'text',
          },
        },
      ]);

      await service.execute(workflowId, {});
      await flushPromises();

      expect(templateExecuteSpy).toHaveBeenCalledTimes(1);

      const resolvedConfig = (
        templateExecuteSpy.mock.calls[0] as unknown[]
      )[1] as Record<string, unknown>;

      // $var should be the original context value, not overridden by input
      // name from input should be spread as root-level since it doesn't conflict
      expect(resolvedConfig.template).toBe('original Bob');
    });
  });

  // ENG-RC-* — 엔진이 핸들러에 노출하는 ExecutionContext.rawConfig 가
  // expression 평가 전 원본을 그대로 담고 mutation 으로부터 보호되어야 한다.
  // 핸들러는 NodeHandlerOutput.config echo 시 rawConfig 를 사용하여
  // CONVENTIONS Principle 1.1 / Principle 7 의 직교성을 유지한다.
  describe('ENG-RC-* — ExecutionContext.rawConfig exposure', () => {
    const wf = workflowId;

    const triggerNode: Partial<Node> = {
      id: 'rc-trigger',
      workflowId: wf,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Trigger',
      config: {},
      isDisabled: false,
    };
    // 'template' 노드 타입을 활용 — 런타임 NodeComponentRegistry 에 이미 등록되어
    // 있어 엔진이 경로를 인식한다. 본 테스트는 ExecutionContext.rawConfig 노출
    // 동작만 검증하므로 노드 타입의 도메인 의미와는 무관.
    const exprNode: Partial<Node> = {
      id: 'rc-expr',
      workflowId: wf,
      type: 'template',
      category: NodeCategory.PRESENTATION,
      label: 'Expr Target',
      config: {
        subject: 'Hello {{ name }}',
        bodyType: 'text',
        body: 'Greeting: {{ $node["Trigger"].output.greeting }}',
      },
      isDisabled: false,
    };
    const rcEdges: Partial<Edge>[] = [
      {
        id: 'rc-edge',
        workflowId: wf,
        sourceNodeId: 'rc-trigger',
        sourcePort: 'out',
        targetNodeId: 'rc-expr',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    let captureSpy: jest.Mock<
      Promise<unknown>,
      [unknown, Record<string, unknown>, ExecutionContextLike]
    >;

    type ExecutionContextLike = {
      rawConfig?: Readonly<Record<string, unknown>>;
      [key: string]: unknown;
    };

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue([triggerNode, exprNode]);
      mockEdgeRepo.findBy.mockResolvedValue(rcEdges);

      handlerRegistry.register('test_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest
          .fn()
          .mockResolvedValue({ name: 'Alice', greeting: 'Hi there' }),
      });

      captureSpy = jest
        .fn<
          Promise<unknown>,
          [unknown, Record<string, unknown>, ExecutionContextLike]
        >()
        .mockResolvedValue({ ok: true });
      handlerRegistry.register('template', {
        validate: () => ({ valid: true, errors: [] }),
        execute: captureSpy,
      });
    });

    it('exposes rawConfig with pre-evaluation template strings (config arg has evaluated values)', async () => {
      await service.execute(wf, {});
      await flushPromises();

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const [, evaluatedConfig, ctx] = captureSpy.mock.calls[0];

      // config arg is post-evaluation (placeholders resolved)
      expect(evaluatedConfig.subject).toBe('Hello Alice');
      expect(evaluatedConfig.body).toBe('Greeting: Hi there');

      // rawConfig is pre-evaluation (placeholders preserved)
      expect(ctx.rawConfig).toBeDefined();
      expect(ctx.rawConfig?.subject).toBe('Hello {{ name }}');
      expect(ctx.rawConfig?.body).toBe(
        'Greeting: {{ $node["Trigger"].output.greeting }}',
      );
      // Non-expression fields are identical in raw and evaluated
      expect(ctx.rawConfig?.bodyType).toBe('text');
      expect(evaluatedConfig.bodyType).toBe('text');
    });

    it('freezes rawConfig — mutation attempts at top level throw in strict mode', async () => {
      let mutationError: unknown = null;
      captureSpy.mockImplementationOnce(
        async (_input, _config, ctx: ExecutionContextLike) => {
          try {
            // Cast away Readonly to simulate misbehaving handler.
            (ctx.rawConfig as Record<string, unknown>).subject = 'hacked';
          } catch (err) {
            mutationError = err;
          }
          return { ok: true };
        },
      );

      await service.execute(wf, {});
      await flushPromises();

      // Strict mode (TS / NestJS default) throws TypeError on frozen-property assign.
      expect(mutationError).toBeInstanceOf(TypeError);
      // Underlying object remains untouched.
      const ctx = captureSpy.mock.calls[0][2];
      expect(ctx.rawConfig?.subject).toBe('Hello {{ name }}');
    });

    it('still populates rawConfig when nodeMap is empty (no expression resolution path)', async () => {
      // expression-free config — engine still injects rawConfig (== node.config snapshot)
      const literalNode: Partial<Node> = {
        ...exprNode,
        config: { subject: 'Static Subject', bodyType: 'html', body: 'Plain' },
      };
      mockNodeRepo.findBy.mockResolvedValue([triggerNode, literalNode]);

      await service.execute(wf, {});
      await flushPromises();

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const [, evaluatedConfig, ctx] = captureSpy.mock.calls[0];

      // No expression placeholders — raw and evaluated are equivalent in content.
      expect(evaluatedConfig.subject).toBe('Static Subject');
      expect(ctx.rawConfig?.subject).toBe('Static Subject');
      expect(ctx.rawConfig?.bodyType).toBe('html');
    });

    it('snapshots rawConfig into state when handler returns waiting_for_input (multi-turn resume hook)', async () => {
      // Multi-turn 핸들러는 ExecutionContext 가 아닌 state 만 받으므로 (resume),
      // 첫 turn 이 waiting_for_input 으로 진입할 때 엔진이 state.rawConfig 를
      // 자동으로 snapshot 한다. 후속 turn 의 processMultiTurnMessage(message, state)
      // 가 state.rawConfig 로 일관되게 접근할 수 있다.
      const aiNode: Partial<Node> = {
        id: 'rc-ai',
        workflowId: wf,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'Agent',
        config: {
          mode: 'multi_turn',
          // expression-free literal — engine 의 raw snapshot 자체가 검증 대상.
          // expression 평가 에러로 waiting 상태에 진입조차 못하는 부수 문제를 회피.
          systemPrompt: 'You are a helpful assistant',
        },
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([aiNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const processSpy = jest.fn(async () => ({
        config: { mode: 'multi_turn' },
        output: { messages: [], message: '', turnCount: 1 },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
          turnDebugHistory: [],
        },
      }));

      handlerRegistry.register('ai_agent', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { messages: [], message: '', turnCount: 0 },
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          _resumeState: {
            messages: [],
            turnCount: 0,
            model: 'test-model',
            totalInputTokens: 0,
            totalOutputTokens: 0,
            turnDebugHistory: [],
          },
        })),
        processMultiTurnMessage: processSpy,
        endMultiTurnConversation: jest.fn(() => ({
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler);

      await service.execute(wf, {});
      await flushPromises();

      service.continueAiConversation(executionId, 'hello');
      await flushPromises();

      expect(processSpy).toHaveBeenCalledTimes(1);
      const stateArg = processSpy.mock.calls[0][1] as Record<string, unknown>;
      const snapshot = stateArg.rawConfig as
        | Record<string, unknown>
        | undefined;
      expect(snapshot).toBeDefined();
      // 노드 정의의 원본 config 가 state.rawConfig 로 보존되어 후속 turn 의
      // processMultiTurnMessage 가 일관되게 접근할 수 있다.
      expect(snapshot?.systemPrompt).toBe('You are a helpful assistant');
      expect(snapshot?.mode).toBe('multi_turn');
    });
  });

  describe('Cyclic workflow execution (back-edge support)', () => {
    it('should execute a cyclic workflow when back-edge port is conditionally selected', async () => {
      // A -> Switch -> case1 back to A, case2 forward to C
      // Switch selects case1 on first call, case2 on second call
      let switchCallCount = 0;
      const switchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          switchCallCount++;
          if (switchCallCount === 1) {
            return { port: 'case1', data: { iteration: 1 } };
          }
          return { port: 'case2', data: { iteration: 2 } };
        }),
      };

      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          processed: true,
          input,
        })),
      };

      handlerRegistry.register('cyclic_pass', passHandler);
      handlerRegistry.register('cyclic_switch', switchHandler);

      const cyclicNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'cyclic_pass',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-switch',
          workflowId,
          type: 'cyclic_switch',
          category: NodeCategory.LOGIC,
          label: 'Switch',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'cyclic_pass',
          category: NodeCategory.LOGIC,
          label: 'Node C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const cyclicEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-switch',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-switch',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-switch-a',
          workflowId,
          sourceNodeId: 'node-switch',
          sourcePort: 'case1',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-switch-c',
          workflowId,
          sourceNodeId: 'node-switch',
          sourcePort: 'case2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(cyclicNodes);
      mockEdgeRepo.findBy.mockResolvedValue(cyclicEdges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // Switch should be called twice (first loop back, then forward)
      expect(switchCallCount).toBe(2);

      // Execution should complete (not fail)
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });

    it('should throw when a node exceeds MAX_NODE_ITERATIONS', async () => {
      // A -> B -> A (always loops back, no exit)
      const alwaysOutputHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ value: 'data' })),
      };
      handlerRegistry.register('infinite_node', alwaysOutputHandler);

      const infiniteNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'infinite_node',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'infinite_node',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const infiniteEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-a',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'out',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(infiniteNodes);
      mockEdgeRepo.findBy.mockResolvedValue(infiniteEdges);

      // ConfigService returns MAX_NODE_ITERATIONS=3 for this test
      const configService = service['configService'] as unknown as {
        get: jest.Mock;
      };
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 3;
          return defaultValue;
        },
      );

      await service.execute(workflowId, {});
      await flushPromises();

      // Should be marked as failed due to max iteration exceeded
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.FAILED,
          error: expect.objectContaining({
            message: expect.stringContaining(
              'exceeded maximum iteration count',
            ),
          }),
        }),
      );
    });

    it('should allow unlimited iterations when MAX_NODE_ITERATIONS=0', async () => {
      // A -> B -> A with B exiting after 5 iterations via port routing
      let bCallCount = 0;
      const loopHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bCallCount++;
          if (bCallCount < 5) {
            return { port: 'loop', data: { count: bCallCount } };
          }
          return { port: 'exit', data: { count: bCallCount } };
        }),
      };
      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          processed: true,
          input,
        })),
      };

      handlerRegistry.register('loop_switch', loopHandler);
      handlerRegistry.register('loop_pass', passHandler);

      const loopNodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'loop_pass',
          category: NodeCategory.LOGIC,
          label: 'Node A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'loop_switch',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-end',
          workflowId,
          type: 'loop_pass',
          category: NodeCategory.LOGIC,
          label: 'End',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const loopEdges: Partial<Edge>[] = [
        {
          id: 'edge-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-a',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'loop',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'edge-b-end',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'exit',
          targetNodeId: 'node-end',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(loopNodes);
      mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

      // ConfigService returns 0 (unlimited)
      const configService = service['configService'] as unknown as {
        get: jest.Mock;
      };
      configService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 0;
          return defaultValue;
        },
      );

      await service.execute(workflowId, {});
      await flushPromises();

      // B should have been called 5 times (4 loops + 1 exit)
      expect(bCallCount).toBe(5);

      // Execution should complete successfully
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });

    it('should pass workflowInput to back-edge target start node on first execution', async () => {
      // A (start, also back-edge target) -> B (switch)
      // B -> case1: back to A, case2: forward to C
      const aInputs: unknown[] = [];
      const startHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          aInputs.push(input);
          return { fromA: true, input };
        }),
      };

      let switchCount = 0;
      const switchNodeHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          switchCount++;
          if (switchCount === 1) {
            return { port: 'case1', data: { loop: true } };
          }
          return { port: 'case2', data: { done: true } };
        }),
      };

      const endHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({ end: true, input })),
      };

      handlerRegistry.register('start_input_test', startHandler);
      handlerRegistry.register('switch_input_test', switchNodeHandler);
      handlerRegistry.register('end_input_test', endHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'start_input_test',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-sw',
          workflowId,
          type: 'switch_input_test',
          category: NodeCategory.LOGIC,
          label: 'SW',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'end_input_test',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-sw',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'node-sw',
          sourcePort: 'case1',
          targetNodeId: 'node-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'node-sw',
          sourcePort: 'case2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { initial: 'data' });
      await flushPromises();

      // First execution: A should receive workflowInput (not undefined)
      expect(aInputs[0]).toEqual({ initial: 'data' });
      // Second execution (after back-edge): A should receive switch output
      // _selectedPort is stripped before passing as input to downstream nodes
      expect(aInputs[1]).toEqual(expect.objectContaining({ loop: true }));
    });

    it('should still work for non-cyclic DAG workflows (regression)', async () => {
      // Use default mockNodes/mockEdges (linear: node-1 -> node-2 -> node-3)
      mockNodeRepo.findBy.mockResolvedValue(mockNodes);
      mockEdgeRepo.findBy.mockResolvedValue(mockEdges);

      (mockHandler.execute as jest.Mock).mockResolvedValue({ ok: true });
      handlerRegistry.register('test_node', mockHandler);

      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(mockHandler.execute).toHaveBeenCalledTimes(3);
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });
  });

  describe('Reachability-based execution', () => {
    it('should only execute the branch matching the selected port', async () => {
      // A(port router) -> port1 -> B, port2 -> C
      // A selects port1, so B executes and C does NOT
      const routerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          port: 'port1',
          data: { routed: true },
        })),
      };
      const leafHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({ received: true, input })),
      };
      handlerRegistry.register('port_router', routerHandler);
      handlerRegistry.register('port_leaf', leafHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'port_router',
          category: NodeCategory.LOGIC,
          label: 'Router',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'port1',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-a-c',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'port2',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      expect(routerHandler.execute).toHaveBeenCalledTimes(1);
      expect(leafHandler.execute).toHaveBeenCalledTimes(1);
      // B received the routed data (without _selectedPort)
      const bInput = (leafHandler.execute as jest.Mock).mock.calls[0][0];
      expect(bInput).toEqual({ routed: true });
    });

    it('should strip port / status / _resumeState control fields from downstream input', async () => {
      // Regression: form/ai_agent style handlers emit canonical output with
      // top-level port/status/_resumeState control fields. When that output
      // is forwarded to a downstream node as input, the control fields
      // previously leaked through (only `_selectedPort` was stripped),
      // which caused pass-through successors (e.g. switch) to inherit the
      // stale `port: "out"` and misroute every outgoing edge.
      const emitterHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { interaction: { data: { food_type: '한식' } } },
          status: 'resumed',
          port: 'out',
          _resumeState: { turnCount: 1 },
        })),
      };
      const receiverHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({ seen: input })),
      };
      handlerRegistry.register('ctl_emitter', emitterHandler);
      handlerRegistry.register('ctl_receiver', receiverHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-emit',
          workflowId,
          type: 'ctl_emitter',
          category: NodeCategory.PRESENTATION,
          label: 'Emit',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-recv',
          workflowId,
          type: 'ctl_receiver',
          category: NodeCategory.LOGIC,
          label: 'Recv',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-emit-recv',
          workflowId,
          sourceNodeId: 'node-emit',
          sourcePort: 'out',
          targetNodeId: 'node-recv',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await flushPromises();

      expect(receiverHandler.execute).toHaveBeenCalledTimes(1);
      const receivedInput = (receiverHandler.execute as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      expect(receivedInput).not.toHaveProperty('port');
      expect(receivedInput).not.toHaveProperty('status');
      expect(receivedInput).not.toHaveProperty('_resumeState');
      expect(receivedInput).not.toHaveProperty('_selectedPort');
      expect(receivedInput).toMatchObject({
        interaction: { data: { food_type: '한식' } },
      });
    });

    it('should not execute nodes downstream of a disabled node', async () => {
      // A -> B(disabled) -> C — C should never execute
      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          processed: true,
          input,
        })),
      };
      handlerRegistry.register('reach_pass', passHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-a',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: true,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-a-b',
          workflowId,
          sourceNodeId: 'node-a',
          sourcePort: 'out',
          targetNodeId: 'node-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-b-c',
          workflowId,
          sourceNodeId: 'node-b',
          sourcePort: 'out',
          targetNodeId: 'node-c',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // A executes, B is disabled (skipped), C never executes (unreachable)
      expect(passHandler.execute).toHaveBeenCalledTimes(1);
    });

    it('should isolate parallel branches through port routing', async () => {
      // Trigger -> Router -> [port1->X->Y, port2->P->Q]
      // Router selects port2: P and Q execute, X and Y do NOT
      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ triggered: true })),
      };
      const routerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ port: 'port2', data: { branch: 2 } })),
      };
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({ done: true, input })),
      };
      handlerRegistry.register('iso_trigger', triggerHandler);
      handlerRegistry.register('iso_router', routerHandler);
      handlerRegistry.register('iso_branch', branchHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'trigger',
          workflowId,
          type: 'iso_trigger',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'router',
          workflowId,
          type: 'iso_router',
          category: NodeCategory.LOGIC,
          label: 'Router',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'x',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'X',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'y',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Y',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'p',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'P',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'q',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Q',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-t-r',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'router',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-r-x',
          workflowId,
          sourceNodeId: 'router',
          sourcePort: 'port1',
          targetNodeId: 'x',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-x-y',
          workflowId,
          sourceNodeId: 'x',
          sourcePort: 'out',
          targetNodeId: 'y',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-r-p',
          workflowId,
          sourceNodeId: 'router',
          sourcePort: 'port2',
          targetNodeId: 'p',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-p-q',
          workflowId,
          sourceNodeId: 'p',
          sourcePort: 'out',
          targetNodeId: 'q',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await flushPromises();

      expect(triggerHandler.execute).toHaveBeenCalledTimes(1);
      expect(routerHandler.execute).toHaveBeenCalledTimes(1);
      // P and Q execute (port2 branch)
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Verify the inputs are from the port2 branch
      const calls = (branchHandler.execute as jest.Mock).mock.calls;
      expect(calls[0][0]).toEqual({ branch: 2 }); // P receives router data
    });
  });

  describe('Container runtime', () => {
    beforeEach(() => {
      // Test modules don't invoke onModuleInit, so register real container
      // handlers used by the pointer loop here.
      handlerRegistry.register('foreach', new ForEachHandler());
      handlerRegistry.register('loop', new LoopHandler());
      handlerRegistry.register('map', new MapHandler());
    });

    it('executes ForEach body once per item and puts collected results on done port', async () => {
      const bodyCalls: unknown[] = [];
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          bodyCalls.push(input);
          const item = input as Record<string, unknown> | null;
          return { doubled: ((item?.n as number) ?? 0) * 2 };
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return { received: input };
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          items: [{ n: 1 }, { n: 2 }, { n: 3 }],
        })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      // Body ran once per item
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(bodyCalls).toEqual([{ n: 1 }, { n: 2 }, { n: 3 }]);

      // Sink received the collected results on done port.
      // Stage 5: containers wrap results in `{ items|iterations|mapped, count }`.
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      expect(sinkCalls[0]).toEqual({
        count: 3,
        items: [{ doubled: 2 }, { doubled: 4 }, { doubled: 6 }],
      });
    });

    it('executes Loop body N times', async () => {
      let counter = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          counter++;
          return { count: counter };
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return { done: true };
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({})),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: 4 },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'loop',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-body',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-loop',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'loop',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-loop-sink',
          workflowId,
          sourceNodeId: 'loop',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      expect(bodyHandler.execute).toHaveBeenCalledTimes(4);
      // Stage 5: loop finalises as `{ iterations, count }`.
      expect(sinkCalls).toEqual([
        {
          count: 4,
          iterations: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }],
        },
      ]);
    });

    it('produces empty array when ForEach array is empty', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return { ok: true };
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ items: [] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      expect(bodyHandler.execute).not.toHaveBeenCalled();
      // Stage 5: empty foreach still emits the `{ items, count }` envelope.
      expect(sinkCalls[0]).toEqual({ count: 0, items: [] });
    });

    it('fails execution when container has no emit edge', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ items: [1, 2] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];

      // No edge targeting foreach.emit — should fail
      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      // Execution should be marked failed with the emit-missing message
      const saveCalls = mockExecutionRepo.save.mock.calls;
      const failed = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as Partial<Execution>).status === ExecutionStatus.FAILED,
      );
      expect(failed).toBeDefined();
      expect(
        ((failed as [Partial<Execution>])[0].error as { message?: string })
          .message,
      ).toMatch(/CONTAINER_MISSING_EMIT/);
    });

    it('fails execution when container has multiple emit edges', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);
      handlerRegistry.register('body_node_2', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({ items: [1] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body-a',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body-a',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
        {
          id: 'body-b',
          workflowId,
          type: 'body_node_2',
          category: NodeCategory.LOGIC,
          label: 'body-b',
          config: {},
          isDisabled: false,
          containerId: 'foreach',
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-fe',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body-a',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body-b',
          workflowId,
          sourceNodeId: 'foreach',
          sourcePort: 'body',
          targetNodeId: 'body-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-emit-a',
          workflowId,
          sourceNodeId: 'body-a',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-emit-b',
          workflowId,
          sourceNodeId: 'body-b',
          sourcePort: 'out',
          targetNodeId: 'foreach',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      const saveCalls = mockExecutionRepo.save.mock.calls;
      const failed = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as Partial<Execution>).status === ExecutionStatus.FAILED,
      );
      expect(failed).toBeDefined();
      expect(
        ((failed as [Partial<Execution>])[0].error as { message?: string })
          .message,
      ).toMatch(/CONTAINER_MULTIPLE_EMIT/);
    });

    it('executes Map body once per item and transforms via emit port', async () => {
      const bodyCalls: unknown[] = [];
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          bodyCalls.push(input);
          const item = input as Record<string, unknown> | null;
          const n = (item?.n as number) ?? 0;
          return { squared: n * n };
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return { received: input };
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          items: [{ n: 2 }, { n: 3 }, { n: 4 }],
        })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'source',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'source',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'map',
          workflowId,
          type: 'map',
          category: NodeCategory.LOGIC,
          label: 'map',
          config: { inputField: 'items' },
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'body',
          workflowId,
          type: 'body_node',
          category: NodeCategory.LOGIC,
          label: 'body',
          config: {},
          isDisabled: false,
          containerId: 'map',
          toolOwnerId: null,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e-src-map',
          workflowId,
          sourceNodeId: 'source',
          sourcePort: 'out',
          targetNodeId: 'map',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-map-body',
          workflowId,
          sourceNodeId: 'map',
          sourcePort: 'body',
          targetNodeId: 'body',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-body-emit-map',
          workflowId,
          sourceNodeId: 'body',
          sourcePort: 'out',
          targetNodeId: 'map',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-map-sink',
          workflowId,
          sourceNodeId: 'map',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await new Promise((r) => setTimeout(r, 200));

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(bodyCalls).toEqual([{ n: 2 }, { n: 3 }, { n: 4 }]);
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      // Stage 5: map finalises as `{ mapped, count }`.
      expect(sinkCalls[0]).toEqual({
        count: 3,
        mapped: [{ squared: 4 }, { squared: 9 }, { squared: 16 }],
      });
    });
  });

  describe('Parallel execution (PARALLEL_ENGINE=v1)', () => {
    afterEach(() => {
      mockConfigService.get.mockReset();
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );
    });

    it('should execute branch bodies concurrently and feed Merge', async () => {
      // Override ConfigService to enable parallel engine
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

      // Branch handlers record their call order
      const executionOrder: string[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          executionOrder.push('branch');
          return { branchOutput: true, input };
        }),
      };
      const mergeHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          executionOrder.push('merge');
          return {
            config: { strategy: 'wait_all', outputFormat: 'array' },
            output: input,
          };
        }),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          output: input,
          port: ['branch_0', 'branch_1'],
        })),
      };

      handlerRegistry.register('parallel', parallelHandler);
      handlerRegistry.register('branch_node', branchHandler);
      handlerRegistry.register('merge', mergeHandler);

      // Graph: Trigger -> Parallel -> [branch_0 -> A, branch_1 -> B] -> Merge
      const nodes: Partial<Node>[] = [
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'parallel-1',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'branch-b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'merge-1',
          workflowId,
          type: 'merge',
          category: NodeCategory.LOGIC,
          label: 'Merge',
          config: { strategy: 'wait_all', outputFormat: 'array' },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'parallel-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_0',
          targetNodeId: 'branch-a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'parallel-1',
          sourcePort: 'branch_1',
          targetNodeId: 'branch-b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e4',
          workflowId,
          sourceNodeId: 'branch-a',
          sourcePort: 'out',
          targetNodeId: 'merge-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e5',
          workflowId,
          sourceNodeId: 'branch-b',
          sourcePort: 'out',
          targetNodeId: 'merge-1',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // Branch handlers both executed
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Merge executed once
      expect(mergeHandler.execute).toHaveBeenCalledTimes(1);
      // Execution order: trigger → parallel → branches → merge
      expect(executionOrder).toEqual(['branch', 'branch', 'merge']);
      // Execution completed (not failed)
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });

    it('should collect branch results on the done port', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

      const doneReceived: unknown[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          branchResult: true,
          fromInput: input,
        })),
      };
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          doneReceived.push(input);
          return { sink: true };
        }),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => ({
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          output: input,
          port: ['branch_0', 'branch_1'],
        })),
      };

      handlerRegistry.register('parallel', parallelHandler);
      handlerRegistry.register('branch_node', branchHandler);
      handlerRegistry.register('sink_node', sinkHandler);

      // Graph: Trigger → Parallel → [branch_0→A, branch_1→B] | done → Sink
      const nodes: Partial<Node>[] = [
        {
          id: 'trigger',
          workflowId,
          type: 'test_node',
          category: NodeCategory.TRIGGER,
          label: 'Trigger',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'par',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'Sink',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e1',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e2',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'branch_0',
          targetNodeId: 'a',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e3',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'branch_1',
          targetNodeId: 'b',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e4',
          workflowId,
          sourceNodeId: 'par',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // Both branches executed
      expect(branchHandler.execute).toHaveBeenCalledTimes(2);
      // Sink received collected results via done port
      expect(sinkHandler.execute).toHaveBeenCalledTimes(1);
      expect(doneReceived.length).toBe(1);
      // Stage 5 / CONVENTIONS §9.2: Parallel finalises as `{ branches, count }`.
      const received = doneReceived[0] as Record<string, unknown>;
      expect(received.branches).toBeDefined();
      expect(Array.isArray(received.branches)).toBe(true);
      expect((received.branches as unknown[]).length).toBe(2);
      expect(received.count).toBe(2);
    });
  });

  describe('AI no-llm-provider rule post-filter', () => {
    // 캔버스 hasDefaultLlmConfig 억제와 의미를 일치시키기 위한 후처리 검증.
    // execute 전체를 돌리는 대신 private 메서드를 직접 호출하여 분기를 검증한다.

    // keep in sync with filterAiNoLlmProviderError signature (subject + errors + context).
    type Filterable = {
      filterAiNoLlmProviderError: (
        nodeType: string,
        errors: string[],
        context: { variables?: Record<string, unknown> },
      ) => Promise<string[]>;
    };

    let llm: { hasDefaultLlmConfig: jest.Mock };
    const subject = () => service as unknown as Filterable;

    const buildContext = (
      workspaceId: string | undefined,
      extraVariables: Record<string, unknown> = {},
    ): { variables: Record<string, unknown> } => {
      if (workspaceId === undefined) {
        return { variables: { ...extraVariables } };
      }
      return {
        variables: { __workspaceId: workspaceId, ...extraVariables },
      };
    };

    beforeEach(() => {
      llm = (
        service as unknown as {
          llmService: { hasDefaultLlmConfig: jest.Mock };
        }
      ).llmService;
      llm.hasDefaultLlmConfig.mockReset();
      llm.hasDefaultLlmConfig.mockResolvedValue(false);
    });

    it('passes through errors for non-AI nodes', async () => {
      const result = await subject().filterAiNoLlmProviderError(
        'http_request',
        [AI_NO_LLM_PROVIDER_MESSAGE, 'other error'],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE, 'other error']);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('keeps the no-llm-provider error when workspace has no default LLM', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(false);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
    });

    it('drops the no-llm-provider error when workspace has a default LLM', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      for (const type of [
        'ai_agent',
        'text_classifier',
        'information_extractor',
      ]) {
        const result = await subject().filterAiNoLlmProviderError(
          type,
          [AI_NO_LLM_PROVIDER_MESSAGE],
          buildContext('ws-1'),
        );
        expect(result).toEqual([]);
      }
    });

    it('preserves other AI validation errors when filtering no-llm-provider', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [
          AI_NO_LLM_PROVIDER_MESSAGE,
          'maxTurns must be 0 (unlimited) or a positive integer',
        ],
        buildContext('ws-1'),
      );
      expect(result).toEqual([
        'maxTurns must be 0 (unlimited) or a positive integer',
      ]);
    });

    it('keeps the error when workspaceId is empty string', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext(''),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('keeps the error when __workspaceId is absent from variables', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext(undefined),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
      expect(llm.hasDefaultLlmConfig).not.toHaveBeenCalled();
    });

    it('falls back to original errors when hasDefaultLlmConfig throws (DB error)', async () => {
      llm.hasDefaultLlmConfig.mockRejectedValue(new Error('DB unavailable'));

      const result = await subject().filterAiNoLlmProviderError(
        'ai_agent',
        [AI_NO_LLM_PROVIDER_MESSAGE],
        buildContext('ws-1'),
      );
      expect(result).toEqual([AI_NO_LLM_PROVIDER_MESSAGE]);
    });

    it('caches hasDefaultLlmConfig result on the same context (no N+1)', async () => {
      llm.hasDefaultLlmConfig.mockResolvedValue(true);

      const ctx = buildContext('ws-1');
      for (let i = 0; i < 5; i++) {
        await subject().filterAiNoLlmProviderError(
          'ai_agent',
          [AI_NO_LLM_PROVIDER_MESSAGE],
          ctx,
        );
      }
      expect(llm.hasDefaultLlmConfig).toHaveBeenCalledTimes(1);
    });
  });
});

describe('buildConversationMetaFromResumeState', () => {
  it('exposes turnDebug + ragSources from _resumeState for frontend References / LLM Usage tabs', () => {
    const turnEntry = {
      turnIndex: 1,
      llmCalls: [],
      totalDurationMs: 100,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
    };
    const meta = buildConversationMetaFromResumeState({
      model: 'gpt-4o',
      totalInputTokens: 100,
      totalOutputTokens: 50,
      totalThinkingTokens: 5,
      toolCalls: 1,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragLastDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
      turnDebugHistory: [turnEntry],
    });

    expect(meta).toEqual({
      interactionType: 'ai_conversation',
      model: 'gpt-4o',
      inputTokens: 100,
      outputTokens: 50,
      totalTokens: 150,
      thinkingTokens: 5,
      toolCalls: 1,
      ragSources: [
        { chunkId: 'c1', documentId: 'd1', documentName: 'doc.md', score: 0.9 },
      ],
      ragDiagnostics: {
        attempted: true,
        searchedKbCount: 1,
        queriesUsed: ['q'],
        resultCount: 1,
      },
      turnDebug: [turnEntry],
    });
  });

  it('returns safe defaults when state lacks accumulators (initial waiting before first user message)', () => {
    const meta = buildConversationMetaFromResumeState({ model: 'gpt-4o' });
    expect(meta).toMatchObject({
      interactionType: 'ai_conversation',
      model: 'gpt-4o',
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      thinkingTokens: 0,
      toolCalls: 0,
      ragSources: [],
      turnDebug: [],
    });
    // ragLastDiagnostics 가 없으면 ragDiagnostics 도 undefined — frontend 에서
    // null 가드로 처리.
    expect(meta.ragDiagnostics).toBeUndefined();
  });
});

describe('buildAiMessageDebugFromResumeState', () => {
  // spec/5-system/6-websocket-protocol.md §4.4 — execution.ai_message
  it('extracts llmCalls and durationMs from the last turn entry', () => {
    const lastTurn = {
      turnIndex: 2,
      llmCalls: [
        {
          requestPayload: { messages: [] },
          responsePayload: { content: 'a' },
          durationMs: 100,
        },
        {
          requestPayload: { messages: [] },
          responsePayload: { content: 'b' },
          durationMs: 200,
        },
      ],
      totalDurationMs: 300,
    };
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [
        { turnIndex: 1, llmCalls: [], totalDurationMs: 50 },
        lastTurn,
      ],
    });
    expect(debug).toEqual({
      llmCalls: lastTurn.llmCalls,
      durationMs: 300,
    });
  });

  it('preserves multi-call llm sequence for tool-loop turns', () => {
    const llmCalls = [
      {
        requestPayload: { tool: 1 },
        responsePayload: { content: '' },
        durationMs: 80,
      },
      {
        requestPayload: { tool: 2 },
        responsePayload: { content: '' },
        durationMs: 90,
      },
      {
        requestPayload: { tool: 3 },
        responsePayload: { content: 'final' },
        durationMs: 120,
      },
    ];
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, llmCalls, totalDurationMs: 290 }],
    });
    expect(debug.llmCalls).toEqual(llmCalls);
    expect(debug.llmCalls).toHaveLength(3);
    expect(debug.durationMs).toBe(290);
  });

  it('returns empty object when turnDebugHistory is missing (initial waiting)', () => {
    const debug = buildAiMessageDebugFromResumeState({ model: 'gpt-4o' });
    expect(debug).toEqual({});
  });

  it('returns empty object when turnDebugHistory is an empty array', () => {
    const debug = buildAiMessageDebugFromResumeState({ turnDebugHistory: [] });
    expect(debug).toEqual({});
  });

  it('omits llmCalls field when the last turn entry has none', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, totalDurationMs: 50 }],
    });
    expect(debug.llmCalls).toBeUndefined();
    expect(debug.durationMs).toBe(50);
  });

  it('emits an empty array when the last turn has llmCalls: []', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [{ turnIndex: 1, llmCalls: [], totalDurationMs: 0 }],
    });
    // []는 의도된 값(이번 턴에 LLM 호출이 0건)이므로 보존한다 — undefined와
    // 의미가 다르다.
    expect(debug.llmCalls).toEqual([]);
    expect(debug.durationMs).toBe(0);
  });

  it('drops llmCalls when the field is non-array (defensive against legacy null)', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [
        // Array.isArray rejects null / undefined / non-array values
        { turnIndex: 1, llmCalls: null, totalDurationMs: 50 },
      ],
    });
    expect(debug.llmCalls).toBeUndefined();
    expect(debug.durationMs).toBe(50);
  });

  it('returns empty object when turnDebugHistory is null', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: null,
    });
    expect(debug).toEqual({});
  });

  it('shallow-copies llmCalls so later mutation of resumeState cannot retroactively change a buffered emit', () => {
    const llmCalls = [
      { requestPayload: { a: 1 }, responsePayload: {}, durationMs: 10 },
    ];
    const state = {
      turnDebugHistory: [{ turnIndex: 1, llmCalls, totalDurationMs: 10 }],
    };
    const debug = buildAiMessageDebugFromResumeState(state);
    // simulate the next turn pushing a new call into the source array
    llmCalls.push({
      requestPayload: { b: 2 },
      responsePayload: {},
      durationMs: 20,
    });
    expect(debug.llmCalls).toHaveLength(1);
  });
});
