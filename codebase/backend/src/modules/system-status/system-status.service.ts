import { Inject, Injectable, Logger } from '@nestjs/common';
import type { Queue } from 'bullmq';
import {
  MONITORED_QUEUE_HANDLES,
  MonitoredQueue,
  getFailedDegradedThreshold,
  getDelayedDegradedThreshold,
  getFailedWindowMinutes,
  getFailedScanCap,
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
  queue: Pick<Queue, 'getJobCounts' | 'isPaused' | 'getFailed'>;
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

/** getFailed 역순 스캔의 페이지 크기 (큐당 Redis round-trip 단위). */
const FAILED_SCAN_PAGE = 100;

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
    const failedWindowMinutes = getFailedWindowMinutes();
    const cutoffMs = Date.now() - failedWindowMinutes * 60_000;
    const scanCap = getFailedScanCap();

    const queues = await Promise.all(
      this.handles.map((h) => this.inspect(h, cutoffMs, scanCap)),
    );

    const overall = queues.reduce<QueueHealth>(
      (worst, q) =>
        HEALTH_RANK[q.health] > HEALTH_RANK[worst] ? q.health : worst,
      'healthy',
    );
    const totalFailed = queues.reduce((sum, q) => sum + q.counts.failed, 0);
    const totalRecentFailed = queues.reduce(
      (sum, q) => sum + q.recentFailed,
      0,
    );

    return {
      generatedAt: new Date().toISOString(),
      overall,
      totalFailed,
      totalRecentFailed,
      failedWindowMinutes,
      queues,
    };
  }

  /**
   * 단일 큐 검사. Redis 조회 실패 시 해당 큐만 down + 0 카운트로 degrade 하고
   * 전체 응답은 유지한다 (spec §2).
   */
  private async inspect(
    handle: QueueHandle,
    cutoffMs: number,
    scanCap: number,
  ): Promise<QueueStatusDto> {
    const { meta } = handle;
    try {
      const [raw, isPaused, recentFailed] = await Promise.all([
        handle.queue.getJobCounts(
          'waiting',
          'active',
          'delayed',
          'failed',
          'paused',
        ),
        handle.queue.isPaused(),
        this.computeRecentFailed(handle.queue, cutoffMs, scanCap),
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
        recentFailed,
        concurrency: meta.concurrency,
        utilization: this.computeUtilization(counts.active, meta.concurrency),
        isPaused,
        health: this.deriveHealth(counts, recentFailed, isPaused),
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
        recentFailed: 0,
        concurrency: meta.concurrency,
        utilization: 0,
        isPaused: false,
        health: 'down',
      };
    }
  }

  /**
   * 최근 윈도우(`cutoffMs` 이후) 내 실패 job 수를 센다 (spec §2).
   *
   * BullMQ `getFailed()` 는 newest→oldest 로 반환한다. 페이지 단위로 역순 스캔하다
   * `finishedOn` 이 윈도우를 벗어나는 첫 job 에서 중단한다(이후는 모두 더 오래됨).
   * 큐당 `scanCap` job 까지만 스캔하며, 캡에 도달하면 반환값은 **하한값**이다.
   * `finishedOn` 이 없는(이론상) job 은 enqueue `timestamp` 로 대체한다.
   */
  private async computeRecentFailed(
    queue: QueueHandle['queue'],
    cutoffMs: number,
    scanCap: number,
  ): Promise<number> {
    let recent = 0;
    let scanned = 0;
    let offset = 0;

    while (scanned < scanCap) {
      const limit = Math.min(FAILED_SCAN_PAGE, scanCap - scanned);
      const jobs = await queue.getFailed(offset, offset + limit - 1);
      if (jobs.length === 0) break;

      let crossedWindow = false;
      for (const job of jobs) {
        scanned++;
        const ts = job.finishedOn ?? job.timestamp;
        if (ts == null) continue; // 판정 불가 — 건너뜀(카운트 안 함)
        if (ts >= cutoffMs) {
          recent++;
        } else {
          crossedWindow = true; // newest→oldest 라 이후는 전부 더 오래됨
          break;
        }
      }

      if (crossedWindow) break;
      if (jobs.length < limit) break; // 실패 집합 끝
      offset += jobs.length;
    }

    return recent;
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
   * 3. recentFailed/delayed 임계 초과 → degraded
   * 4. 그 외 → healthy
   *
   * 규칙 3 의 실패 기준은 보관 중 누적(`counts.failed`)이 아니라 **최근 윈도우
   * `recentFailed`** 다 — degraded 가 "지금" 문제인지를 반영하도록 (spec R-5).
   */
  private deriveHealth(
    counts: QueueCountsDto,
    recentFailed: number,
    isPaused: boolean,
  ): QueueHealth {
    if (isPaused) return 'down';
    if (counts.waiting > 0 && counts.active === 0) return 'down';
    if (
      recentFailed >= getFailedDegradedThreshold() ||
      counts.delayed >= getDelayedDegradedThreshold()
    ) {
      return 'degraded';
    }
    return 'healthy';
  }
}
