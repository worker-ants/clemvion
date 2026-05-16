import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { In, LessThan, LessThanOrEqual, Not, Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import {
  IntegrationExpiryDispatch,
  ExpiryThreshold,
} from './entities/integration-expiry-dispatch.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CAFE24_REFRESH_JOB,
  CAFE24_REFRESH_QUEUE,
  Cafe24RefreshJobData,
  REFRESH_PROACTIVE_THRESHOLD_DAYS,
} from './cafe24-token-refresh.constants';

export const INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner';

/** Usage-log retention window (spec §2.10.1). */
const USAGE_LOG_RETENTION_DAYS = 90;

/** Cafe24 Private install TTL — spec/2-navigation/4-integration.md §6 / ## Rationale. */
const PENDING_INSTALL_TTL_HOURS = 24;

/**
 * Each pass runs as its own BullMQ job so failures are independently
 * retried by BullMQ and visible in queue metrics. spec/data-flow/integration.md §1.4.
 */
export const JOB_CONNECTED_EXPIRY = 'connected-expiry';
export const JOB_PENDING_INSTALL_TTL = 'pending-install-ttl';
export const JOB_USAGE_LOG_PRUNE = 'usage-log-prune';
export const JOB_CAFE24_BACKGROUND_REFRESH = 'cafe24-background-refresh';

interface ExpiryJobData {
  triggeredAt: string;
}

/** Common retry / cleanup policy for the daily passes. All three handlers
 * are idempotent (status / created_at / retention age guards) so BullMQ
 * retries on transient failures are safe. */
