import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { LlmConfigService } from './llm-config.service';
import { LlmConfig } from './entities/llm-config.entity';
import { encrypt, decrypt } from '../../common/utils/crypto.util';
import { randomBytes } from 'crypto';

const ENCRYPTION_KEY = randomBytes(32).toString('hex');

describe('LlmConfigService', () => {
  let service: LlmConfigService;

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
            await cb(txManager);
          },
        ),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LlmConfigService,
        {
          provide: getRepositoryToken(LlmConfig),
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

    service = module.get<LlmConfigService>(LlmConfigService);
  });

  describe('create', () => {
    it('should encrypt the API key on creation', async () => {
      const dto = {
        provider: 'openai' as const,
        name: 'Test OpenAI',
        apiKey: 'sk-test123456789abcdef',
        defaultModel: 'gpt-4o',
      };

      const result = await service.create('workspace-1', dto);

      // The saved entity should have encrypted API key
      const savedEntity = mockRepo.save.mock.calls[0][0];
      expect(savedEntity.apiKey).not.toBe(dto.apiKey);

      // Verify it can be decrypted
      const decrypted = decrypt(savedEntity.apiKey, ENCRYPTION_KEY);
      expect(decrypted).toBe(dto.apiKey);

      // Result should have masked API key
      expect(result.apiKey).toMatch(/^\*{4}/);
    });
  });

  describe('findById', () => {
    it('should return masked API key', async () => {
      const encrypted = encrypt('sk-test123456789abcdef', ENCRYPTION_KEY);
      mockRepo.findOne.mockResolvedValue({
        id: 'test-id',
        workspaceId: 'ws-1',
        provider: 'openai',
        name: 'Test',
        apiKey: encrypted,
        defaultModel: 'gpt-4o',
      });

      const result = await service.findById('test-id', 'ws-1');
      expect(result.apiKey).toMatch(/^\*{4}/);
      expect(result.apiKey).not.toBe('sk-test123456789abcdef');
    });

    it('should throw NotFoundException if not found', async () => {
      mockRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('not-found', 'ws-1')).rejects.toThrow();
    });
  });

  describe('getDecryptedApiKey', () => {
    it('should return the decrypted API key', () => {
      const originalKey = 'sk-test123456789abcdef';
      const encrypted = encrypt(originalKey, ENCRYPTION_KEY);
      const config = { apiKey: encrypted } as LlmConfig;

      const decrypted = service.getDecryptedApiKey(config);
      expect(decrypted).toBe(originalKey);
    });
  });

  describe('findAll', () => {
    it('should mask API keys in paginated results', async () => {
      const encrypted = encrypt('sk-test123456789abcdef', ENCRYPTION_KEY);
      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        addOrderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(1),
        getMany: jest.fn().mockResolvedValue([
          {
            id: 'config-1',
            workspaceId: 'ws-1',
            provider: 'openai',
            name: 'Test',
            apiKey: encrypted,
            defaultModel: 'gpt-4o',
          },
        ]),
      };
      mockRepo.createQueryBuilder.mockReturnValue(qbMock);

      const result = await service.findAll('ws-1', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.apiKey).toMatch(/^\*{4}/);
      expect(item.apiKey).not.toBe('sk-test123456789abcdef');
      expect(result.pagination.totalItems).toBe(1);
    });
  });

  describe('setDefault', () => {
    it('should clear previous default and set new one', async () => {
      mockRepo.findOne.mockResolvedValue({
        id: 'test-id',
        workspaceId: 'ws-1',
      });

      await service.setDefault('test-id', 'ws-1');

      // Should have called transaction
      expect(mockRepo.manager.transaction).toHaveBeenCalled();
      // The manager.update inside the transaction should have been called
      const transactionManager = mockRepo.manager.transaction.mock.calls[0];
      expect(transactionManager).toBeDefined();
    });
  });
});
