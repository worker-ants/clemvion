import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { ConflictException } from '@nestjs/common';
import { KnowledgeBaseService } from './knowledge-base.service';
import { KnowledgeBase } from './entities/knowledge-base.entity';
import { Document } from './entities/document.entity';
import { S3Service } from '../../common/services/s3.service';
import { DOCUMENT_EMBEDDING_QUEUE } from './queues/document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from './queues/graph-extraction.queue';
import { LlmService } from '../llm/llm.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockDocRepo: Record<string, jest.Mock>;
  let mockS3Service: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let mockEmbeddingQueue: Record<string, jest.Mock>;
  let mockGraphQueue: Record<string, jest.Mock>;
  let mockLlmService: Record<string, jest.Mock>;

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
        innerJoin: jest.fn().mockReturnThis(),
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

    // reExtractAll 이 트랜잭션 안에서 atomic 으로 잠금/삭제/조회를 수행하므로 mock 에
    // transaction 을 추가. 테스트는 manager.query 호출을 dataSource.query 호출과 동일하게 캡처하기
    // 위해 transaction 콜백에 같은 mock 을 넘겨준다.
    const txManagerProxy = {
      query: (...args: unknown[]) => mockDataSource.query(...args),
    };
    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(txManagerProxy)),
    };

    mockEmbeddingQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      addBulk: jest.fn().mockResolvedValue([]),
    };
    mockGraphQueue = {
      add: jest.fn().mockResolvedValue(undefined),
      addBulk: jest.fn().mockResolvedValue([]),
    };
    mockLlmService = {
      resolveConfig: jest.fn(),
      embed: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        KnowledgeBaseService,
        { provide: getRepositoryToken(KnowledgeBase), useValue: mockKbRepo },
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        { provide: S3Service, useValue: mockS3Service },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getQueueToken(DOCUMENT_EMBEDDING_QUEUE),
          useValue: mockEmbeddingQueue,
        },
        {
          provide: getQueueToken(GRAPH_EXTRACTION_QUEUE),
          useValue: mockGraphQueue,
        },
        { provide: LlmService, useValue: mockLlmService },
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
        embeddingLlmConfigId: null,
        chunkSize: 1000,
        chunkOverlap: 200,
        ragMode: 'vector',
        extractionLlmConfigId: null,
        maxHops: 1,
        vectorSeedTopK: 5,
        expandedChunkLimit: 15,
        rerankMode: 'off',
        rerankConfigId: null,
        rerankCandidateK: 50,
        rerankScoreThreshold: null,
        rerankLlmConfigId: null,
      });
      expect(mockKbRepo.save).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it('should propagate graph mode parameters', async () => {
      const dto = {
        name: 'Graph KB',
        ragMode: 'graph' as const,
        extractionLlmConfigId: 'llm-cfg-1',
        maxHops: 2,
        vectorSeedTopK: 7,
        expandedChunkLimit: 20,
      };
      await service.create('ws-1', dto);

      expect(mockKbRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          ragMode: 'graph',
          extractionLlmConfigId: 'llm-cfg-1',
          maxHops: 2,
          vectorSeedTopK: 7,
          expandedChunkLimit: 20,
        }),
      );
    });

    it('should propagate embeddingLlmConfigId when provided', async () => {
      const dto = {
        name: 'Custom Embed KB',
        embeddingLlmConfigId: 'llm-cfg-emb',
      };
      await service.create('ws-1', dto);

      expect(mockKbRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          embeddingLlmConfigId: 'llm-cfg-emb',
        }),
      );
    });
  });

  describe('reExtractAll', () => {
    it('should reject for non-graph KB with KB_NOT_GRAPH_MODE', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });

      await expect(service.reExtractAll('kb-1', 'ws-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'KB_NOT_GRAPH_MODE' }),
      });
    });

    it('atomically acquires reextract_status, deletes entities, queues docs', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'graph',
      });
      // 트랜잭션 내부 query 순서:
      // 1) UPDATE knowledge_base ... acquire CAS
      // 2) DELETE FROM entity ...
      // 3) UPDATE document SET graph_extraction_status ...
      // 4) SELECT id FROM document ...
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);

      const result = await service.reExtractAll('kb-1', 'ws-1');

      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/SET reextract_status = 'in_progress'/),
        ['kb-1', 'ws-1'],
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/DELETE FROM entity/),
        ['kb-1'],
      );
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        3,
        expect.stringMatching(
          /UPDATE document\s+SET graph_extraction_status = 'pending'[\s\S]*graph_retry_count = 0/,
        ),
        ['kb-1'],
      );
      expect(mockGraphQueue.addBulk).toHaveBeenCalledWith([
        {
          name: 'extract',
          data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
        },
        {
          name: 'extract',
          data: { documentId: 'd2', knowledgeBaseId: 'kb-1', isKbBatch: true },
        },
      ]);
      expect(result).toEqual({ documentCount: 2 });
    });

    it('rejects concurrent re-extract with 409', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'graph',
      });
      mockDataSource.query.mockResolvedValueOnce([]); // 0 rows = already in progress

      await expect(service.reExtractAll('kb-1', 'ws-1')).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'KB_REEXTRACT_IN_PROGRESS' }),
      });
    });
  });

  describe('reExtractDocument', () => {
    it('rejects for non-graph KB', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });

      await expect(
        service.reExtractDocument('d1', 'kb-1', 'ws-1'),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'KB_NOT_GRAPH_MODE' }),
      });
    });

    it('queues extract job and resets status to pending', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'graph',
      });
      mockDocRepo.findOne.mockResolvedValue({
        id: 'd1',
        knowledgeBaseId: 'kb-1',
      });

      await service.reExtractDocument('d1', 'kb-1', 'ws-1');

      expect(mockDocRepo.update).toHaveBeenCalledWith('d1', {
        graphExtractionStatus: 'pending',
        graphRetryCount: 0,
        graphErrorMessage: null,
      });
      expect(mockGraphQueue.add).toHaveBeenCalledWith('extract', {
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
      });
    });
  });

  describe('update', () => {
    it('should reset embeddingDimension when embeddingModel changes', async () => {
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
      // 새 모델 첫 임베딩이 차원을 다시 채울 때까지 NULL 로 둔다
      expect(result.embeddingDimension).toBeNull();
    });

    it('should keep embeddingDimension intact when embeddingModel is unchanged', async () => {
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
        embeddingModel: 'text-embedding-3-small',
      });

      expect(result.embeddingDimension).toBe(1536);
    });

    it('should set embeddingLlmConfigId when provided', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingLlmConfigId: null,
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update('kb-1', 'ws-1', {
        embeddingLlmConfigId: 'llm-cfg-emb',
      });

      expect(result.embeddingLlmConfigId).toBe('llm-cfg-emb');
    });

    it('should reset embeddingLlmConfigId to null (back to ws default)', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingLlmConfigId: 'llm-cfg-emb',
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update('kb-1', 'ws-1', {
        embeddingLlmConfigId: null,
      });

      expect(result.embeddingLlmConfigId).toBeNull();
    });
  });

  describe('probeEmbedding', () => {
    it('returns dimension and provider on successful embed', async () => {
      mockLlmService.resolveConfig.mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
      });
      mockLlmService.embed.mockResolvedValue([new Array(1536).fill(0.01)]);

      const result = await service.probeEmbedding('ws-1', {
        llmConfigId: 'cfg-1',
        embeddingModel: 'text-embedding-3-small',
      });

      expect(result).toEqual({ dimension: 1536, provider: 'openai' });
      expect(mockLlmService.embed).toHaveBeenCalledWith(
        expect.objectContaining({ provider: 'openai' }),
        ['probe'],
        'text-embedding-3-small',
      );
    });

    it('throws EMBEDDING_PROBE_FAILED with sanitized message on provider error', async () => {
      mockLlmService.resolveConfig.mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
      });
      mockLlmService.embed.mockRejectedValue(
        new Error('Bad gateway https://internal.example.com/v1'),
      );

      await expect(
        service.probeEmbedding('ws-1', {
          embeddingModel: 'text-embedding-3-small',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EMBEDDING_PROBE_FAILED' }),
      });
    });

    it('throws EMBEDDING_PROBE_FAILED when provider returns empty vector', async () => {
      mockLlmService.resolveConfig.mockResolvedValue({
        id: 'cfg-1',
        provider: 'openai',
      });
      mockLlmService.embed.mockResolvedValue([[]]);

      await expect(
        service.probeEmbedding('ws-1', {
          embeddingModel: 'text-embedding-3-small',
        }),
      ).rejects.toMatchObject({
        response: expect.objectContaining({ code: 'EMBEDDING_PROBE_FAILED' }),
      });
    });
  });

  describe('reEmbedAll', () => {
    beforeEach(() => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
      });
    });

    it('should atomically acquire reembed_status and enqueue all docs', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ id: 'kb-1' }]);
      mockDocRepo.find.mockResolvedValue([{ id: 'd1' }, { id: 'd2' }]);

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/SET reembed_status = 'in_progress'/),
        ['kb-1', 'ws-1'],
      );
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledWith([
        {
          name: 'embed',
          data: {
            documentId: 'd1',
            reEmbed: true,
            isKbBatch: true,
            knowledgeBaseId: 'kb-1',
          },
        },
        {
          name: 'embed',
          data: {
            documentId: 'd2',
            reEmbed: true,
            isKbBatch: true,
            knowledgeBaseId: 'kb-1',
          },
        },
      ]);
      expect(result).toEqual({
        documentCount: 2,
        chainedGraphExtraction: false,
      });
    });

    it('should immediately reset to idle for empty KB (no child job to finalize)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce([]); // reset to idle
      mockDocRepo.find.mockResolvedValue([]);

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(mockEmbeddingQueue.addBulk).not.toHaveBeenCalled();
      expect(mockDataSource.query).toHaveBeenLastCalledWith(
        expect.stringMatching(/SET reembed_status = 'idle'/),
        ['kb-1'],
      );
      expect(result).toEqual({
        documentCount: 0,
        chainedGraphExtraction: false,
      });
    });

    it('should throw 409 when reembed is already in progress (atomic 0 rows)', async () => {
      // atomic compare-and-swap returns 0 rows → conflict
      mockDataSource.query.mockResolvedValueOnce([]);

      await expect(service.reEmbedAll('kb-1', 'ws-1')).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(mockEmbeddingQueue.addBulk).not.toHaveBeenCalled();
      expect(mockDocRepo.find).not.toHaveBeenCalled();
    });
  });

  describe('enqueueEmbedding', () => {
    it('should add a job and inject ragMode/knowledgeBaseId from DB', async () => {
      // 호출자가 KB 정보를 안 넘기면 service 가 한 번 조회해 payload 에 채운다.
      mockDataSource.query.mockResolvedValueOnce([
        { rag_mode: 'graph', knowledge_base_id: 'kb-1' },
      ]);

      await service.enqueueEmbedding('doc-1');

      expect(mockEmbeddingQueue.add).toHaveBeenCalledWith('embed', {
        documentId: 'doc-1',
        reEmbed: false,
        ragMode: 'graph',
        knowledgeBaseId: 'kb-1',
      });
    });

    it('should propagate reEmbed and skip DB lookup when caller already has KB info', async () => {
      await service.enqueueEmbedding('doc-1', {
        reEmbed: true,
        ragMode: 'vector',
        knowledgeBaseId: 'kb-2',
      });

      // 호출자가 KB 정보를 모두 제공했으니 service 는 DB 조회를 하지 않는다.
      expect(mockDataSource.query).not.toHaveBeenCalled();
      expect(mockEmbeddingQueue.add).toHaveBeenCalledWith('embed', {
        documentId: 'doc-1',
        reEmbed: true,
        ragMode: 'vector',
        knowledgeBaseId: 'kb-2',
      });
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

    it('should re-decode latin1-mangled UTF-8 filenames (Multer/busboy quirk) and NFC-normalize macOS NFD', async () => {
      // 시나리오: 사용자가 macOS Finder 에서 "한글파일.txt" 를 업로드.
      // 1) macOS HFS/APFS 는 NFD (분리형) 로 저장 — '한' = U+1112 + U+1161 + U+11AB
      // 2) 브라우저는 RFC 7578 에 따라 UTF-8 로 인코딩해 전송.
      // 3) Multer/busboy 는 multipart filename 헤더를 latin1 로 디코딩 → 한 바이트씩 잘려 깨짐.
      // 우리 코드는 latin1→UTF-8 재해석 + NFC 정규화로 원본 한글 + 결합형으로 복원해야 한다.
      const nfd = '한글파일.txt'.normalize('NFD');
      const utf8Bytes = Buffer.from(nfd, 'utf8');
      const mangled = utf8Bytes.toString('latin1');
      const macFile = {
        originalname: mangled,
        buffer: Buffer.from('hello'),
        size: 5,
      } as Express.Multer.File;

      await service.uploadDocument('kb-1', 'ws-1', macFile);

      expect(mockDocRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          // NFC 결합형으로 정규화된 원본 파일명이 저장돼야 한다.
          name: '한글파일.txt'.normalize('NFC'),
          fileType: 'txt',
        }),
      );
    });
  });

  describe('remove (KB 삭제 시 S3 정리)', () => {
    // C-19: S3 정리 루프가 workspace 필터 없이 문서를 조회하던 결함의 회귀 가드 —
    // defense-in-depth 로 knowledgeBase JOIN + workspace_id 조건을 명시한다.
    it('workspace 필터(innerJoin + kb.workspace_id)로 문서를 조회해 S3 정리 후 KB 삭제', async () => {
      const kb = { id: 'kb-1', workspaceId: 'ws-1' };
      mockKbRepo.findOne.mockResolvedValue(kb);

      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([
          { id: 'd1', fileUrl: 'kb/kb-1/d1/a.txt' },
          { id: 'd2', fileUrl: 'kb/kb-1/d2/b.txt' },
        ]),
      };
      mockDocRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.remove('kb-1', 'ws-1');

      expect(qb.innerJoin).toHaveBeenCalledWith('d.knowledgeBase', 'kb');
      expect(qb.andWhere).toHaveBeenCalledWith(
        'kb.workspace_id = :workspaceId',
        {
          workspaceId: 'ws-1',
        },
      );
      expect(mockS3Service.delete).toHaveBeenCalledWith('kb/kb-1/d1/a.txt');
      expect(mockS3Service.delete).toHaveBeenCalledWith('kb/kb-1/d2/b.txt');
      expect(mockKbRepo.remove).toHaveBeenCalledWith(kb);
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

  describe('getEmbeddingStats', () => {
    it('완료/실패/진행/총 카운트를 SQL 결과에서 매핑', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        reembedStatus: 'idle',
      });
      mockDataSource.query.mockResolvedValueOnce([
        { completed: 5, failed: 2, pending: 1, total: 8 },
      ]);

      const result = await service.getEmbeddingStats('kb-1', 'ws-1');

      expect(result).toEqual({
        completedDocumentCount: 5,
        failedDocumentCount: 2,
        pendingDocumentCount: 1,
        totalDocumentCount: 8,
        reembedStatus: 'idle',
      });
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /COUNT\(\*\) FILTER \(WHERE embedding_status = 'completed'\)/,
        ),
        ['kb-1'],
      );
    });

    it('빈 KB 면 모든 카운트가 0', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        reembedStatus: 'idle',
      });
      mockDataSource.query.mockResolvedValueOnce([]);

      const result = await service.getEmbeddingStats('kb-1', 'ws-1');

      expect(result.completedDocumentCount).toBe(0);
      expect(result.failedDocumentCount).toBe(0);
      expect(result.pendingDocumentCount).toBe(0);
      expect(result.totalDocumentCount).toBe(0);
    });
  });

  describe('getGraphStats', () => {
    it('failed/pending/extracted 카운트를 함께 반환', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'graph',
        entityCount: 100,
        relationCount: 50,
        reextractStatus: 'idle',
      });
      mockDataSource.query.mockResolvedValueOnce([
        { extracted: 4, failed: 1, pending: 1, total: 6 },
      ]);

      const result = await service.getGraphStats('kb-1', 'ws-1');

      expect(result).toEqual({
        entityCount: 100,
        relationCount: 50,
        extractedDocumentCount: 4,
        failedDocumentCount: 1,
        pendingDocumentCount: 1,
        totalDocumentCount: 6,
        reextractStatus: 'idle',
      });
    });
  });

  describe('verifyDocumentOwnership', () => {
    it('같은 workspace 의 문서 → true', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ id: 'd1' }]);
      const result = await service.verifyDocumentOwnership('d1', 'ws-1');
      expect(result).toBe(true);
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(
          /SELECT[\s\S]*FROM document[\s\S]*JOIN knowledge_base/,
        ),
        ['d1', 'ws-1'],
      );
    });

    it('다른 workspace 의 문서 / 미존재 → false', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);
      const result = await service.verifyDocumentOwnership(
        'd-victim',
        'ws-attacker',
      );
      expect(result).toBe(false);
    });

    it('빈 documentId / workspaceId 는 SELECT 없이 false', async () => {
      const a = await service.verifyDocumentOwnership('', 'ws-1');
      const b = await service.verifyDocumentOwnership('d1', '');
      expect(a).toBe(false);
      expect(b).toBe(false);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('retryFailedDocuments', () => {
    it("scope='embedding': failed 문서만 UPDATE + addBulk", async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });
      mockDataSource.query.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);

      const result = await service.retryFailedDocuments(
        'kb-1',
        'ws-1',
        'embedding',
      );

      expect(result).toEqual({ embeddingRequeued: 2, graphRequeued: 0 });
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledWith([
        {
          name: 'embed',
          data: {
            documentId: 'd1',
            knowledgeBaseId: 'kb-1',
            ragMode: 'vector',
            reEmbed: true,
          },
        },
        {
          name: 'embed',
          data: {
            documentId: 'd2',
            knowledgeBaseId: 'kb-1',
            ragMode: 'vector',
            reEmbed: true,
          },
        },
      ]);
      expect(mockGraphQueue.addBulk).not.toHaveBeenCalled();
    });

    it("scope='graph' on vector mode: 0건 반환, 큐 호출 없음", async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });

      const result = await service.retryFailedDocuments(
        'kb-1',
        'ws-1',
        'graph',
      );

      expect(result).toEqual({ embeddingRequeued: 0, graphRequeued: 0 });
      expect(mockGraphQueue.addBulk).not.toHaveBeenCalled();
      expect(mockEmbeddingQueue.addBulk).not.toHaveBeenCalled();
    });

    it("scope='all' on graph mode: 둘 다 처리", async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'graph',
      });
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'd1' }]) // embedding 1건
        .mockResolvedValueOnce([{ id: 'd2' }, { id: 'd3' }]); // graph 2건

      const result = await service.retryFailedDocuments('kb-1', 'ws-1', 'all');

      expect(result).toEqual({ embeddingRequeued: 1, graphRequeued: 2 });
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(mockGraphQueue.addBulk).toHaveBeenCalledTimes(1);
    });

    it('대상 없으면 큐 호출 없이 0건 반환', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });
      mockDataSource.query.mockResolvedValue([]);

      const result = await service.retryFailedDocuments('kb-1', 'ws-1', 'all');

      expect(result).toEqual({ embeddingRequeued: 0, graphRequeued: 0 });
      expect(mockEmbeddingQueue.addBulk).not.toHaveBeenCalled();
      expect(mockGraphQueue.addBulk).not.toHaveBeenCalled();
    });

    it('addBulk 실패 시 해당 chunk 를 failed 로 롤백 후 throw', async () => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });
      mockDataSource.query.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]);
      mockEmbeddingQueue.addBulk.mockRejectedValueOnce(
        new Error('Redis connection refused'),
      );

      await expect(
        service.retryFailedDocuments('kb-1', 'ws-1', 'embedding'),
      ).rejects.toThrow('Redis connection refused');

      // 마지막 dataSource.query 호출이 rollback UPDATE
      const lastCall =
        mockDataSource.query.mock.calls[
          mockDataSource.query.mock.calls.length - 1
        ];
      expect(lastCall[0]).toMatch(
        /UPDATE document SET embedding_status = 'failed' WHERE id = ANY/,
      );
      expect(lastCall[1]).toEqual([['d1', 'd2']]);
    });
  });
});
