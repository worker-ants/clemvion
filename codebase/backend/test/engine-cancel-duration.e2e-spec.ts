import {
  describe,
  it,
  expect,
  beforeAll,
  afterAll,
  beforeEach,
  jest,
} from '@jest/globals';
import { ConfigService } from '@nestjs/config';
import { getQueueToken } from '@nestjs/bullmq';
import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken, getRepositoryToken } from '@nestjs/typeorm';
import { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';

// 엔진을 src 모듈 중 맨 먼저 불러온다. 엔진 ↔ 이벤트 발행기(웹소켓 경유)가 순환 import 라, 다른 서비스가 먼저
// 사슬을 열면 엔진 클래스가 정의될 때 발행기가 아직 undefined 이고 DI 메타데이터의 그 자리가 비어 주입이 실패한다.
// `retry-turn-guard-sql.e2e-spec.ts` 와 같은 순서다.
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
import { StuckExecutionRecoveryService } from '../src/modules/execution-engine/recovery/stuck-execution-recovery.service';
import { ExecutionNodeLog } from '../src/modules/execution-engine/entities/execution-node-log.entity';
import { ErrorPolicyHandler } from '../src/modules/execution-engine/error/error-policy.handler';
import { ExecutionEventEmitter } from '../src/modules/execution-engine/events/execution-event-emitter.service';
import { ExpressionResolverService } from '../src/modules/execution-engine/expression/expression-resolver.service';
import { FormInteractionService } from '../src/modules/execution-engine/form-interaction.service';
import { GraphTraversalService } from '../src/modules/execution-engine/graph/graph-traversal.service';
import { BACKGROUND_EXECUTION_QUEUE } from '../src/modules/execution-engine/queues/background-execution.queue';
import { EXECUTION_RUN_QUEUE } from '../src/modules/execution-engine/queues/execution-run.queue';
import { ShutdownStateService } from '../src/modules/execution-engine/shutdown/shutdown-state.service';
import { LlmService } from '../src/modules/llm/llm.service';
import { BusinessMetricsService } from '../src/modules/metrics/business-metrics.service';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../src/modules/node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../src/modules/nodes/entities/node.entity';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { Workflow } from '../src/modules/workflows/entities/workflow.entity';
import { NodeHandlerRegistry } from '../src/nodes/core/node-handler.registry';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * 엔티티를 읽지 않고 조건부 UPDATE 로 실행을 마감하는 엔진 경로 다섯 곳이 `RETURNING` 으로 되받은 `duration_ms` 를
 * 종결 이벤트의 `durationMs` 에 싣는지 실제 Postgres 로 본다(NERV Task CLE-T-0WDZ5G).
 *
 * ## 왜 단위 테스트로는 못 잡나
 *
 * TypeORM 의 `UpdateQueryBuilder.returning(배열)` 은 **엔티티 속성 경로**를 받는다. `QueryBuilder.getReturningColumns()` 가
 * `metadata.findColumnsWithPropertyPath(name)` 로 컬럼을 찾으므로 컬럼 이름(`'duration_ms'`)을 넘기면 맞는 속성이 없어
 * 그 이름이 조용히 빠진다. 그러면 RETURNING 절에 `id` 만 남고 `raw[0].duration_ms` 는 `undefined` 라 이벤트에는 `null` 이 실린다.
 * DB 의 `duration_ms` 는 SET 절의 SQL 이 쓰므로 DB 만 보면 맞다.
 *
 * 단위 스펙의 mock 은 `.returning()` 인자와 상관없이 정해 둔 `raw` 를 돌려주므로 이 차이를 볼 수 없다. 이 파일은 진짜
 * 리포지토리 · DataSource 로 다섯 경로를 부르고 이벤트 값과 DB 값을 맞대 본다.
 *
 * ## 무엇을 stub 으로 두나
 *
 * DB 를 쓰는 부분(리포지토리 · DataSource)은 진짜다. 이벤트 발행 · 컨텍스트 정리 · 메트릭 · 알림은 stub 이다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

/** 실행 시작 시각을 이만큼 앞당긴다. 서비스가 계산하는 소요시간이 0 이나 작은 값과 겹치지 않게 한다. */
const STARTED_AGO_MS = 10 * 60_000;

type AsyncFn = (...args: unknown[]) => Promise<unknown>;

/** 테스트가 호출하는 엔진 private 메서드. 시그니처가 바뀌면 타입 검사가 여기서 깨진다. */
interface EnginePrivates {
  markExecutionCancelled(
    executionId: string,
    code:
      | 'RESUME_CHECKPOINT_MISSING'
      | 'RESUME_FAILED'
      | 'RESUME_INCOMPATIBLE_STATE',
  ): Promise<void>;
  markQueueWaitTimeout(executionId: string): Promise<void>;
}

interface ExecutionRow {
  status: string;
  duration_ms: number | null;
}

/** 한 경로의 시나리오. 출발 상태 · 부를 메서드 · 기대하는 종결 상태와 이벤트 종류를 묶는다. */
interface TerminalPathCase {
  readonly name: string;
  readonly from: ExecutionStatus;
  /** 동반 NodeExecution 을 이 상태로 하나 둔다. 경로가 함께 마감하는 행이다. */
  readonly nodeFrom?: NodeExecutionStatus;
  readonly to: ExecutionStatus;
  readonly eventType: 'cancelled' | 'failed';
  readonly fire: (executionId: string) => Promise<unknown>;
}

describe('엔진 마감 경로의 RETURNING 이 duration_ms 를 종결 이벤트에 싣는다 (실제 Postgres)', () => {
  let db: Client;
  let ds: DataSource;
  let moduleRef: TestingModule;
  let engine: ExecutionEngineService;
  let enginePrivates: EnginePrivates;
  let workflowId: string;
  let nodeId: string;

  const emitter = {
    emitTerminalExecution: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    emitNode: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    emitExecution: jest.fn<AsyncFn>().mockResolvedValue(undefined),
    releaseExecutionRouting: jest.fn(),
  };
  const contextService = { deleteContext: jest.fn() };

  function repo<T extends object>(entity: new () => T) {
    return ds.getRepository<T>(entity);
  }

  async function insertExecution(status: ExecutionStatus): Promise<string> {
    const executions = repo(Execution);
    const saved = await executions.save(
      executions.create({
        workflowId,
        status,
        startedAt: new Date(Date.now() - STARTED_AGO_MS),
      }),
    );
    return saved.id;
  }

  async function insertNodeExecution(
    executionId: string,
    status: NodeExecutionStatus,
  ): Promise<void> {
    const nodeExecutions = repo(NodeExecution);
    await nodeExecutions.save(
      nodeExecutions.create({ executionId, nodeId, status }),
    );
  }

  async function readExecution(id: string): Promise<ExecutionRow> {
    const res = await db.query<ExecutionRow>(
      'SELECT status, duration_ms FROM execution WHERE id = $1',
      [id],
    );
    return res.rows[0];
  }

  /** 이 실행으로 나간 종결 이벤트 payload. 정확히 한 건이어야 한다. */
  function terminalPayloadOf(executionId: string): Record<string, unknown> {
    const calls = emitter.emitTerminalExecution.mock.calls.filter(
      ([id]) => id === executionId,
    );
    expect(calls).toHaveLength(1);
    return calls[0][1] as Record<string, unknown>;
  }

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();

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
      uniqueEmail('cancel-duration'),
      db,
    );
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('CANCELDUR'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('cancel-duration-wf') });
    expect(wf.status).toBe(201);
    workflowId = wf.body.data.id as string;

    const nodes = repo(Node);
    nodeId = (
      await nodes.save(
        nodes.create({
          workflowId,
          type: 'form',
          category: NodeCategory.PRESENTATION,
          label: 'cancel duration form',
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
        { provide: BusinessMetricsService, useValue: {} },
        { provide: NotificationsService, useValue: {} },
        { provide: NodeHandlerRegistry, useValue: {} },
        { provide: ExecutionContextService, useValue: contextService },
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
        { provide: StuckExecutionRecoveryService, useValue: {} },
        { provide: ShutdownStateService, useValue: {} },
        { provide: AiTurnOrchestrator, useValue: {} },
        { provide: FormInteractionService, useValue: {} },
        { provide: ButtonInteractionService, useValue: {} },
      ],
    }).compile();
    engine = moduleRef.get(ExecutionEngineService);
    enginePrivates = engine as unknown as EnginePrivates;
  }, 60_000);

  afterAll(async () => {
    await moduleRef?.close().catch(() => undefined);
    await ds?.destroy().catch(() => undefined);
    await db?.end().catch(() => undefined);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  const cases: readonly TerminalPathCase[] = [
    {
      name: 'cancelParkedExecution (applyCancellation 경유, 대기 중 취소)',
      from: ExecutionStatus.WAITING_FOR_INPUT,
      nodeFrom: NodeExecutionStatus.WAITING_FOR_INPUT,
      to: ExecutionStatus.CANCELLED,
      eventType: 'cancelled',
      fire: (id) => engine.applyCancellation(id),
    },
    {
      name: 'markWebChatIdleTimeout (공개 위젯 idle-wait 회수)',
      from: ExecutionStatus.WAITING_FOR_INPUT,
      nodeFrom: NodeExecutionStatus.WAITING_FOR_INPUT,
      to: ExecutionStatus.CANCELLED,
      eventType: 'cancelled',
      fire: (id) => engine.markWebChatIdleTimeout(id),
    },
    {
      name: 'markExecutionCancelled (재개 실패 취소)',
      from: ExecutionStatus.RUNNING,
      to: ExecutionStatus.CANCELLED,
      eventType: 'cancelled',
      fire: (id) => enginePrivates.markExecutionCancelled(id, 'RESUME_FAILED'),
    },
    {
      name: 'markQueueWaitTimeout (큐 대기 초과 취소)',
      from: ExecutionStatus.PENDING,
      to: ExecutionStatus.CANCELLED,
      eventType: 'cancelled',
      fire: (id) => enginePrivates.markQueueWaitTimeout(id),
    },
    {
      name: 'finalizeStalledExhausted (stalled 재배달 소진 실패)',
      from: ExecutionStatus.RUNNING,
      nodeFrom: NodeExecutionStatus.RUNNING,
      to: ExecutionStatus.FAILED,
      eventType: 'failed',
      fire: (id) => engine.finalizeStalledExhausted(id),
    },
  ];

  it.each(cases)(
    '$name — 이벤트의 durationMs 가 DB 의 duration_ms 와 같다',
    async ({ from, nodeFrom, to, eventType, fire }) => {
      const executionId = await insertExecution(from);
      if (nodeFrom) await insertNodeExecution(executionId, nodeFrom);

      await fire(executionId);

      const row = await readExecution(executionId);
      expect(row.status).toBe(to);
      // DB 값은 SET 절의 SQL 이 쓰므로 고치기 전에도 맞다. 시작 시각을 앞당긴 만큼은 넘어야 한다.
      expect(row.duration_ms).toBeGreaterThanOrEqual(STARTED_AGO_MS);

      const payload = terminalPayloadOf(executionId);
      expect(payload.type).toBe(eventType);
      // 핵심 단언이다. RETURNING 에서 duration_ms 가 빠지면 이 값이 null 이 된다.
      expect(payload.durationMs).toBe(row.duration_ms);
    },
  );
});
