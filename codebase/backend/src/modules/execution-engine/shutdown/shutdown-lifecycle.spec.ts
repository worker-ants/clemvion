import { WorkerHost } from '@nestjs/bullmq';
import {
  Controller,
  Get,
  Global,
  HttpStatus,
  Injectable,
  Module,
  OnModuleDestroy,
  Res,
  ServiceUnavailableException,
  type INestApplication,
} from '@nestjs/common';
import { DiscoveryModule, type NestApplicationContext } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import type { Response } from 'express';
import type { AddressInfo } from 'node:net';
import { Execution } from '../../executions/entities/execution.entity';
import { NodeExecution } from '../../node-executions/entities/node-execution.entity';
import { ShutdownStateService } from './shutdown-state.service';

/**
 * 안전 종료 훅 순서를 실제 Nest 생명주기로 본다(CLE-T-9YHJSD, 스펙 CLE-EXEC-RECOVERY-SHUTDOWN 「안전 종료」).
 *
 * `app.close('SIGTERM')` 은 `enableShutdownHooks` 의 신호 처리기와 같은 `shutdown(signal)` 을 탄다(Nest 12
 * `NestApplicationContext.listenToShutdownSignals`). 다른 점은 끝에 `process.kill` 을 하지 않는 것뿐이다.
 *
 * `@nestjs/bullmq` 는 전역 core 모듈의 `onModuleDestroy` 에서 워커를 close 한다. 이 파일은 같은 자리(전역 모듈)에
 * 가짜 explorer 를 두고 워커는 BullMQ `Worker` 의 close · pause 의미를 흉내 낸 가짜로 바꾼다. 실제 BullMQ ·
 * Redis 와 함께 도는 검증은 e2e `test/execution-shutdown-order.e2e-spec.ts` 가 맡는다.
 */

/**
 * `INestApplication.close()` 타입에는 신호 인자가 없지만 구현 `NestApplicationContext.close(signal?)` 는 받는다.
 * 신호 처리기와 같은 `shutdown(signal)` 을 타도록 구현 타입으로 불러 신호를 넘긴다.
 */
function closeWithSignal(
  app: INestApplication,
  signal: NodeJS.Signals,
): Promise<void> {
  return (app as unknown as NestApplicationContext).close(signal);
}

const GRACE_MS = 5_000;

type Event =
  | { kind: 'pause'; shuttingDown: boolean }
  | { kind: 'jobs-finished' }
  | { kind: 'explorer-close'; shuttingDown: boolean }
  | { kind: 'worker-close'; force: boolean };

/** BullMQ `Worker` 의 종료 의미만 흉내 낸다. close 는 첫 호출의 promise 를 재사용하고 force 가 아니면 작업을 기다린다. */
class FakeWorker {
  readonly name = 'execution-run';
  private closing: Promise<void> | null = null;
  private finish: () => void = () => undefined;
  private readonly jobsDone: Promise<void>;

  constructor(
    private readonly events: Event[],
    private readonly shutdownState: () => ShutdownStateService,
  ) {
    this.jobsDone = new Promise<void>((resolve) => {
      this.finish = () => {
        this.events.push({ kind: 'jobs-finished' });
        resolve();
      };
    });
  }

  finishJobs(): void {
    this.finish();
  }

  pause(doNotWaitActive?: boolean): Promise<void> {
    this.events.push({
      kind: 'pause',
      shuttingDown: this.shutdownState().isShuttingDown,
    });
    return doNotWaitActive ? Promise.resolve() : this.jobsDone;
  }

  close(force = false): Promise<void> {
    if (this.closing) return this.closing;
    this.events.push({ kind: 'worker-close', force });
    this.closing = force ? Promise.resolve() : this.jobsDone;
    return this.closing;
  }
}

@Injectable()
class TestExecutionProcessor extends WorkerHost {
  process(): Promise<void> {
    return Promise.resolve();
  }
}

/** `@nestjs/bullmq` BullExplorer 자리. 전역 모듈이라 Nest 가 onModuleDestroy 를 마지막에 부른다. */
@Injectable()
class FakeBullExplorer implements OnModuleDestroy {
  static events: Event[] = [];
  static workers: FakeWorker[] = [];
  static shutdownState: () => ShutdownStateService;

  async onModuleDestroy(): Promise<void> {
    FakeBullExplorer.events.push({
      kind: 'explorer-close',
      shuttingDown: FakeBullExplorer.shutdownState().isShuttingDown,
    });
    await Promise.all(FakeBullExplorer.workers.map((w) => w.close()));
  }
}

@Global()
@Module({ providers: [FakeBullExplorer] })
class FakeBullCoreModule {}

/** 수동 실행 진입점(`WorkflowsController`)과 같은 판정으로 503 을 낸다. */
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

