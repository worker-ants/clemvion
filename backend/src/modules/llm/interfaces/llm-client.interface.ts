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

export interface LLMClient {
  chat(params: ChatParams): Promise<ChatResult>;
  embed(texts: string[], model?: string): Promise<number[][]>;
  listModels(): Promise<ModelInfo[]>;
  testConnection(): Promise<boolean>;
}
