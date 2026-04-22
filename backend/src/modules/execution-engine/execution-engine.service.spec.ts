import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { ExecutionEngineService } from './execution-engine.service';
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
import { IntegrationsService } from '../integrations/integrations.service';
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
      containerId: undefined as unknown as string,
      toolOwnerId: undefined as unknown as string,
    },
    {
      id: 'node-2',
      workflowId,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Node 2',
      config: {},
      isDisabled: false,
      containerId: undefined as unknown as string,
      toolOwnerId: undefined as unknown as string,
    },
    {
      id: 'node-3',
      workflowId,
      type: 'test_node',
      category: NodeCategory.LOGIC,
      label: 'Node 3',
      config: {},
      isDisabled: false,
      containerId: undefined as unknown as string,
      toolOwnerId: undefined as unknown as string,
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
          provide: IntegrationsService,
          useValue: {
            getForExecution: jest.fn(),
            logUsage: jest.fn().mockResolvedValue(undefined),
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
        containerId: undefined as unknown as string,
        toolOwnerId: undefined as unknown as string,
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
        containerId: undefined as unknown as string,
        toolOwnerId: undefined as unknown as string,
      },
      {
        id: 'node-end',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        label: 'End',
        config: {},
        isDisabled: false,
        containerId: undefined as unknown as string,
        toolOwnerId: undefined as unknown as string,
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
        containerId: undefined as unknown as string,
        toolOwnerId: undefined as unknown as string,
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
        containerId: undefined as unknown as string,
        toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-switch',
          workflowId,
          type: 'cyclic_switch',
          category: NodeCategory.LOGIC,
          label: 'Switch',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'cyclic_pass',
          category: NodeCategory.LOGIC,
          label: 'Node C',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'infinite_node',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'loop_switch',
          category: NodeCategory.LOGIC,
          label: 'Node B',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-end',
          workflowId,
          type: 'loop_pass',
          category: NodeCategory.LOGIC,
          label: 'End',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-sw',
          workflowId,
          type: 'switch_input_test',
          category: NodeCategory.LOGIC,
          label: 'SW',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'end_input_test',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'port_leaf',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-recv',
          workflowId,
          type: 'ctl_receiver',
          category: NodeCategory.LOGIC,
          label: 'Recv',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-b',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: true,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'node-c',
          workflowId,
          type: 'reach_pass',
          category: NodeCategory.LOGIC,
          label: 'C',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'router',
          workflowId,
          type: 'iso_router',
          category: NodeCategory.LOGIC,
          label: 'Router',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'x',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'X',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'y',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Y',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'p',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'P',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'q',
          workflowId,
          type: 'iso_branch',
          category: NodeCategory.LOGIC,
          label: 'Q',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'loop',
          workflowId,
          type: 'loop',
          category: NodeCategory.LOGIC,
          label: 'loop',
          config: { count: 4 },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'foreach',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'foreach',
          config: { arrayField: 'items' },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
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
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'map',
          workflowId,
          type: 'map',
          category: NodeCategory.LOGIC,
          label: 'map',
          config: { inputField: 'items' },
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          toolOwnerId: null as unknown as string,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'sink',
          config: {},
          isDisabled: false,
          containerId: null as unknown as string,
          toolOwnerId: null as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'parallel-1',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'branch-a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch A',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'branch-b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'Branch B',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'merge-1',
          workflowId,
          type: 'merge',
          category: NodeCategory.LOGIC,
          label: 'Merge',
          config: { strategy: 'wait_all', outputFormat: 'array' },
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'par',
          workflowId,
          type: 'parallel',
          category: NodeCategory.LOGIC,
          label: 'Parallel',
          config: { branchCount: 2, maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'a',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'A',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'b',
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: 'B',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
        },
        {
          id: 'sink',
          workflowId,
          type: 'sink_node',
          category: NodeCategory.LOGIC,
          label: 'Sink',
          config: {},
          isDisabled: false,
          containerId: undefined as unknown as string,
          toolOwnerId: undefined as unknown as string,
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
});
