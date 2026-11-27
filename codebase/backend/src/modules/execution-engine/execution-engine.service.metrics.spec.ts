import { Test, TestingModule } from '@nestjs/testing';
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
import { ConfigService } from '@nestjs/config';
import { LlmService } from '../llm/llm.service';
import { RagSearchService } from '../knowledge-base/search/rag-search.service';
import { KnowledgeBaseService } from '../knowledge-base/knowledge-base.service';
import { IntegrationsService } from '../integrations/integrations.service';
import { McpClientService } from '../mcp/mcp-client.service';
import { Cafe24ApiClient } from '../../nodes/integration/cafe24/cafe24-api.client';
import { MakeshopApiClient } from '../../nodes/integration/makeshop/makeshop-api.client';
import {
  Execution,
  ExecutionStatus,
} from '../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../node-executions/entities/node-execution.entity';
import { Node } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import { ContinuationBusService } from './continuation/continuation-bus.service';
import { StuckExecutionRecoveryService } from './recovery/stuck-execution-recovery.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ShutdownStateService } from './shutdown/shutdown-state.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';

/**
 * ExecutionEngineService 단위 테스트: NF-OB-07 BusinessMetrics 메트릭 발행.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 이 파일은 공용 하네스를 쓰지 않고 `Test.createTestingModule` 로 자체 TestingModule 과 mock 레포지토리를 만든다.
 */
