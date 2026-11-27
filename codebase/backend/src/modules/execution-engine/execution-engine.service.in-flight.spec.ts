import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from './queues/execution-run.queue';
import { ExecutionEngineService } from './execution-engine.service';
import { NodeHandlerRegistry } from '../../nodes/core/node-handler.registry';
import { NodeComponentRegistry } from '../../nodes/core/node-component.registry';
import { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import { FormInteractionService } from './form-interaction.service';
import { ButtonInteractionService } from './button-interaction.service';
import { RetryTurnService } from './retry-turn.service';
import { ENGINE_DRIVER } from './engine-driver.interface';
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
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import { ContinuationBusService } from './continuation/continuation-bus.service';
import { StuckExecutionRecoveryService } from './recovery/stuck-execution-recovery.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ShutdownStateService } from './shutdown/shutdown-state.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import { NodeHandler } from '../../nodes/core/node-handler.interface';

/**
 * ExecutionEngineService 단위 테스트: registerInFlight · unregisterInFlight 짝 호출.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 서비스 구성과 mock 레포지토리는 `__test-utils__/engine-service-harness.ts` 공용 하네스가 만든다.
 */
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
        StuckExecutionRecoveryService,
        AiTurnOrchestrator,
        // C-1 step3 — 엔진이 forwardRef 로 위임하는 추출 서비스 (DI 필수).
        FormInteractionService,
        ButtonInteractionService,
        // C-1 step4 — 엔진이 retry 진입점을 위임하는 추출 서비스 (DI 필수; engine
        // 생성자가 forwardRef(() => RetryTurnService) 로 의존).
        RetryTurnService,
        { provide: ENGINE_DRIVER, useExisting: ExecutionEngineService },
        BusinessMetricsService,
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
          provide: getQueueToken(EXECUTION_RUN_QUEUE),
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
