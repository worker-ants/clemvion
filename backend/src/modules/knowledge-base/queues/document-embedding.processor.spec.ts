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
});
