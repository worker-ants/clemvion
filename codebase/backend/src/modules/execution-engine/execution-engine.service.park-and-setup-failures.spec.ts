import { Test } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { getQueueToken } from '@nestjs/bullmq';
import { BACKGROUND_EXECUTION_QUEUE } from './queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from './queues/execution-run.queue';
import { ExecutionEngineService } from './execution-engine.service';
import { CALL_STACK_SCHEMA_VERSION } from '../../shared/execution-resume/resume-call-stack.types';
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
import { Node, NodeCategory } from '../nodes/entities/node.entity';
import { Edge } from '../edges/entities/edge.entity';
import { Workflow } from '../workflows/entities/workflow.entity';
import { ExecutionNodeLog } from './entities/execution-node-log.entity';
import { ContinuationBusService } from './continuation/continuation-bus.service';
import { StuckExecutionRecoveryService } from './recovery/stuck-execution-recovery.service';
import { ConversationThreadService } from './conversation-thread/conversation-thread.service';
import { ShutdownStateService } from './shutdown/shutdown-state.service';
import { BusinessMetricsService } from '../metrics/business-metrics.service';
import { ExecutionContext } from '../../nodes/core/node-handler.interface';

/**
 * ExecutionEngineService 단위 테스트: nested AI re-park · 첫 세그먼트 준비 실패 · 재개 바깥 catch 흡수.
 *
 * 옛 `execution-engine.service.spec.ts` 를 관심사별로 나눈 파일 가운데 하나다(CLE-T-YEDCJK).
 * 이 파일은 공용 하네스를 쓰지 않고 `Test.createTestingModule` 로 자체 TestingModule 과 mock 레포지토리를 만든다.
 */
