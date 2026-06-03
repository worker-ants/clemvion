import { Injectable, Logger } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { WebsocketGateway } from './websocket.gateway';
import { ExecutionSeqAllocator } from './execution-seq-allocator.service';

/**
 * 외부 SSE 어댑터 (P5) 및 NotificationDispatcher (P6) 가 구독하는 fan-out stream payload.
 *
 * [Spec EIA §R10] — ExecutionEngine 단일 sink 정책 유지. emit 호출 측은 여전히
 * WebsocketService.emitExecutionEvent / emitNodeEvent 하나만. 본 service 가 facade 로
 * fan-out (socket.io + RxJS subject) 수행.
 */
export interface ExecutionChannelEvent {
  executionId: string;
  eventType: string;
  seq: number;
  /**
   * Fanout envelope — internal subscriber (SseAdapter / NotificationFanout /
   * ChatChannelDispatcher) 가 받는 payload. wire envelope (frontend 가 socket.io
   * 로 받는 payload) 와 base shape 은 같지만, execution 의 라우팅 컨텍스트
   * (`triggerId` / `chatChannel`) 가 등록되어 있으면 본 fanout envelope 에만
   * 추가로 첨부된다. 자세한 분리 이유는 {@link WebsocketService#executionRouting}.
   */
  payload: Record<string, unknown>;
}

/**
 * `ChatChannelDispatcher` 가 outbound 발송 시 라우팅에 사용하는 conversation
 * 식별자. 필수 두 필드는 [Spec Chat Channel §3.1 CCH-AD-05 / §4.3] 의 conversation
 * 매핑 키 — `(provider, conversationKey)` 1:1 ChannelConversation. provider 별
 * 추가 필드 (channelUserKey, 그 외 provider-specific) 는 index signature 로 허용 —
 * 본 타입은 dispatcher 에 전달되는 wire shape 의 최소 contract 만 강제하고
 * 확장 필드는 provider 책임으로 통과시킨다.
 */
export interface ChatChannelRoutingInfo {
  provider: string;
  conversationKey: string;
  channelUserKey?: string;
  [key: string]: unknown;
}

/**
 * Execution 단위 outbound 라우팅 컨텍스트. ExecutionEngine 이 execute() 진입
 * 시 등록 → 이후 emit 되는 모든 이벤트의 fanout envelope 에 자동 첨부 →
 * `ChatChannelDispatcher` / `NotificationFanout` 가 trigger 와 conversation 을
 * 식별 (Spec Chat Channel §3.1 CCH-AD-05 / EIA §6).
 */
export interface ExecutionRoutingContext {
  /** 트리거 발화로 시작된 execution 만 set. 수동 실행은 undefined. */
  triggerId?: string;
  /**
   * Workflow id — `ChatChannelDispatcher.toEiaEvent` 가 EiaEvent.base 의 필수
   * 필드로 사용. PR #314 의 초기 routing context 에는 누락되어 있었고, 그 결과
   * dispatcher 가 `if (!workflowId) return null` 에서 silent skip 하여 outbound
   * 가 안 가던 회귀 (2026-05-25 사용자 production log 확인) 를 해소한다. trigger
   * 발화 execution 의 workflow 는 항상 알려져 있으므로 register 시점에 명시.
   */
  workflowId?: string;
  /**
   * 트리거가 `config.chatChannel` 설정 webhook 인 경우만 set. 일반 webhook
   * 트리거는 undefined.
   */
  chatChannel?: ChatChannelRoutingInfo;
}

export enum ExecutionEventType {
  EXECUTION_STARTED = 'execution.started',
  /** Emitted when execution resumes after a Form node receives user input (not a fresh start) */
  EXECUTION_RESUMED = 'execution.resumed',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_WAITING_FOR_INPUT = 'execution.waiting_for_input',
  /**
   * AI Agent Multi Turn 모드에서 사용자 발화(q)를 수신 즉시(다음 턴 LLM 호출 전)
   * 라이브로 노출하기 위한 진행 신호. tool_call_* 와 동형의 비권위 신호 —
   * turn 종료 `AI_MESSAGE.messages` 스냅샷이 권위 출처이며 동일 user 메시지를
   * 포함한다. 영속 대상 아님 (spec/5-system/6-websocket-protocol.md §4.4
   * `execution.user_message`, spec/4-nodes/3-ai/1-ai-agent.md §7.5).
   */
  USER_MESSAGE = 'execution.user_message',
  AI_MESSAGE = 'execution.ai_message',
  /** AI Agent provider tool 실행 시작. 디버깅 타임라인의 pending 표시용 */
  TOOL_CALL_STARTED = 'execution.tool_call_started',
  /** AI Agent provider tool 실행 완료. status: 'success' | 'error' */
  TOOL_CALL_COMPLETED = 'execution.tool_call_completed',
  /** One-shot snapshot sent to the subscribing client right after it joins an `execution:*` channel */
  EXECUTION_SNAPSHOT = 'execution.snapshot',
}

