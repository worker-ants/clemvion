import { InjectQueue } from '@nestjs/bullmq';
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from '@nestjs/common';
import type { Queue } from 'bullmq';
import { EXECUTION_RUN_QUEUE } from './execution-run.queue';
import {
  EXECUTION_RUN_DLQ_MONITOR_CONFIG,
  type ExecutionRunDlqMonitorConfig,
} from './execution-run-dlq-monitor.config';

/**
 * PR4 — execution-run 큐 dead-letter 모니터 (관측성).
 *
 * SoT: spec/5-system/4-execution-engine.md §7.1 / §9.3.
 *
 * PR4 에서 `execution-run` 큐가 `maxStalledCount:1` + `removeOnFail:false` 로
 * 운영되므로, 워커 크래시 세그먼트가 stalled 재배달을 소진하면 `failed`(dead-letter)
 * 로 누적된다(→ `WORKER_HEARTBEAT_TIMEOUT`). 지속적 crash-loop(poison workflow·배포
 * 회귀)는 DLQ depth 급증으로 나타난다. 본 서비스는 그 depth 를 주기 관측하고 임계
 * 초과 시 structured `logger.error` 알람을 1회/cooldown 으로 발생시킨다.
 *
 * (큐 depth 자체는 `ExecutionEngineService.onModuleInit` 이 이미 `clemvion.queue.depth`
 * gauge 로 노출 — 본 서비스는 gauge 와 역할 분리된 **cooldown 능동 통지**만 담당한다.
 * `ContinuationDlqMonitorService`(continuation 큐) 와 동일 패턴.)
 */
@Injectable()
export class ExecutionRunDlqMonitorService
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(ExecutionRunDlqMonitorService.name);
  private timer: NodeJS.Timeout | null = null;
  private lastAlarmAt = Number.NEGATIVE_INFINITY;
  private checking = false;

  constructor(
    @InjectQueue(EXECUTION_RUN_QUEUE) private readonly queue: Queue,
    @Inject(EXECUTION_RUN_DLQ_MONITOR_CONFIG)
    private readonly config: ExecutionRunDlqMonitorConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.enabled) {
      this.logger.log(
        'execution-run DLQ monitor disabled (EXECUTION_RUN_DLQ_MONITOR_ENABLED).',
      );
      return;
    }
    this.logger.log(
      `execution-run DLQ monitor 시작 — interval=${this.config.intervalMs}ms threshold=${this.config.thresholdJobs} cooldown=${this.config.cooldownMs}ms`,
    );
    this.timer = setInterval(() => {
      void this.checkOnce();
    }, this.config.intervalMs);
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
   * 테스트 진입점 — interval 없이 직접 호출 가능. in-flight 가드로 tick 겹침 방지.
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
          `execution-run DLQ 조회 실패 — 다음 tick 재시도: ${
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
            `[DLQ ALARM] execution-run dead-letter depth=${failed} ` +
              `≥ threshold=${this.config.thresholdJobs} (delayed=${delayed}). ` +
              `워커 크래시/stalled 재배달 소진 누적 — spec §7.1 WORKER_HEARTBEAT_TIMEOUT 확인 필요.`,
          );
        }
      } else if (delayed > 0 || failed > 0) {
        this.logger.debug(
          `execution-run DLQ 상태 — failed=${failed} delayed=${delayed} (threshold=${this.config.thresholdJobs}).`,
        );
      }
      return { failed, delayed, alarmed };
    } finally {
      this.checking = false;
    }
  }
}
