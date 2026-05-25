import {
  Inject,
  Injectable,
  Logger,
  OnApplicationShutdown,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  Execution,
  ExecutionStatus,
} from '../../executions/entities/execution.entity';
import {
  NodeExecution,
  NodeExecutionStatus,
} from '../../node-executions/entities/node-execution.entity';
import { DEFAULT_GRACE_MS } from './shutdown.constants';

/**
 * Phase 1.2 — Graceful Shutdown.
 *
 * SoT: spec/5-system/4-execution-engine.md §11 Graceful Shutdown.
 *
 * SIGTERM 수신 시:
 * 1. `isShuttingDown` 플래그가 즉시 true 로 전환되어 신규 Execution 시작이
 *    503 으로 거부된다 (`WorkflowsController.execute` 가 본 서비스의
 *    `isShuttingDown` / `retryAfterSec` 을 읽어 응답 헤더 + body 구성).
 * 2. `inFlightNodeExecutions` 가 비기를 기다린다 — 활성 NodeExecution 핸들러는
 *    `ExecutionEngineService.executeNode` 의 try/finally 에서 등록/해제된다.
 * 3. `SIGTERM_GRACE_MS` (기본 30000) 경과 후 남은 in-flight 는 단일 atomic
 *    UPDATE 로 `FAILED` + `error.code='SERVER_INTERRUPTED'` 마킹. 동반 Execution
 *    도 마찬가지로 마킹. **WAITING_FOR_INPUT 은 본 서비스가 절대 건드리지
 *    않는다** — 입력 fan-out 은 별개 lifecycle (§7.4 / §7.5 rehydration).
 * 4. Nest 의 lifecycle 시스템이 강제 종료를 이어서 수행.
 *
 * 다른 인스턴스의 RUNNING row 를 잘못 종결시키지 않기 위해 SQL `WHERE id IN
 * (:...ids)` 로 **본 인스턴스가 register 한 nodeExecutionId 만** 마킹한다.
 */
@Injectable()
export class ShutdownStateService implements OnApplicationShutdown {
  private readonly logger = new Logger(ShutdownStateService.name);

  /** nodeExecutionId → executionId */
  private readonly inFlightNodeExecutions = new Map<string, string>();

  private shuttingDown = false;

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
   * shutdown 진행 중이면 무시 (이미 큐 consume 중단된 상태로 새 진입은 없음 — race 대비 가드).
   */
  registerInFlight(nodeExecutionId: string, executionId: string): void {
    if (this.shuttingDown) return;
    this.inFlightNodeExecutions.set(nodeExecutionId, executionId);
  }

  /** NodeExecution 종료 (성공/실패/skip) 시 호출. */
  unregisterInFlight(nodeExecutionId: string): void {
    this.inFlightNodeExecutions.delete(nodeExecutionId);
  }

  async onApplicationShutdown(signal?: string): Promise<void> {
    if (this.shuttingDown) {
      // 두 번째 호출 (drain 중 다른 lifecycle 훅이 다시 호출) — noop.
      return;
    }
    this.shuttingDown = true;

    if (this.inFlightCount === 0) {
      this.logger.log(
        `Graceful shutdown received (signal=${signal ?? 'unknown'}); no in-flight node executions`,
      );
      return;
    }

    this.logger.log(
      `Graceful shutdown received (signal=${signal ?? 'unknown'}); ` +
        `waiting up to ${this.graceMs}ms for ${this.inFlightCount} in-flight node execution(s) to drain`,
    );

    const drained = await this.waitForDrain(this.graceMs, this.pollMs);
    if (drained) {
      this.logger.log('All in-flight node executions completed cleanly');
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
        `${remainingExecutionIds.length} execution(s) as SERVER_INTERRUPTED`,
    );
    await this.markRemainingAsInterrupted(
      remainingNodeExecutionIds,
      remainingExecutionIds,
    );
  }

  private async waitForDrain(
    timeoutMs: number,
    pollMs: number,
  ): Promise<boolean> {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (this.inFlightCount === 0) return true;
      await new Promise<void>((resolve) => setTimeout(resolve, pollMs));
    }
    return this.inFlightCount === 0;
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
              code: 'SERVER_INTERRUPTED',
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
          `Failed to mark remaining NodeExecution rows as SERVER_INTERRUPTED: ${
            err instanceof Error ? err.message : String(err)
          }`,
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
              code: 'SERVER_INTERRUPTED',
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
          `Failed to mark remaining Execution rows as SERVER_INTERRUPTED: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
      }
    }
  }
}
