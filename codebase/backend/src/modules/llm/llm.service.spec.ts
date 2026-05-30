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
      // signal 인자는 미전달 케이스라 undefined — chat(params, undefined)
      expect(mockClient.chat).toHaveBeenCalledWith(params, undefined);
      expect(result.content).toBe('response');
    });

    it('forwards opts.signal to client.chat (node-cancellation 컨벤션, parallel-p2 followups §1)', async () => {
      const config = {
        id: 'config-1',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as never;
      mockClient.chat.mockResolvedValue({ content: 'ok' } as never);
      const controller = new AbortController();
      const params = { model: 'gpt-4o', messages: [] as never[] };
      await service.chat(config, params as never, undefined, {
        signal: controller.signal,
      });
      expect(mockClient.chat).toHaveBeenCalledWith(params, controller.signal);
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

    // plan/llm-retry-after.md §2 + llm-retry-after-test-coverage §1 — withRetry
    // 통합 시나리오. setTimeout 인자값을 검증해 실제 backoff 결정 분기
    // (Retry-After / exponential / cap / 종단 / non-rate-limit) 가 의도대로
    // 동작함을 확인. fake timer 로 실제 대기 없이 즉시 진행.
    describe('Retry-After header behavior', () => {
      // 공통 fixture — 매 테스트에서 동일한 객체를 참조하지만 mutation 하지 않으므로
      // describe 스코프 상수로 안전. RateLimit / success 응답 객체는 매 테스트마다
      // 새로 생성해 오염 위험을 차단.
      const retryConfig = {
        provider: 'openai',
        defaultModel: 'gpt-4o',
        apiKey: 'encrypted',
      } as any;
      const retryParams = {
        model: 'gpt-4o',
        messages: [{ role: 'user' as const, content: 'test' }],
      };

      const makeSuccessResponse = () => ({
        content: 'ok',
        usage: { inputTokens: 1, outputTokens: 1, totalTokens: 2 },
        model: 'gpt-4o',
        finishReason: 'stop',
      });

      const makeRateLimitError = (
        headers?: Record<string, unknown>,
        message = '429 Too Many Requests',
      ) => {
        const err = new Error(message) as Error & {
          headers?: Record<string, unknown>;
        };
        if (headers) err.headers = headers;
        return err;
      };

      beforeEach(() => {
        jest.useFakeTimers();
      });
      afterEach(() => {
        jest.useRealTimers();
        // setTimeout spy 등 module-level spy 누출 방지.
        jest.restoreAllMocks();
      });

      it('honors Retry-After=2 (delta-seconds) → 2000ms backoff', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw makeRateLimitError({ 'retry-after': '2' });
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(2_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        // exponential fallback 이었다면 2^0 * 1000 = 1000ms 였을 것.
        // NthCalledWith(1, ...) 으로 첫 번째 호출임을 명시해 향후 내부 추가
        // setTimeout 이 생겨도 오탐(false pass)이 발생하지 않도록 강건화.
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          2_000,
        );
      });

      it('falls back to exponential (1000ms on first retry) when Retry-After absent', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw makeRateLimitError(); // no headers
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(1_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          1_000,
        );
      });

      it('caps Retry-After at 60_000ms when provider asks for ≥60s', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // 100 seconds — 상한 60s 적용되어 60_000ms 로 capped 되어야 함.
            throw makeRateLimitError({ 'retry-after': '100' });
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(60_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          60_000,
        );
      });

      // ── W2: cap 경계값 ──────────────────────────────────────────────────
      // cap 은 strict less-than 이 아닌 Math.min — 정확히 60s 도 60_000ms 로 통과,
      // 60s 미만은 그대로 통과. 회귀 시 cap 분기 오류를 즉시 검출.
      it('does not cap when Retry-After is below the limit (59s → 59_000ms)', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw makeRateLimitError({ 'retry-after': '59' });
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(59_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          59_000,
        );
      });

      it('uses exactly 60_000ms when Retry-After equals the cap (60s)', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw makeRateLimitError({ 'retry-after': '60' });
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(60_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          60_000,
        );
      });

      // ── W3: rate-limit 판정 분기 — 메시지 substring ────────────────────
      // withRetry 는 `.includes('429') || .toLowerCase().includes('rate limit')`.
      // 429 코드 없이 메시지에 "rate limit" 만 있어도 retry 가 동작해야 함.
      it('retries on rate-limit message even without 429 status code', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            throw makeRateLimitError(undefined, 'Rate Limit Exceeded');
          }
          return makeSuccessResponse();
        });

        const promise = service.chat(retryConfig, retryParams);
        await jest.advanceTimersByTimeAsync(1_000);
        const result = await promise;

        expect(callCount).toBe(2);
        expect(result.content).toBe('ok');
        // 429 코드 없으므로 헤더도 없는 케이스 — exponential fallback (1_000ms).
        expect(setTimeoutSpy).toHaveBeenNthCalledWith(
          1,
          expect.any(Function),
          1_000,
        );
      });

      // ── W4: 종단 경로 — 소진 / non-rate-limit ──────────────────────────
      // maxRetries=3 (default) → 1차 + 3회 retry = 총 4회 호출 후 throw.
      it('throws after exhausting maxRetries (3 retries → 4 total calls)', async () => {
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          throw makeRateLimitError({ 'retry-after': '0' });
        });

        const promise = service.chat(retryConfig, retryParams).catch((e) => e);
        // retry 3회 × Retry-After=0 → 각 0ms backoff. runAllTimersAsync 가 큐에
        // 들어가는 setTimeout(0) 들을 모두 소진할 때까지 반복 실행.
        await jest.runAllTimersAsync();
        const err = await promise;

        expect(callCount).toBe(4);
        expect(err).toBeInstanceOf(Error);
        expect((err as Error).message).toContain('429');
      });

      it('throws non-rate-limit errors immediately without retry', async () => {
        const setTimeoutSpy = jest.spyOn(global, 'setTimeout');
        let callCount = 0;
        mockClient.chat.mockImplementation(() => {
          callCount++;
          throw new Error('500 Internal Server Error');
        });

        await expect(service.chat(retryConfig, retryParams)).rejects.toThrow(
          /500/,
        );

        expect(callCount).toBe(1);
        // backoff setTimeout 이 호출되지 않아야 함 (즉시 throw).
        expect(setTimeoutSpy).not.toHaveBeenCalled();
      });
    });
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
    expect(extractRetryAfterMs({ headers: { 'Retry-After': '5' } })).toBe(
      5_000,
    );
    expect(extractRetryAfterMs({ headers: { 'RETRY-AFTER': '2' } })).toBe(
      2_000,
    );
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
    expect(
      extractRetryAfterMs({ headers: { 'retry-after': null } }),
    ).toBeNull();
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
    expect(extractRetryAfterMs({ headers: { 'retry-after': '' } })).toBeNull();
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
