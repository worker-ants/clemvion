import OpenAI from 'openai';
import {
  LLMClient,
  ChatParams,
  ChatResult,
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
      messages: messages as OpenAI.Chat.ChatCompletionMessageParam[],
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
    const choice = response.choices?.[0];
    if (!choice?.message) {
      return {
        content: null,
        usage: {
          inputTokens: response.usage?.prompt_tokens ?? 0,
          outputTokens: response.usage?.completion_tokens ?? 0,
          totalTokens: response.usage?.total_tokens ?? 0,
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

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.client.models.list();
    const models: ModelInfo[] = [];
    for await (const m of response) {
      const type = m.id.includes('embedding') ? 'embedding' : 'chat';
      models.push({ id: m.id, name: m.id, type });
    }
    return models.sort((a, b) => a.id.localeCompare(b.id));
  }

  async testConnection(): Promise<boolean> {
    await this.client.models.list();
    return true;
  }
}
