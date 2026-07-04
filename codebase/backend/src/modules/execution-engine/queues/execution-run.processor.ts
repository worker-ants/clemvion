import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  EXECUTION_RUN_QUEUE,
  EXECUTION_RUN_MAX_STALLED_COUNT,
  EXECUTION_RUN_STALLED_INTERVAL_MS,
  EXECUTION_RUN_QUEUE_DEFAULT_OPTS,
  resolveExecutionRunWorkerConcurrency,
  type ExecutionRunJob,
} from './execution-run.queue';
import { ExecutionEngineService } from '../execution-engine.service';

/**
 * PR1 — Execution Intake Worker.
 *
 * SoT: spec/5-system/4-execution-engine.md §4.1–4.3.
 *
 * BullMQ `execution-run` 큐의 consumer. `execute()` 가 발행한 "실행 시작" job 을
 * 임의 backend 인스턴스가 work-stealing 으로 pick up 해 첫 active 세그먼트(시작
 * → 첫 BLOCK/완료)를 처리한다. 실제 실행은 `engine.runExecutionFromQueue` 에
 * 위임한다 (row 재조회 → status 재검증 → routing 재등록 → runExecution).
 *
 * 동시성: `EXECUTION_RUN_WORKER_CONCURRENCY` (기본 1, spec §11).
 * crash 재개 (PR4): 워커 크래시 = job stall → BullMQ 가 `maxStalledCount`(=1) 한도로
 * **같은 jobId 로 재배달** → `runExecutionFromQueue` 의 RUNNING 분기가 §7.5 case B
 * rehydration 으로 크래시 세그먼트를 재구동한다(멱등: 완료 노드 skip). 재배달이
 * maxStalledCount 를 소진하면 job → failed(dead-letter) → `onFailed` 가
 * `WORKER_HEARTBEAT_TIMEOUT` 로 마킹. (부팅/Redis-비영속/job-유실 케이스는 stalled
 * job 이 없어 `recoverStuckExecutions` 부팅 backstop 이 담당 — §7.1/§7.4.)
 */
@Processor(EXECUTION_RUN_QUEUE, {
  concurrency: resolveExecutionRunWorkerConcurrency(),
  maxStalledCount: EXECUTION_RUN_MAX_STALLED_COUNT,
  stalledInterval: EXECUTION_RUN_STALLED_INTERVAL_MS,
})
export class ExecutionRunProcessor extends WorkerHost {
  private readonly logger = new Logger(ExecutionRunProcessor.name);

  constructor(
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly engine: ExecutionEngineService,
  ) {
    super();
  }

  async process(job: Job<ExecutionRunJob>): Promise<void> {
    const { executionId, input } = job.data;
    this.logger.debug(
      `[execution-run] pick up — execution=${executionId} jobId=${job.id}`,
    );
    // runExecutionFromQueue 가 row 재조회·status(PENDING) 재검증·routing 재등록·
    // setup 실패 시 routing release 를 모두 담당한다. 본 process() 는 그 호출이
    // throw 하지 않는 한 정상 ack 한다 (PR1 은 crash-retry 미도입 — §queue opts).
    await this.engine.runExecutionFromQueue(executionId, input);
  }

  /**
   * job 실패 관측 + stalled 소진 dead-letter 마감 (PR4).
   *
   * 두 경로가 여기 도달한다: (1) setup 단계 미처리 throw — 이 경우 `runExecutionFromQueue`
   * /`redriveStuckExecution` 이 이미 Execution 을 terminal 로 마킹한 뒤다. (2) **stalled
   * 소진** — 크래시 세그먼트가 maxStalledCount 를 넘겨 BullMQ 가 job 을 failed 로 옮긴
   * 경우. 이때 Execution 은 아직 `running`(크래시 세그먼트가 마킹 못 함)이다. 따라서
   * `finalizeStalledExhausted` 가 **status='running' 조건부**로만 `failed` +
   * `WORKER_HEARTBEAT_TIMEOUT` 를 마킹한다 — (1)은 이미 terminal 이라 no-op, (2)만 발동.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<ExecutionRunJob> | undefined, err: Error): void {
    if (!job) {
      this.logger.warn(
        `[execution-run] job 실패 (job 핸들 없음): ${err?.message ?? err}`,
      );
      return;
    }
    const attemptsMade = job.attemptsMade ?? 0;
    const maxAttempts =
      job.opts?.attempts ?? EXECUTION_RUN_QUEUE_DEFAULT_OPTS.attempts;
    const executionId = job.data?.executionId;
    this.logger.warn(
      `[execution-run DEAD-LETTER] execution=${executionId} ` +
        `jobId=${job.id} attempt=${attemptsMade}/${maxAttempts} ` +
        `stalled=${job.stalledCounter ?? 0}: ${err?.message ?? err}`,
    );
    // stalled 소진 등으로 Execution 이 running 잔류 시 terminal 마감(§7.1 PR4).
    // 이미 terminal(setup-throw 경로)이면 조건부 UPDATE 가 no-op.
    if (executionId) {
      void this.engine.finalizeStalledExhausted(executionId).catch((err_) => {
        this.logger.error(
          `[execution-run] finalizeStalledExhausted 실패 execution=${executionId}: ${
            err_ instanceof Error ? err_.message : String(err_)
          }`,
        );
      });
    }
  }
}