/**
 * Wire payload for {@link ExecutionEventType.TOOL_CALL_STARTED}. Frontend
 * `use-execution-events.ts` maintains a structurally compatible local type;
 * keep the two in sync — adding a required field here is a breaking change
 * for the client.
 */
export interface ToolCallStartedPayload {
  /** Logical node id (graph UUID) of the AI Agent making the call. */
  nodeId: string;
  /** Multi-turn conversation index — assistants and tools share the same
   *  index within one turn so the timeline can group them visually. */
  turnIndex: number;
  /** LLM-assigned tool_use id; matches the eventual tool_result message and
   *  the COMPLETED event. */
  toolCallId: string;
  /** LLM-facing tool name (e.g. `kb_<sanitized>`, `mcp_<sid>__<tool>`). */
  name: string;
  /** Raw JSON-string arguments from the LLM; the client parses defensively. */
  arguments: string;
  /** ISO8601 — tool 실행 시작 절대 시각. 타임라인이 라이브/영속 동일 시각 표시.
   *  SoT: spec/5-system/6-websocket-protocol.md §4.4 execution.tool_call_started. */
  startedAt?: string;
}

/**
 * Wire payload for {@link ExecutionEventType.USER_MESSAGE}. 사용자 발화(q)를
 * 다음 턴 LLM 호출 전에 라이브로 노출하는 비권위 진행 신호. Frontend
 * `use-execution-events.ts` 가 구조 호환 로컬 타입을 유지하므로 두 정의를
 * 동기화한다. SoT: spec/5-system/6-websocket-protocol.md §4.4 execution.user_message.
 */
export interface UserMessagePayload {
  /** 실행 ID. */
  executionId: string;
  /** 메시지를 수신한 AI 노드의 graph UUID. */
  nodeId: string;
  /** 이 시점 `waiting_for_input` 상태였던 NodeExecution row PK (multi-row 라우팅). */
  nodeExecutionId?: string;
  /** 사용자가 보낸 발화 본문. */
  message: string;
  /** 엔진 수신 시각 (ISO 8601). 클라이언트 optimistic bubble dedup 키. */
  receivedAt: string;
}

/**
 * Wire payload for {@link ExecutionEventType.TOOL_CALL_COMPLETED}. `content`
 * is a 200-char preview string (full result lives in
 * `ai_message.messages` snapshot + persisted `outputData`).
 */
export interface ToolCallCompletedPayload {
  nodeId: string;
  turnIndex: number;
  toolCallId: string;
  /** JSON-stringified preview of the tool result (capped server-side). */
  content: string;
  status: 'success' | 'error';
  /** Sanitized human-readable error summary. Set when status='error'. */
  error?: string;
  durationMs: number;
  /** ISO8601 — tool 실행 시작 절대 시각 (= 대응 tool_call_started.startedAt). */
  startedAt?: string;
  /** ISO8601 — tool 실행 종료 절대 시각. */
  finishedAt?: string;
}

export enum NodeEventType {
  NODE_STARTED = 'execution.node.started',
  NODE_COMPLETED = 'execution.node.completed',
  NODE_FAILED = 'execution.node.failed',
  NODE_SKIPPED = 'execution.node.skipped',
  // 노드 외부 I/O 가 abortSignal 로 중단됨 (AbortError) — failed 와 별도 terminal
  // 이벤트로, 타임라인이 취소를 실패와 구분하고 running 에 잔류하지 않게 한다
  // (spec/5-system/6-websocket-protocol.md §4.4 / node-cancellation §5.1).
  NODE_CANCELLED = 'execution.node.cancelled',
}

/**
 * Background 본문 run-level 이벤트. 본문 안의 NodeExecution 변화는 기존
 * `execution:<id>` 채널에 그대로 발행되며 (`parentNodeExecutionId` 로 필터),
 * 본 채널은 **run 의 시작/종료** 같은 수명주기 이벤트만 받는다.
 *
 * 채널: `background:run:<backgroundRunId>` — execution:<id> 와 격리.
 * spec/4-nodes/1-logic/12-background.md §8.5 참조.
 */
