import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  MONITORED_QUEUE_HANDLES,
  MonitoredQueue,
  getFailedDegradedThreshold,
  getDelayedDegradedThreshold,
} from './system-status.constants';
import {
  SystemStatusOverviewDto,
  QueueStatusDto,
  QueueCountsDto,
  QueueHealth,
} from './dto/system-status-response.dto';

/** 모니터링 대상 큐 1건 — 메타 + BullMQ Queue 인스턴스(읽기 메서드만 사용). */
export interface QueueHandle {
  meta: MonitoredQueue;
  queue: Pick<Queue, 'getJobCounts' | 'isPaused'>;
}

const HEALTH_RANK: Record<QueueHealth, number> = {
  healthy: 0,
  degraded: 1,
  down: 2,
};

const ZERO_COUNTS: QueueCountsDto = {
  waiting: 0,
  active: 0,
  delayed: 0,
  failed: 0,
  paused: 0,
};

/**
 * 전체 시스템(BullMQ 큐)의 집계 상태를 반환한다.
 * 개별 job·payload 는 노출하지 않는다 (spec/5-system/16-system-status-api.md §4).
 */
@Injectable()
export class SystemStatusService {
  private readonly logger = new Logger(SystemStatusService.name);

  constructor(
    @Inject(MONITORED_QUEUE_HANDLES)
    private readonly handles: readonly QueueHandle[],
  ) {}

  async getOverview(): Promise<SystemStatusOverviewDto> {
    const queues = await Promise.all(this.handles.map((h) => this.inspect(h)));

    const overall = queues.reduce<QueueHealth>(
      (worst, q) =>
        HEALTH_RANK[q.health] > HEALTH_RANK[worst] ? q.health : worst,
      'healthy',
    );
    const totalFailed = queues.reduce((sum, q) => sum + q.counts.failed, 0);

    return {
      generatedAt: new Date().toISOString(),
      overall,
      totalFailed,
      queues,
    };
  }

  /**
   * 단일 큐 검사. Redis 조회 실패 시 해당 큐만 down + 0 카운트로 degrade 하고
   * 전체 응답은 유지한다 (spec §2).
   */
  private async inspect(handle: QueueHandle): Promise<QueueStatusDto> {
    const { meta } = handle;
    try {
      const [raw, isPaused] = await Promise.all([
        handle.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'paused',
        ),
        handle.queue.isPaused(),
      ]);
      const counts: QueueCountsDto = {
        waiting: raw.waiting ?? 0,
        active: raw.active ?? 0,
        delayed: raw.delayed ?? 0,
        failed: raw.failed ?? 0,
        paused: raw.paused ?? 0,
      };

      return {
        name: meta.name,
        group: meta.group,
        counts,
        concurrency: meta.concurrency,
        utilization: this.computeUtilization(counts.active, meta.concurrency),
        isPaused,
        health: this.deriveHealth(counts, isPaused),
      };
    } catch (err) {
      this.logger.error(
        `inspect() failed for queue '${meta.name}': ${err instanceof Error ? err.message : String(err)}`,
        err instanceof Error ? err.stack : undefined,
      );
      return {
        name: meta.name,
        group: meta.group,
        counts: { ...ZERO_COUNTS },
        concurrency: meta.concurrency,
        utilization: 0,
        isPaused: false,
        health: 'down',
      };
    }
  }

  private computeUtilization(active: number, concurrency: number): number {
    if (concurrency <= 0) return 0;
    // Math.min(…, 1): active 가 concurrency 를 초과하는 과도 상태에서도 1.0 상한을 보장한다 (I-9).
    return Math.min(Math.round((active / concurrency) * 100) / 100, 1);
  }

  /**
   * health 파생 (spec §3, 휴리스틱):
   * 1. paused → down
   * 2. waiting>0 && active=0 → down (워커 미가동 추정)
   * 3. failed/delayed 임계 초과 → degraded
   * 4. 그 외 → healthy
   */
  private deriveHealth(counts: QueueCountsDto, isPaused: boolean): QueueHealth {
    if (isPaused) return 'down';
    if (counts.waiting > 0 && counts.active === 0) return 'down';
    if (
      counts.failed >= getFailedDegradedThreshold() ||
      counts.delayed >= getDelayedDegradedThreshold()
    ) {
      return 'degraded';
    }
    return 'healthy';
  }
}
