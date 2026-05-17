import { OpenAIClient } from './openai.client';

/**
 * Local client for Ollama, vLLM, or any OpenAI-compatible API.
 * Extends OpenAIClient with custom base URL and optional API key.
 */
export class LocalClient extends OpenAIClient {
  constructor(defaultModel: string, baseUrl: string, apiKey?: string) {
    super(apiKey || 'not-required', defaultModel, baseUrl);
  }
}
