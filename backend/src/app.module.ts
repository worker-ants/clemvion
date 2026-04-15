import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bullmq';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  s3Config,
  jwtConfig,
  mailConfig,
  llmConfig,
} from './common/config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { TransformInterceptor } from './common/interceptors/transform.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { CustomValidationPipe } from './common/pipes/validation.pipe';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { WorkspacesModule } from './modules/workspaces/workspaces.module';
import { ExecutionsModule } from './modules/executions/executions.module';
import { WorkflowVersionsModule } from './modules/workflow-versions/workflow-versions.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { AuditLogsModule } from './modules/audit-logs/audit-logs.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { StatisticsModule } from './modules/statistics/statistics.module';
import { WorkflowsModule } from './modules/workflows/workflows.module';
import { NodesModule } from './modules/nodes/nodes.module';
import { EdgesModule } from './modules/edges/edges.module';
import { TriggersModule } from './modules/triggers/triggers.module';
import { SchedulesModule } from './modules/schedules/schedules.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { AuthConfigsModule } from './modules/auth-configs/auth-configs.module';
import { FoldersModule } from './modules/folders/folders.module';
import { ExecutionEngineModule } from './modules/execution-engine/execution-engine.module';
import { WebsocketModule } from './modules/websocket/websocket.module';
import { MailModule } from './modules/mail/mail.module';
import { LlmConfigModule } from './modules/llm-config/llm-config.module';
import { LlmModule } from './modules/llm/llm.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { HooksModule } from './modules/hooks/hooks.module';

// Entity imports
import { User } from './modules/users/entities/user.entity';
import { Workspace } from './modules/workspaces/entities/workspace.entity';
import { WorkspaceMember } from './modules/workspaces/entities/workspace-member.entity';
import { Workflow } from './modules/workflows/entities/workflow.entity';
import { Folder } from './modules/folders/entities/folder.entity';
import { Node } from './modules/nodes/entities/node.entity';
import { Edge } from './modules/edges/entities/edge.entity';
import { Trigger } from './modules/triggers/entities/trigger.entity';
import { Schedule } from './modules/schedules/entities/schedule.entity';
import { Integration } from './modules/integrations/entities/integration.entity';
import { IntegrationUsageLog } from './modules/integrations/entities/integration-usage-log.entity';
import { IntegrationOAuthState } from './modules/integrations/entities/integration-oauth-state.entity';
import { IntegrationOAuthPreview } from './modules/integrations/entities/integration-oauth-preview.entity';
import { IntegrationExpiryDispatch } from './modules/integrations/entities/integration-expiry-dispatch.entity';
import { AuthConfig } from './modules/auth-configs/entities/auth-config.entity';
import { Execution } from './modules/executions/entities/execution.entity';
import { NodeExecution } from './modules/node-executions/entities/node-execution.entity';
import { WorkflowVersion } from './modules/workflow-versions/entities/workflow-version.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { AuditLog } from './modules/audit-logs/entities/audit-log.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';
import { AuthOAuthState } from './modules/auth/entities/auth-oauth-state.entity';
import { LlmConfig } from './modules/llm-config/entities/llm-config.entity';
import { KnowledgeBase } from './modules/knowledge-base/entities/knowledge-base.entity';
import { Document } from './modules/knowledge-base/entities/document.entity';
import { DocumentChunk } from './modules/knowledge-base/entities/document-chunk.entity';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [
        appConfig,
        databaseConfig,
        redisConfig,
        s3Config,
        jwtConfig,
        mailConfig,
        llmConfig,
      ],
      envFilePath: '.env',
    }),

    // Database
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
          User,
          Workspace,
          WorkspaceMember,
          Workflow,
          Folder,
          Node,
          Edge,
          Trigger,
          Schedule,
          Integration,
          IntegrationUsageLog,
          IntegrationOAuthState,
          IntegrationOAuthPreview,
          IntegrationExpiryDispatch,
          AuthConfig,
          Execution,
          NodeExecution,
          WorkflowVersion,
          Notification,
          AuditLog,
          RefreshToken,
          AuthOAuthState,
          LlmConfig,
          KnowledgeBase,
          Document,
          DocumentChunk,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),

    // BullMQ (Redis-backed job queue for scheduled workflow execution)
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('redis.host'),
          port: config.get<number>('redis.port'),
        },
      }),
    }),

    // Rate Limiting
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
    }),

    // Feature Modules
    HealthModule,
    AuthModule,
    UsersModule,
    WorkspacesModule,
    ExecutionsModule,
    WorkflowVersionsModule,
    NotificationsModule,
    AuditLogsModule,
    DashboardModule,
    StatisticsModule,
    WorkflowsModule,
    NodesModule,
    EdgesModule,
    TriggersModule,
    SchedulesModule,
    IntegrationsModule,
    AuthConfigsModule,
    FoldersModule,
    ExecutionEngineModule,
    WebsocketModule,
    MailModule,
    LlmConfigModule,
    LlmModule,
    KnowledgeBaseModule,
    HooksModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useClass: CustomValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
