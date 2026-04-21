export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
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
  chat(params: ChatParams): Promise<ChatResult>;
  embed(texts: string[], model?: string): Promise<number[][]>;
  listModels(): Promise<ModelInfo[]>;
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
