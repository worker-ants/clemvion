import { BadRequestException } from '@nestjs/common';
import { LlmService, extractRetryAfterMs } from './llm.service';

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

    // spec/5-system/6-websocket-protocol.md §4.4.6 — `source` is a
    // transport-only marker for WebSocket emit. LlmService must strip it
    // before forwarding to provider clients so LLM APIs only see the
    // canonical {role, content, toolCalls?, toolCallId?} shape.
    describe('source field stripping (spec §4.4.6)', () => {
      const config = {
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as never;

      it("strips source: 'live' before calling provider client", async () => {
        await service.chat(config, {
          model: 'gpt-4o',
          messages: [
            { role: 'user', content: 'hi', source: 'live' },
            { role: 'assistant', content: 'hello', source: 'live' },
          ],
        });
        const forwarded = mockClient.chat.mock.calls[0][0] as {
          messages: Array<Record<string, unknown>>;
        };
        expect(forwarded.messages).toEqual([
          { role: 'user', content: 'hi' },
          { role: 'assistant', content: 'hello' },
        ]);
        for (const m of forwarded.messages) {
          expect(m).not.toHaveProperty('source');
        }
      });

      it("strips source: 'injected' before calling provider client", async () => {
        await service.chat(config, {
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: '[from Template] start',
              source: 'injected',
            },
            { role: 'user', content: 'live', source: 'live' },
          ],
        });
        const forwarded = mockClient.chat.mock.calls[0][0] as {
          messages: Array<Record<string, unknown>>;
        };
        expect(forwarded.messages[0]).not.toHaveProperty('source');
        expect(forwarded.messages[1]).not.toHaveProperty('source');
        expect(forwarded.messages[0].content).toBe('[from Template] start');
      });

      it('passes through unrelated fields (toolCalls, toolCallId) intact', async () => {
        await service.chat(config, {
          model: 'gpt-4o',
          messages: [
            {
              role: 'assistant',
              content: '',
              toolCalls: [
                { id: 'call_1', name: 'get_weather', arguments: '{}' },
              ],
              source: 'live',
            },
            {
              role: 'tool',
              content: '{"temp":12}',
              toolCallId: 'call_1',
              source: 'live',
            },
          ],
        });
        const forwarded = mockClient.chat.mock.calls[0][0] as {
          messages: Array<Record<string, unknown>>;
        };
        expect(forwarded.messages[0]).toEqual({
          role: 'assistant',
          content: '',
          toolCalls: [{ id: 'call_1', name: 'get_weather', arguments: '{}' }],
        });
        expect(forwarded.messages[1]).toEqual({
          role: 'tool',
          content: '{"temp":12}',
          toolCallId: 'call_1',
        });
      });

      it('preserves other ChatParams fields (model, temperature, tools)', async () => {
        await service.chat(config, {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hi', source: 'live' }],
          temperature: 0.5,
          maxTokens: 100,
          tools: [{ name: 't', description: 'd', parameters: {} }],
        });
        const forwarded = mockClient.chat.mock.calls[0][0] as Record<
          string,
          unknown
        >;
        expect(forwarded.model).toBe('gpt-4o');
        expect(forwarded.temperature).toBe(0.5);
        expect(forwarded.maxTokens).toBe(100);
        expect(forwarded.tools).toEqual([
          { name: 't', description: 'd', parameters: {} },
        ]);
      });

      it('handles messages with no source field (older callers)', async () => {
        await service.chat(config, {
          model: 'gpt-4o',
          messages: [{ role: 'user', content: 'hi' }],
        });
        const forwarded = mockClient.chat.mock.calls[0][0] as {
          messages: Array<Record<string, unknown>>;
        };
        expect(forwarded.messages).toEqual([{ role: 'user', content: 'hi' }]);
      });
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

    it('should include workspaceId in error message and payload', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue(null);

      await expect(
        service.resolveConfig(undefined, 'ws-42'),
      ).rejects.toMatchObject({
        response: {
          code: 'LLM_CONFIG_NOT_FOUND',
          workspaceId: 'ws-42',
          message: expect.stringContaining('ws-42'),
        },
      });
    });

    it('should distinguish missing workspaceId case in error message', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue(null);

      await expect(service.resolveConfig(undefined, '')).rejects.toMatchObject({
        response: {
          code: 'LLM_CONFIG_NOT_FOUND',
          workspaceId: '',
          message: expect.stringContaining('워크스페이스 정보가 없어'),
        },
      });
    });
  });

  describe('hasDefaultLlmConfig', () => {
    it('returns true when workspace has default config', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue({
        id: 'default-1',
        isDefault: true,
      });

      await expect(service.hasDefaultLlmConfig('ws-1')).resolves.toBe(true);
      expect(mockLlmConfigService.findDefault).toHaveBeenCalledWith('ws-1');
    });

    it('returns false when workspace has no default', async () => {
      mockLlmConfigService.findDefault.mockResolvedValue(null);

      await expect(service.hasDefaultLlmConfig('ws-1')).resolves.toBe(false);
    });

    it('returns false without querying when workspaceId is empty', async () => {
      await expect(service.hasDefaultLlmConfig('')).resolves.toBe(false);
      expect(mockLlmConfigService.findDefault).not.toHaveBeenCalled();
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

describe('extractRetryAfterMs', () => {
  // 2026-05-19 — spec/4-nodes/3-ai/* multi-turn 오류 회복 흐름의 일부. RFC 7231
  // §7.1.3 Retry-After 두 형식 (delta-seconds / HTTP-date) 양쪽을 ms 로 정규화.
  it('extracts delta-seconds from headers["retry-after"]', () => {
    const err = { headers: { 'retry-after': '30' } };
    expect(extractRetryAfterMs(err)).toBe(30_000);
  });

  it('treats header name case-insensitively (Retry-After / RETRY-AFTER)', () => {
    expect(extractRetryAfterMs({ headers: { 'Retry-After': '5' } })).toBe(5_000);
    expect(extractRetryAfterMs({ headers: { 'RETRY-AFTER': '2' } })).toBe(2_000);
  });

  it('reads response.headers when top-level headers absent', () => {
    const err = { response: { headers: { 'retry-after': '12' } } };
    expect(extractRetryAfterMs(err)).toBe(12_000);
  });

  it('parses HTTP-date format (RFC 7231 §7.1.1.1)', () => {
    const future = new Date(Date.now() + 5_000).toUTCString();
    const ms = extractRetryAfterMs({ headers: { 'retry-after': future } });
    // 시계 차이 ±500ms 허용 (Date.now() vs Date.parse 라운딩).
    expect(ms).not.toBeNull();
    expect(ms!).toBeGreaterThan(4_000);
    expect(ms!).toBeLessThan(6_000);
  });

  it('returns 0 when HTTP-date is already in the past', () => {
    const past = new Date(Date.now() - 5_000).toUTCString();
    expect(extractRetryAfterMs({ headers: { 'retry-after': past } })).toBe(0);
  });

  it('returns null for missing headers', () => {
    expect(extractRetryAfterMs({})).toBeNull();
    expect(extractRetryAfterMs({ headers: {} })).toBeNull();
    expect(extractRetryAfterMs({ headers: { 'retry-after': null } })).toBeNull();
  });

  it('returns null for non-object errors and primitives', () => {
    expect(extractRetryAfterMs(null)).toBeNull();
    expect(extractRetryAfterMs(undefined)).toBeNull();
    expect(extractRetryAfterMs('429 rate limited')).toBeNull();
    expect(extractRetryAfterMs(429)).toBeNull();
  });

  it('returns null for invalid string values (not parseable as seconds or date)', () => {
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': 'soon' } }),
    ).toBeNull();
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': '' } }),
    ).toBeNull();
  });

  it('returns null for negative delta-seconds (defensive)', () => {
    // RFC 는 0 이상 delta-seconds 만 정의. 음수는 서버 버그 — fallback 사용.
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': '-5' } }),
    ).toBeNull();
  });

  it('handles delta-seconds as number type (header value not stringified)', () => {
    // 일부 SDK 가 헤더 값을 이미 number 로 노출할 수 있음.
    expect(extractRetryAfterMs({ headers: { 'retry-after': 15 } })).toBe(
      15_000,
    );
  });
});
