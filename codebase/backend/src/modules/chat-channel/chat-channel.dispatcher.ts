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
  ChatChannelInternalEvent,
  EiaAiMessageEvent,
  EiaEvent,
} from './types';

const SUBSCRIBED_EVENTS = new Set<string>([
  'execution.waiting_for_input',
  'execution.ai_message',
  'execution.completed',
  'execution.failed',
  'execution.cancelled',
  // chat-channel-internal — EIA §6.1 outbound 화이트리스트 외 추가 구독.
  // SoT: spec/5-system/15-chat-channel.md §3.1 CCH-AD-07 + spec/conventions/chat-channel-adapter.md §1.3.
  // presentation 노드 (`carousel`/`table`/`chart`/`template`) 비-blocking 완료만
  // 발화 — `toEiaEvent` 의 sub-filter 가 sub-set 한정 (다른 노드는 null 반환).
  'execution.node.completed',
]);

const PRESENTATION_NODE_TYPES = new Set<string>([
  'carousel',
  'table',
  'chart',
  'template',
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
      // 빈 text / buttons text body 는 provider API (Telegram 400 "message text is empty"
      // 등) 가 reject — sendMessage 호출 직전 silent skip. renderer 결과의 빈 string 은
      // upstream emit (예: ai_message.message 가 empty) 의 결함으로, 사용자에게 빈 메시지를
      // 보내는 것보다 silent skip + warn 가 안전.
      if (isEmptyTextBody(message.body)) {
        this.logger.warn(
          `sendMessage skip — empty text body (trigger=${trigger.id}, kind=${message.body.kind}, event=${event.eventType})`,
        );
        continue;
      }
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
/**
 * sendMessage 호출 전 빈 text body guard.
 *
 * upstream emit (예: ai_message.message 가 empty string) 의 결함으로 renderer 가 빈 text 를
 * 반환하면 provider API 가 400 ("message text is empty" — Telegram Bot API documented) 으로
 * reject. 사용자에게 빈 메시지를 보내는 것보다 silent skip + warn 가 안전 (CCH-SE-01 의 retry
 * backoff 도 호출되지 않아 자원 절약).
 *
 * text / buttons body 의 사용자-visible text 필드가 trim 후 비었으면 true. 다른 body kind
 * (image / form_prompt / typing) 는 자체 content 가 다른 자원이라 본 guard 비대상.
 */
export function isEmptyTextBody(body: ChannelMessage['body']): boolean {
  if (body.kind === 'text') return body.text.trim().length === 0;
  if (body.kind === 'buttons') return body.text.trim().length === 0;
  return false;
}

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

/**
 * ExecutionChannelEvent (WebsocketService) → EiaEvent | ChatChannelInternalEvent
 * (어댑터 입력) 변환.
 *
 * 반환 union 의 후자 (ChatChannelInternalEvent) 는 EIA outbound §6.1 화이트리스트
 * 5종 외 — chat-channel-internal 한정 listener 전용. SoT: spec/conventions/chat-channel-adapter.md §1.3.
 */
export function toEiaEvent(
  event: ExecutionChannelEvent,
): EiaEvent | ChatChannelInternalEvent | null {
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
      // WaitingInteractionType 은 4종 — spec/conventions/interaction-type-registry.md §1
      // ('form' / 'buttons' / 'ai_conversation' / 'ai_form_render', 2026-05-23 ai_form_render 추가).
      // chat channel 안에서 ai_form_render 는 ai_conversation 의 sub-state — renderer 가 동일 경로로
      // 처리 (form 인라인 렌더 어려움, conversationConfig.message 가 있으면 그것 표시).
      const interactionType =
        p.interactionType === 'form' ||
        p.interactionType === 'buttons' ||
        p.interactionType === 'ai_conversation' ||
        p.interactionType === 'ai_form_render'
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
      // 2026-05-25 — CCH-MP-01 보강: `presentations?` 필드 추출 (AI Agent
      // `render_*` 도구 호출 turn 의 sequential 발송 — SoT EIA §6.5 line 536 /
      // chat-channel-adapter §1.2 line 89). 미추출 시 chat-channel renderer 가
      // 봐도 event.presentations 가 undefined 라 회귀 ② 가 동작 안 함.
      const rawPresentations = (event.payload as { presentations?: unknown })
        .presentations;
      const presentations = Array.isArray(rawPresentations)
        ? (rawPresentations as EiaAiMessageEvent['presentations'])
        : undefined;
      return {
        ...base,
        type: 'execution.ai_message',
        message,
        turnCount: typeof turnCount === 'number' ? turnCount : 0,
        messages: (event.payload as { messages?: unknown[] }).messages,
        metadata: (event.payload as { metadata?: unknown }).metadata,
        llmCalls: (event.payload as { llmCalls?: unknown[] }).llmCalls,
        ...(presentations !== undefined ? { presentations } : {}),
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
      // execution-engine 이 emit 하는 payload.error shape 가 spec EIA §6.4 의 object
      // (`{ code, message, nodeId, details? }`) 와 drift — 일부 throw 경로에서 string
      // (errMessage) 으로 emit (execution-engine.service.ts line 1339-1346 / 2526-2533).
      // dispatcher 차원 back-compat wrap: string 이면 generic object 로 변환해 classifier
      // 의 unknown fallback (`executionFailedInternal`) 안내가 발송되도록 한다. 사용자가
      // CCH-ERR-* 안내를 받지 못하는 silent skip 회귀 fix (2026-05-25).
      //
      // 후속: execution-engine 의 emit shape 를 spec EIA §6.4 정합으로 마이그레이션하는
      // 별 plan (`spec-update-execution-failed-payload-shape`). 그 PR merge 후 본 wrap
      // 은 deprecated path 로 남고, object 케이스만 hot path.
      const errorRaw = (event.payload as { error?: unknown }).error;
      let error: {
        code: string;
        message: string;
        nodeId?: string | null;
        details?: unknown;
      };
      if (errorRaw && typeof errorRaw === 'object') {
        // Spec-정합 object shape (정상 path).
        error = errorRaw as typeof error;
      } else if (typeof errorRaw === 'string') {
        // Legacy string emit (back-compat wrap) — classifier unknown fallback.
        error = { code: 'INTERNAL_ERROR', message: errorRaw };
      } else {
        // 양쪽 미정의 — minimal placeholder. classifier unknown fallback.
        error = { code: 'INTERNAL_ERROR', message: 'unknown error' };
      }
      return {
        ...base,
        type: 'execution.failed',
        error,
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
    case 'execution.node.completed': {
      // chat-channel-internal — CCH-AD-07 / CCH-MP-06 / R-CCA-7.
      // presentation 노드 4종 한정 sub-filter + blocking 케이스 사전 제외.
      // SoT: spec/conventions/chat-channel-adapter.md §1.3 / §3.
      const p = event.payload as {
        nodeId?: unknown;
        nodeType?: unknown;
        nodeLabel?: unknown;
        output?: unknown;
        meta?: unknown;
      };
      const nodeId = typeof p.nodeId === 'string' ? p.nodeId : undefined;
      const nodeType = typeof p.nodeType === 'string' ? p.nodeType : undefined;
      if (!nodeId || !nodeType) return null;
      // presentation 노드 4종 외 — sub-filter 제외 (AI Agent / LLM / code 등).
      if (!PRESENTATION_NODE_TYPES.has(nodeType)) return null;
      // blocking 케이스 사전 제외 — `execution.waiting_for_input` (interactionType=buttons)
      // 흐름이 별도 처리 (중복 발송 방지).
      const output = (p.output ?? {}) as Record<string, unknown>;
      if (output.status === 'waiting_for_input') return null;
      const nodeLabel =
        typeof p.nodeLabel === 'string' ? p.nodeLabel : undefined;
      return {
        ...base,
        type: 'execution.node.completed',
        node: {
          id: nodeId,
          type: nodeType as 'carousel' | 'table' | 'chart' | 'template',
          ...(nodeLabel !== undefined ? { label: nodeLabel } : {}),
        },
        output,
        meta:
          p.meta && typeof p.meta === 'object'
            ? (p.meta as Record<string, unknown>)
            : undefined,
      };
    }
    default:
      return null;
  }
}
