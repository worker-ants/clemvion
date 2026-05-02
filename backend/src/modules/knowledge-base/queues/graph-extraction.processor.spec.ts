import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { GraphExtractionProcessor } from './graph-extraction.processor';
import { GraphExtractionService } from '../graph/graph-extraction.service';

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

  it('resets reextract_status to idle when last batch child finishes', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([{ count: 0 }]) // remaining = 0
      .mockResolvedValueOnce([]); // UPDATE

    await processor.onCompleted({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);

    expect(mockDataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/SET reextract_status = 'idle'/),
      ['kb-1'],
    );
  });

  it('does not reset reextract_status when other batch docs are still pending', async () => {
    mockDataSource.query.mockResolvedValueOnce([{ count: 3 }]); // remaining > 0

    await processor.onCompleted({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);

    // 두 번째 query (UPDATE) 가 호출되지 않아야 함
    expect(mockDataSource.query).toHaveBeenCalledTimes(1);
  });

  it('runs the same finalize logic on failed batch child', async () => {
    mockDataSource.query
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([]);

    await processor.onFailed({
      data: { documentId: 'd1', knowledgeBaseId: 'kb-1', isKbBatch: true },
    } as never);

    expect(mockDataSource.query).toHaveBeenNthCalledWith(
      2,
      expect.stringMatching(/SET reextract_status = 'idle'/),
      ['kb-1'],
    );
  });
});
