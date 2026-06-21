import {
  Injectable,
  Logger,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ModelConfigService } from '../model-config/model-config.service';
import { ModelConfig } from '../model-config/entities/model-config.entity';
import { LLMClientFactory } from './llm-client.factory';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ChatStreamEvent,
  ModelInfo,
} from './interfaces/llm-client.interface';
import type { EmbedInputType } from './embedding-input-type';
import { extractRetryAfterMs } from '../../shared/utils/retry-after';
import { LlmUsageLogService } from './llm-usage-log.service';
import { StubLlmClient } from './clients/stub.client';
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
    private readonly modelConfigService: ModelConfigService,
    private readonly clientFactory: LLMClientFactory,
    private readonly usageLogService: LlmUsageLogService,
    // refactor M-6 (review W1): `@Optional()` — IntegrationOAuthService·McpClientService 와
    // 동일 규약. 프로덕션 NestJS DI 경로는 항상 ConfigService 를 주입하고, `@Optional()` 은
    // 수동 생성 레거시 테스트 호환 목적이다. 미주입 시 `llm.stubMode` 는 undefined→OFF(프로덕션 동작).
    @Optional() private readonly configService?: ConfigService,
  ) {}

  createClient(config: ModelConfig): LLMClient {
    // 테스트 전용(`OAUTH_STUB_MODE` 선례) — dockerized e2e 가 실제 LLM 키/호출 없이
    // 멀티턴 AI park→재개(§4.x turn-park, §7.5 rehydration)를 결정적으로 검증하도록,
    // ConfigService(`llm.stubMode`, env `LLM_STUB_MODE` 유래)가 ON 이면 결정적 stub
    // 클라이언트를 반환한다. 프로덕션(env 미설정 + main.ts 부팅 가드)에는 절대 활성화되지
    // 않는다. **캐시 체크보다 앞**에 둬 stub 이 항상 우선하도록 한다(실 클라이언트가 먼저
    // 캐시된 상태에서의 오염 방지 — review W5/I7). SoT: spec/5-system/7-llm-client.md §7.1.
    if (this.configService?.get<boolean>('llm.stubMode')) {
      const cachedStub = this.clientCache.get(config.id);
      if (cachedStub instanceof StubLlmClient) {
        return cachedStub;
      }
      const stub = new StubLlmClient();
      this.clientCache.set(config.id, stub);
      return stub;
    }

    const cached = this.clientCache.get(config.id);
    if (cached) {
      return cached;
    }

    // chat config 는 항상 키가 있으므로 평문 문자열. local provider 만 null → '' 폴백.
    const apiKey = this.modelConfigService.getDecryptedApiKey(config) ?? '';
    const client = this.clientFactory.create({
      provider: config.provider,
      apiKey,
      defaultModel: config.defaultModel,
      // ModelConfig.baseUrl 는 nullable(string|null) — 팩토리는 string|undefined 기대.
      baseUrl: config.baseUrl ?? undefined,
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
    config: ModelConfig,
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
    config: ModelConfig,
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

  /**
   * 배치 임베딩. 20개 단위로 chunking 해 client 에 위임한다.
   * @param config - LlmConfig 엔티티 (provider·credential 포함).
   * @param texts - 임베딩할 텍스트 배열.
   * @param model - 임베딩 모델 ID. 생략 시 provider 기본값.
   * @param opts - 타임아웃·내부 재시도 제어. `undefined` = 기본(재시도 ON, 타임아웃 없음).
   * @param inputType - 비대칭 모델 힌트. 기본값 `'document'`(적재 경로). 검색 query 경로만 `'query'`.
   */
  async embed(
    config: ModelConfig,
    texts: string[],
    model?: string,
    opts?: Pick<LlmCallOptions, 'timeoutMs' | 'disableInnerRetry'>,
    inputType: EmbedInputType = 'document',
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
          ? withTimeout(
              () => client.embed(batch, model, inputType),
              opts.timeoutMs,
            )
          : client.embed(batch, model, inputType);
      const embeddings = await (opts?.disableInnerRetry
        ? run()
        : this.withRetry(run));
      allEmbeddings.push(...embeddings);
    }
    return allEmbeddings;
  }

  /**
   * 모델 설정 연결을 테스트한다.
   *
   * - kind=chat / kind=rerank: `client.testConnection()` 직접 호출.
   *   rerank UI 는 테스트 버튼을 표시하지 않지만(showTest=kind!=='rerank'),
   *   POST :id/test 직접 호출 시에도 chat 과 동일 경로(testConnection)를 사용한다.
   *   rerank provider 는 LLM clientFactory 에 등록되지 않으므로 graceful 실패한다.
   * - kind=embedding: `client.embed(['connection test'], model)` probe 로 검증.
   *   probe 반환 벡터 길이를 감지 차원(`dimension`)으로 응답에 포함한다.
   *   차원 0 또는 빈 배열이면 `dimension` 필드를 생략한다.
   *
   * @returns `{ success, dimension? }` — dimension 은 kind=embedding 이고 probe 성공 시만 포함.
   */
  async testConnection(
    configId: string,
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string; dimension?: number }> {
    try {
      // kind 무관 조회 — /models 통합 관리 UI 는 chat/embedding/rerank 어떤
      // 설정이든 테스트한다. kind='chat' 고정 조회는 embedding 설정을
      // MODEL_CONFIG_NOT_FOUND 로 거부했다(회귀).
      const config = await this.modelConfigService.findEntity(
        configId,
        workspaceId,
      );
      const client = this.createClient(config);
      if (config.kind === 'embedding') {
        // 임베딩은 probe embed 로 연결을 검증하고, 반환 벡터 길이로 차원을 감지한다.
        const vectors = await client.embed(
          ['connection test'],
          config.defaultModel,
        );
        const dimension = vectors[0]?.length;
        return dimension ? { success: true, dimension } : { success: true };
      }
      // chat · rerank 공통 경로: client.testConnection() 직접 호출.
      // UI 가드(showTest=kind!=='rerank')로 rerank 는 버튼이 숨겨지지만,
      // API 직접 호출 시에도 이 경로를 통한다. rerank provider 는
      // clientFactory 에 없어 graceful 실패(catch → { success: false }).
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
      // kind 무관 조회 — embedding/rerank 설정의 모델 목록도 동일 경로로 조회한다
      // (chat 고정 조회는 embedding 편집 시 모델 목록 로드를 깨뜨렸다).
      const config = await this.modelConfigService.findEntity(
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
  ): Promise<ModelConfig> {
    if (llmConfigId && llmConfigId.trim()) {
      return this.modelConfigService.findEntity(
        llmConfigId,
        workspaceId,
        'chat',
      );
    }
    const defaultConfig = await this.modelConfigService.findDefault(
      workspaceId,
      'chat',
    );
    if (!defaultConfig) {
      throw new BadRequestException({
        code: 'MODEL_CONFIG_DEFAULT_MISSING',
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
   * 등록 embedding ModelConfig(kind=embedding) 해석 — config + 모델명을 반환한다.
   * agent_memory / KB 가 `embeddingModelConfigId` 로 임베딩 출처를 단일 해석하는
   * 경로(ModelConfigService.resolveEmbedding)를 LlmService 표면으로 노출한다
   * (resolveConfig 가 kind=chat 고정이라 임베딩엔 부적합 — 호출부 DI 단순화 목적).
   * 미지정 시 워크스페이스 기본 kind=embedding ModelConfig 로 폴백한다.
   */
  async resolveEmbedding(
    embeddingModelConfigId: string | undefined | null,
    workspaceId: string,
  ): Promise<{ config: ModelConfig; model: string }> {
    return this.modelConfigService.resolveEmbedding({
      embeddingModelConfigId: embeddingModelConfigId ?? undefined,
      workspaceId,
    });
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
    const config = await this.modelConfigService.findDefault(
      workspaceId,
      'chat',
    );
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

// refactor M-9: `extractRetryAfterMs` 는 `shared/utils/retry-after.ts` 로 이동
// (재발 차단 위해 re-export 두지 않음). 위 retry 루프는 import 한 함수를 사용.
