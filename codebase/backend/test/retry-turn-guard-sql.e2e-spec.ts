import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';

// 엔진을 src 모듈 중 맨 먼저 불러온다. 엔진 ↔ 이벤트 발행기(웹소켓 경유)가 순환 import 라, 다른 서비스가 먼저
// 사슬을 열면 엔진 클래스가 정의될 때 발행기가 아직 undefined 이고 DI 메타데이터의 그 자리가 비어 주입이 실패한다.
// 유닛 스펙(`execution-engine.service.spec.ts`)도 같은 순서다.
import { ExecutionEngineService } from '../src/modules/execution-engine/execution-engine.service';

import { ROOT_ENTITIES } from '../src/database/root-entities';
import { Edge } from '../src/modules/edges/entities/edge.entity';
import {
  Execution,
  ExecutionStatus,
} from '../src/modules/executions/entities/execution.entity';
import { AiTurnOrchestrator } from '../src/modules/execution-engine/ai-turn-orchestrator.service';
import { ButtonInteractionService } from '../src/modules/execution-engine/button-interaction.service';
import { ForEachExecutor } from '../src/modules/execution-engine/containers/foreach-executor';
import { LoopExecutor } from '../src/modules/execution-engine/containers/loop-executor';
import { ParallelExecutor } from '../src/modules/execution-engine/containers/parallel-executor';
import { ExecutionContextService } from '../src/modules/execution-engine/context/execution-context.service';
import { ContinuationBusService } from '../src/modules/execution-engine/continuation/continuation-bus.service';
import type { RetryEngineDriver } from '../src/modules/execution-engine/engine-driver.interface';
import { ExecutionNodeLog } from '../src/modules/execution-engine/entities/execution-node-log.entity';
import { ErrorPolicyHandler } from '../src/modules/execution-engine/error/error-policy.handler';
import { ExecutionEventEmitter } from '../src/modules/execution-engine/events/execution-event-emitter.service';
import { ExpressionResolverService } from '../src/modules/execution-engine/expression/expression-resolver.service';
import { FormInteractionService } from '../src/modules/execution-engine/form-interaction.service';
import { GraphTraversalService } from '../src/modules/execution-engine/graph/graph-traversal.service';
import { BACKGROUND_EXECUTION_QUEUE } from '../src/modules/execution-engine/queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from '../src/modules/execution-engine/queues/execution-run.queue';
import { RetryTurnService } from '../src/modules/execution-engine/retry-turn.service';
import { ShutdownStateService } from '../src/modules/execution-engine/shutdown/shutdown-state.service';
import {
  ExecutionCancelledError,
  RetryLastTurnError,
  SubWorkflowTimeoutError,
} from '../src/modules/execution-engine/workflow-errors';
import { LlmService } from '../src/modules/llm/llm.service';
import { BusinessMetricsService } from '../src/modules/metrics/business-metrics.service';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../src/modules/node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../src/modules/nodes/entities/node.entity';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { NodeEventType } from '../src/modules/websocket/websocket-events.types';
import { Workflow } from '../src/modules/workflows/entities/workflow.entity';
import { NodeHandlerRegistry } from '../src/nodes/core/node-handler.registry';
import { PARK_RELEASED } from '../src/shared/execution-resume/process-turn-result';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';
import { raceUnderHeldLock, waitForLockWaiters } from './helpers/concurrency';