export enum BackgroundRunEventType {
  BACKGROUND_RUN_STARTED = 'execution.background_run.started',
  BACKGROUND_RUN_COMPLETED = 'execution.background_run.completed',
}

/**
 * WARN #10 (Security) — credential-like 키를 가진 필드를 WS 이벤트 페이로드에서
 * 마스킹. 핸들러가 echo 하지 말아야 할 자격증명 (password, apiKey, token, secret,
 * credentials.access_token 등) 이 노드 output / meta 에 실수로 포함된 경우에
 * 대비한 defense-in-depth. 채널 구독자 전원에게 평문 노출되는 것을 차단.
 *
 * 키 이름 패턴 매칭 방식 — 값 자체의 entropy 분석은 false positive 가 너무 많음.
 */
const CREDENTIAL_KEY_PATTERN =
  /^(password|passwd|pwd|api[_-]?key|secret|token|access[_-]?token|refresh[_-]?token|private[_-]?key|client[_-]?secret|authorization|cookie)$/i;

export const MAX_SANITIZE_DEPTH = 10;

/**
 * 동일 객체 참조에 대한 sanitize 결과 캐시.
 *
 * ForEach 가 같은 `node.config` 를 5,000회 emit 해도 sanitize 는 1회만 수행된다.
 * WeakMap 이라 객체가 GC 되면 자동 정리. depth 마다 별도 캐시인 이유: 동일 부분트리가
 * 다른 깊이로 재방문될 때 (`MAX_SANITIZE_DEPTH` 경계 분기) 결과 형태가 달라질 수 있어서.
 * 실제 hot path 에서는 대부분 depth 0 이므로 캐시 적중률은 사실상 단일 캐시와 동일.
 */
const SANITIZE_CACHE = new WeakMap<object, unknown>();

/**
 * WS emit 페이로드에서 credential-like 키를 마스킹.
 *
 * - 자식 변경이 없으면 입력 그대로의 참조를 반환해 GC pressure 를 피한다 (참조 동일성 보장).
 * - depth 가 {@link MAX_SANITIZE_DEPTH} 를 초과하면 그 노드 이하의 키 매칭을 신뢰할 수 없다.
 *   하부에 credential 이 숨어 있을 가능성을 차단하기 위해 통째로 `'[REDACTED_DEPTH]'` 로 대체한다
 *   (옛 구현은 원본을 그대로 반환해 누출 위험이 있었음 — Review 후속 #4).
 * - 동일 객체 참조 재방문 시 {@link SANITIZE_CACHE} 에서 O(1) 조회. CPU 핫패스 완화 (C-4).
 *
 * @returns 동일 구조의 새 값(자식 mutation 발생 시) 또는 입력과 동일한 참조(변경 없을 때)
 */
function sanitizePayloadForWs(value: unknown, depth = 0): unknown {
  if (value === null || typeof value !== 'object') return value;
  if (depth > MAX_SANITIZE_DEPTH) return '[REDACTED_DEPTH]';
  // depth 0 진입만 캐시 검사 — 부분트리는 부모 호출이 이미 캐시 적중 시 진입 자체 안 함.
  // 캐시 키는 입력 object identity. 결과는 sanitized output (원본일 수도 있음).
  if (depth === 0) {
    const cached = SANITIZE_CACHE.get(value);
    if (cached !== undefined) return cached;
  }
  const result = sanitizeInner(value, depth);
  if (depth === 0) {
    SANITIZE_CACHE.set(value, result);
  }
  return result;
}

function sanitizeInner(value: object, depth: number): unknown {
  if (Array.isArray(value)) {
    let mutated = false;
    const out: unknown[] = new Array(value.length);
    for (let i = 0; i < value.length; i++) {
      const sanitized = sanitizePayloadForWs(value[i], depth + 1);
      if (sanitized !== value[i]) mutated = true;
      out[i] = sanitized;
    }
    return mutated ? out : value;
  }
  let result: Record<string, unknown> | null = null;
  const obj = value as Record<string, unknown>;
  for (const [k, v] of Object.entries(obj)) {
    if (CREDENTIAL_KEY_PATTERN.test(k)) {
      if (!result) result = { ...obj };
      result[k] = '[REDACTED]';
    } else {
      const sanitized = sanitizePayloadForWs(v, depth + 1);
      if (sanitized !== v) {
        if (!result) result = { ...obj };
        result[k] = sanitized;
      }
    }
  }
  return result ?? value;
}

