import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Trigger } from '../triggers/entities/trigger.entity';
import {
  ExecutionChannelEvent,
  WebsocketService,
} from '../websocket/websocket.service';
import { NotificationDispatcher } from './notification-dispatcher.service';
import { InteractionTokenService } from './interaction-token.service';

const TERMINAL_EVENTS = new Set<string>([
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

const FANOUT_EVENTS = new Set<string>([
  'execution.waiting_for_input',
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
  'execution.ai_message',
]);

/**
 * [Spec EIA §6 / §R10] — WebsocketService 의 executionEvents$ 를 구독해서:
 *
 * 1. fanout 대상 event 가 들어오면 trigger 조회 → notification config 가 본 event 를 구독 중이면
 *    NotificationDispatcher 로 enqueue (after-commit hook 역할).
 * 2. terminal event (`completed/failed/cancelled`) 발송 후 — execution 의 iext jti 가 알려지면
 *    blacklist 등록. v1 은 jti 추적 인프라가 없어 fail-open 으로 진행 (자세한 jti revoke 는
 *    iext exp 가 ttl 도달 시점에 자연 무효화).
 *
 * 본 service 는 ExecutionEngine 외부에 위치해 R10 (단일 sink) 유지. ExecutionEngine 은 여전히
 * WebsocketService.emit 만 호출.
 */
@Injectable()
export class NotificationFanout implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationFanout.name);
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly dispatcher: NotificationDispatcher,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
    // tokenService 는 향후 jti 추적 인프라 도입 시 사용. 현재는 fail-open.
    private readonly tokenService: InteractionTokenService,
  ) {}

  onModuleInit(): void {
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => {
        void this.handle(event);
      },
      error: (err) =>
        this.logger.error(
          `NotificationFanout subscription error: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
  }

  onModuleDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(event: ExecutionChannelEvent): Promise<void> {
    if (!FANOUT_EVENTS.has(event.eventType)) return;
    // execution 의 trigger 조회 — 효율을 위해 payload 에서 workflow / trigger id 가 있으면 활용.
    const triggerId =
      (event.payload as { triggerId?: unknown }).triggerId ?? null;
    if (typeof triggerId !== 'string' || triggerId.length === 0) {
      // webhook 이 시작한 execution 만 trigger 가 알려진다. 본 fanout 도 그 경우에만.
      // payload 에 triggerId 가 없으면 DB lookup 까지 가는 것보다 silent skip 이 안전.
      return;
    }
    const trigger = await this.triggerRepository.findOne({
      where: { id: triggerId },
      select: ['id', 'workspaceId', 'workflowId', 'config'],
    });
    if (!trigger) return;
    const notificationCfg = (trigger.config as { notification?: unknown })
      .notification;
    if (!notificationCfg || typeof notificationCfg !== 'object') return;
    const subscribed = Array.isArray(
      (notificationCfg as { events?: unknown }).events,
    )
      ? (notificationCfg as { events: unknown[] }).events.includes(
          event.eventType,
        )
      : false;
    if (!subscribed) return;
    await this.dispatcher.enqueue({
      triggerId: trigger.id,
      eventType: event.eventType,
      executionId: event.executionId,
      workflowId: trigger.workflowId,
      eventBody: {
        type: event.eventType,
        executionId: event.executionId,
        triggerId: trigger.id,
        workflowId: trigger.workflowId,
        seq: event.seq,
        payload: event.payload,
        timestamp: new Date().toISOString(),
      },
    });
    // [Spec EIA §3.3 EIA-AU-04] terminal event 발송 후 해당 execution 의 iext jti 를 즉시 blacklist.
    // V060 의 execution_token 테이블 + revokeAllForExecution 으로 v1 의 "exp 자연 무효화" 잔여
    // 위험 해소. Repository 미주입이거나 0건이면 no-op.
    if (TERMINAL_EVENTS.has(event.eventType)) {
      try {
        await this.tokenService.revokeAllForExecution(event.executionId);
      } catch (err) {
        this.logger.warn(
          `NotificationFanout: revokeAllForExecution 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
  }
}
