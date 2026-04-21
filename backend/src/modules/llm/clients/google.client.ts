import {
  GoogleGenerativeAI,
  GenerativeModel,
  Content,
  Part,
} from '@google/generative-ai';
import { randomUUID } from 'node:crypto';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';

const GOOGLE_MODELS: ModelInfo[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'chat' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'chat' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'chat' },
  {
    id: 'text-embedding-004',
    name: 'Text Embedding 004',
    type: 'embedding',
  },
];

interface GoogleUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  totalTokenCount?: number;
  thoughtsTokenCount?: number;
}

function mapGoogleFinishReason(
  reason: string | undefined,
): ChatResult['finishReason'] {
  switch (reason) {
    case 'MAX_TOKENS':
      return 'length';
    case 'SAFETY':
    case 'RECITATION':
    case 'BLOCKLIST':
    case 'PROHIBITED_CONTENT':
    case 'SPII':
      return 'content_filter';
    default:
      return 'stop';
  }
}

function classifyStreamError(message: string): string {
  return message.includes('429') ? 'LLM_RATE_LIMIT' : 'LLM_CONNECTION_ERROR';
}

// Gemini는 tool_call에 id를 부여하지 않으므로 클라이언트 측에서 생성한다.
// `randomUUID()`로 충돌 가능성을 사실상 0으로 만들고 같은 형식을 chat/stream
// 양쪽이 공유한다.
function generateToolCallId(): string {
  return `call_${randomUUID()}`;
}

