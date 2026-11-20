import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { InjectQueue, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { AuditLogsService } from '../audit-logs.service';
import { PRODUCT_DEFAULT_TIMEZONE } from '../../../common/utils/timezone';

export const AUDIT_LOG_PRUNER_QUEUE = 'audit-log-pruner';
export const AUDIT_LOG_PRUNE_JOB = 'prune-audit-log';
export const AUDIT_LOG_RETENTION_DEFAULT_DAYS = 365;
/** 보존 일수 상한. 이보다 크면 `now - days * DAY_MS` 가 Date 범위를 벗어나 매일 쿼리가 실패한다. */
export const AUDIT_LOG_RETENTION_MAX_DAYS = 1_000_000;
/** 매일 03:30 (`PRODUCT_DEFAULT_TIMEZONE` 기준). */
export const AUDIT_LOG_PRUNE_CRON = '30 3 * * *';
/** 완료한 반복 작업 기록을 남기는 기간(초). */
export const AUDIT_LOG_COMPLETED_JOB_TTL_SEC = 7 * 24 * 60 * 60;
/** 실패한 반복 작업 기록을 남기는 기간(초). */
export const AUDIT_LOG_FAILED_JOB_TTL_SEC = 30 * 24 * 60 * 60;

/**
 * `AUDIT_LOG_RETENTION_DAYS` 를 보존 일수로 바꾼다. 값이 없거나 비면 기본값이다.
 * 양의 정수(10진 숫자만, 상한 `AUDIT_LOG_RETENTION_MAX_DAYS`)가 아니면 기본값으로 돌아가고 `invalid` 로 알린다. 부팅은 막지 않는다
 * ([감사 로그 「감사 로그 보존 배치」](CLE-OBS-AUDIT#감사-로그-보존-배치)).
 */
export function resolveAuditLogRetentionDays(raw: string | undefined): {
  days: number;
  invalid: boolean;
} {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '') {
    return { days: AUDIT_LOG_RETENTION_DEFAULT_DAYS, invalid: false };
  }
  const parsed = /^\d+$/.test(trimmed) ? Number(trimmed) : NaN;
  if (
    Number.isSafeInteger(parsed) &&
    parsed > 0 &&
    parsed <= AUDIT_LOG_RETENTION_MAX_DAYS
  ) {
    return { days: parsed, invalid: false };
  }
  return { days: AUDIT_LOG_RETENTION_DEFAULT_DAYS, invalid: true };
}

/**
 * 매일 03:30(Asia/Seoul)에 보존 기간이 지난 `audit_log` 행을 지운다(REQ-AUDIT-019).
 * 스케줄러와 워커만 맡고 삭제는 `AuditLogsService.pruneOlderThanRetention` 이 한다.
 * 반복 작업은 Redis 에 하나만 등록되고 작업 하나를 워커 하나만 가져가므로 서버 인스턴스가
 * 여럿이어도 전역에서 한 번 돈다. 선례는 `LoginHistoryPrunerService` 다.
 */
@Injectable()
@Processor(AUDIT_LOG_PRUNER_QUEUE)
export class AuditLogPrunerService extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(AuditLogPrunerService.name);
  private readonly retentionDays: number;

  constructor(
    private readonly auditLogs: AuditLogsService,
    @InjectQueue(AUDIT_LOG_PRUNER_QUEUE)
    private readonly queue: Queue,
  ) {
    super();
    const raw = process.env.AUDIT_LOG_RETENTION_DAYS;
    const { days, invalid } = resolveAuditLogRetentionDays(raw);
    if (invalid) {
      this.logger.warn(
        `AUDIT_LOG_RETENTION_DAYS=${JSON.stringify(raw)} is not a positive integer; ` +
          `falling back to ${days} days`,
      );
    }
    this.retentionDays = days;
  }

  async onModuleInit(): Promise<void> {
    // upsertJobScheduler 는 같은 ID 로 여러 번 불러도 반복 작업이 하나만 남는다.
    // process 가 에러를 삼켜 작업은 늘 성공으로 끝나므로 removeOnFail 은 방어용이다.
    await this.queue.upsertJobScheduler(
      `${AUDIT_LOG_PRUNER_QUEUE}-daily`,
      { pattern: AUDIT_LOG_PRUNE_CRON, tz: PRODUCT_DEFAULT_TIMEZONE },
      {
        name: AUDIT_LOG_PRUNE_JOB,
        opts: {
          removeOnComplete: { age: AUDIT_LOG_COMPLETED_JOB_TTL_SEC },
          removeOnFail: { age: AUDIT_LOG_FAILED_JOB_TTL_SEC },
        },
      },
    );
  }

  async process(_job: Job): Promise<void> {
    await this.prune();
  }

  async prune(): Promise<void> {
    try {
      const removed = await this.auditLogs.pruneOlderThanRetention(
        this.retentionDays,
      );
      if (removed > 0) {
        this.logger.log(
          `audit_log pruned ${removed} row(s) older than ${this.retentionDays} days`,
        );
      }
    } catch (err) {
      this.logger.error(
        `audit_log prune failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
