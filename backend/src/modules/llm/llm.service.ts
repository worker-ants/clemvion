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

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly clientCache = new Map<string, LLMClient>();

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
  }

  async chat(
    config: LlmConfig,
    params: ChatParams,
    context?: LlmCallContext,
  ): Promise<ChatResult> {
    const client = this.createClient(config);
    const result = await this.withRetry(() => client.chat(params));
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
  ): Promise<number[][]> {
    const client = this.createClient(config);
    // Batch embed in chunks of 20
    const batchSize = 20;
    const allEmbeddings: number[][] = [];
    for (let i = 0; i < texts.length; i += batchSize) {
      const batch = texts.slice(i, i + batchSize);
      const embeddings = await this.withRetry(() => client.embed(batch, model));
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
  ): Promise<ModelInfo[]> {
    const config = await this.llmConfigService.findEntity(
      configId,
      workspaceId,
    );
    const client = this.createClient(config);
    try {
      return await withTimeout(
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
        message: 'No LLM config specified and no default provider configured',
      });
    }
    return defaultConfig;
  }

  private async withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
    let lastError: Error | undefined;
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        const isRateLimit =
          lastError.message.includes('429') ||
          lastError.message.toLowerCase().includes('rate limit');
        if (!isRateLimit || attempt === maxRetries) {
          throw lastError;
        }
        const delay = Math.pow(2, attempt) * 1000;
        this.logger.warn(
          `Rate limited, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries})`,
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
    throw lastError || new Error('Max retries exceeded');
  }
}