const DAILY_PASS_OPTS = {
  attempts: 3,
  backoff: { type: 'exponential' as const, delay: 60_000 },
  removeOnComplete: { age: 7 * 24 * 60 * 60 },
  removeOnFail: { age: 30 * 24 * 60 * 60 },
};

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
@Processor(INTEGRATION_EXPIRY_QUEUE)
export class IntegrationExpiryScannerService
  extends WorkerHost
  implements OnModuleInit
{
  private readonly logger = new Logger(IntegrationExpiryScannerService.name);

  constructor(
    @InjectRepository(Integration)
    private readonly integrationRepository: Repository<Integration>,
    @InjectRepository(IntegrationExpiryDispatch)
    private readonly dispatchRepository: Repository<IntegrationExpiryDispatch>,
    @InjectRepository(IntegrationUsageLog)
    private readonly usageLogRepository: Repository<IntegrationUsageLog>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
    @InjectQueue(INTEGRATION_EXPIRY_QUEUE)
    private readonly queue: Queue<ExpiryJobData>,
    @InjectQueue(CAFE24_REFRESH_QUEUE)
    private readonly cafe24RefreshQueue: Queue<Cafe24RefreshJobData>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    // Drop the legacy single-job scheduler (idempotent — no-op on fresh
    // deploys). Pre-existing 'integration-expiry-daily' would otherwise
    // continue firing the un-routed 'scan' job name in parallel with the
    // new per-pass schedulers below.
    try {
      await this.queue.removeJobScheduler('integration-expiry-daily');
    } catch (err) {
      this.logger.warn(
        `failed to remove legacy scheduler 'integration-expiry-daily': ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const triggeredAt = new Date().toISOString();
    const repeat = { pattern: '0 0 * * *', tz: 'UTC' };
    await this.queue.upsertJobScheduler('connected-expiry-daily', repeat, {
      name: JOB_CONNECTED_EXPIRY,
      data: { triggeredAt },
      opts: DAILY_PASS_OPTS,
    });
    await this.queue.upsertJobScheduler('pending-install-ttl-daily', repeat, {
      name: JOB_PENDING_INSTALL_TTL,
      data: { triggeredAt },
      opts: DAILY_PASS_OPTS,
    });
    await this.queue.upsertJobScheduler('usage-log-prune-daily', repeat, {
      name: JOB_USAGE_LOG_PRUNE,
      data: { triggeredAt },
      opts: DAILY_PASS_OPTS,
    });
    await this.queue.upsertJobScheduler(
      'cafe24-background-refresh-daily',
      repeat,
      {
        name: JOB_CAFE24_BACKGROUND_REFRESH,
        data: { triggeredAt },
        opts: DAILY_PASS_OPTS,
      },
    );
    this.logger.log(
      'Registered integration expiry schedulers: connected-expiry, pending-install-ttl, usage-log-prune, cafe24-background-refresh (daily 00:00 UTC)',
    );
  }

  /**
   * Route by job name so each pass is its own BullMQ unit-of-work. Failures
   * propagate (no `.catch(log)` swallow) so BullMQ retries per
   * `DAILY_PASS_OPTS`. Unknown job names throw to make orphan schedulers
   * visible in alerts. spec/data-flow/integration.md §1.4.
   */
  async process(job: Job<ExpiryJobData>): Promise<void> {
    const ts = job.data?.triggeredAt;
    this.logger.log(`Running ${job.name} (${ts ?? 'no-ts'})`);
    switch (job.name) {
      case JOB_CONNECTED_EXPIRY:
        await this.run(new Date());
        return;
      case JOB_PENDING_INSTALL_TTL:
        await this.expirePendingInstalls(new Date());
        return;
      case JOB_USAGE_LOG_PRUNE:
        await this.pruneUsageLogs(new Date());
        return;
      case JOB_CAFE24_BACKGROUND_REFRESH:
        await this.enqueueCafe24BackgroundRefresh(new Date());
        return;
      default:
        throw new Error(
          `Unknown integration-expiry job: ${job.name} — check scheduler registrations in onModuleInit`,
        );
    }
  }

  /**
   * Cafe24 백그라운드 갱신 패스.
   *
   * **동기:** Cafe24 의 refresh_token 은 14일 유효이며, 매 refresh 마다
   * Cafe24 가 새 refresh_token 을 발급 (rotation) 한다. 활성 통합 (주 1회
   * 이상 사용) 은 매 사용 시점에 proactive refresh 가 일어나 사실상 영구
   * 유효하지만, 14일 이상 idle 인 통합은 refresh_token 까지 만료되어
   * 사용자 재인증이 필요해진다. 본 패스는 idle 통합을 자동으로 갱신해
   * 사실상 무한 활성 상태를 유지한다.
   *
   * **대상 선정:** `status='connected'` AND `service_type='cafe24'` AND
   * `lastRotatedAt < now - REFRESH_PROACTIVE_THRESHOLD_DAYS` (기본 10일).
   * 14일 마감 전 4일의 안전 마진 확보.
   *
   * **실행 방식:** 각 통합에 대해 `cafe24-token-refresh` 큐로 enqueue 만 하고
   * 본 잡 자체는 즉시 종료. 실제 refresh 는 `Cafe24TokenRefreshProcessor`
   * 가 처리하며, `jobId = integrationId` dedup 으로 같은 통합에 대한 동시
   * proactive call 과 race 가 없다.
   *
   * **오류 정책:** enqueue 실패 (Redis 장애 등) 는 본 잡 자체의 BullMQ
   * retry (`DAILY_PASS_OPTS` 의 exponential backoff) 에 맡긴다. 개별 통합의
   * refresh 실패는 worker 의 책임 (`markAuthFailed`).
   */
  async enqueueCafe24BackgroundRefresh(now: Date): Promise<number> {
    const cutoff = new Date(
      now.getTime() - REFRESH_PROACTIVE_THRESHOLD_DAYS * DAY_MS,
    );
    const targets = await this.integrationRepository.find({
      where: {
        serviceType: 'cafe24',
        status: 'connected',
        lastRotatedAt: LessThan(cutoff),
      },
      select: ['id', 'lastRotatedAt'],
    });

    if (targets.length === 0) {
      this.logger.log(
        `Cafe24 background refresh: no candidates (cutoff=${cutoff.toISOString()})`,
      );
      return 0;
    }

    let enqueued = 0;
    for (const target of targets) {
      try {
        await this.cafe24RefreshQueue.add(
          CAFE24_REFRESH_JOB,
          { integrationId: target.id, source: 'background' },
          {
            // jobId dedup — 동일 통합에 대해 proactive refresh 가 이미 큐에
            // 들어가 있으면 그 잡 참조가 반환되어 backend 가 별도 refresh 를
            // 트리거하지 않는다.
            jobId: target.id,
            attempts: 1,
            removeOnComplete: { age: 60 },
            removeOnFail: { age: 300 },
          },
        );
        enqueued++;
      } catch (err) {
        // 개별 enqueue 실패는 다음 일일 패스에서 재시도되므로 본 패스
        // 전체를 죽이지 않는다.
        this.logger.warn(
          `Cafe24 background refresh enqueue failed for ${target.id}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    this.logger.log(
      `Cafe24 background refresh: enqueued ${enqueued}/${targets.length} integrations (lastRotatedAt < ${cutoff.toISOString()})`,
    );
    return enqueued;
  }

  /**
   * Sweep `pending_install` rows whose install_token was issued more than
   * `PENDING_INSTALL_TTL_HOURS` (24h) ago and never reached `connected`.
   * Transitions them to `expired(install_timeout)` and clears install_token
   * so further App URL calls with that token cleanly 404. Manual delete
   * remains the only path that removes the row — we keep history for audit.
   *
   * spec/2-navigation/4-integration.md §6 (pending_install → expired) +
   * ## Rationale "install_token TTL 24h".
   */
  async expirePendingInstalls(now: Date): Promise<number> {
    const cutoff = new Date(
      now.getTime() - PENDING_INSTALL_TTL_HOURS * 60 * 60 * 1000,
    );
    // Single atomic bulk UPDATE — find→mutate→save would race against the
    // Cafe24 callback path: a callback that flips the row to `connected`
    // between our find and save would be silently overwritten back to
    // `expired`. The WHERE clause locks in the predicate at the moment of
    // the UPDATE, so only rows that are still pending_install AND past
    // the cutoff are touched. spec/data-flow/integration.md §1.4.
    //
    // TTL key is `install_token_issued_at` (V044) so a row reused via
    // begin re-submission gets a fresh 24h window instead of inheriting
    // the original `created_at`. Pre-V044 rows have NULL — fall back to
    // `created_at` via COALESCE so they still expire on the legacy
    // semantics during the transition.
    const result = await this.integrationRepository
      .createQueryBuilder()
      .update()
      .set({
        status: 'expired',
        statusReason: 'install_timeout',
        installToken: null,
      })
      .where('status = :status', { status: 'pending_install' })
      .andWhere('COALESCE(install_token_issued_at, created_at) < :cutoff', {
        cutoff,
      })
      .execute();
    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(
        `pending_install TTL sweep transitioned ${affected} row(s) to expired(install_timeout)`,
      );
    }
    return affected;
  }

  /**
   * Scan integrations nearing expiry and emit notifications. Returns the
   * number of notifications created.
   */
  async run(now: Date): Promise<number> {
    const horizon = new Date(now.getTime() + 7 * DAY_MS);

    const candidates = await this.integrationRepository.find({
      where: {
        status: Not(In(['expired', 'error'])),
        tokenExpiresAt: LessThanOrEqual(horizon),
      },
    });

    const notifications: Array<{
      workspaceId: string;
      userId: string;
      type: string;
      title: string;
      message: string;
      resourceType: string;
      resourceId: string;
      channel: 'in_app' | 'both';
    }> = [];
    const integrationsToUpdate: Integration[] = [];

    for (const integration of candidates) {
      if (!integration.tokenExpiresAt) continue;
      const remainMs = integration.tokenExpiresAt.getTime() - now.getTime();
      const threshold = classifyThreshold(remainMs);
      if (!threshold) continue;

      const claimed = await this.claimThreshold(
        integration.id,
        threshold,
        integration.tokenExpiresAt,
      );
      if (!claimed) continue;

      if (threshold === '0d' && integration.status !== 'expired') {
        integration.status = 'expired';
        integration.statusReason = null;
        integrationsToUpdate.push(integration);
      }

      const recipients = await this.resolveRecipients(integration);
      if (recipients.length === 0) continue;

      const users = await this.userRepository.find({
        where: { id: In(recipients) },
      });
      const prefsByUser = new Map(
        users.map((u) => [u.id, u.notificationPreferences ?? {}]),
      );

      for (const userId of recipients) {
        const prefs = prefsByUser.get(userId) ?? {};
        const wantsEmail = prefs.integrationExpiryEmail === true;
        notifications.push({
          workspaceId: integration.workspaceId,
          userId,
          type: 'integration_expired',
          title: titleFor(threshold),
          message: messageFor(threshold, integration),
          resourceType: 'integration',
          resourceId: integration.id,
          channel: wantsEmail ? 'both' : 'in_app',
        });
      }
    }

    if (integrationsToUpdate.length) {
      await this.integrationRepository.save(integrationsToUpdate);
    }
    await this.notificationsService.createMany(notifications);
    this.logger.log(
      `Integration expiry scan created ${notifications.length} notifications`,
    );
    return notifications.length;
  }

  /**
   * Delete integration_usage_log rows older than the retention window.
   * Returns the number of rows removed.
   */
  async pruneUsageLogs(now: Date): Promise<number> {
    const cutoff = new Date(now.getTime() - USAGE_LOG_RETENTION_DAYS * DAY_MS);
    const result = await this.usageLogRepository.delete({
      at: LessThan(cutoff),
    });
    const affected = result.affected ?? 0;
    if (affected > 0) {
      this.logger.log(
        `Pruned ${affected} integration_usage_log rows older than ${USAGE_LOG_RETENTION_DAYS}d`,
      );
    }
    return affected;
  }

  private async claimThreshold(
    integrationId: string,
    threshold: ExpiryThreshold,
    tokenExpiresAt: Date,
  ): Promise<boolean> {
    try {
      await this.dispatchRepository.insert({
        integrationId,
        threshold,
        tokenExpiresAt,
      });
      return true;
    } catch (err) {
      if ((err as { code?: string })?.code === '23505') return false;
      throw err;
    }
  }

  private async resolveRecipients(integration: Integration): Promise<string[]> {
    if (integration.scope === 'personal') {
      return [integration.createdBy];
    }
    return this.workspacesService.findAdminUserIds(integration.workspaceId);
  }
}

function classifyThreshold(remainMs: number): ExpiryThreshold | null {
  if (remainMs <= 0) return '0d';
  if (remainMs <= 3 * DAY_MS) return '3d';
  if (remainMs <= 7 * DAY_MS) return '7d';
  return null;
}

function titleFor(threshold: ExpiryThreshold): string {
  if (threshold === '0d') return 'Integration expired';
  if (threshold === '3d') return 'Integration expiring in 3 days';
  return 'Integration expiring soon';
}

function messageFor(
  threshold: ExpiryThreshold,
  integration: Integration,
): string {
  const name = `"${integration.name}"`;
  if (threshold === '0d') {
    return `${name} has expired. Reauthorize to continue using it.`;
  }
  const date = integration.tokenExpiresAt?.toISOString().slice(0, 10) ?? '';
  return `${name} will expire on ${date}.`;
}
