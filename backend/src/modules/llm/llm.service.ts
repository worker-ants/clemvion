import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { LlmConfigService } from '../llm-config/llm-config.service';
import { LlmConfig } from '../llm-config/entities/llm-config.entity';
import { LLMClientFactory } from './llm-client.factory';
import {
  LLMClient,
  ChatParams,
  ChatResult,
  ModelInfo,
} from './interfaces/llm-client.interface';
import { LlmUsageLogService } from './llm-usage-log.service';

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
      return { success: false, error: this.sanitizeErrorMessage(message) };
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
    return client.listModels();
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

  private sanitizeErrorMessage(message: string): string {
    if (
      message.includes('401') ||
      message.toLowerCase().includes('unauthorized') ||
      message.toLowerCase().includes('authentication')
    ) {
      return 'Authentication failed. Please check your API key.';
    }
    if (
      message.includes('403') ||
      message.toLowerCase().includes('forbidden')
    ) {
      return 'Access denied. Please check your API key permissions.';
    }
    if (
      message.includes('404') ||
      message.toLowerCase().includes('not found')
    ) {
      return 'Model or endpoint not found. Please check your configuration.';
    }
    if (
      message.includes('429') ||
      message.toLowerCase().includes('rate limit')
    ) {
      return 'Rate limit exceeded. Please try again later.';
    }
    if (
      message.toLowerCase().includes('timeout') ||
      message.toLowerCase().includes('timed out')
    ) {
      return 'Connection timed out. Please check your network or endpoint URL.';
    }
    if (
      message.toLowerCase().includes('econnrefused') ||
      message.toLowerCase().includes('connection refused')
    ) {
      return 'Connection refused. Please check your endpoint URL.';
    }
    if (
      message.toLowerCase().includes('enotfound') ||
      message.toLowerCase().includes('getaddrinfo')
    ) {
      return 'Could not resolve hostname. Please check your endpoint URL.';
    }
    return 'Connection test failed. Please check your configuration.';
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
