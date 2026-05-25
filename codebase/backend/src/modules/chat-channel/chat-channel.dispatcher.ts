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
import { ChannelAdapterRegistry } from './channel-adapter.registry';
import { ChannelListenerRegistry } from './channel-listener.registry';
import { ChannelConversationService } from './channel-conversation.service';
import {
  ChannelMessage,
  ChatChannelAdapter,
  ChatChannelConfig,
  EiaEvent,
} from './types';

const SUBSCRIBED_EVENTS = new Set<string>([
  'execution.waiting_for_input',
  'execution.ai_message',
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
]);

/**
 * Chat Channel 어댑터의 outbound subscription.
 *
 * Spec §3.1 / §3.2 / CCH-AD-05:
 *   - WebsocketService.executionEvents$ 를 `onModuleInit` 에서 subscribe
 *     (기존 NotificationFanout / SseAdapter 와 동일 패턴 — R10 단일 sink 유지)
 *   - 5종 event 도착 시 → trigger 조회 → config.chatChannel 가 있으면 → registry.get(provider)
 *     → adapter.renderNode(event) → adapter.sendMessage() 호출
 *   - 실패 시 trigger 의 chat_channel_health = 'degraded' 갱신 (자동 비활성화 X — CCH-SE-01)
 *
 * Spec 본문은 "NotificationDispatcher 의 in-process EventEmitter" 표현을 사용하나 실제 SoT 는
 * WebsocketService.executionEvents$ Subject — 같은 facade 계층, R10 정합.
 */
