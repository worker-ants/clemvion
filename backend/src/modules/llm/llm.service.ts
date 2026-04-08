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

@Injectable()
export class LlmService {
  private readonly logger = new Logger(LlmService.name);
  private readonly clientCache = new Map<string, LLMClient>();

  constructor(
    private readonly llmConfigService: LlmConfigService,
    private readonly clientFactory: LLMClientFactory,
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

  async chat(config: LlmConfig, params: ChatParams): Promise<ChatResult> {
    const client = this.createClient(config);
    return this.withRetry(() => client.chat(params));
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
      return { success: false, error: message };
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
