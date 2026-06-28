import {
  AgentMemoryService,
  AGENT_MEMORY_MAX_PER_SCOPE,
  MEMORY_DEDUP_SIMILARITY,
  EmbedConfigSource,
  cosineSimilarity,
} from './agent-memory.service';

const embedCfg: EmbedConfigSource = {
  embeddingModelConfigId: 'emb-cfg-1',
};

describe('AgentMemoryService', () => {
  let service: AgentMemoryService;
  let mockDataSource: { query: jest.Mock; transaction: jest.Mock };
  let mockLlmService: {
    resolveConfig: jest.Mock;
    resolveEmbedding: jest.Mock;
    embed: jest.Mock;
  };

  beforeEach(() => {
    // W2: saveMemories 는 dataSource.transaction(manager) 안에서 manager.query 로
    // 실행한다. 테스트는 transaction 을 즉시 콜백 실행으로 흉내내되, manager.query
    // 를 동일한 query mock 으로 라우팅해 기존 호출 검증을 유지한다.
    const query = jest.fn();
    mockDataSource = {
      query,
      transaction: jest.fn(async (cb: (m: { query: jest.Mock }) => unknown) =>
        cb({ query }),
      ),
    };
    mockLlmService = {
      resolveConfig: jest.fn().mockResolvedValue({
        id: 'config-1',
        provider: 'openai',
        workspaceId: 'ws-1',
      }),
      // embedding 경로는 resolveEmbedding({embeddingModelConfigId}) → {config, model}.
      resolveEmbedding: jest.fn().mockResolvedValue({
        config: { id: 'emb-cfg-1', provider: 'openai', workspaceId: 'ws-1' },
        model: 'text-embedding-3-small',
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

    it('W-1: 제어문자/null byte 를 제거한다', () => {
      expect(service.resolveScopeKey('cust\x00' + '42', 'exec-1')).toBe(
        'cust42',
      );
      expect(service.resolveScopeKey('a\tb\nc', 'exec-1')).toBe('abc');
      // 제어문자만 있으면 빈 → executionId fallback.
      expect(service.resolveScopeKey('\x01\x02', 'exec-1')).toBe('exec-1');
    });

    it('W-1: 512자 초과 입력은 결정적 해시로 축약 (상한 이하, 안정적)', () => {
      const long = 'k'.repeat(2000);
      const out = service.resolveScopeKey(long, 'exec-1');
      expect(out.length).toBeLessThanOrEqual(512);
      // 결정적 — 같은 입력은 항상 같은 scope.
      expect(service.resolveScopeKey(long, 'exec-1')).toBe(out);
      // 다른 입력은 다른 scope (해시 충돌 회피).
      expect(service.resolveScopeKey('k'.repeat(2001), 'exec-1')).not.toBe(out);
    });

    it('W-1: 정확히 512자는 그대로 통과 (해시 축약 안 함)', () => {
      const exact = 'k'.repeat(512);
      expect(service.resolveScopeKey(exact, 'exec-1')).toBe(exact);
    });
  });

  describe('cosineSimilarity (W8 — 순수함수)', () => {
    it('동일 벡터는 1', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2, 3])).toBeCloseTo(1, 10);
    });

    it('직교 벡터는 0', () => {
      expect(cosineSimilarity([1, 0], [0, 1])).toBe(0);
    });

    it('길이 불일치면 0 (비유사 — DB round-trip 없이 방어)', () => {
      expect(cosineSimilarity([1, 2, 3], [1, 2])).toBe(0);
    });

    it('0-norm(영벡터)면 0 (나눗셈 0 가드)', () => {
      expect(cosineSimilarity([0, 0, 0], [1, 2, 3])).toBe(0);
      expect(cosineSimilarity([1, 2, 3], [0, 0, 0])).toBe(0);
    });

    it('빈 배열은 0', () => {
      expect(cosineSimilarity([], [])).toBe(0);
    });

    it('반대 방향(음의 상관)은 -1', () => {
      expect(cosineSimilarity([1, 2], [-1, -2])).toBeCloseTo(-1, 10);
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
      // 쿼리 임베딩은 embedCfg.embeddingModelConfigId + workspaceId 로 resolve 돼야
      // 저장 임베딩과 동일 config(차원 일치) 를 보장한다 (spec §3 불변식).
      expect(mockLlmService.resolveEmbedding).toHaveBeenCalledWith(
        'emb-cfg-1',
        'ws-1',
      );
    });

    it('I5: buildCosineMatch 파라미터 순서 계약 — $1=vector, $2=ws, $3=scope, $4=threshold', async () => {
      const vec = new Array(1536).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([]);
      await service.recall('ws-c', 'scope-c', 'q', embedCfg, {
        threshold: 0.6,
        topK: 4,
      });
      const [sql, params] = mockDataSource.query.mock.calls[0];
      // $1 = query vector (pgvector literal), 그 다음 ws/scope/threshold 순.
      expect(typeof params[0]).toBe('string');
      expect(params[0]).toMatch(/^\[/);
      expect(params[1]).toBe('ws-c');
      expect(params[2]).toBe('scope-c');
      expect(params[3]).toBe(0.6);
      expect(params[4]).toBe(4);
      // SQL 이 빌더가 만든 $1(vector)·$4(임계) 를 cosine score/WHERE 에서 참조.
      expect(sql).toContain('$1::');
      expect(sql).toContain('>= $4');
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

    it('AGM-10: recall SQL 은 만료 row 를 제외한다 (expires_at IS NULL OR expires_at > now())', async () => {
      const vec = new Array(1536).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([]);
      await service.recall('ws-1', 'scope-1', 'q', embedCfg);
      const [sql] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('am.expires_at IS NULL OR am.expires_at > now()');
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

    it('크로스 워크스페이스 격리 — recall(ws-2) 는 ws-2 만 바인딩, ws-1 미포함 (AGM-07)', async () => {
      const vec = new Array(1536).fill(0.01);
      mockLlmService.embed.mockResolvedValue([vec]);
      mockDataSource.query.mockResolvedValue([]);

      await service.recall('ws-2', 'shared-scope', 'who am i', embedCfg);

      const [sql, params] = mockDataSource.query.mock.calls[0];
      // workspace_id 는 항상 별도 필터로 강제된다 (scope_key 와 독립).
      expect(sql).toContain('am.workspace_id = $2');
      // params[1] 이 workspaceId 바인딩 — ws-2 만, ws-1 은 어떤 param 에도 없음.
      expect(params[1]).toBe('ws-2');
      expect(params).not.toContain('ws-1');
    });
  });

  describe('saveMemories (spec §4, AGM-06/AGM-07/AGM-09/AGM-10)', () => {
    // 1536 차원 벡터 헬퍼 — dedup SELECT 가 SUPPORTED_EMBEDDING_DIMS 를 타도록.
    // 균일-fill 벡터는 서로 평행(cosine=1)이라 batch dedup 이 오발동하므로,
    // 서로 직교에 가까운(비유사) 벡터가 필요하면 vOrtho(idx) 를 쓴다.
    const v = (fill: number) => new Array(1536).fill(fill);
    // idx 위치만 1.0 인 one-hot 벡터 — 서로 다른 idx 면 cosine 0 (비유사).
    const vOrtho = (idx: number) => {
      const arr = new Array(1536).fill(0);
      arr[idx] = 1;
      return arr;
    };

    // 유사 fact 없음(dedup SELECT 빈 배열) + INSERT RETURNING id 를 흉내내는
    // query mock. 호출 순서: [dedup SELECT, INSERT, ... , evict-expired, evict-fifo]
    function mockNoSimilar(): void {
      let insertSeq = 0;
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('INSERT INTO agent_memory')) {
          return Promise.resolve([{ id: `new-${insertSeq++}` }]);
        }
        // dedup SELECT (am.id) → 유사 없음. evict DELETE → undefined.
        return Promise.resolve([]);
      });
    }

    it('유사 기존 fact 가 없으면 INSERT 하고 evict 를 호출한다', async () => {
      // 서로 비유사(직교) 벡터 → batch dedup 미발동, 둘 다 INSERT.
      mockLlmService.embed.mockResolvedValue([vOrtho(0), vOrtho(1)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [
          { content: 'user likes tea', metadata: { kind: 'preference' } },
          { content: 'user is in Seoul' },
        ],
        embedCfgSource: embedCfg,
      });

      // 저장 임베딩 모델은 embedCfg.embeddingModelConfigId 로 resolve 한 config 의
      // defaultModel ('text-embedding-3-small') 이어야 한다 (회수와 동일 config → 차원 일치).
      expect(mockLlmService.resolveEmbedding).toHaveBeenCalledWith(
        'emb-cfg-1',
        'ws-1',
      );
      expect(mockLlmService.embed).toHaveBeenCalledWith(
        expect.anything(),
        ['user likes tea', 'user is in Seoul'],
        'text-embedding-3-small',
        undefined,
        'document',
      );

      const calls = mockDataSource.query.mock.calls;
      const insertCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      // 두 fact (서로 비유사) → 두 번 INSERT.
      expect(insertCalls).toHaveLength(2);
      const [insertSql, insertParams] = insertCalls[0];
      expect(insertSql).toContain('INSERT INTO agent_memory');
      expect(insertSql).toContain('RETURNING id');
      expect(insertParams[0]).toBe('ws-1');
      expect(insertParams[1]).toBe('scope-1');
      expect(insertParams[2]).toBe('user likes tea');
      expect(insertParams[4]).toBe(JSON.stringify({ kind: 'preference' }));
    });

    it('AGM-09: 유사 기존 fact 가 있으면 INSERT 대신 그 row 를 UPDATE 한다', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT am.id')) {
          return Promise.resolve([{ id: 'existing-99' }]); // 유사 fact 존재.
        }
        return Promise.resolve(undefined);
      });

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [
          {
            content: 'user account tier is gold',
            metadata: { kind: 'entity' },
          },
        ],
        embedCfgSource: embedCfg,
      });

      const calls = mockDataSource.query.mock.calls;
      const updateCall = calls.find((c: unknown[]) =>
        (c[0] as string).includes('UPDATE agent_memory'),
      );
      const insertCall = calls.find((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      expect(insertCall).toBeUndefined(); // INSERT 안 함.
      expect(updateCall).toBeDefined();
      const [updateSql, updateParams] = updateCall as [string, unknown[]];
      expect(updateSql).toContain('SET content = $2');
      expect(updateSql).toContain('updated_at = now()');
      expect(updateParams[0]).toBe('existing-99'); // 갱신 대상 id.
      expect(updateParams[1]).toBe('user account tier is gold');
    });

    it('AGM-09: dedup SELECT 은 (workspace_id, scope_key) + MEMORY_DEDUP_SIMILARITY 임계로 LIMIT 1', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-3',
        scopeKey: 'scope-q',
        items: [{ content: 'x' }],
        embedCfgSource: embedCfg,
      });

      const dedupCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('SELECT am.id'),
      );
      expect(dedupCall).toBeDefined();
      const [dedupSql, dedupParams] = dedupCall as [string, unknown[]];
      expect(dedupSql).toContain('am.workspace_id = $2');
      expect(dedupSql).toContain('am.scope_key = $3');
      expect(dedupSql).toContain('LIMIT 1');
      // I5: recall 과 동일한 buildCosineMatch 파라미터 순서 계약 —
      // params: [vectorStr($1), ws($2), scope($3), MEMORY_DEDUP_SIMILARITY($4)]
      expect(typeof dedupParams[0]).toBe('string');
      expect(dedupParams[0]).toMatch(/^\[/); // $1 = query vector (pgvector literal)
      expect(dedupParams[1]).toBe('ws-3');
      expect(dedupParams[2]).toBe('scope-q');
      expect(dedupParams[3]).toBe(MEMORY_DEDUP_SIMILARITY);
      expect(dedupSql).toContain('$1::');
      expect(dedupSql).toContain('>= $4');
    });

    it('AGM-09: 같은 batch 내 유사 fact 는 두 번째를 INSERT 하지 않고 UPDATE', async () => {
      // 두 fact 의 임베딩이 동일 → cosine 1.0 ≥ 임계 → batch 내 dedup.
      mockLlmService.embed.mockResolvedValue([v(0.5), v(0.5)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'fact one' }, { content: 'fact one repeated' }],
        embedCfgSource: embedCfg,
      });

      const calls = mockDataSource.query.mock.calls;
      const insertCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      const updateCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('UPDATE agent_memory'),
      );
      // 첫 fact INSERT, 두 번째는 같은 row UPDATE.
      expect(insertCalls).toHaveLength(1);
      expect(updateCalls).toHaveLength(1);
      const [, updateParams] = updateCalls[0];
      expect(updateParams[0]).toBe('new-0'); // 첫 INSERT 의 RETURNING id.
    });

    it('I4: batch 3개 중 1·3번이 유사하면 3번째도 같은 row 를 재탐지·UPDATE (UPDATE 분기 push)', async () => {
      // emb0 == emb2 (cosine 1), emb1 직교. 처리: INSERT(0) → INSERT(1) →
      // findSimilarInBatch(emb2) 가 batchSeen 의 emb0(=emb2) 를 찾아 UPDATE.
      const emb0 = vOrtho(0);
      const emb1 = vOrtho(1);
      const emb2 = vOrtho(0); // emb0 와 동일.
      mockLlmService.embed.mockResolvedValue([emb0, emb1, emb2]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [
          { content: 'fact A' },
          { content: 'fact B' },
          { content: 'fact A2' },
        ],
        embedCfgSource: embedCfg,
      });

      const calls = mockDataSource.query.mock.calls;
      const insertCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      const updateCalls = calls.filter((c: unknown[]) =>
        (c[0] as string).includes('UPDATE agent_memory'),
      );
      // fact A, fact B → INSERT(2). fact A2 → 1·3 유사로 UPDATE(1) (INSERT 아님).
      expect(insertCalls).toHaveLength(2);
      expect(updateCalls).toHaveLength(1);
      // UPDATE 대상은 첫 INSERT(new-0)의 row.
      expect(updateCalls[0][1][0]).toBe('new-0');
    });

    it('W2: saveMemories 는 dataSource.transaction 안에서 dedup-insert/evict 를 실행한다', async () => {
      mockLlmService.embed.mockResolvedValue([vOrtho(0)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'x' }],
        embedCfgSource: embedCfg,
      });

      // 트랜잭션 래핑 — transaction 이 1회 호출되고 그 안에서 INSERT/evict 발생.
      expect(mockDataSource.transaction).toHaveBeenCalledTimes(1);
      const insertCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      expect(insertCall).toBeDefined();
    });

    it('I19: dedup SELECT 가 DB 에러여도 throw 하지 않고 INSERT 로 graceful 진행', async () => {
      mockLlmService.embed.mockResolvedValue([vOrtho(0)]);
      let insertSeq = 0;
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT am.id')) {
          return Promise.reject(new Error('pgvector index missing'));
        }
        if (sql.includes('INSERT INTO agent_memory')) {
          return Promise.resolve([{ id: `new-${insertSeq++}` }]);
        }
        return Promise.resolve([]);
      });

      await expect(
        service.saveMemories({
          workspaceId: 'ws-1',
          scopeKey: 'scope-1',
          items: [{ content: 'x' }],
          embedCfgSource: embedCfg,
        }),
      ).resolves.toBeUndefined();

      const insertCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      );
      expect(insertCall).toBeDefined(); // dedup 실패해도 INSERT 됨.
    });

    it('C1/AGM-10: ttlDays 양수면 INSERT expires_at 을 파라미터 바인딩한다 (리터럴 보간 금지)', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'ttl fact' }],
        embedCfgSource: embedCfg,
        ttlDays: 30,
      });

      const insertCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      ) as [string, unknown[]];
      // C1: ttlDays 가 SQL 리터럴이 아니라 파라미터($N)로 바인딩되어야 한다.
      expect(insertCall[0]).toContain("now() + ($6 * INTERVAL '1 day')");
      expect(insertCall[0]).not.toContain("'30 days'"); // 리터럴 보간 금지.
      expect(insertCall[1]).toContain(30); // $6 = ttlDays.
    });

    it('AGM-10: ttlDays 미지정/0/음수면 INSERT expires_at = NULL (무만료, 바인딩 없음)', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'x' }],
        embedCfgSource: embedCfg,
      });
      const insertCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('INSERT INTO agent_memory'),
      ) as [string, unknown[]];
      expect(insertCall[0]).toContain('NULL');
      expect(insertCall[0]).not.toContain('INTERVAL');
      // expires_at 바인딩 파라미터($6) 없음 — params 길이 5 (ttlDays 미push).
      expect(insertCall[1]).toHaveLength(5);
    });

    it('W1: UPDATE(dedup 갱신) 는 ttlDays 미지정 시 expires_at 을 건드리지 않는다 (기존 TTL 보존)', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT am.id')) {
          return Promise.resolve([{ id: 'existing-1' }]);
        }
        return Promise.resolve(undefined);
      });

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'updated fact' }],
        embedCfgSource: embedCfg,
        // ttlDays 미지정.
      });

      const updateCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('UPDATE agent_memory'),
      ) as [string, unknown[]];
      expect(updateCall).toBeDefined();
      // W1: SET 절에 expires_at 이 없어야 기존 row 의 TTL 이 보존된다.
      expect(updateCall[0]).not.toContain('expires_at');
      expect(updateCall[0]).not.toContain('INTERVAL');
    });

    it('C1/W1: UPDATE 는 ttlDays 양수 시에만 expires_at 을 파라미터 바인딩으로 재설정', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockDataSource.query.mockImplementation((sql: string) => {
        if (sql.includes('SELECT am.id')) {
          return Promise.resolve([{ id: 'existing-1' }]);
        }
        return Promise.resolve(undefined);
      });

      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: 'updated fact' }],
        embedCfgSource: embedCfg,
        ttlDays: 7,
      });

      const updateCall = mockDataSource.query.mock.calls.find((c: unknown[]) =>
        (c[0] as string).includes('UPDATE agent_memory'),
      ) as [string, unknown[]];
      expect(updateCall[0]).toContain(
        "expires_at = now() + ($5 * INTERVAL '1 day')",
      );
      expect(updateCall[0]).not.toContain("'7 days'");
      expect(updateCall[1]).toContain(7); // $5 = ttlDays.
    });

    it('빈 content 항목은 걸러내고, 모두 비면 no-op', async () => {
      await service.saveMemories({
        workspaceId: 'ws-1',
        scopeKey: 'scope-1',
        items: [{ content: '   ' }, { content: '' }],
        embedCfgSource: embedCfg,
      });
      expect(mockLlmService.embed).not.toHaveBeenCalled();
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });

    it('evict 는 만료 row(DELETE expires_at < now) + FIFO N=AGENT_MEMORY_MAX_PER_SCOPE 둘 다 호출', async () => {
      mockLlmService.embed.mockResolvedValue([v(0.1)]);
      mockNoSimilar();

      await service.saveMemories({
        workspaceId: 'ws-7',
        scopeKey: 'scope-z',
        items: [{ content: 'a fact' }],
        embedCfgSource: embedCfg,
      });

      const calls = mockDataSource.query.mock.calls;
      const expiredEvict = calls.find(
        (c: unknown[]) =>
          (c[0] as string).includes('DELETE FROM agent_memory') &&
          (c[0] as string).includes('expires_at < now()'),
      );
      const fifoEvict = calls.find(
        (c: unknown[]) =>
          (c[0] as string).includes('DELETE FROM agent_memory') &&
          (c[0] as string).includes('OFFSET $3'),
      );
      expect(expiredEvict).toBeDefined();
      expect(fifoEvict).toBeDefined();
      const [fifoSql, fifoParams] = fifoEvict as [string, unknown[]];
      expect(fifoSql).toContain('ORDER BY created_at DESC');
      expect(fifoParams).toEqual([
        'ws-7',
        'scope-z',
        AGENT_MEMORY_MAX_PER_SCOPE,
      ]);

      // 순서: 만료 DELETE(expires_at < now()) 가 FIFO DELETE(OFFSET) 보다 먼저.
      const sqls = calls.map((c: unknown[]) => c[0] as string);
      const expiredIdx = sqls.findIndex(
        (s) =>
          s.includes('DELETE FROM agent_memory') &&
          s.includes('expires_at < now()'),
      );
      const fifoIdx = sqls.findIndex(
        (s) =>
          s.includes('DELETE FROM agent_memory') && s.includes('OFFSET $3'),
      );
      expect(expiredIdx).toBeGreaterThanOrEqual(0);
      expect(fifoIdx).toBeGreaterThan(expiredIdx);
      // 만료 DELETE 절의 SQL — partial index 조건.
      const [expiredSql] = expiredEvict as [string, unknown[]];
      expect(expiredSql).toContain('expires_at IS NOT NULL');
      expect(expiredSql).toContain('expires_at < now()');
    });

    it('빈 임베딩 벡터면 throw 한다 (차원 mismatch 방어)', async () => {
      mockLlmService.embed.mockResolvedValue([[]]);
      await expect(
        service.saveMemories({
          workspaceId: 'ws-1',
          scopeKey: 'scope-1',
          items: [{ content: 'x' }],
          embedCfgSource: embedCfg,
        }),
      ).rejects.toThrow('Embedding vector is empty');
    });

    it('I3/W-1: 옵션 객체가 아닌 인자(구 포지셔널 오용)면 throw 한다', async () => {
      await expect(
        // @ts-expect-error 구 포지셔널 호출 시뮬레이션 — 런타임 계약 가드 검증.
        service.saveMemories('ws-1'),
      ).rejects.toThrow('args must be an options object');
    });

    it('AGENT_MEMORY_MAX_PER_SCOPE 상수는 1000, MEMORY_DEDUP_SIMILARITY 는 0.85 (spec §4)', () => {
      expect(AGENT_MEMORY_MAX_PER_SCOPE).toBe(1000);
      expect(MEMORY_DEDUP_SIMILARITY).toBe(0.85);
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
      // 기본 mock: BullMQ 가 신규 job 을 수락한 상황 — 반환 job.data 는 우리가
      // enqueue 한 payload (enqueueNonce 포함) 를 그대로 echo 한다. dedup-drop 은
      // 별도 테스트에서 다른 nonce 를 가진 job 을 반환해 시뮬레이션한다.
      mockQueue = {
        add: jest
          .fn()
          .mockImplementation((_name, payload) =>
            Promise.resolve({ data: payload }),
          ),
      };
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
      // M1: 완료 job 즉시 제거 — 완료-보존 job 으로 인한 dedup livelock 방지.
      expect(opts).toMatchObject({ removeOnComplete: true, removeOnFail: 100 });
    });

    it('W3: jobId 를 agent-memory:<ws>:<scope> 로 고정해 동시 추출을 dedup/직렬화한다', async () => {
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        turns,
      });
      const [, , opts] = mockQueue.add.mock.calls[0];
      expect(opts.jobId).toBe('agent-memory:ws-1:cust-7');
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

    it('큐 미주입 시 graceful no-op (throw 안 함, false 반환)', async () => {
      // 큐 미주입 → enqueue 자체가 불가 → accepted=false (M1 — watermark 미전진).
      await expect(
        service.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBe(false);
    });

    it('enqueue 실패는 삼킨다 (대화 계속 — graceful, false 반환)', async () => {
      mockQueue.add.mockRejectedValue(new Error('redis down'));
      // 에러를 throw 하지 않고 삼키되 accepted=false (M1 — watermark 미전진).
      await expect(
        serviceWithQueue.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBe(false);
    });

    it('정상 enqueue 시 true 반환 (M1 — watermark 전진 조건)', async () => {
      await expect(
        serviceWithQueue.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBe(true);
    });

    it('M1: BullMQ jobId dedup-drop (다른 nonce job 반환) 시 false 반환', async () => {
      // active job 이 이미 있어 add() 가 기존 job (우리 nonce 가 아닌) 을 반환.
      mockQueue.add.mockResolvedValueOnce({
        data: { enqueueNonce: 'some-other-active-jobs-nonce' },
      });
      await expect(
        serviceWithQueue.scheduleExtraction({
          workspaceId: 'ws-1',
          scopeKey: 'cust-7',
          turns,
        }),
      ).resolves.toBe(false);
    });

    it('payload 에 embeddingModelConfigId 를 전달한다 (회수/추출 차원 일치)', async () => {
      await serviceWithQueue.scheduleExtraction({
        workspaceId: 'ws-1',
        scopeKey: 'cust-7',
        embeddingModelConfigId: 'emb-cfg-large',
        turns,
      });
      const payload = mockQueue.add.mock.calls[0][1];
      expect(payload.embeddingModelConfigId).toBe('emb-cfg-large');
    });
  });
});
