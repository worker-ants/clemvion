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
import { ModelConfigService } from '../model-config/model-config.service';

describe('KnowledgeBaseService', () => {
  let service: KnowledgeBaseService;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockDocRepo: Record<string, jest.Mock>;
  let mockS3Service: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let mockEmbeddingQueue: Record<string, jest.Mock>;
  let mockGraphQueue: Record<string, jest.Mock>;
  let mockLlmService: Record<string, jest.Mock>;
  let mockModelConfigService: Record<string, jest.Mock>;

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
      deleteMany: jest.fn().mockResolvedValue({ errored: [] }),
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
    mockModelConfigService = {
      findEntity: jest.fn(),
      // attachEffectiveEmbeddingModel (응답 derive) 가 호출 — 기본은 빈 결과.
      findManyByIds: jest.fn().mockResolvedValue([]),
      findDefault: jest.fn().mockResolvedValue(null),
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
        { provide: ModelConfigService, useValue: mockModelConfigService },
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

    // W6: findAll 배치 derive — embeddingModelConfigId 있음/null 혼합 KB 검증
    it('W6: embeddingModelConfigId 있는 KB + null KB 혼합 시 각 embeddingModel 올바르게 derive', async () => {
      const embCfg = {
        id: 'cfg-1',
        defaultModel: 'bge-m3',
        workspaceId: 'ws-1',
      };
      const wsDefaultCfg = {
        id: 'ws-default',
        defaultModel: 'text-embedding-3-small',
        workspaceId: 'ws-1',
      };
      const kbWithConfig = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingModelConfigId: 'cfg-1',
      };
      const kbWithoutConfig = {
        id: 'kb-2',
        workspaceId: 'ws-1',
        embeddingModelConfigId: null,
      };

      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(2),
        getMany: jest.fn().mockResolvedValue([kbWithConfig, kbWithoutConfig]),
      };
      mockKbRepo.createQueryBuilder.mockReturnValueOnce(qbMock);
      mockModelConfigService.findManyByIds.mockResolvedValue([embCfg]);
      mockModelConfigService.findDefault.mockResolvedValue(wsDefaultCfg);

      const result = await service.findAll('ws-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(2);
      // cfg 있는 KB → cfg.defaultModel
      expect(result.data[0].embeddingModel).toBe('bge-m3');
      // cfg 없는 KB → ws default kind=embedding
      expect(result.data[1].embeddingModel).toBe('text-embedding-3-small');
      // findManyByIds 는 configIds=[cfg-1] 로 호출
      expect(mockModelConfigService.findManyByIds).toHaveBeenCalledWith(
        ['cfg-1'],
        'ws-1',
      );
    });

    // W6: 빈 목록 시 findManyByIds · findDefault 미호출
    it('W6: 빈 KB 목록 시 findManyByIds/findDefault 미호출', async () => {
      const qbMock = {
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        orderBy: jest.fn().mockReturnThis(),
        skip: jest.fn().mockReturnThis(),
        take: jest.fn().mockReturnThis(),
        getCount: jest.fn().mockResolvedValue(0),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockKbRepo.createQueryBuilder.mockReturnValueOnce(qbMock);

      const result = await service.findAll('ws-1', { page: 1, limit: 20 });

      expect(result.data).toHaveLength(0);
      expect(mockModelConfigService.findManyByIds).not.toHaveBeenCalled();
      expect(mockModelConfigService.findDefault).not.toHaveBeenCalled();
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
        embeddingModelConfigId: null,
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

    // PR4b: embeddingModel 컬럼은 은퇴됐다. create 는 embeddingModelConfigId 만 저장하고,
    // 지정 시 config 존재·kind 를 검증한다. embeddingModel 은 응답 직렬화 시 derive 된다.
    it('validates the embedding config (findEntity) and stores only embeddingModelConfigId', async () => {
      const embCfg = {
        id: 'emb-cfg-1',
        defaultModel: 'bge-m3',
        kind: 'embedding',
        workspaceId: 'ws-1',
      };
      mockModelConfigService.findEntity.mockResolvedValue(embCfg);

      await service.create('ws-1', {
        name: 'Embed KB',
        embeddingModelConfigId: 'emb-cfg-1',
      });

      expect(mockModelConfigService.findEntity).toHaveBeenCalledWith(
        'emb-cfg-1',
        'ws-1',
        'embedding',
      );
      const createArg = mockKbRepo.create.mock.calls[0][0];
      expect(createArg.embeddingModelConfigId).toBe('emb-cfg-1');
      expect(createArg).not.toHaveProperty('embeddingModel');
    });

    // PR4b: 응답 직렬화 시 derive 된 embeddingModel == config.defaultModel.
    // W3: create 단건 경로 — findEntity 로 이미 로드한 config 를 재사용하므로 findManyByIds 미호출.
    it('derives embeddingModel from config.defaultModel on the returned KB (W3: no findManyByIds re-query)', async () => {
      const embCfg = {
        id: 'emb-cfg-1',
        defaultModel: 'text-embedding-3-large',
        kind: 'embedding',
        workspaceId: 'ws-1',
      };
      mockModelConfigService.findEntity.mockResolvedValue(embCfg);
      mockKbRepo.save.mockImplementation((k: Record<string, unknown>) => ({
        ...k,
        id: 'kb-1',
        embeddingModelConfigId: 'emb-cfg-1',
      }));

      const result = await service.create('ws-1', {
        name: 'Race KB',
        embeddingModelConfigId: 'emb-cfg-1',
      });

      // W3: create 단건 경로는 findEntity 결과를 재사용해 findManyByIds 재조회를 피한다.
      expect(mockModelConfigService.findManyByIds).not.toHaveBeenCalled();
      expect(result.embeddingModel).toBe('text-embedding-3-large');
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
    // PR4b: embeddingModel·embeddingLlmConfigId 컬럼은 은퇴됐다. 임베딩 변경은
    // embeddingModelConfigId 로만 하며, config 검증 + dimension 리셋 + 응답 derive 가 일어난다.
    it('validates config, resets dimension, derives embeddingModel when embeddingModelConfigId changes', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingModelConfigId: 'emb-cfg-old',
        embeddingDimension: 1536,
      };
      const newCfg = {
        id: 'emb-cfg-new',
        defaultModel: 'bge-m3',
        kind: 'embedding',
        workspaceId: 'ws-1',
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));
      mockModelConfigService.findEntity.mockResolvedValue(newCfg);
      mockModelConfigService.findManyByIds.mockResolvedValue([newCfg]);

      const result = await service.update('kb-1', 'ws-1', {
        embeddingModelConfigId: 'emb-cfg-new',
      });

      expect(mockModelConfigService.findEntity).toHaveBeenCalledWith(
        'emb-cfg-new',
        'ws-1',
        'embedding',
      );
      expect(result.embeddingModelConfigId).toBe('emb-cfg-new');
      // 응답 derive: embeddingModel == 새 config.defaultModel
      expect(result.embeddingModel).toBe('bge-m3');
      expect(result.embeddingDimension).toBeNull(); // reset for new config (W14)
    });

    it('should reset embeddingDimension to null when embeddingModelConfigId changes (W14)', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingModelConfigId: 'emb-cfg-old',
        embeddingModel: 'old-model',
        embeddingDimension: 1536,
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));
      mockModelConfigService.findEntity.mockResolvedValue({
        id: 'emb-cfg-new',
        defaultModel: 'text-embedding-3-large',
        kind: 'embedding',
        workspaceId: 'ws-1',
      });

      const result = await service.update('kb-1', 'ws-1', {
        embeddingModelConfigId: 'emb-cfg-new',
      });

      expect(result.embeddingModelConfigId).toBe('emb-cfg-new');
      // 새 config 첫 임베딩이 차원을 다시 결정할 때까지 NULL 로 초기화
      expect(result.embeddingDimension).toBeNull();
    });

    // W7: embeddingModelConfigId: null 전달 → dimension 리셋 + ws default embedding derive
    it('W7: embeddingModelConfigId: null 전달 → dimension 리셋 + ws default embedding derive + findEntity 미호출', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingModelConfigId: 'emb-cfg-old',
        embeddingDimension: 1536,
      };
      const wsDefaultCfg = {
        id: 'ws-default-emb',
        defaultModel: 'text-embedding-3-small',
        kind: 'embedding',
        workspaceId: 'ws-1',
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e: Record<string, unknown>) =>
        Promise.resolve(e),
      );
      // null 전달 시 findEntity 호출 없음 — ws default 를 통해 derive
      mockModelConfigService.findManyByIds.mockResolvedValue([]);
      mockModelConfigService.findDefault.mockResolvedValue(wsDefaultCfg);

      const result = await service.update('kb-1', 'ws-1', {
        embeddingModelConfigId: null,
      });

      // null 전달 → findEntity 검증 없음 (id 없으므로)
      expect(mockModelConfigService.findEntity).not.toHaveBeenCalled();
      // dimension 리셋 — 새 config(ws default) 첫 임베딩 시 차원 재결정
      expect(result.embeddingDimension).toBeNull();
      // embeddingModelConfigId → null
      expect(result.embeddingModelConfigId).toBeNull();
      // ws default kind=embedding 으로 embeddingModel derive
      expect(result.embeddingModel).toBe('text-embedding-3-small');
    });

    it('should NOT reset embeddingDimension when embeddingModelConfigId is the same (W14)', async () => {
      const existing = {
        id: 'kb-1',
        workspaceId: 'ws-1',
        embeddingModelConfigId: 'emb-cfg-same',
        embeddingModel: 'bge-m3',
        embeddingDimension: 1536,
      };
      mockKbRepo.findOne.mockResolvedValue(existing);
      mockKbRepo.save.mockImplementation((e) => Promise.resolve(e));

      const result = await service.update('kb-1', 'ws-1', {
        embeddingModelConfigId: 'emb-cfg-same',
      });

      // 동일 config 전송 → findEntity 호출 없음, dimension 리셋 없음
      expect(mockModelConfigService.findEntity).not.toHaveBeenCalled();
      expect(result.embeddingDimension).toBe(1536);
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
        undefined,
        'document',
      );
    });

    it('resolves a kind=embedding ModelConfig when embeddingModelConfigId is given', async () => {
      const embCfg = { id: 'emb-cfg-1', provider: 'tei', kind: 'embedding' };
      mockModelConfigService.findEntity.mockResolvedValue(embCfg);
      mockLlmService.embed.mockResolvedValue([new Array(1024).fill(0.02)]);

      const result = await service.probeEmbedding('ws-1', {
        embeddingModelConfigId: 'emb-cfg-1',
        embeddingModel: 'bge-m3',
      });

      expect(mockModelConfigService.findEntity).toHaveBeenCalledWith(
        'emb-cfg-1',
        'ws-1',
        'embedding',
      );
      // legacy chat resolveConfig must NOT be consulted on the 1급 path.
      expect(mockLlmService.resolveConfig).not.toHaveBeenCalled();
      expect(result).toEqual({ dimension: 1024, provider: 'tei' });
      expect(mockLlmService.embed).toHaveBeenCalledWith(
        embCfg,
        ['probe'],
        'bge-m3',
        undefined,
        'document',
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

    it('should atomically acquire reembed_status and enqueue all docs (single chunk)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]); // reset RETURNING id

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        1,
        expect.stringMatching(/SET reembed_status = 'in_progress'/),
        ['kb-1', 'ws-1'],
      );
      // reset UPDATE 가 RETURNING id 로 대상 문서를 가져온다 — 별도 SELECT 없음 (M-1).
      expect(mockDataSource.query).toHaveBeenNthCalledWith(
        2,
        expect.stringMatching(/UPDATE document[\s\S]*RETURNING id/),
        ['kb-1'],
      );
      expect(mockDocRepo.find).not.toHaveBeenCalled();
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledTimes(1);
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

    it('should split enqueue into EMBED_CHUNK_SIZE (100) batches', async () => {
      const docs = Array.from({ length: 250 }, (_, i) => ({ id: `d${i}` }));
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce(docs); // reset RETURNING id

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      // 250 docs → 100 + 100 + 50 = 3 addBulk 호출 (단일 페이로드 폭발 방지).
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledTimes(3);
      expect(mockEmbeddingQueue.addBulk.mock.calls[0][0]).toHaveLength(100);
      expect(mockEmbeddingQueue.addBulk.mock.calls[1][0]).toHaveLength(100);
      expect(mockEmbeddingQueue.addBulk.mock.calls[2][0]).toHaveLength(50);
      expect(result.documentCount).toBe(250);
    });

    it('should roll back a failed chunk to "failed" and release the lock via drain-finalize', async () => {
      const docs = Array.from({ length: 150 }, (_, i) => ({ id: `d${i}` }));
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce(docs); // reset RETURNING id
      // 1st chunk ok, 2nd chunk add 실패.
      mockEmbeddingQueue.addBulk
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('redis down'));

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      // 실패 chunk(2번째 50건)를 embedding_status='failed' 로 롤백.
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/SET embedding_status = 'failed'/),
        [docs.slice(100, 150).map((d) => d.id)],
      );
      // enqueued(100) < total(150) → drain-finalize CAS 로 잠금 해제 시도.
      expect(mockDataSource.query).toHaveBeenLastCalledWith(
        expect.stringMatching(/SET reembed_status = 'idle'[\s\S]*NOT EXISTS/),
        ['kb-1'],
      );
      expect(result.documentCount).toBe(100);
    });

    it('should release the lock when ALL chunks fail (no child job to finalize)', async () => {
      const docs = Array.from({ length: 50 }, (_, i) => ({ id: `d${i}` }));
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce(docs); // reset RETURNING id
      mockEmbeddingQueue.addBulk.mockRejectedValueOnce(new Error('redis down'));

      const result = await service.reEmbedAll('kb-1', 'ws-1');

      expect(result.documentCount).toBe(0);
      expect(mockDataSource.query).toHaveBeenLastCalledWith(
        expect.stringMatching(/SET reembed_status = 'idle'[\s\S]*NOT EXISTS/),
        ['kb-1'],
      );
    });

    it('should immediately reset to idle for empty KB (no child job to finalize)', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 'kb-1' }]) // acquire
        .mockResolvedValueOnce([]) // reset RETURNING id → 0 docs
        .mockResolvedValueOnce([]); // idle reset

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

  describe('retryFailedDocuments (embedding, shared chunk helper)', () => {
    beforeEach(() => {
      mockKbRepo.findOne.mockResolvedValue({
        id: 'kb-1',
        workspaceId: 'ws-1',
        ragMode: 'vector',
      });
    });

    it('re-enqueues failed docs and reports the requeued count', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ id: 'd1' }, { id: 'd2' }]); // UPDATE ... failed RETURNING id
      const res = await service.retryFailedDocuments(
        'kb-1',
        'ws-1',
        'embedding',
      );
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledTimes(1);
      expect(res.embeddingRequeued).toBe(2);
    });

    it('rolls back the failed chunk and rethrows the original error', async () => {
      mockDataSource.query.mockResolvedValueOnce([{ id: 'd1' }]); // RETURNING id
      const boom = new Error('redis down');
      mockEmbeddingQueue.addBulk.mockRejectedValueOnce(boom);

      await expect(
        service.retryFailedDocuments('kb-1', 'ws-1', 'embedding'),
      ).rejects.toBe(boom);

      // 적재 안 된 'pending' stuck 방지 — 실패 chunk 를 'failed' 로 롤백.
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/SET embedding_status = 'failed'/),
        [['d1']],
      );
    });

    // #7 — 2 chunk 중 1번째 chunk 실패 + 2번째 chunk 정상: enqueueEmbedChunked 가
    // 실패 후에도 나머지 chunk 를 계속 처리하는 설계 계약을 검증한다.
    // 150개 문서(EMBED_CHUNK_SIZE=100) → 1st chunk(100건) 실패, 2nd chunk(50건) 성공.
    it('2 chunk 중 1번째 실패 + 2번째 성공: 이후 chunk 도 계속 처리되고 embeddingRequeued 는 성공분만 반환', async () => {
      const docs = Array.from({ length: 150 }, (_, i) => ({ id: `d${i}` }));
      mockDataSource.query.mockResolvedValueOnce(docs); // UPDATE failed RETURNING id
      const boom = new Error('redis down');
      mockEmbeddingQueue.addBulk
        .mockRejectedValueOnce(boom) // 1st chunk(100건) 실패
        .mockResolvedValueOnce([]); // 2nd chunk(50건) 성공

      // 1st chunk 실패 → throw (retryFailedDocuments 는 failed > 0 이면 throw)
      await expect(
        service.retryFailedDocuments('kb-1', 'ws-1', 'embedding'),
      ).rejects.toBe(boom);

      // addBulk 가 2회 호출됐어야 한다 — 1번째 실패 후에도 2번째 계속 처리.
      expect(mockEmbeddingQueue.addBulk).toHaveBeenCalledTimes(2);
      // 1st chunk 의 failed 문서들이 'failed' 로 롤백됐는지 확인.
      expect(mockDataSource.query).toHaveBeenCalledWith(
        expect.stringMatching(/SET embedding_status = 'failed'/),
        [docs.slice(0, 100).map((d) => d.id)],
      );
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
      // 01-performance #2 B안 — 단건 delete 루프 대신 deleteMany 배치 1회.
      expect(mockS3Service.deleteMany).toHaveBeenCalledTimes(1);
      expect(mockS3Service.deleteMany).toHaveBeenCalledWith([
        'kb/kb-1/d1/a.txt',
        'kb/kb-1/d2/b.txt',
      ]);
      expect(mockS3Service.delete).not.toHaveBeenCalled();
      expect(mockKbRepo.remove).toHaveBeenCalledWith(kb);
    });

    it('deleteMany 부분 실패(errored)는 warn 로깅만 하고 KB 삭제는 진행한다 (best-effort 보존)', async () => {
      const kb = { id: 'kb-1', workspaceId: 'ws-1' };
      mockKbRepo.findOne.mockResolvedValue(kb);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', fileUrl: 'kb/kb-1/d1/a.txt' }]),
      };
      mockDocRepo.createQueryBuilder.mockReturnValueOnce(qb);
      mockS3Service.deleteMany.mockResolvedValueOnce({
        errored: ['kb/kb-1/d1/a.txt'],
      });
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await service.remove('kb-1', 'ws-1');

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('kb/kb-1/d1/a.txt'),
      );
      expect(mockKbRepo.remove).toHaveBeenCalledWith(kb);
      warnSpy.mockRestore();
    });

    it('deleteMany 명령 자체가 실패해도 warn 후 KB 삭제는 진행한다 (네트워크 best-effort)', async () => {
      const kb = { id: 'kb-1', workspaceId: 'ws-1' };
      mockKbRepo.findOne.mockResolvedValue(kb);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest
          .fn()
          .mockResolvedValue([{ id: 'd1', fileUrl: 'kb/kb-1/d1/a.txt' }]),
      };
      mockDocRepo.createQueryBuilder.mockReturnValueOnce(qb);
      mockS3Service.deleteMany.mockRejectedValueOnce(new Error('econnrefused'));
      const warnSpy = jest
        .spyOn(
          (service as unknown as { logger: { warn: (m: string) => void } })
            .logger,
          'warn',
        )
        .mockImplementation(() => undefined);

      await service.remove('kb-1', 'ws-1');

      expect(warnSpy).toHaveBeenCalled();
      expect(mockKbRepo.remove).toHaveBeenCalledWith(kb);
      warnSpy.mockRestore();
    });

    it('문서 0건이면 deleteMany 를 호출하지 않는다', async () => {
      const kb = { id: 'kb-1', workspaceId: 'ws-1' };
      mockKbRepo.findOne.mockResolvedValue(kb);
      const qb = {
        innerJoin: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockDocRepo.createQueryBuilder.mockReturnValueOnce(qb);

      await service.remove('kb-1', 'ws-1');

      expect(mockS3Service.deleteMany).not.toHaveBeenCalled();
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