// FunctionCall.args는 object여야 하므로 JSON 파싱 실패 시 빈 object를 반환.
function parseJsonObject(raw: string | undefined): Record<string, unknown> {
  if (!raw) return {};
  try {
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

// FunctionResponse.response는 object여야 한다. tool 결과가 문자열/배열/스칼라인
// 경우는 `{ result: ... }`로 래핑해 Gemini가 수용 가능한 형태로 만든다.
function toFunctionResponseObject(content: string): Record<string, unknown> {
  if (!content) return { result: '' };
  try {
    const parsed: unknown = JSON.parse(content);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    return { result: parsed };
  } catch {
    return { result: content };
  }
}

// Gemini의 FunctionDeclarationSchema는 OpenAPI 3.0 Schema 서브셋만 허용한다.
// OpenAI/Anthropic이 허용하는 JSON Schema 확장 키워드(`additionalProperties`,
// `default`, `minimum`/`maximum`, 미지원 `format` 등)가 들어 있으면 API가 400을
// 반환하므로, Google로 보내기 전에 재귀적으로 필터링한다.
// 또한 Gemini ObjectSchema는 `properties`가 비어 있으면 거부하므로, 인자 없는
// tool은 `parameters` 자체를 생략한다.
const GEMINI_ALLOWED_NUMBER_FORMATS = new Set(['float', 'double']);
const GEMINI_ALLOWED_INTEGER_FORMATS = new Set(['int32', 'int64']);
const GEMINI_ALLOWED_STRING_FORMATS = new Set(['enum', 'date-time']);

function sanitizeGeminiSchema(input: unknown): Record<string, unknown> | null {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return null;

  const source = input as Record<string, unknown>;
  const type = source.type;
  if (typeof type !== 'string') return null;

  const out: Record<string, unknown> = { type };

  if (typeof source.description === 'string') {
    out.description = source.description;
  }
  if (typeof source.nullable === 'boolean') {
    out.nullable = source.nullable;
  }

  if (Array.isArray(source.enum)) {
    out.enum = source.enum.filter((v) => typeof v === 'string');
  }

  if (typeof source.format === 'string') {
    const fmt = source.format;
    const ok =
      (type === 'number' && GEMINI_ALLOWED_NUMBER_FORMATS.has(fmt)) ||
      (type === 'integer' && GEMINI_ALLOWED_INTEGER_FORMATS.has(fmt)) ||
      (type === 'string' && GEMINI_ALLOWED_STRING_FORMATS.has(fmt));
    if (ok) out.format = fmt;
  }

  if (type === 'object') {
    const props = source.properties;
    const sanitizedProps: Record<string, unknown> = {};
    if (props && typeof props === 'object' && !Array.isArray(props)) {
      for (const [key, value] of Object.entries(
        props as Record<string, unknown>,
      )) {
        const sub = sanitizeGeminiSchema(value);
        if (sub) sanitizedProps[key] = sub;
      }
    }
    // Gemini는 ObjectSchema.properties가 비어 있으면 거부하므로, 속성이
    // 하나도 남지 않았다면 null 반환 → 상위에서 parameters 자체를 생략한다.
    if (Object.keys(sanitizedProps).length === 0) return null;
    out.properties = sanitizedProps;

    if (Array.isArray(source.required)) {
      const keys = new Set(Object.keys(sanitizedProps));
      out.required = source.required.filter(
        (k) => typeof k === 'string' && keys.has(k),
      );
      if ((out.required as string[]).length === 0) delete out.required;
    }
  } else if (type === 'array') {
    const items = sanitizeGeminiSchema(source.items);
    // Gemini ArraySchema는 items가 필수이므로, items가 sanitize 결과 빈
    // schema가 되면 array 자체를 drop한다.
    if (!items) return null;
    out.items = items;
    if (typeof source.minItems === 'number') out.minItems = source.minItems;
    if (typeof source.maxItems === 'number') out.maxItems = source.maxItems;
  }

  return out;
}

export class GoogleClient implements LLMClient {
  private readonly genAI: GoogleGenerativeAI;

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.genAI = new GoogleGenerativeAI(apiKey);
  }

  private getModel(modelId: string, params: ChatParams): GenerativeModel {
    const tools: any[] = [];
    if (params.tools?.length) {
      tools.push({
        functionDeclarations: params.tools.map((t) => {
          const parameters = sanitizeGeminiSchema(t.parameters);
          return {
            name: t.name,
            description: t.description,
            // 인자 없는 tool은 parameters를 생략. Gemini는 빈 properties를
            // 가진 ObjectSchema를 거부한다.
            ...(parameters ? { parameters } : {}),
          };
        }),
      });
    }

    // Gemini는 `responseMimeType: 'application/json'`과 function calling 도구를
    // 동시에 전달하면 400을 반환하므로, tools가 있을 때는 JSON 강제 설정을
    // 건너뛴다. (도구 호출 결과 자체가 이미 structured output)
    const wantJson = params.responseFormat === 'json' && tools.length === 0;

    return this.genAI.getGenerativeModel({
      model: modelId,
      generationConfig: {
        temperature: params.temperature,
        maxOutputTokens: params.maxTokens,
        topP: params.topP,
        ...(wantJson ? { responseMimeType: 'application/json' } : {}),
      },
      ...(tools.length ? { tools } : {}),
    });
  }

  // chat()과 stream()이 공유하는 메시지 변환 규칙.
  // Gemini API의 요구사항은 OpenAI/Anthropic과 다음 측면에서 다르다:
  //   1) system role은 별도 `systemInstruction`으로 분리
  //   2) assistant의 tool 호출은 text가 아닌 `{functionCall: {name, args}}` part,
  //      tool 결과는 `{functionResponse: {name, response}}` part로 표현해야 함
  //      (text로 보내면 LLM이 이전 호출·결과를 인식하지 못해 같은 도구를 반복
  //       호출하는 loop에 빠진다)
  //   3) Gemini는 3개의 role을 사용한다: 'user'(text) · 'model'(assistant) ·
  //      'function'(functionResponse 전용). 같은 role이 인접하면 하나의
  //      Content(turn)로 합친다 (§pushTurn).
  private buildChatInputs(params: ChatParams): {
    systemInstruction: string;
    history: Content[];
    lastParts: Part[] | undefined;
  } {
    const systemInstruction = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const nonSystem = params.messages.filter((m) => m.role !== 'system');

    // role: 'tool' 메시지는 Gemini functionResponse로 변환할 때 name이 필요한데
    // ChatMessage에는 toolCallId만 있으므로 assistant.toolCalls에서 id→name을
    // 미리 인덱싱한다.
    const toolNameById = new Map<string, string>();
    for (const m of nonSystem) {
      if (m.role === 'assistant' && m.toolCalls) {
        for (const tc of m.toolCalls) toolNameById.set(tc.id, tc.name);
      }
    }

    // Gemini role 규칙 (SDK index.js:938-961, Google REST API v1):
    //   - 'user'    : 일반 text · user-provided inline/file data
    //   - 'model'   : assistant 응답 (text + functionCall)
    //   - 'function': functionResponse 전용. `role:'user'`에 넣으면 3.x는
    //                 "Content with role 'user' can't contain 'functionResponse'
    //                 part" 400을 반환한다.
    // 따라서 ChatMessage의 `role: 'tool'`은 Gemini의 `role: 'function'` turn으로
    // 매핑한다. 이 구분이 있으면 (a) functionResponse가 다른 part와 섞일 일이
    // 없고 (b) user/model/function 간 alternation도 자연스럽게 구성된다.
    const turns: Array<{
      role: 'user' | 'model' | 'function';
      parts: Part[];
    }> = [];
    const pushTurn = (role: 'user' | 'model' | 'function', parts: Part[]) => {
      if (parts.length === 0) return;
      const last = turns[turns.length - 1];
      if (last && last.role === role) {
        last.parts.push(...parts);
      } else {
        turns.push({ role, parts });
      }
    };

    for (const m of nonSystem) {
      if (m.role === 'user') {
        pushTurn('user', [{ text: m.content }]);
      } else if (m.role === 'assistant') {
        const parts: Part[] = [];
        if (m.content) parts.push({ text: m.content });
        if (m.toolCalls) {
          for (const tc of m.toolCalls) {
            // Gemini의 FunctionCallPart에 `thoughtSignature`를 함께 echo해야
            // 2.5+/3.x 모델이 다음 턴을 정상 처리한다. SDK 타입에 필드가 없어
            // unknown 경유로 캐스팅한다.
            const fcPart: Record<string, unknown> = {
              functionCall: {
                name: tc.name,
                args: parseJsonObject(tc.arguments),
              },
            };
            if (tc.signature) fcPart.thoughtSignature = tc.signature;
            parts.push(fcPart as unknown as Part);
          }
        }
        // 완전히 빈 assistant turn도 model turn으로 유지해 alternation 보전.
        if (parts.length === 0) parts.push({ text: '' });
        pushTurn('model', parts);
      } else if (m.role === 'tool') {
        const name =
          (m.toolCallId && toolNameById.get(m.toolCallId)) || 'tool_result';
        pushTurn('function', [
          {
            functionResponse: {
              name,
              response: toFunctionResponseObject(m.content),
            },
          },
        ]);
      }
    }

    const last = turns[turns.length - 1];
    // sendMessage(Stream)는 (a) user text 또는 (b) functionResponse 만 담은
    // Part[]를 받는다 (SDK가 내부에서 'user'/'function' role을 자동 할당).
    // 마지막 turn이 'model'이면 보낼 것이 없으므로 빈 상태 반환.
    if (!last || last.role === 'model') {
      return {
        systemInstruction,
        history: turns.map((t) => ({ role: t.role, parts: t.parts })),
        lastParts: undefined,
      };
    }
    return {
      systemInstruction,
      history: turns
        .slice(0, -1)
        .map((t) => ({ role: t.role, parts: t.parts })),
      lastParts: last.parts,
    };
  }

  private startChatSession(
    model: GenerativeModel,
    history: Content[],
    systemInstruction: string,
  ) {
    return model.startChat({
      history,
      ...(systemInstruction
        ? {
            systemInstruction: {
              role: 'user',
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
    });
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const modelId = params.model || this.defaultModel;
    const { systemInstruction, history, lastParts } =
      this.buildChatInputs(params);

    if (!lastParts) {
      return {
        content: null,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelId,
        finishReason: 'stop',
      };
    }

    const model = this.getModel(modelId, params);
    const chat = this.startChatSession(model, history, systemInstruction);

    const result = await chat.sendMessage(lastParts);
    const response = result.response;

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts ?? []) {
        if ('text' in part && part.text) {
          textContent += part.text;
        }
        if ('functionCall' in part && part.functionCall) {
          toolCalls.push({
            id: generateToolCallId(),
            name: part.functionCall.name,
            arguments: JSON.stringify(part.functionCall.args),
          });
        }
      }
    }

    const finishReason: ChatResult['finishReason'] =
      toolCalls.length > 0 ? 'tool_calls' : 'stop';

    const usageMeta = response.usageMetadata as GoogleUsageMetadata | undefined;
    const thoughtsTokens = usageMeta?.thoughtsTokenCount;

    return {
      content: textContent || null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usageMetadata?.promptTokenCount ?? 0,
        outputTokens: response.usageMetadata?.candidatesTokenCount ?? 0,
        totalTokens: response.usageMetadata?.totalTokenCount ?? 0,
        ...(thoughtsTokens !== undefined && { thinkingTokens: thoughtsTokens }),
      },
      model: modelId,
      finishReason,
    };
  }

  async *stream(
    params: ChatParams,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const modelId = params.model || this.defaultModel;
    const { systemInstruction, history, lastParts } =
      this.buildChatInputs(params);

    if (!lastParts) {
      yield {
        type: 'done',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelId,
        finishReason: 'stop',
      };
      return;
    }

    const model = this.getModel(modelId, params);
    const chat = this.startChatSession(model, history, systemInstruction);

    let result: Awaited<ReturnType<typeof chat.sendMessageStream>>;
    try {
      result = await chat.sendMessageStream(
        lastParts,
        signal ? { signal } : undefined,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown stream error';
      yield {
        type: 'error',
        code: classifyStreamError(message),
        message,
      };
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let thinkingTokens: number | undefined;
    let finishReason: ChatResult['finishReason'] | 'aborted' = 'stop';
    let toolCallCount = 0;

    try {
      for await (const chunk of result.stream) {
        if (signal?.aborted) {
          finishReason = 'aborted';
          break;
        }

        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            if ('text' in part && part.text) {
              yield { type: 'text_delta', delta: part.text };
            } else if ('functionCall' in part && part.functionCall) {
              // Gemini는 functionCall 인자를 partial JSON으로 쪼개지 않고 한 번에
              // 완결된 객체로 내려준다. OpenAI/Anthropic처럼 fragment를 누적할 필요가
              // 없으므로 같은 turn에 tool_call_delta + tool_call_end를 즉시 emit한다.
              const fc = part.functionCall;
              const id = generateToolCallId();
              const args = JSON.stringify(fc.args ?? {});
              // Gemini 2.5+/3.x는 `thoughtSignature`를 동반하며 다음 history
              // turn의 동일 functionCall part에 그대로 echo back 해야 한다.
              // SDK 0.24.1 타입에는 노출되어 있지 않지만 runtime payload에는
              // 포함되므로 any 캐스팅으로 추출한다.
              const signature = (part as { thoughtSignature?: unknown })
                .thoughtSignature;
              toolCallCount++;
              yield {
                type: 'tool_call_delta',
                id,
                name: fc.name,
                argumentsDelta: args,
              };
              yield {
                type: 'tool_call_end',
                id,
                name: fc.name,
                arguments: args,
                ...(typeof signature === 'string' && signature
                  ? { signature }
                  : {}),
              };
            }
          }

          if (candidate.finishReason) {
            finishReason = mapGoogleFinishReason(candidate.finishReason);
          }
        }

        const usageMeta = chunk.usageMetadata as
          | GoogleUsageMetadata
          | undefined;
        if (usageMeta) {
          if (usageMeta.promptTokenCount !== undefined) {
            inputTokens = usageMeta.promptTokenCount;
          }
          if (usageMeta.candidatesTokenCount !== undefined) {
            outputTokens = usageMeta.candidatesTokenCount;
          }
          if (usageMeta.totalTokenCount !== undefined) {
            totalTokens = usageMeta.totalTokenCount;
          }
          if (usageMeta.thoughtsTokenCount !== undefined) {
            thinkingTokens = usageMeta.thoughtsTokenCount;
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
          code: classifyStreamError(message),
          message,
        };
        return;
      }
    }

    // tool_call이 한 번이라도 emit되었으면 OpenAI/Anthropic과 동일한 finishReason
    // 표기를 따른다 (Gemini의 candidate.finishReason은 tool 호출 시에도 STOP을 반환).
    if (toolCallCount > 0 && finishReason === 'stop') {
      finishReason = 'tool_calls';
    }

    // 청크에 usageMetadata가 한 번도 실리지 않은 경우, 누적된 response promise에서
    // 한 번 더 시도. abort 상황에서는 응답이 불완전할 수 있으므로 시도하지 않는다.
    if (totalTokens === 0 && finishReason !== 'aborted') {
      try {
        const aggregated = await result.response;
        const usageMeta = aggregated.usageMetadata as
          | GoogleUsageMetadata
          | undefined;
        if (usageMeta) {
          inputTokens = usageMeta.promptTokenCount ?? inputTokens;
          outputTokens = usageMeta.candidatesTokenCount ?? outputTokens;
          totalTokens = usageMeta.totalTokenCount ?? inputTokens + outputTokens;
          if (usageMeta.thoughtsTokenCount !== undefined) {
            thinkingTokens = usageMeta.thoughtsTokenCount;
          }
        }
      } catch {
        // aggregated response 조회 실패는 usage 미보고로 처리 (totalTokens=0).
      }
    }

    // OpenAI/Anthropic 클라이언트와 동일하게, abort/오류 미발생 시뿐 아니라
    // abort된 경우(`finishReason === 'aborted'`)에도 `done` 한 건을 끝에 yield
    // 하여 소비자가 항상 동일한 종료 시점을 받게 한다. 오류로 일찍 종료된 경우만
    // `error` 이벤트 후 early return으로 처리된다.
    yield {
      type: 'done',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: totalTokens || inputTokens + outputTokens,
        ...(thinkingTokens !== undefined && { thinkingTokens }),
      },
      model: modelId,
      finishReason,
    };
  }

  async embed(texts: string[], model?: string): Promise<number[][]> {
    const embeddingModel = this.genAI.getGenerativeModel({
      model: model || 'text-embedding-004',
    });
    const results: number[][] = [];
    for (const text of texts) {
      const result = await embeddingModel.embedContent(text);
      results.push(result.embedding.values);
    }
    return results;
  }

  listModels(): Promise<ModelInfo[]> {
    return Promise.resolve(GOOGLE_MODELS);
  }

  async testConnection(): Promise<boolean> {
    const model = this.genAI.getGenerativeModel({
      model: this.defaultModel || 'gemini-2.0-flash',
    });
    await model.generateContent('test');
    return true;
  }
}
