import { BadRequestException } from '@nestjs/common';
import { LlmService } from './llm.service';

describe('LlmService', () => {
  let service: LlmService;
  let mockLlmConfigService: Record<string, jest.Mock>;
  let mockClientFactory: Record<string, jest.Mock>;
  let mockClient: Record<string, jest.Mock>;

  beforeEach(() => {
    mockClient = {
      chat: jest.fn().mockResolvedValue({
        content: 'response',
        usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
        model: 'gpt-4o',
        finishReason: 'stop',
      }),
      embed: jest.fn().mockResolvedValue([[0.1, 0.2]]),
      testConnection: jest.fn().mockResolvedValue(true),
      listModels: jest.fn().mockResolvedValue([]),
    };

    mockLlmConfigService = {
      getDecryptedApiKey: jest.fn().mockReturnValue('sk-decrypted-key'),
      findEntity: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      }),
      findDefault: jest.fn().mockResolvedValue(null),
    };

    mockClientFactory = {
      create: jest.fn().mockReturnValue(mockClient),
    };

    const mockUsageLogService = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    service = new LlmService(
      mockLlmConfigService as never,
      mockClientFactory as never,
      mockUsageLogService as never,
    );
  });

  describe('chat', () => {
    it('should resolve config and call client.chat', async () => {
      const config = {
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as any;
      const params = {
        model: 'gpt-4o',
        messages: [{ role: 'user' as const, content: 'Hello' }],
      };

      const result = await service.chat(config, params);

      expect(mockLlmConfigService.getDecryptedApiKey).toHaveBeenCalledWith(
        config,
      );
      expect(mockClientFactory.create).toHaveBeenCalledWith({
        provider: 'openai',
        apiKey: 'sk-decrypted-key',
        defaultModel: 'gpt-4o',
        baseUrl: undefined,
      });
      expect(mockClient.chat).toHaveBeenCalledWith(params);
      expect(result.content).toBe('response');
    });
  });

  describe('embed', () => {
    it('should batch texts into groups of 20', async () => {
      const config = {
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as any;

      // Generate 45 texts to verify batching
      const texts = Array.from({ length: 45 }, (_, i) => `text-${i}`);
      mockClient.embed
        .mockResolvedValueOnce(Array.from({ length: 20 }, () => [0.1]))
        .mockResolvedValueOnce(Array.from({ length: 20 }, () => [0.2]))
        .mockResolvedValueOnce(Array.from({ length: 5 }, () => [0.3]));

      const result = await service.embed(config, texts);

      expect(mockClient.embed).toHaveBeenCalledTimes(3);
      expect(mockClient.embed).toHaveBeenNthCalledWith(
        1,
        texts.slice(0, 20),
        undefined,
      );
      expect(mockClient.embed).toHaveBeenNthCalledWith(
        2,
        texts.slice(20, 40),
        undefined,
      );
      expect(mockClient.embed).toHaveBeenNthCalledWith(
        3,
        texts.slice(40, 45),
        undefined,
      );
      expect(result).toHaveLength(45);
    });
  });

  describe('testConnection', () => {
    it('should return success on successful connection', async () => {
      const result = await service.testConnection('config-1', 'ws-1');
      expect(result).toEqual({ success: true });
      expect(mockClient.testConnection).toHaveBeenCalled();
    });

    it('should return failure with sanitized error on connection refused', async () => {
      mockClient.testConnection.mockRejectedValue(
        new Error('Connection refused'),
      );

      const result = await service.testConnection('config-1', 'ws-1');
      expect(result).toEqual({
        success: false,
        error: 'Connection refused. Please check your endpoint URL.',
      });
    });

    it('should sanitize 401 authentication errors', async () => {
      mockClient.testConnection.mockRejectedValue(
        new Error('401 Unauthorized'),
      );

      const result = await service.testConnection('config-1', 'ws-1');
      expect(result).toEqual({
        success: false,
        error: 'Authentication failed. Please check your API key.',
      });
    });

    it('should sanitize timeout errors', async () => {
      mockClient.testConnection.mockRejectedValue(
        new Error('Request timed out'),
      );

      const result = await service.testConnection('config-1', 'ws-1');
      expect(result).toEqual({
        success: false,
        error:
          'Connection timed out. Please check your network or endpoint URL.',
      });
    });

    it('should return generic message for unknown errors', async () => {
      mockClient.testConnection.mockRejectedValue(
        new Error('some internal detail'),
      );

      const result = await service.testConnection('config-1', 'ws-1');
      expect(result).toEqual({
        success: false,
        error: 'Connection test failed. Please check your configuration.',
      });
    });
  });

  describe('resolveConfig', () => {
    it('should use provided configId', async () => {
      const result = await service.resolveConfig('config-1', 'ws-1');
      expect(mockLlmConfigService.findEntity).toHaveBeenCalledWith(
        'config-1',
        'ws-1',
      );
      expect(result.id).toBe('config-1');
    });

    it('should fall back to default config when no configId', async () => {
      const defaultConfig = {
        id: 'default-1',
        provider: 'openai',
        isDefault: true,
      };
      mockLlmConfigService.findDefault.mockResolvedValue(defaultConfig);

      const result = await service.resolveConfig(undefined, 'ws-1');
      expect(mockLlmConfigService.findDefault).toHaveBeenCalledWith('ws-1');
      expect(result.id).toBe('default-1');
    });

    it('should throw when no config available', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue(null);

      await expect(service.resolveConfig(undefined, 'ws-1')).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('listModels (saved config)', () => {
    it('sanitizes provider errors as LLM_MODEL_LIST_FAILED', async () => {
      mockClient.listModels.mockRejectedValue(new Error('401 Unauthorized'));
      await expect(
        service.listModels('config-1', 'ws-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LLM_MODEL_LIST_FAILED',
          message: 'Authentication failed. Please check your API key.',
        }),
      });
    });

    it('times out long-running calls on the saved-config path', async () => {
      jest.useFakeTimers();
      try {
        mockClient.listModels.mockImplementation(() => new Promise(() => {}));
        const pending = service
          .listModels('config-1', 'ws-1')
          .catch((e: unknown) => e);
        await jest.advanceTimersByTimeAsync(30_000);
        const err = await pending;
        expect(err).toMatchObject({
          response: expect.objectContaining({
            message:
              'Connection timed out. Please check your network or endpoint URL.',
          }),
        });
      } finally {
        jest.useRealTimers();
      }
    });

    it('caches successful results and serves the second call without hitting the provider', async () => {
      mockClient.listModels.mockResolvedValue([
        { id: 'gpt-4o', name: 'gpt-4o', type: 'chat' },
      ]);
      await service.listModels('config-1', 'ws-1');
      await service.listModels('config-1', 'ws-1');
      expect(mockClient.listModels).toHaveBeenCalledTimes(1);
    });

    it('serves a fresh call after TTL expiry (5 minutes)', async () => {
      mockClient.listModels.mockResolvedValue([]);
      const nowSpy = jest.spyOn(Date, 'now');
      nowSpy.mockReturnValue(1_000_000);
      await service.listModels('config-1', 'ws-1');
      // 5분 + 1초 경과
      nowSpy.mockReturnValue(1_000_000 + 5 * 60 * 1000 + 1000);
      await service.listModels('config-1', 'ws-1');
      expect(mockClient.listModels).toHaveBeenCalledTimes(2);
      nowSpy.mockRestore();
    });

    it('invalidates the cache when clearClientCache is called for that config', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.listModels('config-1', 'ws-1');
      service.clearClientCache('config-1');
      await service.listModels('config-1', 'ws-1');
      expect(mockClient.listModels).toHaveBeenCalledTimes(2);
    });

    it('does not cross cache between different workspaces', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.listModels('config-1', 'ws-1');
      await service.listModels('config-1', 'ws-2');
      expect(mockClient.listModels).toHaveBeenCalledTimes(2);
    });
  });

  describe('withRetry', () => {
    it('should retry on 429 errors', async () => {
      let callCount = 0;
      mockClient.chat.mockImplementation(() => {
        callCount++;
        if (callCount <= 2) {
          throw new Error('429 Too Many Requests');
        }
        return {
          content: 'success',
          usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
          model: 'gpt-4o',
          finishReason: 'stop',
        };
      });

      const config = {
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as any;

      const result = await service.chat(config, {
        model: 'gpt-4o',
        messages: [{ role: 'user', content: 'test' }],
      });

      expect(callCount).toBe(3);
      expect(result.content).toBe('success');
    }, 30000);
  });
});