/**
 * 마지막 턴 재시도(`RetryTurnService`)와 엔진 종결 경로의 조건부 UPDATE 를 실제 Postgres 에서 검증한다
 * (NERV Task CLE-T-2PTH0W, 스펙 CLE-EXEC-RECOVERY 「멱등성 계약」 · CLE-EXEC-STATE 종결 가드).
 *
 * ## 왜 단위 테스트로는 못 잡나
 *
 * 단위 스펙은 리포지토리를 mock 으로 바꿔 `affected` 값을 정해서 돌려준다. 그래서 다음 세 가지는 단위 스펙에서 늘 참이다.
 *
 * - `jsonb_exists(...)` 조건이 두 번째 writer 에게 0행을 돌려준다.
 * - `COALESCE(finished_at, :newFinishedAt)` 의 이름 있는 파라미터가 `setParameter` 로 실제로 묶인다.
 * - `.returning([...])` 이 `UpdateResult.raw` 에 행을 싣는다.
 *
 * 실제로 그런지는 Postgres 가 정한다. READ COMMITTED 에서 행 잠금을 기다린 UPDATE 는 잠금이 풀린 뒤 최신 행으로
 * WHERE 를 다시 평가한다. 이 파일은 그 재평가가 일어나는 순간을 잠금으로 만들어 위 조건들이 실제로 0행을 내는지 본다.
 *
 * ## 겹침을 만드는 방법
 *
 * 테스트가 별도 연결(`locker`)로 대상 행을 `FOR UPDATE` 로 잡는다. 서비스 호출은 무락 조회를 지나 조건부 UPDATE 에서
 * 잠금을 기다린다. 그 상태를 `raceUnderHeldLock` 의 공허성 가드나 `waitForLockWaiters` 로 확인한 뒤 locker 가
 * 경합 쓰기(Stop 흉내 등)를 하고 COMMIT 한다. 잠금을 기다리지 않는 코드라면 두 헬퍼가 던지므로 거짓 초록이 되지 않는다.
 *
 * ## 무엇을 stub 으로 두나
 *
 * DB 를 쓰는 부분(리포지토리 · DataSource · 엔진의 `updateExecutionStatus`)은 진짜다. 이벤트 발행 · AI 턴 처리 ·
 * 컨텍스트 재구성 · 메트릭 · 알림은 stub 이다. 이 파일이 보는 것은 SQL 가드와 "0행이면 발행하지 않는다" 는 판정뿐이다.
 * AI 턴 자체는 `retry-turn.service.spec.ts` 와 `ai-turn-orchestrator.service.spec.ts` 가 본다.
 *
 * ## Stop 을 흉내 내는 이유
 *
 * REST `stop()` 은 `status IN (running, pending)` 일 때만 취소한다. 재시도 턴이 도는 동안 실행은 아직 `failed` 라
 * 그 시점의 실제 Stop 은 취소하지 못한다. 취소는 턴 끝에서 실행이 `running` 으로 옮겨 간 뒤(재진입 성공 뒤 downstream
 * 진행 중)에 들어온다. 이 파일은 그 결과(DB 가 이미 `cancelled` 이고 T1 · D1 이 커밋됨)를 locker 의 UPDATE 로 직접 만든다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 먼저 커밋된 Stop 의 소요시간. 서비스가 계산할 값(분 단위)과 겹치지 않게 작은 값을 쓴다. */
const STOP_DURATION_MS = 1_234;

/** executeSync timeout. locker 가 잠금을 잡을 시간보다 충분히 길어야 한다. */
const SYNC_TIMEOUT_MS = 2_000;

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

/** 테스트가 호출하는 엔진 private 메서드. 시그니처가 바뀌면 타입 검사가 여기서 깨진다. */
interface EnginePrivates {
  finalizeFailedExecution(execution: Execution, error: unknown): Promise<void>;
  failFirstSegmentSetup(executionId: string, error: unknown): Promise<void>;
  runExecution(execution: Execution, input: unknown): Promise<void>;
  logger: Logger;
}

interface ExecutionRow {
  status: string;
  finished_at: Date | null;
  duration_ms: number | null;
  error: Record<string, unknown> | null;
}

type RetryOutcome =
  { ok: true; spawnedId: string } | { ok: false; error: unknown };