function fakeRepo(): unknown {
  const execute = jest.fn().mockResolvedValue({ affected: 0 });
  const chain = {
    update: () => chain,
    set: () => chain,
    where: () => chain,
    andWhere: () => chain,
    execute,
  };
  return { createQueryBuilder: () => chain, execute };
}

async function waitFor(cond: () => boolean, timeoutMs = 2_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!cond()) {
    if (Date.now() > deadline) throw new Error('waitFor timed out');
    await new Promise((resolve) => setTimeout(resolve, 5));
  }
}

async function getProbe(
  port: number,
): Promise<{ status: number; retryAfter: string | null }> {
  const res = await fetch(`http://127.0.0.1:${port}/probe`);
  return { status: res.status, retryAfter: res.headers.get('retry-after') };
}

describe('안전 종료 훅 순서 (Nest 생명주기)', () => {
  let app: INestApplication;
  let worker: FakeWorker;
  let events: Event[];
  let port: number;

  // 종료 순서가 회귀하면 BullModule 자리의 close 가 작업을 끝없이 기다려 `app.close()` 가 끝나지 않는다.
  // 테스트가 시간 초과로 실패한 뒤에도 HTTP 서버가 닫히도록 작업을 풀어 준다.
  afterEach(async () => {
    worker?.finishJobs();
    await app?.close();
  });

  async function boot(graceMs: number): Promise<void> {
    events = [];
    FakeBullExplorer.events = events;

    @Module({
      imports: [DiscoveryModule],
      controllers: [ProbeController],
      providers: [
        ShutdownStateService,
        TestExecutionProcessor,
        { provide: getRepositoryToken(Execution), useValue: fakeRepo() },
        { provide: getRepositoryToken(NodeExecution), useValue: fakeRepo() },
        { provide: 'SHUTDOWN_GRACE_MS', useValue: graceMs },
        { provide: 'SHUTDOWN_POLL_MS', useValue: 10 },
      ],
    })
    class TestExecutionEngineModule {}

    const moduleRef = await Test.createTestingModule({
      imports: [FakeBullCoreModule, TestExecutionEngineModule],
    }).compile();
    app = moduleRef.createNestApplication({ logger: false });
    await app.listen(0, '127.0.0.1');
    port = (app.getHttpServer().address() as AddressInfo).port;

    const shutdownState = () => app.get(ShutdownStateService);
    FakeBullExplorer.shutdownState = shutdownState;
    worker = new FakeWorker(events, shutdownState);
    FakeBullExplorer.workers = [worker];
    // BullExplorer 가 하듯 processor 인스턴스에 워커를 붙인다.
    Object.defineProperty(app.get(TestExecutionProcessor), '_worker', {
      value: worker,
    });
  }

  it('종료 표시 → 워커 pause(진행 중 작업 대기) → BullModule 워커 close 순서이고, 기다리는 동안 수동 실행은 503 이다', async () => {
    await boot(GRACE_MS);
    expect((await getProbe(port)).status).toBe(HttpStatus.OK);

    const closing = closeWithSignal(app, 'SIGTERM');
    await waitFor(() => events.some((e) => e.kind === 'pause'));

    // 진행 중 작업을 기다리는 동안이다. HTTP 서버는 아직 열려 있고 종료 표시는 이미 켜졌다.
    const probe = await getProbe(port);
    expect(probe.status).toBe(HttpStatus.SERVICE_UNAVAILABLE);
    expect(probe.retryAfter).toBe(String(Math.ceil(GRACE_MS / 1000)));
    expect(events.some((e) => e.kind === 'explorer-close')).toBe(false);

    worker.finishJobs();
    await closing;

    expect(events.map((e) => e.kind)).toEqual([
      'pause',
      'jobs-finished',
      'explorer-close',
      'worker-close',
    ]);
    expect(events[0]).toEqual({ kind: 'pause', shuttingDown: true });
    expect(events[2]).toEqual({ kind: 'explorer-close', shuttingDown: true });
    // 작업이 grace 안에 끝났으므로 정상 close 다.
    expect(events[3]).toEqual({ kind: 'worker-close', force: false });
  });

  it('작업이 grace 를 넘기면 워커를 강제 close 해 BullModule 의 close 도 grace 안에 끝난다', async () => {
    await boot(200);

    const startedAt = Date.now();
    await closeWithSignal(app, 'SIGTERM');
    const elapsed = Date.now() - startedAt;

    expect(elapsed).toBeGreaterThanOrEqual(190);
    expect(elapsed).toBeLessThan(3_000);
    // 강제 close 가 먼저다. BullExplorer 의 close() 는 그 promise 를 재사용해 기다리지 않는다.
    expect(events.map((e) => e.kind)).toEqual([
      'pause',
      'worker-close',
      'explorer-close',
    ]);
    expect(events[1]).toEqual({ kind: 'worker-close', force: true });
  });
});
