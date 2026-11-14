import { WorkerHost } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleDestroy,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DiscoveryService } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EngineErrorCode } from '../../../nodes/core/error-codes';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { DEFAULT_GRACE_MS } from './shutdown.constants';

/** 종료 처리가 부르는 BullMQ `Worker` 메서드. 테스트가 가짜 워커를 넣을 수 있게 좁혀 둔다. */
type DrainableWorker = Pick<WorkerHost['worker'], 'name' | 'pause' | 'close'>;

/**
 * SIGTERM 안전 종료. 스펙: CLE-EXEC-RECOVERY-SHUTDOWN 「안전 종료」.
 *
 * Nest 는 종료 때 `onModuleDestroy` → `beforeApplicationShutdown` → HTTP 서버 close →
 * `onApplicationShutdown` 순서로 훅을 부른다. 모듈은 루트에서 가까운 순서로 돌고 전역 모듈이 마지막이다.
 * `@nestjs/bullmq` 는 전역 core 모듈의 `onModuleDestroy` 에서 모든 워커를 `close()` 하는데 이 close 는 진행 중
 * 작업이 끝날 때까지 시간 한도 없이 기다린다(CLE-T-9YHJSD 실측: 10초 노드 동안 수동 실행이 503 대신 202,
 * 35초 SIGKILL 이면 `SERVER_INTERRUPTED` 표시 없이 `running` 으로 남음).
 *
 * 그래서 종료는 이 서비스의 `onModuleDestroy` 에서 시작한다. 이 서비스가 속한 ExecutionEngineModule 은 전역이
 * 아니라서 BullModule 보다 먼저 이 훅을 받는다. `onApplicationShutdown` 은 같은 종료 작업을 돌려줄 뿐이다.
 *
 * 1. `isShuttingDown` 을 첫 await 전에 true 로 바꾼다. HTTP 서버가 아직 열려 있으므로 수동 실행 진입점
 *    (`WorkflowsController`)이 503 + `Retry-After` 를 낸다.
 * 2. 모든 BullMQ 워커를 `pause()` 한다. 이 인스턴스만 새 작업을 가져가지 않고(큐 전체 pause 가 아니다) 진행 중
 *    작업이 끝나기를 기다린다. 큐를 거치지 않는 노드 실행은 `inFlightNodeExecutions` 로 따로 기다린다.
 *    shutdown 진입 뒤 같은 세그먼트가 시작하는 다음 노드도 등록 대상이다(세그먼트 완료 보장).
 * 3. 둘 다 끝나면 반환한다. 워커의 정상 close 는 BullExplorer 가 이어서 한다.
 * 4. `SIGTERM_GRACE_MS` 가 지나면 남은 노드 실행과 실행을 원자 UPDATE 로 `FAILED` +
 *    `error.code='SERVER_INTERRUPTED'` 로 표시하고 워커를 `close(true)` 로 강제 close 한다. BullMQ 는 첫 close
 *    호출의 promise 를 재사용하므로 BullExplorer 의 close 도 기다리지 않고 끝난다. **입력 대기 실행은 건드리지
 *    않는다.**
 *
 * 다른 인스턴스의 RUNNING row 를 잘못 종결시키지 않기 위해 SQL `WHERE id IN
 * (:...ids)` 로 **본 인스턴스가 register 한 nodeExecutionId 만** 마킹한다.
 */
