import { RetryTurnService } from './retry-turn.service';
import { ExecutionContextService } from './context/execution-context.service';
import type { ExecutionEventEmitter } from './events/execution-event-emitter.service';
import type { GraphTraversalService } from './graph/graph-traversal.service';
import type { AiTurnOrchestrator } from './ai-turn-orchestrator.service';
import type { RetryEngineDriver } from './engine-driver.interface';
import { NodeExecutionStatus } from '../node-executions/entities/node-execution.entity';
import { ExecutionStatus } from '../executions/entities/execution.entity';
import {
  ExecutionEventType,
  NodeEventType,
} from '../websocket/websocket.service';
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
// ai-review CRITICAL #2 (2026-07-27, 3차 라운드) 정정 — 아래는 2계층 테스트
// 구조다. 재진입(`applyRetryLastTurn`) / downstream graph 진행
// (`resumeGraphAfterRetry`) describe 블록(`applyRetryLastTurn — early-exit
// guards` / `applyRetryLastTurn — re-entry outcome branches` / `종결 경로의
// terminal 가드`)은 본 spec 에 **이미 존재**하며, `mockDriver` /
// `mockAiTurnOrchestrator` 로 `runNodeDispatchLoop` / `rehydrateContext` /
// `processAiResumeTurn` 등을 mock 해 orchestration 로직(가드 순서·재조회 시점·
// 종결 이벤트 emit 조건)을 엔진과 독립적으로 격리 검증한다. 엔진 thin delegator
// 는 C-1 후속 ④ 로 이미 제거됐다 — 존재하지 않는 위임 경유를 전제할 수 없다.
// 엔진 spec(`execution-engine.service.spec.ts`)은 같은 진입점을 real driver 로
// 구동해 실제 `runNodeDispatchLoop`/`rehydrateContext`/`processAiResumeTurn` 까지
// 포함한 full-integration 을 검증한다 — 두 spec 은 대체가 아니라 격리 단위 테스트
// 와 통합 테스트로 분업하는 관계다.
// ────────────────────────────────────────────────────────────────────────────

