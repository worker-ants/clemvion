import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EmbeddingService } from './embedding.service';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { S3Service } from '../../../common/services/s3.service';
import { LlmService } from '../../llm/llm.service';
import { WebsocketService } from '../../websocket/websocket.service';
import { chunkText } from '../chunking/text-chunker';

jest.mock('../parsers/parser.factory', () => ({
  parseDocument: jest.fn().mockResolvedValue('parsed text body'),
}));

jest.mock('../chunking/text-chunker', () => ({
  chunkText: jest.fn(() => [
    { content: 'chunk-a', index: 0, tokenCount: 3 },
    { content: 'chunk-b', index: 1, tokenCount: 3 },
  ]),
}));

const chunkTextMock = chunkText as jest.MockedFunction<typeof chunkText>;

describe('EmbeddingService - dimension consistency', () => {
  let service: EmbeddingService;
  let mockDocRepo: Record<string, jest.Mock>;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockChunkRepo: Record<string, jest.Mock>;
  let mockS3: Record<string, jest.Mock>;
  let mockLlm: Record<string, jest.Mock>;
  let mockWs: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  const findUpdateDimCall = (mock: jest.Mock) =>
    mock.mock.calls.find((c) =>
      String(c[0]).includes('UPDATE knowledge_base SET embedding_dimension'),
    );

  beforeEach(async () => {
    chunkTextMock.mockReturnValue([
      { content: 'chunk-a', index: 0, tokenCount: 3 },
      { content: 'chunk-b', index: 1, tokenCount: 3 },
    ]);

    mockDocRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
    };
    mockKbRepo = {
      findOne: jest.fn(),
    };
    mockChunkRepo = {
      delete: jest.fn().mockResolvedValue(undefined),
    };
    mockS3 = {
      download: jest.fn().mockResolvedValue(Buffer.from('hello')),
    };
    mockLlm = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg',
        provider: 'openai',
        workspaceId: 'ws-1',
      }),
      embed: jest.fn(),
    };
    mockWs = {
      emitExecutionEvent: jest.fn(),
    };

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        { provide: getRepositoryToken(DocumentChunk), useValue: mockChunkRepo },
        { provide: getRepositoryToken(KnowledgeBase), useValue: mockKbRepo },
        { provide: S3Service, useValue: mockS3 },
        { provide: LlmService, useValue: mockLlm },
        { provide: WebsocketService, useValue: mockWs },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    service = module.get(EmbeddingService);
  });

  it('persists embedding_dimension when KB has none yet', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      fileUrl: 's3://x',
      fileType: 'txt',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: null,
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    mockLlm.embed.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    await service.processDocument('d1');

    const update = findUpdateDimCall(mockDataSource.query);
    expect(update).toBeDefined();
    expect(update?.[1]).toEqual([3, 'kb-1']);
  });

  it('does not overwrite embedding_dimension when KB already has one', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      fileUrl: 's3://x',
      fileType: 'txt',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: 3,
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    mockLlm.embed.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    await service.processDocument('d1');

    expect(findUpdateDimCall(mockDataSource.query)).toBeUndefined();
  });

  it('marks document as error when embedding dimension does not match KB', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      fileUrl: 's3://x',
      fileType: 'txt',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      embeddingModel: 'text-embedding-3-large',
      embeddingDimension: 3072,
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    mockLlm.embed.mockResolvedValue([
      [0.1, 0.2, 0.3],
      [0.4, 0.5, 0.6],
    ]);

    await service.processDocument('d1');

    expect(mockDocRepo.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        embeddingStatus: 'error',
        metadata: expect.objectContaining({
          error: expect.stringContaining('dimension mismatch'),
        }),
      }),
    );
  });

  it('marks document as error when embedding vector is empty', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      fileUrl: 's3://x',
      fileType: 'txt',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: null,
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    mockLlm.embed.mockResolvedValue([[], []]);

    await service.processDocument('d1');

    expect(mockDocRepo.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        embeddingStatus: 'error',
      }),
    );
  });

  it('checks dimension consistency across multiple batches (>20 chunks)', async () => {
    // 21 chunks -> 2 batches of 20 + 1 (batchSize=20 in EmbeddingService)
    chunkTextMock.mockReturnValue(
      Array.from({ length: 21 }, (_, i) => ({
        content: `chunk-${i}`,
        index: i,
        tokenCount: 1,
      })),
    );
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      fileUrl: 's3://x',
      fileType: 'txt',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      embeddingModel: 'text-embedding-3-small',
      embeddingDimension: null,
      chunkSize: 1000,
      chunkOverlap: 200,
    });
    // First batch: dim 3, second batch: dim 4 (mismatch)
    mockLlm.embed
      .mockResolvedValueOnce(Array.from({ length: 20 }, () => [0.1, 0.2, 0.3]))
      .mockResolvedValueOnce([[0.4, 0.5, 0.6, 0.7]]);

    await service.processDocument('d1');

    expect(mockDocRepo.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        embeddingStatus: 'error',
        metadata: expect.objectContaining({
          error: expect.stringContaining('dimension mismatch'),
        }),
      }),
    );
  });
});
