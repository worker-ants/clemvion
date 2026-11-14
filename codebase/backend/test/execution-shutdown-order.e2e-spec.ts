import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
} from '@jest/globals';
import {
  BullModule,
  OnWorkerEvent,
  Processor,
  WorkerHost,
} from '@nestjs/bullmq';
import {
  Controller,
  Get,
  HttpStatus,
  Module,
  Res,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Job, Queue } from 'bullmq';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { AddressInfo } from 'node:net';
import type { Client } from 'pg';
import request from 'supertest';
import { DataSource } from 'typeorm';

import { ROOT_ENTITIES } from '../src/database/root-entities';
import { EXECUTION_RUN_QUEUE } from '../src/modules/execution-engine/queues/execution-run.queue';
import { ShutdownStateService } from '../src/modules/execution-engine/shutdown/shutdown-state.service';
import {
  Execution,
  ExecutionStatus,
} from '../src/modules/executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../src/modules/node-executions/entities/node-execution.entity';
import { Node, NodeCategory } from '../src/modules/nodes/entities/node.entity';

import { createTeamWorkspace, registerAndLogin } from './helpers/auth';
import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';

/**
 * SIGTERM 안전 종료 순서를 실제 BullMQ · Redis · Postgres 로 본다
 * (NERV Task CLE-T-9YHJSD, 스펙 CLE-EXEC-RECOVERY-SHUTDOWN 「안전 종료」 1~5단계).
 *
 * ## 무엇을 띄우나
 *
 * 러너 프로세스 안에 작은 Nest 앱을 띄운다. 공유 backend-e2e 에는 신호를 보낼 수 없고, 보내면 뒤따르는 스위트가 깨진다.
 *
 * - 진짜: `@nestjs/bullmq` 의 `BullModule`(전역 core 모듈 · BullExplorer · `Worker`), Redis, `ShutdownStateService`,
 *   Postgres 행과 `SERVER_INTERRUPTED` UPDATE, HTTP 서버.
 * - 대역: 엔진 대신 `execution-run` 큐 작업을 오래 잡고 있는 processor. 엔진처럼 노드 실행을 `registerInFlight` 로
 *   등록한다. 수동 실행 진입점 대신 `WorkflowsController` 와 같은 판정으로 503 을 내는 probe 경로.
 * - 큐 키는 앱마다 새 BullMQ prefix 를 쓴다. backend-e2e 의 워커가 이 작업을 가져가지 않고 이 앱도 backend-e2e 의
 *   작업을 가져가지 않는다.
 *
 * ## 신호 대신 `app.close('SIGTERM')`
 *
 * `enableShutdownHooks` 의 신호 처리기는 `shutdown(signal)` 을 기다린 뒤 `process.kill` 로 끝난다. `app.close(signal)`
 * 은 같은 `shutdown(signal)` 을 부르고 `process.kill` 만 하지 않는다(Nest 12 `NestApplicationContext`). 그래서 훅
 * 순서는 같고 러너 프로세스는 살아 있다.
 *
 * ## 고치기 전에는
 *
 * 2026-11-14 실측(main `2e05bef5c`)에서 Nest 는 `onModuleDestroy` 에서 워커 close 를 진행 중 작업이 끝날 때까지 기다렸고
 * 종료 표시는 그 뒤 `onApplicationShutdown` 에서야 켜졌다. 그 서비스 코드로 이 파일을 돌리면 첫 케이스는 1초 안에
 * 종료 표시가 켜지지 않아(`waitFor timed out`), 둘째 케이스는 close 가 끝나지 않아 30초 시간 초과로 실패한다.
 */
const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';

const connection = {
  host: process.env.REDIS_HOST ?? 'redis',
  port: Number(process.env.REDIS_PORT ?? '6379'),
  ...(process.env.REDIS_PASSWORD
    ? { password: process.env.REDIS_PASSWORD }
    : {}),
};

interface HoldJobData {
  executionId: string;
  nodeExecutionId: string;
  /** null 이면 풀어 줄 때까지 붙잡는다. */
  holdMs: number | null;
}

/** 붙잡아 둔 작업을 푸는 함수. 앱 close 가 끝나지 않은 테스트만 afterEach 에서 쓴다. */
const releases = new Map<string, () => void>();
const startedJobIds = new Set<string>();

let ds: DataSource;

/**
 * 엔진 자리. 노드 실행 하나를 등록하고 `holdMs` 동안 붙잡은 뒤 완료로 기록한다. `release` 로 풀면 행은
 * 건드리지 않는다.
 */
@Processor(EXECUTION_RUN_QUEUE)
class HoldingExecutionProcessor extends WorkerHost {
  constructor(private readonly shutdownState: ShutdownStateService) {
    super();
  }