/**
 * Debug-only payload fields that must NOT reach **external** fanout recipients
 * (external-interaction SSE / notification webhook / chat-channel outbound).
 *
 * `llmCalls` carries the raw LLM provider request/response (system prompt,
 * conversation history, tool definitions, user inputs) — an editor-only debug
 * surface. It is delivered solely on the authenticated, workspace-ownership
 * gated internal WS channel (`execution:{executionId}`), and stripped from the
 * fanout envelope so SSE token holders / channel end-users never receive it.
 *
 * Strip 은 **top-level 필드만** 수행한다 (depth-1 shallow delete). 중첩 객체 내부
 * 의 동명 필드는 strip 되지 않으므로, `EXTERNAL_STRIPPED_FIELDS` 에 새 필드를 추가
 * 할 때는 반드시 WS spec §4.4 과 {@link EiaAiMessageEvent} 주석을 함께 갱신한다.
 *
 * SoT: spec/5-system/6-websocket-protocol.md §4.4 `llmCalls[]` strip-only 결정
 * (+ EIA §6.5, chat-channel CCH-MP-01).
 */
const EXTERNAL_STRIPPED_FIELDS = ['llmCalls'] as const;

/**
 * Return a shallow clone of the wire envelope with debug-only fields removed,
 * for publishing to the external fanout. Returns the input unchanged when no
 * stripped field is present (no allocation on the common path). Never mutates
 * the input — the WS wire envelope keeps the full payload.
 *
 * Top-level only — nested fields with the same name are not removed.
 * When adding a new entry to {@link EXTERNAL_STRIPPED_FIELDS}, update
 * WS spec §4.4 and the `EiaAiMessageEvent` JSDoc accordingly.
 */
function stripExternalOnlyFields(
  envelope: Record<string, unknown>,
): Record<string, unknown> {
  if (!EXTERNAL_STRIPPED_FIELDS.some((f) => f in envelope)) return envelope;
  const clone = { ...envelope };
  for (const f of EXTERNAL_STRIPPED_FIELDS) delete clone[f];
  return clone;
}

/**
 * Knowledge Base 도메인 이벤트 — frontend `useKbEvents` 가 구독하는 12개 이벤트.
 * 채널 명명규약: `kb:${documentId}`. (execution: 채널과 구분)
 */
export type KbEventType =
  | 'document:embedding_started'
  | 'document:embedding_progress'
  | 'document:embedding_completed'
  | 'document:embedding_error'
  | 'document:embedding_retry'
  | 'document:embedding_failed'
  | 'document:graph_started'
  | 'document:graph_progress'
  | 'document:graph_completed'
  | 'document:graph_retry'
  | 'document:graph_failed';

/**
 * execution 채널의 종결 이벤트 — emit 후 seq counter 를 해제해 메모리 누수를 막는다.
 * 같은 executionId 가 재사용되어도 새 실행은 seq=1 부터 시작.
 */
const TERMINAL_EXECUTION_EVENTS: ReadonlySet<ExecutionEventType> = new Set([
  ExecutionEventType.EXECUTION_COMPLETED,
  ExecutionEventType.EXECUTION_FAILED,
  ExecutionEventType.EXECUTION_CANCELLED,
]);

@Injectable()
export class WebsocketService {
  private readonly logger = new Logger(WebsocketService.name);

  /**
   * Execution-scoped monotonic sequence counter.
   *
   * 외부 SSE 의 `id:` 와 Outbound Notification 의 `seq` 가 본 카운터와 같은 값을
   * 공유한다 (Spec WS §2.2 + Spec EIA §R7).
   *
   * v2 (2026-06): seq 발급을 {@link ExecutionSeqAllocator} (Redis `INCR exec:seq:<id>`)
   * 로 분산-안전하게 강화. multi-instance 환경에서 같은 execution 의 emit 이 다른
   * 인스턴스에서 발생해도 atomic INCR 로 monotonic invariant 가 유지된다
   * (Spec EIA §R7 "execution 별 atomic INCR" 전제). Redis 장애 시 allocator 가
   * in-memory degraded fallback. emit 메서드가 async 인 이유 = Redis round-trip await.
   */

  /**
   * 외부 fan-out subject — execution: 채널 이벤트만 발행. SseAdapter / NotificationDispatcher 가
   * 본 stream 을 구독 (R10 facade 레이어).
   */
  private readonly executionEventSubject = new Subject<ExecutionChannelEvent>();

