import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { shouldSkipThrottle } from './common/utils/throttler-skip';
import { UserThrottlerGuard } from './common/guards/user-throttler.guard';
import { BullModule } from '@nestjs/bullmq';
import {
  appConfig,
  databaseConfig,
  redisConfig,
  s3Config,
  jwtConfig,
  mailConfig,
  llmConfig,
  webauthnConfig,
} from './common/config';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RedisModule } from './common/redis/redis.module';
import { RolesGuard } from './common/guards/roles.guard';
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
import { SystemStatusModule } from './modules/system-status/system-status.module';
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
import { RerankConfigModule } from './modules/rerank-config/rerank-config.module';
import { LlmModule } from './modules/llm/llm.module';
import { WorkflowAssistantModule } from './modules/workflow-assistant/workflow-assistant.module';
import { KnowledgeBaseModule } from './modules/knowledge-base/knowledge-base.module';
import { AgentMemoryModule } from './modules/agent-memory/agent-memory.module';
import { HooksModule } from './modules/hooks/hooks.module';
import { ExternalInteractionModule } from './modules/external-interaction/external-interaction.module';
import { WebChatCorsModule } from './modules/web-chat-cors/web-chat-cors.module';
import { ChatChannelModule } from './modules/chat-channel/chat-channel.module';
import { AlertsModule } from './modules/alerts/alerts.module';
// ROOT_ENTITIES 는 ./database/root-entities 로 분리(eval CLI 등 경량 부트스트랩이
// app.module 전체를 transitive import 하지 않고 entity 목록만 재사용하기 위함).
import { ROOT_ENTITIES } from './database/root-entities';

// ROOT_ENTITIES 정의는 ./database/root-entities 로 이동. 기존 import 사이트
// (app.module.spec 등) 호환을 위해 여기서 re-export 한다.
export { ROOT_ENTITIES } from './database/root-entities';

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
        webauthnConfig,
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
        entities: [...ROOT_ENTITIES],
        synchronize: false,
        logging: process.env.NODE_ENV === 'development',
      }),
    }),

    // BullMQ (Redis-backed job queue for scheduled workflow execution)
    // redis.config 가 노출하는 password/tls 옵션을 누락 없이 전달 — 운영 Redis 에
    // AUTH 가 도입될 때 BullMQ Queue/Worker 의 reconnect loop (일일 스케줄러 fire
    // 실패) 회귀를 차단. cafe24-install-nonce-cache / continuation-bus 의 동일 패턴
    // (`...(password ? { password } : {})`) 과 일치.
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const password = config.get<string>('redis.password');
        const tls = config.get<boolean>('redis.tls');
        return {
          connection: {
            host: config.get<string>('redis.host'),
            port: config.get<number>('redis.port'),
            ...(password ? { password } : {}),
            ...(tls ? { tls: {} } : {}),
          },
        };
      },
    }),

    // Rate Limiting
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'default', ttl: 60000, limit: 100 }],
      // e2e: 단일 컨테이너 IP 에서 빠른 register 호출이 100/60s 한계에 걸려
      // 14/15 suite 가 RATE_LIMITED 로 깨지는 사전 결함 해소. production /
      // development 동작은 무변경 (NODE_ENV=test 일 때만 skip).
      skipIf: shouldSkipThrottle,
    }),

    // 공유 인프라 — command Redis 단일 연결 (ai-review INFO-12). @Global.
    RedisModule,

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
    SystemStatusModule,
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
    RerankConfigModule,
    LlmModule,
    KnowledgeBaseModule,
    AgentMemoryModule,
    HooksModule,
    ExternalInteractionModule,
    WebChatCorsModule,
    ChatChannelModule,
    AlertsModule,
    WorkflowAssistantModule,
  ],
  providers: [
    { provide: APP_FILTER, useClass: GlobalExceptionFilter },
    { provide: APP_PIPE, useClass: CustomValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: TransformInterceptor },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
    // JwtAuthGuard 를 throttler 앞에 둬서 req.user 가 채워진 상태로 throttle 키를
    // 만든다 → UserThrottlerGuard 가 사용자당 rate-limit (re-run §12 등) 보장.
    // @Public 라우트(login/register 등)는 JwtAuthGuard 가 통과시키고 throttler 가
    // IP 폴백으로 여전히 보호하므로 pre-auth flood 방어는 유지된다.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: UserThrottlerGuard },
    // RolesGuard 는 JwtAuthGuard 다음에 실행돼야 한다 (req.user 가 채워진 뒤 역할 검사).
    // @Roles 가 붙지 않은 라우트는 default-allow 로 통과하므로 opt-in 시맨틱은 유지된다.
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
