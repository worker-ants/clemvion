import {
  AgentMemoryService,
  AGENT_MEMORY_MAX_PER_SCOPE,
  EmbedConfigSource,
} from './agent-memory.service';

const embedCfg: EmbedConfigSource = {
  llmConfigId: null,
  embeddingModel: 'text-embedding-3-small',
};

describe('AgentMemoryService', () => {
  let service: AgentMemoryService;
  let mockDataSource: { query: jest.Mock };
  let mockLlmService: { resolveConfig: jest.Mock; embed: jest.Mock };

  beforeEach(() => {
    mockDataSource = { query: jest.fn() };
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        workspaceId: 'ws-1',
      }),
      embed: jest.fn(),
    };
    service = new AgentMemoryService(
      mockDataSource as never,
      mockLlmService as never,
    );
  });

  describe('resolveScopeKey (spec §2, AGM-03)', () => {
    it('truthy memoryKey 면 그 값을 반환한다 (세션 간 영속)', () => {
      expect(service.resolveScopeKey('cust-42', 'exec-1')).toBe('cust-42');
    });

    it('memoryKey 가 undefined 면 executionId fallback (세션 격리)', () => {
      expect(service.resolveScopeKey(undefined, 'exec-1')).toBe('exec-1');
    });

    it('memoryKey 가 null 이면 executionId fallback', () => {
      expect(service.resolveScopeKey(null, 'exec-1')).toBe('exec-1');
    });

    it('memoryKey 가 빈 문자열/공백이면 executionId fallback', () => {
      expect(service.resolveScopeKey('', 'exec-1')).toBe('exec-1');
      expect(service.resolveScopeKey('   ', 'exec-1')).toBe('exec-1');
    });
  });

  describe('recall (spec §4, AGM-05/AGM-07)', () => {
    it('빈 queryText / workspaceId / scopeKey 면 임베딩 없이 빈 배열', async () => {
      expect(await service.recall('ws-1', 'scope-1', '  ', embedCfg)).toEqual(
        [],
      );
      expect(await service.recall('', 'scope-1', 'q', embedCfg)).toEqual([]);
      expect(await service.recall('ws-1', '', 'q', embedCfg)).toEqual([]);
      expect(mockLlmService.embed).not.toHaveBeenCalled();
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('workspace_id + scope_key 격리 파라미터로 cosine 검색 SQL 을 실행한다', async () => {
      const vec = new Array(1536).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([
        { content: 'fact A', score: '0.91' },
        { content: 'fact B', score: '0.80' },
      ]);

      const result = await service.recall(
        'ws-1',
        'cust-42',
        'who am i',
        embedCfg,
        { topK: 3, threshold: 0.5 },
      );

      expect(result).toEqual([
        { content: 'fact A', score: 0.91 },
        { content: 'fact B', score: 0.8 },
      ]);

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('FROM agent_memory');
      expect(sql).toContain('am.workspace_id = $2');
      expect(sql).toContain('am.scope_key = $3');
      // params: [vectorStr, workspaceId, scopeKey, threshold, topK]
      expect(params[1]).toBe('ws-1');
      expect(params[2]).toBe('cust-42');
      expect(params[3]).toBe(0.5);
      expect(params[4]).toBe(3);
    });

    it('opts 미지정 시 topK=5 / threshold=0.7 기본값을 바인딩한다', async () => {
      const vec = new Array(1536).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([
        { content: 'remembered', score: '0.88' },
      ]);

      const result = await service.recall(
        'ws-9',
        'scope-x',
        'context query',
        embedCfg,
      );

      expect(result).toEqual([{ content: 'remembered', score: 0.88 }]);
      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('vector(1536)');
      expect(sql).toContain('vector_dims(am.embedding) = 1536');
      expect(params[1]).toBe('ws-9');
      expect(params[2]).toBe('scope-x');
      expect(params[3]).toBe(0.7); // default threshold
      expect(params[4]).toBe(5); // default topK
    });

    it('지원되지 않는 차원이면 SQL 실행 없이 빈 배열', async () => {
      mockLlmService.embed.mockResolvedValue([[0.1, 0.2, 0.3]]); // dim=3 unsupported
      const result = await service.recall('ws-1', 'scope-1', 'q', embedCfg);
      expect(result).toEqual([]);
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('3072 차원은 halfvec cast 를 사용한다', async () => {
      const vec = new Array(3072).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([]);
      await service.recall('ws-1', 'scope-1', 'q', embedCfg);
      const [sql] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('halfvec(3072)');
    });

    it('임베딩/SQL 에러는 throw 하지 않고 빈 배열로 graceful', async () => {
      mockLlmService.embed.mockRejectedValue(new Error('provider down'));
      const result = await service.recall('ws-1', 'scope-1', 'q', embedCfg);
      expect(result).toEqual([]);
    });
  });

  describe('saveMemories (spec §4, AGM-06/AGM-07)', () => {
    it('content 를 임베딩해 insert 하고 evict 를 호출한다', async () => {
      mockLlmService.embed.mockResolvedValue([
        [0.1, 0.2],
        [0.3, 0.4],
      ]);
      mockDataSource.query.mockResolvedValue(undefined);

      await service.saveMemories(
        'ws-1',
        'scope-1',
        [
          { content: 'user likes tea', metadata: { kind: 'preference' } },
          { content: 'user is in Seoul' },
        ],
        embedCfg,
      );

      // 임베딩 호출: resolveConfig + embed
      expect(mockLlmService.resolveConfig).toHaveBeenCalledWith(
        undefined,
        'ws-1',
      );
      expect(mockLlmService.embed).toHaveBeenCalledWith(
        expect.anything(),
        ['user likes tea', 'user is in Seoul'],
        'text-embedding-3-small',
      );

      // 두 query: INSERT + evict DELETE
      expect(mockDataSource.query).toHaveBeenCalledTimes(2);
      const [insertSql, insertParams] = mockDataSource.query.mock.calls[0];
      expect(insertSql).toContain('INSERT INTO agent_memory');
      expect(insertSql).toContain('embedding');
      // 첫 row params: workspace_id, scope_key, content, vectorStr, metadata
      expect(insertParams[0]).toBe('ws-1');
      expect(insertParams[1]).toBe('scope-1');
      expect(insertParams[2]).toBe('user likes tea');
      expect(insertParams[4]).toBe(JSON.stringify({ kind: 'preference' }));
    });

    it('빈 content 항목은 걸러내고, 모두 비면 no-op', async () => {
      await service.saveMemories(
        'ws-1',
        'scope-1',
        [{ content: '   ' }, { content: '' }],
        embedCfg,
      );
      expect(mockLlmService.embed).not.toHaveBeenCalled();
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('evict 는 (workspace_id, scope_key) + N=AGENT_MEMORY_MAX_PER_SCOPE OFFSET 으로 오래된 순 삭제', async () => {
      mockLlmService.embed.mockResolvedValue([[0.1, 0.2]]);
      mockDataSource.query.mockResolvedValue(undefined);

      await service.saveMemories(
        'ws-7',
        'scope-z',
        [{ content: 'a fact' }],
        embedCfg,
      );

      const [evictSql, evictParams] = mockDataSource.query.mock.calls[1];
      expect(evictSql).toContain('DELETE FROM agent_memory');
      expect(evictSql).toContain('ORDER BY created_at DESC');
      expect(evictSql).toContain('OFFSET $3');
      expect(evictParams).toEqual([
        'ws-7',
        'scope-z',
        AGENT_MEMORY_MAX_PER_SCOPE,
      ]);
    });

    it('빈 임베딩 벡터면 throw 한다 (차원 mismatch 방어)', async () => {
      mockLlmService.embed.mockResolvedValue([[]]);
      await expect(
        service.saveMemories('ws-1', 'scope-1', [{ content: 'x' }], embedCfg),
      ).rejects.toThrow('Embedding vector is empty');
    });

    it('AGENT_MEMORY_MAX_PER_SCOPE 상수는 1000 이다 (spec §4)', () => {
      expect(AGENT_MEMORY_MAX_PER_SCOPE).toBe(1000);
    });
  });

  describe('scheduleExtraction (spec §3, AGM-04 — producer)', () => {
    let mockQueue: { add: jest.Mock };
    let serviceWithQueue: AgentMemoryService;

    const turns = [
      { source: 'ai_user' as const, text: '내 이름은 지수', nodeLabel: 'A' },
      { source: 'ai_assistant' as const, text: '반가워요', nodeLabel: 'A' },
    ];

    beforeEach(() => {
      mockQueue = { add: jest.fn().mockResolvedValue(undefined) };
      serviceWithQueue = new AgentMemoryService(
        mockDataSource as never,
        mockLlmService as never,
        mockQueue as never,
      );
    });

    it('payload 필드 (workspaceId/scopeKey/llmConfigId/model/turns) 로 enqueue', async () => {
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        llmConfigId: 'cfg-1',
        model: 'gpt-4o',
        turns,
      });
      expect(mockQueue.add).toHaveBeenCalledTimes(1);
      const [jobName, payload, opts] = mockQueue.add.mock.calls[0];
      expect(jobName).toBe('extract');
      expect(payload).toMatchObject({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        llmConfigId: 'cfg-1',
        model: 'gpt-4o',
      });
      expect(payload.turns).toEqual(turns);
      expect(opts).toMatchObject({ removeOnComplete: 100, removeOnFail: 100 });
    });

    it('payload.turns 는 입력 array 의 copy (이후 mutation 격리)', async () => {
      const mutable = [...turns];
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        turns: mutable,
      });
      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.turns).not.toBe(mutable); // 다른 배열 참조.
      mutable.push({ source: 'ai_user', text: 'X', nodeLabel: 'A' });
      expect(payload.turns).toHaveLength(2); // enqueue 후 mutation 무영향.
    });

    it('빈 turns / workspaceId / scopeKey 면 enqueue 안 함', async () => {
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        turns: [],
      });
      await serviceWithQueue.scheduleExtraction({
        workspaceId: '',
        scopeKey: 'cust-7',
        turns,
      });
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: '',
        turns,
      });
      expect(mockQueue.add).not.toHaveBeenCalled();
    });

    it('큐 미주입 시 graceful no-op (throw 안 함)', async () => {
      await expect(
        service.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBeUndefined();
    });

    it('enqueue 실패는 삼킨다 (대화 계속 — graceful)', async () => {
      mockQueue.add.mockRejectedValue(new Error('redis down'));
      await expect(
        serviceWithQueue.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBeUndefined();
    });
  });
});
