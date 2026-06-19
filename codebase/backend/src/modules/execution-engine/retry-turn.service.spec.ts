import { RetryTurnService } from './retry-turn.service';
import { ExecutionContextService } from './context/execution-context.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { GraphTraversalService } from './graph/graph-traversal.service';
import type { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import type { RetryEngineDriver } from './engine-driver.interface';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import { ExecutionEventType } from '../websocket/websocket.service';
import { ExecutionCancelledError } from './workflow-errors';
import { PARK_RELEASED } from '../../shared/execution-resume/process-turn-result';

// ────────────────────────────────────────────────────────────────────────────
// C-1 step4 — RetryTurnService 단위 테스트.
//
// 엔진(god-class)에서 추출된 `execution.retry_last_turn` 생명주기 중, 외부 의존이
// 없는 순수 lookup/검증/atomic-consume/spawn 단계(`retryLastTurn`)를 격리 검증한다.
// 본 describe 블록은 엔진 spec(`execution-engine.service.spec.ts`)에서 **그대로
// 이관**됐고, assertion 은 변경하지 않았다 — 하니스만 엔진 TestingModule 대신
// `RetryTurnService` 를 mocked deps 로 직접 생성하도록 적응했다.
//
// `retryLastTurn` 은 EngineDriver / orchestrator / eventEmitter 를 호출하지 않으므로
// `nodeExecutionRepository` (mock) 와 per-test 로 주입되는 `dataSource` (mock) 만으로
// 충분하다. 나머지 의존성은 생성자 만족을 위한 최소 mock 으로 채운다.
//
// 재진입(`applyRetryLastTurn`) / downstream graph 진행(`resumeGraphAfterRetry`)의
// deep-integration 테스트는 엔진의 실제 `runNodeDispatchLoop` / `rehydrateContext` /
// `processAiResumeTurn` 를 구동하므로, 엔진 thin delegator 를 통해 엔진 spec 에
// 잔류한다 (delegation 경유 검증; 본 spec 으로 이관 시 driver/orchestrator 를 모두
// mock 해야 해 테스트 의미가 소실됨).
// ────────────────────────────────────────────────────────────────────────────

describe('RetryTurnService', () => {
  let service: RetryTurnService;
  let mockNodeExecutionRepo: Record<string, jest.Mock>;
  // 재진입(`applyRetryLastTurn`) 계열 테스트(W-5/W-6/W-7)가 per-test 로 반환값을
  // override 하기 위해 describe 스코프로 노출한다. `retryLastTurn` 테스트는 이들을
  // 참조하지 않으므로 기존 어서션 영향 없음.
  let mockExecutionRepo: Record<string, jest.Mock>;
  let mockNodeRepo: Record<string, jest.Mock>;
  let mockEventEmitter: ExecutionEventEmitter;
  let mockGraphTraversal: GraphTraversalService;
  let mockAiTurnOrchestrator: AiTurnOrchestrator;
  let mockDriver: jest.Mocked<RetryEngineDriver>;
  let contextService: ExecutionContextService;

  beforeEach(() => {
    mockNodeExecutionRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    };
    mockExecutionRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    };
    mockNodeRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findBy: jest.fn().mockResolvedValue([]),
    };
    mockEventEmitter = {
      emitExecution: jest.fn().mockResolvedValue(undefined),
      emitNode: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExecutionEventEmitter;
    mockGraphTraversal = {
      seedInitialReachability: jest.fn(() => new Set<string>()),
      propagateReachability: jest.fn(),
      isPortFiltered: jest.fn(() => false),
    } as unknown as GraphTraversalService;
    mockAiTurnOrchestrator = {
      processAiResumeTurn: jest.fn(),
    } as unknown as AiTurnOrchestrator;
    mockDriver = {
      updateExecutionStatus: jest.fn().mockResolvedValue(true),
      stageDurableResumeSnapshot: jest.fn(),
      buildRetryReentryState: jest.fn(),
      buildResumeCheckpoint: jest.fn(),
      isCheckpointEligibleNodeType: jest.fn().mockReturnValue(false),
      contextKeyOf: jest.fn((ctx: { executionId: string }) => ctx.executionId),
      applyPortSelection: jest.fn((o: unknown) => o),
      rehydrateContext: jest.fn(),
      loadAndBuildGraph: jest.fn(),
      runNodeDispatchLoop: jest.fn().mockResolvedValue({ parked: false }),
      findActivatedBackEdge: jest.fn().mockReturnValue(null),
      clearLlmDefaultConfigCache: jest.fn(),
    } as unknown as jest.Mocked<RetryEngineDriver>;
    contextService = new ExecutionContextService();

    service = new RetryTurnService(
      mockExecutionRepo as unknown as never,
      mockNodeExecutionRepo as unknown as never,
      mockNodeRepo as unknown as never,
      // dataSource — `retryLastTurn` 테스트가 per-test 로 override 한다.
      { transaction: jest.fn() } as unknown as never,
      contextService,
      mockEventEmitter,
      mockGraphTraversal,
      mockAiTurnOrchestrator,
      mockDriver,
    );
  });

  afterEach(() => jest.restoreAllMocks());

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

  // ──────────────────────────────────────────────────────────────────────────
  // W-5 — applyRetryLastTurn 의 early-exit 가드 분기 잠금(behavior lock).
  //
  // 각 가드에서 (1) 그래프를 구동하지 않고(`driver.rehydrateContext` /
  // `processAiResumeTurn` / `runNodeDispatchLoop` 미호출) 조기 반환하며,
  // (2) 코드가 spawn row 를 FAILED 로 마감하는 분기에서는 정확히 그 필드를
  // set + save 하는지를 검증한다. 현재 구현 동작을 그대로 assert (변경 금지).
  // ──────────────────────────────────────────────────────────────────────────
  describe('applyRetryLastTurn — early-exit guards', () => {
    const EXEC = 'exec-apply';
    const SPAWNED_ID = 'ne-spawned';
    const NODE_ID = 'n-ai';

    function makeSpawnedRow(overrides: Record<string, unknown> = {}) {
      return {
        id: SPAWNED_ID,
        executionId: EXEC,
        nodeId: NODE_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: {
          _retryState: { messages: [], turnCount: 1 },
        },
        ...overrides,
      } as Record<string, unknown>;
    }

    function expectGraphNotDriven() {
      expect(mockDriver.rehydrateContext).not.toHaveBeenCalled();
      expect(mockAiTurnOrchestrator.processAiResumeTurn).not.toHaveBeenCalled();
      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
    }

    it('(a) returns without driving graph when spawned row is not found', async () => {
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(null);
      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();
      expectGraphNotDriven();
      // not-found → ack-and-discard, no FAILED save.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('(a) returns without driving graph when spawned row belongs to another execution', async () => {
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(
        makeSpawnedRow({ executionId: 'other-exec' }),
      );
      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();
      expectGraphNotDriven();
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('(b) returns without driving graph when spawned row is not RUNNING (idempotent discard)', async () => {
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(
        makeSpawnedRow({ status: NodeExecutionStatus.COMPLETED }),
      );
      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();
      expectGraphNotDriven();
      // already-handled → ack-and-discard, no FAILED save.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('(c) marks spawned row FAILED when _retryState is missing in inputData', async () => {
      const row = makeSpawnedRow({ inputData: {} });
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);
      expectGraphNotDriven();
      expect(row.status).toBe(NodeExecutionStatus.FAILED);
      expect(row.error).toEqual({
        message: 'Retry re-entry failed: missing _retryState',
      });
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(row);
    });

    it('(d) marks spawned row FAILED when parent execution is not found', async () => {
      const row = makeSpawnedRow();
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      mockExecutionRepo.findOneBy.mockResolvedValue(null);
      // node lookup would succeed, but execution-not-found takes precedence.
      mockNodeRepo.findOneBy.mockResolvedValue({ id: NODE_ID, type: 'ai' });
      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);
      expectGraphNotDriven();
      expect(row.status).toBe(NodeExecutionStatus.FAILED);
      expect(row.error).toEqual({
        message: 'Retry re-entry failed: parent execution not found',
      });
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(row);
    });

    it('(e) marks spawned row FAILED when node definition is not found', async () => {
      const row = makeSpawnedRow();
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: EXEC,
        startedAt: new Date(),
      });
      mockNodeRepo.findOneBy.mockResolvedValue(null);
      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);
      expectGraphNotDriven();
      expect(row.status).toBe(NodeExecutionStatus.FAILED);
      expect(row.error).toEqual({
        message: 'Retry re-entry failed: node definition not found',
      });
      expect(row.finishedAt).toBeInstanceOf(Date);
      expect(mockNodeExecutionRepo.save).toHaveBeenCalledWith(row);
    });
  });

  // ──────────────────────────────────────────────────────────────────────────
  // W-6 / W-7 — applyRetryLastTurn 의 종결 분기. 가드를 모두 통과해
  // `processAiResumeTurn` 까지 도달하도록 happy-path mock 을 깔고, 그 이후의
  // catch(취소) / resumeGraphAfterRetry defensive fallback 를 잠근다.
  // ──────────────────────────────────────────────────────────────────────────
  describe('applyRetryLastTurn — re-entry outcome branches', () => {
    const EXEC = 'exec-reentry';
    const SPAWNED_ID = 'ne-spawned';
    const NODE_ID = 'n-ai';

    let spawnedRow: Record<string, unknown>;
    let execution: Record<string, unknown>;
    let node: Record<string, unknown>;

    // 가드를 모두 통과시키는 공통 setup (spawn RUNNING + _retryState, execution +
    // node 조회 성공, context rehydrate, _retryState→_resumeState 변환).
    beforeEach(() => {
      spawnedRow = {
        id: SPAWNED_ID,
        executionId: EXEC,
        nodeId: NODE_ID,
        status: NodeExecutionStatus.RUNNING,
        startedAt: new Date(),
        inputData: { _retryState: { messages: [], turnCount: 1 } },
      };
      execution = {
        id: EXEC,
        workflowId: 'wf-1',
        status: ExecutionStatus.FAILED,
        startedAt: new Date(Date.now() - 10_000),
      };
      node = { id: NODE_ID, type: 'ai', label: 'AI', config: {} };

      mockNodeExecutionRepo.findOneBy.mockResolvedValue(spawnedRow);
      mockExecutionRepo.findOneBy.mockResolvedValue(execution);
      mockNodeRepo.findOneBy.mockResolvedValue(node);
      // rehydrateContext 는 실제로 contextService 의 Map 에 context 를 등록한다.
      // 따라서 mock 도 real contextService.createContext 로 등록해 후속
      // setNodeOutput / contextKeyOf / deleteContext 가 동일 Map 에 작동하게 한다
      // (그렇지 않으면 real setNodeOutput 이 "context not found" throw).
      (mockDriver.rehydrateContext as jest.Mock).mockImplementation(() =>
        Promise.resolve(contextService.createContext(EXEC, 'wf-1')),
      );
      (mockDriver.buildRetryReentryState as jest.Mock).mockReturnValue({
        resumeState: { messages: [] },
        initialAction: { type: 'ai_message' },
      });
    });

    // W-6 — 재진입이 ExecutionCancelledError 를 던지면 failRetryExecution 이
    // EXECUTION_CANCELLED (FAILED 아님) 를 emit 하고 Execution.status=CANCELLED.
    it('emits EXECUTION_CANCELLED (not FAILED) when re-entry throws ExecutionCancelledError', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockRejectedValue(new ExecutionCancelledError());

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(execution.status).toBe(ExecutionStatus.CANCELLED);
      const emitExecution = mockEventEmitter.emitExecution as jest.Mock;
      // CANCELLED event emitted, FAILED never.
      expect(emitExecution).toHaveBeenCalledWith(
        EXEC,
        ExecutionEventType.EXECUTION_CANCELLED,
        { status: ExecutionStatus.CANCELLED },
      );
      const emittedTypes = emitExecution.mock.calls.map((c) => c[1]);
      expect(emittedTypes).not.toContain(ExecutionEventType.EXECUTION_FAILED);
      // graph traversal not entered on the cancel path.
      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
    });

    // W-6 (대조) — 일반 Error 면 EXECUTION_FAILED + status=FAILED + error 필드.
    it('emits EXECUTION_FAILED with error message when re-entry throws a generic Error', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockRejectedValue(new Error('boom'));

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(execution.status).toBe(ExecutionStatus.FAILED);
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        EXEC,
        ExecutionEventType.EXECUTION_FAILED,
        { status: ExecutionStatus.FAILED, error: 'boom' },
      );
    });

    // 재진입이 re-park(PARK_RELEASED) 하면 graph 진행 없이 조기 반환.
    it('returns without resuming graph when re-entry re-parks (PARK_RELEASED)', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockResolvedValue(PARK_RELEASED);

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(mockDriver.loadAndBuildGraph).not.toHaveBeenCalled();
      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
      // re-park leaves Execution untouched here (handled by next continuation).
      expect(mockEventEmitter.emitExecution).not.toHaveBeenCalled();
    });

    // W-7 — resumeGraphAfterRetry defensive fallback (graph 비어 있음) →
    // completeRetryExecution 으로 Execution.COMPLETED 마감, dispatch loop 미진입.
    it('W-7: falls back to completeRetryExecution when the rebuilt graph has no nodes', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockResolvedValue(undefined);
      (mockDriver.loadAndBuildGraph as jest.Mock).mockResolvedValue({
        nodes: [],
        sortedNodeIds: [],
        sortedIndexMap: new Map<string, number>(),
        backEdgeMap: new Map(),
        outgoingEdgeMap: new Map(),
        nodeMap: new Map(),
        forwardEdges: [],
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(mockDriver.loadAndBuildGraph).toHaveBeenCalledWith('wf-1');
      // fallback finalize → COMPLETED, no dispatch loop.
      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
      expect(execution.status).toBe(ExecutionStatus.COMPLETED);
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        EXEC,
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: ExecutionStatus.COMPLETED },
      );
    });

    // W-7 — resumeGraphAfterRetry defensive fallback (completedNode 가 sorted
    // graph 에 없음, sortedIndexMap.get(...) === undefined) → 동일 fallback.
    it('W-7: falls back to completeRetryExecution when completed node is absent from the sorted graph', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockResolvedValue(undefined);
      (mockDriver.loadAndBuildGraph as jest.Mock).mockResolvedValue({
        // non-empty nodes, but sortedIndexMap has no entry for completedNode.id.
        nodes: [{ id: 'other-node' }],
        sortedNodeIds: ['other-node'],
        sortedIndexMap: new Map<string, number>(),
        backEdgeMap: new Map(),
        outgoingEdgeMap: new Map(),
        nodeMap: new Map(),
        forwardEdges: [],
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
      expect(execution.status).toBe(ExecutionStatus.COMPLETED);
      expect(mockEventEmitter.emitExecution).toHaveBeenCalledWith(
        EXEC,
        ExecutionEventType.EXECUTION_COMPLETED,
        { status: ExecutionStatus.COMPLETED },
      );
    });
  });
});