  /** Observable form — listener 가 subscribe(). */
  readonly executionEvents$: Observable<ExecutionChannelEvent> =
    this.executionEventSubject.asObservable();

  /**
   * Execution 단위 라우팅 컨텍스트 — `executionId → {triggerId?, chatChannel?}`.
   *
   * [Spec Chat Channel §3.1 CCH-AD-05 / §3.2]: `ChatChannelDispatcher` 와
   * `NotificationFanout` 은 `event.payload.triggerId` / `event.payload.chatChannel.conversationKey`
   * 를 가드로 사용한다. ExecutionEngine 이 execute() 진입 시 본 Map 에 등록하면,
   * 이후 모든 `emitExecutionEvent` / `emitNodeEvent` 가 만드는 **fanout envelope**
   * 에만 자동 첨부된다. **wire envelope** (`gateway.broadcastToChannel`) 에는
   * 첨부하지 않아 WS spec §4.4 의 frontend wire shape 호환성을 유지한다.
   *
   * Lifecycle 은 seq allocator 의 키와 동일 — terminal event 발송 후 자동
   * release. 명시 release 필요 시 {@link releaseExecutionRouting}.
   */
  private readonly executionRouting = new Map<
    string,
    ExecutionRoutingContext
  >();

  constructor(
    private readonly gateway: WebsocketGateway,
    private readonly seqAllocator: ExecutionSeqAllocator,
  ) {}

  /**
   * Execution 시작 시 호출 — 이후 emit 되는 모든 이벤트의 fanout envelope 에
   * `triggerId` / `chatChannel` 이 자동 첨부된다.
   *
   * 같은 executionId 로 재호출하면 덮어쓰기. 일반 webhook (chatChannel 미설정)
   * 경로는 `triggerId` 만 전달해도 무관 (NotificationFanout 가드는 통과,
   * ChatChannelDispatcher 가드는 chatChannel 까지 필요해 자체 silent skip).
   */
  registerExecutionRouting(
    executionId: string,
    context: ExecutionRoutingContext,
  ): void {
    if (!executionId) return;
    this.executionRouting.set(executionId, context);
    // production 진단용 debug log — log level 을 'debug' 로 올리면 dispatcher 의
    // listenerRegistry miss 와 envelope 첨부 누락을 시간순으로 추적 가능.
    this.logger.debug(
      `routing context registered: executionId=${executionId} ` +
        `triggerId=${context.triggerId ?? '<none>'} ` +
        `chatChannel=${context.chatChannel ? `${context.chatChannel.provider}/${context.chatChannel.conversationKey}` : '<none>'}`,
    );
  }

  /**
   * Routing context 명시 해제. terminal event (`COMPLETED` / `FAILED` /
   * `CANCELLED`) 발송 시 {@link emitExecutionEvent} 가 자동 호출하므로 정상
   * 흐름에서는 호출 불필요. 엔진이 비정상 종료 (예: workflow not found 로 emit
   * 자체가 발생하지 않는 케이스) 등에서 누수 방지용으로 사용.
   */
  releaseExecutionRouting(executionId: string): void {
    this.executionRouting.delete(executionId);
  }

