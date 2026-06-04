import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  EXECUTION_RUN_QUEUE,
  EXECUTION_RUN_MAX_STALLED_COUNT,
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
 * crash 재개: PR1 미구현 — `maxStalledCount: 0` 으로 stalled job 재배달을 막아
 * 비멱등 노드 이중 실행을 방지한다 (PR3/PR4 가 멱등 rehydration + stalled
 * 일원화 도입).
 */
@Processor(EXECUTION_RUN_QUEUE, {
  concurrency: resolveExecutionRunWorkerConcurrency(),
  maxStalledCount: EXECUTION_RUN_MAX_STALLED_COUNT,
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
   * job 실패 관측 (PR1 attempts:1 이므로 첫 실패가 곧 dead-letter). 일반적으로
   * `runExecutionFromQueue` 내부에서 실행 실패를 Execution `failed` 로 마킹하고
   * 정상 반환하므로 본 핸들러는 setup 단계 미처리 throw 경로에서만 발생한다.
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
    this.logger.warn(
      `[execution-run DEAD-LETTER] execution=${job.data?.executionId} ` +
        `jobId=${job.id} attempt=${attemptsMade}/${maxAttempts}: ${err?.message ?? err}`,
    );
  }
}
