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
 * 1. terminal event (`completed/failed/cancelled`) 시 [Spec EIA §3.3 EIA-AU-04] 에 따라 해당
 *    execution 의 iext jti 를 즉시 blacklist (`revokeAllForExecution`). V060 의 execution_token
 *    테이블 + jti 추적으로 v1 의 "exp 자연 무효화" 잔여 위험 해소. **outbound notification config
 *    유무와 독립** — interaction-only 트리거도 종료 시 토큰 무효화 의무를 진다.
 * 2. fanout 대상 event 가 들어오면 trigger 조회 → notification config 가 본 event 를 구독 중이면
 *    NotificationDispatcher 로 enqueue (after-commit hook 역할).
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
    // terminal event 시 iext jti 즉시 blacklist (EIA-AU-04). Redis/Repo 미가용 시 fail-open.
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
    // [Spec EIA §3.3 EIA-AU-04] terminal event 시 해당 execution 의 iext jti 를 즉시 blacklist.
    // spec 은 종료 시 토큰을 **무조건** invalidate 하도록 요구하므로 (triggerId / notification
    // config 조건 없음), 아래 notification fanout 게이트의 early return 보다 반드시 먼저, 그리고
    // triggerId 유무와 독립적으로 수행한다. iext 토큰을 발급하지 않은 execution (수동 실행 등) 은
    // revokeAllForExecution 가 단일 인덱스 lookup 후 no-op 으로 끝난다 (execution_token 0건).
    if (TERMINAL_EVENTS.has(event.eventType)) {
      try {
        await this.tokenService.revokeAllForExecution(event.executionId);
      } catch (err) {
        this.logger.warn(
          `NotificationFanout: revokeAllForExecution 실패 — fail-open: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }
    // --- 이하 outbound notification fanout — notification config 가 본 event 를 구독 중일 때만. ---
    // execution 의 trigger 조회 — 효율을 위해 payload 에서 workflow / trigger id 가 있으면 활용.
    const triggerId =
      (event.payload as { triggerId?: unknown }).triggerId ?? null;
    if (typeof triggerId !== 'string' || triggerId.length === 0) {
      // webhook 이 시작한 execution 만 trigger 가 알려진다. notification fanout 도 그 경우에만.
      // payload 에 triggerId 가 없으면 DB lookup 까지 가는 것보다 silent skip 이 안전.
      // 수동 실행은 정상적으로 여기 도달 — 매번 warn 하면 noise. PR #314 의 routing
      // context 미등록 시 webhook 발화 execution 도 여기 막힘 → debug 로 가시화.
      this.logger.debug(
        `event ${event.eventType} skipped — payload.triggerId 없음 (수동 실행 또는 routing context 미등록)`,
      );
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
  }
}
