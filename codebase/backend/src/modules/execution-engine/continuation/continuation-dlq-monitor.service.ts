import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { CONTINUATION_EXECUTION_QUEUE } from '../queues/continuation-execution.queue';
import {
  CONTINUATION_DLQ_MONITOR_CONFIG,
  type ContinuationDlqMonitorConfig,
} from './continuation-dlq-monitor.config';
import { BusinessMetricsService } from '../../metrics/business-metrics.service';

/**
 * Phase 3.1 (workflow-resumable-execution) — Continuation 큐 dead-letter 모니터.
 *
 * SoT: spec/5-system/4-execution-engine.md §7.4 / §7.5 / §9.3.
 *
 * `execution-continuation` 큐는 `removeOnFail: false` 로 운영되므로 attempts
 * (`RESUME_BULLMQ_ATTEMPTS`, 기본 3) 소진 job 이 `failed` 상태(dead-letter)로
 * 누적된다. rehydration 이 구조적으로 실패하는 회귀(배포 후 _resumeState schema
 * drift, 체크포인트 손상 등)는 DLQ depth 급증으로 나타난다. 본 서비스는 그
 * depth 를 주기적으로 관측하고 임계 초과 시 structured `logger.error` 알람을
 * 1회/cooldown 으로 발생시켜 로그 기반 알람 파이프라인이 픽업하게 한다.
 *
 * 추가로 `delayed`(backoff 대기 = 재시도 backlog) count 를 함께 관측해 retry 율
 * 추세를 같은 로그 라인에서 확인할 수 있게 한다.
 *
 * **임계 초과 알람(능동 통지)은 log 기반을 유지**하되, 큐 깊이 자체는 NF-OB-07
 * `clemvion.queue.depth` ObservableGauge 로도 노출한다 — 본 서비스가 continuation
 * 큐의 depth provider 를 `BusinessMetricsService` 에 등록한다 (gauge=관측, log=cooldown
 * 통지로 역할 분리. 근거: spec/5-system/4-execution-engine.md §Rationale "DLQ 모니터링").
 *
 * 설정은 `CONTINUATION_DLQ_MONITOR_CONFIG` 로 주입된다 (review W-9 — env 직접
 * 읽기 대신 useFactory 주입). 환경변수·기본값은 `continuation-dlq-monitor.config.ts`.
 */
@Injectable()
export class ContinuationDlqMonitorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ContinuationDlqMonitorService.name);
  private timer: NodeJS.Timeout | null = null;
  // -Infinity 으로 초기화해 임계 초과 시 첫 알람은 cooldown 과 무관하게 즉시 발생.
  private lastAlarmAt = Number.NEGATIVE_INFINITY;
  // review W-10 — tick 이 겹쳐도 단일 checkOnce 만 진행하도록 in-flight 가드.
  private checking = false;

  constructor(
    @InjectQueue(CONTINUATION_EXECUTION_QUEUE) private readonly queue: Queue,
    @Inject(CONTINUATION_DLQ_MONITOR_CONFIG)
    private readonly config: ContinuationDlqMonitorConfig,
    private readonly businessMetrics: BusinessMetricsService,
  ) {}

  onModuleInit(): void {
    // NF-OB-07 `clemvion.queue.depth` — continuation 큐 깊이를 gauge 에 등록한다.
    // 알람(아래)이 비활성이어도 깊이 관측은 유효하므로 enabled 체크 이전에 등록한다.
    this.businessMetrics.registerQueueDepthProvider(async () => {
      const c = await this.queue.getJobCounts(
        'waiting',
        'active',
        'delayed',
        'failed',
      );
      return [
        {
          queue: CONTINUATION_EXECUTION_QUEUE,
          waiting: c.waiting ?? 0,
          active: c.active ?? 0,
          delayed: c.delayed ?? 0,
          failed: c.failed ?? 0,
        },
      ];
    });

    if (!this.config.enabled) {
      this.logger.log(
        'Continuation DLQ monitor disabled (CONTINUATION_DLQ_MONITOR_ENABLED).',
      );
      return;
    }
    this.logger.log(
      `Continuation DLQ monitor 시작 — interval=${this.config.intervalMs}ms threshold=${this.config.thresholdJobs} cooldown=${this.config.cooldownMs}ms`,
    );
    this.timer = setInterval(() => {
      void this.checkOnce();
    }, this.config.intervalMs);
    // 이 타이머가 graceful shutdown / 프로세스 종료를 막지 않도록 unref.
    this.timer.unref?.();
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * 큐 depth 1회 점검. failed >= threshold 이고 cooldown 경과 시 알람 로그 발생.
   * 테스트 진입점 — interval 없이 직접 호출 가능. 조회 실패는 삼켜서(warn) 다음
   * tick 에 재시도하며, 모니터 자체가 워커 처리를 막지 않게 한다.
   *
   * review W-10 — 이전 호출이 진행 중이면(checking) 이번 tick 은 skip 해
   * `lastAlarmAt` 경쟁 및 중복 알람을 방지한다.
   */
  async checkOnce(now: number = Date.now()): Promise<{
    failed: number;
    delayed: number;
    alarmed: boolean;
    skipped?: boolean;
  }> {
    if (this.checking) {
      return { failed: 0, delayed: 0, alarmed: false, skipped: true };
    }
    this.checking = true;
    try {
      let failed = 0;
      let delayed = 0;
      try {
        const counts = await this.queue.getJobCounts('failed', 'delayed');
        failed = counts.failed ?? 0;
        delayed = counts.delayed ?? 0;
      } catch (err) {
        this.logger.warn(
          `Continuation DLQ 조회 실패 — 다음 tick 재시도: ${
            err instanceof Error ? err.message : String(err)
          }`,
        );
        return { failed: 0, delayed: 0, alarmed: false };
      }

      let alarmed = false;
      if (failed >= this.config.thresholdJobs) {
        if (now - this.lastAlarmAt >= this.config.cooldownMs) {
          this.lastAlarmAt = now;
          alarmed = true;
          this.logger.error(
            `[DLQ ALARM] execution-continuation dead-letter depth=${failed} ` +
              `≥ threshold=${this.config.thresholdJobs} (retry backlog delayed=${delayed}). ` +
              `rehydration 실패 누적 — spec §7.5 RESUME_* 확인 필요.`,
          );
        }
      } else if (delayed > 0 || failed > 0) {
        this.logger.debug(
          `Continuation DLQ 상태 — failed=${failed} delayed(retrying)=${delayed} (threshold=${this.config.thresholdJobs}).`,
        );
      }
      return { failed, delayed, alarmed };
    } finally {
      this.checking = false;
    }
  }
}
