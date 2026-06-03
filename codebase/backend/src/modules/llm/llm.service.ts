import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { LlmConfig } from '../llm-config/entities/llm-config.entity';
import { LLMClientFactory } from './llm-client.factory';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
} from './interfaces/llm-client.interface';
import { LlmUsageLogService } from './llm-usage-log.service';
import { sanitizeLlmErrorMessage } from './utils/sanitize-error.util';
import { withTimeout } from './utils/with-timeout.util';

const LIST_MODELS_TIMEOUT_MS = 30_000;
const LIST_MODELS_CACHE_TTL_MS = 5 * 60 * 1_000;

interface ListModelsCacheEntry {
  models: ModelInfo[];
  fetchedAt: number;
}

/**
 * LLM 호출 시점의 실행 컨텍스트(선택).
 * `workspaceId`는 `LlmConfig.workspaceId`로 자동 채워지므로 호출부에서 지정 불필요.
 * 워크플로우/실행/노드 단위 귀속이 필요하면 호출부에서 명시한다.
 */
export interface LlmCallContext {
  workflowId?: string | null;
  executionId?: string | null;
  nodeExecutionId?: string | null;
}

/**
 * SUMMARY#10 — `LlmService.chat` / `embed` 호출 옵션 통합 타입.
 * 인라인 리터럴 타입으로 산재하던 opts 를 단일 named type 으로 관리해
 * 호출부의 `undefined` 자리채우기 패턴(context, opts 순서 혼란) 을 방지.
 *
 * SoT: spec/conventions/node-cancellation.md (signal), spec/5-system/3-llm.md.
 */
