import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StuckDocumentRecoveryService } from './stuck-document-recovery.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from './graph-extraction.queue';

describe('StuckDocumentRecoveryService', () => {
  let service: StuckDocumentRecoveryService;
  let queryMock: jest.Mock;
  let embeddingQueueAdd: jest.Mock;
  let graphQueueAdd: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn().mockResolvedValue([]);
    embeddingQueueAdd = jest.fn().mockResolvedValue(undefined);
    graphQueueAdd = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StuckDocumentRecoveryService,
        { provide: DataSource, useValue: { query: queryMock } },
        {
          provide: getQueueToken(DOCUMENT_EMBEDDING_QUEUE),
          useValue: { add: embeddingQueueAdd },
        },
        {
          provide: getQueueToken(GRAPH_EXTRACTION_QUEUE),
          useValue: { add: graphQueueAdd },
        },
      ],
    }).compile();
    service = module.get(StuckDocumentRecoveryService);
  });

  it('processing 인 stuck 임베딩 문서를 pending 으로 회수 + 큐 add', async () => {
    queryMock
      // 첫 SELECT (embedding)
      .mockResolvedValueOnce([
        { id: 'd1', knowledge_base_id: 'kb-1', rag_mode: 'vector' },
      ])
      // UPDATE
      .mockResolvedValueOnce([])
      // 두 번째 SELECT (graph) — 비어있음
      .mockResolvedValueOnce([]);

    await service.onApplicationBootstrap();

    expect(queryMock).toHaveBeenCalledTimes(3);
    expect(embeddingQueueAdd).toHaveBeenCalledTimes(1);
    expect(embeddingQueueAdd).toHaveBeenCalledWith(
      'embed',
      expect.objectContaining({
        documentId: 'd1',
        knowledgeBaseId: 'kb-1',
        ragMode: 'vector',
        reEmbed: true,
      }),
    );
  });

  it('processing 인 stuck 그래프 추출 문서를 pending 으로 회수 + 큐 add', async () => {
    queryMock
      .mockResolvedValueOnce([]) // embedding 비어있음
      .mockResolvedValueOnce([{ id: 'd2', knowledge_base_id: 'kb-2' }])
      .mockResolvedValueOnce([]); // UPDATE

    await service.onApplicationBootstrap();

    expect(graphQueueAdd).toHaveBeenCalledTimes(1);
    expect(graphQueueAdd).toHaveBeenCalledWith(
      'extract',
      expect.objectContaining({
        documentId: 'd2',
        knowledgeBaseId: 'kb-2',
      }),
    );
  });

  it('회수 대상 없으면 큐 add 없이 종료', async () => {
    queryMock.mockResolvedValue([]);
    await service.onApplicationBootstrap();
    expect(embeddingQueueAdd).not.toHaveBeenCalled();
    expect(graphQueueAdd).not.toHaveBeenCalled();
  });

  it('한 회수 단계가 throw 해도 다른 단계는 계속 진행', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('PG connection refused')) // embedding SELECT 실패
      .mockResolvedValueOnce([{ id: 'd3', knowledge_base_id: 'kb-3' }]) // graph SELECT 성공
      .mockResolvedValueOnce([]); // graph UPDATE

    await service.onApplicationBootstrap();

    expect(graphQueueAdd).toHaveBeenCalledWith(
      'extract',
      expect.objectContaining({ documentId: 'd3' }),
    );
  });
});
