import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { createEmptyConversationThread } from '../../shared/conversation-thread/conversation-thread.types';
import {
  ExecutionEngineService,
  buildAiMessageDebugFromResumeState,
  buildConversationConfigFromOutput,
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
import { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import { GraphTraversalService } from './graph/graph-traversal.service';
import { NodeHandlerDependenciesProvider } from './handlers/node-handler-dependencies.provider';
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { RagSearchService } from '../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { McpClientService } from '../mcp/mcp-client.service';
import { Cafe24ApiClient } from '../../nodes/integration/cafe24/cafe24-api.client';
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
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import { ContinuationBusService } from './continuation/continuation-bus.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
} from '../../nodes/core/node-handler.interface';
import { mockOutput } from './__test__/mock-output';
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
    execute: jest.fn(async (input: unknown) =>
      mockOutput({
        processed: true,
        input,
      }),
    ),
  };

  // Mock repositories
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEdgeRepo: Record<string, jest.Mock>;
  let mockWorkflowRepo: Record<string, jest.Mock>;
  let mockExecutionNodeLogRepo: Record<string, jest.Mock>;

  beforeEach(async () => {
    const savedExecution: Partial<Execution> = {
      id: executionId,
      workflowId,
      status: ExecutionStatus.PENDING,
      inputData: {},
      startedAt: new Date(),
    };

    mockExecutionRepo = {
      create: jest.fn().mockReturnValue({ ...savedExecution }),
      save: jest.fn().mockImplementation((entity: Partial<Execution>) => {
        return Promise.resolve({ ...savedExecution, ...entity });
      }),
      findOneBy: jest.fn().mockResolvedValue({ ...savedExecution }),
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

    mockExecutionNodeLogRepo = {
      insert: jest.fn().mockResolvedValue({ identifiers: [{ id: '1' }] }),
      find: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionEngineService,
        ExecutionEventEmitter,
        GraphTraversalService,
        NodeHandlerDependenciesProvider,
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
          provide: getRepositoryToken(ExecutionNodeLog),
          useValue: mockExecutionNodeLogRepo,
        },
        {
          // WARN #4 — `updateExecutionStatus(execution, status, linkedNodeExec)`
          // 가 `dataSource.transaction()` 으로 Execution + NodeExecution 두
          // save 를 묶는다. 테스트에서는 in-memory 로 callback 즉시 실행 +
          // manager.save(EntityClass, entity) 를 기존 mock 레포로 라우팅 해
          // 호출 추적을 그대로 유지한다.
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn(
              async (cb: (manager: unknown) => Promise<unknown>) => {
                const manager = {
                  save: jest.fn(async (target: unknown, entity?: unknown) => {
                    // `manager.save(EntityClass, entity)` 형태만 사용.
                    if (target === Execution) {
                      return mockExecutionRepo.save(entity);
                    }
                    if (target === NodeExecution) {
                      return mockNodeExecutionRepo.save(entity);
                    }
                    return entity;
                  }),
                };
                return cb(manager);
              },
            ),
          },
        },
        {
          // 분산 메시지 fan-out 을 in-memory 로 시뮬레이트 — `publish(msg)`
          // 가 같은 메시지를 즉시 등록된 핸들러로 dispatch 한다. 단일
          // 인스턴스 환경에서의 round-trip 동등성을 보장.
          provide: ContinuationBusService,
          useValue: (() => {
            const handlers = new Map<string, (msg: unknown) => void>();
            return {
              on: jest.fn((type: string, handler: (msg: unknown) => void) => {
                handlers.set(type, handler);
              }),
              publish: jest.fn(async (msg: { type: string }) => {
                const h = handlers.get(msg.type);
                if (h) h(msg);
                return 1;
              }),
              acquireLock: jest.fn().mockResolvedValue(true),
              releaseLock: jest.fn().mockResolvedValue(true),
            };
          })(),
        },
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
          provide: Cafe24ApiClient,
          useValue: {
            request: jest.fn(),
          },
        },
        {
          provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
          useValue: {
            add: jest.fn().mockResolvedValue(undefined),
          },
        },
        // Stateless service — use the real implementation so engine hooks
        // (form/button resume) actually mutate the in-context thread, which
        // lets future ConversationThread tests assert side-effects without
        // re-mocking the service.
        ConversationThreadService,
      ],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
    handlerRegistry = module.get<NodeHandlerRegistry>(NodeHandlerRegistry);
    mockWebsocketService = module.get(WebsocketService);
    mockConfigService = module.get(ConfigService);

    // Test module 은 onModuleInit 을 자동 호출하지 않으므로, continuation
    // 핸들러 등록은 명시적으로 트리거한다 (PR-B). 이로써 form / AI 재개
    // 시나리오의 publish → dispatch round-trip 이 단일 인스턴스 mock bus
    // 안에서 정상 동작한다.
    (
      service as unknown as { registerContinuationHandlers: () => void }
    ).registerContinuationHandlers();

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

    // ENG-RC-* — executeInline 경로도 main path 와 동일하게 핸들러에 rawConfig 를
    // 노출해야 한다. Sub-Workflow inline run 이 raw echo 패턴을 따를 수 있도록 보장.
    it('exposes rawConfig in executeInline path (sub-workflow inline run)', async () => {
      const inlineNode: Partial<Node> = {
        id: 'inline-target',
        workflowId,
        type: 'template',
        category: NodeCategory.PRESENTATION,
        label: 'Inline Target',
        config: { content: 'Hello {{ name }}' },
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([inlineNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const captureSpy = jest
        .fn<
          Promise<NodeHandlerOutput>,
          [unknown, Record<string, unknown>, ExecutionContext]
        >()
        .mockResolvedValue(mockOutput({ ok: true }));
      handlerRegistry.register('template', {
        validate: () => ({ valid: true, errors: [] }),
        execute: captureSpy,
      });

      const context = contextService.createContext(executionId, workflowId);
      await service.executeInline(
        workflowId,
        { name: 'Alice' },
        {
          executionId,
          context,
          executedNodes: new Set<string>(),
          recursionDepth: 1,
          parentNodeExecutionId: 'inline-parent',
        },
      );

      expect(captureSpy).toHaveBeenCalledTimes(1);
      const ctxArg = captureSpy.mock.calls[0][2];
      // executeInline 경로에서도 rawConfig 가 주입되어야 함
      expect(ctxArg.rawConfig).toBeDefined();
      expect(ctxArg.rawConfig?.content).toBe('Hello {{ name }}');
    });

    // WARN #17 (Architecture) — sub-workflow 의 trigger 는 manual_trigger 만 허용.
    // 다른 trigger 타입 (webhook/schedule) 이 진입점에 있으면 silent skip 이
    // 아니라 명시적 throw 한다 (spec/4-nodes/2-flow/1-workflow.md 박스 참조).
    it('throws INVALID_SUB_WORKFLOW_TRIGGER when sub-workflow contains non-manual trigger', async () => {
      const subTriggerNode: Partial<Node> = {
        id: 'webhook-trigger-in-sub',
        workflowId,
        type: 'webhook_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Webhook',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([subTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const context = contextService.createContext(executionId, workflowId);

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'parent-x',
          },
        ),
      ).rejects.toThrow(/INVALID_SUB_WORKFLOW_TRIGGER/);
    });

    it('차단: 호출자 workspace 와 sub-workflow workspace 불일치 (W-6)', async () => {
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce({
        id: workflowId,
        workspaceId: 'ws-target',
        name: 'cross-ws-target',
      });
      const context = contextService.createContext(executionId, workflowId);
      context.variables = {
        ...(context.variables ?? {}),
        __workspaceId: 'ws-attacker',
      };

      await expect(
        service.executeInline(
          workflowId,
          {},
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'p',
          },
        ),
      ).rejects.toThrow(/WORKFLOW_FORBIDDEN_WORKSPACE/);
    });

    it('통과: 동일 workspace (W-6)', async () => {
      mockWorkflowRepo.findOneBy.mockResolvedValueOnce({
        id: workflowId,
        workspaceId: 'ws-1',
        name: 'same-ws-target',
      });
      const manualTriggerNode: Partial<Node> = {
        id: 'manual-trigger-same-ws',
        workflowId,
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Manual',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValueOnce([manualTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValueOnce([]);

      const context = contextService.createContext(executionId, workflowId);
      context.variables = {
        ...(context.variables ?? {}),
        __workspaceId: 'ws-1',
      };

      await expect(
        service.executeInline(
          workflowId,
          { x: 1 },
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'p',
          },
        ),
      ).resolves.toBeDefined();
    });

    it('passes manual_trigger through pass-through (input forwarded as output)', async () => {
      const manualTriggerNode: Partial<Node> = {
        id: 'manual-trigger-in-sub',
        workflowId,
        type: 'manual_trigger',
        category: NodeCategory.TRIGGER,
        label: 'Manual',
        config: {},
        isDisabled: false,
      };
      mockNodeRepo.findBy.mockResolvedValue([manualTriggerNode]);
      mockEdgeRepo.findBy.mockResolvedValue([]);

      const context = contextService.createContext(executionId, workflowId);

      // throw 하지 않아야 함 — manual_trigger 는 정상 pass-through.
      // 반환값은 마지막 노드 (= manual_trigger 자체) 의 output 인 입력 그대로.
      await expect(
        service.executeInline(
          workflowId,
          { passed: 'through' },
          {
            executionId,
            context,
            executedNodes: new Set<string>(),
            recursionDepth: 1,
            parentNodeExecutionId: 'parent-y',
          },
        ),
      ).resolves.toEqual({ passed: 'through' });
    });
  });

  // WARN #23 (Testing) — recoverStuckExecutions 가 미테스트 상태였다.
  // WAITING_FOR_INPUT → FAILED 일괄 전환 (단일 atomic UPDATE) 검증.
  // PR-B 추가 — SET NX 분산 lock + startedAt < now()-30분 보수 mark.
  describe('recoverStuckExecutions', () => {
    let updateExecuted: jest.Mock;
    let andWhere: jest.Mock;
    let where: jest.Mock;
    let setMethod: jest.Mock;
    let update: jest.Mock;
    let mockBus: { acquireLock: jest.Mock; releaseLock: jest.Mock };

    beforeEach(() => {
      updateExecuted = jest.fn().mockResolvedValue({ affected: 2 });
      andWhere = jest.fn().mockReturnValue({ execute: updateExecuted });
      where = jest.fn().mockReturnValue({ andWhere });
      setMethod = jest.fn().mockReturnValue({ where });
      update = jest.fn().mockReturnValue({ set: setMethod });
      mockExecutionRepo.createQueryBuilder = jest.fn().mockReturnValue({
        update,
      });
      mockBus = (service as unknown as { continuationBus: typeof mockBus })
        .continuationBus;
      mockBus.acquireLock.mockResolvedValue(true);
      mockBus.releaseLock.mockResolvedValue(true);
    });

    it('SET NX lock 획득 후 stale (>30분) WAITING_FOR_INPUT 만 FAILED 처리', async () => {
      const before = Date.now();
      await (
        service as unknown as { recoverStuckExecutions: () => Promise<void> }
      ).recoverStuckExecutions();

      expect(mockBus.acquireLock).toHaveBeenCalledWith('exec:recover:lock', 60);
      expect(update).toHaveBeenCalled();
      expect(setMethod).toHaveBeenCalled();
      const setArg = setMethod.mock.calls[0][0] as Record<string, unknown>;
      expect(setArg.status).toBe(ExecutionStatus.FAILED);
      expect((setArg.error as { message: string }).message).toContain(
        'server restarted',
      );
      expect(where).toHaveBeenCalledWith('status = :status', {
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      expect(andWhere).toHaveBeenCalledWith(
        'started_at < :threshold',
        expect.objectContaining({ threshold: expect.any(Date) }),
      );
      // threshold 가 호출 시점 - 30분 근처인지 (±몇 초) 검증.
      const arg = (andWhere.mock.calls[0][1] as { threshold: Date }).threshold;
      const expected = before - 30 * 60 * 1000;
      expect(Math.abs(arg.getTime() - expected)).toBeLessThan(5_000);
    });

    it('lock 획득 실패 시 update 를 호출하지 않는다 (다른 인스턴스가 처리 중)', async () => {
      mockBus.acquireLock.mockResolvedValueOnce(false);
      await (
        service as unknown as { recoverStuckExecutions: () => Promise<void> }
      ).recoverStuckExecutions();

      expect(mockBus.acquireLock).toHaveBeenCalledTimes(1);
      expect(update).not.toHaveBeenCalled();
    });

    // ContinuationBusService.publisher 미초기화 race 회귀 방지 — recovery 는
    // onModuleInit 이 아니라 onApplicationBootstrap 에서 실행되어야 한다.
    // 같은 모듈 내 providers 의 onModuleInit 호출 순서가 등록 순서로만
    // 보장되므로, ContinuationBusService 의 publisher 초기화가 끝났음이
    // 보장되는 onApplicationBootstrap 으로 미룬다.
    it('onModuleInit 은 recovery 를 트리거하지 않는다', () => {
      mockBus.acquireLock.mockClear();
      service.onModuleInit();

      expect(mockBus.acquireLock).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });

    it('onApplicationBootstrap 이 recovery 를 트리거하고 lock 을 해제한다', async () => {
      mockBus.acquireLock.mockClear();
      mockBus.releaseLock.mockClear();
      await service.onApplicationBootstrap();

      expect(mockBus.acquireLock).toHaveBeenCalledWith('exec:recover:lock', 60);
      expect(update).toHaveBeenCalled();
      // lock 누수 회귀 가드 — recovery 가 끝나면 반드시 release.
      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });

    // DB 오류 시 lock 누수 방지 검증 — try/finally 의 finally 가 동작해
    // releaseLock 이 호출되어야 한다. 오류 자체는 호출자에게 전파된다.
    it('DB 오류가 발생해도 lock 을 해제하고 오류를 전파한다', async () => {
      updateExecuted.mockRejectedValueOnce(new Error('db down'));
      mockBus.acquireLock.mockResolvedValueOnce(true);
      mockBus.releaseLock.mockClear();

      await expect(
        (
          service as unknown as { recoverStuckExecutions: () => Promise<void> }
        ).recoverStuckExecutions(),
      ).rejects.toThrow('db down');

      expect(mockBus.releaseLock).toHaveBeenCalledWith('exec:recover:lock');
    });
  });

  // PR-B (WARN #15) — 5개 continuation 진입점이 ContinuationBusService.publish
  // 로 fan-out 되는지 + bus 핸들러 등록 시 로컬 Map 의 resolver 가 호출되는지.
  describe('continuation entry points → bus.publish (PR-B)', () => {
    let mockBus: {
      on: jest.Mock;
      publish: jest.Mock;
      acquireLock: jest.Mock;
    };

    beforeEach(() => {
      mockBus = (service as unknown as { continuationBus: typeof mockBus })
        .continuationBus;
      mockBus.publish.mockClear();
    });

    it('continueExecution → bus.publish({type:"continue", payload:formData})', () => {
      service.continueExecution('exec-1', { name: 'Alice' });
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-1',
        payload: { name: 'Alice' },
      });
    });

    it('cancelWaitingExecution → bus.publish({type:"cancel"})', () => {
      service.cancelWaitingExecution('exec-2');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'cancel',
        executionId: 'exec-2',
      });
    });

    it('continueButtonClick → bus.publish({type:"button_click", payload:{buttonId}})', () => {
      service.continueButtonClick('exec-3', 'btn-confirm');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'button_click',
        executionId: 'exec-3',
        payload: { buttonId: 'btn-confirm' },
      });
    });

    it('continueAiConversation → bus.publish({type:"ai_message", payload:{message}})', () => {
      service.continueAiConversation('exec-4', 'hi');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_message',
        executionId: 'exec-4',
        payload: { message: 'hi' },
      });
    });

    it('continueAiConversation 은 10000자 초과 시 throw 하고 publish 하지 않는다', () => {
      const tooLong = 'x'.repeat(10_001);
      expect(() => service.continueAiConversation('exec-5', tooLong)).toThrow(
        /Message exceeds maximum length/,
      );
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('endAiConversation → bus.publish({type:"ai_end_conversation"})', () => {
      service.endAiConversation('exec-6');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_end_conversation',
        executionId: 'exec-6',
      });
    });

    it('등록된 continue 핸들러 — 로컬 Map 키 있으면 resolve, 없으면 silent skip', () => {
      // onModuleInit 이 5개 핸들러를 등록했다. mockBus.on 호출 인자로부터
      // continue 핸들러를 꺼내 직접 호출해 검증.
      const continueCall = mockBus.on.mock.calls.find(
        (c: unknown[]) => c[0] === 'continue',
      );
      expect(continueCall).toBeDefined();
      const handler = continueCall![1] as (msg: unknown) => void;

      const resolveSpy = jest.fn();
      const pendings = (
        service as unknown as {
          pendingContinuations: Map<
            string,
            { nodeId: string; resolve: jest.Mock; reject: jest.Mock }
          >;
        }
      ).pendingContinuations;
      pendings.set('exec-1', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      handler({ type: 'continue', executionId: 'exec-1', payload: { ok: 1 } });
      expect(resolveSpy).toHaveBeenCalledWith({ ok: 1 });
      expect(pendings.has('exec-1')).toBe(false);

      // 키가 없는 메시지 — silent skip.
      handler({
        type: 'continue',
        executionId: 'exec-not-here',
        payload: undefined,
      });
      // 어떤 에러도 던지지 않음. 추가 resolve 도 일어나지 않음 (resolveSpy 횟수 1).
      expect(resolveSpy).toHaveBeenCalledTimes(1);
    });

    const findHandler = (type: string): ((msg: unknown) => void) => {
      const call = mockBus.on.mock.calls.find((c: unknown[]) => c[0] === type);
      expect(call).toBeDefined();
      return call![1] as (msg: unknown) => void;
    };

    it('cancel 핸들러 — 로컬 Map 키 없으면 silent skip (review W12)', () => {
      const handler = findHandler('cancel');
      const pendings = (
        service as unknown as {
          pendingContinuations: Map<string, unknown>;
        }
      ).pendingContinuations;
      pendings.clear();

      // 미등록 executionId — 어떤 에러도 던지지 않음.
      expect(() =>
        handler({ type: 'cancel', executionId: 'exec-not-here' }),
      ).not.toThrow();
      expect(pendings.size).toBe(0);
    });

    it('button_click 핸들러 — payload 누락 시 buttonId: undefined 로 resolve (review I9)', () => {
      const handler = findHandler('button_click');
      const resolveSpy = jest.fn();
      const pendings = (
        service as unknown as {
          pendingContinuations: Map<
            string,
            { nodeId: string; resolve: jest.Mock; reject: jest.Mock }
          >;
        }
      ).pendingContinuations;
      pendings.set('exec-btn', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      handler({ type: 'button_click', executionId: 'exec-btn' });
      expect(resolveSpy).toHaveBeenCalledWith({
        type: 'button_click',
        buttonId: undefined,
      });
    });

    it('ai_message 핸들러 — 길이 초과 메시지는 silent drop (Redis 직접 publish 우회 방지)', () => {
      const handler = findHandler('ai_message');
      const resolveSpy = jest.fn();
      const pendings = (
        service as unknown as {
          pendingContinuations: Map<
            string,
            { nodeId: string; resolve: jest.Mock; reject: jest.Mock }
          >;
        }
      ).pendingContinuations;
      pendings.set('exec-ai', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      const oversized = 'x'.repeat(10_001);
      handler({
        type: 'ai_message',
        executionId: 'exec-ai',
        payload: { message: oversized },
      });
      expect(resolveSpy).not.toHaveBeenCalled();
      // Map 은 그대로 — 호스트 인스턴스의 다른 정상 메시지를 기다릴 수 있도록.
      expect(pendings.has('exec-ai')).toBe(true);
    });
  });

  // review W11 — appendExecutionPath 의 best-effort catch 경로 검증.
  describe('appendExecutionPath best-effort 동작 (review W11)', () => {
    it('insert 실패 시 logger.warn 호출 후 흐름 중단 없이 계속 진행', async () => {
      const repo = (
        service as unknown as {
          executionNodeLogRepository: { insert: jest.Mock };
        }
      ).executionNodeLogRepository;
      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      repo.insert.mockRejectedValueOnce(new Error('connection refused'));
      await expect(
        (
          service as unknown as {
            appendExecutionPath: (e: string, n: string) => Promise<void>;
          }
        ).appendExecutionPath('exec-flaky', 'node-x'),
      ).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalled();
      const msg = String(warnSpy.mock.calls[0][0]);
      expect(msg).toContain('exec-flaky');
      expect(msg).toContain('node-x');
      warnSpy.mockRestore();
    });
  });

  // CRIT #5 — executeSync / executeAsync 가 Sub-Workflow handler 가 직접
  // 호출하는 public API 임에도 완전 미테스트 상태였다. workflow-not-found,
  // FAILED / CANCELLED 상태 전파, timeout 경로의 최소 커버리지를 확보한다.
  describe('executeSync / executeAsync — Sub-Workflow public API', () => {
    beforeEach(() => {
      // 노드 0개로 단축 — runExecution 이 그래프 순회 없이 빠르게 끝나
      // appendExecutionPath 의 findOneBy 호출이 발생하지 않는다. 본 describe
      // 의 모든 테스트는 executeSync 의 후처리 경로 (status 분기 / timeout 경로)
      // 만 검증하므로 노드 그래프는 무관하다.
      mockNodeRepo.findBy.mockResolvedValue([]);
      mockEdgeRepo.findBy.mockResolvedValue([]);
    });

    describe('executeSync', () => {
      it('throws when workflow does not exist', async () => {
        mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
        await expect(
          service.executeSync('nonexistent-wf', {}, { timeoutMs: 0 }),
        ).rejects.toThrow('Workflow not found: nonexistent-wf');
      });

      // INFO #19 — runExecution 은 savedExecution 참조를 in-place mutation 하므로
      // 테스트는 runExecution 을 spy 하여 in-memory 상태를 직접 set 한다.
      // (이전 패턴은 mockExecutionRepo.findOneBy 로 post-execution 재조회를
      // 가로챘으나, INFO #19 적용으로 success path 의 findOneBy 가 제거됐다.)
      const stubRunExecution = (
        mutator: (execution: Record<string, unknown>) => void,
      ) =>
        jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(async (execution: unknown) => {
            mutator(execution as Record<string, unknown>);
          });

      it('returns SubWorkflowResult shape on COMPLETED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.COMPLETED;
          execution.outputData = { final: 'value' };
        });
        const result = await service.executeSync(
          workflowId,
          { foo: 'bar' },
          { timeoutMs: 0 },
        );
        expect(result.executionId).toBe(executionId);
        expect(result.output).toEqual({ final: 'value' });
        expect(result.status).toBe(ExecutionStatus.COMPLETED);
        spy.mockRestore();
      });

      it('throws when sub-workflow status is FAILED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.FAILED;
          execution.error = { message: 'inner failure' };
        });
        await expect(
          service.executeSync(workflowId, {}, { timeoutMs: 0 }),
        ).rejects.toThrow('Sub-workflow execution failed: inner failure');
        spy.mockRestore();
      });

      it('throws when sub-workflow status is CANCELLED', async () => {
        const spy = stubRunExecution((execution) => {
          execution.status = ExecutionStatus.CANCELLED;
        });
        await expect(
          service.executeSync(workflowId, {}, { timeoutMs: 0 }),
        ).rejects.toThrow('Sub-workflow execution was cancelled');
        spy.mockRestore();
      });

      // CRIT #5 — timeout 경로 보강. graph traversal 이 hang 됐을 때
      // executeSync 가 (1) Promise.race 의 timeout 가지로 reject 되고,
      // (2) 후처리 catch 블록이 reloaded execution 을 FAILED 로 마킹해
      // 영구 stuck 상태가 남지 않는지 확인한다.
      it('times out when runExecution hangs and marks execution FAILED', async () => {
        // runExecution 을 영구 hang 으로 모킹 — 외부 timeout 만 reject 한다.
        const runExecutionSpy = jest
          .spyOn(
            service as unknown as {
              runExecution: (...args: unknown[]) => Promise<unknown>;
            },
            'runExecution',
          )
          .mockImplementation(() => new Promise<unknown>(() => undefined));

        // catch 블록의 reloaded.status 가 RUNNING (즉 COMPLETED/FAILED 가
        // 아닌 상태) 이어야 FAILED 로 전환되는 path 가 검증된다.
        mockExecutionRepo.findOneBy.mockResolvedValueOnce({
          id: executionId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(Date.now() - 100),
        });
        mockExecutionRepo.save.mockClear();

        await expect(
          service.executeSync(workflowId, {}, { timeoutMs: 50 }),
        ).rejects.toThrow(/timed out after 50ms/);

        // catch 블록에서 reloaded 를 FAILED 로 다시 save 한다.
        const failedSaveCall = mockExecutionRepo.save.mock.calls.find(
          ([entity]) =>
            (entity as { status?: ExecutionStatus }).status ===
            ExecutionStatus.FAILED,
        );
        expect(failedSaveCall).toBeDefined();
        const failedEntity = failedSaveCall?.[0] as {
          status: ExecutionStatus;
          error: { message: string };
        };
        expect(failedEntity.error.message).toMatch(/timed out after 50ms/);

        runExecutionSpy.mockRestore();
      });
    });

    describe('executeAsync', () => {
      it('throws when workflow does not exist', async () => {
        mockWorkflowRepo.findOneBy.mockResolvedValueOnce(null);
        await expect(
          service.executeAsync('nonexistent-wf', {}),
        ).rejects.toThrow('Workflow not found: nonexistent-wf');
      });

      it('returns executionId immediately (fire-and-forget)', async () => {
        const result = await service.executeAsync(workflowId, { foo: 'bar' });
        expect(result).toBe(executionId);
      });
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: { foo: 1 },
        variables: { keep: 'me' },
        nodeOutputCache: { 'node-1': { hello: 'world' } },
        expressionContext: { workspaceId: 'ws-1' },
        conversationThread: createEmptyConversationThread(),
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2', 'node-3', 'node-7'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: {},
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
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
        backgroundRunId: 'bg-run-1',
        workspaceId: 'ws-1',
        workflowId,
        bodyEntryNodeIds: ['node-2'],
        input: {},
        variables: {},
        nodeOutputCache: { 'node-1': { from: 'main' } },
        expressionContext: {},
        conversationThread: createEmptyConversationThread(),
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
    // (deriveExecutionTrigger 헬퍼 + spec/2-navigation/14-execution-history.md §2.4).

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
        return mockOutput({ step: calls.length, previousInput: input });
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

      // Check first node completed — payload 가 startedAt (ISO) 도 동봉해야
      // 한다. NODE_STARTED race miss 시에도 frontend store row 의 startedAt
      // 이 누락되지 않도록 NODE_* 모든 이벤트에 startedAt 동봉 (timeline
      // 회귀 hotfix #6).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-1',
        'execution.node.completed',
        expect.objectContaining({
          status: 'completed',
          startedAt: expect.any(String),
        }),
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
      execute: jest.fn(async () =>
        mockOutput({
          type: 'form',
          status: 'waiting_for_input',
          formConfig: {
            fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
            title: 'Approval',
          },
        }),
      ),
    };

    beforeEach(() => {
      // Reset the test_node handler implementation (may have been overridden by previous tests)
      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ processed: true }),
      );
      mockNodeRepo.findBy.mockResolvedValue(formNodes);
      mockEdgeRepo.findBy.mockResolvedValue(formEdges);
      // PR-G — metadata 동봉 등록. 엔진의 dispatch 가 `kind === 'blocking' &&
      // interaction === 'form'` 으로 form 노드를 식별한다.
      handlerRegistry.register('form', formHandler, {
        kind: 'blocking',
        interaction: 'form',
      });
    });

    it('should pause at Form node and emit waiting_for_input event', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // Should emit waiting_for_input event — payload 가 startedAt (ISO) 을
      // 동봉해야 한다. 프론트엔드 store 가 NODE_STARTED race miss 시에도
      // sortByStartedAt 정렬 정합성을 유지하기 위해서 (timeline-ordering
      // bug fix).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.waiting_for_input',
        expect.objectContaining({
          status: 'waiting_for_input',
          waitingNodeId: 'node-form',
          waitingNodeType: 'form',
          startedAt: expect.any(String),
          // Carousel buttons-disabled bug fix (2026-05-09) — 3 waiting emit
          // (Buttons / Form / AI) 모두 top-level interactionType 일관화.
          // frontend handleWaitingForInput 의 첫 fallback 만으로 정확히 분기.
          interactionType: 'form',
        }),
      );

      // End node should NOT have been executed yet (form is blocking)
      expect(mockHandler.execute).toHaveBeenCalledTimes(1); // only start node
    });

    it('persists outputData.meta.interactionType="form" so snapshot reconcile hydrates store correctly', async () => {
      // 페이지 재마운트 시 execution.snapshot reconcile (frontend) 이 이
      // 필드로 store 의 waitingInteractionType 을 set. 누락 시 Preview 탭
      // 버튼이 callback 없이 disabled 로 그려지는 회귀 발생 (PR-B Part C).
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      const saveCalls = mockNodeExecutionRepo.save.mock.calls;
      const waitingSave = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as { status?: string })?.status ===
          NodeExecutionStatus.WAITING_FOR_INPUT,
      );
      expect(waitingSave).toBeDefined();
      const persisted = (waitingSave as unknown[])[0] as {
        outputData?: { meta?: { interactionType?: string } };
      };
      expect(persisted.outputData?.meta?.interactionType).toBe('form');
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

    // Engine hook (spec/conventions/conversation-thread.md §2.1) — form resume
    // must push a presentation_user turn to the
    // ConversationThread so downstream AI Agent nodes can auto-inject it.
    // SoT: spec/conventions/conversation-thread.md §2.1.
    //
    // We assert via spy because the engine deletes the ExecutionContext when
    // the workflow completes (this test runs the form to terminal state).
    // Spying captures the hook's call args at the exact resume tick.
    it('appends presentation_user turn to ConversationThread on form resume', async () => {
      const conversationThreadService = (
        service as unknown as {
          conversationThreadService: ConversationThreadService;
        }
      ).conversationThreadService;
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.execute(workflowId, { data: 'test' });
      await flushPromises();
      service.continueExecution(executionId, { approved: true });
      await flushPromises();

      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          node: expect.objectContaining({
            id: 'node-form',
            type: 'form',
          }),
          interaction: expect.objectContaining({
            type: 'form_submitted',
            data: { approved: true },
            receivedAt: expect.any(String),
          }),
        }),
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

    it('should silently skip continueExecution without local pending continuation (multi-instance safe)', () => {
      // PR-B — 다중 인스턴스에서 다른 인스턴스가 호스팅 중일 수 있으므로
      // "No pending continuation" 즉시 throw 는 폐기됐다. publish 만 수행하고
      // 키가 있는 인스턴스만 실제 resolve 한다.
      expect(() => service.continueExecution('non-existent', {})).not.toThrow();
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

    it('should silently skip continueAiConversation without local pending continuation (multi-instance safe)', () => {
      // PR-B — 위와 동일 사유. publish 만 수행하고 silent skip.
      expect(() =>
        service.continueAiConversation('non-existent', 'hello'),
      ).not.toThrow();
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

  describe('Button (Carousel) node blocking', () => {
    // Mirror of "Form node blocking" (above) for the button-resume path.
    // Verifies the engine hook (spec/conventions/conversation-thread.md §2.1)
    // pushes a presentation_user turn to ConversationThread when the user
    // clicks a port-typed button on a Carousel/Table/Chart/Template node.
    const carouselNodes: Partial<Node>[] = [
      {
        id: 'node-start',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        config: {},
        positionX: 0,
        positionY: 0,
        label: 'start',
        isDisabled: false,
      },
      {
        id: 'node-carousel',
        workflowId,
        type: 'carousel',
        category: NodeCategory.PRESENTATION,
        config: {},
        positionX: 100,
        positionY: 0,
        label: 'carousel',
        isDisabled: false,
      },
      {
        id: 'node-end',
        workflowId,
        type: 'test_node',
        category: NodeCategory.LOGIC,
        config: {},
        positionX: 200,
        positionY: 0,
        label: 'end',
        isDisabled: false,
      },
    ];

    const carouselEdges: Partial<Edge>[] = [
      {
        id: 'edge-1',
        workflowId,
        sourceNodeId: 'node-start',
        sourcePort: 'out',
        targetNodeId: 'node-carousel',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
      // Button-typed dynamic port — sourcePort matches button.id so engine
      // routes to `node-end` on click.
      {
        id: 'edge-2',
        workflowId,
        sourceNodeId: 'node-carousel',
        sourcePort: 'btn-1',
        targetNodeId: 'node-end',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    const carouselHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () =>
        mockOutput(
          {
            // Engine reads buttonConfig from nodeOutputCache as fallback —
            // mockOutput puts the value here so waitForButtonInteraction
            // can pick it up via the flat path.
            buttonConfig: {
              buttons: [
                {
                  id: 'btn-1',
                  label: 'Approve',
                  type: 'port' as const,
                  style: 'primary' as const,
                },
              ],
            },
            items: [],
          },
          {
            status: 'waiting_for_input',
            // getInteractionType() reads `meta.interactionType` first.
            // Without this the engine falls through neither the form nor
            // button branch and runs to completion immediately.
            meta: { interactionType: 'buttons' },
          },
        ),
      ),
    };

    beforeEach(() => {
      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ processed: true }),
      );
      mockNodeRepo.findBy.mockResolvedValue(carouselNodes);
      mockEdgeRepo.findBy.mockResolvedValue(carouselEdges);
      handlerRegistry.register('carousel', carouselHandler, {
        kind: 'blocking',
        interaction: 'buttons',
      });
    });

    it('appends presentation_user turn (button_click) to ConversationThread on resume', async () => {
      const conversationThreadService = (
        service as unknown as {
          conversationThreadService: ConversationThreadService;
        }
      ).conversationThreadService;
      const appendSpy = jest.spyOn(
        conversationThreadService,
        'appendPresentationInteraction',
      );

      await service.execute(workflowId, { data: 'test' });
      await flushPromises();
      service.continueButtonClick(executionId, 'btn-1');
      await flushPromises();

      expect(appendSpy).toHaveBeenCalledTimes(1);
      expect(appendSpy).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          node: expect.objectContaining({
            id: 'node-carousel',
            type: 'carousel',
          }),
          interaction: expect.objectContaining({
            type: 'button_click',
            data: expect.objectContaining({
              buttonId: 'btn-1',
              buttonLabel: 'Approve',
            }),
            receivedAt: expect.any(String),
          }),
        }),
      );
    });

    it('emits waiting_for_input with interactionType="buttons" + thread snapshot', async () => {
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.waiting_for_input',
        expect.objectContaining({
          waitingNodeId: 'node-carousel',
          waitingNodeType: 'carousel',
          interactionType: 'buttons',
          // Thread snapshot is included for live UI updates (spec §4.4.5).
          conversationThread: expect.objectContaining({
            id: 'default',
            turns: expect.any(Array),
          }),
        }),
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
      // Sub-Workflow nesting 에서 같은 nodeId 의 AI Agent 가 여러 row 일 수
      // 있으므로 nodeExecutionId 동봉 필수 (timeline 회귀 점검 #2).
      expect(payload).toHaveProperty('nodeExecutionId');
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

    // WARN #21 — endAiConversation 종료 흐름 전체 테스트.
    //
    // 시나리오:
    //  1. AI handler 가 첫 turn 에서 `waiting_for_input` 으로 진입
    //  2. 사용자가 endAiConversation 호출 → bus 가 `ai_end_conversation` publish
    //  3. continuation handler 가 pending Promise 를 'end' 로 resolve
    //  4. 엔진이 handler.endMultiTurnConversation() 호출 → `ended` status + port
    //  5. NodeExecution 가 COMPLETED 로 finalize, EXECUTION_COMPLETED emit
    //
    // 회귀 위험: PR-H 의 waitForAiConversation 분해 시 본 흐름이 깨지면
    // 사용자가 대화를 종료할 수 없게 된다 — 이 테스트가 안전망 역할.
    it('end-to-end: endAiConversation drives handler.endMultiTurnConversation and finalizes node + execution', async () => {
      const handler = makeAiAgentHandler(() => ({
        // unused — endAiConversation path skips processMultiTurnMessage
        config: { mode: 'multi_turn' },
        output: {},
        meta: {},
        port: 'ended',
        status: 'ended',
      }));
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();

      // waiting state 진입 확인
      const waitingCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) =>
            call[1] === 'execution.waiting_for_input' &&
            (call[2] as { waitingNodeId?: string })?.waitingNodeId ===
              'node-agent',
        );
      expect(waitingCalls.length).toBeGreaterThanOrEqual(1);

      // Carousel buttons-disabled bug fix (2026-05-09) — 3 waiting emit
      // (Buttons / Form / AI) 모두 top-level interactionType 일관화.
      // AI 의 nested interactionType 은 backward compat 으로 유지.
      const aiWaitingPayload = waitingCalls[0]?.[2] as Record<string, unknown>;
      expect(aiWaitingPayload).toMatchObject({
        interactionType: 'ai_conversation',
      });
      expect(
        (aiWaitingPayload?.nodeOutput as Record<string, unknown> | undefined)
          ?.interactionType,
      ).toBe('ai_conversation');

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();

      // 사용자 종료
      service.endAiConversation(executionId);
      await flushPromises();

      // (a) handler.endMultiTurnConversation 호출됨
      expect(handler.endMultiTurnConversation).toHaveBeenCalledTimes(1);
      // (b) processMultiTurnMessage 는 호출되지 않음 — end path 는 별도 경로
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();

      // (c) NODE_COMPLETED 가 ai_agent 노드에 대해 emit
      const nodeCompletedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) => call[2] === 'execution.node.completed',
        );
      expect(nodeCompletedCalls.length).toBeGreaterThanOrEqual(1);
      const completedNodeIds = nodeCompletedCalls.map(
        (call) => (call as unknown[])[1] as string,
      );
      expect(completedNodeIds).toContain('node-agent');

      // (d) EXECUTION_COMPLETED 가 emit (단일 노드 워크플로우라 종료까지 흐름)
      const executionCompletedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.completed',
        );
      expect(executionCompletedCalls.length).toBeGreaterThanOrEqual(1);
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
        execute: jest
          .fn()
          .mockResolvedValue(mockOutput({ name: 'Alice', greeting: 'Hi' })),
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

      // INFO #15 — `(service as any)` 패턴 제거. 같은 file 의 다른 spy 들과 동일한
      // `as unknown as { ... }` 형태로 통일 (private 멤버 접근의 안전한 캐스팅).
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
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
        execute: jest.fn().mockResolvedValue(mockOutput(['a', 'b', 'c'])),
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
        execute: jest.fn().mockResolvedValue(
          mockOutput({
            $var: { token: 'overridden' },
            name: 'Bob',
          }),
        ),
      };
      handlerRegistry.register('test_node', conflictHandler);

      // INFO #15 — `(service as any)` 패턴 제거. 같은 file 의 다른 spy 들과 동일한
      // `as unknown as { ... }` 형태로 통일 (private 멤버 접근의 안전한 캐스팅).
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
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
      Promise<NodeHandlerOutput>,
      [unknown, Record<string, unknown>, ExecutionContext]
    >;

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue([triggerNode, exprNode]);
      mockEdgeRepo.findBy.mockResolvedValue(rcEdges);

      handlerRegistry.register('test_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest
          .fn()
          .mockResolvedValue(
            mockOutput({ name: 'Alice', greeting: 'Hi there' }),
          ),
      });

      captureSpy = jest
        .fn<
          Promise<NodeHandlerOutput>,
          [unknown, Record<string, unknown>, ExecutionContext]
        >()
        .mockResolvedValue(mockOutput({ ok: true }));
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
        async (_input, _config, ctx: ExecutionContext) => {
          try {
            // Cast away Readonly to simulate misbehaving handler.
            (ctx.rawConfig as Record<string, unknown>).subject = 'hacked';
          } catch (err) {
            mutationError = err;
          }
          return mockOutput({ ok: true });
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

    it('still populates rawConfig when config has no expression placeholders', async () => {
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

      const processSpy = jest.fn<
        Promise<NodeHandlerOutput>,
        [string, Record<string, unknown>]
      >(async () => ({
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
      const stateArg = processSpy.mock.calls[0][1];
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
            return mockOutput({ iteration: 1 }, { port: 'case1' });
          }
          return mockOutput({ iteration: 2 }, { port: 'case2' });
        }),
      };

      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
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
        execute: jest.fn(async () => mockOutput({ value: 'data' })),
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
            return mockOutput({ count: bCallCount }, { port: 'loop' });
          }
          return mockOutput({ count: bCallCount }, { port: 'exit' });
        }),
      };
      const passHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
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
          return mockOutput({ fromA: true, input });
        }),
      };

      let switchCount = 0;
      const switchNodeHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          switchCount++;
          if (switchCount === 1) {
            return mockOutput({ loop: true }, { port: 'case1' });
          }
          return mockOutput({ done: true }, { port: 'case2' });
        }),
      };

      const endHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ end: true, input }),
        ),
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

      (mockHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ ok: true }),
      );
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
        execute: jest.fn(async () =>
          mockOutput({
            port: 'port1',
            data: { routed: true },
          }),
        ),
      };
      const leafHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ received: true, input }),
        ),
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

    // Regression: 5필드 모델 마이그레이션 후, user 의 `output: { data: [array] }`
    // (예: Code 노드가 `return { data: [...] }`) + 명시적 `port` 가 결합되면
    // toEngineFlatShape 가 `{ data: [array], port }` 를 만들고 applyPortSelection
    // 의 legacy `{port, data}` unwrap 이 array 를 spread 해 next input 이
    // `{0: ..., 1: ..., _selectedPort}` 로 깨졌다. 본 테스트는 array data 보존.
    it('should preserve data array key when handler emits { data: [...], port }', async () => {
      const codeStyleHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { code: 'return { data: [...] }' },
          output: {
            data: [
              { label: '1월', value: 450 },
              { label: '2월', value: 520 },
            ],
          },
          port: 'success',
        })),
      };
      const chartStyleHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => mockOutput({ seen: input })),
      };
      handlerRegistry.register('code_style', codeStyleHandler);
      handlerRegistry.register('chart_style', chartStyleHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'node-code',
          workflowId,
          type: 'code_style',
          category: NodeCategory.DATA,
          label: 'Code',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        {
          id: 'node-chart',
          workflowId,
          type: 'chart_style',
          category: NodeCategory.PRESENTATION,
          label: 'Chart',
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-code-chart',
          workflowId,
          sourceNodeId: 'node-code',
          sourcePort: 'success',
          targetNodeId: 'node-chart',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await flushPromises();

      const chartInput = (chartStyleHandler.execute as jest.Mock).mock
        .calls[0][0] as Record<string, unknown>;
      // data 키와 array 가 그대로 보존 — `{0: ..., 1: ...}` spread 안 됨
      expect(chartInput).toEqual({
        data: [
          { label: '1월', value: 450 },
          { label: '2월', value: 520 },
        ],
      });
      expect(Array.isArray(chartInput.data)).toBe(true);
      expect(chartInput).not.toHaveProperty('0');
      expect(chartInput).not.toHaveProperty('_selectedPort');
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
        execute: jest.fn(async (input: unknown) => mockOutput({ seen: input })),
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
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            processed: true,
            input,
          }),
        ),
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
        execute: jest.fn(async () => mockOutput({ triggered: true })),
      };
      const routerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({ port: 'port2', data: { branch: 2 } }),
        ),
      };
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) =>
          mockOutput({ done: true, input }),
        ),
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
      // PR-G — metadata 동봉. 엔진의 dispatch 가 `kind === 'container'` 로
      // 식별하므로 NodeComponentRegistry 부팅을 우회하는 테스트는 직접 명시.
      handlerRegistry.register('foreach', new ForEachHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('loop', new LoopHandler(), {
        kind: 'container',
      });
      handlerRegistry.register('map', new MapHandler(), { kind: 'container' });
    });

    it('executes ForEach body once per item and puts collected results on done port', async () => {
      const bodyCalls: unknown[] = [];
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          bodyCalls.push(input);
          const item = input as Record<string, unknown> | null;
          return mockOutput({ doubled: ((item?.n as number) ?? 0) * 2 });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['foreach'];
            return mockOutput({ received: input });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            items: [{ n: 1 }, { n: 2 }, { n: 3 }],
          }),
        ),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

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
      // Phase 2 (C — spec/4-nodes/1-logic/9-foreach.md §5.2): runtime metric
      // `meta.iterations` exposes the actually executed body count
      // (= output.items.length, including skip-placeholder slots).
      // Principle 2 — meta carries execution metrics, not config echoes.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({ iterations: 3 }),
      );
    });

    it('executes Loop body N times', async () => {
      let counter = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          counter++;
          return mockOutput({ count: counter });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(4);
      // Stage 5: loop finalises as `{ iterations, count }`.
      expect(sinkCalls).toEqual([
        {
          count: 4,
          iterations: [{ count: 1 }, { count: 2 }, { count: 3 }, { count: 4 }],
        },
      ]);
      // Phase 2 (C — spec/4-nodes/1-logic/3-loop.md §5.2): runtime metrics
      // surface on `meta.*` (Principle 2). `iterations` mirrors actual
      // executed reps; `maxIterationsReached=false` since count (4) is
      // well below the default cap (1000). `exitReason='completed'` since
      // no breakCondition fired and the cap wasn't hit.
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 4,
          maxIterationsReached: false,
          exitReason: 'completed',
        }),
      );
    });

    it('flags maxIterationsReached when count equals maxIterations cap', async () => {
      let counter = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          counter++;
          return mockOutput({ count: counter });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
      };
      handlerRegistry.register('source_node', triggerHandler);

      // count === maxIterations: the loop runs every iteration without an
      // early break, so the executor classifies the exit as 'maxIterations'
      // and the engine surfaces `maxIterationsReached: true` alongside
      // `exitReason: 'maxIterations'`.
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
          config: { count: 3, maxIterations: 3 },
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
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          maxIterationsReached: true,
          exitReason: 'maxIterations',
        }),
      );
    });

    it('exits early when breakCondition becomes truthy and reports exitReason="break"', async () => {
      // Asserts: the engine reads the raw `{{ ... }}` breakCondition from
      // node.config (not from the pre-resolved engineResolvedConfig — that
      // would lock $loop.index to 0), and re-evaluates it after every
      // iteration with a fresh expression context. When the predicate
      // returns truthy, LoopExecutor breaks and exitReason flips to 'break'.
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (_input: unknown, _cfg: unknown, ctx) =>
          mockOutput({ index: ctx.loopContext?.index }),
        ),
      };
      handlerRegistry.register('body_node', bodyHandler);

      let capturedLoopStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (_input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            capturedLoopStructured = ctx.structuredOutputCache?.['loop'];
            return mockOutput({ done: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({})),
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
          // count=10 but breakCondition fires once $loop.index >= 2 (i.e.
          // after the 3rd iteration runs and we're checking post-body).
          config: { count: 10, breakCondition: '{{ $loop.index >= 2 }}' },
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
      await flushPromises();

      // breakCondition `$loop.index >= 2` becomes truthy at the END of
      // iteration index=2 (post-body check). So the body runs for indices
      // 0, 1, 2 → 3 invocations, then breaks before index=3.
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      expect(capturedLoopStructured?.meta).toEqual(
        expect.objectContaining({
          iterations: 3,
          maxIterationsReached: false,
          exitReason: 'break',
        }),
      );
    });

    // engine-config-bug — Phase 3 raw-echo 리팩터링 이후 핸들러가 echo 한
    // raw `{{ ... }}` 을 엔진이 컨테이너 동작 파라미터로 다시 읽으면서 깨졌다.
    // 표현식이 evaluated 값으로 컨테이너 동작에 도달하면서, 동시에 raw echo 가
    // 후속 expression 노드의 `$node["loop"].config.*` 에 보존되는지 검증.
    describe('engine-config-bug — Loop count expression handling', () => {
      const buildLoopNodes = (countConfig: unknown): Partial<Node>[] => [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
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
          config: { count: countConfig },
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

      const loopEdges: Partial<Edge>[] = [
        {
          id: 'e-src-loop',
          workflowId,
          sourceNodeId: 'src',
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
          id: 'e-body-emit',
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

      let bodyCount = 0;
      let bodyHandler: NodeHandler;
      let sinkCalls: unknown[];
      let sinkHandler: NodeHandler;
      let triggerHandler: NodeHandler;

      beforeEach(() => {
        bodyCount = 0;
        bodyHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => {
            bodyCount++;
            return mockOutput({ iter: bodyCount });
          }),
        };
        handlerRegistry.register('body_node', bodyHandler);

        sinkCalls = [];
        sinkHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async (input: unknown) => {
            sinkCalls.push(input);
            return mockOutput({ ok: true });
          }),
        };
        handlerRegistry.register('sink_node', sinkHandler);

        triggerHandler = {
          validate: () => ({ valid: true, errors: [] }),
          execute: jest.fn(async () => mockOutput({ n: 3 })),
        };
        handlerRegistry.register('source_node', triggerHandler);
      });

      it('iterates N times when count is a pure expression literal {{3}}', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('{{3}}'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
        expect(sinkCalls).toEqual([
          {
            count: 3,
            iterations: [{ iter: 1 }, { iter: 2 }, { iter: 3 }],
          },
        ]);
      });

      it('iterates per upstream output when count references a node expression', async () => {
        mockNodeRepo.findBy.mockResolvedValue(
          buildLoopNodes('{{ $node["src"].output.n }}'),
        );
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        // src returns { n: 3 } → loop count expression resolves to 3
        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      });

      it('preserves raw echo on $node["loop"].config (Phase 3 Principle 7 invariant)', async () => {
        let capturedEchoCount: unknown = 'NOT_CAPTURED';
        let capturedEngineCount: unknown = 'NOT_CAPTURED';
        // Inspect from within the sink handler — the engine deletes the
        // execution context in a `finally` block after run completion, so
        // post-await getContext() returns undefined. Sinks run after the
        // loop's final setStructuredOutput, giving us the post-iteration view.
        sinkHandler.execute = jest.fn(
          async (_input: unknown, _config: unknown, ctx: ExecutionContext) => {
            capturedEchoCount =
              ctx.structuredOutputCache?.['loop']?.config?.count;
            capturedEngineCount =
              ctx.engineResolvedConfigCache?.['loop']?.count;
            return mockOutput({ ok: true });
          },
        );
        handlerRegistry.register('sink_node', sinkHandler);

        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('{{3}}'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
        // Echo channel keeps the raw `{{3}}` template (Phase 3 Principle 7).
        expect(capturedEchoCount).toBe('{{3}}');
        // Engine-side cache holds the evaluated value (drives iteration).
        expect(capturedEngineCount).toBe(3);
      });

      it('still works for legacy literal-number config (no regression)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes(2));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(2);
      });

      it('still works for legacy numeric-string config "3" (schema accepts it)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes('3'));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      });

      // Behavioural change vs. pre-fix engine: previously
      // `Number(undefined ?? 0)` silently produced 0 iterations. coerce
      // helpers now throw INVALID_CONTAINER_PARAM so misconfigured nodes
      // surface loudly instead of finishing as no-ops. Schema-level
      // `loop:no-count` warning catches this at design time; the throw is
      // the runtime safety net.
      it('throws INVALID_CONTAINER_PARAM when count is undefined (intentional loud failure)', async () => {
        mockNodeRepo.findBy.mockResolvedValue(buildLoopNodes(undefined));
        mockEdgeRepo.findBy.mockResolvedValue(loopEdges);

        await service.execute(workflowId, {});
        await flushPromises();

        // Body never iterates and the execution lands in FAILED status.
        expect(bodyHandler.execute).not.toHaveBeenCalled();
        expect(mockExecutionRepo.save).toHaveBeenCalledWith(
          expect.objectContaining({ status: ExecutionStatus.FAILED }),
        );
      });
    });

    it('produces empty array when ForEach array is empty', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['foreach'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [] })),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

      expect(bodyHandler.execute).not.toHaveBeenCalled();
      // Stage 5: empty foreach still emits the `{ items, count }` envelope.
      expect(sinkCalls[0]).toEqual({ count: 0, items: [] });
      // Phase 2 (C): meta.iterations reflects 0 body executions for empty input.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({ iterations: 0 }),
      );
    });

    // engine-config-bug — Phase 3 raw-echo refactor에서 foreach 핸들러는
    // arrayField 만 echo 했고, 엔진은 structured.config 에서 errorPolicy 를
    // 읽어 항상 'stop' 으로 default fallback 됐다 (사용자 설정 무시). PR-2 의
    // engineResolvedConfigCache 분리 + PR-4 의 coerceErrorPolicy 가드로
    // 이제 사용자 설정이 실제로 동작에 반영된다.
    it('engine-config-bug — respects ForEach errorPolicy="skip" set on node.config', async () => {
      let bodyCalls = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          // Throw on the second item only — verifies skip handler captures
          // and continues to the third instead of aborting (which would be
          // the stop policy's behaviour).
          if (bodyCalls === 2) {
            throw new Error('boom');
          }
          return mockOutput({ ok: bodyCalls });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['fe'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2, 3] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'fe',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'fe',
          config: { arrayField: 'items', errorPolicy: 'skip' },
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
          containerId: 'fe',
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
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'fe',
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
          targetNodeId: 'fe',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await flushPromises();

      // Body called for all 3 items — second one threw, but skip continued.
      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      // Phase 1 (D — spec/4-nodes/1-logic/9-foreach.md §5.3): foreach now
      // separates skipped iterations into `output.skipped[]` and leaves a
      // `null` placeholder in `output.items[index]` so success/skip slots
      // still line up with the input array index.
      expect(sinkCalls).toHaveLength(1);
      const sinkPayload = sinkCalls[0] as {
        items: unknown[];
        skipped?: Array<{
          index: number;
          error: { code: string; message: string };
        }>;
      };
      expect(sinkPayload.items).toHaveLength(3);
      expect(sinkPayload.items[0]).toEqual({ ok: 1 });
      expect(sinkPayload.items[1]).toBeNull();
      expect(sinkPayload.items[2]).toEqual({ ok: 3 });
      expect(sinkPayload.skipped).toEqual([
        { index: 1, error: { code: 'Error', message: 'boom' } },
      ]);
      // Phase 2 (C — spec/4-nodes/1-logic/9-foreach.md §5.2): meta.iterations
      // counts every body launch (skip placeholder slots included), so the
      // metric matches `output.items.length`. `meta.skippedCount` (Phase 1 D)
      // continues to mirror `output.skipped.length`.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({ iterations: 3, skippedCount: 1 }),
      );
    });

    // Companion case for `errorPolicy: 'continue'` — same observable
    // behaviour as 'skip' in the executor (collect skipped placeholder,
    // proceed to next iteration). Guards against future divergence between
    // the two policies after the engineResolvedConfigCache fix.
    it('engine-config-bug — respects ForEach errorPolicy="continue" set on node.config', async () => {
      let bodyCalls = 0;
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          bodyCalls++;
          if (bodyCalls === 2) throw new Error('boom');
          return mockOutput({ ok: bodyCalls });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      let capturedForeachStructured:
        | {
            config?: unknown;
            output?: unknown;
            meta?: Record<string, unknown>;
          }
        | undefined;
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (input: unknown, _cfg: unknown, ctx: ExecutionContext) => {
            sinkCalls.push(input);
            capturedForeachStructured = ctx.structuredOutputCache?.['fe'];
            return mockOutput({ ok: true });
          },
        ),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2, 3] })),
      };
      handlerRegistry.register('source_node', triggerHandler);

      const nodes: Partial<Node>[] = [
        {
          id: 'src',
          workflowId,
          type: 'source_node',
          category: NodeCategory.TRIGGER,
          label: 'src',
          config: {},
          isDisabled: false,
          containerId: null,
          toolOwnerId: null,
        },
        {
          id: 'fe',
          workflowId,
          type: 'foreach',
          category: NodeCategory.LOGIC,
          label: 'fe',
          config: { arrayField: 'items', errorPolicy: 'continue' },
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
          containerId: 'fe',
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
          sourceNodeId: 'src',
          sourcePort: 'out',
          targetNodeId: 'fe',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-body',
          workflowId,
          sourceNodeId: 'fe',
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
          targetNodeId: 'fe',
          targetPort: 'emit',
          type: EdgeType.DATA,
        },
        {
          id: 'e-fe-sink',
          workflowId,
          sourceNodeId: 'fe',
          sourcePort: 'done',
          targetNodeId: 'sink',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, {});
      await flushPromises();

      expect(bodyHandler.execute).toHaveBeenCalledTimes(3);
      // Phase 1 (D): same separation contract as `errorPolicy: 'skip'` —
      // skipped slot becomes `null` in `output.items` and detail moves to
      // `output.skipped[]`.
      const sinkPayload = sinkCalls[0] as {
        items: unknown[];
        skipped?: Array<{
          index: number;
          error: { code: string; message: string };
        }>;
      };
      expect(sinkPayload.items).toHaveLength(3);
      expect(sinkPayload.items[1]).toBeNull();
      expect(sinkPayload.skipped).toEqual([
        { index: 1, error: { code: 'Error', message: 'boom' } },
      ]);
      // Phase 2 (C): same meta contract as `errorPolicy: 'skip'` — iterations
      // counts every launched body (3) and skippedCount mirrors skipped.length.
      expect(capturedForeachStructured?.meta).toEqual(
        expect.objectContaining({ iterations: 3, skippedCount: 1 }),
      );
    });

    it('fails execution when container has no emit edge', async () => {
      const bodyHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1, 2] })),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

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
        execute: jest.fn(async () => mockOutput({ ran: true })),
      };
      handlerRegistry.register('body_node', bodyHandler);
      handlerRegistry.register('body_node_2', bodyHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ items: [1] })),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

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
          return mockOutput({ squared: n * n });
        }),
      };
      handlerRegistry.register('body_node', bodyHandler);

      const sinkCalls: unknown[] = [];
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          sinkCalls.push(input);
          return mockOutput({ received: input });
        }),
      };
      handlerRegistry.register('sink_node', sinkHandler);

      const triggerHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            items: [{ n: 2 }, { n: 3 }, { n: 4 }],
          }),
        ),
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
      // WARN #24 — `setTimeout(r, 200)` 의 timing 의존성을 제거. flushPromises
      // 는 setImmediate 로 microtask + I/O 큐를 1 tick drain 한다.
      await flushPromises();

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
          return mockOutput({ branchOutput: true, input });
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

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
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
        execute: jest.fn(async (input: unknown) =>
          mockOutput({
            branchResult: true,
            fromInput: input,
          }),
        ),
      };
      const sinkHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async (input: unknown) => {
          doneReceived.push(input);
          return mockOutput({ sink: true });
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

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
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

    // engine-config-bug — Parallel 의 typeof number 가드는 raw 표현식 문자열을
    // 받으면 false 가 되어 silent default fallback (branchCount=2) 으로
    // 떨어졌다. engineResolvedConfigCache 도입 이후 expression 입력이 evaluated
    // 값으로 컨테이너 동작에 도달해야 한다.
    it('engine-config-bug — uses evaluated branchCount when input is expression {{N}}', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

      const branchCalls: number[] = [];
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          branchCalls.push(branchCalls.length);
          return mockOutput({ ok: true });
        }),
      };
      // Use a handler that echoes raw branchCount (mirrors the real
      // ParallelHandler's Phase 3 raw-echo) so the bug surface is exercised.
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (
            input: unknown,
            config: Record<string, unknown>,
            context: ExecutionContext,
          ) => {
            const branchCount =
              typeof config.branchCount === 'number' ? config.branchCount : 2;
            const ports = Array.from(
              { length: branchCount },
              (_, i) => `branch_${i}`,
            );
            const rawConfig = context.rawConfig ?? config;
            return {
              config: {
                branchCount: rawConfig.branchCount,
                maxConcurrency: rawConfig.maxConcurrency,
                waitAll: rawConfig.waitAll,
              },
              output: input,
              port: ports,
            };
          },
        ),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);

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
          label: 'Par',
          config: { branchCount: '{{4}}', maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        ...['a', 'b', 'c', 'd'].map((id) => ({
          id,
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: id.toUpperCase(),
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        })),
      ];

      const edges: Partial<Edge>[] = [
        {
          id: 'e0',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        ...['a', 'b', 'c', 'd'].map((id, i) => ({
          id: `e-par-${id}`,
          workflowId,
          sourceNodeId: 'par',
          sourcePort: `branch_${i}`,
          targetNodeId: id,
          targetPort: 'in',
          type: EdgeType.DATA,
        })),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // 4 branch handler invocations — confirms branchCount={{4}} is
      // resolved to 4 BEFORE the engine's runParallel reads it (would
      // have silently defaulted to 2 prior to the fix).
      expect(branchHandler.execute).toHaveBeenCalledTimes(4);
    });

    // Boundary tests for the [PARALLEL_BRANCH_COUNT_MIN, MAX] clamp:
    // values below 2 round up, values above 16 round down. The clamp lives
    // in both the handler (port count = ports.length) and the engine
    // (runParallel branchCount); we exercise the engine path here.
    it('engine-config-bug — clamps branchCount expression to [2, 16] inclusive', async () => {
      mockConfigService.get.mockImplementation(
        (key: string, defaultValue?: unknown) => {
          if (key === 'PARALLEL_ENGINE') return 'v1';
          if (key === 'MAX_NODE_ITERATIONS') return 100;
          return defaultValue;
        },
      );

      // Force the handler to honour the engine clamp by always returning
      // 16 ports (it derives `ports.length` from `branchCount` clamped to
      // 2-16 itself), then assert the engine's view matches.
      const branchHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      };
      const parallelHandler: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(
          async (
            input: unknown,
            config: Record<string, unknown>,
            context: ExecutionContext,
          ) => {
            const raw = Number(config.branchCount);
            const clamped = Math.max(2, Math.min(16, Math.floor(raw)));
            const ports = Array.from(
              { length: clamped },
              (_, i) => `branch_${i}`,
            );
            const rawConfig = context.rawConfig ?? config;
            return {
              config: { branchCount: rawConfig.branchCount },
              output: input,
              port: ports,
            };
          },
        ),
      };

      // PR-G — metadata 동봉 (kind: 'parallel') 으로 dispatch 식별.
      handlerRegistry.register('parallel', parallelHandler, {
        kind: 'parallel',
      });
      handlerRegistry.register('branch_node', branchHandler);

      // {{20}} should clamp to 16 — wire 16 branches.
      const branchIds = Array.from({ length: 16 }, (_, i) => `b${i}`);
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
          label: 'Par',
          config: { branchCount: '{{20}}', maxConcurrency: 0, waitAll: true },
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        },
        ...branchIds.map((id) => ({
          id,
          workflowId,
          type: 'branch_node',
          category: NodeCategory.LOGIC,
          label: id,
          config: {},
          isDisabled: false,
          containerId: undefined,
          toolOwnerId: undefined,
        })),
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-trig-par',
          workflowId,
          sourceNodeId: 'trigger',
          sourcePort: 'out',
          targetNodeId: 'par',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
        ...branchIds.map((id, i) => ({
          id: `e-par-${id}`,
          workflowId,
          sourceNodeId: 'par',
          sourcePort: `branch_${i}`,
          targetNodeId: id,
          targetPort: 'in',
          type: EdgeType.DATA,
        })),
      ];

      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);

      await service.execute(workflowId, { start: true });
      await flushPromises();

      // 16 branches actually fired (clamp upper bound respected).
      expect(branchHandler.execute).toHaveBeenCalledTimes(16);
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
});