  async emitExecutionEvent(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): Promise<void> {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = await this.seqAllocator.next(executionId);
    const wireEnvelope: Record<string, unknown> = {
      executionId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    };
    // wire envelope (frontend socket.io) — WS spec §4.4 shape 그대로. 인증된
    // 내부 WS(에디터) 채널은 debug 필드(llmCalls) 를 포함한 full payload 수신.
    this.gateway.broadcastToChannel(channel, eventType, wireEnvelope);
    // fanout envelope (internal subscriber: SseAdapter / NotificationFanout /
    // ChatChannelDispatcher) — routing context 가 등록되어 있으면 첨부.
    // wire 와 분리한 이유: frontend wire shape 의 호환성을 유지하면서 dispatcher
    // 가 trigger 식별에 필요한 추가 context 만 internal subscriber 에 전달.
    // 또한 fanout 은 외부 수신자(SSE 토큰 보유 채널 end-user 포함) 로 나가므로
    // debug 전용 llmCalls 를 strip 한다 (WS §4.4 strip-only 결정). wireEnvelope
    // 은 위에서 이미 broadcast 됐고 여기선 새 clone 을 strip 하므로 WS copy 불변.
    const externalPayload = stripExternalOnlyFields(wireEnvelope);
    const fanoutEnvelope = this.attachRoutingContext(
      executionId,
      externalPayload,
    );
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: fanoutEnvelope,
    });
    // 진단 log — dispatcher 가 못 받는다는 보고 (2026-05-25) 의 emit-vs-subscribe
    // 분리 가설 검증용. ai_message / waiting_for_input 만 log (noise 회피).
    // dispatcher 의 handle log 와 짝지어 보면 emit-subscribe 가 같은 Subject 인지
    // 확인 가능. routing context 등록 여부도 같이 찍어 PR #314 fix 작동 검증.
    if (
      eventType === ExecutionEventType.AI_MESSAGE ||
      eventType === ExecutionEventType.EXECUTION_WAITING_FOR_INPUT
    ) {
      const hasRouting = this.executionRouting.has(executionId);
      this.logger.log(
        `emit ${eventType} (executionId=${executionId}, seq=${seq}, routing=${hasRouting ? 'attached' : 'NONE'})`,
      );
    }
    if (TERMINAL_EXECUTION_EVENTS.has(eventType)) {
      this.seqAllocator.release(executionId);
      this.releaseExecutionRouting(executionId);
    }
  }

  /**
   * KB 도메인 이벤트 발송. EmbeddingService / GraphExtractionService 가 문서 처리 진행/완료/실패
   * 시 호출. 채널 prefix 는 `kb:` 그대로 — `execution:` 으로 변환되지 않는다 (V038 fix).
   */
  emitKbEvent(
    documentId: string,
    eventType: KbEventType,
    payload: Record<string, unknown>,
  ): void {
    const channel = `kb:${documentId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    this.gateway.broadcastToChannel(channel, eventType, {
      documentId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    });
  }

  async emitNodeEvent(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): Promise<void> {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = await this.seqAllocator.next(executionId);
    const wireEnvelope: Record<string, unknown> = {
      executionId,
      nodeId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    };
    this.gateway.broadcastToChannel(channel, eventType, wireEnvelope);
    // node 이벤트는 현재 llmCalls 를 포함하지 않으나, 미래 누출 경로를 차단하기 위해
    // emitExecutionEvent 와 동일하게 strip 적용 (방어심층화 — W-1/W-4).
    const externalNodePayload = stripExternalOnlyFields(wireEnvelope);
    const fanoutEnvelope = this.attachRoutingContext(
      executionId,
      externalNodePayload,
    );
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: fanoutEnvelope,
    });
  }

  /**
   * wire envelope 에 execution routing context (`triggerId` / `chatChannel`) 를
   * shallow-merge 한 새 fanout envelope 반환. context 미등록이면 wire envelope
   * 동일 참조 반환 (allocation 없음). chatChannel 은 sanitize 한 사본을 첨부 —
   * 호출자 회귀로 secret 이 섞이는 케이스의 defense-in-depth.
   */
  private attachRoutingContext(
    executionId: string,
    wireEnvelope: Record<string, unknown>,
  ): Record<string, unknown> {
    const ctx = this.executionRouting.get(executionId);
    if (!ctx) return wireEnvelope;
    const additions: Record<string, unknown> = {};
    if (ctx.triggerId) additions.triggerId = ctx.triggerId;
    if (ctx.workflowId) additions.workflowId = ctx.workflowId;
    if (ctx.chatChannel) {
      additions.chatChannel = sanitizePayloadForWs(ctx.chatChannel) as Record<
        string,
        unknown
      >;
    }
    if (Object.keys(additions).length === 0) return wireEnvelope;
    return { ...wireEnvelope, ...additions };
  }

  /**
   * Background 본문 run 의 수명주기 이벤트를 `background:run:<id>` 채널에 발행.
   * processor 가 본문 실행 시작 / 종료 시 호출 — execution:<id> 와 격리된
   * 채널이라 메인 흐름 구독자에게 본문 이벤트가 전파되지 않는다.
   *
   * `backgroundRunId` 가 비어있으면 (옛 NodeExecution 의 본문 실행) emit 을
   * skip — 채널 식별자가 없어 라우팅 불가.
   */
  emitBackgroundRunEvent(
    backgroundRunId: string,
    eventType: BackgroundRunEventType,
    payload: Record<string, unknown>,
  ): void {
    if (!backgroundRunId) return;
    const channel = `background:run:${backgroundRunId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload) as Record<
      string,
      unknown
    >;
    this.gateway.broadcastToChannel(channel, eventType, {
      backgroundRunId,
      ...sanitizedPayload,
      timestamp: new Date().toISOString(),
    });
  }
}
