import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { DataSource } from 'typeorm';
import { DocumentEmbeddingProcessor } from './document-embedding.processor';
import { EmbeddingService } from '../embedding/embedding.service';
import { GRAPH_EXTRACTION_QUEUE } from './graph-extraction.queue';
import { InvalidJobPayloadError } from './job-payload.util';

describe('DocumentEmbeddingProcessor', () => {
  let processor: DocumentEmbeddingProcessor;
  let mockEmbeddingService: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let mockGraphQueue: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockEmbeddingService = {
      processDocument: jest.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {
      query: jest.fn(),
    };
    mockGraphQueue = {
      add: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentEmbeddingProcessor,
        { provide: EmbeddingService, useValue: mockEmbeddingService },
        { provide: DataSource, useValue: mockDataSource },
        {
          provide: getQueueToken(GRAPH_EXTRACTION_QUEUE),
          useValue: mockGraphQueue,
        },
      ],
    }).compile();
    processor = module.get(DocumentEmbeddingProcessor);
  });

  it('delegates process() to EmbeddingService.processDocument', async () => {
    await processor.process({
      data: { documentId: 'd1', reEmbed: false },
    } as never);
    expect(mockEmbeddingService.processDocument).toHaveBeenCalledWith(
      'd1',
      false,
    );
  });

  it('forwards reEmbed=true through to processDocument', async () => {
    await processor.process({
      data: { documentId: 'd1', reEmbed: true },
    } as never);
    expect(mockEmbeddingService.processDocument).toHaveBeenCalledWith(
      'd1',
      true,
    );
  });

  it('throws InvalidJobPayloadError when documentId is missing', async () => {
    await expect(
      processor.process({ id: 'job-x', data: {} } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
    expect(mockEmbeddingService.processDocument).not.toHaveBeenCalled();
  });

  it('throws when documentId is an empty string', async () => {
    await expect(
      processor.process({
        id: 'job-y',
        data: { documentId: '' },
      } as never),
    ).rejects.toThrow(/documentId is missing/);
    expect(mockEmbeddingService.processDocument).not.toHaveBeenCalled();
  });

  it('throws when documentId is null', async () => {
    await expect(
      processor.process({
        id: 'job-z',
        data: { documentId: null },
      } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
    expect(mockEmbeddingService.processDocument).not.toHaveBeenCalled();
  });

  it('throws when documentId is whitespace only', async () => {
    await expect(
      processor.process({
        id: 'job-w',
        data: { documentId: '   ' },
      } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
    expect(mockEmbeddingService.processDocument).not.toHaveBeenCalled();
  });

  it('skips finalize and graph chain when payload is non-batch + vector', async () => {
    await processor.onCompleted({
      data: {
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
        ragMode: 'vector',
      },
    } as never);
    // non-batch → finalize skip / ragMode=vector → graph chain skip → DB no-op
    expect(mockDataSource.query).not.toHaveBeenCalled();
    expect(mockGraphQueue.add).not.toHaveBeenCalled();
  });

  it('issues atomic finalize UPDATE on batch completion', async () => {
    mockDataSource.query.mockResolvedValueOnce([]);
    await processor.onCompleted({
      data: {
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
        isKbBatch: true,
        ragMode: 'vector',
      },
    } as never);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET reembed_status = 'idle'/),
      ['kb-1'],
    );
  });

  it('chains graph extraction when ragMode=graph in payload (no DB lookup)', async () => {
    await processor.onCompleted({
      data: {
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
        ragMode: 'graph',
      },
    } as never);
    expect(mockDataSource.query).not.toHaveBeenCalled(); // payload 에 ragMode 있어 DB 조회 skip
    expect(mockGraphQueue.add).toHaveBeenCalledWith('extract', {
      documentId: 'd1',
      knowledgeBaseId: 'kb-1',
      isKbBatch: false,
    });
  });

  it('chains graph extraction with isKbBatch=true through to graphQueue', async () => {
    mockDataSource.query.mockResolvedValueOnce([]); // finalize UPDATE
    await processor.onCompleted({
      data: {
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
        isKbBatch: true,
        ragMode: 'graph',
      },
    } as never);
    expect(mockGraphQueue.add).toHaveBeenCalledWith('extract', {
      documentId: 'd1',
      knowledgeBaseId: 'kb-1',
      isKbBatch: true,
    });
  });

  it('falls back to DB lookup when ragMode/knowledgeBaseId are missing', async () => {
    mockDataSource.query.mockResolvedValueOnce([
      { rag_mode: 'graph', knowledge_base_id: 'kb-from-db' },
    ]);
    await processor.onCompleted({ data: { documentId: 'd1' } } as never);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringContaining('SELECT kb.rag_mode'),
      ['d1'],
    );
    expect(mockGraphQueue.add).toHaveBeenCalledWith('extract', {
      documentId: 'd1',
      knowledgeBaseId: 'kb-from-db',
      isKbBatch: false,
    });
  });

  it('does not chain when DB fallback returns vector ragMode', async () => {
    mockDataSource.query.mockResolvedValueOnce([
      { rag_mode: 'vector', knowledge_base_id: 'kb-from-db' },
    ]);
    await processor.onCompleted({ data: { documentId: 'd1' } } as never);
    expect(mockGraphQueue.add).not.toHaveBeenCalled();
  });

  it('onFailed: skips finalize for non-batch jobs', async () => {
    await processor.onFailed({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1' },
    } as never);
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('onFailed: runs the same atomic finalize for batch child', async () => {
    mockDataSource.query.mockResolvedValueOnce([]);
    await processor.onFailed({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET reembed_status = 'idle'/),
      ['kb-1'],
    );
  });
});