// WARN #22 — 단위 테스트 신설.
//
// `buildConversationConfigFromOutput` 은 핸들러 출력 (handler 의 raw output)
// 을 WS `execution.waiting_for_input` payload 의 `conversationConfig` 으로
// 변환한다. spec/5-system/4-execution-engine.md §1.3 의 multi-turn 컨트랙트
// 일부로, system 메시지 필터링 / partial 필드 선택적 전파 등 비자명한 변환을
// 포함한다.
describe('buildConversationConfigFromOutput', () => {
  it('returns defaults when output is undefined', () => {
    const conv = buildConversationConfigFromOutput(undefined);
    expect(conv).toEqual({
      message: '',
      turnCount: 0,
      messages: [],
    });
  });

  it('returns defaults when output is empty', () => {
    const conv = buildConversationConfigFromOutput({});
    expect(conv).toEqual({
      message: '',
      turnCount: 0,
      messages: [],
    });
  });

  it('echoes message and turnCount from output', () => {
    const conv = buildConversationConfigFromOutput({
      message: 'hello',
      turnCount: 3,
    });
    expect(conv.message).toBe('hello');
    expect(conv.turnCount).toBe(3);
  });

  it('filters system role messages (CONVENTIONS — system 메시지는 client 미노출)', () => {
    const conv = buildConversationConfigFromOutput({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'hi' },
        { role: 'assistant', content: 'hello' },
        { role: 'system', content: 'reset' },
      ],
    });
    // Each non-system message gets `source: 'live'` backfilled per
    // spec/5-system/6-websocket-protocol.md §4.4.6 (default when handler
    // didn't tag the push site explicitly).
    expect(conv.messages).toEqual([
      { role: 'user', content: 'hi', source: 'live' },
      { role: 'assistant', content: 'hello', source: 'live' },
    ]);
  });

  it("preserves explicit source: 'injected' from ConversationThread injection (§4.4.6)", () => {
    const conv = buildConversationConfigFromOutput({
      messages: [
        { role: 'system', content: 'You are helpful' },
        {
          role: 'user',
          content: '[from Template] start',
          source: 'injected',
        },
        { role: 'user', content: 'live message', source: 'live' },
        { role: 'assistant', content: 'response' }, // unmarked → backfilled
      ],
    });
    expect(conv.messages).toEqual([
      {
        role: 'user',
        content: '[from Template] start',
        source: 'injected',
      },
      { role: 'user', content: 'live message', source: 'live' },
      { role: 'assistant', content: 'response', source: 'live' },
    ]);
  });

  it("preserves existing source: 'live' as-is (no double-wrap)", () => {
    const original = { role: 'user', content: 'hi', source: 'live' };
    const conv = buildConversationConfigFromOutput({
      messages: [original],
    });
    // Backfill must short-circuit on already-marked items so identity is
    // preserved (no needless object allocations on hot paths).
    expect(conv.messages[0]).toBe(original);
  });

  it('returns empty messages array unchanged', () => {
    const conv = buildConversationConfigFromOutput({ messages: [] });
    expect(conv.messages).toEqual([]);
  });

  it('handles a multi-turn mixed sequence (system stripped, injected preserved, live backfilled)', () => {
    const conv = buildConversationConfigFromOutput({
      messages: [
        { role: 'system', content: 'You are helpful' },
        {
          role: 'user',
          content: '[from Form] name=Alice',
          source: 'injected',
        },
        {
          role: 'assistant',
          content: '[from PrevAgent] Welcome',
          source: 'injected',
        },
        { role: 'user', content: '실제 메시지' },
        { role: 'assistant', content: '응답' },
      ],
    });
    expect(conv.messages).toHaveLength(4);
    expect(conv.messages[0].source).toBe('injected');
    expect(conv.messages[1].source).toBe('injected');
    expect(conv.messages[2].source).toBe('live');
    expect(conv.messages[3].source).toBe('live');
  });

  it('includes maxTurns only when present', () => {
    const withMax = buildConversationConfigFromOutput({ maxTurns: 5 });
    expect(withMax.maxTurns).toBe(5);
    const without = buildConversationConfigFromOutput({});
    expect(without).not.toHaveProperty('maxTurns');
  });

  it('propagates partial.extracted / missingFields / collectionRetryCount only when present', () => {
    const conv = buildConversationConfigFromOutput({
      partial: {
        extracted: { name: 'Alice' },
        missingFields: ['email'],
        collectionRetryCount: 2,
      },
    });
    expect(conv.extracted).toEqual({ name: 'Alice' });
    expect(conv.missingFields).toEqual(['email']);
    expect(conv.collectionRetryCount).toBe(2);
  });

  it('omits partial fields when undefined (no key pollution)', () => {
    const conv = buildConversationConfigFromOutput({
      partial: { extracted: { name: 'Bob' } },
    });
    expect(conv.extracted).toEqual({ name: 'Bob' });
    expect(conv).not.toHaveProperty('missingFields');
    expect(conv).not.toHaveProperty('collectionRetryCount');
  });

  it('handles missing partial gracefully', () => {
    const conv = buildConversationConfigFromOutput({ message: 'hi' });
    expect(conv.message).toBe('hi');
    expect(conv).not.toHaveProperty('extracted');
    expect(conv).not.toHaveProperty('missingFields');
  });
});

describe('buildAiMessageDebugFromResumeState — null/mutation guards', () => {
  it('returns empty object when turnDebugHistory is null', () => {
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: null,
    });
    expect(debug).toEqual({});
  });

  it('shallow-copies llmCalls so later mutation of resumeState cannot retroactively change a buffered emit', () => {
    const llmCalls: Array<{
      requestPayload: Record<string, unknown>;
      responsePayload: Record<string, unknown>;
      durationMs: number;
    }> = [{ requestPayload: { a: 1 }, responsePayload: {}, durationMs: 10 }];
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
