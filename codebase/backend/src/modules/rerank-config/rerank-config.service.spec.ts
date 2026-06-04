import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { RerankConfigService } from './rerank-config.service';
import { RerankConfig } from './entities/rerank-config.entity';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { randomBytes } from 'crypto';

const ENCRYPTION_KEY = randomBytes(32).toString('hex');

describe('RerankConfigService', () => {
  let service: RerankConfigService;
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
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
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
            return cb(txManager);
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RerankConfigService,
        {
          provide: getRepositoryToken(RerankConfig),
          useValue: mockRepo,
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'llm.encryptionKey') return ENCRYPTION_KEY;
              return undefined;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<RerankConfigService>(RerankConfigService);
  });

  describe('create', () => {
    it('should encrypt the API key when provided (cohere)', async () => {
      const dto = {
        provider: 'cohere' as const,
        name: 'Cohere Rerank',
        apiKey: 'co-test123456789abcdef',
        defaultModel: 'rerank-3.5',
      };

      const result = await service.create('workspace-1', dto);

      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity.apiKey).not.toBe(dto.apiKey);
      expect(decrypt(savedEntity.apiKey, ENCRYPTION_KEY)).toBe(dto.apiKey);
      expect(result.apiKey).toMatch(/^\*{4}/);
    });

    it('should store null apiKey when omitted (tei)', async () => {
      const dto = {
        provider: 'tei' as const,
        name: 'TEI Rerank',
        baseUrl: 'http://tei:8080',
        defaultModel: 'bge-reranker-v2-m3',
      };

      const result = await service.create('workspace-1', dto);

      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity.apiKey).toBeNull();
      expect(result.apiKey).toBeNull();
    });
  });

  describe('resolveConfig', () => {
    it('should resolve by id via findEntity', async () => {
      const entity = { id: 'r1', workspaceId: 'ws1', provider: 'tei' };
      mockRepo.findOne.mockResolvedValueOnce(entity);

      const result = await service.resolveConfig('r1', 'ws1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'r1', workspaceId: 'ws1' },
      });
      expect(result).toBe(entity);
    });

    it('should resolve workspace default when no id provided', async () => {
      const def = { id: 'def', workspaceId: 'ws1', isDefault: true };
      mockRepo.findOne.mockResolvedValueOnce(def);

      const result = await service.resolveConfig(undefined, 'ws1');

      expect(mockRepo.findOne).toHaveBeenCalledWith({
        where: { workspaceId: 'ws1', isDefault: true },
      });
      expect(result).toBe(def);
    });

    it('should throw BadRequest RERANK_CONFIG_NOT_FOUND when no default exists', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.resolveConfig(undefined, 'ws1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw NotFound when id not found', async () => {
      mockRepo.findOne.mockResolvedValueOnce(null);

      await expect(service.resolveConfig('missing', 'ws1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getDecryptedApiKey', () => {
    it('returns decrypted key when present', () => {
      const encrypted = encrypt('secret-key', ENCRYPTION_KEY);
      const config = { apiKey: encrypted } as RerankConfig;
      expect(service.getDecryptedApiKey(config)).toBe('secret-key');
    });

    it('returns null when apiKey is null', () => {
      const config = { apiKey: null } as unknown as RerankConfig;
      expect(service.getDecryptedApiKey(config)).toBeNull();
    });
  });

  describe('maskApiKey (via findById)', () => {
    it('masks the apiKey with last 4 chars', async () => {
      const encrypted = encrypt('co-abcd1234WXYZ', ENCRYPTION_KEY);
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'r1',
        workspaceId: 'ws1',
        apiKey: encrypted,
        provider: 'cohere',
      });

      const result = await service.findById('r1', 'ws1');
      expect(result.apiKey).toBe('****WXYZ');
    });

    it('exposes null apiKey gracefully', async () => {
      mockRepo.findOne.mockResolvedValueOnce({
        id: 'r1',
        workspaceId: 'ws1',
        apiKey: null,
        provider: 'tei',
      });

      const result = await service.findById('r1', 'ws1');
      expect(result.apiKey).toBeNull();
    });
  });
});
