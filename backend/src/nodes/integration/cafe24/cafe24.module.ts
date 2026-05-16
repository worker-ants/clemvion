import {
  Inject,
  Logger,
  Module,
  OnApplicationShutdown,
  OnModuleInit,
  Provider,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { QueueEvents } from 'bullmq';
import { Integration } from '../../../modules/integrations/entities/integration.entity';
import { Cafe24ApiClient } from './cafe24-api.client';
import { Cafe24TokenRefreshProcessor } from './cafe24-token-refresh.processor';
import {
  CAFE24_REFRESH_QUEUE,
  CAFE24_REFRESH_QUEUE_EVENTS,
} from '../../../modules/integrations/cafe24-token-refresh.constants';
import { IntegrationsModule } from '../../../modules/integrations/integrations.module';
import { IntegrationsService } from '../../../modules/integrations/integrations.service';

/**
 * QueueEvents provider — Cafe24ApiClient 가 `waitUntilFinished` 로 worker
 * 완료를 대기하는 데 사용. 모듈 lifecycle 에 묶어 onApplicationShutdown 에서
 * 명시 close 한다 (Redis 커넥션 leak 방지).
 */
const cafe24RefreshQueueEventsProvider: Provider = {
  provide: CAFE24_REFRESH_QUEUE_EVENTS,
  useFactory: (config: ConfigService) =>
    new QueueEvents(CAFE24_REFRESH_QUEUE, {
      connection: {
        host: config.get<string>('redis.host'),
        port: config.get<number>('redis.port'),
      },
    }),
  inject: [ConfigService],
};

/**
 * Cafe24 node infrastructure. Owns the rate-limit-aware Cafe24ApiClient
 * that both the cafe24 workflow node and the Cafe24McpToolProvider share
 * (spec/4-nodes/4-integration/4-cafe24.md §4.1 / §8.4).
 *
 * 또한 **Cafe24 토큰 갱신을 위한 BullMQ 큐 (`cafe24-token-refresh`) 와
 * worker (`Cafe24TokenRefreshProcessor`)** 를 owns. 멀티 인스턴스 race
 * 보호를 위해 모든 refresh 가 이 큐의 `jobId = integrationId` dedup 을
 * 거쳐 직렬화된다. 같은 큐를 IntegrationsModule (백그라운드 일일 스캐너)
 * 도 enqueue 용으로 별도 registerQueue — BullMQ 는 같은 이름의 다중
 * registerQueue 를 idempotent 하게 처리한다.
 *
 * Kept in `nodes/integration/cafe24/` rather than the upstream
 * `modules/integrations/` to preserve the project's `nodes → modules`
 * dependency direction — IntegrationsModule must never import from
 * `nodes/*`. ExecutionEngineModule imports Cafe24Module directly to make
 * Cafe24ApiClient injectable into ExecutionEngineService for the
 * HandlerDependencies wiring.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Integration]),
    BullModule.registerQueue({ name: CAFE24_REFRESH_QUEUE }),
    // IntegrationsService 에 cafe24 entity-aware tester 를 등록하기 위함.
    // dependency direction 은 nodes → modules 로 유지된다 (역방향 import 없음).
    IntegrationsModule,
  ],
  providers: [
    Cafe24ApiClient,
    Cafe24TokenRefreshProcessor,
    cafe24RefreshQueueEventsProvider,
  ],
  exports: [Cafe24ApiClient],
})
export class Cafe24Module implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(Cafe24Module.name);

  constructor(
    @Inject(CAFE24_REFRESH_QUEUE_EVENTS)
    private readonly queueEvents: QueueEvents,
    private readonly integrations: IntegrationsService,
    private readonly cafe24Api: Cafe24ApiClient,
  ) {}

  /**
   * `POST /api/integrations/:id/test` 의 cafe24 분기를 활성화한다. spec
   * §5.8 의 `GET /api/v2/admin/apps` 핑 + 401 시 refresh + 1회 재시도 정책.
   * IntegrationsModule 이 `nodes/*` 를 import 하지 않도록 register 패턴으로
   * 우회 — dependency direction 보존.
   */
  onModuleInit(): void {
    this.integrations.registerEntityTester('cafe24', async (integration) => {
      const result = await this.cafe24Api.pingConnection(integration);
      return {
        success: result.success,
        message:
          result.message ??
          (result.success
            ? 'Cafe24 connection successful'
            : 'Cafe24 connection failed'),
        code: result.code,
      };
    });
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.queueEvents.close();
    } catch (err) {
      this.logger.warn(
        `Cafe24Module shutdown: queueEvents.close() failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
