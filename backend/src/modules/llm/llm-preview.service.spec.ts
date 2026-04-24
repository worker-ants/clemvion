import { BadRequestException } from '@nestjs/common';
import { LlmPreviewService } from './llm-preview.service';

jest.mock('node:dns', () => {
  const actual = jest.requireActual<typeof import('node:dns')>('node:dns');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      lookup: jest.fn(),
    },
  };
});

import { promises as dns } from 'node:dns';
const mockedDnsLookup = dns.lookup as unknown as jest.Mock;

describe('LlmPreviewService', () => {
  let service: LlmPreviewService;
  let mockClient: Record<string, jest.Mock>;
  let mockClientFactory: Record<string, jest.Mock>;

  beforeEach(() => {
    mockClient = {
      listModels: jest.fn().mockResolvedValue([]),
    };
    mockClientFactory = {
      create: jest.fn().mockReturnValue(mockClient),
    };
    service = new LlmPreviewService(mockClientFactory as never);
    // 기본적으로 DNS 조회는 public IP 로 해석된다고 가정 (대부분의 테스트는
    // IP 리터럴 baseUrl 이라 lookup 이 호출되지도 않음).
    mockedDnsLookup.mockResolvedValue([{ address: '1.2.3.4', family: 4 }]);
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

    it('rejects a hostname that resolves to a private IP (DNS rebinding 1st pass)', async () => {
      mockedDnsLookup.mockResolvedValueOnce([
        { address: '10.1.2.3', family: 4 },
      ]);
      await expect(
        service.previewModels({
          provider: 'openai',
          apiKey: 'k',
          baseUrl: 'https://attacker.example.com',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          code: 'LLM_CONFIG_INVALID',
          message: expect.stringContaining('resolves to a private'),
        }),
      });
      expect(mockedDnsLookup).toHaveBeenCalledWith('attacker.example.com', {
        all: true,
      });
    });

    it('allows a hostname that resolves to a public IP', async () => {
      mockedDnsLookup.mockResolvedValueOnce([
        { address: '8.8.8.8', family: 4 },
      ]);
      await service.previewModels({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'https://api.openai.com',
      });
      expect(mockClientFactory.create).toHaveBeenCalled();
    });

    it('allows hostname lookup failure to pass through (not treated as SSRF)', async () => {
      mockedDnsLookup.mockRejectedValueOnce(
        Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }),
      );
      // 해석 실패는 SSRF 판단으로 오인하지 않고 하위 SDK 가 실제 네트워크 에러를
      // 돌려보내도록 진행.
      await service.previewModels({
        provider: 'openai',
        apiKey: 'k',
        baseUrl: 'https://does-not-exist.example.com',
      });
      expect(mockClientFactory.create).toHaveBeenCalled();
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

    it('preserves the original provider error when rejection wins the race (no timeout substitution)', async () => {
      mockClient.listModels.mockRejectedValue(new Error('401 Unauthorized'));
      await expect(
        service.previewModels({ provider: 'openai', apiKey: 'bad' }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({
          message: 'Authentication failed. Please check your API key.',
        }),
      });
      await expect(
        service.previewModels({ provider: 'openai', apiKey: 'bad' }),
      ).rejects.not.toMatchObject({
        response: expect.objectContaining({
          message: expect.stringContaining('timed out'),
        }),
      });
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
});
