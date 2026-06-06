import OpenAI from 'openai';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';
import {
  applyEmbeddingInputPrefix,
  type EmbedInputType,
} from '../embedding-input-type';

/**
 * gpt-oss / Harmony 포맷 제어 토큰. OpenAI 가 공식 제공하는 상위 모델에서는
 * 나오지 않지만, 같은 OpenAI 호환 인터페이스를 쓰는 로컬/오픈소스 서빙
 * (llama.cpp, vLLM 등으로 띄운 gpt-oss-120b 등) 에서 종종 출력에 섞여 내려와
 * SSE chunk content / tool_call arguments 를 오염시킨다.
 *
 * Harmony 포맷 참고 (https://github.com/openai/harmony):
 *  - `<|channel|>CHANNEL_NAME<|message|>...` : 채널 전환 preamble (CHANNEL_NAME
 *    은 bare 토큰 `final` / `commentary` / `analysis` 등).
 *  - 단독 제어 토큰: `<|start|>`, `<|end|>`, `<|return|>`, `<|constrain|>`.
 *
 * 처리 전략은 2단계:
 *  1) 스트리밍 중 `delta.content` / tool_call args 에서 이 토큰을 **그대로 제거**
 *     → 다운스트림 (assistant SSE · 프론트 뷰) 에 노출되지 않게 한다.
 *  2) OpenAI SDK 가 SSE chunk 자체를 파싱하지 못해 throw 하는 경우 (이미 늦은
 *     시점), catch 블록에서 에러 메세지를 sniff 해 `LLM_OUTPUT_MALFORMED` 로
 *     분류하고 사용자 친화적 메세지로 치환한다.
 */
// 채널 preamble 전체: `<|channel|>channel_name<|message|>` 을 한 번에 제거 —
// channel_name 자체가 delimiter 밖에 bare text 로 나오기 때문에 단순 delimiter
// 제거만으로는 "final" / "commentary" 같은 잔여물이 남는다.
const HARMONY_CHANNEL_PREAMBLE_REGEX = /<\|channel\|>[\s\S]*?<\|message\|>/g;
// 남은 단독 제어 토큰: `<|start|>`, `<|end|>`, `<|return|>`, `<|constrain|>`,
// 예외적으로 고립된 `<|channel|>`/`<|message|>` 등.
const HARMONY_STANDALONE_TOKEN_REGEX =
  /<\|(?:channel|start|end|message|return|constrain|system|developer|user|assistant|tool)\|>/g;

/**
 * 스트리밍 content/arguments 조각에서 harmony 제어 토큰과 채널 preamble 을
 * 제거. 원문 의미는 그대로, 구조 토큰만 stripping.
 */
function stripHarmonyTokens(input: string): string {
  if (!input) return input;
  if (input.indexOf('<|') < 0) return input;
  return input
    .replace(HARMONY_CHANNEL_PREAMBLE_REGEX, '')
    .replace(HARMONY_STANDALONE_TOKEN_REGEX, '');
}

/**
 * SDK 파싱 실패 에러 메세지가 harmony 토큰 오염 케이스인지 판정.
 * openai SDK 는 `Failed to parse input at pos N: <|channel|>...` 형태로 throw.
 */
function isHarmonyParseError(message: string): boolean {
  return /<\|(channel|start|message|end|return)\|>/.test(message);
}

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

  async chat(params: ChatParams, signal?: AbortSignal): Promise<ChatResult> {
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

    const response = await this.client.chat.completions.create(
      requestParams,
      signal ? { signal } : undefined,
    );
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

  async embed(
    texts: string[],
    model?: string,
    inputType: EmbedInputType = 'document',
  ): Promise<number[][]> {
    // OpenAI native(text-embedding-3 등)는 대칭이라 no-op. self-host e5 계열을
    // OpenAI 호환 엔드포인트로 서빙하는 경우만 query:/passage: 접두사가 붙는다.
    const input = applyEmbeddingInputPrefix(texts, model, inputType);
    const response = await this.client.embeddings.create({
      model: model || 'text-embedding-3-small',
      input,
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
            const cleaned = stripHarmonyTokens(delta.content);
            if (cleaned) yield { type: 'text_delta', delta: cleaned };
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
              const argsFragment = stripHarmonyTokens(
                tc.function?.arguments ?? '',
              );
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
        const code = message.includes('429')
          ? 'LLM_RATE_LIMIT'
          : isHarmonyParseError(message)
            ? 'LLM_OUTPUT_MALFORMED'
            : 'LLM_CONNECTION_ERROR';
        // harmony 토큰 오염 케이스는 사용자에게 원본 메세지를 그대로 보여주면
        // 혼란스럽다 (내부 제어 토큰이 그대로 노출되어 깨진 텍스트처럼 보임).
        // 사용자는 "서비스/설정 문제" 로 인식할 수 있는 톤의 안내문으로 치환한다.
        // raw 메세지는 서버 로그에만 남긴다 (throw 위치에서 이미 기록됨).
        const userMessage =
          code === 'LLM_OUTPUT_MALFORMED'
            ? '모델이 내부 harmony 제어 토큰을 응답에 노출해 처리를 중단했어요. 오픈소스 모델(gpt-oss 계열) 의 chat template 설정 문제일 수 있습니다. 다른 모델(OpenAI / Anthropic / Google) 로 전환하거나 서빙 설정을 확인해 주세요.'
            : message;
        yield { type: 'error', code, message: userMessage };
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
