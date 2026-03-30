import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  s3Config,
  jwtConfig,
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
import { AuthConfig } from './modules/auth-configs/entities/auth-config.entity';
import { Execution } from './modules/executions/entities/execution.entity';
import { NodeExecution } from './modules/node-executions/entities/node-execution.entity';
import { WorkflowVersion } from './modules/workflow-versions/entities/workflow-version.entity';
import { Notification } from './modules/notifications/entities/notification.entity';
import { AuditLog } from './modules/audit-logs/entities/audit-log.entity';
import { RefreshToken } from './modules/auth/entities/refresh-token.entity';

@Module({
  imports: [
    // Config
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, databaseConfig, redisConfig, s3Config, jwtConfig],
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
          AuthConfig,
          Execution,
          NodeExecution,
          WorkflowVersion,
          Notification,
          AuditLog,
          RefreshToken,
        ],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
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
