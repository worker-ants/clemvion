import {
  GoogleGenAI,
  type Content,
  type FunctionCall,
  type GenerateContentConfig,
  type GenerateContentResponse,
  type Part,
} from '@google/genai';
import { Logger } from '@nestjs/common';

/**
 * Subset of the Gemini stream chunk shape we actually consume. Keeping this
 * named rather than an anonymous cast means SDK upgrades that rename/drop
 * these fields surface as compile errors instead of silent `undefined` at
 * runtime.
 */
interface GeminiStreamChunk {
  candidates?: Array<{
    content?: { parts?: Part[] };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
    thoughtsTokenCount?: number;
  };
}

function isGeminiChunk(raw: unknown): raw is GeminiStreamChunk {
  if (!raw || typeof raw !== 'object') return false;
  // candidates / usageMetadata 모두 옵션 — 구조적으로 기대 타입만 확인한다.
  const rec = raw as Record<string, unknown>;
  const c = rec.candidates;
  if (c !== undefined && !Array.isArray(c)) return false;
  const u = rec.usageMetadata;
  if (u !== undefined && (typeof u !== 'object' || u === null)) return false;
  return true;
}
import { randomUUID } from 'node:crypto';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
  ToolCall,
} from '../interfaces/llm-client.interface';
import {
  resolveGeminiTaskType,
  type EmbedInputType,
} from '../embedding-input-type';

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

// Gemini 는 이전 SDK 세대에서 tool_call 에 id 를 부여하지 않았다. 신 SDK
// (`@google/genai`) 는 `FunctionCall.id` 를 선택적으로 돌려주지만 아직 많은
// 모델이 채우지 않으므로 id 가 없으면 클라이언트 측에서 uuid 로 생성한다.
function generateToolCallId(): string {
  return `call_${randomUUID()}`;
}

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

// Gemini 의 FunctionDeclarationSchema 는 OpenAPI 3.0 Schema 서브셋만 허용한다.
// OpenAI/Anthropic 이 허용하는 JSON Schema 확장 키워드(`additionalProperties`,
// `default`, `minimum`/`maximum`, 미지원 `format` 등)가 들어 있으면 API 가 400 을
// 반환하므로, Google 로 보내기 전에 재귀적으로 필터링한다.
// 또한 Gemini ObjectSchema 는 `properties` 가 비어 있으면 거부하므로, 인자 없는
// tool 은 `parameters` 자체를 생략한다.
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
    if (!items) return null;
    out.items = items;
    if (typeof source.minItems === 'number') out.minItems = source.minItems;
    if (typeof source.maxItems === 'number') out.maxItems = source.maxItems;
  }

  return out;
}

export class GoogleClient implements LLMClient {
  private readonly ai: GoogleGenAI;
  private readonly logger = new Logger(GoogleClient.name);

  constructor(
    apiKey: string,
    private readonly defaultModel: string,
  ) {
    this.ai = new GoogleGenAI({ apiKey });
  }

  private buildToolConfig(params: ChatParams):
    | Array<{
        functionDeclarations: Array<{
          name: string;
          description?: string;
          parameters?: Record<string, unknown>;
        }>;
      }>
    | undefined {
    if (!params.tools?.length) return undefined;
    return [
      {
        functionDeclarations: params.tools.map((t) => {
          const parameters = sanitizeGeminiSchema(t.parameters);
          return {
            name: t.name,
            description: t.description,
            ...(parameters ? { parameters } : {}),
          };
        }),
      },
    ];
  }

