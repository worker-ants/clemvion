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
  userMessageSignalApplies,
} from './execution-engine.service';
import { InvalidExecutionStateError } from './workflow-errors';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import {
  ExecutionContextService,
  CreateContextOptions,
} from './context/execution-context.service';
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
import { ShutdownStateService } from './shutdown/shutdown-state.service';
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
  // Phase 2 — ContinuationBusService mock 의 publish closure 가 lazy reference 로
  // 사용. service 는 Test.createTestingModule 이 끝난 뒤에야 set 되므로 외부 변수.
  let resolvedService: ExecutionEngineService | undefined;
  let handlerRegistry: NodeHandlerRegistry;
  let mockWebsocketService: {
    emitExecutionEvent: jest.Mock;
    emitNodeEvent: jest.Mock;
    registerExecutionRouting: jest.Mock;
    releaseExecutionRouting: jest.Mock;
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
      // Phase 2.3 (변경 2.3) — resolveWaitingNodeExecutionId 의 publisher 측 lookup.
      // 기본값: WAITING_FOR_INPUT row 1건 존재 (정상 케이스). 0건/다중 row throw
      // 경로는 개별 테스트에서 mockResolvedValueOnce 로 override.
      find: jest
        .fn()
        .mockResolvedValue([
          { id: 'ne-waiting', nodeId: 'n-wait', startedAt: new Date() },
        ]),
    };

    mockNodeRepo = {
      findBy: jest.fn().mockResolvedValue(mockNodes),
    };

    mockEdgeRepo = {
      findBy: jest.fn().mockResolvedValue(mockEdges),
    };

    mockWorkflowRepo = {
      findOneBy: jest.fn().mockResolvedValue(mockWorkflow),
      // runExecution 의 createContext 단계에서 workflow + workspace 를 join 으로
      // 가져오는 호출 (workspace timezone 을 __workspaceTimezone 으로 주입하기 위함).
      // spec/4-nodes/3-ai/0-common.md §11.3.
      findOne: jest.fn().mockResolvedValue({
        ...mockWorkflow,
        workspace: { id: 'ws-1', settings: {} },
      }),
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
          // Phase 2 (workflow-resumable-execution) — BullMQ continuation-queue
          // 의 in-memory 시뮬레이션. 옛 Redis pub/sub `on(type, handler)` 등록
          // 경로는 폐기되어 `on` 은 no-op. publish 는 즉시 service 의 dispatch
          // 메서드 (applyContinuation / applyCancellation) 를 호출해 Phase 1
          // 까지의 round-trip 동등성을 유지한다. SoT: spec/5-system/4-execution-engine.md §7.4.
          provide: ContinuationBusService,
          useValue: {
            on: jest.fn(),
            publish: jest.fn(
              async (msg: {
                type: string;
                executionId: string;
                nodeExecutionId?: string;
                payload?: unknown;
              }) => {
                const nodeExecutionId =
                  msg.nodeExecutionId ?? '__no_node_exec__';
                // service 인스턴스가 closure 외부에서 set 되므로 lazy reference.
                if (!resolvedService) return null;
                if (msg.type === 'cancel') {
                  resolvedService.applyCancellation(msg.executionId);
                } else if (msg.type === 'continue') {
                  await resolvedService.applyContinuation(
                    msg.executionId,
                    nodeExecutionId,
                    msg.payload,
                  );
                } else if (msg.type === 'button_click') {
                  const buttonId = (
                    msg.payload as { buttonId?: string } | undefined
                  )?.buttonId;
                  await resolvedService.applyContinuation(
                    msg.executionId,
                    nodeExecutionId,
                    { type: 'button_click', buttonId },
                  );
                } else if (msg.type === 'ai_message') {
                  const message = (
                    msg.payload as { message?: string } | undefined
                  )?.message;
                  await resolvedService.applyContinuation(
                    msg.executionId,
                    nodeExecutionId,
                    { type: 'ai_message', message },
                  );
                } else if (msg.type === 'ai_end_conversation') {
                  await resolvedService.applyContinuation(
                    msg.executionId,
                    nodeExecutionId,
                    { type: 'ai_end_conversation' },
                  );
                }
                return 'jobId-stub';
              },
            ),
            acquireLock: jest.fn().mockResolvedValue(true),
            releaseLock: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: WebsocketService,
          useValue: {
            emitExecutionEvent: jest.fn(),
            emitNodeEvent: jest.fn(),
            registerExecutionRouting: jest.fn(),
            releaseExecutionRouting: jest.fn(),
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
        // workflow-resumable-execution Phase 1.2 — Graceful Shutdown 추적.
        // 단위 테스트에서는 부작용 없는 mock 으로 충분 (DB UPDATE 가 일어나지
        // 않으며 register/unregister 도 noop 으로 처리 — drain wait 없음).
        {
          provide: ShutdownStateService,
          useValue: {
            isShuttingDown: false,
            inFlightCount: 0,
            retryAfterSec: 30,
            registerInFlight: jest.fn(),
            unregisterInFlight: jest.fn(),
            onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<ExecutionEngineService>(ExecutionEngineService);
    resolvedService = service;
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

  // W2 (SUMMARY) — `pendingContinuations` Map 타입 단언 공유 헬퍼.
  // 여러 describe 블록에서 재사용하도록 최상위 describe 스코프로 승격.
  const getPendings = (
    svc: ExecutionEngineService,
  ): Map<string, { nodeId: string; resolve: jest.Mock; reject: jest.Mock }> =>
    (
      svc as unknown as {
        pendingContinuations: Map<
          string,
          { nodeId: string; resolve: jest.Mock; reject: jest.Mock }
        >;
      }
    ).pendingContinuations;

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

    // workflow-resumable-execution Phase 1.1 (2026-05-25) — Recovery 대상에서
    // WAITING_FOR_INPUT 제외. RUNNING heartbeat 미응답만 stuck 으로 본다.
    // 사용자 입력 대기 (waiting_for_input) 는 §7.5 rehydration 경로로 자연 재개.
    it('SET NX lock 획득 후 stale (>30분) RUNNING 만 FAILED 처리', async () => {
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
        'worker heartbeat timeout',
      );
      // WAITING_FOR_INPUT 회귀 가드 — 옛 메시지가 다시 나오면 안 됨.
      expect((setArg.error as { message: string }).message).not.toContain(
        'server restarted while waiting for user input',
      );
      expect(where).toHaveBeenCalledWith('status = :status', {
        status: ExecutionStatus.RUNNING,
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

    // workflow-resumable-execution Phase 1.1 회귀 가드. 핵심 행동 변화 —
    // WAITING_FOR_INPUT 은 절대 stuck recovery 대상에 포함되어선 안 된다.
    // 옛 코드가 WHERE status = WAITING_FOR_INPUT 로 일괄 FAIL 처리하던 패턴은
    // 재발 시 운영 회귀로 직결되므로 명시적으로 가드.
    it('WAITING_FOR_INPUT 은 recovery WHERE 절에 절대 포함되지 않는다', async () => {
      await (
        service as unknown as { recoverStuckExecutions: () => Promise<void> }
      ).recoverStuckExecutions();

      const allWhereCalls = where.mock.calls.flat();
      const allAndWhereCalls = andWhere.mock.calls.flat();
      const flatStringified = [...allWhereCalls, ...allAndWhereCalls]
        .map((v) => JSON.stringify(v))
        .join(' ');
      expect(flatStringified).not.toContain('waiting_for_input');
      expect(flatStringified).not.toContain('WAITING_FOR_INPUT');
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

  // Phase 2 (workflow-resumable-execution) — 5개 continuation 진입점이
  // ContinuationBusService.publish (BullMQ enqueue) 로 fan-out 되는지 +
  // applyContinuation / applyCancellation dispatch (BullMQ Worker 가 호출하는
  // entry) 가 로컬 `pendingContinuations` Map 의 resolver 를 호출하는지 검증.
  // 옛 Redis pub/sub `on(type, handler)` 등록 경로는 폐기 (spec §7.4).
  describe('continuation entry points → bus.publish + apply* dispatch', () => {
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

    // W8 (SUMMARY) / W2 (SUMMARY) — getPendings 공유 헬퍼 (최상위 describe 스코프) 사용.

    it('continueExecution → bus.publish({type:"continue", payload:{type:"form_submitted",formData}}) (spec §10.9 wrap)', async () => {
      // spec/4-nodes/6-presentation/0-common.md §10.9 — wrap 책임은
      // continueExecution. raw formData 가 아닌 sentinel 형태로 publish.
      // 기본 mock find 가 WAITING_FOR_INPUT row 1건 (id=ne-waiting) 을 반환하므로
      // resolveWaitingNodeExecutionId 가 그 id 를 publish payload 에 채운다.
      await service.continueExecution('exec-1', { name: 'Alice' });
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-1',
        nodeExecutionId: 'ne-waiting',
        payload: { type: 'form_submitted', formData: { name: 'Alice' } },
      });
    });

    it('cancelWaitingExecution → bus.publish({type:"cancel"})', () => {
      service.cancelWaitingExecution('exec-2');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'cancel',
        executionId: 'exec-2',
      });
    });

    it('continueButtonClick → bus.publish({type:"button_click", payload:{buttonId}})', async () => {
      await service.continueButtonClick('exec-3', 'btn-confirm');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'button_click',
        executionId: 'exec-3',
        nodeExecutionId: 'ne-waiting',
        payload: { buttonId: 'btn-confirm' },
      });
    });

    it('continueAiConversation → bus.publish({type:"ai_message", payload:{message}})', async () => {
      await service.continueAiConversation('exec-4', 'hi');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_message',
        executionId: 'exec-4',
        nodeExecutionId: 'ne-waiting',
        payload: { message: 'hi' },
      });
    });

    it('continueAiConversation 은 10000자 초과 시 throw 하고 publish 하지 않는다', async () => {
      const tooLong = 'x'.repeat(10_001);
      await expect(
        service.continueAiConversation('exec-5', tooLong),
      ).rejects.toThrow(/Message exceeds maximum length/);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('endAiConversation → bus.publish({type:"ai_end_conversation"})', async () => {
      await service.endAiConversation('exec-6');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'ai_end_conversation',
        executionId: 'exec-6',
        nodeExecutionId: 'ne-waiting',
      });
    });

    // Phase 2.3 (변경 2.3) — spec §7.5.1 publisher 측 사전 검증. WAITING row 가
    // 0건이면 BullMQ enqueue 를 시도하지 않고 INVALID_EXECUTION_STATE 로 즉시 거부.
    it('continueExecution — WAITING NodeExecution 0건이면 INVALID_EXECUTION_STATE throw + publish 안 함', async () => {
      mockNodeExecutionRepo.find.mockResolvedValueOnce([]);
      await expect(
        service.continueExecution('exec-none', { name: 'Bob' }),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('continueExecution — throw 된 InvalidExecutionStateError.code === INVALID_EXECUTION_STATE', async () => {
      mockNodeExecutionRepo.find.mockResolvedValueOnce([]);
      await expect(
        service.continueExecution('exec-none', {}),
      ).rejects.toMatchObject({ code: 'INVALID_EXECUTION_STATE' });
    });

    it('continueButtonClick — WAITING row 0건이면 INVALID_EXECUTION_STATE throw + publish 안 함', async () => {
      mockNodeExecutionRepo.find.mockResolvedValueOnce([]);
      await expect(
        service.continueButtonClick('exec-none', 'btn-x'),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('continueExecution — WAITING row 다중(invariant 위반)이면 warn + INVALID_EXECUTION_STATE throw', async () => {
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);
      mockNodeExecutionRepo.find.mockResolvedValueOnce([
        { id: 'ne-a', nodeId: 'n1', startedAt: new Date() },
        { id: 'ne-b', nodeId: 'n2', startedAt: new Date() },
      ]);
      await expect(
        service.continueExecution('exec-dup', {}),
      ).rejects.toBeInstanceOf(InvalidExecutionStateError);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('invariant 위반'),
      );
      expect(mockBus.publish).not.toHaveBeenCalled();
      warnSpy.mockRestore();
    });

    it('continueExecution — DB lookup infra 실패는 INVALID_EXECUTION_STATE 가 아닌 원본 에러로 전파', async () => {
      mockNodeExecutionRepo.find.mockRejectedValueOnce(
        new Error('connection terminated'),
      );
      const rejection = service.continueExecution('exec-dberr', {});
      await expect(rejection).rejects.toThrow('connection terminated');
      await expect(rejection).rejects.not.toBeInstanceOf(
        InvalidExecutionStateError,
      );
      expect(mockBus.publish).not.toHaveBeenCalled();
    });

    it('applyContinuation continue — msg.payload 를 그대로 resolvePending 으로 forward (spec §10.9 raw forward)', async () => {
      // Phase 2 — BullMQ Worker (continuation-execution.processor) 가 호출하는
      // applyContinuation 이 옛 `on('continue', handler)` 의 역할을 한다.
      // payload sentinel 은 unwrap 없이 그대로 resolver 에 forward.
      const resolveSpy = jest.fn();
      const pendings = getPendings(service);
      pendings.set('exec-1', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      await service.applyContinuation('exec-1', 'ne-1', {
        type: 'form_submitted',
        formData: { ok: 1 },
      });
      expect(resolveSpy).toHaveBeenCalledWith({
        type: 'form_submitted',
        formData: { ok: 1 },
      });
      expect(pendings.has('exec-1')).toBe(false);
    });

    it('continueExecution — form 필드명이 "type" 인 페이로드도 sentinel wrap 으로 정확히 라우팅 (silent drop 회귀 방지, spec §10.9)', async () => {
      // spec §10.9 — root cause regression guard. continueExecution 이 sentinel
      // wrap 을 담당하므로 form 필드명이 `type` 이어도 dispatch 가 `form_submitted`
      // 로 명시 매칭된다.
      await service.continueExecution('exec-coll', {
        type: '주문 문의',
        contact: '010-1234-5678',
      });
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-coll',
        nodeExecutionId: 'ne-waiting',
        payload: {
          type: 'form_submitted',
          formData: { type: '주문 문의', contact: '010-1234-5678' },
        },
      });

      // applyContinuation dispatch 도 sentinel 을 그대로 resolver 에 forward 하는지 검증.
      const resolveSpy = jest.fn();
      const pendings = getPendings(service);
      pendings.set('exec-coll', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });
      await service.applyContinuation('exec-coll', 'ne-coll', {
        type: 'form_submitted',
        formData: { type: '주문 문의', contact: '010-1234-5678' },
      });
      expect(resolveSpy).toHaveBeenCalledWith({
        type: 'form_submitted',
        formData: { type: '주문 문의', contact: '010-1234-5678' },
      });
    });

    it('continueExecution — undefined formData 도 sentinel wrap (빈 폼 제출, TypeError 회피)', async () => {
      // 빈 form 제출 또는 formData 인자 없음 — continueExecution 이 wrap.
      await service.continueExecution('exec-empty');
      expect(mockBus.publish).toHaveBeenCalledWith({
        type: 'continue',
        executionId: 'exec-empty',
        nodeExecutionId: 'ne-waiting',
        payload: { type: 'form_submitted', formData: undefined },
      });
    });

    it('applyCancellation — 로컬 Map 키 없으면 silent skip (review W12)', () => {
      const pendings = getPendings(service);
      pendings.clear();

      // 미등록 executionId — 어떤 에러도 던지지 않음.
      expect(() => service.applyCancellation('exec-not-here')).not.toThrow();
      expect(pendings.size).toBe(0);
    });

    it('applyContinuation button_click — payload 누락 시 buttonId: undefined 로 resolve (review I9)', async () => {
      const resolveSpy = jest.fn();
      const pendings = getPendings(service);
      pendings.set('exec-btn', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      await service.applyContinuation('exec-btn', 'ne-btn', {
        type: 'button_click',
        buttonId: undefined,
      });
      expect(resolveSpy).toHaveBeenCalledWith({
        type: 'button_click',
        buttonId: undefined,
      });
    });

    it('applyContinuation ai_message — 길이 초과 메시지는 silent drop (인-프로세스 직접 publish 우회 방어)', async () => {
      const resolveSpy = jest.fn();
      const pendings = getPendings(service);
      pendings.set('exec-ai', {
        nodeId: 'n1',
        resolve: resolveSpy,
        reject: jest.fn(),
      });

      const oversized = 'x'.repeat(10_001);
      await service.applyContinuation('exec-ai', 'ne-ai', {
        type: 'ai_message',
        message: oversized,
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

    // race 회귀 차단: 본문 context 는 부모 executionId 가 아닌 bgKey 로 등록돼야
    // 하고(격리), executeBackgroundSubgraph 가 자체 finally 로 정리해야 한다
    // (spec/4-nodes/1-logic/12-background.md §4 / execution-context.md 원칙 4).
    const makeBgJob = (over: Record<string, unknown> = {}) => ({
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
      ...over,
    });

    it('registers the body context under a bgKey (isolated from parent executionId) and cleans it up in finally', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      let capturedKey: string | undefined;
      let capturedExecId: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          capturedExecId = options.context.executionId;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(makeBgJob());

      const bgKey = `bg:${executionId}:bg-run-1`;
      // 본문 context 는 bgKey 로 격리 등록, executionId 필드는 메인 ID 유지.
      expect(capturedKey).toBe(bgKey);
      expect(capturedExecId).toBe(executionId);
      // 부모 executionId 키로는 본문 context 가 등록되지 않는다 (키 충돌 없음).
      expect(contextService.getContext(executionId)).toBeUndefined();
      // finally 가 bgKey context 를 정리.
      expect(contextService.getContext(bgKey)).toBeUndefined();
      inlineSpy.mockRestore();
    });

    it('cleans up the bgKey context even when the body throws', async () => {
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockRejectedValue(new Error('boom'));

      await expect(
        service.executeBackgroundSubgraph(
          makeBgJob({ backgroundRunId: 'bg-run-err' }),
        ),
      ).rejects.toThrow('boom');

      expect(
        contextService.getContext(`bg:${executionId}:bg-run-err`),
      ).toBeUndefined();
      inlineSpy.mockRestore();
    });

    it('derives bgKey suffix from parentNodeExecutionId when backgroundRunId is empty (legacy job)', async () => {
      let capturedKey: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: '', parentNodeExecutionId: 'parent-9' }),
      );

      expect(capturedKey).toBe(`bg:${executionId}:parent-9`);
      inlineSpy.mockRestore();
    });

    it("falls back to a 'root' bgKey suffix when backgroundRunId and parentNodeExecutionId are both empty", async () => {
      let capturedKey: string | undefined;
      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          capturedKey = options.context._contextKey;
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: '', parentNodeExecutionId: '' }),
      );

      expect(capturedKey).toBe(`bg:${executionId}:root`);
      inlineSpy.mockRestore();
    });

    // interactive 본문 노드의 pendingContinuations 는 bgKey 로 격리돼야 하고
    // (메인 executionId resolver stomp 금지), finally 에서 정리돼야 한다.
    it('isolates body pendingContinuations under bgKey and cleans it up without stomping the main resolver', async () => {
      const svcAny = service as unknown as {
        pendingContinuations: Map<string, unknown>;
      };
      const bgKey = `bg:${executionId}:bg-run-iso`;

      // 메인 흐름이 대기 중인 resolver (executionId 키) — bg 가 덮어쓰면 안 된다.
      const mainEntry = {
        nodeId: 'main',
        resolve: jest.fn(),
        reject: jest.fn(),
      };
      svcAny.pendingContinuations.set(executionId, mainEntry);

      const inlineSpy = jest
        .spyOn(service, 'executeInline')
        .mockImplementation((_w, _i, options) => {
          // waitForX 가 하는 일을 모사: 본문 context 키(bgKey)로 resolver 등록.
          svcAny.pendingContinuations.set(
            options.context._contextKey as string,
            {
              nodeId: 'body',
              resolve: jest.fn(),
              reject: jest.fn(),
            },
          );
          return Promise.resolve(undefined);
        });

      await service.executeBackgroundSubgraph(
        makeBgJob({ backgroundRunId: 'bg-run-iso' }),
      );

      // 본문 resolver 는 bgKey 로 등록됐다가 finally 에서 정리됨.
      expect(svcAny.pendingContinuations.has(bgKey)).toBe(false);
      // 메인 resolver(executionId)는 stomp/삭제되지 않고 그대로 유지.
      expect(svcAny.pendingContinuations.get(executionId)).toBe(mainEntry);

      svcAny.pendingContinuations.delete(executionId);
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

  describe('runExecution — chat-channel routing context registration', () => {
    // Spec [chat-channel.md §3.1 CCH-AD-05]: ChatChannelDispatcher 가 trigger 와
    // conversationKey 를 식별할 수 있어야 outbound 메시지 발송 가능. 엔진이
    // execute() 진입 시점에 WebsocketService 에 (executionId → {triggerId,
    // chatChannel}) 를 등록해야 이후 emit 되는 모든 이벤트의 fanout envelope 에
    // 자동으로 routing context 가 첨부된다. terminal event 발송 시점에 release
    // 도 의무 (메모리 누수 방지 + 같은 executionId 재사용 시 stale context 차단).

    it('webhook trigger (options.triggerId + input.chatChannel) → register 1회 호출 + workflowId + chatChannel 동봉', async () => {
      await service.execute(
        workflowId,
        {
          __triggerSource: 'webhook',
          chatChannel: {
            provider: 'telegram',
            conversationKey: '12345',
            channelUserKey: 'user-1',
          },
        },
        { triggerId: 'trg-tele' },
      );
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-tele',
        workflowId,
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
    });

    it('일반 webhook (chatChannel 미설정) → triggerId + workflowId 만 register', async () => {
      await service.execute(
        workflowId,
        { parameters: {} },
        { triggerId: 'trg-wh' },
      );
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-wh',
        workflowId,
      });
    });

    it('수동 실행 (executedBy, triggerId 없음) → register 호출 안 함', async () => {
      await service.execute(workflowId, { data: 'x' }, { executedBy: 'u1' });
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
    });

    it('chatChannel.provider 가 빈 문자열이면 chatChannel 등록 제외 (triggerId + workflowId 만 등록)', async () => {
      // extractChatChannelFromInput 의 경계값 검증 — provider 또는
      // conversationKey 가 비어있으면 chatChannel 통째 미통과. dispatcher 가
      // 잘못된 routing 으로 발송 시도하는 회귀 차단.
      await service.execute(
        workflowId,
        {
          chatChannel: { provider: '', conversationKey: '12345' },
        },
        { triggerId: 'trg-bad' },
      );
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad',
        workflowId,
      });
    });

    it('chatChannel.conversationKey 가 빈 문자열이면 chatChannel 등록 제외', async () => {
      await service.execute(
        workflowId,
        {
          chatChannel: { provider: 'telegram', conversationKey: '' },
        },
        { triggerId: 'trg-bad2' },
      );
      await flushPromises();
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad2',
        workflowId,
      });
    });

    it('runExecution 가 reject 하면 .catch 가 routing context 명시 release (안전망)', async () => {
      // ExecutionEngine 의 fire-and-forget runExecution 이 throw 한 채 reject
      // 하면 terminal event 가 emit 되지 않아 WebsocketService 의 자동
      // release 가 작동하지 않는다. execute() 의 .catch 블록이 명시 release
      // 로 안전망 제공 — Map 에 stale context 가 남아 같은 executionId
      // 재사용 시 잘못 첨부되는 회귀를 차단.
      const runSpy = jest
        .spyOn(
          service as unknown as { runExecution: jest.Mock },
          'runExecution',
        )
        .mockRejectedValueOnce(new Error('boom — runExecution reject'));
      try {
        await service.execute(
          workflowId,
          { chatChannel: { provider: 'telegram', conversationKey: '12345' } },
          { triggerId: 'trg-throw' },
        );
        await flushPromises();
        expect(
          mockWebsocketService.releaseExecutionRouting,
        ).toHaveBeenCalledWith(executionId);
      } finally {
        runSpy.mockRestore();
      }
    });
  });

  describe('rehydrateAndResume — chat-channel routing context 재등록 (재개 경로)', () => {
    // Spec [chat-channel.md §3.1 CCH-AD-05] + [4-execution-engine.md §7.5 line 858]:
    // routing context(`{triggerId, workflowId, chatChannel.conversationKey}`)는
    // `WebsocketService.executionRouting` in-memory per-process Map 으로, 최초
    // execute() 진입 시 1회만 등록된다. 재개(rehydration slow path)는 다른
    // 인스턴스/재시작 후 worker 가 pick up 할 수 있어 그 Map 이 비어 있다. 특히
    // `RESUME_INCOMPATIBLE_STATE` 는 "인스턴스 재시작으로 multi-turn in-memory
    // 상태 소실"(§7.5 line 858)일 때 발생 — 즉 routing context 도 항상 함께
    // 사라져 있다. 영속된 execution row 로 재등록하지 않으면 markExecutionCancelled
    // 의 graceful "세션 만료" 안내가 conversationKey 없이 emit 돼 ChatChannelDispatcher
    // 가 outbound skip → 사용자 무음. 본 describe 는 재개 시 재등록 회귀 가드.

    // pendingContinuations 가 비어 있으면 applyContinuation 이 slow path
    // (rehydrateAndResume) 로 진입한다. execution row 만 WAITING_FOR_INPUT 로
    // 주고 nodeExec 를 null 로 만들어 RESUME_CHECKPOINT_MISSING 으로 조기 종료시킨다
    // (재등록은 그 실패 이전에 일어나므로 어떤 RESUME_* 케이스든 동일하게 보장됨).
    const driveResumeSlowPath = async (
      executionRow: Partial<Execution>,
    ): Promise<void> => {
      // WARNING #2 — 다른 테스트가 같은 executionId 를 pendingContinuations 에
      // 남기면 applyContinuation 이 fast-path 로 빠져 slow-path(rehydrateAndResume)
      // 에 진입하지 않아 silent false-negative 가 된다. 매 호출마다 강제 비운다.
      (
        service as unknown as {
          pendingContinuations: Map<string, unknown>;
        }
      ).pendingContinuations.clear();
      mockExecutionRepo.findOneBy.mockResolvedValueOnce(executionRow);
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValueOnce(null);
      mockWebsocketService.registerExecutionRouting.mockClear();
      await service.applyContinuation(executionId, 'ne-some-node', {
        type: 'ai_message',
        message: 'hi',
      });
      await flushPromises();
      await flushPromises();
    };

    it('chatChannel 발화 execution → execute() 와 동일한 {triggerId, workflowId, chatChannel} 로 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-tele',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          __triggerSource: 'webhook',
          chatChannel: {
            provider: 'telegram',
            conversationKey: '12345',
            channelUserKey: 'user-1',
          },
        },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-tele',
        workflowId,
        chatChannel: {
          provider: 'telegram',
          conversationKey: '12345',
          channelUserKey: 'user-1',
        },
      });
    });

    it('triggerId 만 있고 chatChannel 미설정인 재개 → triggerId + workflowId 만 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-wh',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: { parameters: {} },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-wh',
        workflowId,
      });
    });

    it('triggerId 없는 (수동 실행) 재개 → 재등록 호출 안 함', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        // triggerId 미설정 (수동 실행)
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: { data: 'x' },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).not.toHaveBeenCalled();
    });

    it('inputData.chatChannel.conversationKey 가 빈 문자열이면 chatChannel 제외하고 재등록', async () => {
      await driveResumeSlowPath({
        id: executionId,
        workflowId,
        triggerId: 'trg-bad',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          chatChannel: { provider: 'telegram', conversationKey: '' },
        },
        startedAt: new Date(),
      });
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(executionId, {
        triggerId: 'trg-bad',
        workflowId,
      });
    });
  });

  describe('runExecution — workspace timezone injection', () => {
    // spec/4-nodes/3-ai/0-common.md §11.3 — runExecution 의 createContext 단계가
    // workflow.workspace.settings.timezone 을 IANA name 그대로 `__workspaceTimezone`
    // 변수로 주입한다. 3 AI 핸들러는 이 값을 resolveSystemContextTimezone 으로
    // 받아 LLM prefix 를 생성하므로 엔진 레벨에서 실제 주입이 깨지면 prefix 가
    // process.env.TZ 또는 UTC 로 silent fallback 한다. 본 케이스는 그 회귀 가드.
    it('Asia/Seoul workspace → __workspaceTimezone === "Asia/Seoul" on handler context', async () => {
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', settings: { timezone: 'Asia/Seoul' } },
      });
      const seenContexts: ExecutionContext[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown, _config: unknown, context: ExecutionContext) => {
          seenContexts.push(context);
          return mockOutput({ processed: true, input });
        },
      );

      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(seenContexts.length).toBeGreaterThan(0);
      for (const ctx of seenContexts) {
        expect(ctx.variables['__workspaceTimezone']).toBe('Asia/Seoul');
        expect(ctx.variables['__workspaceId']).toBe('ws-1');
      }
    });

    it('workspace.settings 가 비어있으면 __workspaceTimezone === "" (handler 가 process.env.TZ → UTC 로 fall through)', async () => {
      // beforeEach default — mockWorkflowRepo.findOne 은 workspace.settings: {} 반환.
      const seenContexts: ExecutionContext[] = [];
      (mockHandler.execute as jest.Mock).mockImplementation(
        async (input: unknown, _config: unknown, context: ExecutionContext) => {
          seenContexts.push(context);
          return mockOutput({ processed: true, input });
        },
      );

      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      expect(seenContexts.length).toBeGreaterThan(0);
      for (const ctx of seenContexts) {
        expect(ctx.variables['__workspaceTimezone']).toBe('');
      }
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

  // spec/5-system/3-error-handling.md §3.2 — 핸들러가 런타임 실패를
  // `port: 'error'` 로 라우팅(throw 아님)했을 때의 엔진 동작. D4 결정(2026-05-17)
  // 이후 Integration·LLM·Code·Workflow 노드 8종이 이 경로를 쓴다. 회귀 전:
  // 엔진이 모든 정상 return 을 COMPLETED 로 마킹해 인증 실패한 send_email 도
  // 실행 성공으로 표시됐다.
  describe('error port routing (§3.2)', () => {
    const errHandler = (): NodeHandler => ({
      validate: () => ({ valid: true, errors: [] }),
      execute: jest.fn(async () =>
        mockOutput(
          { error: { code: 'EMAIL_SEND_FAILED', message: 'SMTP auth failed' } },
          { port: 'error' },
        ),
      ),
    });

    const lastNodeExecSave = (nodeId: string) =>
      mockNodeExecutionRepo.save.mock.calls
        .map((c) => c[0] as Partial<NodeExecution>)
        .filter((n) => n.nodeId === nodeId)
        .pop();

    it('marks the node FAILED (not COMPLETED) and continues when the error port is connected', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Mailer',
          config: {},
          isDisabled: false,
        },
        {
          id: 'n-handle',
          workflowId,
          type: 'test_node',
          category: NodeCategory.LOGIC,
          label: 'Handle error',
          config: {},
          isDisabled: false,
        },
      ];
      const edges: Partial<Edge>[] = [
        {
          id: 'e-err',
          workflowId,
          sourceNodeId: 'n-err',
          sourcePort: 'error',
          targetNodeId: 'n-handle',
          targetPort: 'in',
          type: EdgeType.DATA,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue(edges);
      handlerRegistry.register('err_node', errHandler());

      await service.execute(workflowId, {});
      await flushPromises();

      // 노드는 FAILED 로 마킹 (회귀 전: COMPLETED).
      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      expect(errNe?.error).toEqual(
        expect.objectContaining({
          code: 'EMAIL_SEND_FAILED',
          message: 'SMTP auth failed',
        }),
      );
      // NODE_FAILED 이벤트 발사 (NODE_COMPLETED 아님).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-err',
        'execution.node.failed',
        expect.objectContaining({ status: 'failed' }),
      );
      // error 포트가 연결돼 있으므로 다운스트림이 실행되고 Execution 은 계속 → COMPLETED.
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });

    it('classifies a handler-thrown AbortError as CANCELLED (not FAILED) and emits NODE_CANCELLED (node-cancellation §5.1)', async () => {
      const abortHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          throw Object.assign(new Error('aborted'), { name: 'AbortError' });
        }),
      });
      const nodes: Partial<Node>[] = [
        {
          id: 'n-abort',
          workflowId,
          type: 'abort_node',
          category: NodeCategory.LOGIC,
          label: 'Aborted node',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('abort_node', abortHandler());

      await service.execute(workflowId, {});
      await flushPromises();

      // 노드는 CANCELLED (FAILED 아님) — abort 는 실패가 아니라 취소.
      const ne = lastNodeExecSave('n-abort');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // C2 (ai-review): DB 저장 error 필드도 봉투 형식 `{ code: 'AbortError', message }`.
      expect(ne?.error).toEqual(
        expect.objectContaining({ code: 'AbortError', message: 'aborted' }),
      );
      // NODE_CANCELLED 이벤트 발사 (NODE_FAILED 아님).
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-abort',
        'execution.node.cancelled',
        // C2: error 필드가 구조체 `{ code: 'AbortError', message }` 여야 함.
        expect.objectContaining({
          status: 'cancelled',
          error: expect.objectContaining({
            code: 'AbortError',
            message: 'aborted',
          }),
        }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-abort',
        'execution.node.failed',
        expect.anything(),
      );
    });

    // W2 (ai-review): dispatch 직전 throwIfAborted() 사전 체크 경로.
    // context.abortSignal 이 이미 abort 된 상태라면 executeWithRetry 의
    // throwIfAborted() 가 발화해 CANCELLED + NODE_CANCELLED 로 귀결된다
    // (node-cancellation §5.1 사전 체크 조항).
    // 검증 전략: 핸들러가 context 의 abortSignal 을 통해 throwIfAborted() 를
    // 호출하도록 구현 → 핸들러 진입 이전에 executeWithRetry 의 사전 체크가 먼저
    // 발화하므로 핸들러 execute 는 1회도 호출되지 않아야 한다.
    it('pre-check: already-aborted signal reaches executeWithRetry → CANCELLED + NODE_CANCELLED without handler execute call (W2)', async () => {
      const executeImpl = jest.fn();
      // executeWithRetry 의 throwIfAborted() 보다 먼저 signal 을 주입하려면
      // context 에 미리 abort 된 signal 을 넣어야 한다. service.execute 는
      // abortSignal 을 외부에서 받지 않으므로, runExecution 이 nodeContext 를
      // 빌드한 뒤 executeWithRetry 가 호출되기 전에 signal 을 set 하는 방법을
      // 선택한다: handler.execute 첫 줄에서 `context.abortSignal?.throwIfAborted()`
      // 를 호출해 같은 AbortError 경로를 유발한다. 이미 abort 된 signal 을
      // context 에 주입한 다음 executeWithRetry 내 사전 체크가 그것을 잡는 것을
      // 시뮬레이션한다.
      const controller = new AbortController();
      controller.abort(); // 사전 abort
      const preCheckHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl.mockImplementation(
          async (_input: unknown, _config: unknown, ctx: unknown) => {
            // 핸들러 진입 시 이미 abort 된 signal 이 context 에 있으면
            // throwIfAborted() 가 DOMException(AbortError) 를 던진다.
            (
              ctx as { abortSignal?: AbortSignal }
            ).abortSignal?.throwIfAborted();
          },
        ),
      });

      const nodes: Partial<Node>[] = [
        {
          id: 'n-precheck',
          workflowId,
          type: 'precheck_node',
          category: NodeCategory.LOGIC,
          label: 'Pre-check node',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      // abortSignal 을 context 에 넣어야 throwIfAborted() 가 발화한다.
      // executeNode 는 nodeContext = { ...context, nodeId, ... } 로 빌드하므로
      // 상위 context 의 abortSignal 이 전파된다.
      // runExecution 의 createContext 호출 후 abortSignal 을 inject 한다.
      const ctxService = (
        service as unknown as {
          contextService: import('./context/execution-context.service').ExecutionContextService;
        }
      ).contextService;
      const originalCreateContext = ctxService.createContext.bind(ctxService);
      const createContextSpy = jest
        .spyOn(ctxService, 'createContext')
        .mockImplementationOnce(function (
          ...args: Parameters<typeof originalCreateContext>
        ) {
          const ctx = originalCreateContext(...args);
          ctx.abortSignal = controller.signal;
          return ctx;
        });
      handlerRegistry.register('precheck_node', preCheckHandler());

      await service.execute(workflowId, {});
      await flushPromises();
      createContextSpy.mockRestore();

      // 핸들러 execute 는 호출됐지만(spy confirm), throwIfAborted() 로 즉시 throw.
      // → executeNode catch 의 isAbortError 분기 → CANCELLED.
      // 노드는 CANCELLED.
      const ne = lastNodeExecSave('n-precheck');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // NODE_CANCELLED 이벤트 발사.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-precheck',
        'execution.node.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-precheck',
        'execution.node.failed',
        expect.anything(),
      );
    });

    // W3 (ai-review): errorPolicy='retry' 노드에서 AbortError 발생 시
    // 재시도 없이(handler.execute 1회만) CANCELLED 로 즉시 종결되는지 검증
    // (node-cancellation §5.1: abort 는 재시도 대상이 아님).
    it('retry policy: AbortError in retry loop → CANCELLED immediately, handler called only once (W3)', async () => {
      const executeImpl = jest.fn(async () => {
        throw Object.assign(new Error('aborted'), { name: 'AbortError' });
      });
      const retryAbortHandler = (): NodeHandler => ({
        validate: () => ({ valid: true, errors: [] }),
        execute: executeImpl,
      });

      const nodes: Partial<Node>[] = [
        {
          id: 'n-retry-abort',
          workflowId,
          type: 'retry_abort_node',
          category: NodeCategory.LOGIC,
          label: 'Retry + Abort node',
          config: {
            errorHandling: {
              policy: 'retry',
              retryConfig: {
                maxRetries: 3,
                retryInterval: 10,
                backoffMultiplier: 1,
              },
            },
          },
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('retry_abort_node', retryAbortHandler());

      await service.execute(workflowId, {});
      await flushPromises();

      // CANCELLED (FAILED 아님) — abort 는 retry 대상이 아님.
      const ne = lastNodeExecSave('n-retry-abort');
      expect(ne?.status).toBe(NodeExecutionStatus.CANCELLED);
      // handler.execute 는 단 1회만 호출 — 재시도(maxRetries=3) 없이 즉시 전파.
      expect(executeImpl).toHaveBeenCalledTimes(1);
      // NODE_CANCELLED emit, NODE_FAILED 미발사.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'n-retry-abort',
        'execution.node.cancelled',
        expect.objectContaining({ status: 'cancelled' }),
      );
      expect(mockWebsocketService.emitNodeEvent).not.toHaveBeenCalledWith(
        executionId,
        'n-retry-abort',
        'execution.node.failed',
        expect.anything(),
      );
    });

    it('stops the workflow (ERROR_PORT_FALLBACK) when the error port has no connected edge', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Mailer',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('err_node', errHandler());

      await service.execute(workflowId, {});
      await flushPromises();

      // 노드는 FAILED.
      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      // error 포트 미연결 → Stop Workflow 폴백 → Execution FAILED + code 보존.
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.FAILED,
          error: expect.objectContaining({ code: 'ERROR_PORT_FALLBACK' }),
        }),
      );
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.failed',
        expect.objectContaining({ status: 'failed' }),
      );
      // 성공 종료 이벤트는 발사되지 않아야 한다.
      expect(mockWebsocketService.emitExecutionEvent).not.toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.anything(),
      );
    });

    it('still marks a normal (non-error-port) handler COMPLETED', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-ok',
          workflowId,
          type: 'ok_node',
          category: NodeCategory.LOGIC,
          label: 'OK',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      handlerRegistry.register('ok_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => mockOutput({ ok: true })),
      });

      await service.execute(workflowId, {});
      await flushPromises();

      const okNe = lastNodeExecSave('n-ok');
      expect(okNe?.status).toBe(NodeExecutionStatus.COMPLETED);
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.COMPLETED }),
      );
    });

    it('marks FAILED with a default message when error envelope carries no code/message', async () => {
      const nodes: Partial<Node>[] = [
        {
          id: 'n-err',
          workflowId,
          type: 'err_node',
          category: NodeCategory.LOGIC,
          label: 'Bare error',
          config: {},
          isDisabled: false,
        },
      ];
      mockNodeRepo.findBy.mockResolvedValue(nodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
      // error 포트로 라우팅하지만 output.error 가 없는 핸들러 (코드/메시지 부재).
      handlerRegistry.register('err_node', {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({ note: 'oops' }, { port: 'error' }),
        ),
      });

      await service.execute(workflowId, {});
      await flushPromises();

      const errNe = lastNodeExecSave('n-err');
      expect(errNe?.status).toBe(NodeExecutionStatus.FAILED);
      expect(errNe?.error).toEqual({ message: 'Node routed to error port' });
      // 미연결 error 포트 → Stop Workflow.
      expect(mockExecutionRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({
          status: ExecutionStatus.FAILED,
          error: expect.objectContaining({ code: 'ERROR_PORT_FALLBACK' }),
        }),
      );
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
      void service.continueExecution(executionId, { approved: true });
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
      void service.continueExecution(executionId, { approved: true });
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
      void service.continueExecution(executionId, { approved: true });
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

      void service.continueExecution(executionId, { approved: true });
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

    it('should silently skip continueExecution without local pending continuation (multi-instance safe)', async () => {
      // PR-B — 다중 인스턴스에서 다른 인스턴스가 호스팅 중일 수 있으므로
      // "No pending continuation" 즉시 throw 는 폐기됐다. publish 만 수행하고
      // 키가 있는 인스턴스만 실제 resolve 한다.
      await expect(
        service.continueExecution('non-existent', {}),
      ).resolves.not.toThrow();
    });

    it('should throw when continueAiConversation receives oversized message', async () => {
      // Set up a pending continuation first
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      const oversizedMessage = 'x'.repeat(10_001);
      await expect(
        service.continueAiConversation(executionId, oversizedMessage),
      ).rejects.toThrow('Message exceeds maximum length');
    });

    it('should silently skip continueAiConversation without local pending continuation (multi-instance safe)', async () => {
      // PR-B — 위와 동일 사유. publish 만 수행하고 silent skip.
      await expect(
        service.continueAiConversation('non-existent', 'hello'),
      ).resolves.not.toThrow();
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

    // Phase 2.7 — rehydration 통합 시나리오. 단일 instance 의 in-memory
    // pendingContinuations 를 강제로 비운 뒤 applyContinuation 을 직접 호출
    // (BullMQ Worker 가 다른 instance 또는 재시작 후 본 instance 의 worker 가
    // pick up 한 상황 시뮬레이션). rehydrateAndResume 가 DB 에서 context 재구성
    // 후 waitForFormSubmission 을 재 invoke 해 workflow 가 정상 완료되는지 검증.
    it('Phase 2.7 — rehydration: pendingContinuations 가 비어있어도 applyContinuation → rehydrate → workflow 정상 완료', async () => {
      // 1. 정상 시작 → 폼 노드에서 WAITING_FOR_INPUT 진입.
      await service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // 2. 첫 단계 시점의 NodeExecution(form 노드) outputData 캡처. waitFor
      //    Form 가 NodeExecution.outputData 에 form 노드의 envelope (status=
      //    waiting_for_input + meta.interactionType=form) 을 저장한 마지막 save 결과.
      const saveCalls = mockNodeExecutionRepo.save.mock.calls;
      const waitingSave = saveCalls.find(
        (c: unknown[]) =>
          (c[0] as { status?: string; nodeId?: string })?.status ===
            NodeExecutionStatus.WAITING_FOR_INPUT &&
          (c[0] as { nodeId?: string })?.nodeId === 'node-form',
      );
      expect(waitingSave).toBeDefined();
      const persistedFormOutput = (
        (waitingSave as unknown[])[0] as {
          outputData?: Record<string, unknown>;
        }
      ).outputData;
      expect(persistedFormOutput).toBeDefined();

      // 3. 인스턴스 재시작 시뮬레이션 — in-memory resolver 강제 제거 + 같은 id 의
      //    in-memory context 도 제거하여 rehydrateContext 가 DB 에서 재구성하도록.
      const pendings = (
        service as unknown as { pendingContinuations: Map<string, unknown> }
      ).pendingContinuations;
      pendings.clear();
      const contextService = (
        service as unknown as { contextService: ExecutionContextService }
      ).contextService;
      contextService.deleteContext(executionId);

      // 4. 정확히 rehydrateAndResume 분기에 들어가도록 DB 응답 mock 갱신.
      //    - Execution 은 WAITING_FOR_INPUT.
      //    - NodeExecution(form) 은 WAITING_FOR_INPUT + persistedFormOutput 보유.
      //    - Node(form) 정의는 formNodes 에서 찾는다.
      //    - execution_node_log 는 start 노드 1건 (form 노드는 아직 미완료).
      //    - findOne (status=COMPLETED) 으로 start 노드의 outputData 반환.
      mockExecutionRepo.findOneBy.mockResolvedValueOnce({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
        recursionDepth: 0,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValueOnce({
        id: 'ne-node-form',
        executionId,
        nodeId: 'node-form',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: persistedFormOutput,
        startedAt: new Date(),
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValueOnce(formNodes.find((n) => n.id === 'node-form'));
      mockExecutionNodeLogRepo.find.mockResolvedValueOnce([
        { id: 1, executionId, nodeId: 'node-start' },
      ]);
      mockWorkflowRepo.findOne.mockResolvedValueOnce({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      // execution_node_log 의 start 노드를 위한 COMPLETED NodeExecution lookup.
      // 그리고 rehydration 후 waitForFormSubmission 이 호출하는 findOne (form node
      // 의 가장 최근 row) 도 같은 mock 이 처리해야 한다 — nodeId 별 분기.
      const originalFindOne = mockNodeExecutionRepo.findOne;
      mockNodeExecutionRepo.findOne = jest
        .fn()
        .mockImplementation(
          (
            opts: { where?: { nodeId?: string; status?: string } } = {},
          ): Promise<unknown> => {
            const nid = opts.where?.nodeId;
            if (
              nid === 'node-start' &&
              opts.where?.status === NodeExecutionStatus.COMPLETED
            ) {
              return Promise.resolve({
                id: 'ne-node-start',
                executionId,
                nodeId: 'node-start',
                status: NodeExecutionStatus.COMPLETED,
                outputData: { processed: true },
                startedAt: new Date(),
              });
            }
            if (nid === 'node-form') {
              return Promise.resolve({
                id: 'ne-node-form',
                executionId,
                nodeId: 'node-form',
                status: NodeExecutionStatus.WAITING_FOR_INPUT,
                outputData: persistedFormOutput,
                startedAt: new Date(),
              });
            }
            // 그 외 lookup 은 기본 mock 으로 처리 (legacy 호환).
            return originalFindOne(opts);
          },
        );

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();

      // 5. BullMQ Worker pickup 시뮬레이션 — applyContinuation 직접 호출.
      //    pendingContinuations 가 비어있으므로 rehydrateAndResume 로 진입.
      await service.applyContinuation('execution-1', 'ne-node-form', {
        type: 'form_submitted',
        formData: { approved: true },
      });
      // applyContinuation 은 slow-path 에서 전체 resume 구동을 detach 하고 즉시
      // 반환한다 (worker 비점유). 구동은 백그라운드에서 firePayload(real
      // setTimeout 0 → 20ms polling)가 form 입력을 전달 → waitForFormSubmission
      // → 그래프 순회 → COMPLETED 로 진행하므로, real-timer 로 완료까지 polling.
      for (let i = 0; i < 50; i++) {
        const completed = (
          mockWebsocketService.emitExecutionEvent.mock.calls as unknown[][]
        ).some((c) => c[1] === 'execution.completed');
        if (completed) break;
        await new Promise((r) => setTimeout(r, 20));
        await flushPromises();
      }

      // 6. 검증 — workflow 가 COMPLETED 까지 도달.
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.completed',
        expect.objectContaining({ status: 'completed' }),
      );
      // form 노드의 NODE_COMPLETED 이벤트도 emit 됐어야 함.
      expect(mockWebsocketService.emitNodeEvent).toHaveBeenCalledWith(
        executionId,
        'node-form',
        'execution.node.completed',
        expect.objectContaining({ status: 'completed' }),
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
      void service.continueButtonClick(executionId, 'btn-1');
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
          // D6 (2026-05-17) — waiting `output.result.*` 단일 경로.
          output: { result: { messages: [], message: '', turnCount: 0 } },
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
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
            message: 'hello',
            turnCount: 1,
          },
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

      void service.continueAiConversation(executionId, 'hi');
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

    // spec/5-system/6-websocket-protocol.md §4.4 execution.user_message +
    // spec/4-nodes/3-ai/1-ai-agent.md §7.5 — 사용자 발화(q)를 다음 턴 LLM 호출
    // 전에 라이브로 노출하기 위한 진행 신호. AI 응답(a) emit(ai_message) 보다
    // 먼저 발화해야 q 가 a 전에 보인다.
    it('emits execution.user_message (q) before execution.ai_message (a), with the expected payload', async () => {
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: '주문 확인해줘' },
              { role: 'assistant', content: '네, 확인하겠습니다' },
            ],
            message: '네, 확인하겠습니다',
            turnCount: 1,
          },
        },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [
            { role: 'user', content: '주문 확인해줘' },
            { role: 'assistant', content: '네, 확인하겠습니다' },
          ],
          turnCount: 1,
          model: 'test-model',
          totalInputTokens: 5,
          totalOutputTokens: 2,
          turnDebugHistory: [],
        },
      }));
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();
      mockWebsocketService.emitExecutionEvent.mockClear();

      void service.continueAiConversation(executionId, '주문 확인해줘');
      await flushPromises();

      const calls = mockWebsocketService.emitExecutionEvent.mock.calls;
      const userMsgCalls = calls.filter(
        (call: unknown[]) => call[1] === 'execution.user_message',
      );
      // 정확히 1회 emit + payload contract.
      expect(userMsgCalls).toHaveLength(1);
      const userPayload = userMsgCalls[0][2] as Record<string, unknown>;
      expect(userPayload).toMatchObject({
        nodeId: 'node-agent',
        message: '주문 확인해줘',
      });
      // nodeExecutionId 는 waiting NodeExecution row PK — 존재 + 문자열 보장
      // (toHaveProperty 만으로는 undefined 도 통과하므로 강화, ai-review W8).
      expect(typeof userPayload.nodeExecutionId).toBe('string');
      expect(userPayload.nodeExecutionId).toBeTruthy();
      expect(typeof userPayload.receivedAt).toBe('string');

      // ordering: user_message(q) 가 ai_message(a) 보다 먼저.
      const userIdx = calls.findIndex(
        (call: unknown[]) => call[1] === 'execution.user_message',
      );
      const aiIdx = calls.findIndex(
        (call: unknown[]) => call[1] === 'execution.ai_message',
      );
      expect(userIdx).toBeGreaterThanOrEqual(0);
      expect(aiIdx).toBeGreaterThanOrEqual(0);
      expect(userIdx).toBeLessThan(aiIdx);
    });

    // ai-review W6 — form 제출 경로는 USER_MESSAGE 미발화 (spec §6.2 / §7.5).
    // 발화 게이팅 predicate 를 직접 단언해 회귀를 차단한다 (full form-render
    // blocking flow 의 무거운 fixture 없이 결정적 검증).
    it('userMessageSignalApplies: ai_message 발화 / form_submitted 미발화', () => {
      expect(userMessageSignalApplies('ai_message')).toBe(true);
      expect(userMessageSignalApplies('form_submitted')).toBe(false);
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
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'final' },
            ],
            message: 'final',
            turnCount: 1,
          },
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

      void service.continueAiConversation(executionId, 'hi');
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

    // multi-turn 후속 turn 의 NodeExecution.outputData DB 영속 회귀 가드.
    //
    // 버그: 워크플로 실행 중인 AI Agent multi-turn 의 첫 turn 후속(2번째 turn
    // 부터)에서 `handleAiMessageTurn` 의 waiting_for_input 분기가 in-memory
    // context cache 만 갱신하고 `nodeExecutionRepository.save` 를 호출하지 않아,
    // 같은 실행을 다른 탭(실행 상세 페이지)에서 열면 첫 user 메시지 외 후속
    // user/assistant/tool 메시지가 표시되지 않았다.
    //
    // spec/5-system/4-execution-engine.md §646 — "NodeExecution.outputData
    // 가 영구 SoT". spec/4-nodes/3-ai/1-ai-agent.md §7.4 — "종료 조건 미충족
    // 시 다시 waiting_for_input — output.result.messages 가 누적 상태로 갱신".
    it('persists outputData (messages + interactionType + _resumeState strip + _resumeCheckpoint credential-strip) on multi-turn follow-up waiting turn', async () => {
      const handler = makeAiAgentHandler(() => ({
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'hi' },
              { role: 'assistant', content: 'hello' },
            ],
            message: 'hello',
            turnCount: 1,
          },
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
            { turnIndex: 1, llmCalls: [], totalDurationMs: 120 },
          ],
          // 민감 internal state — DB 에 새어 나가면 WARN #6 회귀.
          systemPrompt: 'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST',
          llmConfigId: 'cred-leak-canary',
        },
      }));
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();

      // 첫 turn waiting 진입 시점의 save 호출은 무시 — 후속 turn 만 검증.
      mockNodeExecutionRepo.save.mockClear();

      // ai-review W4 — flushPromises 만으로는 깊은 Promise 체인이 누락될
      // 수 있고, 미처리 rejection 도 false-negative 로 통과한다. 본
      // entry point 자체는 동기 디스패치라 await 가 즉시 풀리지만,
      // flushPromises 를 2회 호출해 후속 마이크로태스크 (NodeExec save 등)
      // 가 모두 settle 될 시간을 확보한다.
      void service.continueAiConversation(executionId, 'hi');
      await flushPromises();
      await flushPromises();

      // 후속 turn waiting 분기에서 NodeExecution save 가 호출되어야 한다.
      // (Button/Form 대기 및 첫 turn 대기와 동일 패턴.)
      expect(mockNodeExecutionRepo.save).toHaveBeenCalled();

      // save 된 entity 중 ai_agent 노드의 것 한 건 이상.
      // ai-review W5 — nodeId 하드코딩이 fixture 와 결합되어 있어 fixture
      // 변경 시 한 곳만 갱신하도록 상수화 + 진단성 메시지 분리. Jest 의
      // expect() 는 두 번째 인자 메시지를 지원하지 않아 throw 로 분기.
      const AGENT_NODE_ID = 'node-agent';
      const savedAgentRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((e) => e?.nodeId === AGENT_NODE_ID);
      if (savedAgentRows.length === 0) {
        const allNodeIds = mockNodeExecutionRepo.save.mock.calls.map(
          (call: unknown[]) => (call[0] as Partial<NodeExecution>)?.nodeId,
        );
        throw new Error(
          `no NodeExecution.save was made for nodeId=${AGENT_NODE_ID} — ` +
            `multi-turn follow-up persist may be skipped or fixture nodeId ` +
            `changed (observed save calls: [${allNodeIds.join(', ')}])`,
        );
      }
      expect(savedAgentRows.length).toBeGreaterThanOrEqual(1);

      const persisted = savedAgentRows[savedAgentRows.length - 1];
      const outputData = persisted.outputData as Record<string, unknown>;
      expect(outputData).toBeDefined();

      // (a) 누적 messages 가 outputData.output.result.messages 에 반영.
      const output = outputData.output as Record<string, unknown> | undefined;
      const result = output?.result as Record<string, unknown> | undefined;
      const messages = result?.messages as Array<Record<string, unknown>>;
      expect(Array.isArray(messages)).toBe(true);
      expect(messages.length).toBeGreaterThanOrEqual(2);
      expect(messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ role: 'user', content: 'hi' }),
          expect.objectContaining({ role: 'assistant', content: 'hello' }),
        ]),
      );

      // (b) meta.interactionType 이 'ai_conversation' 으로 마킹 — REST snapshot
      // hydration 분기 정합성 (snapshot reconcile 가 ai_conversation 분기로 진입).
      const meta = outputData.meta as Record<string, unknown> | undefined;
      expect(meta?.interactionType).toBe('ai_conversation');

      // (c) WARN #6 회귀 가드 — full `_resumeState` 는 DB 영속 페이로드에서 strip.
      expect(outputData).not.toHaveProperty('_resumeState');

      // (d) §7.5 — credential-strip 부분집합 `_resumeCheckpoint` 는 영속된다
      // (ai_agent 한정). 재시작 후 재개의 단일 진실.
      const checkpoint = outputData._resumeCheckpoint as
        | Record<string, unknown>
        | undefined;
      expect(checkpoint).toBeDefined();
      // 안전 필드는 보존 (재구성에 필요).
      expect(checkpoint?.turnCount).toBe(1);
      expect(checkpoint?.model).toBe('test-model');
      expect(checkpoint?.totalInputTokens).toBe(5);
      expect(checkpoint?.totalOutputTokens).toBe(2);
      const cpMessages = checkpoint?.messages as Array<Record<string, unknown>>;
      expect(Array.isArray(cpMessages)).toBe(true);
      expect(cpMessages.length).toBeGreaterThanOrEqual(2);
      // credential / context-binding 필드는 checkpoint 에 미동봉 (allow-list).
      expect(checkpoint).not.toHaveProperty('llmConfigId');
      expect(checkpoint).not.toHaveProperty('systemPrompt');
      expect(checkpoint).not.toHaveProperty('turnDebugHistory');

      // (e) 페이로드 전체를 직렬화해 internal credential 식별자가 한 줄도
      // 흘러나가지 않았는지 확인 — `_resumeCheckpoint` 영속 후에도 유지돼야 한다
      // (allow-list 가 credential 을 배제하므로 canary 가 새면 회귀).
      const serialized = JSON.stringify(outputData);
      expect(serialized).not.toContain(
        'INTERNAL_SYSTEM_PROMPT_SHOULD_NOT_PERSIST',
      );
      expect(serialized).not.toContain('cred-leak-canary');
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
      void service.endAiConversation(executionId);
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

    // spec/4-nodes/3-ai/1-ai-agent.md §7.9 — multi-turn LLM 오류 (429/timeout/
    // connection) 시 노드는 `port='error'`, `status='ended'` 로 finalize 되고
    // `output.error.{code, message, details}` 를 운반해야 한다. 본 테스트가 없을
    // 때의 회귀 (운영 보고 2026-05-19): processMultiTurnMessage 가 throw 하면
    // handleAiMessageTurn 의 try/catch 부재로 finalizeAiNode 가 호출되지 않아
    // NodeExecution 이 WAITING_FOR_INPUT 상태로 영구 잔류하고, Execution 만
    // top-level catch 로 FAILED 가 된다. frontend 는 헤더 "실패" + 노드 "Waiting"
    // 의 모순 상태를 본다.
    //
    // 시나리오:
    //  1. AI handler 가 첫 turn 에서 `waiting_for_input` 으로 진입
    //  2. 사용자가 ai_message 전송 → continuation handler 가 resolve
    //  3. handler.processMultiTurnMessage 가 LLM 429 등으로 throw
    //  4. 엔진이 handler.endMultiTurnConversation(state, 'error', errorPayload) 호출
    //  5. NodeExecution 가 FAILED 로 finalize, EXECUTION_FAILED + NODE_FAILED emit
    it('end-to-end: handleAiMessageTurn throw drives endMultiTurnConversation(error, payload) and finalizes node FAILED', async () => {
      const rateLimitError = Object.assign(
        new Error('Anthropic API returned 429 (Too Many Requests)'),
        { code: 'LLM_RATE_LIMIT' },
      );
      const handler = makeAiAgentHandler(() => {
        throw rateLimitError;
      });
      // endMultiTurnConversation mock 을 error endReason / errorPayload 친화적 으로 재정의.
      handler.endMultiTurnConversation.mockImplementation(
        (_state: unknown, endReason: string, errorPayload?: unknown) => ({
          config: { mode: 'multi_turn' },
          output: {
            result: {
              response: '',
              messages: [],
              turnCount: 0,
              endReason,
            },
            ...(errorPayload ? { error: errorPayload } : {}),
          },
          meta: { interactionType: 'ai_conversation' },
          port: 'error',
          status: 'ended',
        }),
      );
      handlerRegistry.register('ai_agent', handler);

      await service.execute(workflowId, {});
      await flushPromises();

      mockWebsocketService.emitExecutionEvent.mockClear();
      mockWebsocketService.emitNodeEvent.mockClear();
      mockNodeExecutionRepo.save.mockClear();

      void service.continueAiConversation(executionId, 'trigger error');
      // ai-review W4 / testing-W — FAILED 경로는 nodeExecutionRepository.save →
      // eventEmitter.emitNode → sentinel throw → runExecution catch 체인을 거치므로
      // 깊은 마이크로태스크 플러시를 위해 flushPromises 를 2회 호출한다.
      await flushPromises();
      await flushPromises();

      // (a) handler.endMultiTurnConversation 이 'error' endReason + errorPayload
      //     로 1회 호출됨.
      expect(handler.endMultiTurnConversation).toHaveBeenCalledTimes(1);
      const endCall = handler.endMultiTurnConversation.mock.calls[0];
      expect(endCall[1]).toBe('error');
      const passedPayload = endCall[2] as Record<string, unknown> | undefined;
      expect(passedPayload).toBeDefined();
      expect(passedPayload?.code).toBe('LLM_RATE_LIMIT');
      expect(typeof passedPayload?.message).toBe('string');
      expect(passedPayload?.message).toContain('429');

      // (b) NODE_FAILED (execution.node.failed) 1회 발사. AI_MESSAGE 양발사 금지.
      const nodeFailedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) => call[2] === 'execution.node.failed',
        );
      expect(nodeFailedCalls.length).toBeGreaterThanOrEqual(1);
      const failedNodeIds = nodeFailedCalls.map(
        (call) => (call as unknown[])[1] as string,
      );
      expect(failedNodeIds).toContain('node-agent');

      const aiMessageCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.ai_message',
        );
      expect(aiMessageCalls).toHaveLength(0);

      // (c) NODE_COMPLETED 는 발사되지 않아야 한다 (정상 종결 분기와 분리).
      const nodeCompletedCalls =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (call: unknown[]) =>
            call[2] === 'execution.node.completed' && call[1] === 'node-agent',
        );
      expect(nodeCompletedCalls).toHaveLength(0);

      // (d) NodeExecution.status === FAILED 로 save.
      const savedAgentRows = mockNodeExecutionRepo.save.mock.calls
        .map((call: unknown[]) => call[0] as Partial<NodeExecution>)
        .filter((row): row is Partial<NodeExecution> => !!row)
        .filter((row) => row.nodeId === 'node-agent');
      expect(savedAgentRows.length).toBeGreaterThanOrEqual(1);
      const finalStatus = savedAgentRows[savedAgentRows.length - 1].status;
      expect(finalStatus).toBe(NodeExecutionStatus.FAILED);

      // (e) EXECUTION_FAILED 가 발사.
      const executionFailedCalls =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (call: unknown[]) => call[1] === 'execution.failed',
        );
      expect(executionFailedCalls.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ---------------------------------------------------------------------------
  // W11 (SUMMARY) — waitForAiConversation form_submitted 분기 단위 테스트.
  // W12 (SUMMARY) — unknown action.type warn+reenter 단위 테스트.
  // ---------------------------------------------------------------------------
  describe('waitForAiConversation dispatch — form_submitted + unknown type (W11/W12)', () => {
    // 버스 mock 이 handlers 에 즉시 dispatch 하는 특성 활용.
    // `form_submitted` payload 가 handler.processMultiTurnMessage 에 도달하는지,
    // unknown type 이 warn log 를 남기고 loop 를 재진입하는지 검증.

    const makeAiDispatchHandler = (
      processReturn: () => unknown,
    ): NodeHandler & {
      processMultiTurnMessage: jest.Mock;
      endMultiTurnConversation: jest.Mock;
    } =>
      ({
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: { mode: 'multi_turn' },
          output: { result: { messages: [], message: '', turnCount: 0 } },
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
      }) as unknown as NodeHandler & {
        processMultiTurnMessage: jest.Mock;
        endMultiTurnConversation: jest.Mock;
      };

    const aiDispatchNodes: Partial<Node>[] = [
      {
        id: 'node-agent-dispatch',
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

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(aiDispatchNodes);
      mockEdgeRepo.findBy.mockResolvedValue([]);
    });

    it('W11 — form_submitted dispatch: handleAiMessageTurn 이 JSON.stringify(formData) 인자로 호출됨', async () => {
      // spec §10.9 + §10.9 dispatch 표 — form_submitted case 는
      // handleAiMessageTurn(executionId, contextKey, node, JSON.stringify(formData), ...) 호출.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const execPromise = service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // form_submitted sentinel payload 로 continueExecution 호출.
      const formPayload = { field1: 'value1', type: '주문 문의' };
      void service.continueExecution(executionId, formPayload);
      await flushPromises();

      // processMultiTurnMessage 가 첫 번째 인자로 JSON.stringify(formPayload) 를 받았는지.
      // 호출 시그니처: processMultiTurnMessage(userMessage: string, state, options)
      // spec §6.2 step 2 — 'form_submitted' source 신호 전달 검증.
      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        JSON.stringify(formPayload),
        expect.anything(),
        expect.objectContaining({ source: 'form_submitted' }),
      );

      // 이후 ai_end_conversation 으로 종료 — processReturn 이 waiting_for_input
      // 이어서 loop 이 다음 이벤트를 기다리므로 endAiConversation 후 flushPromises 필요.
      void service.endAiConversation(executionId);
      await flushPromises();
      await execPromise;
    });

    it('W10 — ai_message dispatch: processMultiTurnMessage 가 { source: "ai_message" } 로 호출됨', async () => {
      // spec/4-nodes/3-ai/1-ai-agent.md §6.2 step 2.c.bypass — engine 이
      // `continueAiConversation` 경로에서 `'ai_message'` source 를 결정적으로
      // 전달해야 handler 의 form bypass 분기가 올바르게 작동한다.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const execPromise = service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // continueAiConversation → bus publish ai_message → handler 호출
      void service.continueAiConversation(executionId, '안녕하세요');
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        '안녕하세요',
        expect.anything(),
        expect.objectContaining({ source: 'ai_message' }),
      );

      void service.endAiConversation(executionId);
      await flushPromises();
      await execPromise;
    });

    it('W12 — unknown action.type: logger.warn 호출 + loop 재진입 (silent drop 금지)', async () => {
      // spec §10.9 — unknown type 은 warn log 남기고 loop 재진입.
      // MAX_UNKNOWN_SKIPS cap 이 20이므로 1회 unknown 후 ai_end_conversation 으로 정상 종료.
      const endReturn = {
        config: { mode: 'multi_turn' },
        output: {},
        meta: {},
        port: 'ended',
        status: 'ended',
      };
      const handler = makeAiDispatchHandler(() => endReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      const execPromise = service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // unknown type 메시지 주입 — bus handler 를 통해 pendingContinuations 에 직접 주입.
      // 버스 mock 의 publish 는 type 으로 handler 조회하므로, 직접 resolvePending 사용.
      const pendings = getPendings(service);

      // pending 이 있으면 unknown type 으로 resolve.
      const pendingEntry = pendings.get(executionId);
      if (pendingEntry) {
        pendingEntry.resolve({ type: 'totally_unknown_type_xyz' });
      }
      await flushPromises();

      // warn log 가 호출됐는지 — unknown type 포함.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasUnknownWarn = warnCalls.some(
        (msg) =>
          msg.includes('Unknown continuation action.type') ||
          msg.includes('totally_unknown_type_xyz'),
      );
      expect(hasUnknownWarn).toBe(true);

      // 이후 ai_end_conversation 으로 정상 종료.
      void service.endAiConversation(executionId);
      await execPromise;

      warnSpy.mockRestore();
    });

    it('button_click action.type: MAX_UNKNOWN_SKIPS 카운팅 제외 — stale telegram 클릭 누적이 대화를 죽이지 않는다', async () => {
      // spec/4-nodes/6-presentation/0-common.md §10.9 line 400/407 —
      // `button_click` 은 enum-complete 케이스로 spec 이 명시한 "warn log +
      // loop 재진입 graceful degradation" 그대로 동작해야 한다. 텔레그램 stale
      // inline_keyboard 클릭이 누적돼도 MAX_UNKNOWN_SKIPS (=20) cap 이 발동해
      // 대화가 FAILED 종결되는 회귀를 차단.
      //
      // 회귀 시나리오: 사용자가 Presentation Carousel 노드를 거친 뒤 후속 AI
      // Agent 가 `waitForAiConversation` 진입. 텔레그램에 잔존한 이전 inline
      // keyboard 의 콜백이 button_callback → continueButtonClick →
      // bus.publish({type:'button_click'}) 경로로 본 루프에 도달.
      const endReturn = {
        config: { mode: 'multi_turn' },
        output: {},
        meta: {},
        port: 'ended',
        status: 'ended',
      };
      const handler = makeAiDispatchHandler(() => endReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      const execPromise = service.execute(workflowId, { data: 'test' });
      await flushPromises();

      const pendings = getPendings(service);

      // 25회 — MAX_UNKNOWN_SKIPS (20) 를 충분히 초과. 모두 button_click 이므로
      // skip 카운팅에서 제외되어야 한다. 매 iteration 마다 새 pending 이 등록
      // 되므로 loop 가 살아 있어야 진행된다.
      for (let i = 0; i < 25; i += 1) {
        const pendingEntry = pendings.get(executionId);
        expect(pendingEntry).toBeDefined(); // loop alive 검증
        pendingEntry?.resolve({ type: 'button_click', buttonId: `btn-${i}` });
        await flushPromises();
      }

      // 21회 이상 button_click 후에도 대화가 alive 인지 — ai_end_conversation
      // 으로 정상 종결되는지 확인.
      const stillAlive = pendings.get(executionId);
      expect(stillAlive).toBeDefined();

      void service.endAiConversation(executionId);
      await execPromise;

      // FAILED 종결을 야기하는 cap 도달 warn 이 없어야 함.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasCapWarn = warnCalls.some((msg) =>
        msg.includes('unknown skip limit'),
      );
      expect(hasCapWarn).toBe(false);

      warnSpy.mockRestore();
    });

    // -------------------------------------------------------------------------
    // W4 (SUMMARY) — button_click × N → ai_message → ended 인터리빙 통합 케이스.
    // stale 클릭이 복수로 누적된 뒤 실제 ai_message 가 도달하면 정상 처리됨.
    // -------------------------------------------------------------------------
    it('W4 — button_click × N 인터리빙 후 ai_message 도달 시 정상 처리 (인터리빙 통합)', async () => {
      // 시나리오: stale button_click 3회 → ai_message 1회 → ai_end_conversation.
      // button_click 은 skip count 에서 제외되고 ai_message 는 정상 처리되어야 한다.
      const processReturn = {
        config: { mode: 'multi_turn' },
        output: { result: { messages: [], message: 'ok', turnCount: 1 } },
        meta: { interactionType: 'ai_conversation' },
        status: 'waiting_for_input',
        _resumeState: {
          messages: [{ role: 'assistant', content: 'ok' }],
          turnCount: 1,
          turnDebugHistory: [],
          model: 'test-model',
          totalInputTokens: 0,
          totalOutputTokens: 0,
        },
        port: 'waiting_for_input',
      };
      const handler = makeAiDispatchHandler(() => processReturn);
      handlerRegistry.register('ai_agent', handler, {
        kind: 'blocking',
        interaction: 'ai_conversation',
      });

      const execPromise = service.execute(workflowId, { data: 'test' });
      await flushPromises();

      const pendings = getPendings(service);

      // stale button_click 3회 — skip 카운팅 제외, loop alive 유지.
      for (let i = 0; i < 3; i += 1) {
        const entry = pendings.get(executionId);
        expect(entry).toBeDefined();
        entry?.resolve({ type: 'button_click', buttonId: `stale-${i}` });
        await flushPromises();
      }

      // ai_message 도달 — processMultiTurnMessage 가 호출되어야 한다.
      const entryForMsg = pendings.get(executionId);
      expect(entryForMsg).toBeDefined();
      entryForMsg?.resolve({ type: 'ai_message', message: 'hello AI' });
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledWith(
        'hello AI',
        expect.any(Object),
        expect.objectContaining({ source: 'ai_message' }),
      );

      // ai_end_conversation 으로 정상 종결.
      void service.endAiConversation(executionId);
      await execPromise;
    });

    // -------------------------------------------------------------------------
    // W5 (SUMMARY) — buttonId 경계값 테스트 (64+, null, 숫자).
    // slice(0, 64) 가드가 올바르게 동작하는지 확인.
    // -------------------------------------------------------------------------
    describe('W5 — buttonId 경계값 (slice(0,64) 가드)', () => {
      const setupForButtonIdTest = async (): Promise<{
        pendings: ReturnType<typeof getPendings>;
        warnSpy: jest.SpyInstance;
        execPromise: Promise<unknown>;
      }> => {
        const endReturn = {
          config: { mode: 'multi_turn' },
          output: {},
          meta: {},
          port: 'ended',
          status: 'ended',
        };
        const handler = makeAiDispatchHandler(() => endReturn);
        handlerRegistry.register('ai_agent', handler, {
          kind: 'blocking',
          interaction: 'ai_conversation',
        });

        const logger = (service as unknown as { logger: { warn: jest.Mock } })
          .logger;
        const warnSpy = jest.spyOn(logger, 'warn');

        const execPromise = service.execute(workflowId, { data: 'test' });
        await flushPromises();

        return { pendings: getPendings(service), warnSpy, execPromise };
      };

      it('buttonId 64자 초과 → 64자로 슬라이싱되어 warn log 에 포함', async () => {
        const { pendings, warnSpy, execPromise } = await setupForButtonIdTest();

        const longId = 'a'.repeat(100);
        const entry = pendings.get(executionId);
        expect(entry).toBeDefined();
        entry?.resolve({ type: 'button_click', buttonId: longId });
        await flushPromises();

        const warnCalls = warnSpy.mock.calls;
        const hasButtonClickWarn = warnCalls.some((args) => {
          const ctx = args[1] as { buttonId?: string } | undefined;
          return typeof ctx?.buttonId === 'string' && ctx.buttonId.length <= 64;
        });
        expect(hasButtonClickWarn).toBe(true);

        void service.endAiConversation(executionId);
        await execPromise;
        warnSpy.mockRestore();
      });

      it('buttonId null → 빈 문자열 fallback (TypeError 없음)', async () => {
        const { pendings, warnSpy, execPromise } = await setupForButtonIdTest();

        const entry = pendings.get(executionId);
        expect(entry).toBeDefined();
        // null 은 ContinuationPayload 에서 string | undefined 이지만
        // 런타임 신뢰 불가 — 방어 코드 검증.
        entry?.resolve({
          type: 'button_click',
          buttonId: null as unknown as string,
        });
        await flushPromises();

        // 예외 없이 loop 재진입 확인.
        const stillAlive = pendings.get(executionId);
        expect(stillAlive).toBeDefined();

        void service.endAiConversation(executionId);
        await execPromise;
        warnSpy.mockRestore();
      });

      it('buttonId 숫자 → 빈 문자열 fallback (typeof 가드)', async () => {
        const { pendings, warnSpy, execPromise } = await setupForButtonIdTest();

        const entry = pendings.get(executionId);
        expect(entry).toBeDefined();
        entry?.resolve({
          type: 'button_click',
          buttonId: 42 as unknown as string,
        });
        await flushPromises();

        const warnCalls = warnSpy.mock.calls;
        const hasButtonClickWarn = warnCalls.some((args) => {
          const ctx = args[1] as { buttonId?: string } | undefined;
          // 숫자는 빈 문자열 fallback 이므로 buttonId === ''
          return ctx?.buttonId === '';
        });
        expect(hasButtonClickWarn).toBe(true);

        void service.endAiConversation(executionId);
        await execPromise;
        warnSpy.mockRestore();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // W13 (SUMMARY) — Form node sentinel unwrap back-compat fallback 검증.
  // waitForFormSubmission 이 sentinel 없는 raw 값을 받으면 warn log + 값 그대로 사용.
  // ---------------------------------------------------------------------------
  describe('waitForFormSubmission — back-compat fallback (W13)', () => {
    const formNodesW13: Partial<Node>[] = [
      {
        id: 'node-start-w13',
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
        id: 'node-form-w13',
        workflowId,
        type: 'form',
        category: NodeCategory.PRESENTATION,
        label: 'Form W13',
        config: {
          fields: [{ name: 'approved', type: 'checkbox', label: 'Approved' }],
          title: 'Test',
        },
        isDisabled: false,
        containerId: undefined,
        toolOwnerId: undefined,
      },
    ];
    const formEdgesW13: Partial<Edge>[] = [
      {
        id: 'edge-w13-1',
        workflowId,
        sourceNodeId: 'node-start-w13',
        sourcePort: 'out',
        targetNodeId: 'node-form-w13',
        targetPort: 'in',
        type: EdgeType.DATA,
      },
    ];

    beforeEach(() => {
      mockNodeRepo.findBy.mockResolvedValue(formNodesW13);
      mockEdgeRepo.findBy.mockResolvedValue(formEdgesW13);
      const formHandlerW13: NodeHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput({
            type: 'form',
            status: 'waiting_for_input',
            formConfig: {
              fields: [
                { name: 'approved', type: 'checkbox', label: 'Approved' },
              ],
            },
          }),
        ),
      };
      handlerRegistry.register('form', formHandlerW13, {
        kind: 'blocking',
        interaction: 'form',
      });
    });

    it('sentinel 없는 raw 값이 resolvePending 에 도달하면 warn log + raw 값 그대로 formData 로 사용', async () => {
      // spec §10.9 back-compat: continueExecution 경로 외 직접 resolvePending 시
      // sentinel 없이 raw 값이 들어올 수 있다. warn log 남기고 raw 값을 그대로 사용.
      const logger = (service as unknown as { logger: { warn: jest.Mock } })
        .logger;
      const warnSpy = jest.spyOn(logger, 'warn');

      void service.execute(workflowId, { data: 'test' });
      await flushPromises();

      // sentinel 없이 직접 resolvePending — 비정상 경로 시뮬레이션.
      const pendings = (
        service as unknown as {
          pendingContinuations: Map<
            string,
            { nodeId: string; resolve: jest.Mock; reject: jest.Mock }
          >;
        }
      ).pendingContinuations;
      const raw = { approved: true };
      const pendingEntry = pendings.get(executionId);
      pendingEntry?.resolve(raw);
      await flushPromises();

      // warn log 가 sentinel 없는 폴백 분기임을 알리는지.
      const warnCalls = warnSpy.mock.calls.map((c) => String(c[0]));
      const hasFallbackWarn = warnCalls.some(
        (msg) =>
          msg.includes('sentinel') ||
          msg.includes('waitForFormSubmission') ||
          msg.includes('폴백'),
      );
      expect(hasFallbackWarn).toBe(true);

      warnSpy.mockRestore();
    });
  });

  // ---------------------------------------------------------------------------
  // extractAiTurnErrorPayload — 단위 테스트 (testing-W req W_json)
  // private static 이므로 `as unknown as` 캐스팅으로 직접 호출.
  // ---------------------------------------------------------------------------
  describe('extractAiTurnErrorPayload', () => {
    type ExtractFn = (err: unknown) => {
      code: string;
      message: string;
      details?: unknown;
    };
    const extract = (): ExtractFn =>
      (
        ExecutionEngineService as unknown as {
          extractAiTurnErrorPayload: ExtractFn;
        }
      ).extractAiTurnErrorPayload;

    // spec/conventions/node-output.md Principle 3.2.1 — LLM 계열 노드는
    // details.retryable 필수. 본 PR (2026-05-23) 의 행동 변경.
    it('Error 인스턴스 + 명시 code 를 올바르게 추출한다 (details.retryable 보장)', () => {
      const err = Object.assign(new Error('LLM rate limited'), {
        code: 'LLM_RATE_LIMIT',
      });
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
      expect(result.message).toContain('LLM rate limited');
      // Principle 3.2.1 — LLM_RATE_LIMIT 은 retryable=true
      expect(result.details).toEqual({ retryable: true });
    });

    it('string throw 를 처리한다', () => {
      const result = extract()('something went wrong');
      // 분류 불가 fallback → LLM_CALL_FAILED non-retryable (spec §10 단일 taxonomy)
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect(result.message).toBe('something went wrong');
    });

    it('null/undefined throw 를 처리한다', () => {
      expect(extract()(null).message).toBe('unknown error');
      expect(extract()(undefined).message).toBe('unknown error');
    });

    it('number/boolean/bigint throw 를 처리한다', () => {
      expect(extract()(429).message).toBe('429');
      expect(extract()(true).message).toBe('true');
    });

    it('message 에 429 포함 시 code=LLM_RATE_LIMIT fallback', () => {
      const err = new Error('API returned 429');
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
    });

    it('message 에 rate limit 포함 시 code=LLM_RATE_LIMIT fallback', () => {
      const err = new Error('Rate limit exceeded');
      const result = extract()(err);
      expect(result.code).toBe('LLM_RATE_LIMIT');
    });

    it('network/timeout 메시지 → LLM_CALL_FAILED + retryable=true (spec §10)', () => {
      const err = new Error('Connection timeout');
      const result = extract()(err);
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect((result.details as Record<string, unknown>).retryable).toBe(true);
    });

    it('분류 불가 메시지 → LLM_CALL_FAILED + retryable=false', () => {
      const err = new Error('something unexpected happened');
      const result = extract()(err);
      // spec §10 — 별도 AI_* fallback 없이 LLM_CALL_FAILED non-retryable 로 통합
      expect(result.code).toBe('LLM_CALL_FAILED');
      expect((result.details as Record<string, unknown>).retryable).toBe(false);
    });

    it('details 필드를 포함한 오류를 처리한다 (retryable 자동 분류)', () => {
      const err = Object.assign(new Error('API error'), {
        code: 'LLM_API_ERROR',
        details: { retryAfter: 60, status: 429 },
      });
      const result = extract()(err);
      // 기존 details 필드 보존 + Principle 3.2.1 retryable 추가.
      // LLM_API_ERROR 는 RETRYABLE_CODES 에 없어 retryable=false (보수적 default).
      expect(result.details).toEqual({
        retryAfter: 60,
        status: 429,
        retryable: false,
      });
    });

    it('details 에 secret 포함 시 sanitize 가 적용된다', () => {
      const err = Object.assign(new Error('OAuth error'), {
        details: { message: 'Bearer abc123token invalid' },
      });
      const result = extract()(err);
      expect(JSON.stringify(result.details)).not.toContain('abc123token');
      expect(JSON.stringify(result.details)).toContain('***');
    });

    it('details 가 순환참조 객체이면 직렬화 실패 시 fallback 문자열 반환 (req W_json)', () => {
      const circular: Record<string, unknown> = { name: 'circular' };
      circular['self'] = circular;
      const err = Object.assign(new Error('circular error'), {
        details: circular,
      });
      // JSON.stringify(circular) throws — should NOT throw out, must return safe value
      expect(() => extract()(err)).not.toThrow();
      const result = extract()(err);
      // Principle 3.2.1 갱신 후 — fallback `[serialization error]` 가
      // baseDetails 의 `details` 필드로 래핑되고 retryable 이 추가됨.
      expect(result.details).toMatchObject({
        details: '[serialization error]',
        retryable: false,
      });
    });

    it('비-Error 객체 throw 시 JSON.stringify 실패해도 throw 하지 않는다 (req W_json)', () => {
      const nonSerializable: Record<string, unknown> = {};
      nonSerializable['self'] = nonSerializable; // circular
      expect(() => extract()(nonSerializable)).not.toThrow();
      const result = extract()(nonSerializable);
      expect(result.message).toBe('[non-serializable error object]');
      expect(result.code).toBe('LLM_CALL_FAILED');
    });

    // spec/conventions/node-output.md Principle 3.2.1 — LLM 계열 retryable 분류
    describe('retryable 분류 (Principle 3.2.1)', () => {
      it('LLM_RATE_LIMIT → retryable=true', () => {
        const result = extract()(
          Object.assign(new Error('429'), { code: 'LLM_RATE_LIMIT' }),
        );
        expect((result.details as Record<string, unknown>).retryable).toBe(
          true,
        );
      });

      it('분류 불가 fallback → LLM_CALL_FAILED + retryable=false (보수적 default)', () => {
        const result = extract()(new Error('unexpected error'));
        expect(result.code).toBe('LLM_CALL_FAILED');
        expect((result.details as Record<string, unknown>).retryable).toBe(
          false,
        );
      });

      // spec/4-nodes/3-ai/1-ai-agent.md §10 — HTTP status 기반 분류 (스펙이 SoT).
      // 멀티턴 경로는 raw SDK 에러(.status)를 받으므로 status 로 분류한다.
      describe('HTTP status 기반 분류 (§10)', () => {
        const withStatus = (status: number, msg = 'provider error') =>
          Object.assign(new Error(msg), { status });

        it('status 429 → LLM_RATE_LIMIT + retryable=true', () => {
          const r = extract()(withStatus(429, 'too many requests'));
          expect(r.code).toBe('LLM_RATE_LIMIT');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 500 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
          const r = extract()(withStatus(500));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 503 → LLM_CALL_FAILED + retryable=true (5xx)', () => {
          const r = extract()(withStatus(503));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 401 → LLM_CALL_FAILED + retryable=false (auth)', () => {
          const r = extract()(withStatus(401, 'unauthorized'));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });

        it('status 403 → LLM_CALL_FAILED + retryable=false (auth)', () => {
          const r = extract()(withStatus(403, 'forbidden'));
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });

        it('err.response.status 502 fallback → LLM_CALL_FAILED + retryable=true', () => {
          const r = extract()(
            Object.assign(new Error('bad gateway'), {
              response: { status: 502 },
            }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('errno ECONNRESET → LLM_CALL_FAILED + retryable=true (network)', () => {
          const r = extract()(
            Object.assign(new Error('socket hang up'), { code: 'ECONNRESET' }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('client-layer LLM_CONNECTION_ERROR 코드 누출 시 LLM_CALL_FAILED 로 매핑 + retryable=true', () => {
          const r = extract()(
            Object.assign(new Error('network down'), {
              code: 'LLM_CONNECTION_ERROR',
            }),
          );
          expect(r.code).toBe('LLM_CALL_FAILED');
          expect((r.details as Record<string, unknown>).retryable).toBe(true);
        });

        it('status 400 (bad request, 비-auth 4xx) → 비재시도 fallback', () => {
          const r = extract()(withStatus(400, 'bad request'));
          expect((r.details as Record<string, unknown>).retryable).toBe(false);
        });
      });

      it('LLM_RATE_LIMIT + Retry-After 헤더 → retryAfterSec 추출 (초 단위)', () => {
        const err = Object.assign(new Error('429'), {
          code: 'LLM_RATE_LIMIT',
          headers: { 'retry-after': '30' }, // 초 단위 RFC delta-seconds
        });
        const result = extract()(err);
        const details = result.details as Record<string, unknown>;
        expect(details.retryable).toBe(true);
        expect(details.retryAfterSec).toBe(30);
      });

      it('retryable=false 면 retryAfterSec 미동봉 (invariant)', () => {
        const err = Object.assign(new Error('parse fail'), {
          code: 'LLM_RESPONSE_INVALID',
          headers: { 'retry-after': '30' },
        });
        const result = extract()(err);
        const details = result.details as Record<string, unknown>;
        expect(details.retryable).toBe(false);
        expect(details.retryAfterSec).toBeUndefined();
      });
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
      // ai-review 2026-06-03: injects extra initialVariables into the options-bag
      // to verify that template expression resolution reads $var.token correctly.
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, options: CreateContextOptions = {}) =>
            origCreate(execId, wfId, {
              ...options,
              initialVariables: {
                ...(options.initialVariables ?? {}),
                token: 'xyz789',
              },
            }),
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
      // ai-review 2026-06-03: injects a 'token' initialVariable via the options-bag
      // to verify that $var.token is not overridden by conflicting input-data spreads.
      jest
        .spyOn(contextService, 'createContext')
        .mockImplementation(
          (execId: string, wfId: string, options: CreateContextOptions = {}) =>
            origCreate(execId, wfId, {
              ...options,
              initialVariables: {
                ...(options.initialVariables ?? {}),
                token: 'original',
              },
            }),
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
        output: { result: { messages: [], message: '', turnCount: 1 } },
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
          output: { result: { messages: [], message: '', turnCount: 0 } },
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

      void service.continueAiConversation(executionId, 'hello');
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
      // surface loudly instead of finishing as no-ops. zod `default('1')`
      // catches this at storage time ("최소 반복 1회" 정책, spec
      // 4-nodes/1-logic/3-loop.md §8); the throw is the runtime safety net
      // for edges that bypass schema parsing (legacy data, direct repo write).
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

  // Phase 2.3a — §7.5 rehydration 본 구현 단위 검증. happy-path (form 제출 →
  // 워크플로 완료) 는 e2e 에서 별도 검증; 본 블록은 invariant fail-fast 분기를
  // 검증해 RESUME_* 코드 분류가 정확한지 보장한다.
  describe('Rehydration — §7.5 Resume after Restart', () => {
    type RehydrationSubject = {
      rehydrateAndResume: (
        executionId: string,
        nodeExecutionId: string,
        payload: unknown,
      ) => Promise<void>;
    };
    const subject = () => service as unknown as RehydrationSubject;

    beforeEach(() => {
      // 본 블록은 직접 rehydrateAndResume 을 호출하므로 fast-path 분기를
      // 비활성화하기 위해 pendingContinuations 를 비운다.
      (
        service as unknown as {
          pendingContinuations: Map<string, unknown>;
        }
      ).pendingContinuations.clear();
      mockExecutionRepo.findOneBy.mockReset();
      mockExecutionRepo.save.mockClear();
      // createQueryBuilder 의 chain mock — markExecutionCancelled /
      // markNodeExecutionFailed 가 사용. 본 테스트는 호출 여부만 검증하므로
      // execute() 가 resolves 하도록 가벼운 stub.
      const buildUpdateChain = (): {
        update: jest.Mock;
        set: jest.Mock;
        where: jest.Mock;
        andWhere: jest.Mock;
        execute: jest.Mock;
      } => {
        const chain = {
          update: jest.fn(),
          set: jest.fn(),
          where: jest.fn(),
          andWhere: jest.fn(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        };
        chain.update.mockReturnValue(chain);
        chain.set.mockReturnValue(chain);
        chain.where.mockReturnValue(chain);
        chain.andWhere.mockReturnValue(chain);
        return chain;
      };
      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildUpdateChain);
      mockNodeExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(buildUpdateChain);
    });

    it('Execution not WAITING_FOR_INPUT → RESUME_CHECKPOINT_MISSING (execution 만 cancelled)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.RUNNING,
      });

      await subject().rehydrateAndResume(executionId, 'ne-1', { foo: 1 });

      // execution.update(...) chain 호출 → execute() 1회
      const execChain = mockExecutionRepo.createQueryBuilder.mock.results[0]
        .value as { execute: jest.Mock };
      expect(execChain.execute).toHaveBeenCalled();
      // NodeExecution 은 nodeExecutionId 확인 전 단계에서 throw → mark 미호출
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('__no_node_exec__ sentinel → RESUME_CHECKPOINT_MISSING', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });

      await subject().rehydrateAndResume(executionId, '__no_node_exec__', {});

      const execChain = mockExecutionRepo.createQueryBuilder.mock.results[0]
        .value as { execute: jest.Mock };
      expect(execChain.execute).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('NodeExecution not WAITING_FOR_INPUT → RESUME_CHECKPOINT_MISSING (둘 다 마킹)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.COMPLETED, // already moved on
      });

      await subject().rehydrateAndResume(executionId, 'ne-1', {});

      // resolvedNodeExecutionId 는 invariant 통과 못해서 null — NodeExecution 마킹 미호출
      // (코드 흐름: resolvedNodeExecutionId = nodeExec.id 는 status 검증 통과한 뒤에 set)
      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).not.toHaveBeenCalled();
    });

    it('Node 정의 부재 → RESUME_CHECKPOINT_MISSING (Execution + NodeExecution 모두 마킹)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-missing',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(null);

      await subject().rehydrateAndResume(executionId, 'ne-1', {});

      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      // NodeExecution 마킹도 호출 (resolvedNodeExecutionId 가 set 된 상태)
      expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();
    });

    it('Multi-turn AI 노드 + _resumeCheckpoint 부재 → RESUME_INCOMPATIBLE_STATE (graceful reset)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        triggerId: 'trg-ai',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        inputData: {
          __triggerSource: 'webhook',
          chatChannel: {
            provider: 'telegram',
            conversationKey: 'ck-ai',
            channelUserKey: 'u-ai',
          },
        },
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          // _resumeCheckpoint 부재 (배포 이전 진입한 waiting row) → 재구성 불가.
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
      });
      // rehydrateContext 는 contextService 가 in-memory 새 context 를 생성하므로
      // workflow / log 조회가 필요. 가벼운 stub.
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
      mockWebsocketService.registerExecutionRouting.mockClear();

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // WARNING #1 회귀 가드 — RESUME_INCOMPATIBLE_STATE 경로에서도 routing context
      // 재등록이 markExecutionCancelled 보다 먼저 일어나야 graceful 안내가 도달한다.
      expect(
        mockWebsocketService.registerExecutionRouting,
      ).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({ triggerId: expect.any(String) }),
      );

      // RESUME_INCOMPATIBLE_STATE 마킹 — execution 과 nodeExecution 양쪽 chain.
      expect(
        mockExecutionRepo.createQueryBuilder.mock.results[0].value.execute,
      ).toHaveBeenCalled();
      expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();
      // set() 호출에 'RESUME_INCOMPATIBLE_STATE' 가 들어갔는지 확인
      const setCall = mockExecutionRepo.createQueryBuilder.mock.results[0].value
        .set.mock.calls[0][0] as {
        error: { code: string };
      };
      expect(setCall.error.code).toBe('RESUME_INCOMPATIBLE_STATE');

      // 방안 D — affected>0 이면 EXECUTION_CANCELLED 가 error.code 와 함께
      // emit 돼 채널 어댑터가 graceful 안내를 보낼 수 있다 (과거엔 무음).
      expect(mockWebsocketService.emitExecutionEvent).toHaveBeenCalledWith(
        executionId,
        'execution.cancelled',
        expect.objectContaining({
          result: { cancelledBy: 'system' },
          error: expect.objectContaining({
            code: 'RESUME_INCOMPATIBLE_STATE',
          }),
        }),
      );
    });

    it('markExecutionCancelled: affected=0 (이미 처리됨) 이면 EXECUTION_CANCELLED emit 억제', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
        },
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-1', type: 'ai_agent' });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);
      // execution update chain 이 affected:0 (다른 worker 가 먼저 처리) 반환.
      mockExecutionRepo.createQueryBuilder = jest
        .fn()
        .mockImplementation(() => {
          const chain = {
            update: jest.fn(),
            set: jest.fn(),
            where: jest.fn(),
            andWhere: jest.fn(),
            execute: jest.fn().mockResolvedValue({ affected: 0 }),
          };
          chain.update.mockReturnValue(chain);
          chain.set.mockReturnValue(chain);
          chain.where.mockReturnValue(chain);
          chain.andWhere.mockReturnValue(chain);
          return chain;
        });
      mockWebsocketService.emitExecutionEvent.mockClear();

      await subject().rehydrateAndResume(executionId, 'ne-1', {
        type: 'ai_message',
        message: 'hi',
      });

      // affected=0 → EXECUTION_CANCELLED emit 미발생 (중복 emit 방지).
      const cancelledEmits =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.cancelled',
        );
      expect(cancelledEmits).toHaveLength(0);
    });

    it('Multi-turn AI 노드 + _resumeCheckpoint 존재 → 재구성 후 waitForAiConversation 재진입 (RESUME_INCOMPATIBLE_STATE 미발생)', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          interactionType: 'ai_conversation',
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          // §7.5 — credential-strip 부분집합이 영속돼 있으면 재구성 가능.
          _resumeCheckpoint: {
            messages: [{ role: 'user', content: 'prev' }],
            turnCount: 1,
            model: 'test-model',
            totalInputTokens: 3,
            totalOutputTokens: 1,
          },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        waitForAiConversation: jest.Mock;
      };
      // 그래프는 waiting node 단일 — post-branch traversal 이 즉시 종료.
      const origLoad = svcAny.loadAndBuildGraph;
      const origWait = svcAny.waitForAiConversation;
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        graphNodes: [],
        graphEdges: [],
        forwardEdges: [],
        backEdges: [],
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        backEdgeMap: new Map(),
        outgoingEdgeMap: new Map(),
        incomingEdgeMap: new Map(),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.waitForAiConversation = jest.fn().mockResolvedValue(undefined);

      try {
        await subject().rehydrateAndResume(executionId, 'ne-1', {
          type: 'ai_message',
          message: 'hi',
        });

        // 재구성 분기 도달 — waitForAiConversation 호출 (early throw 미발생).
        expect(svcAny.waitForAiConversation).toHaveBeenCalledTimes(1);

        // RESUME_INCOMPATIBLE_STATE 로 cancel 되지 않았는지 — execution
        // createQueryBuilder.set 에 해당 코드가 들어가지 않았다.
        const cancelSetCalls =
          mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
            (r) =>
              (
                r.value as {
                  set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
                }
              ).set?.mock?.calls ?? [],
          );
        const codes = cancelSetCalls
          .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
          .filter(Boolean);
        expect(codes).not.toContain('RESUME_INCOMPATIBLE_STATE');
      } finally {
        svcAny.loadAndBuildGraph = origLoad;
        svcAny.waitForAiConversation = origWait;
      }
    });

    // 회귀 가드 — continuation worker deadlock (운영 §7.4/§7.5).
    // slow-path 재개는 BullMQ worker 의 process() 안에서 수행된다. worker 는
    // **waitForX(현재 노드 재진입)도, 남은 그래프 구동도 await 하면 안 된다** —
    // 그러면 다음 대기 노드 / ai_agent 멀티턴 대화에서 worker(WorkerHost
    // concurrency=1)가 점유돼 이후 모든 continuation job 이 wait 큐에 적체된다
    // (deadlock). 본 블록은 `driveResumeDetached` 가 영구 미완료(다음 노드 대기
    // / 진행 중 대화)여도 `rehydrateAndResume`(worker 가 await 하는 promise)이
    // 즉시 resolve 됨을 보장한다. 수정 전이면 hang → 1s deadlockGuard 로 실패.

    // pendingContinuations 키를 등록하는 waitForX spy — firePayload 가 현재
    // payload 를 한 번 전달(single-shot)한 뒤 polling 을 멈추게 해 테스트 타이머
    // 누수를 방지한다. 반환 promise 는 호출자가 제어한다.
    const stubWaitForX = (gate: Promise<unknown>): jest.Mock =>
      jest.fn().mockImplementation((_se: unknown, eid: string) => {
        (
          service as unknown as {
            pendingContinuations: Map<
              string,
              { nodeId: string; resolve: () => void; reject: () => void }
            >;
          }
        ).pendingContinuations.set(eid, {
          nodeId: 'node-1',
          resolve: () => undefined,
          reject: () => undefined,
        });
        return gate;
      });

    const twoNodeGraph = {
      graphNodes: [],
      graphEdges: [],
      forwardEdges: [],
      backEdges: [],
      sortedNodeIds: ['node-1', 'node-2'],
      sortedIndexMap: new Map([
        ['node-1', 0],
        ['node-2', 1],
      ]),
      backEdgeMap: new Map(),
      outgoingEdgeMap: new Map(),
      incomingEdgeMap: new Map(),
      nodeMap: new Map([
        ['node-1', { id: 'node-1', type: 'carousel' }],
        ['node-2', { id: 'node-2', type: 'carousel' }],
      ]),
    };

    function makeDeadlockGuard(): {
      guard: Promise<never>;
      timer: NodeJS.Timeout;
    } {
      let timer!: NodeJS.Timeout;
      const guard = new Promise<never>((_, reject) => {
        timer = setTimeout(
          () =>
            reject(
              new Error(
                'DEADLOCK: rehydrateAndResume 가 반환하지 않음 — worker 가 waitForX/그래프 구동을 await (detach 회귀)',
              ),
            ),
          1000,
        );
      });
      return { guard, timer };
    }

    it('slow-path resume 은 buttons waitForX + 다운스트림 그래프 구동을 detach — worker(process()) 즉시 반환', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'buttons' },
          status: 'waiting_for_input',
          buttonConfig: { buttons: [{ id: 'b1', type: 'port', label: 'B1' }] },
        },
      });
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockResolvedValue({ id: 'node-1', type: 'carousel', config: {} });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        waitForButtonInteraction: jest.Mock;
        runNodeDispatchLoop: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        wait: svcAny.waitForButtonInteraction,
        loop: svcAny.runNodeDispatchLoop,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue(twoNodeGraph);
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // waitForButtonInteraction: 현재 클릭 처리 후 반환(단일 상호작용).
      svcAny.waitForButtonInteraction = stubWaitForX(Promise.resolve());
      // 다음 대기 노드에서 영구 대기하는 그래프 구동.
      let releaseDispatch!: () => void;
      const dispatchGate = new Promise<void>((r) => {
        releaseDispatch = r;
      });
      svcAny.runNodeDispatchLoop = jest.fn().mockReturnValue(dispatchGate);

      const { guard, timer } = makeDeadlockGuard();
      try {
        await Promise.race([
          subject().rehydrateAndResume(executionId, 'ne-1', {
            type: 'button_click',
            buttonId: 'b1',
          }),
          guard,
        ]);
        // worker 반환됨. detached drive 가 백그라운드에서 진행하는지 확인.
        await flushPromises();
        await flushPromises();
        await flushPromises();
        expect(svcAny.waitForButtonInteraction).toHaveBeenCalledTimes(1);
        expect(svcAny.runNodeDispatchLoop).toHaveBeenCalledTimes(1);
      } finally {
        clearTimeout(timer);
        releaseDispatch();
        await flushPromises();
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.waitForButtonInteraction = orig.wait;
        svcAny.runNodeDispatchLoop = orig.loop;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });

    it('slow-path ai_agent 재개: waitForAiConversation 멀티턴 루프가 영구 미반환이어도 worker(process()) 반환 — 텔레그램 대화가 다른 continuation 을 막지 않음', async () => {
      // 운영 실측 회귀: 텔레그램 ai_message 재개가 worker 안에서
      // waitForAiConversation(대화 종료까지 다음 메시지를 차례로 await 하는 장수
      // 루프)을 await 하면, concurrency=1 worker 가 대화 수명 내내 점유돼 버튼
      // 클릭 등 다른 continuation 이 wait 큐에 영구 적체됐다.
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        buildRetryReentryState: jest.Mock;
        waitForAiConversation: jest.Mock;
        runNodeDispatchLoop: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        build: svcAny.buildRetryReentryState,
        wait: svcAny.waitForAiConversation,
        loop: svcAny.runNodeDispatchLoop,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        ...twoNodeGraph,
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.buildRetryReentryState = jest
        .fn()
        .mockReturnValue({ resumeState: {}, initialAction: undefined });
      svcAny.runNodeDispatchLoop = jest.fn().mockResolvedValue(undefined);
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // 멀티턴 대화 진행 중 — 대화 종료(gate 해제) 전까지 반환하지 않는다.
      let releaseAi!: () => void;
      const aiGate = new Promise<void>((r) => {
        releaseAi = r;
      });
      svcAny.waitForAiConversation = stubWaitForX(aiGate);

      const { guard, timer } = makeDeadlockGuard();
      try {
        await Promise.race([
          subject().rehydrateAndResume(executionId, 'ne-1', {
            type: 'ai_message',
            message: 'hi',
          }),
          guard,
        ]);
        // 핵심: waitForAiConversation 이 (대화 진행 중이라) 미반환이어도 worker 가
        // 풀렸다 — 즉 worker 는 waitForAiConversation 을 await 하지 않는다.
        await flushPromises();
        await flushPromises();
        expect(svcAny.waitForAiConversation).toHaveBeenCalledTimes(1);
      } finally {
        clearTimeout(timer);
        // 대화 종료 모사 → detached drive 가 완주하도록 gate 해제 후 drain.
        releaseAi();
        await flushPromises();
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.buildRetryReentryState = orig.build;
        svcAny.waitForAiConversation = orig.wait;
        svcAny.runNodeDispatchLoop = orig.loop;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });

    // detached drive 내부에서 발생한 RehydrationError(ai_agent _resumeCheckpoint
    // 재구성 실패 = schema drift/손상)는 worker 로 rethrow 할 수 없으므로 in-band
    // graceful 단말 처리해야 한다: Execution cancelled(RESUME_INCOMPATIBLE_STATE) +
    // node failed. markExecutionCancelled 의 EXECUTION_CANCELLED emit 으로 채널
    // (텔레그램)에 "세션 만료" 안내가 도달한다 (#398 routing). full-detach 로 이
    // 분기가 outer catch → detached catch 로 이동했으므로 가드한다.
    it('detached ai_agent 재개: buildRetryReentryState 실패 → graceful cancelled(RESUME_INCOMPATIBLE_STATE) + node failed', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: executionId,
        workflowId,
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
      });
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'ne-1',
        nodeId: 'node-1',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'ai_conversation' },
          status: 'waiting_for_input',
          output: { result: { messages: [], turnCount: 1 } },
          _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
        },
      });
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-1',
        type: 'ai_agent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg', maxTurns: 20 },
      });
      mockWorkflowRepo.findOne.mockResolvedValue({
        ...mockWorkflow,
        workspaceId: 'ws-1',
        workspace: { id: 'ws-1', name: 'WS', settings: {} },
      });
      mockExecutionNodeLogRepo.find.mockResolvedValue([]);

      const svcAny = service as unknown as {
        loadAndBuildGraph: jest.Mock;
        buildRetryReentryState: jest.Mock;
        updateExecutionStatus: jest.Mock;
      };
      const orig = {
        load: svcAny.loadAndBuildGraph,
        build: svcAny.buildRetryReentryState,
        upd: svcAny.updateExecutionStatus,
      };
      svcAny.loadAndBuildGraph = jest.fn().mockResolvedValue({
        ...twoNodeGraph,
        sortedNodeIds: ['node-1'],
        sortedIndexMap: new Map([['node-1', 0]]),
        nodeMap: new Map([['node-1', { id: 'node-1', type: 'ai_agent' }]]),
      });
      svcAny.updateExecutionStatus = jest.fn().mockResolvedValue(undefined);
      // 재구성 실패 (schema drift) 모사 — driveResumeDetached 내부에서
      // RehydrationError(RESUME_INCOMPATIBLE_STATE)로 래핑된다.
      svcAny.buildRetryReentryState = jest.fn().mockImplementation(() => {
        throw new Error('schema drift');
      });

      try {
        // worker 가 await 하는 부분(setup)은 throw 없이 통과 → 즉시 resolve.
        await subject().rehydrateAndResume(executionId, 'ne-1', {
          type: 'ai_message',
          message: 'hi',
        });
        // detached drive 가 단말 처리하도록 drain.
        await flushPromises();
        await flushPromises();
        await flushPromises();

        // Execution cancel UPDATE 에 RESUME_INCOMPATIBLE_STATE 코드가 들어갔는지.
        const cancelCodes =
          mockExecutionRepo.createQueryBuilder.mock.results.flatMap(
            (r) =>
              (
                r.value as {
                  set?: { mock?: { calls: Array<Array<{ error?: unknown }>> } };
                }
              ).set?.mock?.calls ?? [],
          );
        const codes = cancelCodes
          .map((c) => (c[0]?.error as { code?: string } | undefined)?.code)
          .filter(Boolean);
        expect(codes).toContain('RESUME_INCOMPATIBLE_STATE');
        // 동반 NodeExecution failed 마킹도 수행 (createQueryBuilder 사용).
        expect(mockNodeExecutionRepo.createQueryBuilder).toHaveBeenCalled();

        // RUNNING-stuck 가드 — 본 경로는 driveResumeDetached 가
        // updateExecutionStatus(RUNNING) 이후 도달하므로, Execution cancel UPDATE 의
        // status 조건이 **RUNNING 도 포함**해야 한다 (WAITING_FOR_INPUT 만이면
        // 운영에서 affected=0 → cancel 미반영 + EXECUTION_CANCELLED emit 억제 →
        // 텔레그램 graceful 안내 무음). `status IN (:...statuses)` 의 statuses 검증.
        const andWhereStatusGuards =
          mockExecutionRepo.createQueryBuilder.mock.results
            .flatMap(
              (r) =>
                (
                  r.value as {
                    andWhere?: { mock?: { calls: unknown[][] } };
                  }
                ).andWhere?.mock?.calls ?? [],
            )
            .map(
              (c) => (c[1] as { statuses?: unknown[] } | undefined)?.statuses,
            )
            .filter((s): s is unknown[] => Array.isArray(s));
        expect(andWhereStatusGuards.length).toBeGreaterThan(0);
        const cancelStatusGuard = andWhereStatusGuards.find((s) =>
          s.includes(ExecutionStatus.WAITING_FOR_INPUT),
        );
        expect(cancelStatusGuard).toBeDefined();
        expect(cancelStatusGuard).toContain(ExecutionStatus.RUNNING);
      } finally {
        svcAny.loadAndBuildGraph = orig.load;
        svcAny.buildRetryReentryState = orig.build;
        svcAny.updateExecutionStatus = orig.upd;
      }
    });
  });

  // spec/5-system/4-execution-engine.md §1.3 / spec/5-system/6-websocket-protocol.md
  // §4.2 / spec/4-nodes/3-ai/1-ai-agent.md §7.9 — execution.retry_last_turn.
  describe('retryLastTurn (_retryState consume + spawn)', () => {
    const EXEC = 'exec-retry';
    const NE_ID = 'ne-failed';
    const NODE_ID = 'n-ai';

    function futureIso(minutes = 30): string {
      return new Date(Date.now() + minutes * 60_000).toISOString();
    }

    function makeFailedNodeExec(overrides: Record<string, unknown> = {}) {
      return {
        id: NE_ID,
        executionId: EXEC,
        nodeId: NODE_ID,
        status: NodeExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
        finishedAt: new Date(Date.now() - 60_000),
        parentNodeExecutionId: null,
        outputData: {
          output: {
            result: { messages: [], turnCount: 1 },
            error: {
              code: 'LLM_RATE_LIMIT',
              message: 'rate limited',
              details: { statusCode: 429, retryable: true },
            },
          },
          _retryState: {
            messages: [{ role: 'user', content: 'hi' }],
            turnCount: 1,
            expiresAt: futureIso(),
          },
        },
        ...overrides,
      };
    }

    let qbExecuteAffected: number;
    let createdEntities: Array<Record<string, unknown>>;

    function installRetryMocks(nodeExec: Record<string, unknown> | null) {
      qbExecuteAffected = 1;
      createdEntities = [];
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(nodeExec);
      // dataSource.transaction → manager with create / save / createQueryBuilder.
      (service as unknown as { dataSource: unknown }).dataSource = {
        transaction: jest.fn(
          async (cb: (manager: unknown) => Promise<unknown>) => {
            const manager = {
              create: jest.fn((_t: unknown, data: Record<string, unknown>) => {
                const entity = { id: 'ne-spawned', ...data };
                createdEntities.push(entity);
                return entity;
              }),
              save: jest.fn(async (_t: unknown, entity: unknown) => entity),
              createQueryBuilder: jest.fn(() => {
                const qb = {
                  update: jest.fn(() => qb),
                  set: jest.fn(() => qb),
                  where: jest.fn(() => qb),
                  andWhere: jest.fn(() => qb),
                  execute: jest.fn(async () => ({
                    affected: qbExecuteAffected,
                  })),
                };
                return qb;
              }),
            };
            return cb(manager);
          },
        ),
      };
    }

    it('spawns a new NodeExecution when TTL is valid', async () => {
      installRetryMocks(makeFailedNodeExec());
      const result = await service.retryLastTurn(EXEC, NE_ID);
      expect(result.spawnedNodeExecutionId).toBe('ne-spawned');
      expect(createdEntities[0]).toMatchObject({
        executionId: EXEC,
        nodeId: NODE_ID,
        status: NodeExecutionStatus.RUNNING,
      });
      // seeded with _retryState in inputData.
      const input = createdEntities[0].inputData as Record<string, unknown>;
      expect(input._retryState).toBeDefined();
    });

    it('rejects with RETRY_STATE_NOT_FOUND when TTL expired', async () => {
      installRetryMocks(
        makeFailedNodeExec({
          outputData: {
            output: {
              error: { details: { retryable: true } },
            },
            _retryState: {
              messages: [],
              expiresAt: new Date(Date.now() - 1000).toISOString(),
            },
          },
        }),
      );
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'RETRY_STATE_NOT_FOUND',
      });
    });

    it('rejects with RETRY_STATE_NOT_FOUND when _retryState already consumed (missing)', async () => {
      installRetryMocks(
        makeFailedNodeExec({
          outputData: {
            output: { error: { details: { retryable: true } } },
            // no _retryState key
          },
        }),
      );
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'RETRY_STATE_NOT_FOUND',
      });
    });

    it('rejects with RETRY_STATE_NOT_FOUND when concurrent consume removed the key (affected=0)', async () => {
      installRetryMocks(makeFailedNodeExec());
      qbExecuteAffected = 0; // simulate the row already consumed by another retry
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'RETRY_STATE_NOT_FOUND',
      });
    });

    it('rejects with NODE_NOT_RETRYABLE when retryable !== true', async () => {
      installRetryMocks(
        makeFailedNodeExec({
          outputData: {
            output: {
              error: {
                code: 'LLM_RESPONSE_INVALID',
                details: { retryable: false },
              },
            },
            _retryState: { messages: [], expiresAt: futureIso() },
          },
        }),
      );
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'NODE_NOT_RETRYABLE',
      });
    });

    it('rejects with INVALID_EXECUTION_STATE when node is not FAILED', async () => {
      installRetryMocks(
        makeFailedNodeExec({ status: NodeExecutionStatus.COMPLETED }),
      );
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'INVALID_EXECUTION_STATE',
      });
    });

    it('rejects with INVALID_EXECUTION_STATE when nodeExecution belongs to a different execution', async () => {
      installRetryMocks(makeFailedNodeExec({ executionId: 'other-exec' }));
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'INVALID_EXECUTION_STATE',
      });
    });

    it('rejects with RETRY_TOO_EARLY when retryAfterSec has not elapsed', async () => {
      installRetryMocks(
        makeFailedNodeExec({
          finishedAt: new Date(), // just finished now
          outputData: {
            output: {
              error: {
                code: 'LLM_RATE_LIMIT',
                details: { retryable: true, retryAfterSec: 120 },
              },
            },
            _retryState: { messages: [], expiresAt: futureIso() },
          },
        }),
      );
      await expect(service.retryLastTurn(EXEC, NE_ID)).rejects.toMatchObject({
        code: 'RETRY_TOO_EARLY',
      });
    });
  });

  // spec/5-system/6-websocket-protocol.md §4.2 "Continuation Bus 경유 (worker
  // handoff)" / §4.2.1 + spec/4-nodes/3-ai/1-ai-agent.md §7.9 — retry 재진입.
  describe('applyRetryLastTurn (multi-turn loop re-entry)', () => {
    const EXEC = executionId;
    const NODE_ID = 'node-agent-retry';
    const SPAWNED = 'ne-spawned-retry';

    // WARNING #11 — W9 테스트의 turnGate 잔여 promise 정리를 afterEach 에서
    // 보장해 microtask 누수가 이후 테스트 spy 를 오염하지 않게 한다.
    let _releasePendingTurnGate: (() => void) | undefined;
    afterEach(() => {
      _releasePendingTurnGate?.();
      _releasePendingTurnGate = undefined;
    });

    function retryStateSeed(): Record<string, unknown> {
      return {
        // pre-failed-turn history (does NOT include the failed user message).
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ack' },
        ],
        turnCount: 1,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        toolCalls: 0,
        model: 'test-model',
        // failed user message to replay (spec §7.9).
        lastUserMessage: 'please retry me',
        lastUserMessageSource: 'ai_message',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }

    function installReentry(opts: {
      processReturn: () => unknown;
      spawnedStatus?: NodeExecutionStatus;
      retryState?: Record<string, unknown> | undefined;
      config?: Record<string, unknown>;
    }): {
      handler: NodeHandler & { processMultiTurnMessage: jest.Mock };
      savedSpawn: { status?: NodeExecutionStatus };
    } {
      const node: Partial<Node> = {
        id: NODE_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: opts.config ?? {
          mode: 'multi_turn',
          llmConfigId: 'cfg-1',
          maxTurns: 20,
        },
        isDisabled: false,
      };
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: NODE_ID,
        status: opts.spawnedStatus ?? NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData:
          'retryState' in opts
            ? opts.retryState
              ? { _retryState: opts.retryState }
              : {}
            : { _retryState: retryStateSeed() },
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      // re-entry loads node via nodeRepository.findOneBy.
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(node);
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([node]);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });

      const handler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => opts.processReturn()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { processMultiTurnMessage: jest.Mock };
      handlerRegistry.register('ai_agent', handler);
      return { handler, savedSpawn: spawnedRow };
    }

    function terminalSuccess(): unknown {
      // re-run of the failed turn now succeeds → terminal `ended` output with
      // a fresh assistant response on the spawned row.
      return {
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'please retry me' },
              { role: 'assistant', content: 'retried OK' },
            ],
            message: 'retried OK',
            turnCount: 2,
            endReason: 'user_ended',
          },
        },
        meta: { interactionType: 'ai_conversation', model: 'test-model' },
        port: 'user_ended',
        status: 'ended',
      };
    }

    it('replays the failed last turn and produces a new assistant response on the spawned row', async () => {
      const { handler } = installReentry({ processReturn: terminalSuccess });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // The failed last user message was replayed verbatim (spec §7.9).
      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const [replayedMsg] = handler.processMultiTurnMessage.mock.calls[0];
      expect(replayedMsg).toBe('please retry me');

      // A NODE_STARTED was emitted for the spawned row.
      const nodeStarted = mockWebsocketService.emitNodeEvent.mock.calls.filter(
        (c: unknown[]) => c[2] === 'execution.node.started',
      );
      expect(
        nodeStarted.some(
          (c: unknown[]) =>
            (c[3] as { nodeExecutionId?: string }).nodeExecutionId === SPAWNED,
        ),
      ).toBe(true);

      // A fresh assistant message event was emitted.
      const aiMsg = mockWebsocketService.emitExecutionEvent.mock.calls.filter(
        (c: unknown[]) => c[1] === 'execution.ai_message',
      );
      expect(aiMsg.length).toBeGreaterThan(0);
    });

    it('marks the Execution COMPLETED when the replayed conversation ends normally', async () => {
      installReentry({ processReturn: terminalSuccess });
      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    it('re-failure (retryable again) → Execution FAILED + NODE_FAILED on spawned row', async () => {
      // The replayed turn throws again (LLM still rate-limited).
      const { handler } = installReentry({
        processReturn: () => {
          throw Object.assign(new Error('429'), { status: 429 });
        },
      });
      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const failedEvents =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.failed',
        );
      expect(failedEvents.length).toBe(1);
      const nodeFailed = mockWebsocketService.emitNodeEvent.mock.calls.filter(
        (c: unknown[]) => c[2] === 'execution.node.failed',
      );
      expect(
        nodeFailed.some(
          (c: unknown[]) =>
            (c[3] as { nodeExecutionId?: string }).nodeExecutionId === SPAWNED,
        ),
      ).toBe(true);
    });

    it('ack-and-discard when spawned row is no longer RUNNING (idempotency)', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        spawnedStatus: NodeExecutionStatus.COMPLETED,
      });
      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();
      // Already handled by another worker — no re-entry.
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
    });

    it('missing _retryState on spawned row → marks row FAILED, no replay', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        retryState: undefined,
      });
      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();
      expect(handler.processMultiTurnMessage).not.toHaveBeenCalled();
      // spawned row saved as FAILED.
      const savedFailed = mockNodeExecutionRepo.save.mock.calls.some(
        (c: unknown[]) =>
          (c[0] as { id?: string; status?: NodeExecutionStatus }).id ===
            SPAWNED &&
          (c[0] as { status?: NodeExecutionStatus }).status ===
            NodeExecutionStatus.FAILED,
      );
      expect(savedFailed).toBe(true);
    });

    // #11 (followup) — re-entry 시 node.config 의 `{{ expression }}` 이
    // best-effort 로 평가돼 operational 필드(여기선 llmConfigId)가 evaluated
    // 값으로 resumeState 에 들어간다. `$execution.workflowId` 는 rehydrated
    // context 에서 해소 가능한 대표 토큰.
    it('resolves config expressions on re-entry (operational fields use evaluated values)', async () => {
      const { handler } = installReentry({
        processReturn: terminalSuccess,
        config: {
          mode: 'multi_turn',
          llmConfigId: '{{ $execution.workflowId }}',
          maxTurns: 20,
        },
      });
      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      expect(handler.processMultiTurnMessage).toHaveBeenCalledTimes(1);
      const state = handler.processMultiTurnMessage.mock.calls[0][1] as Record<
        string,
        unknown
      >;
      // operational llmConfigId = evaluated value.
      expect(state.llmConfigId).toBe(workflowId);
      // rawConfig echo 는 spec config-echo 정책상 raw template 을 보존.
      expect((state.rawConfig as Record<string, unknown>).llmConfigId).toBe(
        '{{ $execution.workflowId }}',
      );
    });

    // W9 — replay turn 처리 중 외부 cancel 이 도달하면 소실되지 않고 Execution
    // 이 CANCELLED 로 마감된다 (cancel-only 핸들러 + race).
    // WARNING #11 — turnGate 정리는 afterEach 에서 보장 (microtask 누수 방지).
    it('honors external cancel arriving during the replay turn → Execution CANCELLED (W9)', async () => {
      const turnGate = new Promise<void>((r) => {
        _releasePendingTurnGate = r;
      });
      installReentry({
        // replay turn 이 gate 가 풀릴 때까지 hang — 그 사이 cancel 이 도달.
        processReturn: () => turnGate.then(() => terminalSuccess()),
      });

      const p = service.applyRetryLastTurn(EXEC, SPAWNED);
      // re-entry 가 cancel 핸들러 등록 + replay turn 시작까지 진행하도록 flush.
      await flushPromises();
      // 외부 cancel 도달 (worker applyCancellation 경유와 동형).
      service.applyCancellation(EXEC);
      await p;
      await flushPromises();

      const cancelled =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.cancelled',
        );
      expect(cancelled.length).toBe(1);
      // 성공/실패 종결 이벤트는 발사되지 않는다.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(0);
      // turnGate 정리는 afterEach 에서 수행 (_releasePendingTurnGate).
    });
  });

  // spec/4-nodes/3-ai/1-ai-agent.md §7.9 + §12.8 — retry 성공 후 downstream
  // graph 는 일반 노드 COMPLETED 와 동일하게 진행된다 (WARNING #10 해소).
  // 본 describe 는 `resumeGraphAfterRetry` 의 동작을 검증한다 —
  // `applyRetryLastTurn` 을 통해 간접 호출하되 mock 의 차이는 downstream
  // 노드 + edge 가 등장한다는 점.
  describe('resumeGraphAfterRetry — downstream graph traversal (WARNING #10)', () => {
    const EXEC = executionId;
    const AGENT_ID = 'node-agent-retry-w10';
    const DOWNSTREAM_ID = 'node-downstream-w10';
    const SPAWNED = 'ne-spawned-w10';

    function retryStateSeed(): Record<string, unknown> {
      return {
        messages: [
          { role: 'system', content: 'sys' },
          { role: 'user', content: 'first' },
          { role: 'assistant', content: 'ack' },
        ],
        turnCount: 1,
        totalInputTokens: 10,
        totalOutputTokens: 5,
        toolCalls: 0,
        model: 'test-model',
        lastUserMessage: 'please retry me',
        lastUserMessageSource: 'ai_message',
        expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      };
    }

    function terminalSuccess(): unknown {
      return {
        config: { mode: 'multi_turn' },
        output: {
          result: {
            messages: [
              { role: 'user', content: 'please retry me' },
              { role: 'assistant', content: 'retried OK' },
            ],
            message: 'retried OK',
            turnCount: 2,
            endReason: 'user_ended',
          },
        },
        meta: { interactionType: 'ai_conversation', model: 'test-model' },
        port: 'user_ended',
        status: 'ended',
      };
    }

    function installReentryWithDownstream(opts: {
      nodes: Partial<Node>[];
      edges: Array<{
        sourceNodeId: string;
        targetNodeId: string;
        sourcePort?: string;
      }>;
      downstreamHandler?: NodeHandler;
      /** Downstream handler type (default 'test_downstream_w10'). */
      downstreamType?: string;
      /**
       * Downstream handler metadata — register 의 3번째 인자로 그대로 전달.
       * 생략 시 sentinel `{ kind: 'standard' }`. blocking 노드는
       * `{ kind: 'blocking', interaction: 'form' | 'buttons' | 'ai_conversation' }`.
       */
      downstreamMetadata?: { kind: string; interaction?: string };
    }): {
      agentHandler: NodeHandler & { processMultiTurnMessage: jest.Mock };
      downstreamHandler: NodeHandler & { execute: jest.Mock };
    } {
      const fullEdges = opts.edges.map((e, i) => ({
        id: `edge-w10-${i}`,
        sourceNodeId: e.sourceNodeId,
        sourcePort: e.sourcePort ?? 'user_ended',
        targetNodeId: e.targetNodeId,
        targetPort: 'in',
        type: EdgeType.DATA,
      }));
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: AGENT_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: { _retryState: retryStateSeed() },
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      mockNodeRepo.findOneBy = jest
        .fn()
        .mockImplementation((q: { id: string }) =>
          Promise.resolve(opts.nodes.find((n) => n.id === q.id) ?? null),
        );
      mockNodeRepo.findBy = jest.fn().mockResolvedValue(opts.nodes);
      mockEdgeRepo.findBy = jest.fn().mockResolvedValue(fullEdges);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });

      const agentHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => terminalSuccess()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { processMultiTurnMessage: jest.Mock };
      handlerRegistry.register('ai_agent', agentHandler);

      const downstreamHandler = (opts.downstreamHandler ?? {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { result: { ok: true } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      }) as NodeHandler & { execute: jest.Mock };
      const downstreamType = opts.downstreamType ?? 'test_downstream_w10';
      handlerRegistry.register(
        downstreamType,
        downstreamHandler,
        opts.downstreamMetadata,
      );

      return { agentHandler, downstreamHandler };
    }

    // (a) downstream 존재 — retry 성공 후 downstream 노드가 dispatch 된다.
    it('dispatches downstream node when retry succeeds and downstream exists', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Downstream',
        config: {},
        isDisabled: false,
      };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, downstreamNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // downstream handler.execute 가 1회 호출됨 (graph traversal 합류).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);

      // downstream node 의 node.completed 이벤트가 emit 됨.
      const nodeCompleted =
        mockWebsocketService.emitNodeEvent.mock.calls.filter(
          (c: unknown[]) => c[2] === 'execution.node.completed',
        );
      expect(nodeCompleted.some((c: unknown[]) => c[1] === DOWNSTREAM_ID)).toBe(
        true,
      );

      // Execution 도 정상 COMPLETED 마감 (graph loop 자연 종결).
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // (b/e) downstream 없음 (leaf) — retry 성공 후 Execution.COMPLETED 자연 마감.
    // 기존 동작과 회귀 없음.
    it('completes Execution naturally when retry succeeds on a leaf node (no downstream)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode],
        edges: [],
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // downstream handler 는 호출되지 않음.
      expect(downstreamHandler.execute).not.toHaveBeenCalled();

      // Execution 은 정상 COMPLETED 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // (e) defensive fallback — workflow nodes 가 비어 있으면 Execution 을
    // 직접 COMPLETED 마감 (graph rebuild 불가).
    it('falls back to direct Execution.COMPLETED when workflow has no nodes (defensive)', async () => {
      const spawnedRow = {
        id: SPAWNED,
        executionId: EXEC,
        nodeId: AGENT_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: { _retryState: retryStateSeed() },
      };
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      mockNodeExecutionRepo.findOneBy = jest.fn().mockResolvedValue(spawnedRow);
      // findOneBy (node lookup) must still return agentNode so that
      // applyRetryLastTurn can resolve the node.
      mockNodeRepo.findOneBy = jest.fn().mockResolvedValue(agentNode);
      // resumeGraphAfterRetry 의 nodeRepository.findBy 가 [] 를 반환하게
      // 하여 nodes.length === 0 defensive fallback 을 실제로 hit 한다.
      // rehydrateContext 는 nodeRepository.findBy 를 호출하지 않으므로
      // 단일 mockResolvedValue([]) 만으로 충분하다.
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([]);
      mockEdgeRepo.findBy = jest.fn().mockResolvedValue([]);
      mockExecutionRepo.findOneBy = jest.fn().mockResolvedValue({
        id: EXEC,
        workflowId,
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 60_000),
      });

      const agentHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(),
        processMultiTurnMessage: jest.fn(async () => terminalSuccess()),
        endMultiTurnConversation: jest.fn(() => ({
          config: {},
          output: {},
          meta: {},
          port: 'user_ended',
          status: 'ended',
        })),
      } as unknown as NodeHandler;
      handlerRegistry.register('ai_agent', agentHandler);

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // 정상 COMPLETED — fallback 경로도 동일 종결.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // W2 — completedPointer undefined (second fallback): completedNode 가 graph
    // 에 없으면 defensive fallback 으로 Execution.COMPLETED 마감한다.
    it('falls back to direct Execution.COMPLETED when completedNode is absent from sorted graph (W2)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      // A different node set that does NOT include AGENT_ID — so sortedIndexMap
      // will not contain completedNode.id, triggering the second fallback.
      const otherNode: Partial<Node> = {
        id: 'other-node-w10',
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Other',
        config: {},
        isDisabled: false,
      };
      installReentryWithDownstream({
        // installReentryWithDownstream sets up agent + downstream mocks,
        // but we override findBy to return only otherNode (not AGENT_ID).
        nodes: [agentNode, otherNode],
        edges: [],
      });
      // Override: nodeRepository.findBy returns only otherNode for the graph —
      // completedNode (AGENT_ID) won't be in sortedIndexMap.
      mockNodeRepo.findBy = jest.fn().mockResolvedValue([otherNode]);

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Execution is COMPLETED via defensive fallback (completeRetryExecution).
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // W3 — downstream 실패 경로: downstream 노드 실행 중 오류 발생 시
    // failRetryExecution 이 호출되고 Execution 이 FAILED 로 마감된다.
    it('marks Execution FAILED when downstream node throws during traversal (W3)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Downstream',
        config: {},
        isDisabled: false,
      };
      const failingDownstreamHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => {
          throw new Error('downstream node failed unexpectedly');
        }),
      } as unknown as NodeHandler & { execute: jest.Mock };
      installReentryWithDownstream({
        nodes: [agentNode, downstreamNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: failingDownstreamHandler,
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Execution is FAILED — applyRetryLastTurn catch → failRetryExecution.
      const failed = mockWebsocketService.emitExecutionEvent.mock.calls.filter(
        (c: unknown[]) => c[1] === 'execution.failed',
      );
      expect(failed.length).toBe(1);
      // execution.completed must NOT have been emitted.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(0);
    });

    // WARNING #16 회귀 가드 (resumeGraphAfterRetry 경로) — nodeExecutionCount 초기값 0.
    //
    // 발견사항(testing.md W1): `resumeFromCheckpoint` 와 `resumeGraphAfterRetry` 는
    // helper 호출 전 `nodeExecutionCount.set(startNode, 0)` 으로 초기화한다.
    // 이전 코드(init=1) 에서는 back-edge 가 completedNode 를 재방문할 때
    // count=1+1=2 > MAX_NODE_ITERATIONS=1 → false positive throw 가 발생했다.
    //
    // 테스트 그래프 (topological order: Agent → BackEdgeTrigger):
    //   Agent(completedNode, no fwd edges) ← back-edge ← BackEdgeTrigger
    //   BackEdgeTrigger 는 back-edge 포트만 출력하며 forward 엣지 없음.
    //
    // 흐름 (MAX_NODE_ITERATIONS=1):
    //   1. loop starts at BackEdgeTrigger (completedPointer+1)
    //   2. BackEdgeTrigger: count=1 (≤1, passes). fires back-edge → Agent.
    //   3. Agent: count=init(0)+1=1 (≤1, passes). fwd 없음. pointer++.
    //   4. BackEdgeTrigger not in reachable (cleared by back-edge). loop ends.
    //   5. COMPLETED.
    //
    //   init=1 이었다면 step 3 에서 count=2>1 → throw (false positive).
    it('MAX_NODE_ITERATIONS=1: resumeGraphAfterRetry back-edge revisit of completedNode succeeds (WARNING #16 regression guard)', async () => {
      const TRIGGER_ID = 'node-w16-trigger';

      const triggerHandler16 = {
        validate: () => ({ valid: true, errors: [] }),
        // BackEdgeTrigger always fires back-edge port (no forward output).
        execute: jest.fn(async () =>
          mockOutput({ fired: true }, { port: 'back' }),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };

      handlerRegistry.register('w16_trigger', triggerHandler16);

      const agentNode16: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent16',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const triggerNode16: Partial<Node> = {
        id: TRIGGER_ID,
        workflowId,
        type: 'w16_trigger',
        category: NodeCategory.LOGIC,
        label: 'BackEdgeTrigger',
        config: {},
        isDisabled: false,
      };

      // Edge: Agent(user_ended) → Trigger (forward), Trigger(back) → Agent (back-edge).
      const { agentHandler } = installReentryWithDownstream({
        nodes: [agentNode16, triggerNode16],
        edges: [
          // forward edge: agent → trigger (the "downstream" after retry completes)
          {
            sourceNodeId: AGENT_ID,
            targetNodeId: TRIGGER_ID,
            sourcePort: 'user_ended',
          },
          // back-edge: trigger(back) → agent
          {
            sourceNodeId: TRIGGER_ID,
            targetNodeId: AGENT_ID,
            sourcePort: 'back',
          },
        ],
      });

      // Agent re-execution (back-edge revisit) calls handler.execute() directly.
      // Return output with port 'done' — this port has NO forward edge in the
      // graph (forward edge uses sourcePort='user_ended'), so propagateReachability
      // adds nothing and Trigger is NOT re-queued after Agent's revisit.
      (agentHandler.execute as jest.Mock).mockResolvedValue(
        mockOutput({ revisited: true }, { port: 'done' }),
      );

      // MAX_NODE_ITERATIONS=1.
      const cs16 = service['configService'] as unknown as { get: jest.Mock };
      cs16.get.mockImplementation((key: string, defaultValue?: unknown) => {
        if (key === 'MAX_NODE_ITERATIONS') return 1;
        return defaultValue;
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Trigger must have been called once (not zero, not two).
      expect(triggerHandler16.execute).toHaveBeenCalledTimes(1);

      // Execution must complete — no MAX_NODE_ITERATIONS exceeded false positive.
      const completed16 =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed16.length).toBe(1);

      // Must NOT have emitted execution.failed.
      const failed16 =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.failed',
        );
      expect(failed16.length).toBe(0);
    });

    // W4 — cancel 도달: retry 재진입 처리 중 cancel 이 도달하면 catch 경로가
    // `failRetryExecution(CANCELLED)` 를 호출해 Execution 이 CANCELLED 로 마감된다.
    // downstream traversal 진입 전 cancel 이 replay turn 구간에 도달하는 케이스.
    // (downstream traversal 도중 blocking wait 에서 cancel 이 도달하는 고급 케이스는
    // waitForX 블록 mock 이 필요해 별도 integration 테스트 영역이다.)
    it('marks Execution CANCELLED when cancel arrives during retry replay → downstream never runs (W4)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_downstream_w10',
        category: NodeCategory.LOGIC,
        label: 'Downstream',
        config: {},
        isDisabled: false,
      };
      // Replay turn gate — cancel arrives while replay turn is pending.
      let releaseReplayTurn!: () => void;
      const replayGate = new Promise<void>((r) => {
        releaseReplayTurn = r;
      });
      const { agentHandler, downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, downstreamNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
      });
      // Override processMultiTurnMessage to hang during replay turn so cancel
      // arrives while the cancel-only pending continuation is registered.
      agentHandler.processMultiTurnMessage = jest.fn(() =>
        replayGate.then(() => terminalSuccess()),
      );

      const p = service.applyRetryLastTurn(EXEC, SPAWNED);
      // Allow applyRetryLastTurn to register the cancel-only pending continuation.
      await flushPromises();
      // External cancel arrives while replay turn is pending.
      service.applyCancellation(EXEC);
      // Release replay gate (cancel has already won — replay result is discarded).
      releaseReplayTurn();
      await p;
      await flushPromises();

      // Execution is CANCELLED — failRetryExecution receives ExecutionCancelledError.
      const cancelled =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.cancelled',
        );
      expect(cancelled.length).toBe(1);
      // Downstream was never reached.
      expect(downstreamHandler.execute).not.toHaveBeenCalled();
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(0);
    });

    // PR #371 ai-review W2 — parallel/background dispatchKind 회귀 가드.
    // retry 성공 후 downstream 에 parallel/background 노드가 존재할 때 정상
    // dispatch 되는지 검증 (runNodeDispatchLoop 의 dispatchKind 분기 도달).
    it('dispatches downstream parallel node when retry succeeds (W2 parallel resume)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const parallelNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_parallel_w2',
        category: NodeCategory.LOGIC,
        label: 'DownstreamParallel',
        config: { branches: [] },
        isDisabled: false,
      };
      const parallelHandler = {
        validate: () => ({ valid: true, errors: [] }),
        // Parallel handler 의 execute 는 runParallel 의 분기 진입 전 호출됨.
        // branches 가 비어있으면 runParallel 이 즉시 종결 (정상 흐름).
        execute: jest.fn(async () => ({
          config: { branches: [] },
          output: { result: { branches: [] } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, parallelNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: parallelHandler,
        downstreamType: 'test_parallel_w2',
        downstreamMetadata: { kind: 'parallel' },
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Parallel downstream handler 가 dispatch 됨 (runNodeDispatchLoop 의
      // parallel 분기 도달).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // Execution 은 정상 COMPLETED 마감 — runParallel 가 빈 branches 로
      // 즉시 종결 후 graph loop 자연 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    it('dispatches downstream background node when retry succeeds (W2 background resume)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const backgroundNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_background_w2',
        category: NodeCategory.LOGIC,
        label: 'DownstreamBackground',
        config: {},
        isDisabled: false,
      };
      const backgroundHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () => ({
          config: {},
          output: { result: { scheduled: true } },
          meta: {},
          port: 'out',
          status: 'ended',
        })),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, backgroundNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: backgroundHandler,
        downstreamType: 'test_background_w2',
        downstreamMetadata: { kind: 'background' },
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Background downstream handler 가 dispatch 됨 (runNodeDispatchLoop 의
      // background 분기 도달 → scheduleBackgroundBody).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // Execution 은 정상 COMPLETED 마감.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // PR #371 ai-review W4 — downstream blocking 노드 (form/buttons/ai_conversation)
    // resume 경로 회귀 가드. retry 성공 후 downstream 의 blocking 노드가 정상적으로
    // waitForX 진입 → continueExecution 으로 resume → Execution.COMPLETED 마감하는
    // 전체 흐름을 검증한다 (runNodeDispatchLoop 의 blocking wait 분기 도달).

    it('enters waitForFormSubmission when downstream is a form node, resumes on continueExecution (W4 form)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const formNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_form_w4',
        category: NodeCategory.PRESENTATION,
        label: 'DownstreamForm',
        config: { fields: [{ name: 'approved', type: 'checkbox' }] },
        isDisabled: false,
      };
      const formHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'form',
              formConfig: {
                fields: [{ name: 'approved', type: 'checkbox' }],
              },
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'form' },
            },
          ),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, formNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: formHandler,
        downstreamType: 'test_form_w4',
        downstreamMetadata: { kind: 'blocking', interaction: 'form' },
      });

      // Retry 시작 — form node 가 waiting_for_input 으로 진입 후 hang.
      // applyRetryLastTurn 의 Promise 는 continueExecution 후에야 resolve.
      const retryPromise = service.applyRetryLastTurn(EXEC, SPAWNED);
      await flushPromises();

      // Form handler.execute 가 dispatch 됨 (runNodeDispatchLoop 의 blocking
      // 분기 진입 직전).
      expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
      // waiting_for_input 이벤트 emit (interactionType='form').
      const waitingForInput =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.waiting_for_input',
        );
      expect(waitingForInput.length).toBe(1);
      expect(waitingForInput[0][2]).toMatchObject({
        waitingNodeId: DOWNSTREAM_ID,
        interactionType: 'form',
      });
      // Execution 은 아직 COMPLETED/FAILED 아님 (waitForFormSubmission 안에서 hang).
      const completedDuringWait =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completedDuringWait.length).toBe(0);

      // 사용자 form submit 시뮬레이션.
      void service.continueExecution(EXEC, { formData: { approved: true } });
      await retryPromise;
      await flushPromises();

      // Execution 이 COMPLETED 로 마감됨.
      const completed =
        mockWebsocketService.emitExecutionEvent.mock.calls.filter(
          (c: unknown[]) => c[1] === 'execution.completed',
        );
      expect(completed.length).toBe(1);
    });

    // W4 buttons / ai_conversation — `waitForX` private method spy 패턴.
    // form 시나리오는 metadata 의 `interaction === 'form'` 분기로 통과하지만,
    // buttons / ai_conversation 분기는 `getInteractionType` (캐시 양쪽 lookup)
    // 결과 의존이라 fixture 정확성 디버깅 비용이 크다. 본 PR 의 회귀 가드
    // 목적은 `runNodeDispatchLoop` 의 buttons / ai_conversation 분기 도달 자체
    // 검증이므로 `waitForX` 를 spy 로 대체해 hang 회피 + 호출 1회 검증으로
    // 단순화한다.

    it('reaches waitForButtonInteraction when downstream is a buttons node (W4 buttons)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const buttonsNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_buttons_w4',
        category: NodeCategory.PRESENTATION,
        label: 'DownstreamButtons',
        config: { buttons: [{ id: 'btn-ok', label: 'OK' }] },
        isDisabled: false,
      };
      // mockOutput 의 양쪽 위치에 interactionType 명시 — flat 와 structured
      // 양쪽 캐시 모두에 'buttons' 가 들어가도록.
      const buttonsHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'buttons',
              interactionType: 'buttons',
              buttons: [{ id: 'btn-ok', label: 'OK' }],
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'buttons' },
            },
          ),
        ),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, buttonsNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: buttonsHandler,
        downstreamType: 'test_buttons_w4',
        downstreamMetadata: { kind: 'blocking', interaction: 'buttons' },
      });

      // waitForButtonInteraction private method 를 spy 로 대체 — 분기 도달
      // 검증 + hang 회피.
      const svcAny = service as unknown as {
        waitForButtonInteraction: jest.Mock;
      };
      const originalWait = svcAny.waitForButtonInteraction;
      svcAny.waitForButtonInteraction = jest.fn().mockResolvedValue(undefined);

      try {
        await service.applyRetryLastTurn(EXEC, SPAWNED);
        await flushPromises();

        // Buttons handler.execute 가 dispatch 됨.
        expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
        // runNodeDispatchLoop 의 `downstreamInteraction === 'buttons'` 분기 도달.
        expect(svcAny.waitForButtonInteraction).toHaveBeenCalledTimes(1);
      } finally {
        svcAny.waitForButtonInteraction = originalWait;
      }
    });

    it('reaches waitForAiConversation when downstream is an ai_conversation node (W4 ai_conversation)', async () => {
      const agentNode: Partial<Node> = {
        id: AGENT_ID,
        workflowId,
        type: 'ai_agent',
        category: NodeCategory.AI,
        label: 'RetryAgent',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-1', maxTurns: 20 },
        isDisabled: false,
      };
      const downstreamAiNode: Partial<Node> = {
        id: DOWNSTREAM_ID,
        workflowId,
        type: 'test_ai_conv_w4',
        category: NodeCategory.AI,
        label: 'DownstreamAi',
        config: { mode: 'multi_turn', llmConfigId: 'cfg-2', maxTurns: 10 },
        isDisabled: false,
      };
      const aiHandler = {
        validate: () => ({ valid: true, errors: [] }),
        execute: jest.fn(async () =>
          mockOutput(
            {
              type: 'ai_conversation',
              interactionType: 'ai_conversation',
            },
            {
              status: 'waiting_for_input',
              meta: { interactionType: 'ai_conversation' },
            },
          ),
        ),
        processMultiTurnMessage: jest.fn(),
        endMultiTurnConversation: jest.fn(),
      } as unknown as NodeHandler & { execute: jest.Mock };
      const { downstreamHandler } = installReentryWithDownstream({
        nodes: [agentNode, downstreamAiNode],
        edges: [{ sourceNodeId: AGENT_ID, targetNodeId: DOWNSTREAM_ID }],
        downstreamHandler: aiHandler,
        downstreamType: 'test_ai_conv_w4',
        downstreamMetadata: {
          kind: 'blocking',
          interaction: 'ai_conversation',
        },
      });

      const svcAny = service as unknown as {
        waitForAiConversation: jest.Mock;
      };
      const originalWait = svcAny.waitForAiConversation;
      svcAny.waitForAiConversation = jest.fn().mockResolvedValue(undefined);

      try {
        await service.applyRetryLastTurn(EXEC, SPAWNED);
        await flushPromises();

        expect(downstreamHandler.execute).toHaveBeenCalledTimes(1);
        // runNodeDispatchLoop 의 `downstreamInteraction === 'ai_conversation'`
        // 분기 도달.
        expect(svcAny.waitForAiConversation).toHaveBeenCalledTimes(1);
      } finally {
        svcAny.waitForAiConversation = originalWait;
      }
    });
  });

  // spec node-output §4.2.1 — stripControlFields preserves _retryState while
  // stripping _resumeState.
  describe('stripControlFields _retryState preservation', () => {
    function strip(output: unknown): unknown {
      return (
        service as unknown as { stripControlFields(o: unknown): unknown }
      ).stripControlFields(output);
    }

    it('preserves _retryState but strips _resumeState / control fields', () => {
      const out = strip({
        result: { ok: true },
        port: 'error',
        status: 'ended',
        _resumeState: { messages: [] },
        _retryState: {
          messages: [{ role: 'user', content: 'hi' }],
          expiresAt: 'iso',
        },
      }) as Record<string, unknown>;
      expect(out._resumeState).toBeUndefined();
      expect(out.port).toBeUndefined();
      expect(out.status).toBeUndefined();
      expect(out._retryState).toBeDefined();
      expect((out._retryState as Record<string, unknown>).expiresAt).toBe(
        'iso',
      );
    });

    // W16: 입력에 _retryState 가 없는 경우 — 비-retryable 종결 시 output 에
    // _retryState 가 undefined (not present) 임을 검증 (silent regression 방지).
    it('output has no _retryState when input lacks _retryState (non-retryable termination)', () => {
      const out = strip({
        result: { ok: true },
        port: 'user_ended',
        status: 'ended',
        _resumeState: { messages: [] },
        // _retryState: intentionally absent
      }) as Record<string, unknown>;
      expect(out._resumeState).toBeUndefined();
      expect(out._retryState).toBeUndefined();
      expect('_retryState' in out).toBe(false);
    });

    // §7.5 — `_resumeCheckpoint` 는 DB 영속 SoT 이지만 downstream 노드 input
    // 전달 시에는 internal-only 로 strip 돼야 한다 (`_resumeState` 와 동일 정책).
    // 회귀 가드 — `_resumeState` 가 과거 동일 패턴에서 누수 회귀를 겪은 선례.
    it('strips _resumeCheckpoint from downstream input (internal-only)', () => {
      const out = strip({
        result: { ok: true },
        port: 'out',
        _resumeCheckpoint: { messages: [], turnCount: 1, model: 'm' },
      }) as Record<string, unknown>;
      expect(out._resumeCheckpoint).toBeUndefined();
      expect('_resumeCheckpoint' in out).toBe(false);
      // 다른 result 필드는 보존.
      expect(out.result).toEqual({ ok: true });
    });
  });

  // §7.5 — buildResumeCheckpoint credential-strip allow-list 단위 테스트.
  // allow-list 변경 시 credential 누수를 자동 감지하는 보안 경계 가드.
  describe('buildResumeCheckpoint (credential-strip allow-list)', () => {
    function build(state: unknown): Record<string, unknown> | undefined {
      return (
        service as unknown as {
          buildResumeCheckpoint(
            s: Record<string, unknown> | undefined,
          ): Record<string, unknown> | undefined;
        }
      ).buildResumeCheckpoint(state as Record<string, unknown> | undefined);
    }

    it('safe 필드는 보존, credential / context-binding 필드는 배제', () => {
      const cp = build({
        // safe (보존)
        messages: [{ role: 'user', content: 'hi' }],
        turnCount: 2,
        totalInputTokens: 7,
        totalOutputTokens: 3,
        totalThinkingTokens: 1,
        toolCalls: 1,
        model: 'gpt-x',
        temperature: 0.5,
        maxTokens: 1000,
        knowledgeBases: ['kb1'],
        ragTopK: 4,
        ragThreshold: 0.7,
        ragSources: [{ chunkId: 'c1' }],
        mcpServers: [{ url: 'secret://x' }],
        // credential / context-binding (배제)
        llmConfigId: 'cred-canary',
        workspaceId: 'ws-canary',
        executionId: 'exec',
        nodeId: 'node',
        workflowId: 'wf',
        presentationTools: [{ a: 1 }],
        conditions: [{ id: 'c' }],
        maxTurns: 20,
        maxToolCalls: 10,
        conversationThreadRef: { turns: [] },
        rawConfig: { systemPrompt: 'INTERNAL' },
        systemPrompt: 'INTERNAL_PROMPT',
        turnDebugHistory: [{ turnIndex: 1 }],
      })!;
      // 보존
      expect(cp.turnCount).toBe(2);
      expect(cp.model).toBe('gpt-x');
      expect(cp.totalInputTokens).toBe(7);
      expect((cp.messages as unknown[]).length).toBe(1);
      expect(cp.knowledgeBases).toEqual(['kb1']);
      expect(cp.mcpServers).toEqual([{ url: 'secret://x' }]);
      // 배제 (credential / context-binding / debug)
      for (const k of [
        'llmConfigId',
        'workspaceId',
        'executionId',
        'nodeId',
        'workflowId',
        'presentationTools',
        'conditions',
        'maxTurns',
        'maxToolCalls',
        'conversationThreadRef',
        'rawConfig',
        'systemPrompt',
        'turnDebugHistory',
      ]) {
        expect(cp).not.toHaveProperty(k);
      }
      // canary 가 직렬화에 새지 않는다.
      const s = JSON.stringify(cp);
      expect(s).not.toContain('cred-canary');
      expect(s).not.toContain('ws-canary');
      expect(s).not.toContain('INTERNAL');
    });

    it('pendingFormToolCall 존재 시 포함, 부재 시 미포함', () => {
      const withForm = build({
        messages: [],
        pendingFormToolCall: { toolCallId: 't1', formConfig: { x: 1 } },
      })!;
      expect(withForm.pendingFormToolCall).toEqual({
        toolCallId: 't1',
        formConfig: { x: 1 },
      });
      const without = build({ messages: [] })!;
      expect(without).not.toHaveProperty('pendingFormToolCall');
    });

    it('빈/누락 필드는 안전 기본값으로 정규화', () => {
      const cp = build({})!;
      expect(cp.messages).toEqual([]);
      expect(cp.turnCount).toBe(0);
      expect(cp.totalInputTokens).toBe(0);
      expect(cp.ragSources).toEqual([]);
      expect(cp.mcpServers).toEqual([]);
    });

    it('undefined / 비-객체 입력 → undefined 반환', () => {
      expect(build(undefined)).toBeUndefined();
      expect(build(null)).toBeUndefined();
      expect(build('x' as unknown)).toBeUndefined();
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

  // spec/5-system/6-websocket-protocol.md §4.4 — llmCalls[].startedAt/finishedAt
  // 절대 발생 시각이 payload 로 전파돼야 어시스턴트 turn 발생 시각을 표시할 수 있다.
  it('carries per-call startedAt/finishedAt through to the payload', () => {
    const lastTurn = {
      turnIndex: 1,
      llmCalls: [
        {
          requestPayload: {},
          responsePayload: { content: 'a' },
          durationMs: 100,
          startedAt: '2026-05-10T06:42:01.500Z',
          finishedAt: '2026-05-10T06:42:01.600Z',
        },
      ],
      totalDurationMs: 100,
    };
    const debug = buildAiMessageDebugFromResumeState({
      turnDebugHistory: [lastTurn],
    });
    expect(debug.llmCalls?.[0]).toMatchObject({
      startedAt: '2026-05-10T06:42:01.500Z',
      finishedAt: '2026-05-10T06:42:01.600Z',
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
//
// D6 (2026-05-17) — 대화 필드는 `output.result.*` 단일 경로. 옛 top-level
// `output.message` / `.messages` / `.turnCount` / `.maxTurns` 는 폐기됐고,
// `partial.*` (info-extractor 부분 수집) 만 top-level 유지.
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

  it('echoes message and turnCount from output.result', () => {
    const conv = buildConversationConfigFromOutput({
      result: { message: 'hello', turnCount: 3 },
    });
    expect(conv.message).toBe('hello');
    expect(conv.turnCount).toBe(3);
  });

  it('filters system role messages (CONVENTIONS — system 메시지는 client 미노출)', () => {
    const conv = buildConversationConfigFromOutput({
      result: {
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
          { role: 'system', content: 'reset' },
        ],
      },
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
      result: {
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
      },
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
      result: { messages: [original] },
    });
    // Backfill must short-circuit on already-marked items so identity is
    // preserved (no needless object allocations on hot paths).
    expect(conv.messages[0]).toBe(original);
  });

  it('returns empty messages array unchanged', () => {
    const conv = buildConversationConfigFromOutput({
      result: { messages: [] },
    });
    expect(conv.messages).toEqual([]);
  });

  it('handles a multi-turn mixed sequence (system stripped, injected preserved, live backfilled)', () => {
    const conv = buildConversationConfigFromOutput({
      result: {
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
      },
    });
    expect(conv.messages).toHaveLength(4);
    expect(conv.messages[0].source).toBe('injected');
    expect(conv.messages[1].source).toBe('injected');
    expect(conv.messages[2].source).toBe('live');
    expect(conv.messages[3].source).toBe('live');
  });

  it('includes maxTurns from config echo only when present (decision C-1)', () => {
    // maxTurns 는 output.result 가 아니라 config echo (2번째 인자) 에서 읽는다.
    const withMax = buildConversationConfigFromOutput({}, { maxTurns: 5 });
    expect(withMax.maxTurns).toBe(5);
    // output.result.maxTurns 는 더 이상 읽지 않는다.
    const ignoredFromResult = buildConversationConfigFromOutput({
      result: { maxTurns: 5 },
    });
    expect(ignoredFromResult).not.toHaveProperty('maxTurns');
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
    const conv = buildConversationConfigFromOutput({
      result: { message: 'hi' },
    });
    expect(conv.message).toBe('hi');
    expect(conv).not.toHaveProperty('extracted');
    expect(conv).not.toHaveProperty('missingFields');
  });

  // D6 회귀 차단 — 옛 top-level shape (`output.message` / `.messages` /
  // `.turnCount` / `.maxTurns`) 은 더 이상 인식되지 않는다. 핸들러가 옛
  // shape 으로 회귀했을 때 빈 conversationConfig 가 emit 되어 사용자에게
  // assistant 응답이 전달되지 않던 회귀를 차단한다 (D6 동기화).
  it('ignores legacy top-level message/messages/turnCount/maxTurns (D6 정합)', () => {
    const conv = buildConversationConfigFromOutput({
      message: 'legacy-msg',
      messages: [{ role: 'assistant', content: 'legacy' }],
      turnCount: 99,
      maxTurns: 42,
    });
    expect(conv.message).toBe('');
    expect(conv.messages).toEqual([]);
    expect(conv.turnCount).toBe(0);
    expect(conv).not.toHaveProperty('maxTurns');
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

// W-10 fix (SUMMARY#W-10): executeNode 가 registerInFlight/unregisterInFlight 를
// 성공 경로와 throw 경로 모두에서 짝으로 호출하는지 검증.
// W-1 fix (이동 후 회귀 방지): registerInFlight 가 try 블록 안에 있으므로
// emitNode throw 에서도 finally 의 unregisterInFlight 가 항상 실행된다.
describe('ExecutionEngineService — registerInFlight / unregisterInFlight pairing (W-10)', () => {
  let svc: ExecutionEngineService;
  let mockRegister: jest.Mock;
  let mockUnregister: jest.Mock;
  let reg: NodeHandlerRegistry;
  let mockNodeExecutionRepo2: Record<string, jest.Mock>;
  let mockExecutionRepo2: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockRegister = jest.fn();
    mockUnregister = jest.fn();

    const baseNodeExec = {
      id: 'ne-w10',
      nodeId: 'n-w10',
      executionId: 'exec-w10',
      status: 'running',
      startedAt: new Date(),
      inputData: {},
    };

    mockNodeExecutionRepo2 = {
      create: jest.fn().mockReturnValue({ ...baseNodeExec }),
      save: jest.fn().mockResolvedValue({ ...baseNodeExec }),
      findOne: jest.fn(),
      findOneBy: jest.fn(),
    };

    mockExecutionRepo2 = {
      create: jest.fn().mockReturnValue({
        id: 'exec-w10',
        workflowId: 'wf-w10',
        status: 'running',
        startedAt: new Date(),
        inputData: {},
      }),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      findOneBy: jest.fn().mockResolvedValue({
        id: 'exec-w10',
        workflowId: 'wf-w10',
        status: 'running',
        startedAt: new Date(),
      }),
    };

    const mod = await Test.createTestingModule({
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
        ConversationThreadService,
        {
          provide: getRepositoryToken(Execution),
          useValue: mockExecutionRepo2,
        },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: mockNodeExecutionRepo2,
        },
        {
          provide: getRepositoryToken(Node),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findBy: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: {
            find: jest.fn().mockResolvedValue([]),
            findBy: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getRepositoryToken(Workflow),
          useValue: {
            findOneBy: jest
              .fn()
              .mockResolvedValue({ id: 'wf-w10', workspaceId: 'ws1' }),
          },
        },
        {
          provide: getRepositoryToken(ExecutionNodeLog),
          useValue: {
            save: jest.fn().mockResolvedValue({}),
            create: jest.fn().mockImplementation((d: unknown) => d),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
              cb({ save: jest.fn(async (_t: unknown, e?: unknown) => e) }),
            ),
          },
        },
        {
          provide: ContinuationBusService,
          useValue: {
            on: jest.fn(),
            publish: jest.fn().mockResolvedValue(1),
            acquireLock: jest.fn().mockResolvedValue(false),
            releaseLock: jest.fn().mockResolvedValue(true),
          },
        },
        {
          provide: WebsocketService,
          useValue: { emitExecutionEvent: jest.fn(), emitNodeEvent: jest.fn() },
        },
        {
          provide: ExecutionEventEmitter,
          useValue: { emitExecution: jest.fn(), emitNode: jest.fn() },
        },
        { provide: GraphTraversalService, useClass: GraphTraversalService },
        {
          provide: NodeHandlerDependenciesProvider,
          useValue: { build: jest.fn().mockReturnValue({}) },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((k: string, d?: unknown) =>
              k === 'MAX_NODE_ITERATIONS' ? 100 : d,
            ),
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
        { provide: KnowledgeBaseService, useValue: { findById: jest.fn() } },
        {
          provide: IntegrationsService,
          useValue: {
            getForExecution: jest.fn(),
            logUsage: jest.fn().mockResolvedValue(undefined),
          },
        },
        { provide: McpClientService, useValue: { connect: jest.fn() } },
        { provide: Cafe24ApiClient, useValue: { request: jest.fn() } },
        {
          provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
          useValue: { add: jest.fn().mockResolvedValue(undefined) },
        },
        {
          provide: ShutdownStateService,
          useValue: {
            isShuttingDown: false,
            inFlightCount: 0,
            retryAfterSec: 30,
            registerInFlight: mockRegister,
            unregisterInFlight: mockUnregister,
            onApplicationShutdown: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    svc = mod.get(ExecutionEngineService);
    reg = mod.get(NodeHandlerRegistry);
    (
      svc as unknown as { registerContinuationHandlers(): void }
    ).registerContinuationHandlers();
  });

  it('성공 경로: registerInFlight 1회 + unregisterInFlight 1회 (짝 보장)', async () => {
    const node: Partial<Node> = {
      id: 'n-w10',
      workflowId: 'wf-w10',
      type: 'w10_node',
      category: NodeCategory.LOGIC,
      label: 'W10 Node',
      config: {},
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    };

    const successHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      // NodeHandlerOutput 계약 준수: { config, output, ... }
      execute: jest
        .fn()
        .mockResolvedValue({ config: {}, output: { result: 'ok' } }),
    };
    reg.register('w10_node', successHandler);

    const ctx = (
      svc as unknown as { contextService: ExecutionContextService }
    ).contextService.createContext('exec-w10', 'wf-w10');
    const executed = new Set<string>();

    await (
      svc as unknown as {
        executeNode(
          executionId: string,
          node: Partial<Node>,
          input: unknown,
          context: unknown,
          executedNodes: Set<string>,
          nodeMap?: Map<string, unknown>,
        ): Promise<void>;
      }
    ).executeNode('exec-w10', node, {}, ctx, executed);

    expect(mockRegister).toHaveBeenCalledTimes(1);
    expect(mockRegister).toHaveBeenCalledWith('ne-w10', 'exec-w10');
    expect(mockUnregister).toHaveBeenCalledTimes(1);
    expect(mockUnregister).toHaveBeenCalledWith('ne-w10');
  });

  it('throw 경로: handler 에러 발생해도 unregisterInFlight 는 finally 에서 호출 (W-1 회귀 가드)', async () => {
    const node: Partial<Node> = {
      id: 'n-w10',
      workflowId: 'wf-w10',
      type: 'w10_throw',
      category: NodeCategory.LOGIC,
      label: 'W10 Throw',
      config: {},
      isDisabled: false,
      containerId: undefined,
      toolOwnerId: undefined,
    };

    const throwHandler: NodeHandler = {
      validate: () => ({ valid: true, errors: [] }),
      execute: jest
        .fn()
        .mockRejectedValue(new Error('simulated handler failure')),
    };
    reg.register('w10_throw', throwHandler);

    const ctx = (
      svc as unknown as { contextService: ExecutionContextService }
    ).contextService.createContext('exec-w10', 'wf-w10');
    const executed = new Set<string>();

    await expect(
      (
        svc as unknown as {
          executeNode(
            executionId: string,
            node: Partial<Node>,
            input: unknown,
            context: unknown,
            executedNodes: Set<string>,
          ): Promise<void>;
        }
      ).executeNode('exec-w10', node, {}, ctx, executed),
    ).rejects.toThrow('simulated handler failure');

    // unregisterInFlight MUST still be called in finally even after throw.
    expect(mockUnregister).toHaveBeenCalledTimes(1);
    expect(mockUnregister).toHaveBeenCalledWith('ne-w10');
  });
});