@Injectable()
export class ShutdownStateService
  implements OnModuleDestroy, OnApplicationShutdown
{
  private readonly logger = new Logger(ShutdownStateService.name);

  /** nodeExecutionId → executionId */
  private readonly inFlightNodeExecutions = new Map<string, string>();

  private shuttingDown = false;

  /** 진행 중이거나 끝난 종료 작업. 두 훅이 같은 작업을 기다린다(grace 시계는 하나다). */
  private shutdownTask: Promise<void> | null = null;

  // W-19 fix (SUMMARY#W-19): 필드 선언을 생성자 위로 이동 — 스타일 일치.
  private readonly graceMs: number;
  private readonly pollMs: number;

  constructor(
    @InjectRepository(Execution)
    private readonly executionRepository: Repository<Execution>,
    @InjectRepository(NodeExecution)
    private readonly nodeExecutionRepository: Repository<NodeExecution>,
    @Optional()
    @Inject('SHUTDOWN_GRACE_MS')
    graceMs?: number,
    @Optional()
    @Inject('SHUTDOWN_POLL_MS')
    pollMs?: number,
    // 워커를 찾는 데만 쓴다. 엔진 단위 스펙처럼 DiscoveryModule 없이 DI 로 만드는 곳이 있어 선택 주입이다.
    @Optional()
    private readonly discovery?: DiscoveryService,
  ) {
    // W-18 fix (SUMMARY#W-18): DEFAULT_GRACE_MS 상수 단일화.
    this.graceMs = graceMs ?? DEFAULT_GRACE_MS;
    this.pollMs = pollMs ?? 200;
  }

  /**
   * 별도 factory 로도 instance 가능 (테스트 직접 호출). DI 의 ConfigService
   * 우선 적용은 `ShutdownStateService.forRoot` 형태가 필요하면 추후 도입.
   */
  static fromConfig(
    config: ConfigService,
    executionRepository: Repository<Execution>,
    nodeExecutionRepository: Repository<NodeExecution>,
  ): ShutdownStateService {
    const graceMs = Number(config.get('SIGTERM_GRACE_MS') ?? DEFAULT_GRACE_MS);
    return new ShutdownStateService(
      executionRepository,
      nodeExecutionRepository,
      graceMs,
    );
  }

  get isShuttingDown(): boolean {
    return this.shuttingDown;
  }

  get inFlightCount(): number {
    return this.inFlightNodeExecutions.size;
  }

  /** HTTP 503 응답의 `Retry-After` 헤더 값 (초, ceil). */
  get retryAfterSec(): number {
    return Math.ceil(this.graceMs / 1000);
  }

  /**
   * NodeExecution 시작 직전 호출. 본 인스턴스가 처리 중인 row 식별.
   *
   * M-2 (06-concurrency) — shutdown 중에도 등록한다 (옛 `if (shuttingDown) return`
   * early-return 제거). §11.2 가 "현재 세그먼트를 완료까지 진행" 을 약속하고 세그먼트
   * 내부 노드는 큐 미경유 in-process while-loop 로 dispatch 되므로(§4.2), shutdown
   * 진입 후에도 같은 세그먼트의 다음 노드가 계속 시작된다. 이를 등록하지 않으면 grace
   * 만료 시 마킹 대상에서 누락돼 §11.4 "미완료 RUNNING → failed + SERVER_INTERRUPTED"
   * 약속이 깨지고 zombie RUNNING row 가 남는다. 신규 세그먼트 job consume 중단은
   * 종료 시작 때 이 서비스가 워커마다 거는 `worker.pause()` 가 맡는다. 이 인스턴스의 워커만 멈추므로
   * 큐 전체 플래그인 `queue.pause()` 처럼 다른 인스턴스를 세우지 않는다.
   */
  registerInFlight(nodeExecutionId: string, executionId: string): void {
    this.inFlightNodeExecutions.set(nodeExecutionId, executionId);
  }

  /** NodeExecution 종료 (성공/실패/skip) 시 호출. */
  unregisterInFlight(nodeExecutionId: string): void {
    this.inFlightNodeExecutions.delete(nodeExecutionId);
  }

  /**
   * 종료 시작점. Nest 가 SIGTERM(`enableShutdownHooks`)이나 `app.close()` 에서 부른다. 전역 BullModule 의
   * 워커 close 보다 먼저 돈다.
   */
  onModuleDestroy(): Promise<void> {
    return this.shutdown();
  }

  /** `onModuleDestroy` 가 시작한 종료를 기다린다. 그 훅이 돌지 않은 경로에서는 여기서 시작한다. */
  onApplicationShutdown(signal?: string): Promise<void> {
    return this.shutdown(signal);
  }

  private shutdown(signal?: string): Promise<void> {
    this.shutdownTask ??= this.runShutdown(signal);
    return this.shutdownTask;
  }

  private async runShutdown(signal?: string): Promise<void> {
    // 첫 await 전에 표시한다. 이후의 대기 동안 수동 실행 진입점이 503 을 낸다.
    this.shuttingDown = true;
    const deadline = Date.now() + this.graceMs;

    const workers = this.collectWorkers();
    const pause = this.pauseWorkers(workers);

    this.logger.log(
      `Graceful shutdown started${signal ? ` (signal=${signal})` : ''}; paused ${workers.length} worker(s), ` +
        `waiting up to ${this.graceMs}ms for their active jobs and ${this.inFlightCount} in-flight node execution(s)`,
    );

    const drained = await this.waitUntil(
      deadline,
      () => pause.isSettled() && this.inFlightCount === 0,
    );
    if (drained) {
      this.logger.log(
        'Graceful shutdown: active jobs and node executions completed cleanly',
      );
      return;
    }

    const remainingNodeExecutionIds = Array.from(
      this.inFlightNodeExecutions.keys(),
    );
    const remainingExecutionIds = Array.from(
      new Set(this.inFlightNodeExecutions.values()),
    );
    this.logger.warn(
      `Grace period elapsed; marking ${remainingNodeExecutionIds.length} node execution(s) + ` +
        `${remainingExecutionIds.length} execution(s) as SERVER_INTERRUPTED` +
        (pause.isSettled()
          ? ''
          : ' and force-closing workers with active jobs'),
    );
    await this.markRemainingAsInterrupted(
      remainingNodeExecutionIds,
      remainingExecutionIds,
    );
    if (!pause.isSettled()) {
      await this.forceCloseWorkers(workers);
    }
  }

  /**
   * 모든 워커를 pause 한다. 인자 없는 pause() 는 새 작업을 멈추고 진행 중 작업이 끝날 때까지 기다린다(이 인스턴스의
   * 워커만). 작업이 끝나면 BullMQ 가 차단 연결을 다시 연다. 강제 close 뒤에 작업이 끝나도 마찬가지인데, 그때는 종료
   * 훅이 끝나 프로세스가 곧 끝나므로 연결이 남지 않는다. `isSettled()` 는 모든 pause 가 끝났는지(워커가 없으면 즉시
   * true) 알려 준다.
   */
  private pauseWorkers(workers: DrainableWorker[]): {
    isSettled: () => boolean;
  } {
    let settled = workers.length === 0;
    void Promise.allSettled(
      workers.map((worker) =>
        worker.pause().catch((err: unknown) => {
          this.logger.warn(
            `Graceful shutdown: pausing worker "${worker.name}" failed — ${errorMessage(err)}`,
          );
        }),
      ),
    ).then(() => {
      settled = true;
    });
    return { isSettled: () => settled };
  }

  /** `@Processor` 로 등록된 워커 전부. 초기화되지 않은 WorkerHost 는 건너뛴다. */
  private collectWorkers(): DrainableWorker[] {
    if (!this.discovery) {
      this.logger.warn(
        'Graceful shutdown: DiscoveryService is not wired; BullMQ workers will not be paused or force-closed',
      );
      return [];
    }
    const workers: DrainableWorker[] = [];
    for (const wrapper of this.discovery.getProviders()) {
      const instance: unknown = wrapper.instance;
      if (!isWorkerHost(instance)) continue;
      try {
        workers.push(instance.worker);
      } catch {
        // `worker` getter 는 BullExplorer 가 워커를 붙이기 전이면 던진다. 기다릴 작업도 없다.
      }
    }
    return workers;
  }

  private async forceCloseWorkers(workers: DrainableWorker[]): Promise<void> {
    await Promise.allSettled(
      workers.map((worker) =>
        worker.close(true).catch((err: unknown) => {
          this.logger.warn(
            `Graceful shutdown: force-closing worker "${worker.name}" failed — ${errorMessage(err)}`,
          );
        }),
      ),
    );
  }

  private async waitUntil(
    deadline: number,
    done: () => boolean,
  ): Promise<boolean> {
    while (Date.now() < deadline) {
      if (done()) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, this.pollMs));
    }
    return done();
  }

  private async markRemainingAsInterrupted(
    nodeExecutionIds: string[],
    executionIds: string[],
  ): Promise<void> {
    const finishedAt = new Date();

    if (nodeExecutionIds.length > 0) {
      try {
        await this.nodeExecutionRepository
          .createQueryBuilder()
          .update(NodeExecution)
          .set({
            status: NodeExecutionStatus.FAILED,
            error: {
              code: EngineErrorCode.SERVER_INTERRUPTED,
              message:
                'NodeExecution interrupted by server shutdown (SIGTERM grace period elapsed)',
            },
            finishedAt,
          })
          .where('id IN (:...ids)', { ids: nodeExecutionIds })
          .andWhere('status = :status', {
            status: NodeExecutionStatus.RUNNING,
          })
          .execute();
      } catch (err) {
        this.logger.error(
          `Failed to mark remaining NodeExecution rows as SERVER_INTERRUPTED: ${errorMessage(err)}`,
        );
      }
    }

    if (executionIds.length > 0) {
      try {
        await this.executionRepository
          .createQueryBuilder()
          .update(Execution)
          .set({
            status: ExecutionStatus.FAILED,
            error: {
              code: EngineErrorCode.SERVER_INTERRUPTED,
              message:
                'Execution interrupted by server shutdown (SIGTERM grace period elapsed)',
            },
            finishedAt,
          })
          .where('id IN (:...ids)', { ids: executionIds })
          .andWhere('status = :status', { status: ExecutionStatus.RUNNING })
          .execute();
      } catch (err) {
        this.logger.error(
          `Failed to mark remaining Execution rows as SERVER_INTERRUPTED: ${errorMessage(err)}`,
        );
      }
    }
  }
}

/** `instanceof WorkerHost` 는 제네릭 인자를 any 로 좁힌다. 기본 인자(BullMQ `Worker`)로 좁히는 가드다. */
function isWorkerHost(value: unknown): value is WorkerHost {
  return value instanceof WorkerHost;
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