describe('마지막 턴 재시도 · 종결 가드의 조건부 UPDATE (실제 Postgres)', () => {
  let db: Client;
  let locker: Client;
  let lockerPid: number;
  let ds: DataSource;
  let moduleRef: TestingModule;
  let engine: ExecutionEngineService;
  let enginePrivates: EnginePrivates;
  let retry: RetryTurnService;
  let workspaceId: string;
  let workflowId: string;
  let nodeId: string;

  const emitter = {
    emitTerminalExecution: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    emitNode: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    emitExecution: jest.fn<AsyncFn>().mockResolvedValue(undefined),
  };
  const orchestrator = { processAiResumeTurn: jest.fn<AsyncFn>() };
  const metrics = {
    recordExecutionTerminal: jest.fn(),
    recordExecutionError: jest.fn(),
    recordNodeDuration: jest.fn(),
  };
  const notifications = {
    resolveOptOutEmailChannels: jest
      .fn<AsyncFn>()
      .mockResolvedValue(new Map<string, string>()),
    createMany: jest.fn<AsyncFn>().mockResolvedValue(undefined),
  };
  const contextService = {
    setNodeOutput: jest.fn(),
    deleteContext: jest.fn(),
  };

  function repo<T extends object>(entity: new () => T) {
    return ds.getRepository<T>(entity);
  }

  async function insertExecution(
    status: ExecutionStatus,
    fields: Partial<Execution> = {},
  ): Promise<string> {
    const executions = repo(Execution);
    const saved = await executions.save(
      executions.create({
        workflowId,
        status,
        startedAt: new Date(Date.now() - 10 * 60_000),
        ...fields,
      }),
    );
    return saved.id;
  }

  async function insertNodeExecution(
    executionId: string,
    status: NodeExecutionStatus,
    fields: Partial<NodeExecution> = {},
  ): Promise<string> {
    const nodeExecutions = repo(NodeExecution);
    const saved = await nodeExecutions.save(
      nodeExecutions.create({ executionId, nodeId, status, ...fields }),
    );
    return saved.id;
  }

  function retryStateFixture(): Record<string, unknown> {
    return {
      expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
      turnCount: 1,
    };
  }

  /** 재시도 가능한 실패로 끝난 실행 · 노드 실행. 마지막 턴 재시도의 출발 상태다. */
  async function seedRetryableFailure(): Promise<{
    executionId: string;
    failedNodeExecutionId: string;
    retryState: Record<string, unknown>;
  }> {
    const executionId = await insertExecution(ExecutionStatus.FAILED, {
      finishedAt: new Date(Date.now() - 60_000),
      durationMs: 540_000,
      error: { message: 'previous attempt failed' },
    });
    const retryState = retryStateFixture();
    const failedNodeExecutionId = await insertNodeExecution(
      executionId,
      NodeExecutionStatus.FAILED,
      {
        finishedAt: new Date(Date.now() - 60_000),
        outputData: {
          output: {
            error: {
              message: 'rate limited',
              details: { retryable: true },
            },
          },
          keepMe: 'untouched',
          _retryState: retryState,
        },
      },
    );
    return { executionId, failedNodeExecutionId, retryState };
  }

  /** `retryLastTurn` 이 spawn 한 직후의 상태. 워커 재진입(`applyRetryLastTurn`)의 출발 상태다. */
  async function seedSpawnedRetryRow(): Promise<{
    executionId: string;
    spawnedId: string;
  }> {
    const executionId = await insertExecution(ExecutionStatus.FAILED, {
      finishedAt: new Date(Date.now() - 60_000),
      durationMs: 540_000,
      error: { message: 'previous attempt failed' },
    });
    const spawnedId = await insertNodeExecution(
      executionId,
      NodeExecutionStatus.RUNNING,
      { inputData: { _retryState: retryStateFixture() } },
    );
    return { executionId, spawnedId };
  }

  async function readExecution(id: string): Promise<ExecutionRow> {
    const res = await db.query<ExecutionRow>(
      'SELECT status, finished_at, duration_ms, error FROM execution WHERE id = $1',
      [id],
    );
    return res.rows[0];
  }

  async function readNodeExecution(id: string) {
    const res = await db.query<{
      status: string;
      input_data: Record<string, unknown> | null;
      output_data: Record<string, unknown> | null;
    }>(
      'SELECT status, input_data, output_data FROM node_execution WHERE id = $1',
      [id],
    );
    return res.rows[0];
  }

  /** 먼저 커밋되는 Stop. `stop()` 이 쓰는 세 컬럼을 같은 형태로 쓴다. */
  function stopCommittedAt(
    executionId: string,
    finishedAt: Date | null,
    durationMs: number | null,
  ) {
    return (conn: Client) =>
      conn.query(
        `UPDATE execution
            SET status = 'cancelled', finished_at = $2, duration_ms = $3, error = NULL
          WHERE id = $1`,
        [executionId, finishedAt, durationMs],
      );
  }

  /**
   * locker 가 `lockSql` 로 행을 잡은 채 `fire` 를 부르고, `fire` 의 조건부 UPDATE 가 그 잠금을 기다리는 것을 본 뒤
   * `whileWaiting` 으로 경합 쓰기를 하고 COMMIT 한다. 기다리는 연결이 보이지 않으면 `waitForLockWaiters` 가 던진다.
   */
  async function interleaveUnderLock<T>(
    lock: { sql: string; params: unknown[] },
    fire: () => Promise<T>,
    label: string,
    whileWaiting: (conn: Client) => Promise<unknown>,
  ): Promise<T> {
    let pending: Promise<T> | undefined;
    await locker.query('BEGIN');
    try {
      await locker.query(lock.sql, lock.params);
      pending = fire();
      await waitForLockWaiters(db, lockerPid, 1, label);
      await whileWaiting(locker);
      await locker.query('COMMIT');
      return await pending;
    } finally {
      await locker.query('ROLLBACK').catch(() => undefined);
      await pending?.catch(() => undefined);
    }
  }

  function lockExecutionRow(executionId: string) {
    return {
      sql: 'SELECT id FROM execution WHERE id = $1 FOR UPDATE',
      params: [executionId],
    };
  }

  function lockNodeExecutionRow(nodeExecutionId: string) {
    return {
      sql: 'SELECT id FROM node_execution WHERE id = $1 FOR UPDATE',
      params: [nodeExecutionId],
    };
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    locker = createDbClient();
    await locker.connect();
    lockerPid = (
      await locker.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')
    ).rows[0].pid;

    ds = new DataSource({
      type: 'postgres',
      host: process.env.DB_HOST ?? 'postgres',
      port: Number(process.env.DB_PORT ?? '5432'),
      username: process.env.DB_USERNAME ?? 'clemvion',
      password: process.env.DB_PASSWORD ?? 'clemvion-e2e',
      database: process.env.DB_DATABASE ?? 'clemvion_e2e',
      entities: [...ROOT_ENTITIES],
      synchronize: false,
    });
    await ds.initialize();

    const owner = await registerAndLogin(
      BASE_URL,
      uniqueEmail('retry-guard'),
      db,
    );
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('RETRYGUARD'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('retry-guard-wf') });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id as string;

    const nodes = repo(Node);
    nodeId = (
      await nodes.save(
        nodes.create({
          workflowId,
          type: 'ai_agent',
          category: NodeCategory.AI,
          label: 'retry guard agent',
          config: {},
        }),
      )
    ).id;

    // 엔진은 DI 로 만든다. 생성자 인자가 서른 개 가까이라 위치 인자로 넘기면 순서가 바뀔 때 조용히 엇갈린다.
    // `init()` 을 부르지 않으므로 생명주기 훅은 돌지 않는다.
    moduleRef = await Test.createTestingModule({
      providers: [
        ExecutionEngineService,
        {
          provide: getRepositoryToken(Execution),
          useValue: repo(Execution),
        },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: repo(NodeExecution),
        },
        { provide: getRepositoryToken(Node), useValue: repo(Node) },
        { provide: getRepositoryToken(Edge), useValue: repo(Edge) },
        { provide: getRepositoryToken(Workflow), useValue: repo(Workflow) },
        {
          provide: getRepositoryToken(ExecutionNodeLog),
          useValue: repo(ExecutionNodeLog),
        },
        { provide: getDataSourceToken(), useValue: ds },
        { provide: ExecutionEventEmitter, useValue: emitter },
        { provide: BusinessMetricsService, useValue: metrics },
        { provide: NotificationsService, useValue: notifications },
        { provide: NodeHandlerRegistry, useValue: {} },
        { provide: ExecutionContextService, useValue: {} },
        { provide: ErrorPolicyHandler, useValue: {} },
        { provide: ExpressionResolverService, useValue: {} },
        { provide: GraphTraversalService, useValue: {} },
        { provide: ConfigService, useValue: { get: () => undefined } },
        { provide: LlmService, useValue: {} },
        { provide: ForEachExecutor, useValue: {} },
        { provide: LoopExecutor, useValue: {} },
        { provide: ParallelExecutor, useValue: {} },
        { provide: getQueueToken(BACKGROUND_EXECUTION_QUEUE), useValue: {} },
        { provide: getQueueToken(EXECUTION_RUN_QUEUE), useValue: {} },
        { provide: ContinuationBusService, useValue: {} },
        { provide: ShutdownStateService, useValue: {} },
        { provide: AiTurnOrchestrator, useValue: {} },
        { provide: FormInteractionService, useValue: {} },
        { provide: ButtonInteractionService, useValue: {} },
      ],
    }).compile();
    engine = moduleRef.get(ExecutionEngineService);
    enginePrivates = engine as unknown as EnginePrivates;

    // 재시도 서비스는 단위 스펙(`retry-turn.service.spec.ts`)과 같이 직접 만든다. 드라이버의 상태 전이만 진짜 엔진에 넘긴다.
    const driver = {
      updateExecutionStatus: (
        execution: Execution,
        status: ExecutionStatus,
        linked?: NodeExecution,
        opts?: { allowRetryReentry?: boolean },
      ) => engine.updateExecutionStatus(execution, status, linked, opts),
      rehydrateContext: jest
        .fn<AsyncFn>()
        .mockImplementation(async (execution: unknown) => ({
          executionId: (execution as Execution).id,
        })),
      buildRetryReentryState: jest.fn(() => ({
        resumeState: {},
        initialAction: null,
      })),
      contextKeyOf: jest.fn(
        (context: unknown) => (context as { executionId: string }).executionId,
      ),
      clearLlmDefaultConfigCache: jest.fn(),
    };
    retry = new RetryTurnService(
      repo(Execution),
      repo(NodeExecution),
      repo(Node),
      ds,
      contextService as unknown as ExecutionContextService,
      emitter as unknown as ExecutionEventEmitter,
      {} as GraphTraversalService,
      orchestrator as unknown as AiTurnOrchestrator,
      driver as unknown as RetryEngineDriver,
    );
  }, 60_000);

  afterAll(async () => {
    await moduleRef?.close().catch(() => undefined);
    await ds?.destroy().catch(() => undefined);
    await locker?.end().catch(() => undefined);
    await db?.end().catch(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    orchestrator.processAiResumeTurn.mockReset();
  });

  describe('G1 · retryLastTurn 의 원자 소비 (`output_data - key` + `jsonb_exists`)', () => {
    it('동시 재시도 두 건 중 한 건만 `_retryState` 를 소비하고 새 행도 하나만 만든다', async () => {
      const { executionId, failedNodeExecutionId, retryState } =
        await seedRetryableFailure();
      const fire = (): Promise<RetryOutcome> =>
        retry.retryLastTurn(executionId, failedNodeExecutionId).then(
          (r) => ({ ok: true as const, spawnedId: r.spawnedNodeExecutionId }),
          (err: unknown) => ({ ok: false as const, error: err }),
        );

      // 두 호출 모두 검증을 지나 소비 UPDATE 에서 locker 를 기다린다. 풀린 뒤 먼저 커밋한 쪽이 키를 지우고,
      // 다음 쪽은 다시 평가한 `jsonb_exists` 가 거짓이라 0행이다.
      const outcomes = await raceUnderHeldLock(
        locker,
        lockNodeExecutionRow(failedNodeExecutionId),
        [fire, fire],
      );

      const won = outcomes.filter((o) => o.ok);
      const lost = outcomes.filter((o) => !o.ok);
      expect(won).toHaveLength(1);
      expect(lost).toHaveLength(1);
      const lostError = (lost[0] as { error: unknown }).error;
      expect(lostError).toBeInstanceOf(RetryLastTurnError);
      expect((lostError as RetryLastTurnError).code).toBe(
        RetryLastTurnError.notFound().code,
      );

      const rows = await db.query<{ id: string; status: string }>(
        'SELECT id, status FROM node_execution WHERE execution_id = $1 ORDER BY started_at',
        [executionId],
      );
      expect(rows.rowCount).toBe(2);
      const spawnedId = (won[0] as { spawnedId: string }).spawnedId;
      const spawned = await readNodeExecution(spawnedId);
      expect(spawned.status).toBe(NodeExecutionStatus.RUNNING);
      expect(spawned.input_data).toEqual({ _retryState: retryState });

      // 소비는 키 하나만 지운다. 나머지 출력은 그대로다.
      const original = await readNodeExecution(failedNodeExecutionId);
      expect(original.output_data).not.toHaveProperty('_retryState');
      expect(original.output_data).toMatchObject({
        keepMe: 'untouched',
        output: { error: { details: { retryable: true } } },
      });
    });
  });

  describe('G2 · applyRetryLastTurn 의 2차 claim (`status = running` + `jsonb_exists`)', () => {
    it('같은 새 행이 두 번 배달돼도 한 번만 턴을 처리한다', async () => {
      const { executionId, spawnedId } = await seedSpawnedRetryRow();
      orchestrator.processAiResumeTurn.mockResolvedValue(PARK_RELEASED);
      const fire = () =>
        retry
          .applyRetryLastTurn(executionId, spawnedId)
          .then(() => 'done' as const);

      // 두 배달 모두 fast path(행이 running)를 지나 claim UPDATE 에서 locker 를 기다린다.
      await raceUnderHeldLock(locker, lockNodeExecutionRow(spawnedId), [
        fire,
        fire,
      ]);

      expect(orchestrator.processAiResumeTurn).toHaveBeenCalledTimes(1);
      const started = emitter.emitNode.mock.calls.filter(
        (call) => call[2] === NodeEventType.NODE_STARTED,
      );
      expect(started).toHaveLength(1);
      const spawned = await readNodeExecution(spawnedId);
      expect(spawned.input_data).not.toHaveProperty('_retryState');
    });

    it('claim 을 기다리는 동안 다른 워커가 턴을 끝내면(키는 남음) 이 배달은 버린다', async () => {
      const { executionId, spawnedId } = await seedSpawnedRetryRow();
      orchestrator.processAiResumeTurn.mockResolvedValue(PARK_RELEASED);

      // `inputData` 는 spawn 때만 쓰므로 턴이 끝나도 키가 남는다. 그래서 claim 이 상태까지 함께 봐야 한다.
      await interleaveUnderLock(
        lockNodeExecutionRow(spawnedId),
        () => retry.applyRetryLastTurn(executionId, spawnedId),
        'G2 claim',
        (conn) =>
          conn.query(
            `UPDATE node_execution SET status = 'completed', finished_at = now() WHERE id = $1`,
            [spawnedId],
          ),
      );

      expect(orchestrator.processAiResumeTurn).not.toHaveBeenCalled();
      expect(emitter.emitNode).not.toHaveBeenCalled();
      const spawned = await readNodeExecution(spawnedId);
      expect(spawned.status).toBe(NodeExecutionStatus.COMPLETED);
      expect(spawned.input_data).toHaveProperty('_retryState');
    });
  });

  describe('G3 · finalizeGuarded 의 취소 멱등 분기 (`COALESCE` + `setParameter` + `.returning`)', () => {
    it('먼저 커밋된 Stop 의 finished_at · duration_ms 를 보존하고 그 값을 이벤트에 싣는다', async () => {
      const { executionId, spawnedId } = await seedSpawnedRetryRow();
      const stopFinishedAt = new Date(Date.now() - 5 * 60_000);
      orchestrator.processAiResumeTurn.mockImplementation(async () => {
        await stopCommittedAt(
          executionId,
          stopFinishedAt,
          STOP_DURATION_MS,
        )(db);
        throw new ExecutionCancelledError();
      });

      await retry.applyRetryLastTurn(executionId, spawnedId);

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.CANCELLED);
      expect(row.finished_at?.getTime()).toBe(stopFinishedAt.getTime());
      expect(row.duration_ms).toBe(STOP_DURATION_MS);
      expect(row.error).toBeNull();
      // 서비스가 계산한 값(시작 뒤 약 10분)이 아니라 DB 가 고른 값이 이벤트에 실린다.
      expect(emitter.emitTerminalExecution).toHaveBeenCalledTimes(1);
      expect(emitter.emitTerminalExecution).toHaveBeenCalledWith(executionId, {
        type: 'cancelled',
        durationMs: STOP_DURATION_MS,
        cancelledBy: 'user',
      });
      const spawned = await readNodeExecution(spawnedId);
      expect(spawned.status).toBe(NodeExecutionStatus.CANCELLED);
    });

    it('Stop 이 시각을 남기지 않았으면 이번 값을 쓰고 이벤트도 DB 값과 같다', async () => {
      const { executionId, spawnedId } = await seedSpawnedRetryRow();
      orchestrator.processAiResumeTurn.mockImplementation(async () => {
        await stopCommittedAt(executionId, null, null)(db);
        throw new ExecutionCancelledError();
      });

      await retry.applyRetryLastTurn(executionId, spawnedId);

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.CANCELLED);
      expect(row.finished_at).not.toBeNull();
      // 시작 시각을 10분 전으로 심었으므로 이번 값은 그 이상이다.
      expect(row.duration_ms).toBeGreaterThanOrEqual(10 * 60_000);
      expect(emitter.emitTerminalExecution).toHaveBeenCalledWith(executionId, {
        type: 'cancelled',
        durationMs: row.duration_ms,
        cancelledBy: 'user',
      });
    });
  });

  describe('G4 · Stop 이 먼저 커밋되면 엔진 종결 경로는 0행이고 종결 이벤트를 내지 않는다', () => {
    it('finalizeFailedExecution', async () => {
      const executionId = await insertExecution(ExecutionStatus.RUNNING);
      const stale = await repo(Execution).findOneByOrFail({ id: executionId });
      const stopFinishedAt = new Date(Date.now() - 2 * 60_000);

      await interleaveUnderLock(
        lockExecutionRow(executionId),
        () =>
          enginePrivates.finalizeFailedExecution(stale, new Error('turn boom')),
        'G4 finalizeFailedExecution',
        stopCommittedAt(executionId, stopFinishedAt, STOP_DURATION_MS),
      );

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.CANCELLED);
      expect(row.finished_at?.getTime()).toBe(stopFinishedAt.getTime());
      expect(row.duration_ms).toBe(STOP_DURATION_MS);
      expect(row.error).toBeNull();
      expect(emitter.emitTerminalExecution).not.toHaveBeenCalled();
      expect(notifications.createMany).not.toHaveBeenCalled();
      expect(metrics.recordExecutionTerminal).not.toHaveBeenCalled();
    });

    it('[대조] finalizeFailedExecution — Stop 이 없으면 failed 로 쓰고 이벤트 · 알림을 낸다', async () => {
      const executionId = await insertExecution(ExecutionStatus.RUNNING);
      const live = await repo(Execution).findOneByOrFail({ id: executionId });

      await enginePrivates.finalizeFailedExecution(
        live,
        new Error('turn boom'),
      );

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.FAILED);
      expect(row.error).toMatchObject({ message: 'turn boom' });
      expect(emitter.emitTerminalExecution).toHaveBeenCalledTimes(1);
      expect(emitter.emitTerminalExecution).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({ type: 'failed' }),
      );
      expect(notifications.createMany).toHaveBeenCalledTimes(1);
      expect(metrics.recordExecutionTerminal).toHaveBeenCalledWith(
        ExecutionStatus.FAILED,
      );
    });

    it('failFirstSegmentSetup', async () => {
      const executionId = await insertExecution(ExecutionStatus.RUNNING);
      const stopFinishedAt = new Date(Date.now() - 2 * 60_000);

      await interleaveUnderLock(
        lockExecutionRow(executionId),
        () =>
          enginePrivates.failFirstSegmentSetup(
            executionId,
            new Error('setup boom'),
          ),
        'G4 failFirstSegmentSetup',
        stopCommittedAt(executionId, stopFinishedAt, STOP_DURATION_MS),
      );

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.CANCELLED);
      expect(row.finished_at?.getTime()).toBe(stopFinishedAt.getTime());
      expect(row.duration_ms).toBe(STOP_DURATION_MS);
      expect(row.error).toBeNull();
      expect(emitter.emitTerminalExecution).not.toHaveBeenCalled();
      expect(metrics.recordExecutionTerminal).not.toHaveBeenCalled();
    });

    it('[대조] failFirstSegmentSetup — Stop 이 없으면 failed 로 쓰고 이벤트를 낸다', async () => {
      const executionId = await insertExecution(ExecutionStatus.RUNNING);

      await enginePrivates.failFirstSegmentSetup(
        executionId,
        new Error('setup boom'),
      );

      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.FAILED);
      expect(row.error).toMatchObject({ message: 'setup boom' });
      expect(emitter.emitTerminalExecution).toHaveBeenCalledTimes(1);
      expect(emitter.emitTerminalExecution).toHaveBeenCalledWith(
        executionId,
        expect.objectContaining({ type: 'failed' }),
      );
    });

    /**
     * executeSync 가 실행 행을 새로 만들기 때문에 id 를 미리 알 수 없다. 그래서 `runExecution` 대역이 행을 `running` 으로
     * 옮긴 뒤 locker 로 잠그고 멈춘다. timeout 이 터지면 catch 의 조건부 UPDATE 가 그 잠금을 기다린다.
     */
    async function runSyncWithHeldRow(
      whileWaiting:
        ((conn: Client, executionId: string) => Promise<unknown>) | null,
    ): Promise<{ executionId: string; error: unknown }> {
      let executionId: string | undefined;
      let markStarted: () => void = () => undefined;
      const started = new Promise<void>((resolve) => {
        markStarted = resolve;
      });
      const runSpy = jest
        .spyOn(enginePrivates, 'runExecution')
        .mockImplementation(async (execution: Execution) => {
          executionId = execution.id;
          await db.query(
            `UPDATE execution SET status = 'running' WHERE id = $1`,
            [execution.id],
          );
          if (whileWaiting) {
            await locker.query(
              'SELECT id FROM execution WHERE id = $1 FOR UPDATE',
              [execution.id],
            );
          }
          markStarted();
          return new Promise<void>(() => undefined);
        });
      let pending: Promise<unknown> | undefined;
      if (whileWaiting) await locker.query('BEGIN');
      try {
        pending = engine
          .executeSync(
            workflowId,
            {},
            { timeoutMs: SYNC_TIMEOUT_MS, parentWorkspaceId: workspaceId },
          )
          .then(
            () => null,
            (err: unknown) => err,
          );
        await started;
        if (whileWaiting) {
          await waitForLockWaiters(db, lockerPid, 1, 'G4 executeSync timeout');
          await whileWaiting(locker, executionId!);
          await locker.query('COMMIT');
        }
        const error = await pending;
        return { executionId: executionId!, error };
      } finally {
        if (whileWaiting) await locker.query('ROLLBACK').catch(() => undefined);
        runSpy.mockRestore();
      }
    }

    it('executeSync timeout catch', async () => {
      const warn = jest.spyOn(enginePrivates.logger, 'warn');
      const stopFinishedAt = new Date(Date.now() - 2 * 60_000);

      const { executionId, error } = await runSyncWithHeldRow((conn, id) =>
        stopCommittedAt(id, stopFinishedAt, STOP_DURATION_MS)(conn),
      );

      expect(error).toBeInstanceOf(SubWorkflowTimeoutError);
      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.CANCELLED);
      expect(row.finished_at?.getTime()).toBe(stopFinishedAt.getTime());
      expect(row.duration_ms).toBe(STOP_DURATION_MS);
      expect(row.error).toBeNull();
      expect(
        warn.mock.calls.some((call) =>
          String(call[0]).includes('timeout FAILED 마킹 skip'),
        ),
      ).toBe(true);
      expect(metrics.recordExecutionTerminal).not.toHaveBeenCalled();
      warn.mockRestore();
    });

    it('[대조] executeSync timeout catch — Stop 이 없으면 failed 로 쓴다', async () => {
      const { executionId, error } = await runSyncWithHeldRow(null);

      expect(error).toBeInstanceOf(SubWorkflowTimeoutError);
      const row = await readExecution(executionId);
      expect(row.status).toBe(ExecutionStatus.FAILED);
      expect(row.error).toMatchObject({
        message: new SubWorkflowTimeoutError(SYNC_TIMEOUT_MS).message,
      });
      expect(metrics.recordExecutionTerminal).toHaveBeenCalledWith(
        ExecutionStatus.FAILED,
      );
    });
  });
});
