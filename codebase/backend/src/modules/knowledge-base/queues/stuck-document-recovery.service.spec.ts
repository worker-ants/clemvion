import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { StuckDocumentRecoveryService } from './stuck-document-recovery.service';
import { getQueueToken } from '@nestjs/bullmq';
import { DOCUMENT_EMBEDDING_QUEUE } from './document-embedding.queue';
import { GRAPH_EXTRACTION_QUEUE } from './graph-extraction.queue';

describe('StuckDocumentRecoveryService', () => {
  let service: StuckDocumentRecoveryService;
  let queryMock: jest.Mock;
  let embeddingAddBulk: jest.Mock;
  let graphAddBulk: jest.Mock;

  beforeEach(async () => {
    queryMock = jest.fn().mockResolvedValue([]);
    embeddingAddBulk = jest.fn().mockResolvedValue(undefined);
    graphAddBulk = jest.fn().mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StuckDocumentRecoveryService,
        { provide: DataSource, useValue: { query: queryMock } },
        {
          provide: getQueueToken(DOCUMENT_EMBEDDING_QUEUE),
          useValue: { addBulk: embeddingAddBulk },
        },
        {
          provide: getQueueToken(GRAPH_EXTRACTION_QUEUE),
          useValue: { addBulk: graphAddBulk },
        },
      ],
    }).compile();
    service = module.get(StuckDocumentRecoveryService);
  });

  it('embedding stuck 문서를 단일 UPDATE...RETURNING 으로 회수 후 addBulk 일괄 큐잉', async () => {
    queryMock
      .mockResolvedValueOnce([
        { id: 'd1', knowledge_base_id: 'kb-1', rag_mode: 'vector' },
        { id: 'd2', knowledge_base_id: 'kb-1', rag_mode: 'vector' },
      ])
      .mockResolvedValueOnce([]); // graph SELECT 비어있음

    await service.onApplicationBootstrap();

    expect(queryMock).toHaveBeenCalledTimes(2);
    expect(embeddingAddBulk).toHaveBeenCalledTimes(1);
    expect(embeddingAddBulk).toHaveBeenCalledWith([
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
  });

  it('graph stuck 문서를 단일 UPDATE...RETURNING + addBulk 로 회수', async () => {
    queryMock
      .mockResolvedValueOnce([]) // embedding 비어있음
      .mockResolvedValueOnce([{ id: 'd2', knowledge_base_id: 'kb-2' }]);

    await service.onApplicationBootstrap();

    expect(graphAddBulk).toHaveBeenCalledTimes(1);
    expect(graphAddBulk).toHaveBeenCalledWith([
      {
        name: 'extract',
        data: { documentId: 'd2', knowledgeBaseId: 'kb-2' },
      },
    ]);
  });

  it('회수 대상 없으면 큐 add 없이 종료', async () => {
    queryMock.mockResolvedValue([]);
    await service.onApplicationBootstrap();
    expect(embeddingAddBulk).not.toHaveBeenCalled();
    expect(graphAddBulk).not.toHaveBeenCalled();
  });

  it('한 회수 단계가 throw 해도 다른 단계는 계속 진행', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('PG connection refused')) // embedding SELECT 실패
      .mockResolvedValueOnce([{ id: 'd3', knowledge_base_id: 'kb-3' }]); // graph 정상

    await service.onApplicationBootstrap();

    expect(graphAddBulk).toHaveBeenCalledWith([
      {
        name: 'extract',
        data: { documentId: 'd3', knowledgeBaseId: 'kb-3' },
      },
    ]);
  });
});
