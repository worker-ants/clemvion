import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Processor, WorkerHost, InjectQueue } from '@nestjs/bullmq';
import { Job, Queue } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import {
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  Not,
  Or,
  Repository,
} from 'typeorm';
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
    // Daily 00:00 UTC — connected-expiry 알림, pending_install TTL sweep,
    // usage_log retention prune. 모두 일일 주기로 충분 (알림 빈도·24h TTL·90d
    // retention 의 정량적 특성이 일일 cadence 와 일치).
    const dailyRepeat = { pattern: '0 0 * * *', tz: 'UTC' };
    await this.queue.upsertJobScheduler('connected-expiry-daily', dailyRepeat, {
      name: JOB_CONNECTED_EXPIRY,
      data: { triggeredAt },
      opts: DAILY_PASS_OPTS,
    });
    await this.queue.upsertJobScheduler(
      'pending-install-ttl-daily',
      dailyRepeat,
      {
        name: JOB_PENDING_INSTALL_TTL,
        data: { triggeredAt },
        opts: DAILY_PASS_OPTS,
      },
    );
    await this.queue.upsertJobScheduler('usage-log-prune-daily', dailyRepeat, {
      name: JOB_USAGE_LOG_PRUNE,
      data: { triggeredAt },
      opts: DAILY_PASS_OPTS,
    });
    // cafe24-background-refresh — 2026-05-19 갱신: 6h 주기로 단축 +
    // REFRESH_PROACTIVE_THRESHOLD_DAYS 7일 (cafe24-token-refresh.constants.ts)
    // 와 짝을 이룬다. 옛 정책 (24h cron + 10일 cutoff = 4일 마진) 은 cron
    // 한 번이 누락되면 마진이 3일로 압박돼 14일 refresh_token 만기를 충분히
    // 사전 차단하지 못했다. 6h cron + 7일 cutoff = 마진 7일 (= 만기의 50%) 로
    // cron 누락 1회 (6h) 가 마진에 거의 영향을 주지 않는다.
    //
    // scheduler ID `cafe24-background-refresh-daily` 는 BullMQ idempotent
    // upsert 활용을 위해 의도적으로 보존 (ID 변경 시 옛 Redis entry 가 orphan
    // 으로 잔존해 daily/6h 가 동시 fire 되는 회귀 위험). 이름은 historical.
    const cafe24Repeat = { pattern: '0 */6 * * *', tz: 'UTC' };
    await this.queue.upsertJobScheduler(
      'cafe24-background-refresh-daily',
      cafe24Repeat,
      {
        name: JOB_CAFE24_BACKGROUND_REFRESH,
        data: { triggeredAt },
        opts: DAILY_PASS_OPTS,
      },
    );
    this.logger.log(
      'Registered integration expiry schedulers: connected-expiry (daily 00:00 UTC), pending-install-ttl (daily 00:00 UTC), usage-log-prune (daily 00:00 UTC), cafe24-background-refresh (every 6h UTC)',
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
    // `lastRotatedAt IS NULL` 통합도 대상에 포함한다. 신규 create() 경로는
    // 이제 `lastRotatedAt = new Date()` 로 명시 초기화하지만 (`integrations.
    // service.ts`), V045 이전 legacy row 와 다른 진입 경로(향후 추가될 수
    // 있는 manual ETL 등) 에 대비한 belt-and-suspenders. PostgreSQL 의
    // `NULL < cutoff = FALSE` 시맨틱 때문에 IS NULL 분기를 OR 로 명시.
    const targets = await this.integrationRepository.find({
      where: {
        serviceType: 'cafe24',
        status: 'connected',
        lastRotatedAt: Or(LessThan(cutoff), IsNull()),
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
        // spec/2-navigation/4-integration.md §11.1 + §2.4 가 `pending_install`
        // 을 만료 알림 대상에서 제외하도록 명시. 정상 흐름에서는
        // pending_install 의 `tokenExpiresAt` 가 NULL 이라 LessThanOrEqual 조건
        // 에 매칭되지 않지만, 엣지 케이스 (재사용 분기에서 tokenExpiresAt 가
        // 의도치 않게 보존되는 경우 등) 를 차단하기 위해 status 필터에 명시
        // 추가 (REQ-C1).
        status: Not(In(['expired', 'error', 'pending_install'])),
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

    // B-4-2: 옛 패턴은 candidates 루프 안에서 매 integration 마다
    // userRepository.find 를 호출 → N+1. 모든 candidates 의 recipient 를
    // 먼저 모은 뒤 단 한 번의 user.find(In(...)) 로 일괄 로딩한다.
    const recipientsByIntegration = new Map<string, string[]>();
    const allRecipientIds = new Set<string>();
    for (const integration of candidates) {
      const recipients = await this.resolveRecipients(integration);
      recipientsByIntegration.set(integration.id, recipients);
      for (const r of recipients) allRecipientIds.add(r);
    }
    const allUsers = allRecipientIds.size
      ? await this.userRepository.find({
          where: { id: In([...allRecipientIds]) },
        })
      : [];
    const prefsByUser = new Map(
      allUsers.map((u) => [u.id, u.notificationPreferences ?? {}]),
    );

    for (const integration of candidates) {
      if (!integration.tokenExpiresAt) continue;
      const remainMs = integration.tokenExpiresAt.getTime() - now.getTime();
      const threshold = classifyThreshold(remainMs);
      if (!threshold) continue;

      // spec/2-navigation/4-integration.md §11.2 / data-flow/5-integration.md §1.4:
      // refresh-capable provider (cafe24·makeshop + refresh_token) 는 `expired`
      // 격하·passive `integration_expired` 알림 대상에서 제외된다 — access_token
      // 만료는 자동 갱신으로 흡수되므로 '재인증하세요' passive notice 는 노이즈다.
      // refresh 실패 시 worker / in-call 경로가 error(auth_failed) 전이 + active 알림.
      if (isRefreshCapable(integration)) {
        if (threshold === '0d' && integration.serviceType === 'cafe24') {
          // cafe24 만 safety-net 으로 background refresh 큐 enqueue. makeshop 은
          // 배경 큐 없이 in-call proactive / reactive_401 자가 회복에 위임.
          try {
            await this.cafe24RefreshQueue.add(
              CAFE24_REFRESH_JOB,
              { integrationId: integration.id, source: 'background' },
              {
                // jobId dedup — proactive refresh / cafe24-background-refresh 와
                // 같은 통합에 대한 동시 enqueue 가 단일 worker 실행으로 모임.
                jobId: integration.id,
                attempts: 1,
                removeOnComplete: { age: 60 },
                removeOnFail: { age: 300 },
              },
            );
          } catch (err) {
            // enqueue 실패는 다음 일일 패스에서 재시도되므로 본 패스 전체를
            // 죽이지 않는다 (jobId dedup 이라 재발행 안전).
            this.logger.warn(
              `connected-expiry 0d cafe24 refresh enqueue failed for ${integration.id}: ${
                err instanceof Error ? err.message : String(err)
              }`,
            );
          }
        }
        // 격하·passive 알림 없음 — 다음 candidate 로.
        continue;
      }

      // refresh_token 없는 provider: 임계별 claim (dedup) → 격하(0d) → passive 알림.
      const claimed = await this.claimThreshold(
        integration.id,
        threshold,
        integration.tokenExpiresAt,
      );
      if (!claimed) continue;

      if (threshold === '0d' && integration.status !== 'expired') {
        integration.status = 'expired';
        integration.statusReason = 'token_expired';
        integrationsToUpdate.push(integration);
      }

      const recipients = recipientsByIntegration.get(integration.id) ?? [];
      if (recipients.length === 0) continue;

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
    // B-4-5: 옛 try/catch + 23505 catch 패턴을 PostgreSQL `INSERT ON CONFLICT
    // DO NOTHING` 으로 교체. partial UNIQUE 충돌이 정상 흐름의 일부 (중복
    // 임계 발사 방지) 이므로 예외 throw + catch 비용을 0 으로 만든다.
    // identifiers.length 가 0 이면 conflict — claim 실패.
    const result = await this.dispatchRepository
      .createQueryBuilder()
      .insert()
      .values({ integrationId, threshold, tokenExpiresAt })
      .orIgnore()
      .execute();
    return (result.identifiers ?? []).length > 0;
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

/**
 * `connected-expiry` scanner 에서 **refresh-capable provider** 인지 판별.
 * refresh_token 을 보유한 cafe24·makeshop 통합 — access_token 만 만료된 상태에서
 * `expired` 로 격하하지 않고, passive `integration_expired` 알림 대상에서도 제외한다
 * (spec/2-navigation/4-integration.md §11.2 — passive 알림은 refresh_token 없는
 * provider 한정).
 *
 * - cafe24: 0d 시 `cafe24-token-refresh` 큐로 갱신 (safety-net). 실패 시 worker 가
 *   `error(auth_failed)` 로 전이 + active 알림.
 * - makeshop: 배경 큐 없이 in-call proactive (`ensureFreshToken`) + reactive_401
 *   자가 회복에 위임 (refresh_token TTL 30~90일).
 *
 * 향후 다른 first-party Integration (Shopify 등) 이 같은 패턴을 쓰면 여기에 추가.
 */
function isRefreshCapable(integration: Integration): boolean {
  if (
    integration.serviceType !== 'cafe24' &&
    integration.serviceType !== 'makeshop'
  ) {
    return false;
  }
  const creds = integration.credentials as
    | Record<string, unknown>
    | null
    | undefined;
  const rt = creds?.refresh_token;
  return typeof rt === 'string' && rt.length > 0;
}