@Injectable()
export class ChatChannelDispatcher implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ChatChannelDispatcher.name);
  private subscription: { unsubscribe: () => void } | null = null;

  constructor(
    private readonly websocketService: WebsocketService,
    private readonly registry: ChannelAdapterRegistry,
    private readonly listenerRegistry: ChannelListenerRegistry,
    private readonly conversationService: ChannelConversationService,
    @InjectRepository(Trigger)
    private readonly triggerRepository: Repository<Trigger>,
  ) {}

  onModuleInit(): void {
    this.subscription = this.websocketService.executionEvents$.subscribe({
      next: (event) => void this.handle(event),
      error: (err) =>
        this.logger.error(
          `ChatChannelDispatcher subscription error: ${err instanceof Error ? err.message : String(err)}`,
        ),
    });
    // 부트 시점 진단 log — production log 에 1회 찍힘. 사용자가 outbound 누락
    // 원인을 추적할 때 본 log 가 보이는지로 dispatcher subscription 확립 여부를
    // 1차 확인. 안 보이면 dispatcher instance 자체가 인스턴스화 안 된 것 (module
    // 등록 오류). 보이는데 handle() 의 후속 warn 들이 안 보이면 emit 가 dispatcher
    // 에 도달 안 함 (WebsocketService Subject 분리 또는 emit 자체 누락).
    this.logger.log(
      `subscribed to WebsocketService.executionEvents$ (waiting for ${[...SUBSCRIBED_EVENTS].join(', ')})`,
    );
  }

  onModuleDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(event: ExecutionChannelEvent): Promise<void> {
    if (!SUBSCRIBED_EVENTS.has(event.eventType)) return;
    // 진단 log — handle() 에 SUBSCRIBED_EVENTS 매치 event 가 도달했음을 확인. 본
    // log 가 안 보이면 emit 가 dispatcher 에 도달 안 함 (WebsocketService Subject
    // 분리 또는 module DI 이슈). production 'log' level 이라 noise 최소화 위해
    // event type + executionId 만.
    this.logger.log(
      `handle event ${event.eventType} (executionId=${event.executionId})`,
    );
    const triggerId = (event.payload as { triggerId?: unknown }).triggerId;
    if (typeof triggerId !== 'string' || triggerId.length === 0) {
      // Trigger id 가 없는 execution (수동 실행 등) 은 채널 대상 아님. silent OK —
      // 수동 실행 emit 마다 warn 찍으면 noise. PR #314 의 routing context 등록이
      // 안 됐다면 webhook 발화 execution 도 여기서 막힘 — 다음 if 가드들의 warn 으로는
      // 식별 안 되므로 debug 로 가시화 (production log level 상승 시 보임).
      this.logger.debug(
        `event ${event.eventType} skipped — payload.triggerId 없음 (수동 실행 또는 routing context 미등록)`,
      );
      return;
    }
    // [Spec R8 v1 적용 (2026-05-24)] per-trigger listener registry 사전 가드.
    // 미등록 trigger 의 event 는 silent skip (DB round-trip 절감 + trigger 삭제 후 race
    // event 의 비활성 trigger 메시지 발송 위험 사전 차단). registry 가 비어있는 race
    // window (process restart 직후) 는 bulkRegister 가 onApplicationBootstrap 에서 일괄
    // 복원하므로 의미 있는 갭이 거의 없음.
    //
    // **회귀 신호** (2026-05-25): triggerId 가 있는 webhook 발화 execution 인데 registry
    // 에 미등록 ⇒ trigger 활성화 시 listener.register 누락 또는 deploy 직후 race.
    // logger.warn 으로 즉시 운영 가시화 (이전엔 silent skip 이라 PR #314 적용 후에도
    // outbound 안 가는 원인을 production log 로 식별 불가했던 회귀를 차단).
    if (!this.listenerRegistry.has(triggerId)) {
      this.logger.warn(
        `event ${event.eventType} (trigger=${triggerId}) — listenerRegistry miss. ` +
          `bootstrap 누락 또는 활성화 시점 register 누락 가능. ` +
          `즉각 영향: outbound 메시지 발송 안 됨.`,
      );
      return;
    }
    const trigger = await this.triggerRepository.findOne({
      where: { id: triggerId },
      select: [
        'id',
        'workspaceId',
        'workflowId',
        'config',
        'chatChannelHealth',
      ],
    });
    if (!trigger) {
      this.logger.warn(
        `event ${event.eventType} (trigger=${triggerId}) — DB lookup 실패 (trigger 삭제됨?). outbound skip.`,
      );
      return;
    }
    const chatChannelCfg = readChatChannelConfig(trigger.config);
    if (!chatChannelCfg) {
      // listener registry 에는 있는데 config 에 chatChannel 없음 — 트리거가 chatChannel
      // 제거된 채 listener 가 stale 일 가능성.
      this.logger.warn(
        `event ${event.eventType} (trigger=${triggerId}) — trigger.config.chatChannel 없음 (registry stale 가능). outbound skip.`,
      );
      return;
    }

    let adapter: ChatChannelAdapter;
    try {
      adapter = this.registry.get(chatChannelCfg.provider);
    } catch (err) {
      this.logger.warn(
        `ChatChannelDispatcher: provider "${chatChannelCfg.provider}" 미등록 — event ${event.eventType} skip`,
      );
      void err;
      return;
    }

    // execution 의 conversation 매핑 — payload 안에 conversationKey 가 있어야 함 (HooksService 가
    // execute() 시 input.chatChannel.conversationKey 로 주입 → WebsocketService 의 routing
    // context registry → fanout envelope 에 자동 첨부 [PR #314]).
    const conversationKey = readConversationKey(event.payload);
    if (!conversationKey) {
      // **회귀 신호** (2026-05-25): trigger 가 chatChannel cfg 까지 가졌는데 envelope 에
      // conversationKey 없음 ⇒ PR #314 의 routing context 첨부가 작동 안 함.
      // 가능 원인: (a) ExecutionEngine 이 register 호출 안 함, (b) WebsocketService 의
      // attachRoutingContext 가 chatChannel 미첨부, (c) sanitize 가 conversationKey 제거.
      // logger.warn 으로 즉시 가시화.
      this.logger.warn(
        `event ${event.eventType} (trigger=${triggerId}, provider=${chatChannelCfg.provider}) — ` +
          `event.payload.chatChannel.conversationKey 없음. routing context 미첨부 회귀 신호. outbound skip.`,
      );
      return;
    }

    const eiaEvent = toEiaEvent(event);
    if (!eiaEvent) {
      // **결정적 진단** (2026-05-25): handle 까지 통과했는데 outbound 안 가는
      // 회귀 case. toEiaEvent 가 null 반환 = ai_message 의 경우 `payload.message`
      // 가 string 아님 (분기 line 343-355 참조). emit payload 의 message field
      // 가 누락/변형됐을 가능성. payload key 들을 dump 해 어떤 field 가 빠졌는지
      // 식별.
      this.logger.warn(
        `event ${event.eventType} (trigger=${triggerId}) — toEiaEvent null. ` +
          `payload keys=[${Object.keys(event.payload).join(',')}]. outbound skip.`,
      );
      return;
    }
    this.logger.debug(
      `toEiaEvent ok: ${eiaEvent.type} (executionId=${event.executionId})`,
    );

    // Phase 4 (PR-C) — waiting_for_input(form) 도착 시 formState 초기화.
    if (
      eiaEvent.type === 'execution.waiting_for_input' &&
      eiaEvent.node.interactionType === 'form'
    ) {
      const state = await this.conversationService.lookup(
        trigger.id,
        conversationKey,
      );
      if (state) {
        state.formState = {
          nodeId: eiaEvent.node.id,
          currentFieldIdx: 0,
          partialFormData: {},
        };
        state.lastUpdateAt = new Date().toISOString();
        await this.conversationService.upsert(
          trigger.id,
          conversationKey,
          state,
        );
      }
    }

    let messages: ChannelMessage[];
    try {
      messages = await adapter.renderNode(eiaEvent, chatChannelCfg);
    } catch (err) {
      this.logger.error(
        `ChatChannelDispatcher.renderNode 실패 (trigger=${trigger.id}, event=${event.eventType}): ${err instanceof Error ? err.message : String(err)}`,
      );
      await this.markDegraded(trigger.id, err);
      return;
    }

    // **결정적 진단** (2026-05-25): renderNode 결과 messages 의 개수와 종류 log.
    // 빈 배열이면 sendMessage 호출 0회 = 사용자에게 메시지 안 감. messages.length=N
    // 인데도 telegram 도착 안 하면 sendMessage 가 silent 성공 (telegram API 200
    // 인데 drop) 시나리오.
    this.logger.log(
      `renderNode → ${messages.length} message(s) (event=${event.eventType}, kinds=[${messages.map((m) => m.body.kind).join(',')}])`,
    );

    // conversationKey 가 ChannelMessage 안에 들어가지 않은 경우 보정.
    for (const message of messages) {
      if (!message.conversationKey) message.conversationKey = conversationKey;
      try {
        await adapter.sendMessage(message, chatChannelCfg);
        this.logger.log(
          `sendMessage ok (trigger=${trigger.id}, kind=${message.body.kind}, conversationKey=${message.conversationKey})`,
        );
      } catch (err) {
        this.logger.error(
          `ChatChannelDispatcher.sendMessage 실패 (trigger=${trigger.id}): ${err instanceof Error ? err.message : String(err)}`,
        );
        await this.markDegraded(trigger.id, err);
        // 시퀀스 안 한 메시지 실패해도 나머지 시도 (best-effort).
      }
    }

    // terminal event 면 conversation 의 activeExecution 비우기.
    if (
      event.eventType === 'execution.completed' ||
      event.eventType === 'execution.failed' ||
      event.eventType === 'execution.cancelled'
    ) {
      await this.conversationService.updateExecutionId(
        trigger.id,
        conversationKey,
        null,
      );
    }

    // 첫 성공 시 'healthy' 로 승격.
    if (trigger.chatChannelHealth !== 'healthy') {
      await this.triggerRepository.update(
        { id: trigger.id },
        {
          chatChannelHealth: 'healthy',
          chatChannelLastError: null,
        },
      );
    }
  }

  private async markDegraded(triggerId: string, err: unknown): Promise<void> {
    const message = err instanceof Error ? err.message : String(err);
    try {
      await this.triggerRepository.update(
        { id: triggerId },
        {
          chatChannelHealth: 'degraded',
          chatChannelLastError: message.slice(0, 1024),
        },
      );
    } catch (updateErr) {
      this.logger.warn(
        `markDegraded 자체 실패: ${updateErr instanceof Error ? updateErr.message : String(updateErr)}`,
      );
    }
  }
}

