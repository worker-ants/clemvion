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
  });

  describe('previewModels', () => {
    it('builds a temporary client from in-memory credentials and returns its model list', async () => {
      mockClient.listModels.mockResolvedValue([
        { id: 'gpt-4o', name: 'gpt-4o', type: 'chat' },
        {
          id: 'text-embedding-3-small',
          name: 'text-embedding-3-small',
          type: 'embedding',
        },
      ]);

      const result = await service.previewModels({
        provider: 'openai',
        apiKey: 'sk-plain-key',
      });

      expect(mockClientFactory.create).toHaveBeenCalledWith({
        provider: 'openai',
        apiKey: 'sk-plain-key',
        defaultModel: '',
        baseUrl: undefined,
      });
      expect(mockLlmConfigService.findEntity).not.toHaveBeenCalled();
      expect(mockLlmConfigService.getDecryptedApiKey).not.toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });

    it('passes baseUrl through for azure/local providers', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({
        provider: 'azure',
        apiKey: 'azure-key',
        baseUrl: 'https://my.openai.azure.com',
      });
      expect(mockClientFactory.create).toHaveBeenCalledWith({
        provider: 'azure',
        apiKey: 'azure-key',
        defaultModel: '',
        baseUrl: 'https://my.openai.azure.com',
      });
    });

    it('allows empty apiKey for local provider', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({
        provider: 'local',
        apiKey: '',
        baseUrl: 'http://localhost:11434/v1',
      });
      expect(mockClientFactory.create).toHaveBeenCalledWith({
        provider: 'local',
        apiKey: '',
        defaultModel: '',
        baseUrl: 'http://localhost:11434/v1',
      });
    });

    it('rejects non-local providers pointing to loopback (SSRF guard)', async () => {
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'http://127.0.0.1:8080',
        }),
      ).rejects.toThrow(BadRequestException);
      expect(mockClientFactory.create).not.toHaveBeenCalled();
    });

    it('rejects non-local providers pointing to cloud metadata (SSRF guard)', async () => {
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'http://169.254.169.254/latest/meta-data',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-local providers pointing to RFC1918 ranges', async () => {
      await expect(
        service.previewModels({
          provider: 'azure',
          apiKey: 'k',
          baseUrl: 'http://10.0.0.5',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects RFC1918 Class B (172.16-31.x.x) range', async () => {
      for (const ip of ['172.16.0.1', '172.20.1.1', '172.31.255.254']) {
        await expect(
          service.previewModels({
            provider: 'openai',
            apiKey: 'k',
            baseUrl: `http://${ip}`,
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('allows 172.15.0.1 and 172.32.0.1 (off-by-one boundary)', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'http://172.15.0.1',
      });
      await service.previewModels({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'http://172.32.0.1',
      });
      expect(mockClientFactory.create).toHaveBeenCalledTimes(2);
    });

    it('rejects RFC1918 Class C (192.168.x.x) range', async () => {
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'http://192.168.1.1',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects non-http(s) schemes (defense-in-depth even though DTO blocks them)', async () => {
      // Note: @IsUrl at DTO rejects these first; this guards when isPrivateHost
      // is reused in code paths without DTO validation.
      // Test by calling through the full service path — DTO is bypassed since
      // service method is invoked directly with raw values.
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'file:///etc/passwd',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects 0.0.0.0 (unspecified address)', async () => {
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'http://0.0.0.0',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('rejects IPv6 loopback, ULA, and link-local addresses', async () => {
      for (const url of [
        'http://[::1]',
        'http://[fc00::1]',
        'http://[fd12:3456:789a::1]',
        'http://[fe80::1]',
      ]) {
        await expect(
          service.previewModels({
            provider: 'openai',
            apiKey: 'k',
            baseUrl: url,
          }),
        ).rejects.toThrow(BadRequestException);
      }
    });

    it('rejects IPv4-mapped IPv6 private addresses', async () => {
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'http://[::ffff:10.0.0.1]',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows a private IP for the local provider (intentional exception)', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({
        provider: 'local',
        apiKey: '',
        baseUrl: 'http://10.0.0.5:11434/v1',
      });
      expect(mockClientFactory.create).toHaveBeenCalled();
    });

    it('allows localhost for the local provider', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({
        provider: 'local',
        apiKey: '',
        baseUrl: 'http://127.0.0.1:11434/v1',
      });
      expect(mockClientFactory.create).toHaveBeenCalled();
    });

    it('rejects empty apiKey for non-local providers', async () => {
      await expect(
        service.previewModels({ provider: 'openai', apiKey: '' }),
      ).rejects.toThrow(BadRequestException);
      expect(mockClientFactory.create).not.toHaveBeenCalled();
    });

    it('does not reuse the preview client across calls (no per-config cache)', async () => {
      mockClient.listModels.mockResolvedValue([]);
      await service.previewModels({ provider: 'openai', apiKey: 'k1' });
      await service.previewModels({ provider: 'openai', apiKey: 'k2' });
      expect(mockClientFactory.create).toHaveBeenCalledTimes(2);
    });

    it('sanitizes 401 provider errors before re-throwing', async () => {
      mockClient.listModels.mockRejectedValue(new Error('401 Unauthorized'));
      await expect(
        service.previewModels({ provider: 'openai', apiKey: 'bad-key' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Authentication failed. Please check your API key.',
        }),
      });
    });

    it('sanitizes 429 rate-limit errors', async () => {
      mockClient.listModels.mockRejectedValue(
        new Error('429 Too Many Requests'),
      );
      await expect(
        service.previewModels({ provider: 'openai', apiKey: 'k' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Rate limit exceeded. Please try again later.',
        }),
      });
    });

    it('sanitizes connection-refused errors for local providers', async () => {
      mockClient.listModels.mockRejectedValue(
        new Error('ECONNREFUSED 127.0.0.1:11434'),
      );
      await expect(
        service.previewModels({
          provider: 'local',
          apiKey: '',
          baseUrl: 'http://localhost:11434/v1',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Connection refused. Please check your endpoint URL.',
        }),
      });
    });

    it('times out long-running provider calls after 30s', async () => {
      jest.useFakeTimers();
      try {
        mockClient.listModels.mockImplementation(() => new Promise(() => {}));

        const pending = service
          .previewModels({ provider: 'openai', apiKey: 'k' })
          .then(
            () => ({ ok: true }) as const,
            (err: unknown) => ({ ok: false, err }) as const,
          );

        await jest.advanceTimersByTimeAsync(30_000);
        const outcome = await pending;

        expect(outcome.ok).toBe(false);
        if (!outcome.ok) {
          expect(outcome.err).toMatchObject({
            response: expect.objectContaining({
              message:
                'Connection timed out. Please check your network or endpoint URL.',
            }),
          });
        }
      } finally {
        jest.useRealTimers();
      }
    });

    it('aborts the client call via AbortSignal on timeout (socket cleanup)', async () => {
      jest.useFakeTimers();
      try {
        let captured: AbortSignal | undefined;
        mockClient.listModels.mockImplementation((signal?: AbortSignal) => {
          captured = signal;
          return new Promise(() => {});
        });

        const pending = service
          .previewModels({ provider: 'openai', apiKey: 'k' })
          .catch(() => undefined);

        await jest.advanceTimersByTimeAsync(30_000);
        await pending;

        expect(captured).toBeDefined();
        expect(captured?.aborted).toBe(true);
      } finally {
        jest.useRealTimers();
      }
    });

    it('surfaces factory errors (e.g. missing baseUrl for azure) as BadRequest with the original message', async () => {
      mockClientFactory.create.mockImplementation(() => {
        throw new Error(
          'Azure OpenAI requires a base URL (deployment endpoint)',
        );
      });
      await expect(
        service.previewModels({ provider: 'azure', apiKey: 'k' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LLM_CONFIG_INVALID',
          message: 'Azure OpenAI requires a base URL (deployment endpoint)',
        }),
      });
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
