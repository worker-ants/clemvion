import OpenAI from 'openai';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';

export class OpenAIClient implements LLMClient {
  protected client: OpenAI;

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
    baseUrl?: string,
  ) {
    this.client = new OpenAI({
      apiKey,
      ...(baseUrl ? { baseURL: baseUrl } : {}),
      timeout: 120_000,
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const messages = params.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.toolCallId || '',
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsNonStreaming = {
      model: params.model || this.defaultModel,
      messages: messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
    };

    if (params.responseFormat === 'json') {
      if (params.jsonSchema) {
        requestParams.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            schema: params.jsonSchema,
            strict: true,
          },
        };
      } else {
        requestParams.response_format = { type: 'json_object' };
      }
    }

    if (params.tools?.length) {
      requestParams.tools = params.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      if (params.toolChoice) {
        requestParams.tool_choice =
          params.toolChoice === 'required'
            ? 'required'
            : params.toolChoice === 'none'
              ? 'none'
              : 'auto';
      }
    }

    const response = await this.client.chat.completions.create(requestParams);
    const reasoningTokens =
      response.usage?.completion_tokens_details?.reasoning_tokens;
    const choice = response.choices?.[0];
    if (!choice?.message) {
      return {
        content: null,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
          ...(reasoningTokens !== undefined && {
            thinkingTokens: reasoningTokens,
          }),
        },
        model: response.model,
        finishReason: 'stop',
      };
    }

    const toolCalls: ToolCall[] | undefined = choice.message.tool_calls
      ?.filter(
        (
          tc,
        ): tc is OpenAI.Chat.ChatCompletionMessageToolCall & {
          type: 'function';
        } => tc.type === 'function',
      )
      .map((tc) => ({
        id: tc.id,
        name: tc.function.name,
        arguments: tc.function.arguments,
      }));

    let finishReason: ChatResult['finishReason'] = 'stop';
    if (choice.finish_reason === 'tool_calls') finishReason = 'tool_calls';
    else if (choice.finish_reason === 'length') finishReason = 'length';
    else if (choice.finish_reason === 'content_filter')
      finishReason = 'content_filter';

    return {
      content: choice.message.content,
      toolCalls,
      usage: {
        inputTokens: response.usage?.prompt_tokens ?? 0,
        outputTokens: response.usage?.completion_tokens ?? 0,
        totalTokens: response.usage?.total_tokens ?? 0,
        ...(reasoningTokens !== undefined && {
          thinkingTokens: reasoningTokens,
        }),
      },
      model: response.model,
      finishReason,
    };
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    const response = await this.client.embeddings.create({
      model: model || 'text-embedding-3-small',
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    const MAX_MODELS = 100;
    const response = await this.client.models.list(
      signal ? { signal } : undefined,
    );
    const models: ModelInfo[] = [];
    for await (const m of response) {
      if (models.length >= MAX_MODELS) break;
      const type = m.id.includes('embedding') ? 'embedding' : 'chat';
      models.push({ id: m.id, name: m.id, type });
    }
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  async testConnection(): Promise<boolean> {
    await this.client.models.list();
    return true;
  }

  async *stream(
    params: ChatParams,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const messages = params.messages.map((m) => {
      if (m.role === 'tool') {
        return {
          role: 'tool' as const,
          content: m.content,
          tool_call_id: m.toolCallId || '',
        };
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.content,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: tc.arguments },
          })),
        };
      }
      return { role: m.role, content: m.content };
    });

    const requestParams: OpenAI.Chat.ChatCompletionCreateParamsStreaming = {
      model: params.model || this.defaultModel,
      messages: messages,
      temperature: params.temperature,
      max_tokens: params.maxTokens,
      top_p: params.topP,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (params.responseFormat === 'json') {
      if (params.jsonSchema) {
        requestParams.response_format = {
          type: 'json_schema',
          json_schema: {
            name: 'response',
            schema: params.jsonSchema,
            strict: true,
          },
        };
      } else {
        requestParams.response_format = { type: 'json_object' };
      }
    }

    if (params.tools?.length) {
      requestParams.tools = params.tools.map((t) => ({
        type: 'function' as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        },
      }));
      if (params.toolChoice) {
        requestParams.tool_choice =
          params.toolChoice === 'required'
            ? 'required'
            : params.toolChoice === 'none'
              ? 'none'
              : 'auto';
      }
    }

    const stream = await this.client.chat.completions.create(requestParams, {
      signal,
    });

    // tool_call 인덱스 기반으로 id/name/arguments 조각을 누적한다.
    // OpenAI는 동일 tool_call의 delta를 같은 index로 여러 번 내려보내며,
    // id/name은 첫 조각에만 포함되는 경우가 많다. args는 긴 JSON을 생성할 때
    // 문자열 누적(`+=`)이 O(n²) 비용이 되므로 조각 배열에 모아 두었다가
    // 필요한 시점에 `join('')`으로 1회만 결합한다.
    const toolAccum = new Map<
      number,
      { id: string; name: string; argsParts: string[] }
    >();
    let finishReason: ChatResult['finishReason'] | 'aborted' = 'stop';
    let model = params.model || this.defaultModel;
    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let thinkingTokens: number | undefined;

    try {
      for await (const chunk of stream) {
        if (chunk.model) model = chunk.model;

        const choice = chunk.choices?.[0];
        if (choice) {
          const delta = choice.delta;
          if (delta?.content) {
            yield { type: 'text_delta', delta: delta.content };
          }
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index;
              const entry = toolAccum.get(idx) ?? {
                id: '',
                name: '',
                argsParts: [] as string[],
              };
              if (tc.id) entry.id = tc.id;
              if (tc.function?.name) entry.name = tc.function.name;
              const argsFragment = tc.function?.arguments ?? '';
              if (argsFragment) entry.argsParts.push(argsFragment);
              toolAccum.set(idx, entry);
              if (entry.id && (tc.function?.name || argsFragment)) {
                yield {
                  type: 'tool_call_delta',
                  id: entry.id,
                  name: tc.function?.name,
                  argumentsDelta: argsFragment,
                };
              }
            }
          }
          if (choice.finish_reason) {
            if (choice.finish_reason === 'tool_calls') {
              finishReason = 'tool_calls';
              // 완성된 tool_call들을 방출
              const sorted = [...toolAccum.entries()].sort(([a], [b]) => a - b);
              for (const [, entry] of sorted) {
                if (entry.id) {
                  yield {
                    type: 'tool_call_end',
                    id: entry.id,
                    name: entry.name,
                    arguments: entry.argsParts.join('') || '{}',
                  };
                }
              }
            } else if (choice.finish_reason === 'length') {
              finishReason = 'length';
            } else if (choice.finish_reason === 'content_filter') {
              finishReason = 'content_filter';
            } else {
              finishReason = 'stop';
            }
          }
        }

        if (chunk.usage) {
          inputTokens = chunk.usage.prompt_tokens ?? 0;
          outputTokens = chunk.usage.completion_tokens ?? 0;
          totalTokens = chunk.usage.total_tokens ?? 0;
          const reasoning =
            chunk.usage.completion_tokens_details?.reasoning_tokens;
          if (reasoning !== undefined) thinkingTokens = reasoning;
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
        totalTokens,
        ...(thinkingTokens !== undefined && { thinkingTokens }),
      },
      model,
      finishReason,
    };
  }
}
