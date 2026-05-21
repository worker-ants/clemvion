import { Injectable } from '@nestjs/common';
import { Observable, Subject } from 'rxjs';
import { WebsocketGateway } from './websocket.gateway';

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
  /** 직렬화된 payload (socket.io 와 동일 — 클라이언트가 받는 그대로). */
  payload: Record<string, unknown>;
}

export enum ExecutionEventType {
  EXECUTION_STARTED = 'execution.started',
  /** Emitted when execution resumes after a Form node receives user input (not a fresh start) */
  EXECUTION_RESUMED = 'execution.resumed',
  EXECUTION_COMPLETED = 'execution.completed',
  EXECUTION_FAILED = 'execution.failed',
  EXECUTION_CANCELLED = 'execution.cancelled',
  EXECUTION_WAITING_FOR_INPUT = 'execution.waiting_for_input',
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
}

export enum NodeEventType {
  NODE_STARTED = 'execution.node.started',
  NODE_COMPLETED = 'execution.node.completed',
  NODE_FAILED = 'execution.node.failed',
  NODE_SKIPPED = 'execution.node.skipped',
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

const MAX_SANITIZE_DEPTH = 10;

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
  | 'document:graph_error'
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
  /**
   * Execution-scoped monotonic sequence counter.
   *
   * 외부 SSE 의 `id:` 와 Outbound Notification 의 `seq` 가 본 카운터와 같은 값을
   * 공유한다 (Spec WS §2.2 + Spec EIA §R7). v1 은 single-instance in-memory Map —
   * 분산 환경에서 다중 backend instance 가 같은 execution 에 동시 emit 하는
   * 시나리오는 추후 follow-up 으로 Redis `INCR exec:seq:<id>` 또는 DB row-level
   * lock 으로 강화한다 (Spec EIA §R7 보강 노트).
   *
   * Map 키 = executionId, 값 = 마지막 발급된 seq. emit 시 ++ 후 반환.
   * EXECUTION_COMPLETED / FAILED / CANCELLED 이벤트 발송 후 키를 delete 해
   * 누수를 방지한다.
   */
  private readonly seqCounters = new Map<string, number>();

  /**
   * 외부 fan-out subject — execution: 채널 이벤트만 발행. SseAdapter / NotificationDispatcher 가
   * 본 stream 을 구독 (R10 facade 레이어).
   */
  private readonly executionEventSubject = new Subject<ExecutionChannelEvent>();

  /** Observable form — listener 가 subscribe(). */
  readonly executionEvents$: Observable<ExecutionChannelEvent> =
    this.executionEventSubject.asObservable();

  constructor(private readonly gateway: WebsocketGateway) {}

  /**
   * execution 채널 emit 직전에 호출. atomic INCR 후 새 seq 반환.
   *
   * 메모리 회수 정책: 본 메서드 호출만으로는 counter 가 release 되지 않는다.
   * emit 이 완료된 후 호출자(emitExecutionEvent/emitNodeEvent)가 terminal 이벤트
   * 인지 판정해 {@link releaseSeqCounter} 를 호출한다.
   */
  private nextSeq(executionId: string): number {
    const current = this.seqCounters.get(executionId) ?? 0;
    const next = current + 1;
    this.seqCounters.set(executionId, next);
    return next;
  }

  private releaseSeqCounter(executionId: string): void {
    this.seqCounters.delete(executionId);
  }

  emitExecutionEvent(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): void {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = this.nextSeq(executionId);
    const envelope: Record<string, unknown> = {
      executionId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    };
    this.gateway.broadcastToChannel(channel, eventType, envelope);
    // 외부 fan-out (R10 facade): SseAdapter / NotificationDispatcher 가 본 stream 을 구독.
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: envelope,
    });
    if (TERMINAL_EXECUTION_EVENTS.has(eventType)) {
      this.releaseSeqCounter(executionId);
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

  emitNodeEvent(
    executionId: string,
    nodeId: string,
    eventType: NodeEventType,
    payload: unknown,
  ): void {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    const seq = this.nextSeq(executionId);
    const envelope: Record<string, unknown> = {
      executionId,
      nodeId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      seq,
      timestamp: new Date().toISOString(),
    };
    this.gateway.broadcastToChannel(channel, eventType, envelope);
    this.executionEventSubject.next({
      executionId,
      eventType,
      seq,
      payload: envelope,
    });
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