  async process(job: Job<HoldJobData>): Promise<void> {
    const { executionId, nodeExecutionId, holdMs } = job.data;
    this.shutdownState.registerInFlight(nodeExecutionId, executionId);
    startedJobIds.add(String(job.id));
    let released = false;
    try {
      await new Promise<void>((resolve) => {
        const timer =
          holdMs === null ? undefined : setTimeout(resolve, holdMs).unref();
        releases.set(String(job.id), () => {
          released = true;
          clearTimeout(timer);
          resolve();
        });
      });
    } finally {
      this.shutdownState.unregisterInFlight(nodeExecutionId);
    }
    if (released) return;
    await ds
      .getRepository(NodeExecution)
      .update(
        { id: nodeExecutionId, status: NodeExecutionStatus.RUNNING },
        { status: NodeExecutionStatus.COMPLETED, finishedAt: new Date() },
      );
  }

  // 강제 close 뒤 연결이 닫힌 상태에서 나는 오류를 흘려보낸다. 리스너가 없으면 EventEmitter 가 던진다.
  @OnWorkerEvent('error')
  onError(): void {}
}

/** 수동 실행 진입점(`WorkflowsController.execute`)과 같은 판정. */
@Controller('probe')
class ProbeController {
  constructor(private readonly shutdownState: ShutdownStateService) {}

  @Get()
  probe(@Res({ passthrough: true }) res: Response): { ok: true } {
    if (this.shutdownState.isShuttingDown) {
      res.setHeader('Retry-After', String(this.shutdownState.retryAfterSec));
      throw new ServiceUnavailableException({ code: 'SERVER_SHUTTING_DOWN' });
    }
    return { ok: true };
  }
}

interface BootedApp {
  app: INestApplication;
  port: number;
  shutdownState: ShutdownStateService;
  /** 같은 prefix 로 작업을 넣고 상태를 읽는 클라이언트. 앱과 따로 닫는다. */
  queue: Queue;
  closed: boolean;
}

async function waitFor(
  cond: () => boolean | Promise<boolean>,
  timeoutMs = 10_000,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!(await cond())) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}

