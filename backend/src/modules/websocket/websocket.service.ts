import { Injectable } from '@nestjs/common';
import { WebsocketGateway } from './websocket.gateway';

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

function sanitizePayloadForWs(value: unknown, depth = 0): unknown {
  if (depth > MAX_SANITIZE_DEPTH) return value;
  if (value === null || typeof value !== 'object') return value;
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

@Injectable()
export class WebsocketService {
  constructor(private readonly gateway: WebsocketGateway) {}

  emitExecutionEvent(
    executionId: string,
    eventType: ExecutionEventType,
    payload: unknown,
  ): void {
    const channel = `execution:${executionId}`;
    const sanitizedPayload = sanitizePayloadForWs(payload);
    this.gateway.broadcastToChannel(channel, eventType, {
      executionId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
    });
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
    this.gateway.broadcastToChannel(channel, eventType, {
      executionId,
      nodeId,
      ...((sanitizedPayload && typeof sanitizedPayload === 'object'
        ? sanitizedPayload
        : { data: sanitizedPayload }) as Record<string, unknown>),
      timestamp: new Date().toISOString(),
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