/** Trigger.config 에서 chatChannel 추출 (형식 검증 최소). */
function readChatChannelConfig(config: unknown): ChatChannelConfig | null {
  if (!config || typeof config !== 'object') return null;
  const chatChannel = (config as { chatChannel?: unknown }).chatChannel;
  if (!chatChannel || typeof chatChannel !== 'object') return null;
  const provider = (chatChannel as { provider?: unknown }).provider;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  return chatChannel as ChatChannelConfig;
}

/** Execution payload 또는 input 에서 conversationKey 추출. */
function readConversationKey(payload: Record<string, unknown>): string | null {
  // 1) payload 자체에 chatChannel.conversationKey 가 들어 있는 경우 (HooksService 가 주입).
  const chatChannel = (payload as { chatChannel?: unknown }).chatChannel;
  if (chatChannel && typeof chatChannel === 'object') {
    const key = (chatChannel as { conversationKey?: unknown }).conversationKey;
    if (typeof key === 'string' && key.length > 0) return key;
  }
  return null;
}

/** ExecutionChannelEvent (WebsocketService) → EiaEvent (어댑터 입력) 변환. */
export function toEiaEvent(event: ExecutionChannelEvent): EiaEvent | null {
  const baseExtract = (
    field: 'triggerId' | 'workflowId',
  ): string | undefined => {
    const v = event.payload[field];
    return typeof v === 'string' ? v : undefined;
  };
  const triggerId = baseExtract('triggerId');
  const workflowId = baseExtract('workflowId');
  if (!triggerId || !workflowId) return null;
  const base = {
    executionId: event.executionId,
    triggerId,
    workflowId,
    seq: event.seq,
    timestamp:
      typeof (event.payload as { timestamp?: unknown }).timestamp === 'string'
        ? (event.payload as { timestamp: string }).timestamp
        : new Date().toISOString(),
  };
  switch (event.eventType) {
    case 'execution.waiting_for_input': {
      // WS protocol (Spec 5-system/6-websocket-protocol §4.4) emits a flat
      // shape — `{ waitingNodeId, waitingNodeType, interactionType,
      // conversationThread, buttonConfig?, nodeOutput? }` — while the EIA
      // spec (§6.2) and the chat-channel renderer (EiaWaitingForInputEvent)
      // expect the nested `{ node, interaction, context }` shape. Translate
      // here so the in-process subscription path (dispatcher → renderer)
      // works without the outbound webhook re-encoding the same payload.
      const p = event.payload as {
        waitingNodeId?: unknown;
        waitingNodeType?: unknown;
        interactionType?: unknown;
        conversationThread?: unknown;
        buttonConfig?: unknown;
        nodeOutput?: {
          config?: unknown;
          conversationConfig?: unknown;
          formConfig?: unknown;
        };
        // Back-compat: outbound webhook re-publishes already provide the
        // nested shape directly. If present, prefer them verbatim.
        node?: unknown;
        interaction?: Record<string, unknown>;
        context?: {
          formConfig?: unknown;
          buttonConfig?: unknown;
          conversationConfig?: unknown;
          conversationThread?: unknown;
        };
      };
      if (p.node && typeof p.node === 'object') {
        return {
          ...base,
          type: 'execution.waiting_for_input',
          node: p.node as {
            id: string;
            type: string;
            interactionType: 'form' | 'buttons' | 'ai_conversation';
          },
          interaction: p.interaction ?? {},
          context: p.context ?? {},
        };
      }
      const nodeId =
        typeof p.waitingNodeId === 'string' ? p.waitingNodeId : undefined;
      const nodeType =
        typeof p.waitingNodeType === 'string' ? p.waitingNodeType : undefined;
      const interactionType =
        p.interactionType === 'form' ||
        p.interactionType === 'buttons' ||
        p.interactionType === 'ai_conversation'
          ? p.interactionType
          : undefined;
      if (!nodeId || !nodeType || !interactionType) return null;
      // form nodeOutput shape: form handler stores `{ status, interactionType,
      // config: { fields:[...] }, ... }` (Spec 4-nodes form §3) — `config` is
      // the formConfig itself. ai_conversation nodeOutput carries
      // `conversationConfig` explicitly (execution-engine L2261). buttons
      // emit places `buttonConfig` top-level (execution-engine L3042).
      const formConfig =
        p.nodeOutput?.formConfig ?? p.nodeOutput?.config ?? undefined;
      return {
        ...base,
        type: 'execution.waiting_for_input',
        node: { id: nodeId, type: nodeType, interactionType },
        interaction: {},
        context: {
          formConfig,
          buttonConfig: p.buttonConfig,
          conversationConfig: p.nodeOutput?.conversationConfig,
          conversationThread: p.conversationThread,
        },
      };
    }
    case 'execution.ai_message': {
      const message = (event.payload as { message?: unknown }).message;
      if (typeof message !== 'string') return null;
      const turnCount = (event.payload as { turnCount?: unknown }).turnCount;
      return {
        ...base,
        type: 'execution.ai_message',
        message,
        turnCount: typeof turnCount === 'number' ? turnCount : 0,
        messages: (event.payload as { messages?: unknown[] }).messages,
        metadata: (event.payload as { metadata?: unknown }).metadata,
        llmCalls: (event.payload as { llmCalls?: unknown[] }).llmCalls,
      };
    }
    case 'execution.completed': {
      return {
        ...base,
        type: 'execution.completed',
        result: ((event.payload as { result?: unknown }).result ?? {}) as {
          outputs?: unknown;
          finalNodeId?: string;
          finalPort?: string;
        },
        durationMs: (event.payload as { durationMs?: number }).durationMs,
      };
    }
    case 'execution.failed': {
      const error = (event.payload as { error?: unknown }).error;
      if (!error || typeof error !== 'object') return null;
      return {
        ...base,
        type: 'execution.failed',
        error: error as {
          code: string;
          message: string;
          nodeId?: string | null;
          details?: unknown;
        },
        durationMs: (event.payload as { durationMs?: number }).durationMs,
      };
    }
    case 'execution.cancelled': {
      return {
        ...base,
        type: 'execution.cancelled',
        result: ((event.payload as { result?: unknown }).result ?? {}) as {
          cancelledBy?: 'user' | 'system' | 'timeout';
        },
        durationMs: (event.payload as { durationMs?: number }).durationMs,
      };
    }
    default:
      return null;
  }
}
