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
import { IntegrationsController } from './integrations.controller';
import { IntegrationsService } from './integrations.service';
import { IntegrationOAuthService } from './integration-oauth.service';
import {
  IntegrationExpiryScannerService,
  INTEGRATION_EXPIRY_QUEUE,
} from './integration-expiry-scanner.service';

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
    WorkspacesModule,
    NotificationsModule,
    AuditLogsModule,
  ],
  controllers: [IntegrationsController],
  providers: [
    IntegrationsService,
    IntegrationOAuthService,
    IntegrationExpiryScannerService,
  ],
  exports: [IntegrationsService],
})
export class IntegrationsModule {}
