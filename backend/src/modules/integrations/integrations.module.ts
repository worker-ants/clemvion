import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Integration } from './entities/integration.entity';
import { IntegrationUsageLog } from './entities/integration-usage-log.entity';
import { IntegrationOAuthState } from './entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from './entities/integration-oauth-preview.entity';
import { IntegrationExpiryDispatch } from './entities/integration-expiry-dispatch.entity';
import { Node } from '../nodes/entities/node.entity';
import { User } from '../users/entities/user.entity';
import { WorkspacesModule } from '../workspaces/workspaces.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { AuditLogsModule } from '../audit-logs/audit-logs.module';
import { McpModule } from '../mcp/mcp.module';
import { IntegrationsController } from './integrations.controller';
import { ThirdPartyOAuthController } from './third-party-oauth.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import { IntegrationActionRequiredNotifier } from './integration-action-required-notifier.service';
import {
  IntegrationExpiryScannerService,
  INTEGRATION_EXPIRY_QUEUE,
} from './integration-expiry-scanner.service';
import { CAFE24_REFRESH_QUEUE } from './cafe24-token-refresh.constants';

@Module({
  imports: [
    // Node is queried directly for usage-tracking — Node is a widely-read
    // domain entity and a dedicated read-only service did not yet exist.
    // User is read only to look up per-user notification preferences.
    TypeOrmModule.forFeature([
      Integration,
      IntegrationUsageLog,
      IntegrationOAuthState,
      IntegrationOAuthPreview,
      IntegrationExpiryDispatch,
      Node,
      User,
    ]),
    BullModule.registerQueue({ name: INTEGRATION_EXPIRY_QUEUE }),
    // Background refresh 패스가 enqueue 할 큐. 같은 큐를 Cafe24Module 이
    // worker 와 함께 별도 registerQueue — BullMQ 의 registerQueue 는 동일
    // 이름 다중 호출에 idempotent (Redis queue 는 동일 인스턴스 참조).
    BullModule.registerQueue({ name: CAFE24_REFRESH_QUEUE }),
    WorkspacesModule,
    NotificationsModule,
    AuditLogsModule,
    McpModule,
  ],
  controllers: [IntegrationsController, ThirdPartyOAuthController],
  providers: [
    IntegrationsService,
    IntegrationOAuthService,
    IntegrationExpiryScannerService,
    IntegrationActionRequiredNotifier,
  ],
  exports: [IntegrationsService, IntegrationActionRequiredNotifier],
})
export class IntegrationsModule {}
