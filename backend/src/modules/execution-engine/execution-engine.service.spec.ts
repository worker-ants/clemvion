import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from './handlers/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { ExpressionResolverService } from './expression/expression-resolver.service';
import { WebsocketService } from '../websocket/websocket.service';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { RagSearchService } from '../knowledge-base/search/rag-search.service';
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
import { NodeHandler } from './handlers/node-handler.interface';

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
        ExecutionContextService,
        ErrorPolicyHandler,
        ExpressionResolverService,
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
      ],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
    handlerRegistry = module.get<NodeHandlerRegistry>(NodeHandlerRegistry);
    mockWebsocketService = module.get(WebsocketService);

    // Register mock handler (clear previous calls)
    (mockHandler.execute as jest.Mock).mockClear();
    handlerRegistry.register('test_node', mockHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
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
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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

      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
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
      expect(aInputs[1]).toEqual(
        expect.objectContaining({ loop: true }),
      );
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
});
