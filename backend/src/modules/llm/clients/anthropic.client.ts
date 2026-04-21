import Anthropic from '@anthropic-ai/sdk';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
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

    for (const block of response.content ?? []) {
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

    // Anthropic does not expose a standalone thinking/reasoning token count:
    // extended-thinking output is lumped into `output_tokens`, and the
    // thinking text itself is delivered as `thinking` content blocks rather
    // than a separate measurable field. `thinkingTokens` stays undefined.
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

  async *stream(
    params: ChatParams,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
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

    const requestParams: Anthropic.MessageCreateParamsStreaming = {
      model: params.model || this.defaultModel,
      messages,
      max_tokens: params.maxTokens || 4096,
      stream: true,
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
              ? ({ type: 'none' } as never)
              : { type: 'auto' };
      }
    }

    // content_block_start/delta/stop 이벤트는 블록 index 단위로 그룹핑된다.
    // tool_use 블록은 input_json_delta로 partial JSON이 들어오므로 조각을
    // 배열에 모았다가 `content_block_stop`에서 한 번만 `join('')`으로 결합한다
    // (긴 JSON에서 `+=` 누적이 O(n²)이 되는 것을 피하기 위함).
    const blocks = new Map<
      number,
      | { kind: 'text' }
      | { kind: 'tool_use'; id: string; name: string; argsParts: string[] }
    >();
    let finishReason: ChatResult['finishReason'] | 'aborted' = 'stop';
    let model = params.model || this.defaultModel;
    let inputTokens = 0;
    let outputTokens = 0;

    let stream: Awaited<ReturnType<typeof this.client.messages.create>>;
    try {
      stream = await this.client.messages.create(requestParams, { signal });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown stream error';
      yield {
        type: 'error',
        code: message.includes('429')
          ? 'LLM_RATE_LIMIT'
          : 'LLM_CONNECTION_ERROR',
        message,
      };
      return;
    }

    try {
      for await (const event of stream as unknown as AsyncIterable<Anthropic.MessageStreamEvent>) {
        if (event.type === 'message_start') {
          if (event.message?.model) model = event.message.model;
          if (event.message?.usage?.input_tokens != null) {
            inputTokens = event.message.usage.input_tokens;
          }
        } else if (event.type === 'content_block_start') {
          const block = event.content_block;
          if (block.type === 'text') {
            blocks.set(event.index, { kind: 'text' });
          } else if (block.type === 'tool_use') {
            blocks.set(event.index, {
              kind: 'tool_use',
              id: block.id,
              name: block.name,
              argsParts: [],
            });
          }
        } else if (event.type === 'content_block_delta') {
          const block = blocks.get(event.index);
          if (!block) continue;
          const delta = event.delta;
          if (block.kind === 'text' && delta.type === 'text_delta') {
            yield { type: 'text_delta', delta: delta.text };
          } else if (
            block.kind === 'tool_use' &&
            delta.type === 'input_json_delta'
          ) {
            block.argsParts.push(delta.partial_json);
            yield {
              type: 'tool_call_delta',
              id: block.id,
              name: block.name,
              argumentsDelta: delta.partial_json,
            };
          }
        } else if (event.type === 'content_block_stop') {
          const block = blocks.get(event.index);
          if (block?.kind === 'tool_use') {
            yield {
              type: 'tool_call_end',
              id: block.id,
              name: block.name,
              arguments: block.argsParts.join('') || '{}',
            };
          }
        } else if (event.type === 'message_delta') {
          if (event.delta.stop_reason === 'tool_use') {
            finishReason = 'tool_calls';
          } else if (event.delta.stop_reason === 'max_tokens') {
            finishReason = 'length';
          } else if (event.delta.stop_reason === 'end_turn') {
            finishReason = 'stop';
          }
          if (event.usage?.output_tokens != null) {
            outputTokens = event.usage.output_tokens;
          }
        }
      }
    } catch (error) {
      if (signal?.aborted) {
        finishReason = 'aborted';
      } else {
        const message =
          error instanceof Error ? error.message : 'Unknown stream error';
        yield {
          type: 'error',
          code: message.includes('429')
            ? 'LLM_RATE_LIMIT'
            : 'LLM_CONNECTION_ERROR',
          message,
        };
        return;
      }
    }

    yield {
      type: 'done',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      },
      model,
      finishReason,
    };
  }
}
