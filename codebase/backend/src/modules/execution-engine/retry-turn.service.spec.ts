import { RetryTurnService } from './retry-turn.service';
import { ExecutionContextService } from './context/execution-context.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { GraphTraversalService } from './graph/graph-traversal.service';
import type { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import type { EngineDriver } from './engine-driver.interface';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';

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

  beforeEach(() => {
    mockNodeExecutionRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    };
    const mockExecutionRepo: Record<string, jest.Mock> = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
    };
    const mockNodeRepo: Record<string, jest.Mock> = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findBy: jest.fn().mockResolvedValue([]),
    };
    const mockEventEmitter = {
      emitExecution: jest.fn().mockResolvedValue(undefined),
      emitNode: jest.fn().mockResolvedValue(undefined),
    } as unknown as ExecutionEventEmitter;
    const mockGraphTraversal = {
      seedInitialReachability: jest.fn(() => new Set<string>()),
      propagateReachability: jest.fn(),
      isPortFiltered: jest.fn(() => false),
    } as unknown as GraphTraversalService;
    const mockAiTurnOrchestrator = {
      processAiResumeTurn: jest.fn(),
    } as unknown as AiTurnOrchestrator;
    const mockDriver = {
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
    } as unknown as jest.Mocked<EngineDriver>;

    service = new RetryTurnService(
      mockExecutionRepo as unknown as never,
      mockNodeExecutionRepo as unknown as never,
      mockNodeRepo as unknown as never,
      // dataSource — `retryLastTurn` 테스트가 per-test 로 override 한다.
      { transaction: jest.fn() } as unknown as never,
      new ExecutionContextService(),
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
});
