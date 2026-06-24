import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { Trigger } from '../triggers/entities/trigger.entity';
import { Execution } from '../executions/entities/execution.entity';
import { NodeExecution } from '../node-executions/entities/node-execution.entity';
import { ExecutionToken } from './entities/execution-token.entity';
import { WebsocketModule } from '../websocket/websocket.module';
import { ExecutionsModule } from '../executions/executions.module';
import { ExecutionEngineModule } from '../execution-engine/execution-engine.module';
import { InteractionTokenService } from './interaction-token.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { NotificationWebhookProcessor } from './notification-webhook.processor';
import { NotificationFanout } from './notification-fanout.service';
import { SseAdapter } from './sse-adapter.service';
import { InteractionGuard } from './interaction.guard';
import { IdempotencyInterceptor } from './idempotency.interceptor';
import { InteractionService } from './interaction.service';
import { InteractionController } from './interaction.controller';
import { InteractionStreamController } from './interaction-stream.controller';
import { NOTIFICATION_WEBHOOK_QUEUE } from './notification-dispatcher.types';
import { TerminalRevokeReconcilerService } from './terminal-revoke-reconciler.service';
import { TERMINAL_REVOKE_RECONCILE_QUEUE } from './terminal-revoke-reconciler.types';
import { SecretStoreModule } from '../secret-store/secret-store.module';

/**
 * [Spec EIA §10] — External Interaction API 모듈.
 *
 * Wire-up:
 *  - REST controllers (interact / cancel / refresh-token / status, SSE stream)
 *  - InteractionGuard (Authorization Bearer + ?token SSE)
 *  - IdempotencyInterceptor (Redis 24h, R8)
 *  - InteractionTokenService (iext_/itk_ family)
 *  - NotificationDispatcher + Processor + Fanout (R10 — facade, ExecutionEngine 외부)
 *  - SseAdapter (executionEvents$ 구독)
 *  - TerminalRevokeReconcilerService (EIA-RL-06 — terminal revoke at-least-once sweep, BullMQ repeatable)
 *
 * 의존성: WebsocketModule (executionEvents$), TypeOrmModule.forFeature([Trigger, Execution,
 * ExecutionToken, NodeExecution]), ExecutionEngineModule + ExecutionsModule (interact dispatch),
 * BullModule (notification-webhook 큐).
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      Trigger,
      Execution,
      ExecutionToken,
      NodeExecution,
    ]),
    BullModule.registerQueue({ name: NOTIFICATION_WEBHOOK_QUEUE }),
    BullModule.registerQueue({ name: TERMINAL_REVOKE_RECONCILE_QUEUE }),
    WebsocketModule,
    forwardRef(() => ExecutionsModule),
    forwardRef(() => ExecutionEngineModule),
    SecretStoreModule,
  ],
  controllers: [InteractionController, InteractionStreamController],
  providers: [
    InteractionTokenService,
    NotificationDispatcher,
    NotificationWebhookProcessor,
    NotificationFanout,
    SseAdapter,
    InteractionGuard,
    IdempotencyInterceptor,
    InteractionService,
    TerminalRevokeReconcilerService,
  ],
  exports: [
    InteractionTokenService,
    NotificationDispatcher,
    InteractionService,
  ],
})
export class ExternalInteractionModule {}
