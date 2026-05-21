import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { randomUUID } from 'crypto';
import type { Queue } from 'bullmq';
import {
  NOTIFICATION_WEBHOOK_QUEUE,
  NotificationWebhookJob,
} from './notification-dispatcher.types';

/**
 * [Spec EIA §6 / §R10] — Outbound notification 의 단순 enqueue facade.
 *
 * 단일 책임: BullMQ 큐에 job 을 적재. 실제 HTTP POST / 서명 / 재시도 / health 갱신은 별도
 * processor (`NotificationWebhookProcessor`) 가 담당해 ExecutionEngine 외부의 facade 레이어로
 * 격리한다 (R10 — WebsocketService 단일 sink 정책 유지).
 *
 * 호출 시점 [Spec EIA §9.3 / EIA-RL-04]: 트랜잭션 commit 후 호출되어야 한다. 호출자(P6)가
 * after-commit hook 위치를 보장한다. 본 service 는 enqueue 자체만 책임.
 */
@Injectable()
export class NotificationDispatcher {
  private readonly logger = new Logger(NotificationDispatcher.name);

  constructor(
    @Optional()
    @InjectQueue(NOTIFICATION_WEBHOOK_QUEUE)
    private readonly queue?: Queue<NotificationWebhookJob>,
  ) {}

  /**
   * 새 delivery 를 큐에 적재. `deliveryId` 가 명시되지 않으면 UUID v4 자동 생성.
   * BullMQ jobId = deliveryId 로 자동 dedup — 같은 deliveryId 로 재 enqueue 해도 1건만 실행.
   *
   * 재시도 정책 ([Spec EIA §6.6]): default 5 회, exponential backoff (1s / 4s / 16s / 64s / 256s).
   * 호출자가 trigger 의 retry config 를 미리 읽고 attempts 를 override 할 수 있다.
   *
   * Redis / BullMQ 가 미가용 (queue 없음) 시 fail-open 으로 로그만 남기고 skip. notification 은
   * 트리거의 부수 기능이므로 enqueue 실패가 워크플로우 실행 자체에 영향 주지 않도록 격리.
   */
  async enqueue(
    job: Omit<NotificationWebhookJob, 'deliveryId'> & { deliveryId?: string },
    opts: { attempts?: number } = {},
  ): Promise<{ deliveryId: string } | { skipped: true; reason: string }> {
    const deliveryId = job.deliveryId ?? randomUUID();
    if (!this.queue) {
      this.logger.warn(
        `NotificationDispatcher: queue 미가용 — deliveryId=${deliveryId} skip. ` +
          'BullMQ Redis 가 등록되지 않은 환경에서는 outbound notification 이 전혀 발송되지 않는다.',
      );
      return { skipped: true, reason: 'queue_unavailable' };
    }
    const payload: NotificationWebhookJob = {
      ...job,
      deliveryId,
    };
    await this.queue.add(`notify:${job.eventType}`, payload, {
      jobId: deliveryId, // dedup
      attempts: opts.attempts ?? 5,
      backoff: { type: 'exponential', delay: 1000 }, // 1s, 2s, 4s, 8s, 16s — BullMQ exponential 의 default base*2^n
      removeOnComplete: { age: 24 * 60 * 60, count: 1000 }, // 24h
      removeOnFail: { age: 7 * 24 * 60 * 60 }, // 7d (debug 용)
    });
    return { deliveryId };
  }
}
