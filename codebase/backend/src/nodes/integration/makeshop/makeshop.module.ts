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
import { MakeshopApiClient } from './makeshop-api.client';
import { MakeshopTokenRefreshProcessor } from './makeshop-token-refresh.processor';
import {
  MAKESHOP_MODULE_SHUTDOWN_GRACE_MS,
  MAKESHOP_REFRESH_QUEUE,
  MAKESHOP_REFRESH_QUEUE_EVENTS,
} from '../../../modules/integrations/makeshop-token-refresh.constants';
import { IntegrationsModule } from '../../../modules/integrations/integrations.module';
import { IntegrationsService } from '../../../modules/integrations/integrations.service';

/**
 * QueueEvents provider — MakeshopApiClient 가 `waitUntilFinished` 로 worker
 * 완료를 대기하는 데 사용. cafe24 의 동명 provider 와 동일 패턴 (redis
 * password/tls spread 포함). onApplicationShutdown 에서 명시 close.
 */
const makeshopRefreshQueueEventsProvider: Provider = {
  provide: MAKESHOP_REFRESH_QUEUE_EVENTS,
  useFactory: (config: ConfigService) => {
    const password = config.get<string>('redis.password');
    const tls = config.get<boolean>('redis.tls');
    return new QueueEvents(MAKESHOP_REFRESH_QUEUE, {
      connection: {
        host: config.get<string>('redis.host'),
        port: config.get<number>('redis.port'),
        ...(password ? { password } : {}),
        ...(tls ? { tls: {} } : {}),
      },
    });
  },
  inject: [ConfigService],
};

/**
 * MakeShop node infrastructure. Owns the MakeshopApiClient that the makeshop
 * workflow node (and the MakeshopMcpToolProvider, Phase 4) share, plus the
 * **dedicated `makeshop-token-refresh` BullMQ 큐 + worker** — separate from
 * cafe24's queue because the token endpoint and rotation policy differ
 * (spec/4-nodes/4-integration/5-makeshop.md §4 step 6).
 *
 * Kept in `nodes/integration/makeshop/` rather than `modules/integrations/`
 * to preserve the `nodes → modules` dependency direction. ExecutionEngineModule
 * imports MakeshopModule directly to make MakeshopApiClient injectable into the
 * HandlerDependencies wiring — exactly mirroring Cafe24Module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Integration]),
    BullModule.registerQueue({ name: MAKESHOP_REFRESH_QUEUE }),
    IntegrationsModule,
  ],
  providers: [
    MakeshopApiClient,
    MakeshopTokenRefreshProcessor,
    makeshopRefreshQueueEventsProvider,
  ],
  exports: [MakeshopApiClient],
})
export class MakeshopModule implements OnApplicationShutdown, OnModuleInit {
  private readonly logger = new Logger(MakeshopModule.name);

  constructor(
    @Inject(MAKESHOP_REFRESH_QUEUE_EVENTS)
    private readonly queueEvents: QueueEvents,
    private readonly integrations: IntegrationsService,
    private readonly makeshopApi: MakeshopApiClient,
  ) {}

  /**
   * `POST /api/integrations/:id/test` 의 makeshop 분기를 활성화한다. spec
   * §5.9 의 `GET information` 핑 + 401 시 refresh + 1회 재시도 정책.
   */
  onModuleInit(): void {
    this.integrations.registerEntityTester('makeshop', async (integration) => {
      const result = await this.makeshopApi.pingConnection(integration);
      return {
        success: result.success,
        message:
          result.message ??
          (result.success
            ? 'MakeShop connection successful'
            : 'MakeShop connection failed'),
        code: result.code,
      };
    });
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await Promise.race([
        this.queueEvents.close(),
        new Promise<void>((resolve) =>
          setTimeout(() => {
            this.logger.warn(
              `MakeshopModule shutdown: queueEvents.close() exceeded ${MAKESHOP_MODULE_SHUTDOWN_GRACE_MS}ms grace — forcing exit. In-flight waitUntilFinished listeners may receive stream-closed errors.`,
            );
            resolve();
          }, MAKESHOP_MODULE_SHUTDOWN_GRACE_MS),
        ),
      ]);
    } catch (err) {
      this.logger.warn(
        `MakeshopModule shutdown: queueEvents.close() failed — ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }
}
