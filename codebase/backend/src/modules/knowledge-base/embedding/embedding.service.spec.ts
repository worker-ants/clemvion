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
  parseDocumentSegments: jest
    .fn()
    .mockResolvedValue([{ text: 'parsed text body', metadata: {} }]),
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
      increment: jest.fn().mockResolvedValue(undefined),
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
      emitKbEvent: jest.fn(),
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

  it.each([
    ['undefined', undefined as unknown as string],
    ['null', null as unknown as string],
    ['empty string', ''],
    ['whitespace only', '   '],
  ])(
    'returns early without touching the repository when documentId is %s',
    async (_label, input) => {
      await service.processDocument(input);
      expect(mockDocRepo.findOne).not.toHaveBeenCalled();
      expect(mockDocRepo.update).not.toHaveBeenCalled();
      expect(mockDocRepo.increment).not.toHaveBeenCalled();
    },
  );

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

    // dimension mismatch 는 비재시도성 오류 → retryWithBackoff 가 1회 시도 후 즉시 throw → 'failed'
    // 메시지는 sanitizeLlmErrorMessage 가 일반 폴백으로 치환 (도메인 에러는 spec/RESOLUTION 참조)
    expect(mockDocRepo.update).toHaveBeenCalledWith(
      'd1',
      expect.objectContaining({
        embeddingStatus: 'failed',
        embeddingErrorMessage: expect.any(String),
      }),
    );
  });

  it('marks document as failed when embedding vector is empty (non-retryable)', async () => {
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
        embeddingStatus: 'failed',
        embeddingErrorMessage: expect.any(String),
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
        embeddingStatus: 'failed',
        embeddingErrorMessage: expect.any(String),
      }),
    );
  });

  describe('retry & failure', () => {
    let randomSpy: jest.SpyInstance;
    beforeEach(() => {
      jest.useFakeTimers();
      // jitter 비활성: 백오프 시간 결정론적으로 1s / 4s / 16s 가 되도록 Math.random=0 고정.
      randomSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    });
    afterEach(() => {
      randomSpy.mockRestore();
      jest.useRealTimers();
    });

    function setupHappyKb() {
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
    }

    it('첫 시도 timeout 후 2차에서 성공 → completed + retry_count 리셋', async () => {
      setupHappyKb();
      mockLlm.embed
        .mockRejectedValueOnce(new Error('Request timed out after 60000ms'))
        .mockResolvedValueOnce([
          [0.1, 0.2, 0.3],
          [0.4, 0.5, 0.6],
        ]);

      const promise = service.processDocument('d1');
      // 백오프 1s 대기
      await jest.advanceTimersByTimeAsync(1000);
      await promise;

      expect(mockDocRepo.increment).toHaveBeenCalledWith(
        { id: 'd1' },
        'embeddingRetryCount',
        1,
      );
      // 마지막 update 는 completed 로 retry_count 리셋
      const completedCalls = mockDocRepo.update.mock.calls.filter(
        (c) => c[1]?.embeddingStatus === 'completed',
      );
      expect(completedCalls.length).toBeGreaterThan(0);
      expect(completedCalls[completedCalls.length - 1][1]).toEqual(
        expect.objectContaining({
          embeddingStatus: 'completed',
          embeddingRetryCount: 0,
          embeddingErrorMessage: null,
        }),
      );
      // retry 이벤트 emit 검증
      const retryEvents = mockWs.emitKbEvent.mock.calls.filter(
        (c) => c[1] === 'document:embedding_retry',
      );
      expect(retryEvents.length).toBe(1);
    });

    it('timeout 3회 연속 → failed + document:embedding_failed 이벤트', async () => {
      setupHappyKb();
      const err = new Error('Request timed out after 60000ms');
      mockLlm.embed.mockRejectedValue(err);

      const promise = service.processDocument('d1');
      // 1s + 4s + 16s 백오프 처리
      await jest.advanceTimersByTimeAsync(1000);
      await jest.advanceTimersByTimeAsync(4000);
      await jest.advanceTimersByTimeAsync(16000);
      await promise;

      const failedCalls = mockDocRepo.update.mock.calls.filter(
        (c) => c[1]?.embeddingStatus === 'failed',
      );
      expect(failedCalls.length).toBe(1);
      expect(failedCalls[0][1]).toEqual(
        expect.objectContaining({
          embeddingStatus: 'failed',
          // sanitize 가 timed-out → "Connection timed out..." 로 치환
          embeddingErrorMessage: expect.stringContaining('timed out'),
        }),
      );
      const failedEvents = mockWs.emitKbEvent.mock.calls.filter(
        (c) => c[1] === 'document:embedding_failed',
      );
      expect(failedEvents.length).toBe(1);
      // 4회 시도 동안 increment 4회 (initial fail + 3 retries 모두 onAttempt)
      expect(mockDocRepo.increment).toHaveBeenCalledTimes(4);
    });
  });
});
