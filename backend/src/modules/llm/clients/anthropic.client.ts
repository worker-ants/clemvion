import Anthropic from '@anthropic-ai/sdk';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';

const ANTHROPIC_MODELS: ModelInfo[] = [
  { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', type: 'chat' },
  { id: 'claude-sonnet-4-20250514', name: 'Claude Sonnet 4', type: 'chat' },
  { id: 'claude-haiku-4-5-20251001', name: 'Claude Haiku 4.5', type: 'chat' },
];

export class AnthropicClient implements LLMClient {
  private readonly client: Anthropic;

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.client = new Anthropic({
      apiKey,
      timeout: 120_000,
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const systemMessages = params.messages.filter((m) => m.role === 'system');
    const system =
      systemMessages.map((m) => m.content).join('\n\n') || undefined;

    const messages: Anthropic.MessageParam[] = params.messages
      .filter((m) => m.role !== 'system')
      .map((m) => {
        if (m.role === 'assistant' && m.toolCalls?.length) {
          const content: Anthropic.ContentBlockParam[] = [];
          if (m.content) {
            content.push({ type: 'text', text: m.content });
          }
          for (const tc of m.toolCalls) {
            content.push({
              type: 'tool_use',
              id: tc.id,
              name: tc.name,
              input: JSON.parse(tc.arguments),
            });
          }
          return { role: 'assistant' as const, content };
        }
        if (m.role === 'tool') {
          return {
            role: 'user' as const,
            content: [
              {
                type: 'tool_result' as const,
                tool_use_id: m.toolCallId || '',
                content: m.content,
              },
            ],
          };
        }
        return { role: m.role as 'user' | 'assistant', content: m.content };
      });

    const requestParams: Anthropic.MessageCreateParamsNonStreaming = {
      model: params.model || this.defaultModel,
      messages,
      max_tokens: params.maxTokens || 4096,
      ...(system ? { system } : {}),
      ...(params.temperature !== undefined
        ? { temperature: params.temperature }
        : {}),
      ...(params.topP !== undefined ? { top_p: params.topP } : {}),
    };

    if (params.tools?.length) {
      requestParams.tools = params.tools.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters as Anthropic.Tool.InputSchema,
      }));
      if (params.toolChoice) {
        requestParams.tool_choice =
          params.toolChoice === 'required'
            ? { type: 'any' }
            : params.toolChoice === 'none'
              ? { type: 'none' as never }
              : { type: 'auto' };
      }
    }

    const response = await this.client.messages.create(requestParams);

    let textContent = '';
    const toolCalls: ToolCall[] = [];

    for (const block of response.content) {
      if (block.type === 'text') {
        textContent += block.text;
      } else if (block.type === 'tool_use') {
        toolCalls.push({
          id: block.id,
          name: block.name,
          arguments: JSON.stringify(block.input),
        });
      }
    }

    let finishReason: ChatResult['finishReason'] = 'stop';
    if (response.stop_reason === 'tool_use') finishReason = 'tool_calls';
    else if (response.stop_reason === 'max_tokens') finishReason = 'length';

    return {
      content: textContent || null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens: response.usage.input_tokens + response.usage.output_tokens,
      },
      model: response.model,
      finishReason,
    };
  }

  embed(): Promise<number[][]> {
    return Promise.reject(
      new Error(
        'Anthropic does not support embedding. Use OpenAI or another provider for embeddings.',
      ),
    );
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve(ANTHROPIC_MODELS);
  }

  async testConnection(): Promise<boolean> {
    await this.client.messages.create({
      model: this.defaultModel || 'claude-haiku-4-5-20251001',
      max_tokens: 1,
      messages: [{ role: 'user', content: 'test' }],
    });
    return true;
  }
}
