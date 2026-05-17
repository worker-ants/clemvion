import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GraphExtractionProcessor } from './graph-extraction.processor';
import { GraphExtractionService } from '../graph/graph-extraction.service';
import { InvalidJobPayloadError } from './job-payload.util';

describe('GraphExtractionProcessor', () => {
  let processor: GraphExtractionProcessor;
  let mockExtractionService: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;

  beforeEach(async () => {
    mockExtractionService = {
      extractDocument: jest.fn().mockResolvedValue(undefined),
    };
    mockDataSource = {
      query: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphExtractionProcessor,
        { provide: GraphExtractionService, useValue: mockExtractionService },
        { provide: DataSource, useValue: mockDataSource },
      ],
    }).compile();
    processor = module.get(GraphExtractionProcessor);
  });

  it('delegates process() to GraphExtractionService.extractDocument', async () => {
    await processor.process({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1' },
    } as never);
    expect(mockExtractionService.extractDocument).toHaveBeenCalledWith('d1');
  });

  it('skips finalize for non-batch jobs', async () => {
    await processor.onCompleted({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1' },
    } as never);
    expect(mockDataSource.query).not.toHaveBeenCalled();
  });

  it('issues atomic finalize UPDATE on batch completion', async () => {
    mockDataSource.query.mockResolvedValueOnce([]);

    await processor.onCompleted({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);

    // 단일 atomic UPDATE — NOT EXISTS 서브쿼리가 PostgreSQL 에서 평가되어
    // 진행 중인 문서가 없으면 idle 로, 있으면 no-op.
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET reextract_status = 'idle'/),
      ['kb-1'],
    );
    const sql = mockDataSource.query.mock.calls[0][0] as string;
    expect(sql).toContain('NOT EXISTS');
    expect(sql).toContain(
      "graph_extraction_status IN ('pending', 'processing')",
    );
  });

  it('runs the same finalize logic on failed batch child', async () => {
    mockDataSource.query.mockResolvedValueOnce([]);

    await processor.onFailed({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);

    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
    expect(mockDataSource.query).toHaveBeenCalledWith(
      expect.stringMatching(/SET reextract_status = 'idle'/),
      ['kb-1'],
    );
  });

  it('throws InvalidJobPayloadError when documentId is missing', async () => {
    await expect(
      processor.process({
        id: 'job-x',
        data: { knowledgeBaseId: 'kb-1' },
      } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
    expect(mockExtractionService.extractDocument).not.toHaveBeenCalled();
  });

  it('throws when documentId is empty', async () => {
    await expect(
      processor.process({
        id: 'job-y',
        data: { documentId: '', knowledgeBaseId: 'kb-1' },
      } as never),
    ).rejects.toThrow(/documentId is missing/);
    expect(mockExtractionService.extractDocument).not.toHaveBeenCalled();
  });

  it('throws when documentId is whitespace only', async () => {
    await expect(
      processor.process({
        id: 'job-w',
        data: { documentId: '   ', knowledgeBaseId: 'kb-1' },
      } as never),
    ).rejects.toThrow(InvalidJobPayloadError);
    expect(mockExtractionService.extractDocument).not.toHaveBeenCalled();
  });
});
