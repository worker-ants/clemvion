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

export const INTEGRATION_EXPIRY_QUEUE = 'integration-expiry-scanner';

/** Usage-log retention window (spec §2.10.1). */
const USAGE_LOG_RETENTION_DAYS = 90;

/** Cafe24 Private install TTL — spec/2-navigation/4-integration.md §6 / ## Rationale. */
const PENDING_INSTALL_TTL_HOURS = 24;

interface ExpiryJobData {
  triggeredAt: string;
}

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
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await this.queue.upsertJobScheduler(
      'integration-expiry-daily',
      { pattern: '0 0 * * *', tz: 'UTC' },
      { name: 'scan', data: { triggeredAt: new Date().toISOString() } },
    );
    this.logger.log('Registered integration expiry scanner (daily 00:00 UTC)');
  }

  async process(job: Job<ExpiryJobData>): Promise<void> {
    this.logger.log(
      `Running integration expiry scan (${job.data.triggeredAt})`,
    );
    // Two independent passes. Failures in one must not block the other —
    // spec/data-flow/integration.md §1.4. variant 4: pending_install TTL.
    await this.run(new Date()).catch((err) =>
      this.logger.error(
        `expiry run failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    await this.expirePendingInstalls(new Date()).catch((err) =>
      this.logger.error(
        `pending_install TTL sweep failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
    await this.pruneUsageLogs(new Date()).catch((err) =>
      this.logger.error(
        `usage log prune failed: ${err instanceof Error ? err.message : String(err)}`,
      ),
    );
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
    const result = await this.integrationRepository
      .createQueryBuilder()
      .update()
      .set({
        status: 'expired',
        statusReason: 'install_timeout',
        installToken: null,
      })
      .where('status = :status', { status: 'pending_install' })
      .andWhere('created_at < :cutoff', { cutoff })
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
