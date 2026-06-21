import { registerAs } from '@nestjs/config';

export const llmConfig = registerAs('llm', () => ({
  encryptionKey: process.env.ENCRYPTION_KEY || '',
  /**
   * 테스트 전용 결정적 stub 클라이언트 게이트 (refactor M-6 — Option B). `LLM_STUB_MODE`
   * 직접 접근을 ConfigService 로 중앙화. `LlmService.createClient` 가 캐시/decrypt 경로보다
   * 앞에서 본 값을 확인해 `StubLlmClient` 를 반환한다. 프로덕션은 production-guards 의 부팅
   * fail-closed 가드가 `LLM_STUB_MODE=true` 를 차단한다. SoT: spec/5-system/7-llm-client.md §7.1.
   */
  stubMode: process.env.LLM_STUB_MODE === 'true',
}));
