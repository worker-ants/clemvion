import OpenAI from 'openai';
import { OpenAIClient } from './openai.client';
import { LLM_SDK_MAX_RETRIES } from './sdk-options';

export class AzureOpenAIClient extends OpenAIClient {
  constructor(apiKey: string, defaultModel: string, baseUrl: string) {
    // Azure OpenAI uses OpenAI SDK with Azure-specific configuration
    super(apiKey, defaultModel, baseUrl);

    // Re-create client with Azure-specific headers
    this.client = new OpenAI({
      apiKey,
      baseURL: baseUrl,
      timeout: 120_000,
      maxRetries: LLM_SDK_MAX_RETRIES,
      defaultHeaders: {
        'api-key': apiKey,
      },
      defaultQuery: {
        'api-version': '2024-10-21',
      },
    });
  }
}
