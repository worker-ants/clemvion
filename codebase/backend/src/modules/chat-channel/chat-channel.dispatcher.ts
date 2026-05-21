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
  }

  onModuleDestroy(): void {
    if (this.subscription) {
      this.subscription.unsubscribe();
      this.subscription = null;
    }
  }

  private async handle(event: ExecutionChannelEvent): Promise<void> {
    if (!SUBSCRIBED_EVENTS.has(event.eventType)) return;
    const triggerId = (event.payload as { triggerId?: unknown }).triggerId;
    if (typeof triggerId !== 'string' || triggerId.length === 0) {
      // Trigger id 가 없는 execution (수동 실행 등) 은 채널 대상 아님.
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
    if (!trigger) return;
    const chatChannelCfg = readChatChannelConfig(trigger.config);
    if (!chatChannelCfg) return;

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
    // execute() 시 input.chatChannel.conversationKey 로 주입 → 엔진이 payload 에 전달).
    const conversationKey = readConversationKey(event.payload);
    if (!conversationKey) {
      // 일반 webhook (chatChannel 무관) execution 일 수도 있음 — skip silent.
      return;
    }

    const eiaEvent = toEiaEvent(event);
    if (!eiaEvent) return;

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

    // conversationKey 가 ChannelMessage 안에 들어가지 않은 경우 보정.
    for (const message of messages) {
      if (!message.conversationKey) message.conversationKey = conversationKey;
      try {
        await adapter.sendMessage(message, chatChannelCfg);
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
function readChatChannelConfig(
  config: unknown,
): ChatChannelConfig | null {
  if (!config || typeof config !== 'object') return null;
  const chatChannel = (config as { chatChannel?: unknown }).chatChannel;
  if (!chatChannel || typeof chatChannel !== 'object') return null;
  const provider = (chatChannel as { provider?: unknown }).provider;
  const botToken = (chatChannel as { botToken?: unknown }).botToken;
  if (typeof provider !== 'string' || provider.length === 0) return null;
  if (typeof botToken !== 'string' || botToken.length === 0) return null;
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
function toEiaEvent(event: ExecutionChannelEvent): EiaEvent | null {
  const baseExtract = (
    field: 'triggerId' | 'workflowId',
  ): string | undefined => {
    const v = (event.payload as Record<string, unknown>)[field];
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
        ? ((event.payload as { timestamp: string }).timestamp)
        : new Date().toISOString(),
  };
  switch (event.eventType) {
    case 'execution.waiting_for_input': {
      const node = (event.payload as { node?: unknown }).node;
      const interaction =
        (event.payload as { interaction?: Record<string, unknown> })
          .interaction ?? {};
      const context =
        (event.payload as {
          context?: {
            formConfig?: unknown;
            buttonConfig?: unknown;
            conversationConfig?: unknown;
            conversationThread?: unknown;
          };
        }).context ?? {};
      if (!node || typeof node !== 'object') return null;
      return {
        ...base,
        type: 'execution.waiting_for_input',
        node: node as {
          id: string;
          type: string;
          interactionType: 'form' | 'buttons' | 'ai_conversation';
        },
        interaction,
        context,
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
