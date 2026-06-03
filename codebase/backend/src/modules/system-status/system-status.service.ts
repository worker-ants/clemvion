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

/**
 * getFailed 역순 스캔의 페이지 크기 (큐당 Redis round-trip 단위).
 * 100 은 RTT 횟수와 페이지당 전송량의 절충값 — env 로 노출하지 않는다(운영 튜닝 대상이
 * 아니며, 실효 비용 상한은 SYSTEM_STATUS_FAILED_SCAN_CAP 로 조정).
 */
const FAILED_SCAN_PAGE = 100;

/** computeRecentFailed 결과 — 최근 윈도우 실패 수 + 캡 소진으로 하한값인지. */
interface RecentFailedResult {
  recent: number;
  capped: boolean;
}

/** failed===0(스캔 생략) · Redis 오류 fallback 공통 기본값. */
const ZERO_RECENT: RecentFailedResult = { recent: 0, capped: false };

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
    // 단일 now 로 cutoff 와 generatedAt 을 일관되게 파생한다.
    const now = Date.now();
    const failedWindowMinutes = getFailedWindowMinutes();
    const cutoffMs = now - failedWindowMinutes * 60_000;
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
    // 보수적 OR — 하나라도 capped 면 시스템 전역 합산도 하한값일 수 있다 (spec R-5).
    const recentFailedCapped = queues.some((q) => q.recentFailedCapped);

    return {
      generatedAt: new Date(now).toISOString(),
      overall,
      totalFailed,
      totalRecentFailed,
      recentFailedCapped,
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

      // recentFailed 는 보관 집합(failed)의 부분집합이므로 failed===0 이면 0 이다.
      // 정상 상태(대다수 큐)에서 getFailed() 스캔을 건너뛰어 Redis 비용을 제거한다.
      const { recent: recentFailed, capped: recentFailedCapped } =
        counts.failed > 0
          ? await this.computeRecentFailed(handle.queue, cutoffMs, scanCap)
          : ZERO_RECENT;

      return {
        name: meta.name,
        group: meta.group,
        counts,
        recentFailed,
        recentFailedCapped,
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
        recentFailedCapped: false,
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
   * 큐당 `scanCap` job 까지만 스캔하며, 캡 **소진**으로 종료되면(윈도우 경계·집합 끝이 아님)
   * `capped: true` 로 반환값이 **하한값**임을 알린다.
   * `finishedOn` 이 없는(이론상) job 은 enqueue `timestamp` 로 대체하고, 둘 다 없으면
   * 판정 불가로 보아 집계에서 제외한다(카운트하지 않음).
   */
  private async computeRecentFailed(
    queue: QueueHandle['queue'],
    cutoffMs: number,
    scanCap: number,
  ): Promise<RecentFailedResult> {
    let recent = 0;
    let scanned = 0;
    let offset = 0;
    let crossedWindow = false;
    let endOfSet = false;

    while (scanned < scanCap) {
      const limit = Math.min(FAILED_SCAN_PAGE, scanCap - scanned);
      const jobs = await queue.getFailed(offset, offset + limit - 1);
      if (jobs.length === 0) {
        endOfSet = true;
        break;
      }

      for (const job of jobs) {
        scanned++;
        const ts = job.finishedOn ?? job.timestamp;
        if (ts == null) continue; // 판정 불가 — 건너뜀(카운트 안 함)
        if (ts >= cutoffMs) {
          recent++;
        } else {
          // newest→oldest 라 윈도우를 벗어난 job 을 만나면 이후는 전부 더 오래됨.
          // 이 job 도 scanned 에 포함된 채(위 scanned++) 스캔을 종료한다.
          crossedWindow = true;
          break;
        }
      }

      if (crossedWindow) break;
      if (jobs.length < limit) {
        endOfSet = true; // 실패 집합 끝
        break;
      }
      offset += jobs.length;
    }

    // 윈도우 경계·집합 끝이 아니라 캡 소진(while 조건)으로 종료됐으면 하한값이다.
    const capped = !crossedWindow && !endOfSet;
    return { recent, capped };
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
