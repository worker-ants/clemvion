import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Integration } from './entities/integration.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesService } from '../workspaces/workspaces.service';
import { NotificationsService } from '../notifications/notifications.service';

/**
 * `integration_action_required` 알림을 발사하는 단일 진입점. Cafe24ApiClient
 * 의 `markAuthFailed` / `recordNetworkFailure` 에서 status 가 `error` 로
 * 전이하는 순간 본 헬퍼가 호출된다.
 *
 * Spec: spec/2-navigation/4-integration.md §11.2 (분리 원칙 — passive
 * `integration_expired` vs active `integration_action_required`).
 *
 * 책임:
 * - 수신자 해석: Personal → 소유자 / Organization → Admin 전원
 * - User notification preferences 로딩 (옛 `notifyIntegrationExpiryByEmail`
 *   토글을 동일하게 적용 — UI 에서 같은 옵션이 두 알림 모두에 영향)
 * - 메시지 구성 + NotificationsService.createMany 호출
 *
 * 중복 방지: 같은 (`integration_id`, `status_reason`) 조합으로 24h 안에
 * 동일 type 알림이 이미 있는 경우 skip. 사용자가 재연결해 `connected` 로
 * 회복하면 다음 전이에서 다시 발사 가능 (24h 윈도우 안에서는 한 번).
 */
@Injectable()
export class IntegrationActionRequiredNotifier {
  private readonly logger = new Logger(IntegrationActionRequiredNotifier.name);

  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly workspacesService: WorkspacesService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async notify(
    integration: Integration,
    statusReason: 'auth_failed' | 'insufficient_scope' | 'network',
  ): Promise<void> {
    try {
      const { title, message } = this.composeMessage(integration, statusReason);

      // 24h 안에 같은 (workspace, type, resourceId, title) 조합으로 발사된
      // 적이 있으면 skip. title 이 statusReason 별로 다르므로 reason 별 dedup.
      const alreadyNotified =
        await this.notificationsService.hasRecentByResource({
          workspaceId: integration.workspaceId,
          type: 'integration_action_required',
          resourceId: integration.id,
          title,
          withinMs: 24 * 60 * 60 * 1000,
        });
      if (alreadyNotified) return;

      const recipients = await this.resolveRecipients(integration);
      if (recipients.length === 0) return;

      const users = await this.userRepository.find({
        where: { id: In(recipients) },
      });
      const prefsByUser = new Map(
        users.map((u) => [u.id, u.notificationPreferences ?? {}]),
      );

      const entries = recipients.map((userId) => {
        const prefs = prefsByUser.get(userId) ?? {};
        // `integration_action_required` 가 운영 중 발생한 능동 알림이라
        // expiry 와 같은 email 토글을 그대로 따른다 (별도 토글 신설은 UI
        // 노출 부담 — 둘 다 같은 "통합" 관련 알림).
        const wantsEmail = prefs.integrationExpiryEmail === true;
        return {
          workspaceId: integration.workspaceId,
          userId,
          type: 'integration_action_required' as const,
          title,
          message,
          resourceType: 'integration' as const,
          resourceId: integration.id,
          channel: (wantsEmail ? 'both' : 'in_app') as
            | 'both'
            | 'in_app'
            | 'email',
        };
      });

      await this.notificationsService.createMany(entries);
    } catch (err) {
      // 알림 발사 실패는 markAuthFailed/recordNetworkFailure 의 핵심 흐름
      // (status 전이) 을 깨면 안 된다.
      this.logger.warn(
        `notify(integration_action_required, ${statusReason}) for ${integration.id} failed: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async resolveRecipients(integration: Integration): Promise<string[]> {
    if (integration.scope === 'personal') {
      return [integration.createdBy];
    }
    return this.workspacesService.findAdminUserIds(integration.workspaceId);
  }

  private composeMessage(
    integration: Integration,
    statusReason: 'auth_failed' | 'insufficient_scope' | 'network',
  ): { title: string; message: string } {
    const name = integration.name;
    switch (statusReason) {
      case 'auth_failed':
        return {
          title: 'Integration disconnected',
          message: `"${name}" needs reauthorization — Cafe24 rejected the access token. Reconnect to resume.`,
        };
      case 'insufficient_scope':
        return {
          title: 'Integration missing permissions',
          message: `"${name}" is missing required scopes — open Settings → Integrations and re-grant access.`,
        };
      case 'network':
        return {
          title: 'Integration network failure',
          message: `"${name}" failed 3 consecutive network calls. Check Cafe24 status or retry later.`,
        };
    }
  }
}
