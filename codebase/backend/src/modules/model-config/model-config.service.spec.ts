import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { ModelConfigService } from './model-config.service';
import { ModelConfig } from './entities/model-config.entity';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import * as ssrfUtil from '../../common/utils/ssrf.util';
import { randomBytes } from 'crypto';

const ENCRYPTION_KEY = randomBytes(32).toString('hex');

describe('ModelConfigService', () => {
  let service: ModelConfigService;
  let mockRepo: Record<string, any>;

  beforeEach(async () => {
    mockRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([[], 0]),
      })),
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data, id: 'test-id' })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      update: jest.fn().mockResolvedValue(undefined),
      remove: jest.fn().mockResolvedValue(undefined),
      manager: {
        transaction: jest.fn(
          async (cb: (manager: { update: jest.Mock }) => Promise<void>) => {
            const txManager = {
              update: jest.fn().mockResolvedValue(undefined),
            };
            await cb(txManager);
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ModelConfigService,
        { provide: getRepositoryToken(ModelConfig), useValue: mockRepo },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) =>
              key === 'llm.encryptionKey' ? ENCRYPTION_KEY : undefined,
            ),
          },
        },
      ],
    }).compile();

    service = module.get<ModelConfigService>(ModelConfigService);
  });

  describe('create', () => {
    it('encrypts the API key and stamps the given kind (chat)', async () => {
      const dto = {
        kind: 'chat' as const,
        provider: 'openai' as const,
        name: 'Test OpenAI',
        apiKey: 'sk-test123456789abcdef',
        defaultModel: 'gpt-4o',
      };
      const result = await service.create('workspace-1', 'chat', dto);

      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.kind).toBe('chat');
      expect(saved.apiKey).not.toBe(dto.apiKey);
      expect(decrypt(saved.apiKey, ENCRYPTION_KEY)).toBe(dto.apiKey);
      expect(result.apiKey).toMatch(/^\*{4}/);
    });

    it('persists dimension for embedding kind', async () => {
      const dto = {
        kind: 'embedding' as const,
        provider: 'openai' as const,
        name: 'Embed',
        apiKey: 'sk-embed-key-123456789',
        defaultModel: 'text-embedding-3-small',
        dimension: 1536,
      };
      await service.create('ws-1', 'embedding', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.kind).toBe('embedding');
      expect(saved.dimension).toBe(1536);
      expect(saved.defaultParams).toEqual({});
    });

    it('allows a null API key for self-hosted tei (rerank)', async () => {
      const dto = {
        kind: 'rerank' as const,
        provider: 'tei' as const,
        name: 'Self-hosted reranker',
        defaultModel: 'bge-reranker-v2-m3',
        baseUrl: 'http://tei:8080',
      };
      const result = await service.create('ws-1', 'rerank', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBeNull();
      expect(result.apiKey).toBeNull();
    });

    it('rejects a missing API key for an external provider', async () => {
      const dto = {
        kind: 'rerank' as const,
        provider: 'cohere' as const,
        name: 'Cohere',
        defaultModel: 'rerank-3.5',
      };
      await expect(service.create('ws-1', 'rerank', dto)).rejects.toThrow();
    });
  });

  describe('findById', () => {
    it('returns a masked API key', async () => {
      const encrypted = encrypt('sk-test123456789abcdef', ENCRYPTION_KEY);
      mockRepo.findOne.mockResolvedValue({
        id: 'test-id',
        workspaceId: 'ws-1',
        kind: 'chat',
        provider: 'openai',
        name: 'Test',
        apiKey: encrypted,
        defaultModel: 'gpt-4o',
      });
      const result = await service.findById('test-id', 'ws-1');
      expect(result.apiKey).toMatch(/^\*{4}/);
      expect(result.apiKey).not.toBe('sk-test123456789abcdef');
    });

    it('throws NotFoundException when missing', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('nope', 'ws-1')).rejects.toThrow();
    });
  });

  describe('getDecryptedApiKey', () => {
    it('decrypts a present key', () => {
      const original = 'sk-test123456789abcdef';
      const config = {
        apiKey: encrypt(original, ENCRYPTION_KEY),
      } as ModelConfig;
      expect(service.getDecryptedApiKey(config)).toBe(original);
    });

    it('returns null for a self-hosted config without a key', () => {
      expect(
        service.getDecryptedApiKey({ apiKey: null } as ModelConfig),
      ).toBeNull();
    });
  });

  describe('findAll', () => {
    it('filters by kind and masks keys', async () => {
      const encrypted = encrypt('sk-test123456789abcdef', ENCRYPTION_KEY);
      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getManyAndCount: jest.fn().mockResolvedValue([
          [
            {
              id: 'config-1',
              workspaceId: 'ws-1',
              kind: 'chat',
              provider: 'openai',
              name: 'Test',
              apiKey: encrypted,
              defaultModel: 'gpt-4o',
            },
          ],
          1,
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.findAll('ws-1', 'chat', {
        page: 1,
        limit: 20,
      });
      expect(qbMock.andWhere).toHaveBeenCalledWith('mc.kind = :kind', {
        kind: 'chat',
      });
      expect(result.data).toHaveLength(1);
      expect(result.data[0].apiKey).toMatch(/^\*{4}/);
    });
  });

  // ── update ──────────────────────────────────────────────────────────────────

  describe('update', () => {
    const baseConfig = (overrides: Partial<ModelConfig> = {}): ModelConfig =>
      ({
        id: 'cfg-1',
        workspaceId: 'ws-1',
        kind: 'chat',
        provider: 'openai',
        name: 'Test',
        apiKey: encrypt('sk-original-key-1234', ENCRYPTION_KEY),
        baseUrl: null,
        defaultModel: 'gpt-4o',
        defaultParams: {},
        dimension: null,
        isDefault: false,
        ...overrides,
      }) as ModelConfig;

    it('patches defaultParams only for chat kind', async () => {
      mockRepo.findOne.mockResolvedValue(baseConfig({ kind: 'chat' }));
      const dto = { defaultParams: { temperature: 0.5 } };
      await service.update('cfg-1', 'ws-1', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.defaultParams).toEqual({ temperature: 0.5 });
    });

    it('ignores defaultParams for embedding kind', async () => {
      mockRepo.findOne.mockResolvedValue(
        baseConfig({ kind: 'embedding', defaultParams: {} }),
      );
      const dto = { defaultParams: { temperature: 0.9 } };
      await service.update('cfg-1', 'ws-1', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      // embedding kind must not absorb defaultParams
      expect(saved.defaultParams).toEqual({});
    });

    it('patches dimension only for embedding kind', async () => {
      mockRepo.findOne.mockResolvedValue(
        baseConfig({ kind: 'embedding', dimension: null }),
      );
      const dto = { dimension: 768 };
      await service.update('cfg-1', 'ws-1', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.dimension).toBe(768);
    });

    it('ignores dimension for chat kind', async () => {
      mockRepo.findOne.mockResolvedValue(baseConfig({ kind: 'chat' }));
      const dto = { dimension: 512 };
      await service.update('cfg-1', 'ws-1', dto);
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.dimension).toBeNull();
    });

    it('re-encrypts apiKey when provided', async () => {
      mockRepo.findOne.mockResolvedValue(baseConfig());
      const newKey = 'sk-new-key-abcde12345';
      await service.update('cfg-1', 'ws-1', { apiKey: newKey });
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.apiKey).not.toBe(newKey);
      expect(decrypt(saved.apiKey, ENCRYPTION_KEY)).toBe(newKey);
    });

    it('does NOT change apiKey when apiKey is absent from dto', async () => {
      const original = encrypt('sk-original-key-1234', ENCRYPTION_KEY);
      mockRepo.findOne.mockResolvedValue(baseConfig({ apiKey: original }));
      await service.update('cfg-1', 'ws-1', { name: 'Renamed' });
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.apiKey).toBe(original);
    });

    it('isDefault=true triggers saveWithDefaultSwap transaction', async () => {
      mockRepo.findOne.mockResolvedValue(baseConfig());
      let txCalled = false;
      mockRepo.manager.transaction.mockImplementation(
        async (
          cb: (m: {
            update: jest.Mock;
            save: jest.Mock;
          }) => Promise<ModelConfig>,
        ) => {
          txCalled = true;
          const txManager = {
            update: jest.fn().mockResolvedValue(undefined),
            save: jest
              .fn()
              .mockImplementation((_, entity) => Promise.resolve(entity)),
          };
          return cb(txManager);
        },
      );
      await service.update('cfg-1', 'ws-1', { isDefault: true });
      expect(txCalled).toBe(true);
    });

    it('isDefault=false sets isDefault to false without transaction', async () => {
      mockRepo.findOne.mockResolvedValue(baseConfig({ isDefault: true }));
      await service.update('cfg-1', 'ws-1', { isDefault: false });
      const saved = mockRepo.save.mock.calls[0][0];
      expect(saved.isDefault).toBe(false);
      expect(mockRepo.manager.transaction).not.toHaveBeenCalled();
    });

    it('throws NOT_FOUND when expectedKind mismatches entity kind', async () => {
      // A rerank entity must not be updateable through the chat kind path
      mockRepo.findOne.mockResolvedValue(baseConfig({ kind: 'rerank' as any }));
      await expect(
        service.update('cfg-1', 'ws-1', { name: 'Tampered' }, 'chat'),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });
  });

  // ── create — ENCRYPTION_KEY_MISSING error path ───────────────────────────

  describe('ENCRYPTION_KEY_MISSING', () => {
    it('throws ENCRYPTION_KEY_MISSING when encryptionKey is empty', async () => {
      // Build a service instance with no encryption key configured
      const moduleNoKey: TestingModule = await Test.createTestingModule({
        providers: [
          ModelConfigService,
          { provide: getRepositoryToken(ModelConfig), useValue: mockRepo },
          {
            provide: ConfigService,
            useValue: {
              get: jest.fn().mockReturnValue(''), // empty encryption key
            },
          },
        ],
      }).compile();
      const svcNoKey = moduleNoKey.get<ModelConfigService>(ModelConfigService);

      const dto = {
        kind: 'chat' as const,
        provider: 'openai' as const,
        name: 'X',
        apiKey: 'sk-anything',
        defaultModel: 'gpt-4o',
      };
      await expect(svcNoKey.create('ws-1', 'chat', dto)).rejects.toMatchObject({
        response: { code: 'ENCRYPTION_KEY_MISSING' },
      });
    });
  });

  // ── setDefault — kind scope isolation ────────────────────────────────────

  describe('setDefault', () => {
    it('swaps default within the entity kind scope', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'test-id',
        workspaceId: 'ws-1',
        kind: 'embedding',
      });
      await service.setDefault('test-id', 'ws-1');
      expect(mockRepo.manager.transaction).toHaveBeenCalled();
    });

    it('scopes the "unset default" UPDATE to workspaceId × kind', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'cfg-emb',
        workspaceId: 'ws-1',
        kind: 'embedding',
      });

      const updateCalls: Array<Record<string, unknown>> = [];
      mockRepo.manager.transaction.mockImplementation(
        async (cb: (m: { update: jest.Mock }) => Promise<void>) => {
          const txManager = {
            update: jest.fn().mockImplementation((_, condition) => {
              updateCalls.push(condition as Record<string, unknown>);
              return Promise.resolve(undefined);
            }),
          };
          await cb(txManager);
        },
      );

      await service.setDefault('cfg-emb', 'ws-1');

      // The first update call (unset old default) must scope to workspaceId × kind
      expect(updateCalls[0]).toMatchObject({
        workspaceId: 'ws-1',
        kind: 'embedding',
        isDefault: true,
      });
    });

    it('throws NotFoundException when kind mismatch via expectedKind guard', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'rerank-id',
        workspaceId: 'ws-1',
        kind: 'rerank',
      });
      await expect(
        service.setDefault('rerank-id', 'ws-1', 'chat'),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    });
  });

  // ── resolveConfig ─────────────────────────────────────────────────────────

  describe('resolveConfig', () => {
    it('throws when no id and no default for the kind', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resolveConfig(undefined, 'ws-1', 'rerank'),
      ).rejects.toThrow();
    });

    it('returns entity by id when id is provided (happy path)', async () => {
      const entity = {
        id: 'cfg-1',
        workspaceId: 'ws-1',
        kind: 'chat',
        apiKey: null,
      } as ModelConfig;
      mockRepo.findOne.mockResolvedValue(entity);
      const result = await service.resolveConfig('cfg-1', 'ws-1', 'chat');
      expect(result).toBe(entity);
      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'cfg-1', workspaceId: 'ws-1' },
      });
    });

    it('throws MODEL_CONFIG_NOT_FOUND when id is provided but entity.kind != requested kind (cross-kind leak prevention)', async () => {
      // A rerank config id must not be accessible via the chat kind path
      mockRepo.findOne.mockResolvedValue({
        id: 'rerank-cfg',
        workspaceId: 'ws-1',
        kind: 'rerank',
        apiKey: null,
      } as ModelConfig);
      await expect(
        service.resolveConfig('rerank-cfg', 'ws-1', 'chat'),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    });

    it('returns default entity when id is undefined and default exists', async () => {
      const defaultEntity = {
        id: 'default-cfg',
        workspaceId: 'ws-1',
        kind: 'chat',
        isDefault: true,
        apiKey: null,
      } as ModelConfig;
      // findEntity (for id path) returns null; findDefault returns defaultEntity
      mockRepo.findOne.mockResolvedValueOnce(defaultEntity); // called by findDefault
      const result = await service.resolveConfig(undefined, 'ws-1', 'chat');
      expect(result).toBe(defaultEntity);
    });
  });

  describe('resolveEmbedding (PR2 폴백 체인)', () => {
    it('(1) embeddingModelConfigId 지정 → kind=embedding config + config.defaultModel', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'emb-1',
        workspaceId: 'ws-1',
        kind: 'embedding',
        defaultModel: 'text-embedding-3-large',
        dimension: 3072,
      } as ModelConfig);
      const { config, model } = await service.resolveEmbedding({
        embeddingModelConfigId: 'emb-1',
        legacyModel: 'legacy-x',
        workspaceId: 'ws-1',
      });
      expect(config.id).toBe('emb-1');
      expect(model).toBe('text-embedding-3-large');
    });

    it('(1) embeddingModelConfigId 가 embedding kind 아니면 NOT_FOUND', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'x',
        workspaceId: 'ws-1',
        kind: 'chat',
      } as ModelConfig);
      await expect(
        service.resolveEmbedding({
          embeddingModelConfigId: 'x',
          legacyModel: 'm',
          workspaceId: 'ws-1',
        }),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    });

    it('(2) 미지정 + ws default kind=embedding → 그 default + defaultModel', async () => {
      mockRepo.findOne.mockImplementation(
        (opts: { where: Record<string, unknown> }) =>
          opts.where.kind === 'embedding' && opts.where.isDefault
            ? Promise.resolve({
                id: 'emb-def',
                workspaceId: 'ws-1',
                kind: 'embedding',
                defaultModel: 'emb-model',
              } as ModelConfig)
            : Promise.resolve(null),
      );
      const { config, model } = await service.resolveEmbedding({
        legacyModel: 'legacy-x',
        workspaceId: 'ws-1',
      });
      expect(config.id).toBe('emb-def');
      expect(model).toBe('emb-model');
    });

    it('(3) embedding 없음 → legacy(embeddingLlmConfigId + legacyModel)', async () => {
      mockRepo.findOne.mockImplementation(
        (opts: { where: Record<string, unknown> }) => {
          if (opts.where.kind === 'embedding') return Promise.resolve(null);
          if (opts.where.id === 'chat-1')
            return Promise.resolve({
              id: 'chat-1',
              workspaceId: 'ws-1',
              kind: 'chat',
            } as ModelConfig);
          return Promise.resolve(null);
        },
      );
      const { config, model } = await service.resolveEmbedding({
        embeddingLlmConfigId: 'chat-1',
        legacyModel: 'text-embedding-3-small',
        workspaceId: 'ws-1',
      });
      expect(config.id).toBe('chat-1');
      expect(model).toBe('text-embedding-3-small');
    });

    it('(3) legacy 둘 다 없으면 NOT_FOUND', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(
        service.resolveEmbedding({ legacyModel: 'm', workspaceId: 'ws-1' }),
      ).rejects.toThrow();
    });
  });

  // ── SSRF guard ────────────────────────────────────────────────────────────

  describe('SSRF guard', () => {
    it('rejects an external (cohere) baseUrl pointing to a loopback/link-local host', async () => {
      const dto = {
        kind: 'rerank' as const,
        provider: 'cohere' as const,
        name: 'Evil',
        apiKey: 'co-test123456789abcdef',
        baseUrl: 'http://169.254.169.254/latest/meta-data',
        defaultModel: 'rerank-3.5',
      };
      await expect(service.create('ws-1', 'rerank', dto)).rejects.toMatchObject(
        { response: { code: 'MODEL_CONFIG_INVALID' } },
      );
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('allows a self-hosted (tei) baseUrl to target a private host', async () => {
      const dto = {
        kind: 'rerank' as const,
        provider: 'tei' as const,
        name: 'TEI private',
        baseUrl: 'http://10.0.0.5:8080',
        defaultModel: 'bge-reranker-v2-m3',
      };
      await expect(
        service.create('ws-1', 'rerank', dto),
      ).resolves.toBeDefined();
      expect(mockRepo.save).toHaveBeenCalled();
    });

    it('rejects switching provider to cohere while keeping a private baseUrl', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'r1',
        workspaceId: 'ws-1',
        kind: 'rerank',
        provider: 'tei',
        baseUrl: 'http://127.0.0.1:8080',
        apiKey: null,
      });
      await expect(
        service.update('r1', 'ws-1', { provider: 'cohere' }),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_INVALID' } });
      expect(mockRepo.save).not.toHaveBeenCalled();
    });

    it('rejects a domain-based SSRF that resolves to a private address', async () => {
      // Mock resolvesToPrivate to simulate attacker.com → 10.0.0.1
      const spy = jest
        .spyOn(ssrfUtil, 'resolvesToPrivate')
        .mockResolvedValue(true);

      const dto = {
        kind: 'chat' as const,
        provider: 'openai' as const,
        name: 'SSRF via DNS',
        apiKey: 'sk-test-dns-ssrf-1234',
        baseUrl: 'http://attacker.com/evil',
        defaultModel: 'gpt-4o',
      };
      await expect(service.create('ws-1', 'chat', dto)).rejects.toMatchObject({
        response: { code: 'MODEL_CONFIG_INVALID' },
      });
      expect(spy).toHaveBeenCalled();
      expect(mockRepo.save).not.toHaveBeenCalled();
      spy.mockRestore();
    });

    it('allows a domain whose DNS does NOT resolve to a private address', async () => {
      const spy = jest
        .spyOn(ssrfUtil, 'resolvesToPrivate')
        .mockResolvedValue(false);

      const dto = {
        kind: 'chat' as const,
        provider: 'openai' as const,
        name: 'External LLM proxy',
        apiKey: 'sk-test-proxy-key-1234',
        baseUrl: 'https://proxy.example.com/v1',
        defaultModel: 'gpt-4o',
      };
      await expect(service.create('ws-1', 'chat', dto)).resolves.toBeDefined();
      expect(spy).toHaveBeenCalled();
      spy.mockRestore();
    });
  });

  // ── findEntity — expectedKind guard ──────────────────────────────────────

  describe('findEntity expectedKind guard', () => {
    it('returns entity when kind matches expectedKind', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'cfg-1',
        workspaceId: 'ws-1',
        kind: 'chat',
      });
      const entity = await service.findEntity('cfg-1', 'ws-1', 'chat');
      expect(entity).toBeDefined();
    });

    it('throws NOT_FOUND when kind mismatches expectedKind (cross-kind leak prevention)', async () => {
      // rerank config accessed via chat alias path
      mockRepo.findOne.mockResolvedValue({
        id: 'rerank-1',
        workspaceId: 'ws-1',
        kind: 'rerank',
      });
      await expect(
        service.findEntity('rerank-1', 'ws-1', 'chat'),
      ).rejects.toMatchObject({ response: { code: 'MODEL_CONFIG_NOT_FOUND' } });
    });
  });
});