export interface LlmCallOptions {
  /** 밀리초 단위 타임아웃. 0 또는 미지정 시 타임아웃 없음. */
  timeoutMs?: number;
  /** 호출자 측에서 자체 retry layer 를 보유한 경우 내부 rate-limit 재시도 비활성화. */
  disableInnerRetry?: boolean;
  /**
   * node-cancellation 컨벤션 (2026-05-30) — `ExecutionContext.abortSignal`
   * 을 그대로 SDK 로 전파. Provider HTTP 호출이 abort 시 즉시 throw 되어
   * cancel-others-on-fail / Workflow timeout / 사용자 cancel 의 cleanup
   * 효과가 노드 단계까지 도달. SoT: spec/conventions/node-cancellation.md.
   */
  signal?: AbortSignal;
}

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly clientCache = new Map<string, LLMClient>();
  // 저장 설정 기반 listModels 결과 5분 캐시. key: `${workspaceId}|${configId}`.
  // preview 는 자격증명이 매번 달라 캐시하지 않는다 (spec §5.5).
  private readonly listModelsCache = new Map<string, ListModelsCacheEntry>();

  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly usageLogService: LlmUsageLogService,
  ) {}

  createClient(config: LlmConfig): LLMClient {
    const cached = this.clientCache.get(config.id);
    if (cached) {
      return cached;
    }

    const apiKey = this.llmConfigService.getDecryptedApiKey(config);
    const client = this.clientFactory.create({
      provider: config.provider,
      apiKey,
      defaultModel: config.defaultModel,
      baseUrl: config.baseUrl,
    });

    this.clientCache.set(config.id, client);
    return client;
  }

  clearClientCache(configId: string): void {
    this.clientCache.delete(configId);
    // config 수정/삭제 시 캐시된 모델 목록도 무효화 — 동일 config 의 추후
    // listModels 가 새 자격증명/엔드포인트로 다시 조회하도록 한다.
    for (const key of this.listModelsCache.keys()) {
      if (key.endsWith(`|${configId}`)) this.listModelsCache.delete(key);
    }
  }

  async chat(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
    opts?: LlmCallOptions,
  ): Promise<ChatResult> {
    const client = this.createClient(config);
    // Strip `source` (WebSocket emit metadata per
    // spec/5-system/6-websocket-protocol.md §4.4.6) before forwarding to the
    // provider client — LLM APIs only see the canonical
    // {role, content, toolCalls?, toolCallId?} shape. The handler keeps the
    // marker on its in-memory `messages` array so emit paths preserve it.
    const sanitized: ChatParams = {
      ...params,
      messages: params.messages.map(({ source: _source, ...rest }) => rest),
    };
    // disableInnerRetry: 호출자가 외부에서 retryWithBackoff 같은 자체 재시도 layer 를 가진 경우
    // 내부 rate-limit 재시도 (withRetry) 와 겹쳐 호출 횟수가 비선형 증폭되는 것을 막는다.
    const run = () =>
      opts?.timeoutMs && opts.timeoutMs > 0
        ? // timeoutMs 와 abortSignal 모두 클라이언트 호출에 전달. abort 가 먼저
          // 발화하면 SDK 가 즉시 throw, timeout 이 먼저면 withTimeout race 가 throw.
          withTimeout(
            () => client.chat(sanitized, opts?.signal),
            opts.timeoutMs,
          )
        : client.chat(sanitized, opts?.signal);
    const result = await (opts?.disableInnerRetry
      ? run()
      : this.withRetry(run));
    // 사용량 기록은 fire-and-forget — 실패해도 호출 결과에 영향 없음.
    // workspaceId는 LlmConfig에서 자동 채워지므로 컨텍스트 누락에 무관하게 집계됨.
    void this.usageLogService.record({
      workspaceId: config.workspaceId,
      workflowId: context?.workflowId,
      executionId: context?.executionId,
      nodeExecutionId: context?.nodeExecutionId,
      llmConfigId: config.id,
      provider: config.provider,
      model: result.model,
      usage: result.usage,
    });
    return result;
  }

  async *chatStream(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
    signal?: AbortSignal,
  ): AsyncIterable<ChatStreamEvent> {
    const client = this.createClient(config);
    if (!client.stream) {
      throw new BadRequestException({
        code: 'LLM_STREAMING_UNSUPPORTED',
        message: `Provider '${config.provider}' does not support streaming in this release.`,
      });
    }
    let lastUsage: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
      thinkingTokens?: number;
    } | null = null;
    let lastModel: string = config.defaultModel;
    try {
      for await (const event of client.stream(params, signal)) {
        if (event.type === 'done') {
          lastUsage = event.usage;
          lastModel = event.model;
        }
        yield event;
      }
    } finally {
      // done 이벤트에 usage가 실려왔을 때만 기록. abort/error 시에는 제공자 응답이
      // 불완전할 수 있어 0건으로 기록되는 것을 피한다. fire-and-forget이지만
      // 실패를 silent drop하지 않고 경고 로그를 남긴다.
      if (lastUsage && lastUsage.totalTokens > 0) {
        this.usageLogService
          .record({
            workspaceId: config.workspaceId,
            workflowId: context?.workflowId,
            executionId: context?.executionId,
            nodeExecutionId: context?.nodeExecutionId,
            llmConfigId: config.id,
            provider: config.provider,
            model: lastModel,
            usage: lastUsage,
          })
          ?.catch?.((err: unknown) => {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.warn(`Usage log record failed: ${msg}`);
          });
      }
    }
  }

  async embed(
    config: LlmConfig,
    texts: string[],
    model?: string,
    opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>,
  ): Promise<number[][]> {
    const client = this.createClient(config);
    // Batch embed in chunks of 20
    const batchSize = 20;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      // batch 단위로 timeout 적용 — 한 batch 가 hang 되면 race 로 즉시 reject.
      const run = () =>
        opts?.timeoutMs && opts.timeoutMs > 0
          ? withTimeout(() => client.embed(batch, model), opts.timeoutMs)
          : client.embed(batch, model);
      const embeddings = await (opts?.disableInnerRetry
        ? run()
        : this.withRetry(run));
      allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
  }

  async testConnection(
    configId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const config = await this.llmConfigService.findEntity(
        configId,
        workspaceId,
      );
      const client = this.createClient(config);
      await client.testConnection();
      return { success: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.warn(`LLM connection test failed: ${message}`);
      return { success: false, error: sanitizeLlmErrorMessage(message) };
    }
  }

  async listModels(
    configId: string,
    workspaceId: string,
    opts?: { type?: 'chat' | 'embedding' },
  ): Promise<ModelInfo[]> {
    const cacheKey = `${workspaceId}|${configId}`;
    const cached = this.listModelsCache.get(cacheKey);
    let models: ModelInfo[];
    if (cached && Date.now() - cached.fetchedAt < LIST_MODELS_CACHE_TTL_MS) {
      models = cached.models;
    } else {
      const config = await this.llmConfigService.findEntity(
        configId,
        workspaceId,
      );
      const client = this.createClient(config);
      try {
        models = await withTimeout(
          (signal) => client.listModels(signal),
          LIST_MODELS_TIMEOUT_MS,
        );
      } catch (error) {
        const raw = error instanceof Error ? error.message : String(error);
        const sanitized = sanitizeLlmErrorMessage(raw);
        this.logger.warn(`LLM list models failed: ${sanitized}`);
        throw new BadRequestException({
          code: 'LLM_MODEL_LIST_FAILED',
          message: sanitized,
        });
      }
      this.listModelsCache.set(cacheKey, { models, fetchedAt: Date.now() });
    }

    if (opts?.type === 'chat' || opts?.type === 'embedding') {
      return models.filter((m) => m.type === opts.type);
    }
    return models;
  }

  async resolveConfig(
    llmConfigId: string | undefined,
    workspaceId: string,
  ): Promise<LlmConfig> {
    if (llmConfigId && llmConfigId.trim()) {
      return this.llmConfigService.findEntity(llmConfigId, workspaceId);
    }
    const defaultConfig = await this.llmConfigService.findDefault(workspaceId);
    if (!defaultConfig) {
      throw new BadRequestException({
        code: 'LLM_CONFIG_NOT_FOUND',
        // workspace 어긋남 / 기본값 미설정 / context 누락 을 사용자가 직접
        // 식별할 수 있도록 workspaceId 를 메시지·payload 에 포함한다.
        message: workspaceId
          ? `워크스페이스(${workspaceId}) 에 기본 LLM 이 설정되어 있지 않습니다. LLM 설정 페이지에서 기본 제공자를 지정하거나 노드에서 직접 LLM 을 선택해 주세요.`
          : '실행 컨텍스트에 워크스페이스 정보가 없어 기본 LLM 을 찾을 수 없습니다. 노드에서 LLM 을 직접 선택해 주세요.',
        workspaceId,
      });
    }
    return defaultConfig;
  }

  /**
   * 워크스페이스에 isDefault=true 인 LlmConfig 가 존재하는지만 확인.
   *
   * execution-engine 의 AI 노드 검증 후처리에서, no-llm-provider 규칙을
   * 통과시킬지 여부를 결정하는 데 사용한다. resolveConfig 와 달리 throw 하지
   * 않는다 (presence 체크 전용).
   */
  async hasDefaultLlmConfig(workspaceId: string): Promise<boolean> {
    if (!workspaceId) return false;
    const config = await this.llmConfigService.findDefault(workspaceId);
    return config !== null;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        // AbortError 는 retry 대상이 아님 — abort 이후 LLM retry 낭비 방지
        if (lastError.name === 'AbortError') {
          throw lastError;
        }
        const isRateLimit = isLlmRateLimit(lastError.message);
        if (!isRateLimit || attempt === maxRetries) {
          throw lastError;
        }
        // 2026-05-19 — RFC 7231 Retry-After 헤더가 있으면 provider 가 알려준
        // 최소 대기 시간을 신뢰. 그보다 짧게 retry 하면 같은 429 가 반복되어
        // retry 예산만 소모. 상한 60s 는 그 turn 자체가 stuck 되는 것을 막는
        // 합리적 fallback — 일반적 rate-limit window (1분) 의 경계.
        const MAX_BACKOFF_MS = 60_000;
        const retryAfterMs = extractRetryAfterMs(error);
        const exponentialMs = Math.pow(2, attempt) * 1000;
        const delay =
          retryAfterMs !== null
            ? Math.min(retryAfterMs, MAX_BACKOFF_MS)
            : exponentialMs;
        const source = retryAfterMs !== null ? 'Retry-After' : 'exponential';
        this.logger.warn(
          `Rate limited, retrying in ${delay}ms (${source}, attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Max retries exceeded');
  }
}

/**
 * LLM provider 의 rate-limit 에러 여부 판별 — HTTP 429 또는 "rate limit" 문자열.
 *
 * text-classifier / information-extractor / LlmService.chatWithRetry 세 곳에서
 * 동일한 판별식이 중복 구현되던 것을 단일 함수로 통합한다 (SUMMARY#W5).
 *
 * `message` 는 `Error.message` (string) 또는 임의 에러 값에서 추출한 문자열.
 */
export function isLlmRateLimit(message: string): boolean {
  return (
    message.includes('429') || message.toLowerCase().includes('rate limit')
  );
}

/**
 * Provider SDK 가 throw 한 에러에서 RFC 7231 Retry-After 헤더를 추출해 ms 로
 * 정규화. Anthropic / OpenAI SDK 의 APIError 류는 `headers` 또는
 * `response.headers` 에서 헤더를 노출한다.
 *
 * RFC 7231 §7.1.3:
 *  - delta-seconds: `30`
 *  - HTTP-date: `Mon, 11 Jun 2025 00:00:00 GMT`
 *
 * 양쪽 모두 ms 로 변환. 음수·NaN·parse 실패·헤더 누락 시 null (caller 가
 * exponential fallback 사용).
 *
 * `export` 된 이유: spec 에서 직접 단위 테스트 (delta-seconds / HTTP-date /
 * fallback / 대소문자) 를 작성하기 위함. 그 외 호출자 없음.
 */
export function extractRetryAfterMs(err: unknown): number | null {
  if (!err || typeof err !== 'object') return null;
  const errObj = err as {
    headers?: unknown;
    response?: { headers?: unknown } | null;
  };
  const rawHeaders =
    errObj.headers ??
    (errObj.response && typeof errObj.response === 'object'
      ? errObj.response.headers
      : undefined);
  if (!rawHeaders || typeof rawHeaders !== 'object') return null;
  const headers = rawHeaders as Record<string, unknown>;
  const rawValue =
    headers['retry-after'] ?? headers['Retry-After'] ?? headers['RETRY-AFTER'];
  if (rawValue === undefined || rawValue === null) return null;
  // 헤더 값은 보통 string 이지만 일부 클라이언트가 number / array 로 wrap 해서 반환할 수 있다.
  // string / number 가 아니면 의미 있는 변환이 불가능하므로 null.
  if (typeof rawValue !== 'string' && typeof rawValue !== 'number') return null;
  const str = String(rawValue).trim();
  if (str.length === 0) return null;
  // delta-seconds 우선 시도 (간단한 형식, parseFloat 가 ISO 날짜의 첫 숫자를
  // 잘못 잡지 않도록 Number() 로 strict 변환).
  const seconds = Number(str);
  if (Number.isFinite(seconds)) {
    // 음수 delta-seconds 는 RFC 7231 위반 — fallback 사용. 일부 JS 엔진의
    // `Date.parse('-5')` 가 비표준 결과를 반환할 수 있어 여기서 explicit
    // reject 로 차단.
    if (seconds < 0) return null;
    return Math.floor(seconds * 1000);
  }
  // HTTP-date format — Date.parse 로 epoch ms 환산 후 now 와 차이를 계산.
  const dateMs = Date.parse(str);
  if (Number.isFinite(dateMs)) {
    const delta = dateMs - Date.now();
    return delta > 0 ? delta : 0;
  }
  return null;
}
