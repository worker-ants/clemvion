import { LLMClientFactory } from './llm-client.factory';
import { OpenAIClient } from './clients/openai.client';
import { AnthropicClient } from './clients/anthropic.client';
import { GoogleClient } from './clients/google.client';
import { AzureOpenAIClient } from './clients/azure-openai.client';
import { LocalClient } from './clients/local.client';

describe('LLMClientFactory', () => {
  let factory: LLMClientFactory;

  beforeEach(() => {
    factory = new LLMClientFactory();
  });

  const baseOptions = {
    apiKey: 'test-key',
    defaultModel: 'test-model',
  };

  describe('create', () => {
    it('should return OpenAIClient for openai provider', () => {
      const client = factory.create({ ...baseOptions, provider: 'openai' });
      expect(client).toBeInstanceOf(OpenAIClient);
    });

    it('should return AnthropicClient for anthropic provider', () => {
      const client = factory.create({ ...baseOptions, provider: 'anthropic' });
      expect(client).toBeInstanceOf(AnthropicClient);
    });

    it('should return GoogleClient for google provider', () => {
      const client = factory.create({ ...baseOptions, provider: 'google' });
      expect(client).toBeInstanceOf(GoogleClient);
    });

    it('should return AzureOpenAIClient for azure provider (requires baseUrl)', () => {
      const client = factory.create({
        ...baseOptions,
        provider: 'azure',
        baseUrl: 'https://myinstance.openai.azure.com',
      });
      expect(client).toBeInstanceOf(AzureOpenAIClient);
    });

    it('should throw for azure provider without baseUrl', () => {
      expect(() =>
        factory.create({ ...baseOptions, provider: 'azure' }),
      ).toThrow('Azure OpenAI requires a base URL');
    });

    it('should return LocalClient for local provider (requires baseUrl)', () => {
      const client = factory.create({
        ...baseOptions,
        provider: 'local',
        baseUrl: 'http://localhost:11434',
      });
      expect(client).toBeInstanceOf(LocalClient);
    });

    it('should throw for local provider without baseUrl', () => {
      expect(() =>
        factory.create({ ...baseOptions, provider: 'local' }),
      ).toThrow('Local provider requires a base URL');
    });

    it('should throw for unknown provider', () => {
      expect(() =>
        factory.create({ ...baseOptions, provider: 'unknown' }),
      ).toThrow('Unsupported LLM provider: unknown');
    });
  });
});