// 파사드는 `type`('completed'…)을 받고 wire enum 은 emitter 가 파생한다. 이 파일의
// 단언들은 "어떤 종결 이벤트가 나갔나" 를 묻는 것이므로 되매핑해 기존 의미를 보존한다
// (wire 형태 자체는 `execution-event-emitter.service.spec.ts` 가 고정한다).
// **한 곳에만 둔다** — 두 describe 에 복제했더니 한쪽만 갱신될 위험이 지적됐다
// (`17_54_32` maintainability W5).
const TYPE_TO_EVENT = {
  completed: ExecutionEventType.EXECUTION_COMPLETED,
  failed: ExecutionEventType.EXECUTION_FAILED,
  cancelled: ExecutionEventType.EXECUTION_CANCELLED,
} as const;

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
      // `applyRetryLastTurn` 재진입 원자 claim 용 기본 mock — 기본값은 "claim 성공".
      // claim 실패(affected=0) 시나리오는 각 테스트가 재무장한다.
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };
    mockExecutionRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      save: jest.fn().mockImplementation((e: unknown) => Promise.resolve(e)),
      // 멱등 분기의 lifecycle 컬럼 guarded UPDATE 용 기본 mock.
      // `setParameter`/`returning` 까지 갖춘 **완전한** 체인이다 — 프로덕션이 체인
      // 메서드를 하나 추가할 때마다 불완전한 mock 은 TypeError 를 던지고, 그 호출이
      // try/catch 안이면 **테스트가 조용히 vacuous 해진다**(#1171 에서 실제로 겪었다).
      createQueryBuilder: jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        setParameter: jest.fn().mockReturnThis(),
        returning: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      })),
    };
    mockNodeRepo = {
      findOneBy: jest.fn().mockResolvedValue(null),
      findBy: jest.fn().mockResolvedValue([]),
    };
    mockEventEmitter = {
      emitExecution: jest.fn().mockResolvedValue(undefined),
      // 종결 3종은 이제 타입 파사드를 탄다. **wire 형태는 여기서 단언하지 않는다** —
      // 그 책임은 `execution-event-emitter.service.spec.ts` 로 갔고, 이 파일은
      // "서비스가 무엇을 의도했는가"(type + 필수 필드)만 본다.
      emitTerminalExecution: jest.fn().mockResolvedValue(undefined),
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

    it('(b) returns without driving graph when spawned row is not RUNNING (fast path — 레이스 결정자 아님)', async () => {
      // 이 체크는 **fast path** 다. 레이스 결정자는 아래 (b2) 의 조건부 UPDATE claim 이며,
      // 그 사실을 여기 명시한다 — 과거 이 체크가 "자체 멱등 가드" 로 서술돼
      // `continuation-execution.processor.ts` 가 원자 claim 대상에서 `retry_last_turn` 을
      // 제외하는 근거가 됐고, 그게 5R CRITICAL 의 원인이었다.
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

    it('(b2) claim 이 0행이면 (동시 배달 선점) 그래프를 구동하지 않고 discard 한다', async () => {
      // 핵심 회귀 — read-then-branch 만 있던 시절엔 두 delivery 가 모두 통과했다.
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(makeSpawnedRow());
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }));

      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();

      expectGraphNotDriven();
      // claim 실패는 "다른 worker 가 이미 가져갔다" 이므로 FAILED 마킹도 하면 안 된다.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    it('(b3) claim UPDATE 는 status=running 과 _retryState 존재를 둘 다 조건으로 건다', async () => {
      // status 조건이 빠지면: 턴이 COMPLETED 로 끝나도 `inputData._retryState` 는 남으므로
      //   (inputData 에 쓰는 곳은 spawn 시점뿐) 완료된 턴을 재실행한다.
      // jsonb_exists 조건이 빠지면: 레이스를 전혀 차단하지 못한다.
      const setSpy = jest.fn().mockReturnThis();
      const whereSpy = jest.fn().mockReturnThis();
      const andWhereSpy = jest.fn().mockReturnThis();
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(makeSpawnedRow());
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: setSpy,
        where: whereSpy,
        andWhere: andWhereSpy,
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }));

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      // SET 절은 `_retryState` 키를 제거하는 raw JSONB 식이어야 한다.
      const setArg = setSpy.mock.calls[0][0] as { inputData: () => string };
      expect(typeof setArg.inputData).toBe('function');
      expect(setArg.inputData()).toMatch(/input_data - '_retryState'/);
      expect(whereSpy).toHaveBeenCalledWith('id = :id', { id: SPAWNED_ID });
      const andWhereSql = andWhereSpy.mock.calls
        .map((c) => String(c[0]))
        .join(' ');
      expect(andWhereSql).toMatch(/status = :running/);
      expect(andWhereSql).toMatch(/jsonb_exists\(input_data, '_retryState'\)/);
    });

    // ai-review CRITICAL #1 회귀 (2026-07-28, `review/code/2026/07/28/20_32_57`,
    // W1 (i)) — 과거엔 이 케이스("최초 findOneBy 가 이미 다른 delivery 에게 claim
    // 당한 흔적(status:RUNNING + _retryState 없음)을 반환")를 "손상"으로 오판해
    // FAILED 로 무가드 덮어썼다. 실제로는 다른/이전 delivery 가 이미 claim 해
    // 지운 것일 뿐이므로, 이 delivery 는 claim 실패(affected=0 — 실 Postgres 라면
    // `jsonb_exists` 불일치)로 discard 해야 한다 — 살아있을 수도 있는 row 를
    // 죽이지 않는다.
    it('(c) findOneBy 가 처음부터 status:RUNNING + _retryState 없음(이미 다른 delivery 가 claim)을 반환하면 discard 하고 save() 를 호출하지 않는다', async () => {
      const row = makeSpawnedRow({ inputData: {} });
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      // 실 Postgres 라면 jsonb_exists(input_data, '_retryState') 가 false 라
      // claim UPDATE 가 0행에 매칭된다 — 그 결과를 흉내낸다.
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }));

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expectGraphNotDriven();
      // FAILED 로 마킹하지 않는다 — 살아있을 수도 있는(다른 delivery 가 처리
      // 중인) row 를 죽이지 않는다.
      expect(row.status).toBe(NodeExecutionStatus.RUNNING);
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    // W4 (ai-review 7R, `review/code/2026/07/30/11_41_20` #4) — claim 이
    // 성공(`affected:1`)했는데 in-memory `_retryState` 가 없는 "이론상 도달
    // 불가능" 방어 분기(claim 직후, retryState 판정)를 잠근다. testing
    // reviewer 가 mutation 으로 실증: 이 케이스가 없으면 그 블록을 통째로
    // 삭제해도 41/41 GREEN 이었다 — (c) 는 claim 자체가 실패(affected:0)하는
    // 다른 분기라 이 분기를 덮지 못한다.
    it('(f) claim 이 성공(affected:1)했는데 in-memory _retryState 가 없으면 FAILED 로 마킹하지 않고 discard 한다', async () => {
      // findOneBy 가 반환하는 spawnedRow.inputData 에 `_retryState` 키가 아예
      // 없다 — 그런데 claim UPDATE 자체는 (mock 상) `affected:1` 로 성공한다.
      const row = makeSpawnedRow({ inputData: {} });
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }));

      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();

      expectGraphNotDriven();
      // "이론상 도달 불가능" 방어 분기 — 그래도 FAILED 로 마킹하지 않는다
      // (Critical #1 이 닫은 "살아있는 row 오판" 을 다른 형태로 재도입하지
      // 않기 위해).
      expect(row.status).toBe(NodeExecutionStatus.RUNNING);
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
    });

    // ai-review CRITICAL #1 회귀 (W1 (ii)) — claim 성공 후 try 진입 전 구간
    // (Promise.all/rehydrateContext 등)은 catch 밖이라, 여기서 일시 예외가 나면
    // BullMQ 가 같은 job 을 재배달한다. 이 delivery 가 FAILED 로 마킹하지 않아야
    // (= save() 를 호출하지 않아야) 재배달이 안전하다 — 재배달의 fresh findOneBy
    // 는 이미 이 delivery 의 claim 이 지운 `_retryState` 를 보고 (위 (c) 케이스와
    // 동형으로) claim 실패 discard 로 안전하게 종료돼야 한다.
    it('claim 성공 후 try 진입 전 구간에서 예외가 나면 FAILED 로 마킹하지 않고 그대로 throw 한다 (재배달 안전)', async () => {
      const row = makeSpawnedRow();
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(row);
      mockExecutionRepo.findOneBy.mockResolvedValue({
        id: EXEC,
        workflowId: 'wf-1',
        startedAt: new Date(),
      });
      mockNodeRepo.findOneBy.mockResolvedValue({ id: NODE_ID, type: 'ai' });
      (mockDriver.rehydrateContext as jest.Mock).mockRejectedValue(
        new Error('transient: DB connection reset'),
      );

      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).rejects.toThrow('transient: DB connection reset');

      // FAILED 로 마킹하지 않는다 — save() 자체가 호출되지 않아야 한다.
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();

      // 재배달 시뮬레이션 — 같은 spawned row 를 fresh 조회하면 첫 delivery 의
      // claim 이 이미 지운 상태(status 여전히 RUNNING, _retryState 없음)를 본다.
      // 이 delivery(재배달)는 claim 실패로 안전하게 discard 돼야 한다.
      mockNodeExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }));
      mockNodeExecutionRepo.findOneBy.mockResolvedValue(
        makeSpawnedRow({ inputData: {} }),
      );

      await expect(
        service.applyRetryLastTurn(EXEC, SPAWNED_ID),
      ).resolves.toBeUndefined();
      expect(mockNodeExecutionRepo.save).not.toHaveBeenCalled();
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
      // ai-review CRITICAL #2 회귀 (2026-07-28) — claim 이 지운 `_retryState` 가
      // stale in-memory save() 로 부활하지 않는지: save() 에 넘겨지는 엔티티의
      // inputData 에 더 이상 키가 없어야 한다.
      expect(
        (row.inputData as Record<string, unknown>)._retryState,
      ).toBeUndefined();
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
      // ai-review CRITICAL #2 회귀 (2026-07-28) — 위 (d) 와 동일 근거.
      expect(
        (row.inputData as Record<string, unknown>)._retryState,
      ).toBeUndefined();
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
      // 2026-07-27 — 종결부의 guarded 마감이 **DB 를 다시 읽는다.** 재진입 claim 이
      // 이미 `failed → running` 으로 DB 를 옮겨 놓았으므로 재조회는 `running` 을
      // 돌려줘야 현실에 맞다. in-memory `execution` 은 그 전이가 다른 인스턴스에
      // 적용돼 stale `failed` 로 남아 있는데, 이 비대칭이 정확히 가드가 다루는 상황이다.
      //   첫 조회(재진입 시작 시 execution 로드)는 stale 객체를 그대로 주고,
      //   이후 조회(종결부 재조회)는 DB 정본(running)을 준다.
      mockExecutionRepo.findOneBy
        .mockResolvedValueOnce(execution)
        .mockResolvedValue({ ...execution, status: ExecutionStatus.RUNNING });
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

    // #501 회귀 가드 — 재시도 재진입은 spawn 된 RUNNING NodeExecution row id 를
    // buildRetryReentryState 에 `nodeExecutionId` 로 넘겨야 한다. 이게 빠지면 재구성된
    // resume state 의 nodeExecutionId 가 undefined 가 돼 resume 턴 provider-tool
    // (cafe24/makeshop/mcp)의 usage-log 게이트가 false 로 skip 된다.
    it('passes the spawned NodeExecution id to buildRetryReentryState (#501 usage-log attribution)', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockResolvedValue(PARK_RELEASED);

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      expect(mockDriver.buildRetryReentryState).toHaveBeenCalledWith(
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.anything(),
        expect.objectContaining({ nodeExecutionId: SPAWNED_ID }),
      );
    });

    // W-6 — 재진입이 ExecutionCancelledError 를 던지면 failRetryExecution 이
    // EXECUTION_CANCELLED (FAILED 아님) 를 emit 하고 Execution.status=CANCELLED.
    it('emits EXECUTION_CANCELLED (not FAILED) when re-entry throws ExecutionCancelledError', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockRejectedValue(new ExecutionCancelledError());

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      // 2026-07-27 — 종결이 guarded choke point 경유로 바뀌면서 상태 대입은
      // `updateExecutionStatus` 안에서 일어난다(여기선 driver 가 mock 이라 엔티티가
      // 변이되지 않는다). 단언 대상을 "엔티티 필드" 에서 **실제 계약**(어떤 상태로
      // 전이를 요청했는가)으로 옮긴다.
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        execution,
        ExecutionStatus.CANCELLED,
      );
      const emitTerminal = mockEventEmitter.emitTerminalExecution as jest.Mock;
      // CANCELLED event emitted, FAILED never.
      expect(emitTerminal).toHaveBeenCalledWith(EXEC, {
        type: 'cancelled',
        durationMs: expect.any(Number) as unknown,
        // 종전엔 이 필드가 **아예 없었다** (`retry-turn-terminal-guard` #2).
        cancelledBy: 'user',
      });
      const emittedTypes = emitTerminal.mock.calls.map(
        (c) => (c[1] as { type: string }).type,
      );
      expect(emittedTypes).not.toContain('failed');
      expect(emittedTypes).toContain('cancelled');
      // graph traversal not entered on the cancel path.
      expect(mockDriver.runNodeDispatchLoop).not.toHaveBeenCalled();
      // ai-review W16 (2026-07-26) — WS emit 은 이미 isCancelled 일 때 error 를
      // 제외해 안전했지만, DB 저장(`execution.error`)은 무조건이었다 — REST
      // `GET /executions/:id` 로 내부 message 가 노출되고 `finalizeCancelledExecution`
      // (취소 시 error 를 비움)과도 불일치했다. 취소 시 execution.error 자체가
      // 저장되지 않아야 한다.
      expect(execution.error).toBeUndefined();
    });

    // W-6 (대조) — 일반 Error 면 EXECUTION_FAILED + status=FAILED + error 필드.
    it('emits EXECUTION_FAILED with error message when re-entry throws a generic Error', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockRejectedValue(new Error('boom'));

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      // 상태 대입은 guarded choke point 안에서 일어난다(driver mock → 엔티티 미변이).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        execution,
        ExecutionStatus.FAILED,
      );
      expect(mockEventEmitter.emitTerminalExecution).toHaveBeenCalledWith(
        EXEC,
        {
          type: 'failed',
          // EIA §6.4 — 부재는 키 생략이 아니라 **명시적 null**. DB 는 `{message}` 만 쓰므로
          // emit 시점에 `toTerminalErrorPayload` 가 채운다.
          error: { code: null, message: 'boom', nodeId: null },
          durationMs: expect.any(Number) as unknown,
        },
      );
      // ai-review W16 (2026-07-26) — 취소가 아닌 일반 실패는 기존과 동일하게
      // execution.error 가 DB 에 저장돼야 한다(대조군 — 위 취소 케이스와 대비).
      expect(execution.error).toEqual({ message: 'boom' });
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
      expect(mockEventEmitter.emitTerminalExecution).not.toHaveBeenCalled();
    });

    // W6 (ai-review 7R, `review/code/2026/07/30/11_41_20` #6) — claim 직후로
    // delete 가 앞당겨지며 NODE_STARTED WS 이벤트의 `input` 페이로드도 조용히
    // 바뀌었다(이전엔 `_retryState` 포함 → 이제 미포함, internal 필드 비노출
    // 원칙과 부합하는 의도된 변경). 잠그는 테스트가 없었으므로 추가한다 — 이
    // delete 가 없거나 emit 이 claim 이전 스냅샷을 쓰면 이 단언은 RED 여야 한다.
    it('NODE_STARTED emit 의 input payload 는 _retryState 를 포함하지 않는다 (W6)', async () => {
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockResolvedValue(PARK_RELEASED);

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      const emitNode = mockEventEmitter.emitNode as jest.Mock;
      expect(emitNode).toHaveBeenCalledTimes(1);
      const [emittedExecId, emittedNodeId, eventType, payload] = emitNode.mock
        .calls[0] as [
        string,
        string,
        unknown,
        { input?: Record<string, unknown> },
      ];
      expect(emittedExecId).toBe(EXEC);
      expect(emittedNodeId).toBe(NODE_ID);
      expect(eventType).toBe(NodeEventType.NODE_STARTED);
      expect(payload.input).not.toHaveProperty('_retryState');
    });

    const emittedTypesOuter = () =>
      (mockEventEmitter.emitTerminalExecution as jest.Mock).mock.calls.map(
        (c) =>
          TYPE_TO_EVENT[(c[1] as { type: keyof typeof TYPE_TO_EVENT }).type],
      );

    // 2026-07-27 ai-review CRITICAL#1 검증 — "자연 종결(happy-path) 경로가 신규
    // 가드를 우회해 stale `failed` 로 `FAILED→COMPLETED` 자기전이 throw 를 일으키고,
    // retry 성공이 항상 FAILED 로 오분류된다" 는 지적의 회귀 테스트.
    //   실측 결과 **전제가 성립하지 않는다**: `processAiResumeTurn` 에 넘기는
    //   `execution` 은 orchestrator 가 상태를 갱신하는 **바로 그 객체**라, 성공 턴을
    //   거치면 `running` 이 된다. 그래도 그 불변식이 조용히 깨지지 않도록 여기 고정한다
    //   — 이 경로를 덮는 테스트가 없다는 리뷰어 지적 자체는 옳았다.
    it('자연 종결(그래프 완주) 경로가 COMPLETED 로 마감된다 — 성공이 FAILED 로 오분류되지 않는다', async () => {
      // 성공 턴: orchestrator 가 실제 엔진처럼 execution 객체를 RUNNING 으로 갱신한다.
      (
        mockAiTurnOrchestrator.processAiResumeTurn as jest.Mock
      ).mockImplementation((exec: { status: ExecutionStatus }) => {
        exec.status = ExecutionStatus.RUNNING;
        return Promise.resolve(undefined);
      });
      (mockDriver.loadAndBuildGraph as jest.Mock).mockResolvedValue({
        nodes: [{ id: NODE_ID }],
        sortedNodeIds: [NODE_ID],
        sortedIndexMap: new Map([[NODE_ID, 0]]),
        backEdgeMap: new Map(),
        outgoingEdgeMap: new Map(),
        nodeMap: new Map([[NODE_ID, { id: NODE_ID }]]),
        forwardEdges: [],
      });
      (mockDriver.runNodeDispatchLoop as jest.Mock).mockResolvedValue({
        parked: false,
      });

      await service.applyRetryLastTurn(EXEC, SPAWNED_ID);

      // 성공 종결 — FAILED 로 마감되지 않는다.
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        execution,
        ExecutionStatus.COMPLETED,
      );
      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalledWith(
        execution,
        ExecutionStatus.FAILED,
      );
      expect(emittedTypesOuter()).toContain(
        ExecutionEventType.EXECUTION_COMPLETED,
      );
      expect(emittedTypesOuter()).not.toContain(
        ExecutionEventType.EXECUTION_FAILED,
      );
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
      // 상태 대입은 guarded choke point 안에서 일어난다(driver mock → 엔티티 미변이).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        execution,
        ExecutionStatus.COMPLETED,
      );
      expect(mockEventEmitter.emitTerminalExecution).toHaveBeenCalledWith(
        EXEC,
        {
          type: 'completed',
          // EIA §6 — durationMs 는 종결 3종에 실린다. 알 수 없으면 null.
          durationMs: expect.any(Number) as unknown,
        },
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
      // 상태 대입은 guarded choke point 안에서 일어난다(driver mock → 엔티티 미변이).
      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        execution,
        ExecutionStatus.COMPLETED,
      );
      expect(mockEventEmitter.emitTerminalExecution).toHaveBeenCalledWith(
        EXEC,
        {
          type: 'completed',
          // EIA §6 — durationMs 는 종결 3종에 실린다. 알 수 없으면 null.
          durationMs: expect.any(Number) as unknown,
        },
      );
    });
  });

  // 2026-07-27 — `#1022` 가 `execution-engine.service.ts` 에서 닫은 "무가드 terminal
  // 쓰기" 결함 클래스가 이 파일의 종결 2경로에 남아 있었다. 두 메서드 모두 stale
  // in-memory 엔티티로 full-entity `save()` 를 해, 동시 Stop 이 이미 마감한 실행을
  // 덮어쓰고 종결 이벤트까지 발행했다.
  //   같은 파일 `resumeGraphAfterRetry` 종결부는 이미 guarded 패턴을 쓰고 있어,
  //   신규 패턴 도입이 아니라 기존 패턴을 두 곳에 마저 적용한 것이다.
  describe('종결 경로의 terminal 가드 (동시 Stop 선점)', () => {
    type FinalizeSubject = {
      completeRetryExecution: (e: unknown, id: string) => Promise<void>;
      failRetryExecution: (
        e: unknown,
        id: string,
        err: unknown,
      ) => Promise<void>;
    };
    const priv = () => service as unknown as FinalizeSubject;
    const EXEC_ID = 'exec-terminal-guard';
    let returningSpy: jest.Mock;
    const mkExec = () => ({
      id: EXEC_ID,
      status: ExecutionStatus.RUNNING,
      startedAt: new Date(Date.now() - 1000),
    });
    // ai-review WARNING #4 (2026-07-27, 3차 라운드) — 아래 `mockExecutionRepo.
    // findOneBy.mockResolvedValue({ id, status, startedAt })` 형태가 status 값만
    // 바꿔 이 describe 블록에 9곳 반복됐다. `mkExec()` 와 동일한 관례로 추출하되
    // **매 호출마다 새 객체를 반환**한다 — 테스트 간 공유 mutable 객체가 되면
    // 단언이 조용히 vacuous 해진다.
    const mkLiveExecution = (status: ExecutionStatus) => ({
      id: EXEC_ID,
      status,
      startedAt: new Date(Date.now() - 1000),
    });

    beforeEach(() => {
      // 가드는 DB 정본을 다시 읽는다. 기본값은 "아직 살아있는 실행"(running) —
      // 선점 시나리오는 각 테스트가 `updateExecutionStatus` 를 `false` 로 재무장한다.
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.RUNNING),
      );
    });

    const emittedTypes = () =>
      (mockEventEmitter.emitTerminalExecution as jest.Mock).mock.calls.map(
        (c) =>
          TYPE_TO_EVENT[(c[1] as { type: keyof typeof TYPE_TO_EVENT }).type],
      );

    it('completeRetryExecution: 선점되면 COMPLETED 로 덮어쓰지 않고 이벤트도 미발행', async () => {
      mockDriver.updateExecutionStatus.mockResolvedValueOnce(false);

      await priv().completeRetryExecution(mkExec(), EXEC_ID);

      expect(emittedTypes()).not.toContain(
        ExecutionEventType.EXECUTION_COMPLETED,
      );
    });

    it('대조: 선점되지 않으면 COMPLETED 이벤트를 발행한다', async () => {
      await priv().completeRetryExecution(mkExec(), EXEC_ID);

      expect(emittedTypes()).toContain(ExecutionEventType.EXECUTION_COMPLETED);
    });

    it('failRetryExecution: 선점되면 FAILED 로 덮어쓰지 않고 이벤트도 미발행', async () => {
      mockDriver.updateExecutionStatus.mockResolvedValueOnce(false);

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('retryable'),
      );

      expect(emittedTypes()).not.toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    it('대조: 선점되지 않으면 FAILED 이벤트를 발행한다', async () => {
      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('retryable'),
      );

      expect(emittedTypes()).toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    it('취소 경로도 가드를 거친다 — 선점 시 EXECUTION_CANCELLED 미발행', async () => {
      mockDriver.updateExecutionStatus.mockResolvedValueOnce(false);

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new ExecutionCancelledError('cancelled'),
      );

      expect(emittedTypes()).not.toContain(
        ExecutionEventType.EXECUTION_CANCELLED,
      );
    });

    // ── 정본(DB) 상태 기반 판정 ─────────────────────────────────────────────
    // 위 케이스들은 `updateExecutionStatus` 가 `false` 를 주는 경로만 덮는다.
    // **실제 보호의 핵심은 그 앞단** — 재조회한 정본이 이미 다른 terminal 이면
    // 전이 자체를 시도하지 않는다. mutation 에서 이 분기가 무커버리지로 드러나
    // 추가한 케이스다(가드를 지워도 RED 가 안 났다).

    it('정본이 이미 CANCELLED 면 FAILED 로 전이를 시도조차 하지 않는다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.CANCELLED),
      );

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('retryable'),
      );

      // 취소를 FAILED 로 덮어쓰는 전이 요청이 나가서는 안 된다.
      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).not.toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    it('정본이 이미 CANCELLED 면 COMPLETED 로도 덮어쓰지 않는다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.CANCELLED),
      );

      await priv().completeRetryExecution(mkExec(), EXEC_ID);

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).not.toContain(
        ExecutionEventType.EXECUTION_COMPLETED,
      );
    });

    it('정본이 이미 목표 상태면 상태 전이는 건너뛴다 (lifecycle 컬럼만 갱신)', async () => {
      // 재진입이 턴 시작 전에 실패하면 Execution 이 `failed` 인 채로 도달한다.
      // 쓸 것이 없으니 lost update 위험도 없고, 종결 이벤트는 기존대로 나가야 한다.
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.FAILED),
      );

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('retryable'),
      );

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    it('Execution row 가 사라졌으면 아무것도 하지 않는다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(null);

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('retryable'),
      );

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).not.toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    // ai-review INFO 7 — 위 두 분기(row 부재 / 멱등 no-op)가 `failRetryExecution`
    // 경유로만 검증돼 `completeRetryExecution` 쪽 대칭 커버리지가 없었다.
    it('completeRetryExecution: Execution row 가 사라졌으면 아무것도 하지 않는다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(null);

      await priv().completeRetryExecution(mkExec(), EXEC_ID);

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).not.toContain(
        ExecutionEventType.EXECUTION_COMPLETED,
      );
    });

    // ai-review CRITICAL (2026-07-27, 2차 라운드) — 멱등 분기가 **상태만** 같을 뿐
    // 이번 시도의 lifecycle 필드는 새 값이라, 그냥 통과시키면 새 error/finishedAt/
    // durationMs 가 조용히 버려진다(WS 는 새 에러, REST 는 옛 에러 — 불일치).
    it('멱등 분기여도 이번 시도의 error/finishedAt/durationMs 는 다시 쓴다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.FAILED),
      );
      const setSpy = jest.fn().mockReturnThis();
      const whereSpy = jest.fn().mockReturnThis();
      const andWhereSpy = jest.fn().mockReturnThis();
      mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: setSpy,
        where: whereSpy,
        andWhere: andWhereSpy,
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }));

      const execArg = mkExec();

      await priv().failRetryExecution(
        execArg,
        EXEC_ID,
        new Error('두 번째 실패'),
      );

      expect(setSpy).toHaveBeenCalledWith(
        expect.objectContaining({ error: { message: '두 번째 실패' } }),
      );
      // ai-review WARNING #1 (2026-07-27, 3차 라운드) — 제목이 약속한 3개 필드 중
      // `error` 하나만 검증하면 `finishedAt`/`durationMs` 를 소스에서 제거해도 이
      // 케이스는 GREEN 이다(리뷰어가 mutation 으로 실증). vacuous 하지 않도록
      // "이번 시도의 실제 값" 인지까지 확인한다 — `durationMs` 는 실제 `.set()` 에
      // 전달된 `finishedAt` 과 fixture `startedAt` 의 차와 같아야 하므로, 필드가
      // 제거되거나 다른(예: 이전 시도) 값으로 대체되면 이 관계식이 깨진다.
      const setArg = setSpy.mock.calls[setSpy.mock.calls.length - 1][0] as {
        finishedAt: Date;
        durationMs: number;
      };
      expect(setArg.finishedAt).toBeInstanceOf(Date);
      expect(setArg.durationMs).toBe(
        setArg.finishedAt.getTime() - execArg.startedAt.getTime(),
      );
      // 관측한 상태를 조건으로 걸어야 그 사이 동시 cancel 이 무효화된다.
      expect(andWhereSpy).toHaveBeenCalledWith('status = :status', {
        status: ExecutionStatus.FAILED,
      });
      expect(emittedTypes()).toContain(ExecutionEventType.EXECUTION_FAILED);
    });

    // ai-review CRITICAL #1 (2026-07-27, 3차 라운드) — 위 케이스는 guarded UPDATE
    // 가 `{ affected: 1 }` 인 정상 경로만 덮는다. `affected: 0` (동시 retry 재진입이
    // FAILED→RUNNING 으로 row 를 옮겨 andWhere 의 status 조건이 더 이상 매칭되지
    // 않는 경우 — `allowRetryReentry` opt-in 전이가 이걸 실제로 가능하게 한다)
    // 을 무조건 `true` 로 취급하면, DB 는 RUNNING(새 턴 진행 중)인데 caller 가
    // 종결 이벤트를 발행하는 "사후 오시그널" 이 된다. 기존 테스트 전부가 `execute`
    // mock 을 `{ affected: 1 }` 로 고정해 이 케이스는 전혀 커버되지 않았다.
    it('멱등 분기 guarded UPDATE 가 0행이면 (동시 retry 재진입 선점) 종결 이벤트도 상태 전이도 없다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.FAILED),
      );
      mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        execute: jest.fn().mockResolvedValue({ affected: 0 }),
      }));

      await priv().failRetryExecution(
        mkExec(),
        EXEC_ID,
        new Error('경합 중 재진입에 선점됨'),
      );

      // (a) 종결 이벤트가 발행되지 않는다.
      expect(emittedTypes()).not.toContain(ExecutionEventType.EXECUTION_FAILED);
      // (b) 다른 상태 전이 경로(hard state overwrite)로도 빠지지 않는다 —
      //     0행 매칭은 "이미 다른 곳에서 처리됨"을 뜻하므로 추가 쓰기는 없어야 한다.
      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
    });

    it('completeRetryExecution: 정본이 이미 COMPLETED 면 상태 전이는 건너뛰고 이번 시도의 finishedAt/durationMs 는 다시 쓴다', async () => {
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.COMPLETED),
      );
      // ai-review WARNING #1 (2026-07-27, 3차 라운드) — 이 케이스는 기본 beforeEach
      // mock 을 그대로 써 `.set()` payload 자체를 검증하지 않았다(그 mock 은 호출마다
      // 새 익명 jest.fn() 을 반환해 스파이를 잡을 수 없다). failRetryExecution 짝
      // 테스트와 대칭으로 전용 spy 를 심는다.
      const setSpy = jest.fn().mockReturnThis();
      const andWhereSpy = jest.fn().mockReturnThis();
      mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
        update: jest.fn().mockReturnThis(),
        set: setSpy,
        where: jest.fn().mockReturnThis(),
        andWhere: andWhereSpy,
        execute: jest.fn().mockResolvedValue({ affected: 1 }),
      }));
      const execArg = mkExec();

      await priv().completeRetryExecution(execArg, EXEC_ID);

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
      expect(emittedTypes()).toContain(ExecutionEventType.EXECUTION_COMPLETED);
      // vacuous 하지 않도록 "이번 시도의 실제 값" 인지까지 확인한다 — failRetryExecution
      // 짝 테스트와 동일 근거(관계식이 깨지면 필드 제거·stale 값 대체 모두 잡힌다).
      const setArg = setSpy.mock.calls[setSpy.mock.calls.length - 1][0] as {
        finishedAt: Date;
        durationMs: number;
      };
      expect(setArg.finishedAt).toBeInstanceOf(Date);
      expect(setArg.durationMs).toBe(
        setArg.finishedAt.getTime() - execArg.startedAt.getTime(),
      );
      expect(andWhereSpy).toHaveBeenCalledWith('status = :status', {
        status: ExecutionStatus.COMPLETED,
      });
    });

    it('stale in-memory 상태가 아니라 정본을 기준으로 판정한다', async () => {
      // in-memory 는 RUNNING(mkExec) 인데 정본은 CANCELLED — 재조회를 무시하고
      // stale 을 쓰면 running→failed 가 허용돼 취소를 덮어쓴다.
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.CANCELLED),
      );
      const staleExec = mkExec();
      expect(staleExec.status).toBe(ExecutionStatus.RUNNING);

      await priv().failRetryExecution(staleExec, EXEC_ID, new Error('boom'));

      expect(mockDriver.updateExecutionStatus).not.toHaveBeenCalled();
    });

    it('choke point 에는 정본으로 갱신된 엔티티를 넘긴다 (stale 이면 자기 전이로 throw)', async () => {
      // 재진입 전이가 **다른 인스턴스**에 적용돼 in-memory 는 stale `failed` 인데
      // 정본은 `running` 인 상황. 이때 stale 을 그대로 넘기면 실제 choke point 의
      // `assertTransition('failed', 'failed')` 이 자기 전이로 throw 한다(엔진 spec 의
      // 통합 테스트에서 실제로 발생했다). 여기서는 driver 가 mock 이라 throw 를 볼 수
      // 없으므로, **넘겨지는 엔티티의 상태가 정본으로 갱신됐는지**를 직접 단언한다.
      mockExecutionRepo.findOneBy.mockResolvedValue(
        mkLiveExecution(ExecutionStatus.RUNNING),
      );
      const staleExec = { ...mkExec(), status: ExecutionStatus.FAILED };

      await priv().failRetryExecution(staleExec, EXEC_ID, new Error('boom'));

      expect(mockDriver.updateExecutionStatus).toHaveBeenCalledWith(
        expect.objectContaining({ status: ExecutionStatus.RUNNING }),
        ExecutionStatus.FAILED,
      );
    });

    // ai-review CRITICAL #1 / testing WARNING #1 (2026-07-27, 4차 라운드) — 위
    // 멱등 분기 테스트들은 전부 `target=FAILED`/`COMPLETED` 조합만 구성했다.
    // `live.status===target===CANCELLED` 조합이 이 describe 전체에서 한 번도
    // 실행되지 않아, 멱등 분기가 CANCELLED 일 때도 FAILED 와 동일하게
    // lifecycle 필드를 무조건 새 값으로 덮어쓰는 회귀(`stop()`이 커밋한 정확한
    // 취소 시각 T1 을 재진입 catch 시각 T2 로 오염)가 미검출이었다. 아래 두
    // 케이스로 COALESCE 보존 + error 미기록 + affected=0 대칭을 고정한다.
    describe('CANCELLED 멱등 분기 (target===CANCELLED, live.status===CANCELLED)', () => {
      it('finishedAt/durationMs 는 COALESCE 로 보존하고 error 는 SET 절에서 제외한다', async () => {
        mockExecutionRepo.findOneBy.mockResolvedValue(
          mkLiveExecution(ExecutionStatus.CANCELLED),
        );
        const setSpy = jest.fn().mockReturnThis();
        const andWhereSpy = jest.fn().mockReturnThis();
        const setParameterSpy = jest.fn().mockReturnThis();
        mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: setSpy,
          where: jest.fn().mockReturnThis(),
          andWhere: andWhereSpy,
          setParameter: setParameterSpy,
          returning: jest.fn().mockReturnThis(),
          execute: jest.fn().mockResolvedValue({ affected: 1 }),
        }));
        // 이전 시도의 stale error 를 fixture 에 미리 채워 둔다 — 취소 종결에서
        // 이 값이 SET 절에 실리면 안 된다. 기존 fixture(mkExec())는 `.error` 를
        // 아예 설정하지 않아 이 문제가 관측 불가능했다는 게 WARNING #1 의 지적.
        const execArg = {
          ...mkExec(),
          error: { message: '이전 시도 stale error' },
        };

        await priv().failRetryExecution(
          execArg,
          EXEC_ID,
          new ExecutionCancelledError('cancelled'),
        );

        const setArg = setSpy.mock.calls[setSpy.mock.calls.length - 1][0] as {
          finishedAt?: unknown;
          durationMs?: unknown;
          error?: unknown;
        };
        // (a) finishedAt/durationMs 는 덮어쓰는 raw 값이 아니라 COALESCE 표현
        //     (QueryBuilder 함수형 raw SQL)이어야 한다.
        expect(typeof setArg.finishedAt).toBe('function');
        expect(typeof setArg.durationMs).toBe('function');
        expect((setArg.finishedAt as () => string)()).toMatch(
          /COALESCE\(finished_at, :newFinishedAt\)/,
        );
        expect((setArg.durationMs as () => string)()).toMatch(
          /COALESCE\(duration_ms, :newDurationMs\)/,
        );
        // (b) error 는 SET 절 자체에 없어야 한다 — stale 값 재기록 방지.
        expect(setArg).not.toHaveProperty('error');
        expect(setParameterSpy).toHaveBeenCalledWith(
          'newFinishedAt',
          expect.any(Date),
        );
        expect(setParameterSpy).toHaveBeenCalledWith(
          'newDurationMs',
          expect.any(Number),
        );
        expect(andWhereSpy).toHaveBeenCalledWith('status = :status', {
          status: ExecutionStatus.CANCELLED,
        });
        // (c) 취소 이벤트는 정상 발행된다 (affected=1 — row 매칭).
        expect(emittedTypes()).toContain(
          ExecutionEventType.EXECUTION_CANCELLED,
        );
      });

      // 위 테스트는 **SQL 형태만** 본다 — COALESCE 가 T1 을 보존하는지는 확인하지만
      // 그 보존된 값이 **wire 로 나가는지**는 묻지 않는다. 실제로 나가지 않았다:
      // caller 는 로컬 T2(재진입 시점 재계산값)를 emit 했다. "retry-turn 처리 중 Stop"
      // 이라는 일반 흐름에서 **결정적으로** DB 와 emit 이 갈렸다.
      it('emit 은 로컬 재계산값이 아니라 COALESCE 가 보존한 DB 값을 싣는다', async () => {
        mockExecutionRepo.findOneBy.mockResolvedValue(
          mkLiveExecution(ExecutionStatus.CANCELLED),
        );
        const PERSISTED_T1 = 1234;
        const PERSISTED_FINISHED_AT = '2026-08-15T01:02:03.000Z';
        // `returning` 을 스파이로 둔다 — mock 의 `raw` 는 실제 `.returning()` 호출과
        // 무관하게 돌아오므로, **호출 자체를 단언하지 않으면** 그 줄을 지워도 GREEN 이다
        // (즉 이 PR 이 고치는 결함으로 회귀해도 못 잡는다).
        returningSpy = jest.fn().mockReturnThis();
        mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setParameter: jest.fn().mockReturnThis(),
          returning: returningSpy,
          // stop() 이 먼저 커밋한 T1 이 그대로 남아 있는 상태. pg 드라이버는 timestamptz
          // 를 **문자열**로 주기도 하므로 그 형태로 준다(되쓰기의 string 분기를 태운다).
          execute: jest.fn().mockResolvedValue({
            affected: 1,
            raw: [
              {
                id: EXEC_ID,
                duration_ms: PERSISTED_T1,
                finished_at: PERSISTED_FINISHED_AT,
              },
            ],
          }),
        }));
        // 로컬은 재진입 시점이라 훨씬 큰 T2 가 된다 (startedAt 이 오래 전).
        // `finishedAt` 은 되쓰기 **대상**이라 타입에 명시한다 — 추론에 맡기면
        // `mkExec()` 에 없는 키라 단언 줄에서 타입 오류가 난다.
        const execArg: {
          id: string;
          status: ExecutionStatus;
          startedAt: Date;
          finishedAt?: Date;
        } = {
          ...mkExec(),
          startedAt: new Date(Date.now() - 600_000),
        };

        await priv().failRetryExecution(
          execArg,
          EXEC_ID,
          new ExecutionCancelledError('cancelled'),
        );

        const emitTerminal =
          mockEventEmitter.emitTerminalExecution as jest.Mock;
        const cancelCall = emitTerminal.mock.calls.find(
          (c) => (c[1] as { type: string }).type === 'cancelled',
        );
        expect(cancelCall).toBeDefined();
        expect((cancelCall![1] as { durationMs: number }).durationMs).toBe(
          PERSISTED_T1,
        );
        // 되받을 컬럼을 실제로 요청했는가 — 두 컬럼 모두 `COALESCE` 대상이다.
        expect(returningSpy).toHaveBeenCalledWith([
          'duration_ms',
          'finished_at',
        ]);
        // `finished_at` 되쓰기도 고정한다. 종전엔 이 블록을 통째로 지워도 GREEN 이었다
        // — 두 컬럼을 되쓰기로 해 놓고 한 컬럼만 단언했다.
        expect(execArg.finishedAt).toEqual(new Date(PERSISTED_FINISHED_AT));
      });

      it('guarded UPDATE 가 0행이면 (동시 재진입 선점) 취소 이벤트도 skip 한다', async () => {
        mockExecutionRepo.findOneBy.mockResolvedValue(
          mkLiveExecution(ExecutionStatus.CANCELLED),
        );
        mockExecutionRepo.createQueryBuilder = jest.fn(() => ({
          update: jest.fn().mockReturnThis(),
          set: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          setParameter: jest.fn().mockReturnThis(),
          returning: jest.fn().mockReturnThis(),
          // 0행이므로 `raw` 는 의도적으로 없다 — 되쓰기 블록에 들어가지 않는 것이 정답.
          execute: jest.fn().mockResolvedValue({ affected: 0 }),
        }));

        await priv().failRetryExecution(
          mkExec(),
          EXEC_ID,
          new ExecutionCancelledError('cancelled'),
        );

        expect(emittedTypes()).not.toContain(
          ExecutionEventType.EXECUTION_CANCELLED,
        );
      });
    });
  });
});
