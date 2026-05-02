import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { S3Service } from '../../common/services/s3.service';
import { EmbeddingService } from './embedding/embedding.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockDocRepo: Record<string, jest.Mock>;
  let mockS3Service: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let mockEmbeddingService: Record<string, jest.Mock>;

  beforeEach(async () => {
    const qbMock = {
      where: jest.fn().mockReturnThis(),
      andWhere: jest.fn().mockReturnThis(),
      orderBy: jest.fn().mockReturnThis(),
      skip: jest.fn().mockReturnThis(),
      take: jest.fn().mockReturnThis(),
      getCount: jest.fn().mockResolvedValue(2),
      getMany: jest.fn().mockResolvedValue([
        { id: 'kb-1', name: 'KB One' },
        { id: 'kb-2', name: 'KB Two' },
      ]),
    };

    mockKbRepo = {
      createQueryBuilder: jest.fn(() => ({ ...qbMock })),
      findOne: jest.fn(),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve({ id: 'kb-new', ...entity })),
      remove: jest.fn().mockResolvedValue(undefined),
    };

    mockDocRepo = {
      createQueryBuilder: jest.fn(() => ({
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      })),
      findOne: jest.fn(),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((data) => ({ ...data })),
      save: jest.fn((entity) => Promise.resolve(entity)),
      remove: jest.fn().mockResolvedValue(undefined),
      count: jest.fn().mockResolvedValue(1),
      update: jest.fn().mockResolvedValue(undefined),
    };

    mockS3Service = {
      upload: jest.fn().mockResolvedValue('s3-key'),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    mockEmbeddingService = {
      processDocument: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        { provide: getRepositoryToken(KnowledgeBase), useValue: mockKbRepo },
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        { provide: S3Service, useValue: mockS3Service },
        { provide: DataSource, useValue: mockDataSource },
        { provide: EmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    service = module.get<KnowledgeBaseService>(KnowledgeBaseService);
  });

  describe('findAll', () => {
    it('should return paginated results', async () => {
      const result = await service.findAll('ws-1', { page: 1, limit: 20 });
      expect(result.data).toHaveLength(2);
      expect(result.pagination.totalItems).toBe(2);
      expect(result.pagination.page).toBe(1);
      expect(mockKbRepo.createQueryBuilder).toHaveBeenCalledWith('kb');
    });
  });

  describe('findById', () => {
    it('should return the knowledge base when found', async () => {
      const kb = { id: 'kb-1', workspaceId: 'ws-1', name: 'Test KB' };
      mockKbRepo.findOne.mockResolvedValue(kb);

      const result = await service.findById('kb-1', 'ws-1');
      expect(result).toEqual(kb);
      expect(mockKbRepo.findOne).toHaveBeenCalledWith({
        where: { id: 'kb-1', workspaceId: 'ws-1' },
      });
    });

    it('should throw NotFoundException when not found', async () => {
      mockKbRepo.findOne.mockResolvedValue(null);
      await expect(service.findById('not-found', 'ws-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('should create a knowledge base with correct defaults', async () => {
      const dto = { name: 'New KB' };
      const result = await service.create('ws-1', dto);

      expect(mockKbRepo.create).toHaveBeenCalledWith({
        workspaceId: 'ws-1',
        name: 'New KB',
        description: undefined,
        embeddingModel: 'text-embedding-3-small',
        chunkSize: 1000,
        chunkOverlap: 200,
      });
      expect(mockKbRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });
  });

  describe('update', () => {
    it('should apply embeddingModel change', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        name: 'KB',
        description: null,
        embeddingModel: 'text-embedding-3-small',
        embeddingDimension: 1536,
        chunkSize: 1000,
        chunkOverlap: 200,
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update('kb-1', 'ws-1', {
        embeddingModel: 'text-embedding-3-large',
      });

      expect(result.embeddingModel).toBe('text-embedding-3-large');
      // embeddingDimension is left untouched until KB-wide re-embed runs
      expect(result.embeddingDimension).toBe(1536);
    });
  });

  describe('reEmbedAll', () => {
    it('should reset embedding_dimension and queue re-embedding for every doc', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
      });
      mockDocRepo.find.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/UPDATE knowledge_base SET embedding_dimension/),
        ['kb-1'],
      );
      expect(mockEmbeddingService.processDocument).toHaveBeenCalledTimes(2);
      expect(mockEmbeddingService.processDocument).toHaveBeenNthCalledWith(
        1,
        'd1',
        true,
      );
      expect(mockEmbeddingService.processDocument).toHaveBeenNthCalledWith(
        2,
        'd2',
        true,
      );
      expect(result).toEqual({ documentCount: 2 });
    });

    it('should still succeed for empty KB', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
      });
      mockDocRepo.find.mockResolvedValue([]);

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(mockEmbeddingService.processDocument).not.toHaveBeenCalled();
      expect(result).toEqual({ documentCount: 0 });
    });
  });

  describe('uploadDocument', () => {
    const mockFile = {
      originalname: 'test.txt',
      buffer: Buffer.from('hello world'),
      size: 11,
    } as Express.Multer.File;

    beforeEach(() => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        documentCount: 0,
      });
    });

    it('should validate file type, upload to S3, and create document record', async () => {
      const result = await service.uploadDocument('kb-1', 'ws-1', mockFile);

      expect(mockS3Service.upload).toHaveBeenCalledWith(
        expect.stringContaining('kb/kb-1/'),
        mockFile.buffer,
        'text/plain',
      );
      expect(mockDocRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          knowledgeBaseId: 'kb-1',
          name: 'test.txt',
          fileType: 'txt',
          fileSize: 11,
          embeddingStatus: 'pending',
        }),
      );
      expect(mockDocRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should reject invalid file types', async () => {
      const badFile = {
        originalname: 'test.exe',
        buffer: Buffer.from('data'),
        size: 4,
      } as Express.Multer.File;

      await expect(
        service.uploadDocument('kb-1', 'ws-1', badFile),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('removeDocument', () => {
    it('should remove from S3 and DB', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        documentCount: 1,
      });
      mockDocRepo.findOne.mockResolvedValue({
        id: 'doc-1',
        knowledgeBaseId: 'kb-1',
        fileUrl: 'kb/kb-1/doc-1/file.txt',
      });

      await service.removeDocument('doc-1', 'kb-1', 'ws-1');

      expect(mockS3Service.delete).toHaveBeenCalledWith(
        'kb/kb-1/doc-1/file.txt',
      );
      expect(mockDocRepo.remove).toHaveBeenCalled();
    });
  });
});
