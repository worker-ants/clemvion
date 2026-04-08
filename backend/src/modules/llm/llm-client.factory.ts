import { Injectable } from '@nestjs/common';
import { LLMClient } from './interfaces/llm-client.interface';
import { OpenAIClient } from './clients/openai.client';
import { AnthropicClient } from './clients/anthropic.client';
import { GoogleClient } from './clients/google.client';
import { AzureOpenAIClient } from './clients/azure-openai.client';
import { LocalClient } from './clients/local.client';

export interface LLMClientCreateOptions {
  provider: string;
  apiKey: string;
  defaultModel: string;
  baseUrl?: string;
}

@Injectable()
export class LLMClientFactory {
  create(options: LLMClientCreateOptions): LLMClient {
    switch (options.provider) {
      case 'openai':
        return new OpenAIClient(
          options.apiKey,
          options.defaultModel,
          options.baseUrl,
        );
      case 'anthropic':
        return new AnthropicClient(options.apiKey, options.defaultModel);
      case 'google':
        return new GoogleClient(options.apiKey, options.defaultModel);
      case 'azure':
        if (!options.baseUrl) {
          throw new Error(
            'Azure OpenAI requires a base URL (deployment endpoint)',
          );
        }
        return new AzureOpenAIClient(
          options.apiKey,
          options.defaultModel,
          options.baseUrl,
        );
      case 'local':
        if (!options.baseUrl) {
          throw new Error('Local provider requires a base URL');
        }
        return new LocalClient(
          options.defaultModel,
          options.baseUrl,
          options.apiKey,
        );
      default:
        throw new Error(`Unsupported LLM provider: ${options.provider}`);
    }
  }
}
