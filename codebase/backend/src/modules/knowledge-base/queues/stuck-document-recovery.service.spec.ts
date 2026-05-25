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

  // TypeORM v0.3 `DataSource.query` 는 UPDATE/DELETE 에 대해 `[rows, rowCount]`
  // 튜플을 반환한다 (PostgresQueryRunner). mock 도 동일 shape 으로 맞추지 않으면
  // destructure 누락 회귀(가짜 `documentId: undefined` job 이 부팅마다 큐잉되는
  // 버그)를 잡지 못한다.
  const updateResult = <T>(rows: T[]): [T[], number] => [rows, rows.length];

  beforeEach(async () => {
    queryMock = jest.fn().mockResolvedValue(updateResult([]));
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
      .mockResolvedValueOnce(
        updateResult([
          { id: 'd1', knowledge_base_id: 'kb-1', rag_mode: 'vector' },
          { id: 'd2', knowledge_base_id: 'kb-1', rag_mode: 'vector' },
        ]),
      )
      .mockResolvedValueOnce(updateResult([])); // graph SELECT 비어있음

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
      .mockResolvedValueOnce(updateResult([])) // embedding 비어있음
      .mockResolvedValueOnce(
        updateResult([{ id: 'd2', knowledge_base_id: 'kb-2' }]),
      );

    await service.onApplicationBootstrap();

    expect(graphAddBulk).toHaveBeenCalledTimes(1);
    expect(graphAddBulk).toHaveBeenCalledWith([
      {
        name: 'extract',
        data: { documentId: 'd2', knowledgeBaseId: 'kb-2' },
      },
    ]);
  });

  it('회수 대상 없으면 큐 add 없이 종료 (튜플 길이 2가 false-positive 트리거하지 않음)', async () => {
    // 회귀 가드: UPDATE 가 0행 영향이면 `[[], 0]` 가 반환된다. 튜플 자체의
    // length(2) 를 row 개수로 오해해 addBulk(가짜 job 2개) 를 부르던 버그를 방지.
    queryMock.mockResolvedValue(updateResult([]));
    await service.onApplicationBootstrap();
    expect(embeddingAddBulk).not.toHaveBeenCalled();
    expect(graphAddBulk).not.toHaveBeenCalled();
  });

  it('한 회수 단계가 throw 해도 다른 단계는 계속 진행', async () => {
    queryMock
      .mockRejectedValueOnce(new Error('PG connection refused')) // embedding SELECT 실패
      .mockResolvedValueOnce(
        updateResult([{ id: 'd3', knowledge_base_id: 'kb-3' }]),
      );

    await service.onApplicationBootstrap();

    expect(graphAddBulk).toHaveBeenCalledWith([
      {
        name: 'extract',
        data: { documentId: 'd3', knowledgeBaseId: 'kb-3' },
      },
    ]);
  });
});
