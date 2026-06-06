import type { EmbedInputType } from '../embedding-input-type';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
  /**
   * Origin marker for AI Agent's WebSocket emit per
   * spec/5-system/6-websocket-protocol.md §4.4.6:
   *  - `'live'`: produced by the current AI node's handler in this turn.
   *  - `'injected'`: prepended via ConversationThread injection (an upstream
   *    node's turn mapped per spec/conventions/conversation-thread.md §5.1).
   *
   * Strictly transport-layer metadata — `LlmService` strips this field
   * before forwarding to provider clients so LLM APIs only see the canonical
   * `{role, content, toolCalls?, toolCallId?}` shape.
   */
  source?: 'live' | 'injected';
}

export interface ToolDef {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: string;
  /**
   * Provider-opaque signature that must be echoed back in subsequent history
   * turns. Currently used by Gemini 2.5+/3.x (thought_signature) to validate
   * that the same model that originated the tool call is still in the
   * conversation. Other providers ignore this field.
   */
  signature?: string;
}

export interface ChatParams {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  maxTokens?: number;
  topP?: number;
  responseFormat?: 'text' | 'json';
  jsonSchema?: Record<string, unknown>;
  tools?: ToolDef[];
  toolChoice?: 'auto' | 'required' | 'none';
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  /**
   * Reasoning / thought tokens. Populated for providers that report them
   * separately (OpenAI reasoning models via `completion_tokens_details.
   * reasoning_tokens`, Gemini 2.5 via `usageMetadata.thoughtsTokenCount`).
   * Anthropic does not expose a standalone thinking token count, so it stays
   * undefined for that provider.
   */
  thinkingTokens?: number;
}

export interface ChatResult {
  content: string | null;
  toolCalls?: ToolCall[];
  usage: TokenUsage;
  model: string;
  finishReason: 'stop' | 'tool_calls' | 'length' | 'content_filter';
}

export interface ModelInfo {
  id: string;
  name: string;
  type: 'chat' | 'embedding';
}

/**
 * Streaming event emitted by `LLMClient.stream()`.
 *
 * Providers accumulate `tool_call_delta` events for each tool call until the
 * final `tool_call_end` signals the call is fully assembled. Callers can then
 * parse `arguments` (JSON string) and dispatch. A terminal `done` event
 * always closes the stream with usage/finishReason, unless an `error` event
 * aborts it first.
 */
export type ChatStreamEvent =
  | { type: 'text_delta'; delta: string }
  | {
      type: 'tool_call_delta';
      id: string;
      name?: string;
      argumentsDelta: string;
    }
  | {
      type: 'tool_call_end';
      id: string;
      name: string;
      arguments: string;
      /**
       * See {@link ToolCall.signature}. When present, consumers must persist
       * it with the tool call and echo it back in history on subsequent
       * turns.
       */
      signature?: string;
    }
  | {
      type: 'done';
      usage: TokenUsage;
      model: string;
      finishReason: ChatResult['finishReason'] | 'aborted';
    }
  | { type: 'error'; code: string; message: string };

export interface LLMClient {
  /**
   * Optional `signal` (2026-05-30, node-cancellation 컨벤션) aborts the
   * underlying HTTP request so cancel-others-on-fail / Workflow timeout /
   * 사용자 cancel 이 in-flight AI 호출을 즉시 cleanup 한다. Provider SDK
   * 가 미지원이면 best-effort — signal 을 무시하고 정상 완료.
   * SoT: spec/conventions/node-cancellation.md.
   */
  chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult>;
  /**
   * `inputType` 은 비대칭 임베딩 모델(e5 prefix / Gemini taskType)에서 query 와
   * document(passage) 를 다르게 인코딩하기 위한 힌트다. 대칭 모델은 무시한다.
   * 생략 시 'document'(passage) — 적재 경로 기본값. 검색 query 경로만 'query'.
   * SoT: spec/5-system/8-embedding-pipeline.md §5, embedding-input-type.ts.
   */
  embed(
    texts: string[],
    model?: string,
    inputType?: EmbedInputType,
  ): Promise<number[][]>;
  /**
   * Optional `signal` aborts the underlying HTTP request. Used by the service
   * layer's timeout wrapper to release sockets when the deadline is exceeded.
   */
  listModels(signal?: AbortSignal): Promise<ModelInfo[]>;
  testConnection(): Promise<boolean>;
  /**
   * Streaming variant of {@link chat}. Optional — providers without streaming
   * support must throw `LLM_STREAMING_UNSUPPORTED` synchronously when called.
   */
  stream?(
    params: ChatParams,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent>;
}