// ── SUMMARY W-3 / W-4 / W-5 — NF-OB-07 메트릭 동작 단위 테스트 ─────────────────
// BusinessMetricsService 를 mock 으로 주입해 emitTerminalExecutionMetrics /
// recordNodeLatencyMetrics 의 조건부 동작과 오류 swallow 를 직접 assertion 한다.
describe('NF-OB-07 BusinessMetrics 동작 — emitTerminalExecutionMetrics / recordNodeLatencyMetrics', () => {
  // Private 메서드 접근용 타입
  type MetricsSubject = {
    emitTerminalExecutionMetrics(
      execution: Partial<Execution>,
      newStatus: ExecutionStatus,
      persisted: boolean,
    ): void;
    recordNodeLatencyMetrics(executionId: string): Promise<void>;
    nodeExecutionRepository: {
      createQueryBuilder: jest.Mock;
    };
    businessMetrics: {
      recordExecutionTerminal: jest.Mock;
      recordExecutionError: jest.Mock;
      recordNodeDuration: jest.Mock;
    };
  };

  let svcMetrics: ExecutionEngineService;
  let mockBizMetrics: {
    recordExecutionTerminal: jest.Mock;
    recordExecutionError: jest.Mock;
    recordNodeDuration: jest.Mock;
    registerQueueDepthProvider: jest.Mock;
  };
  let mockNodeExecRepo: {
    create: jest.Mock;
    save: jest.Mock;
    find: jest.Mock;
    findOneBy: jest.Mock;
    createQueryBuilder: jest.Mock;
  };

  beforeEach(async () => {
    mockBizMetrics = {
      recordExecutionTerminal: jest.fn(),
      recordExecutionError: jest.fn(),
      recordNodeDuration: jest.fn(),
      registerQueueDepthProvider: jest.fn(),
    };

    mockNodeExecRepo = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };

    const smallRepo = {
      create: jest.fn(),
      save: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      findOneBy: jest.fn().mockResolvedValue(null),
      createQueryBuilder: jest.fn().mockReturnValue({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }),
    };

    const modRef: TestingModule = await Test.createTestingModule({
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
        { provide: BusinessMetricsService, useValue: mockBizMetrics },
        ExecutionEventEmitter,
        GraphTraversalService,
        NodeHandlerRegistry,
        NodeComponentRegistry,
        ExecutionContextService,
        ErrorPolicyHandler,
        ExpressionResolverService,
        ForEachExecutor,
        LoopExecutor,
        ParallelExecutor,
        ConversationThreadService,
        ShutdownStateService,
        { provide: getRepositoryToken(Execution), useValue: smallRepo },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: mockNodeExecRepo,
        },
        {
          provide: getRepositoryToken(Node),
          useValue: {
            findBy: jest.fn().mockResolvedValue([]),
            findOneBy: jest.fn().mockResolvedValue(null),
          },
        },
        {
          provide: getRepositoryToken(Edge),
          useValue: { findBy: jest.fn().mockResolvedValue([]) },
        },
        {
          provide: getRepositoryToken(Workflow),
          useValue: {
            findOneBy: jest.fn().mockResolvedValue({ id: 'wf-m', name: 'M' }),
            findOne: jest.fn().mockResolvedValue({
              id: 'wf-m',
              workspace: { id: 'ws-m', settings: {} },
            }),
          },
        },
        {
          provide: getRepositoryToken(ExecutionNodeLog),
          useValue: {
            insert: jest.fn().mockResolvedValue({ identifiers: [{ id: '1' }] }),
            find: jest.fn().mockResolvedValue([]),
          },
        },
        {
          provide: getDataSourceToken(),
          useValue: {
            transaction: jest.fn(async (cb: (m: unknown) => Promise<unknown>) =>
              cb({
                save: jest.fn((_t: unknown, e: unknown) => Promise.resolve(e)),
              }),
            ),
          },
        },
        {
          provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE),
          useValue: { add: jest.fn() },
        },
        {
          provide: getQueueToken(EXECUTION_RUN_QUEUE),
          useValue: { add: jest.fn() },
        },
        {
          provide: WebsocketService,
          useValue: {
            emitExecutionEvent: jest.fn().mockResolvedValue(undefined),
            emitNodeEvent: jest.fn().mockResolvedValue(undefined),
            registerExecutionRouting: jest.fn(),
            releaseExecutionRouting: jest.fn(),
          },
        },
        {
          provide: ContinuationBusService,
          useValue: {
            publish: jest.fn(),
            subscribe: jest.fn(),
            close: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: { get: jest.fn().mockReturnValue(undefined) },
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
        { provide: MakeshopApiClient, useValue: { request: jest.fn() } },
      ],
    }).compile();

    svcMetrics = modRef.get(ExecutionEngineService);
  });

  afterEach(() => jest.restoreAllMocks());

  // ── W-3: emitTerminalExecutionMetrics 조건부 동작 ─────────────────────────

  describe('W-3 — emitTerminalExecutionMetrics (SUMMARY #3)', () => {
    const subject = () => svcMetrics as unknown as MetricsSubject;

    it('persisted=false 이면 recordExecutionTerminal 미호출', () => {
      const exec: Partial<Execution> = { id: 'exec-1', error: undefined };
      subject().emitTerminalExecutionMetrics(
        exec,
        ExecutionStatus.COMPLETED,
        false,
      );
      expect(mockBizMetrics.recordExecutionTerminal).not.toHaveBeenCalled();
    });

    it('non-terminal 상태(RUNNING)이면 recordExecutionTerminal 미호출', () => {
      const exec: Partial<Execution> = { id: 'exec-2', error: undefined };
      subject().emitTerminalExecutionMetrics(
        exec,
        ExecutionStatus.RUNNING,
        true,
      );
      expect(mockBizMetrics.recordExecutionTerminal).not.toHaveBeenCalled();
    });

    it('persisted=true + COMPLETED → recordExecutionTerminal(COMPLETED) 호출, recordExecutionError 미호출', () => {
      const exec: Partial<Execution> = { id: 'exec-3', error: undefined };
      subject().emitTerminalExecutionMetrics(
        exec,
        ExecutionStatus.COMPLETED,
        true,
      );
      expect(mockBizMetrics.recordExecutionTerminal).toHaveBeenCalledWith(
        ExecutionStatus.COMPLETED,
      );
      expect(mockBizMetrics.recordExecutionError).not.toHaveBeenCalled();
    });

    it('persisted=true + FAILED → recordExecutionTerminal + recordExecutionError 호출', () => {
      const exec: Partial<Execution> = {
        id: 'exec-4',
        error: { code: 'TIMEOUT' } as Record<string, unknown>,
      };
      subject().emitTerminalExecutionMetrics(
        exec,
        ExecutionStatus.FAILED,
        true,
      );
      expect(mockBizMetrics.recordExecutionTerminal).toHaveBeenCalledWith(
        ExecutionStatus.FAILED,
      );
      expect(mockBizMetrics.recordExecutionError).toHaveBeenCalledWith(
        'TIMEOUT',
      );
    });

    it('FAILED + error.code 없음 → "unknown" fallback 으로 recordExecutionError 호출', () => {
      const exec: Partial<Execution> = { id: 'exec-5', error: undefined };
      subject().emitTerminalExecutionMetrics(
        exec,
        ExecutionStatus.FAILED,
        true,
      );
      expect(mockBizMetrics.recordExecutionError).toHaveBeenCalledWith(
        'unknown',
      );
    });
  });

  // ── W-5: recordNodeLatencyMetrics 엣지 케이스 ─────────────────────────────

  describe('W-5 — recordNodeLatencyMetrics (SUMMARY #5)', () => {
    const subject = () => svcMetrics as unknown as MetricsSubject;

    it('durationMs == null 이면 recordNodeDuration 미호출', async () => {
      // getMany 가 durationMs=null 인 row 반환
      mockNodeExecRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'ne-1',
            durationMs: null,
            status: NodeExecutionStatus.COMPLETED,
            node: { type: 'action' },
          },
        ]),
      });
      await subject().recordNodeLatencyMetrics('exec-null-dur');
      expect(mockBizMetrics.recordNodeDuration).not.toHaveBeenCalled();
    });

    it('node === null 이면 node_type="unknown" fallback 으로 recordNodeDuration 호출', async () => {
      mockNodeExecRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'ne-2',
            durationMs: 42,
            status: NodeExecutionStatus.COMPLETED,
            node: null,
          },
        ]),
      });
      await subject().recordNodeLatencyMetrics('exec-null-node');
      expect(mockBizMetrics.recordNodeDuration).toHaveBeenCalledWith(
        'unknown',
        NodeExecutionStatus.COMPLETED,
        42,
      );
    });

    it('find(createQueryBuilder) reject 시 예외 미전파 + recordNodeDuration 미호출 (오류 swallow)', async () => {
      mockNodeExecRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockRejectedValue(new Error('db-error')),
      });
      await expect(
        subject().recordNodeLatencyMetrics('exec-err'),
      ).resolves.toBeUndefined();
      expect(mockBizMetrics.recordNodeDuration).not.toHaveBeenCalled();
    });

    it('정상 row → node_type·status·durationMs 로 recordNodeDuration 호출', async () => {
      mockNodeExecRepo.createQueryBuilder.mockReturnValue({
        select: jest.fn().mockReturnThis(),
        leftJoin: jest.fn().mockReturnThis(),
        addSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'ne-3',
            durationMs: 100,
            status: NodeExecutionStatus.COMPLETED,
            node: { type: 'llm' },
          },
          {
            id: 'ne-4',
            durationMs: 200,
            status: NodeExecutionStatus.FAILED,
            node: { type: 'action' },
          },
        ]),
      });
      await subject().recordNodeLatencyMetrics('exec-ok');
      expect(mockBizMetrics.recordNodeDuration).toHaveBeenCalledTimes(2);
      expect(mockBizMetrics.recordNodeDuration).toHaveBeenCalledWith(
        'llm',
        NodeExecutionStatus.COMPLETED,
        100,
      );
      expect(mockBizMetrics.recordNodeDuration).toHaveBeenCalledWith(
        'action',
        NodeExecutionStatus.FAILED,
        200,
      );
    });
  });

  // Regression guard for the re-entry fix: all three re-entry/redrive dispatch
  // sites (driveResumeAwaited / driveResumeFrame / driveStuckRedrive) pass this
  // helper's result as `input`. If it ever regresses to `{}`, an un-completed
  // entry node (Manual Trigger) loses its params on re-drive.
  describe('reentryWorkflowInput (durable trigger input on re-entry)', () => {
    const call = (exec: unknown): unknown =>
      (
        svcMetrics as unknown as {
          reentryWorkflowInput: (e: unknown) => unknown;
        }
      ).reentryWorkflowInput(exec);

    it('returns the durable Execution.inputData verbatim', () => {
      const inputData = {
        parameters: { region: '인천' },
        __triggerSource: 'manual',
      };
      expect(call({ inputData })).toEqual(inputData);
    });

    it('falls back to {} when inputData is null or undefined', () => {
      expect(call({ inputData: null })).toEqual({});
      expect(call({})).toEqual({});
    });
  });
});