describe('SIGTERM 안전 종료 순서 (실제 BullMQ · Redis · Postgres)', () => {
  let db: Client;
  let workflowId: string;
  let nodeId: string;
  const booted: BootedApp[] = [];

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
      uniqueEmail('shutdown-order'),
      db,
    );
    const workspaceId = await createTeamWorkspace(
      BASE_URL,
      owner.accessToken,
      uniqueName('SHUTDOWN'),
    );
    const wf = await request(BASE_URL)
      .post('/api/workflows')
      .set('Authorization', `Bearer ${owner.accessToken}`)
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('shutdown-order-wf') });
    expect(wf.status).toBe(201);
    workflowId = (wf.body.data as { id: string }).id;

    const nodes = ds.getRepository(Node);
    nodeId = (
      await nodes.save(
        nodes.create({
          workflowId,
          type: 'code',
          category: NodeCategory.DATA,
          label: 'shutdown hold',
          config: {},
        }),
      )
    ).id;
  });

  afterEach(async () => {
    // 앱 close 가 끝나지 않은 채 실패한 테스트만 작업을 풀어 close 를 끝낸다.
    //
    // 강제 close 로 끝낸 앱의 작업은 풀지 않는다. 풀면 그 작업을 기다리던 `worker.pause()` 가 이어서 BullMQ 의
    // 차단 연결을 다시 열고, 그 Redis 연결이 jest 프로세스를 붙잡는다. 실제 서버는 종료 훅이 끝나면 프로세스가
    // 끝나서 이 재연결까지 가지 않는다.
    const open = booted.filter((b) => !b.closed);
    if (open.length > 0) {
      for (const release of releases.values()) release();
    }
    releases.clear();
    for (const b of open) {
      b.closed = true;
      await b.app.close();
    }
  });

  afterAll(async () => {
    for (const b of booted) {
      await b.queue.obliterate({ force: true }).catch(() => undefined);
      await b.queue.close();
    }
    await ds?.destroy();
    await db?.end();
  });

  async function boot(graceMs: number): Promise<BootedApp> {
    const prefix = `e2e-shutdown-${randomUUID()}`;

    // ExecutionEngineModule 자리. 전역이 아니라 BullModule core 보다 먼저 onModuleDestroy 를 받는다.
    @Module({
      imports: [
        DiscoveryModule,
        BullModule.registerQueue({ name: EXECUTION_RUN_QUEUE }),
      ],
      controllers: [ProbeController],
      providers: [
        ShutdownStateService,
        HoldingExecutionProcessor,
        {
          provide: getRepositoryToken(Execution),
          useValue: ds.getRepository(Execution),
        },
        {
          provide: getRepositoryToken(NodeExecution),
          useValue: ds.getRepository(NodeExecution),
        },
        { provide: 'SHUTDOWN_GRACE_MS', useValue: graceMs },
        { provide: 'SHUTDOWN_POLL_MS', useValue: 20 },
      ],
    })
    class ShutdownProbeEngineModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [
        BullModule.forRoot({ connection, prefix }),
        ShutdownProbeEngineModule,
      ],
    }).compile();
    const app = moduleRef.createNestApplication({ logger: ['error'] });
    await app.listen(0, '0.0.0.0');
    const b: BootedApp = {
      app,
      port: (app.getHttpServer().address() as AddressInfo).port,
      shutdownState: app.get(ShutdownStateService),
      queue: new Queue(EXECUTION_RUN_QUEUE, { connection, prefix }),
      closed: false,
    };
    booted.push(b);
    return b;
  }

  async function seedRunning(): Promise<{
    executionId: string;
    nodeExecutionId: string;
  }> {
    const executions = ds.getRepository(Execution);
    const executionId = (
      await executions.save(
        executions.create({
          workflowId,
          status: ExecutionStatus.RUNNING,
          startedAt: new Date(),
        }),
      )
    ).id;
    const nodeExecutions = ds.getRepository(NodeExecution);
    const nodeExecutionId = (
      await nodeExecutions.save(
        nodeExecutions.create({
          executionId,
          nodeId,
          status: NodeExecutionStatus.RUNNING,
          startedAt: new Date(),
        }),
      )
    ).id;
    return { executionId, nodeExecutionId };
  }

  async function startHoldingJob(
    b: BootedApp,
    holdMs: number | null,
  ): Promise<{ jobId: string; executionId: string; nodeExecutionId: string }> {
    const seeded = await seedRunning();
    const job = await b.queue.add('hold', { ...seeded, holdMs });
    const jobId = String(job.id);
    await waitFor(() => startedJobIds.has(jobId));
    return { jobId, ...seeded };
  }

  async function probe(
    port: number,
  ): Promise<{ status: number; retryAfter: string | undefined }> {
    const res = await request(`http://127.0.0.1:${port}`).get('/probe');
    return {
      status: res.status,
      retryAfter: res.headers['retry-after'] as string | undefined,
    };
  }

  it('작업이 grace 안에 끝나면: 종료 표시 즉시 503, 새 작업은 가져가지 않고, 진행 중 작업은 끝까지 진행한다', async () => {
    const graceMs = 20_000;
    const b = await boot(graceMs);
    expect((await probe(b.port)).status).toBe(HttpStatus.OK);
    const held = await startHoldingJob(b, 2_000);

    const startedAt = Date.now();
    const closing = b.app.close('SIGTERM').then(() => {
      b.closed = true;
    });

    // 진행 중 작업을 기다리는 동안이다. HTTP 서버는 열려 있고 수동 실행은 503 이다.
    await waitFor(() => b.shutdownState.isShuttingDown, 1_000);
    const during = await probe(b.port);
    expect(during.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(during.retryAfter).toBe(String(Math.ceil(graceMs / 1000)));

    // 종료 중에 들어온 작업은 이 인스턴스가 가져가지 않는다. 큐에 남아 다른 인스턴스가 가져간다.
    const late = await b.queue.add('hold', {
      ...(await seedRunning()),
      holdMs: 0,
    });

    await closing;
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeLessThan(graceMs);
    expect(await b.queue.getJobState(held.jobId)).toBe('completed');
    expect(startedJobIds.has(String(late.id))).toBe(false);
    expect(await b.queue.getJobState(String(late.id))).toBe('waiting');

    const nodeRow = await ds
      .getRepository(NodeExecution)
      .findOneByOrFail({ id: held.nodeExecutionId });
    expect(nodeRow.status).toBe(NodeExecutionStatus.COMPLETED);
    expect(nodeRow.error ?? null).toBeNull();
  }, 30_000);

  it('작업이 grace 를 넘기면: grace 에서 노드 실행 · 실행을 SERVER_INTERRUPTED 로 표시하고 워커 close 도 grace 안에 끝난다', async () => {
    const graceMs = 2_000;
    const b = await boot(graceMs);
    const held = await startHoldingJob(b, null);

    const startedAt = Date.now();
    await b.app.close('SIGTERM');
    b.closed = true;
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(graceMs - 100);
    expect(elapsed).toBeLessThan(graceMs + 5_000);

    const nodeRow = await ds
      .getRepository(NodeExecution)
      .findOneByOrFail({ id: held.nodeExecutionId });
    expect(nodeRow.status).toBe(NodeExecutionStatus.FAILED);
    expect((nodeRow.error as { code?: string } | null)?.code).toBe(
      'SERVER_INTERRUPTED',
    );
    const execRow = await ds
      .getRepository(Execution)
      .findOneByOrFail({ id: held.executionId });
    expect(execRow.status).toBe(ExecutionStatus.FAILED);
    expect((execRow.error as { code?: string } | null)?.code).toBe(
      'SERVER_INTERRUPTED',
    );

    // 강제 close 라 작업은 active 로 남는다. 잠금이 만료되면 다른 인스턴스의 stalled 검사가 다시 넣고, 그 워커는
    // 실행이 failed 라 버린다(스펙 Rationale 「다른 인스턴스는 이어받지 않는다」).
    expect(await b.queue.getJobState(held.jobId)).toBe('active');
  }, 30_000);
});