// ────────────────────────────────────────────────────────────────────────────
// WARNING #3 (SUMMARY) — driveCallStackResume 중 nested AI re-park.
// processAiResumeTurn 이 PARK_RELEASED 반환 시 driveResumeFrame 이 {parked:true}
// 를 반환해 runNodeDispatchLoop 가 호출되지 않음을 검증.
// WARNING #5 (SUMMARY) — runExecutionFromQueue catch → failFirstSegmentSetup 직접 spy.
// WARNING #6/W7 (SUMMARY) — rehydrateAndResume outer catch 흡수 +
// failFirstSegmentSetup 2차 실패 로그 흡수.
// ────────────────────────────────────────────────────────────────────────────
describe('SUMMARY W3 / W5 / W6 / W7 보완 단위 테스트', () => {
  // W3: driveCallStackResume 에서 nested AI PARK_RELEASED → {parked:true} 반환,
  // runNodeDispatchLoop 미호출.
  describe('W3 — driveCallStackResume nested AI re-park (PARK_RELEASED → {parked:true})', () => {
    type DriveW3Subject = {
      driveCallStackResume: (
        savedExecution: unknown,
        context: unknown,
        opts: {
          node: unknown;
          nodeExec: unknown;
          callStack: { version: number; frames: unknown[] };
          persistedInteractionType: string | undefined;
          isAiConversation: boolean;
          resumeCheckpoint: Record<string, unknown> | undefined;
          cachedOutput: Record<string, unknown> | undefined;
          payload: unknown;
        },
      ) => Promise<void>;
      driveResumeFrame: (
        ...args: unknown[]
      ) => Promise<{ parked: boolean; output: unknown }>;
      runNodeDispatchLoop: (...args: unknown[]) => Promise<unknown>;
      finalizeRehydrationCleanup: (id: string) => void;
      updateExecutionStatus: (...args: unknown[]) => Promise<void>;
      contextService: {
        createContext: (e: string, w: string) => ExecutionContext;
      };
    };

    let service3: ExecutionEngineService;

    beforeEach(async () => {
      const smallRepo = {
        create: jest.fn(),
        save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
        findOneBy: jest.fn().mockResolvedValue(null),
        find: jest.fn().mockResolvedValue([]),
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
      const module3 = await Test.createTestingModule({
        providers: [
          ExecutionEngineService,
          StuckExecutionRecoveryService,
          AiTurnOrchestrator,
          // C-1 step3 — 엔진이 forwardRef 로 위임하는 추출 서비스 (DI 필수).
          FormInteractionService,
          ButtonInteractionService,
          // C-1 step4 — 엔진이 retry 진입점을 위임하는 추출 서비스 (DI 필수).
          RetryTurnService,
          { provide: ENGINE_DRIVER, useExisting: ExecutionEngineService },
          BusinessMetricsService,
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
          { provide: getRepositoryToken(NodeExecution), useValue: smallRepo },
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
              findOneBy: jest
                .fn()
                .mockResolvedValue({ id: 'wf-w3', name: 'W3' }),
              findOne: jest.fn().mockResolvedValue({
                id: 'wf-w3',
                workspace: { id: 'ws-w3', settings: {} },
              }),
            },
          },
          {
            provide: getRepositoryToken(ExecutionNodeLog),
            useValue: {
              insert: jest
                .fn()
                .mockResolvedValue({ identifiers: [{ id: '1' }] }),
              find: jest.fn().mockResolvedValue([]),
            },
          },
          {
            provide: getDataSourceToken(),
            useValue: {
              transaction: jest.fn(
                async (cb: (m: unknown) => Promise<unknown>) =>
                  cb({
                    save: jest.fn((_t: unknown, e: unknown) =>
                      Promise.resolve(e),
                    ),
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
          { provide: LlmService, useValue: { chat: jest.fn() } },
          {
            provide: RagSearchService,
            useValue: { search: jest.fn().mockResolvedValue([]) },
          },
          {
            provide: KnowledgeBaseService,
            useValue: { findOne: jest.fn(), findAll: jest.fn() },
          },
          {
            provide: IntegrationsService,
            useValue: {
              findByWorkspace: jest.fn().mockResolvedValue([]),
              findByType: jest.fn().mockResolvedValue([]),
              findOne: jest.fn(),
            },
          },
          {
            provide: McpClientService,
            useValue: { listTools: jest.fn().mockResolvedValue([]) },
          },
          { provide: Cafe24ApiClient, useValue: { request: jest.fn() } },
          { provide: MakeshopApiClient, useValue: { request: jest.fn() } },
        ],
      }).compile();
      service3 = module3.get(ExecutionEngineService);
    });

    afterEach(() => jest.restoreAllMocks());

    it('driveResumeFrame 가 {parked:true} 반환 시 runNodeDispatchLoop 미호출 (nested AI PARK_RELEASED)', async () => {
      const svc = service3 as unknown as DriveW3Subject;
      const ctx = svc.contextService.createContext('exec-w3', 'wf-w3');

      // driveResumeFrame → {parked:true} (AI re-park 시나리오).
      const driveFrameSpy = jest
        .spyOn(svc, 'driveResumeFrame')
        .mockResolvedValue({ parked: true, output: undefined });
      const dispatchSpy = jest
        .spyOn(svc, 'runNodeDispatchLoop')
        .mockResolvedValue({ parked: false });
      jest
        .spyOn(svc, 'finalizeRehydrationCleanup')
        .mockImplementation(() => undefined);
      jest.spyOn(svc, 'updateExecutionStatus').mockResolvedValue(undefined);

      const callStack = {
        version: CALL_STACK_SCHEMA_VERSION,
        frames: [
          {
            workflowId: 'wf-sub-ai',
            invokerNodeId: 'node-inv-ai',
            recursionDepth: 1,
          },
        ],
      };

      await svc.driveCallStackResume(
        {
          id: 'exec-w3',
          workflowId: 'wf-w3',
          status: ExecutionStatus.WAITING_FOR_INPUT,
          startedAt: new Date(),
          recursionDepth: 0,
          inputData: {},
        },
        ctx,
        {
          node: { id: 'node-ai-1', type: 'ai_agent' },
          nodeExec: {
            id: 'ne-ai-1',
            nodeId: 'node-ai-1',
            executionId: 'exec-w3',
            status: NodeExecutionStatus.WAITING_FOR_INPUT,
          },
          callStack,
          persistedInteractionType: undefined,
          isAiConversation: true,
          resumeCheckpoint: { turnCount: 1 },
          cachedOutput: undefined,
          payload: { type: 'ai_message', message: 'next turn' },
        },
      );

      // driveResumeFrame 가 {parked:true} 를 반환했으므로 runNodeDispatchLoop 미호출.
      expect(driveFrameSpy).toHaveBeenCalledTimes(1);
      expect(dispatchSpy).not.toHaveBeenCalled();
    });

    // W5: runExecutionFromQueue catch → failFirstSegmentSetup 직접 spy 검증.
    // service3 재사용 (위 beforeEach 에서 생성됨).
    it('W5 — runExecution throw 시 failFirstSegmentSetup 가 직접 호출된다', async () => {
      type W5Subject = {
        runExecution: (...args: unknown[]) => Promise<void>;
        failFirstSegmentSetup: (
          executionId: string,
          error: unknown,
        ) => Promise<void>;
        executionRepository: { findOneBy: jest.Mock };
      };
      const svc = service3 as unknown as W5Subject;

      svc.executionRepository.findOneBy = jest.fn().mockResolvedValue({
        id: 'exec-w5',
        workflowId: 'wf-w3',
        status: ExecutionStatus.PENDING,
        startedAt: new Date(),
        inputData: {},
        triggerId: 'trg-w5-spy',
      });

      // PR2b — admission gate 를 admitted 로 고정(runExecution throw 경로 검증 목적).
      jest
        .spyOn(
          svc as unknown as {
            admitExecutionOrDefer: (...a: unknown[]) => Promise<string>;
          },
          'admitExecutionOrDefer',
        )
        .mockResolvedValue('admitted');

      const runSpy = jest
        .spyOn(svc, 'runExecution')
        .mockRejectedValueOnce(new Error('setup-throw-w5'));

      const failSpy = jest
        .spyOn(svc, 'failFirstSegmentSetup')
        .mockResolvedValue(undefined);

      await service3.runExecutionFromQueue('exec-w5', {});

      expect(failSpy).toHaveBeenCalledWith('exec-w5', expect.any(Error));

      runSpy.mockRestore();
      failSpy.mockRestore();
    });

    // W6: rehydrateAndResume outer catch 흡수 검증.
    it('W6 — resumeFromCheckpoint throw 가 rehydrateAndResume outer catch 에 흡수됨 (호출자 미전파)', async () => {
      type W6Subject = {
        rehydrateAndResume: (
          executionId: string,
          nodeExecutionId: string,
          payload: unknown,
        ) => Promise<void>;
        resumeFromCheckpoint: (...args: unknown[]) => Promise<void>;
        executionRepository: { findOneBy: jest.Mock };
        nodeExecutionRepository: { findOne: jest.Mock };
        nodeRepository: { findOneBy: jest.Mock };
        workflowRepository: { findOne: jest.Mock };
        executionNodeLogRepository: { find: jest.Mock };
      };
      const svc = service3 as unknown as W6Subject;

      const rfcSpy = jest
        .spyOn(svc, 'resumeFromCheckpoint')
        .mockRejectedValueOnce(new Error('pre-drive-fail'));

      svc.executionRepository.findOneBy = jest.fn().mockResolvedValue({
        id: 'exec-w6',
        workflowId: 'wf-w3',
        status: ExecutionStatus.WAITING_FOR_INPUT,
        startedAt: new Date(),
        inputData: {},
        resumeCallStack: null,
      });
      svc.nodeExecutionRepository.findOne = jest.fn().mockResolvedValue({
        id: 'ne-w6',
        nodeId: 'node-w6',
        executionId: 'exec-w6',
        status: NodeExecutionStatus.WAITING_FOR_INPUT,
        outputData: {
          meta: { interactionType: 'form' },
          status: 'waiting_for_input',
        },
        startedAt: new Date(),
      });
      svc.nodeRepository.findOneBy = jest.fn().mockResolvedValue({
        id: 'node-w6',
        type: 'form_node',
        workflowId: 'wf-w3',
        category: NodeCategory.LOGIC,
        label: 'Form W6',
        config: {},
        isDisabled: false,
      });
      svc.workflowRepository.findOne = jest.fn().mockResolvedValue({
        id: 'wf-w3',
        workspace: { id: 'ws-w3', settings: {} },
      });
      svc.executionNodeLogRepository.find = jest.fn().mockResolvedValue([]);

      await expect(
        svc.rehydrateAndResume('exec-w6', 'ne-w6', {
          type: 'form_submitted',
          formData: {},
        }),
      ).resolves.toBeUndefined();

      rfcSpy.mockRestore();
    });

    // W7: failFirstSegmentSetup 2차 실패 시 logger.error 로 흡수.
    it('W7 — failFirstSegmentSetup 가 throw 해도 runExecutionFromQueue 는 throw 하지 않는다', async () => {
      type W7Subject = {
        runExecution: (...args: unknown[]) => Promise<void>;
        failFirstSegmentSetup: (...args: unknown[]) => Promise<void>;
        executionRepository: { findOneBy: jest.Mock };
        logger: { error: jest.Mock };
      };
      const svc = service3 as unknown as W7Subject;

      svc.executionRepository.findOneBy = jest.fn().mockResolvedValue({
        id: 'exec-w7',
        workflowId: 'wf-w3',
        status: ExecutionStatus.PENDING,
        startedAt: new Date(),
        inputData: {},
        triggerId: 'trg-w7',
      });

      // PR2b — admission gate 를 admitted 로 고정(runExecution throw 경로 검증 목적).
      jest
        .spyOn(
          svc as unknown as {
            admitExecutionOrDefer: (...a: unknown[]) => Promise<string>;
          },
          'admitExecutionOrDefer',
        )
        .mockResolvedValue('admitted');

      const runSpy = jest
        .spyOn(svc, 'runExecution')
        .mockRejectedValueOnce(new Error('primary-error'));

      const failSpy = jest
        .spyOn(svc, 'failFirstSegmentSetup')
        .mockRejectedValueOnce(new Error('secondary-error-w7'));

      const errorSpy = jest.spyOn(svc.logger, 'error');

      await expect(
        service3.runExecutionFromQueue('exec-w7', {}),
      ).resolves.toBeUndefined();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('secondary error'),
      );

      runSpy.mockRestore();
      failSpy.mockRestore();
      errorSpy.mockRestore();
    });
  });
});
