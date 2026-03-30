import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from './handlers/node-handler.registry';
import { ExecutionContextService } from './context/execution-context.service';
import { ErrorPolicyHandler } from './error/error-policy.handler';
import { WebsocketService } from '../websocket/websocket.service';
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

describe('ExecutionEngineService', () => {
  let service: ExecutionEngineService;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: { emitExecutionEvent: jest.Mock; emitNodeEvent: jest.Mock };

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
      ],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
    handlerRegistry = module.get<NodeHandlerRegistry>(NodeHandlerRegistry);
    mockWebsocketService = module.get(WebsocketService);

    // Register mock handler
    handlerRegistry.register('test_node', mockHandler);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should execute a simple linear workflow with 3 nodes', async () => {
    const result = await service.execute(workflowId, { data: 'test' });

    expect(result).toBe(executionId);

    // Workflow should be looked up
    expect(mockWorkflowRepo.findOneBy).toHaveBeenCalledWith({ id: workflowId });

    // Execution should be created
    expect(mockExecutionRepo.create).toHaveBeenCalled();
    expect(mockExecutionRepo.save).toHaveBeenCalled();

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

  it('should throw if handler not registered', async () => {
    const customNodes = mockNodes.map((n) => ({ ...n, type: 'unknown_type' }));
    mockNodeRepo.findBy.mockResolvedValue(customNodes);

    await expect(service.execute(workflowId)).rejects.toThrow(
      'UNKNOWN_NODE_TYPE',
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

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.started',
        expect.objectContaining({ status: 'running' }),
      );
    });

    it('should emit EXECUTION_COMPLETED event after successful execution', async () => {
      await service.execute(workflowId, { data: 'test' });

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({ status: 'completed' }),
      );
    });

    it('should emit NODE_STARTED and NODE_COMPLETED for each node', async () => {
      await service.execute(workflowId, { data: 'test' });

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

    it('should emit EXECUTION_FAILED on error', async () => {
      (mockHandler.execute as jest.Mock).mockRejectedValue(new Error('Node execution failed'));

      await expect(service.execute(workflowId)).rejects.toThrow('Node execution failed');

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
});
