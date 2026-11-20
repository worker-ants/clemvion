import { OpenAIClient } from './openai.client';

/**
 * Local client for Ollama, vLLM, or any OpenAI-compatible API.
 * Extends OpenAIClient with custom base URL and optional API key.
 */
export class LocalClient extends OpenAIClient {
  constructor(defaultModel: string, baseUrl: string, apiKey?: string) {
    // 사설망 엔드포인트용 프로바이더라 연결 시점 주소 판정을 끈다(CLE-T-PT5YB5).
    super(apiKey || 'not-required', defaultModel, baseUrl, false);
  }
}
