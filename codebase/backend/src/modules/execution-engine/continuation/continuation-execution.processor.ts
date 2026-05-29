import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Inject, Logger, forwardRef } from '@nestjs/common';
import type { Job } from 'bullmq';
import {
  CONTINUATION_EXECUTION_QUEUE,
  CONTINUATION_QUEUE_DEFAULT_OPTS,
  type ContinuationJob,
} from '../queues/continuation-execution.queue';
import { ExecutionEngineService } from '../execution-engine.service';

/**
 * Phase 2 — Durable Continuation Worker.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §7.5.
 *
 * BullMQ `execution-continuation` 큐의 단일 consumer. 옛 Redis pub/sub
 * subscriber (ExecutionEngineService.registerContinuationHandlers) 를 대체.
 *
 * 처리 흐름 (spec §7.5):
 * - 임의 인스턴스의 worker 가 job pick up.
 * - 로컬 `pendingContinuations` Map 키 hit → 즉시 resolve (fast path,
 *   동일 인스턴스가 publisher 였던 케이스 + 같은 인스턴스가 worker 픽업).
 * - 키 miss → §7.5 rehydration slow path:
 *     · Execution.status === 'waiting_for_input' 검증
 *     · NodeExecution.outputData 에서 체크포인트 로드
 *     · ExecutionContext 재구성
 *     · waitForX() 재진입 + 즉시 resolver 호출
 *     · 그래프 순회 재개
 *
 * 실패 처리 (spec §7.5 표):
 * - RESUME_CHECKPOINT_MISSING — NodeExecution.outputData 부재/손상
 * - RESUME_INCOMPATIBLE_STATE — _resumeState deserialize 실패
 * - RESUME_FAILED — BullMQ attempts 소진 (dead-letter)
 *
 * Idempotency:
 * - BullMQ jobId 중복 = 거부 (publisher 측 nextSeq 단조 증가).
 * - 추가 가드: 처리 전 NodeExecution.status === 'waiting_for_input' 재검증.
 *   COMPLETED / FAILED 면 다른 worker 가 먼저 처리한 것 — ack-and-discard.
 */
@Processor(CONTINUATION_EXECUTION_QUEUE)
export class ContinuationExecutionProcessor extends WorkerHost {
  private readonly logger = new Logger(ContinuationExecutionProcessor.name);

  constructor(
    @Inject(forwardRef(() => ExecutionEngineService))
    private readonly engine: ExecutionEngineService,
  ) {
    super();
  }

  async process(job: Job<ContinuationJob>): Promise<void> {
    const { type, executionId, nodeExecutionId, payload } = job.data;
    this.logger.debug(
      `[${type}] pick up — execution=${executionId} nodeExec=${nodeExecutionId} jobId=${job.id}`,
    );

    // §7.5 멱등성 보강: 처리 전 NodeExecution 상태 재검증. 이미 COMPLETED/FAILED
    // 면 다른 worker 가 먼저 처리한 결과로 본다. cancel 류는 status 무관.
    if (type !== 'cancel') {
      const stillWaiting =
        await this.engine.isNodeExecutionWaiting(nodeExecutionId);
      if (!stillWaiting) {
        this.logger.debug(
          `[${type}] ack-and-discard — nodeExec=${nodeExecutionId} 이 이미 COMPLETED/FAILED. (정상 race)`,
        );
        return;
      }
    }

    // 단일 dispatch table — 옛 registerContinuationHandlers 의 5 case 와 일치.
    // Engine 메서드는 fast path (Map hit) 와 slow path (rehydration) 를 자체
    // 분기해 처리한다.
    switch (type) {
      case 'continue':
        await this.engine.applyContinuation(
          executionId,
          nodeExecutionId,
          payload,
        );
        break;
      case 'cancel':
        // applyCancellation 은 sync (rejectPending 만 호출) — fire-and-forget.
        // TODO: async 전환 시 `void` 제거 후 `await` 복원 필요.
        void this.engine.applyCancellation(executionId);
        break;
      case 'button_click':
        await this.engine.applyContinuation(executionId, nodeExecutionId, {
          type: 'button_click',
          buttonId: (payload as { buttonId?: string } | undefined)?.buttonId,
        });
        break;
      case 'ai_message': {
        const message = (payload as { message?: string } | undefined)?.message;
        await this.engine.applyContinuation(executionId, nodeExecutionId, {
          type: 'ai_message',
          message,
        });
        break;
      }
      case 'ai_end_conversation':
        await this.engine.applyContinuation(executionId, nodeExecutionId, {
          type: 'ai_end_conversation',
        });
        break;
      default: {
        // exhaustiveness guard
        const _exhaust: never = type;
        this.logger.warn(`Unknown continuation type: ${String(_exhaust)}`);
      }
    }
  }

  /**
   * Phase 3.1 — retry 율 / dead-letter 가시성. job 1회 실패마다 시도 횟수를
   * 로깅한다. attemptsMade < attempts 면 backoff 후 재시도 예정(retry),
   * attemptsMade >= attempts 면 attempts 소진 = dead-letter (spec §7.5
   * `RESUME_FAILED`). DLQ depth 추세는 ContinuationDlqMonitorService 가 별도
   * 관측. cancel 류(nodeExecutionId sentinel)도 동일 경로로 집계된다.
   */
  @OnWorkerEvent('failed')
  onFailed(job: Job<ContinuationJob> | undefined, err: Error): void {
    if (!job) {
      this.logger.warn(
        `[continuation] job 실패 (job 핸들 없음): ${err?.message ?? err}`,
      );
      return;
    }
    const attemptsMade = job.attemptsMade ?? 0;
    // fallback 은 큐 기본값(RESUME_BULLMQ_ATTEMPTS=3)과 일치시켜 첫 실패가
    // DEAD-LETTER 로 오분류되지 않게 한다 (review W-3).
    const maxAttempts =
      job.opts?.attempts ?? CONTINUATION_QUEUE_DEFAULT_OPTS.attempts;
    const isDeadLetter = attemptsMade >= maxAttempts;
    const tag = isDeadLetter ? 'DEAD-LETTER' : 'RETRY';
    this.logger.warn(
      `[continuation ${tag}] type=${job.data?.type} execution=${job.data?.executionId} ` +
        `jobId=${job.id} attempt=${attemptsMade}/${maxAttempts}: ${err?.message ?? err}`,
    );
  }
}
