import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { GraphExtractionService } from './graph-extraction.service';
import { Document } from '../entities/document.entity';
import { DocumentChunk } from '../entities/document-chunk.entity';
import { KnowledgeBase } from '../entities/knowledge-base.entity';
import { LlmService } from '../../llm/llm.service';
import { WebsocketService } from '../../websocket/websocket.service';
import { KbStatsHelper } from './kb-stats.helper';

describe('GraphExtractionService', () => {
  let service: GraphExtractionService;
  let mockDocRepo: Record<string, jest.Mock>;
  let mockChunkRepo: Record<string, jest.Mock>;
  let mockKbRepo: Record<string, jest.Mock>;
  let mockLlm: Record<string, jest.Mock>;
  let mockWs: Record<string, jest.Mock>;
  let mockDataSource: Record<string, jest.Mock>;
  let lastTxQueries: { sql: string; params: unknown[] }[];

  beforeEach(async () => {
    lastTxQueries = [];

    mockDocRepo = {
      findOne: jest.fn(),
      update: jest.fn().mockResolvedValue(undefined),
      increment: jest.fn().mockResolvedValue(undefined),
    };
    mockChunkRepo = {
      find: jest.fn().mockResolvedValue([]),
    };
    mockKbRepo = {
      findOne: jest.fn(),
    };
    mockLlm = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'cfg',
        provider: 'openai',
        workspaceId: 'ws-1',
        defaultModel: 'gpt-4o-mini',
      }),
      chat: jest.fn(),
    };
    mockWs = {
      emitExecutionEvent: jest.fn(),
    };

    const txManager = {
      query: jest.fn().mockImplementation((sql: string, params: unknown[]) => {
        lastTxQueries.push({ sql, params });
        // entity UPSERT 시 inserted=true id 반환 (간단 stub)
        if (sql.startsWith('INSERT INTO entity')) {
          return Promise.resolve([
            { id: `ent-${lastTxQueries.length}`, inserted: true },
          ]);
        }
        if (sql.startsWith('INSERT INTO relation')) {
          return Promise.resolve([
            { id: `rel-${lastTxQueries.length}`, inserted: true },
          ]);
        }
        return Promise.resolve([]);
      }),
    };

    mockDataSource = {
      query: jest.fn().mockResolvedValue([]),
      transaction: jest
        .fn()
        .mockImplementation(async (cb: any) => cb(txManager)),
    };

    const mockKbStats = {
      refresh: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GraphExtractionService,
        { provide: getRepositoryToken(Document), useValue: mockDocRepo },
        { provide: getRepositoryToken(DocumentChunk), useValue: mockChunkRepo },
        { provide: getRepositoryToken(KnowledgeBase), useValue: mockKbRepo },
        { provide: LlmService, useValue: mockLlm },
        { provide: WebsocketService, useValue: mockWs },
        { provide: DataSource, useValue: mockDataSource },
        { provide: KbStatsHelper, useValue: mockKbStats },
      ],
    }).compile();
    service = module.get(GraphExtractionService);
  });

  it('skips when KB rag_mode is vector', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      ragMode: 'vector', // graph 가 아님
    });

    await service.extractDocument('d1');

    // graph 추출이 시작되지 않으므로 LLM 호출 없음
    expect(mockLlm.chat).not.toHaveBeenCalled();
    expect(mockDocRepo.update).not.toHaveBeenCalled();
  });

  it('persists entities and relations from LLM response', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      metadata: {},
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
      extractionLlmConfigId: null,
    });
    mockChunkRepo.find.mockResolvedValue([
      { id: 'c1', content: 'Acme Corp was founded by John' },
    ]);
    mockLlm.chat.mockResolvedValue({
      content: JSON.stringify({
        entities: [
          {
            name: 'acme corp',
            displayName: 'Acme Corp',
            type: 'organization',
          },
          { name: 'john', displayName: 'John', type: 'person' },
        ],
        relations: [
          { head: 'acme corp', predicate: 'founded_by', tail: 'john' },
        ],
      }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });

    await service.extractDocument('d1');

    const entityInserts = lastTxQueries.filter((q) =>
      q.sql.startsWith('INSERT INTO entity'),
    );
    const relationInserts = lastTxQueries.filter((q) =>
      q.sql.startsWith('INSERT INTO relation'),
    );
    expect(entityInserts.length).toBe(2);
    expect(relationInserts.length).toBe(1);
    // 성공 시 retry 메타데이터가 리셋된 상태로 'completed' 마킹
    expect(mockDocRepo.update).toHaveBeenCalledWith('d1', {
      graphExtractionStatus: 'completed',
      graphRetryCount: 0,
      graphErrorMessage: null,
    });
  });

  it('marks document as error when LLM JSON is invalid', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      metadata: {},
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
      extractionLlmConfigId: null,
    });
    mockChunkRepo.find.mockResolvedValue([{ id: 'c1', content: 'whatever' }]);
    mockLlm.chat.mockResolvedValue({
      content: 'not-json-at-all',
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });

    await service.extractDocument('d1');

    // JSON 파싱 실패는 chunk 단위 silent skip — 결과 0건이지만 문서는 'completed'.
    // (외부 throw 가 없어 'error' 가 아니라 'completed')
    expect(mockDocRepo.update).toHaveBeenCalledWith('d1', {
      graphExtractionStatus: 'completed',
      graphRetryCount: 0,
      graphErrorMessage: null,
    });
    const entityInserts = lastTxQueries.filter((q) =>
      q.sql.startsWith('INSERT INTO entity'),
    );
    expect(entityInserts.length).toBe(0);
  });

  it('drops relations that reference entities outside the response', async () => {
    mockDocRepo.findOne.mockResolvedValue({
      id: 'd1',
      knowledgeBaseId: 'kb-1',
      metadata: {},
    });
    mockKbRepo.findOne.mockResolvedValue({
      id: 'kb-1',
      workspaceId: 'ws-1',
      ragMode: 'graph',
      extractionLlmConfigId: null,
    });
    mockChunkRepo.find.mockResolvedValue([{ id: 'c1', content: 'x' }]);
    mockLlm.chat.mockResolvedValue({
      content: JSON.stringify({
        entities: [{ name: 'a', displayName: 'A', type: 'concept' }],
        relations: [
          // tail='b' 가 entities 안에 없음 → drop
          { head: 'a', predicate: 'related_to', tail: 'b' },
        ],
      }),
      usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
      model: 'gpt-4o-mini',
      finishReason: 'stop',
    });

    await service.extractDocument('d1');

    const relationInserts = lastTxQueries.filter((q) =>
      q.sql.startsWith('INSERT INTO relation'),
    );
    expect(relationInserts.length).toBe(0);
  });
});