  private buildGenerationConfig(
    params: ChatParams,
    hasTools: boolean,
    systemInstruction: string,
    signal?: AbortSignal,
  ): GenerateContentConfig {
    // Gemini 는 `responseMimeType: 'application/json'` 과 function calling 도구를
    // 동시에 전달하면 400 을 반환하므로, tools 가 있을 때는 JSON 강제 설정을 건너뛴다.
    const wantJson = params.responseFormat === 'json' && !hasTools;
    const cfg: GenerateContentConfig = {
      ...(params.temperature !== undefined
        ? { temperature: params.temperature }
        : {}),
      ...(params.maxTokens !== undefined
        ? { maxOutputTokens: params.maxTokens }
        : {}),
      ...(params.topP !== undefined ? { topP: params.topP } : {}),
      ...(wantJson ? { responseMimeType: 'application/json' } : {}),
      ...(systemInstruction
        ? {
            systemInstruction: {
              role: 'user',
              parts: [{ text: systemInstruction }],
            },
          }
        : {}),
      ...(signal ? { abortSignal: signal } : {}),
    };
    const tools = this.buildToolConfig(params);
    if (tools) cfg.tools = tools;
    return cfg;
  }

  // ChatMessage 배열을 Gemini contents 로 변환.
  // Gemini 는 3 개의 role 을 쓴다: 'user'(text) · 'model'(assistant) ·
  // 'function'(functionResponse 전용). 같은 role 이 인접하면 하나의 turn 으로 합친다.
  // system role 은 별도 `systemInstruction` 으로 분리해 contents 에 포함되지 않는다.
  private buildContents(params: ChatParams): {
    systemInstruction: string;
    contents: Content[];
  } {
    const systemInstruction = params.messages
      .filter((m) => m.role === 'system')
      .map((m) => m.content)
      .join('\n\n');

    const nonSystem = params.messages.filter((m) => m.role !== 'system');

    // 'tool' 메시지를 functionResponse 로 매핑할 때 name 이 필요하므로
    // assistant.toolCalls 에서 id → name 을 먼저 인덱싱한다.
    const toolNameById = new Map<string, string>();
    for (const m of nonSystem) {
      if (m.role === 'assistant' && m.toolCalls) {
        for (const tc of m.toolCalls) toolNameById.set(tc.id, tc.name);
      }
    }

    const turns: Content[] = [];
    const pushTurn = (role: 'user' | 'model' | 'function', parts: Part[]) => {
      if (parts.length === 0) return;
      const last = turns[turns.length - 1];
      if (last && last.role === role && last.parts) {
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
            // Gemini 2.5+/3.x 의 thought_signature 를 echo 해야 다음 턴에서
            // 동일 모델이 대화 연속성을 유지한다.
            const fcPart: Part = {
              functionCall: {
                name: tc.name,
                args: parseJsonObject(tc.arguments),
                ...(tc.id ? { id: tc.id } : {}),
              },
              ...(tc.signature ? { thoughtSignature: tc.signature } : {}),
            };
            parts.push(fcPart);
          }
        }
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
              ...(m.toolCallId ? { id: m.toolCallId } : {}),
            },
          },
        ]);
      }
    }

    return { systemInstruction, contents: turns };
  }

  async chat(params: ChatParams): Promise<ChatResult> {
    const modelId = params.model || this.defaultModel;
    const { systemInstruction, contents } = this.buildContents(params);

    if (contents.length === 0) {
      return {
        content: null,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelId,
        finishReason: 'stop',
      };
    }

    const hasTools = Boolean(params.tools?.length);
    const config = this.buildGenerationConfig(
      params,
      hasTools,
      systemInstruction,
    );

    const response = await this.ai.models.generateContent({
      model: modelId,
      contents,
      config,
    });

    const toolCalls: ToolCall[] = [];
    let textContent = '';

    for (const candidate of response.candidates || []) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.text) {
          textContent += part.text;
        }
        if (part.functionCall) {
          // Gemini 2.5+/3.x 는 functionCall part 옆에 thoughtSignature 를 별도
          // sibling field 로 실어 보낸다. 다음 turn 에 동일 모델로 functionCall 을
          // echo 할 때 이 signature 를 포함하지 않으면 INVALID_ARGUMENT(400)
          // "Function call is missing a thought_signature" 가 떨어지므로,
          // 여기서 ToolCall.signature 로 끌어올려 multi-turn tool loop 에서
          // 손실되지 않게 한다 (스트리밍 경로는 L455 에서 동일 처리).
          toolCalls.push(
            fnCallToToolCall(part.functionCall, part.thoughtSignature),
          );
        }
      }
    }

    const finishReason: ChatResult['finishReason'] =
      toolCalls.length > 0 ? 'tool_calls' : 'stop';

    const usageMeta = response.usageMetadata;
    const thoughtsTokens = usageMeta?.thoughtsTokenCount;

    return {
      content: textContent || null,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: usageMeta?.promptTokenCount ?? 0,
        outputTokens: usageMeta?.candidatesTokenCount ?? 0,
        totalTokens: usageMeta?.totalTokenCount ?? 0,
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
    const { systemInstruction, contents } = this.buildContents(params);

    if (contents.length === 0) {
      yield {
        type: 'done',
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
        model: modelId,
        finishReason: 'stop',
      };
      return;
    }

    const hasTools = Boolean(params.tools?.length);
    const config = this.buildGenerationConfig(
      params,
      hasTools,
      systemInstruction,
      signal,
    );

    let stream: AsyncGenerator<GenerateContentResponse>;
    try {
      stream = await this.ai.models.generateContentStream({
        model: modelId,
        contents,
        config,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown stream error';
      yield { type: 'error', code: classifyStreamError(message), message };
      return;
    }

    let inputTokens = 0;
    let outputTokens = 0;
    let totalTokens = 0;
    let thinkingTokens: number | undefined;
    let finishReason: ChatResult['finishReason'] | 'aborted' = 'stop';
    let toolCallCount = 0;

    try {
      for await (const raw of stream) {
        if (signal?.aborted) {
          finishReason = 'aborted';
          break;
        }

        if (!isGeminiChunk(raw)) {
          // 형태가 예상과 다르면 조용히 무시하면 상위에서 "응답 없음" 으로 오독될 수
          // 있으므로 로그만 남기고 계속 진행. 실 청크가 비어 있는 경우(예: 안전필터
          // 제거)와 구분하기 위해 경고 레벨로만 기록.
          this.logger.warn(
            `Gemini stream chunk did not match expected shape — skipping`,
          );
          continue;
        }
        const chunk: GeminiStreamChunk = raw;

        for (const candidate of chunk.candidates ?? []) {
          for (const part of candidate.content?.parts ?? []) {
            if (part.text) {
              yield { type: 'text_delta', delta: part.text };
            } else if (part.functionCall) {
              // Gemini 는 functionCall 인자를 partial JSON 으로 쪼개지 않고 한 번에
              // 완결된 객체로 내려준다. OpenAI/Anthropic 처럼 fragment 를 누적할
              // 필요가 없으므로 같은 turn 에 tool_call_delta + tool_call_end 를
              // 즉시 emit 한다.
              const fc = part.functionCall;
              const id = fc.id || generateToolCallId();
              const name = fc.name || '';
              const args = JSON.stringify(fc.args ?? {});
              const signature = part.thoughtSignature;
              toolCallCount++;
              yield {
                type: 'tool_call_delta',
                id,
                name,
                argumentsDelta: args,
              };
              yield {
                type: 'tool_call_end',
                id,
                name,
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

        const usageMeta = chunk.usageMetadata;
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
        yield { type: 'error', code: classifyStreamError(message), message };
        return;
      }
    }

    if (toolCallCount > 0 && finishReason === 'stop') {
      finishReason = 'tool_calls';
    }

    const finalTotal = totalTokens || inputTokens + outputTokens;
    // 신 SDK 는 스트림 마지막 청크에 usage 를 싣는 것이 공식 계약이지만 일부
    // 모델 조합에서 누락이 관찰될 수 있으므로 경고 로그로 관측 가능케 한다.
    // 과금·컨텍스트 관리에 영향. abort 경우는 usage 불완전이 정상이라 제외.
    if (finalTotal === 0 && finishReason !== 'aborted') {
      this.logger.warn(
        `Gemini stream completed without usageMetadata (model=${modelId})`,
      );
    }

    yield {
      type: 'done',
      usage: {
        inputTokens,
        outputTokens,
        totalTokens: finalTotal,
        ...(thinkingTokens !== undefined && { thinkingTokens }),
      },
      model: modelId,
      finishReason,
    };
  }

  async embed(
    texts: string[],
    model?: string,
    inputType: EmbedInputType = 'document',
  ): Promise<number[][]> {
    // Gemini 는 텍스트 변형이 아니라 taskType 파라미터로 비대칭 검색을 지원한다
    // (RETRIEVAL_QUERY / RETRIEVAL_DOCUMENT). 이를 누락하면 색인은 되지만
    // 회수 품질이 조용히 떨어진다.
    const response = await this.ai.models.embedContent({
      model: model || 'text-embedding-004',
      contents: texts,
      config: { taskType: resolveGeminiTaskType(inputType) },
    });
    const embeddings = response.embeddings ?? [];
    // Knowledge Base 파이프라인이 입력 순서에 맞춰 벡터를 저장하므로 길이·내용
    // 불일치가 silent 로 넘어가면 안 된다. 신 SDK 공식 문서상 배치 순서는 보장
    // 되지만 빈 `values` / 개수 누락은 방어적으로 에러로 처리.
    if (embeddings.length !== texts.length) {
      throw new Error(
        `Google embed returned ${embeddings.length} vectors for ${texts.length} inputs`,
      );
    }
    return embeddings.map((e, idx) => {
      if (!e.values || e.values.length === 0) {
        throw new Error(`Google embed returned empty vector at index ${idx}`);
      }
      return e.values;
    });
  }

  async listModels(signal?: AbortSignal): Promise<ModelInfo[]> {
    // Gemini 는 수백 개 모델을 반환할 수 있어 반복적인 HTTP 요청이 누적된다.
    // UI 드롭다운 용도로는 100개면 충분하므로 초과분은 잘라낸다. 100개 도달 시
    // 로컬 `inner` controller 를 abort 해 pager 가 다음 페이지 HTTP 요청을
    // 즉시 중단하도록 한다. 외부 `signal` 이 abort 되면 `inner` 도 함께 abort.
    const MAX_MODELS = 100;
    const inner = new AbortController();
    const onExternalAbort = () => inner.abort();
    signal?.addEventListener('abort', onExternalAbort, { once: true });
    try {
      const pager = await this.ai.models.list({
        config: { abortSignal: inner.signal },
      });
      const models: ModelInfo[] = [];
      for await (const m of pager) {
        if (models.length >= MAX_MODELS) {
          inner.abort();
          break;
        }
        const rawName = m.name ?? '';
        if (!rawName) continue;
        // Gemini API 는 `models/<id>` 형태의 리소스 이름을 돌려주므로 prefix 제거.
        const id = rawName.startsWith('models/')
          ? rawName.slice('models/'.length)
          : rawName;
        const actions = m.supportedActions ?? [];
        const supportsGenerate = actions.includes('generateContent');
        const supportsEmbed = actions.includes('embedContent');
        if (!supportsGenerate && !supportsEmbed) continue;
        const type: ModelInfo['type'] = supportsGenerate ? 'chat' : 'embedding';
        models.push({ id, name: m.displayName || id, type });
      }
      return models;
    } finally {
      signal?.removeEventListener('abort', onExternalAbort);
    }
  }

  async testConnection(): Promise<boolean> {
    await this.ai.models.generateContent({
      model: this.defaultModel || 'gemini-2.0-flash',
      contents: [{ role: 'user', parts: [{ text: 'test' }] }],
    });
    return true;
  }
}

function fnCallToToolCall(
  fc: FunctionCall,
  thoughtSignature?: string,
): ToolCall {
  return {
    id: fc.id || generateToolCallId(),
    name: fc.name || '',
    arguments: JSON.stringify(fc.args ?? {}),
    ...(typeof thoughtSignature === 'string' && thoughtSignature
      ? { signature: thoughtSignature }
      : {}),
  };
}
