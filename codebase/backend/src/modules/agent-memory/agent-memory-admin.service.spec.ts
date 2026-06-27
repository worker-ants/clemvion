import { AgentMemoryAdminService } from './agent-memory-admin.service';

describe('AgentMemoryAdminService (spec §6, AGM-12/13)', () => {
  let service: AgentMemoryAdminService;
  let mockDataSource: { query: jest.Mock };

  beforeEach(() => {
    // admin read/delete 는 트랜잭션 없이 dataSource.query 만 쓴다 (runtime
    // saveMemories 의 transaction 래핑과 분리된 책임 — A1 SRP 분리).
    mockDataSource = { query: jest.fn() };
    service = new AgentMemoryAdminService(mockDataSource as never);
  });

  describe('listScopes (spec §6, AGM-12)', () => {
    it('distinct scope 목록을 단일쿼리(GROUP BY + COUNT(*) OVER() total)로 집계 (workspace_id 격리)', async () => {
      // 단일 쿼리: 각 grouped 행에 COUNT(*) OVER() total 이 부착돼 반환된다.
      mockDataSource.query.mockResolvedValueOnce([
        {
          scope_key: 'cust-1',
          count: '3',
          latest_updated_at: new Date('2026-06-01T00:00:00Z'),
          total: '2',
        },
        {
          scope_key: 'cust-2',
          count: '1',
          latest_updated_at: new Date('2026-05-01T00:00:00Z'),
          total: '2',
        },
      ]);

      const result = await service.listScopes('ws-1', { limit: 30, offset: 0 });

      // 단일 쿼리만 실행 (별도 COUNT 패스 제거).
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);

      const [listSql, listParams] = mockDataSource.query.mock.calls[0];
      expect(listSql).toContain('FROM agent_memory');
      expect(listSql).toContain('am.workspace_id = $1');
      expect(listSql).toContain('GROUP BY am.scope_key');
      expect(listSql).toContain('COUNT(*)');
      expect(listSql).toContain('MAX(am.updated_at)');
      // 단일쿼리 total 윈도우.
      expect(listSql).toContain('COUNT(*) OVER()');
      expect(listParams[0]).toBe('ws-1');
      // q 없으면 limit=$2, offset=$3.
      expect(listParams).toEqual(['ws-1', 30, 0]);

      expect(result.items).toEqual([
        {
          scopeKey: 'cust-1',
          count: 3,
          latestUpdatedAt: '2026-06-01T00:00:00.000Z',
        },
        {
          scopeKey: 'cust-2',
          count: 1,
          latestUpdatedAt: '2026-05-01T00:00:00.000Z',
        },
      ]);
      // total 은 윈도우 함수 값에서 파생 (LIMIT/OFFSET 전 전체 그룹 수).
      expect(result.total).toBe(2);
    });

    it('q 가 있으면 scope_key ILIKE 부분일치 필터 + 파라미터 바인딩 (단일쿼리)', async () => {
      mockDataSource.query.mockResolvedValueOnce([
        {
          scope_key: 'cust-7',
          count: 3,
          latest_updated_at: '2026-05-02T00:00:00.000Z',
          total: 1,
        },
      ]);

      const result = await service.listScopes('ws-9', {
        limit: 10,
        offset: 5,
        q: 'cust',
      });

      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      const [listSql, listParams] = mockDataSource.query.mock.calls[0];
      expect(listSql).toContain("am.scope_key ILIKE '%' || $2 || '%'");
      expect(listSql).toContain('COUNT(*) OVER()');
      // q 있으면 params: [ws, q, limit, offset].
      expect(listParams).toEqual(['ws-9', 'cust', 10, 5]);
      // q 경로도 단일쿼리에서 total/items 를 정확히 파생한다.
      expect(result.items).toEqual([
        {
          scopeKey: 'cust-7',
          count: 3,
          latestUpdatedAt: '2026-05-02T00:00:00.000Z',
        },
      ]);
      expect(result.total).toBe(1);
    });

    it('빈 결과(또는 offset 초과)면 total 0 (윈도우 행 없음)', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);
      const result = await service.listScopes('ws-1', {
        limit: 30,
        offset: 90,
      });
      expect(mockDataSource.query).toHaveBeenCalledTimes(1);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('total 은 반환 행수가 아니라 윈도우 total 값 (페이지 < 전체)', async () => {
      // limit=1 로 1행만 받지만 total 윈도우는 전체 그룹 수(5)를 싣는다.
      mockDataSource.query.mockResolvedValueOnce([
        {
          scope_key: 'cust-1',
          count: '3',
          latest_updated_at: new Date('2026-06-01T00:00:00Z'),
          total: '5',
        },
      ]);
      const result = await service.listScopes('ws-1', { limit: 1, offset: 0 });
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(5);
    });

    it('embedding 컬럼을 SELECT 하지 않는다', async () => {
      mockDataSource.query.mockResolvedValueOnce([]);
      await service.listScopes('ws-1', {});
      const [listSql] = mockDataSource.query.mock.calls[0];
      expect(listSql).not.toContain('embedding');
    });
  });

  describe('listMemories (spec §6, AGM-12)', () => {
    it('명시 컬럼만 SELECT (embedding 제외), workspace_id + scope_key 격리, created_at DESC', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'm1',
            content: 'user likes tea',
            kind: 'preference',
            scope_key: 'cust-1',
            created_at: new Date('2026-06-02T00:00:00Z'),
            updated_at: new Date('2026-06-03T00:00:00Z'),
            expires_at: null,
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.listMemories('ws-1', 'cust-1', {
        limit: 30,
        offset: 0,
      });

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('FROM agent_memory');
      expect(sql).toContain('am.workspace_id = $1');
      expect(sql).toContain('am.scope_key = $2');
      expect(sql).toContain('ORDER BY am.created_at DESC');
      expect(sql).not.toContain('embedding');
      // kind 없으면 params: [ws, scope, limit, offset].
      expect(params).toEqual(['ws-1', 'cust-1', 30, 0]);

      expect(result.items[0]).toEqual({
        id: 'm1',
        content: 'user likes tea',
        kind: 'preference',
        scopeKey: 'cust-1',
        createdAt: '2026-06-02T00:00:00.000Z',
        updatedAt: '2026-06-03T00:00:00.000Z',
        expiresAt: null,
      });
      expect(result.total).toBe(1);
    });

    it('kind 필터가 있으면 metadata->>kind = $3 으로 필터한다', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.listMemories('ws-1', 'cust-1', {
        kind: 'fact',
        limit: 30,
        offset: 0,
      });

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain("am.metadata->>'kind' = $3");
      // kind 있으면 params: [ws, scope, kind, limit, offset].
      expect(params).toEqual(['ws-1', 'cust-1', 'fact', 30, 0]);

      const [countSql, countParams] = mockDataSource.query.mock.calls[1];
      expect(countSql).toContain("am.metadata->>'kind' = $3");
      expect(countParams).toEqual(['ws-1', 'cust-1', 'fact']);
    });

    it('kind + offset>0 조합에서 LIMIT/OFFSET 파라미터 순서가 $4/$5 로 정확하다', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([{ total: '0' }]);

      await service.listMemories('ws-1', 'cust-1', {
        kind: 'fact',
        limit: 30,
        offset: 60,
      });

      const [sql, params] = mockDataSource.query.mock.calls[0];
      // kind 있으면 limit=$4, offset=$5 — 순서: [ws, scope, kind, limit, offset].
      expect(sql).toContain('LIMIT $4 OFFSET $5');
      expect(params).toEqual(['ws-1', 'cust-1', 'fact', 30, 60]);
    });

    it('AGM-11: metadata.kind 결손 시 응답 매핑에서 fact 로 fallback', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([
          {
            id: 'm2',
            content: 'x',
            kind: null,
            scope_key: 'cust-1',
            created_at: new Date('2026-06-02T00:00:00Z'),
            updated_at: new Date('2026-06-02T00:00:00Z'),
            expires_at: new Date('2026-07-02T00:00:00Z'),
          },
        ])
        .mockResolvedValueOnce([{ total: '1' }]);

      const result = await service.listMemories('ws-1', 'cust-1', {});
      expect(result.items[0].kind).toBe('fact');
      expect(result.items[0].expiresAt).toBe('2026-07-02T00:00:00.000Z');
    });
  });

  describe('deleteMemory (spec §6, AGM-13)', () => {
    it('id + workspace_id 격리로 DELETE 하고 affected 수를 반환한다', async () => {
      mockDataSource.query.mockResolvedValue([[{ id: 'mem-1' }], 1]);
      const affected = await service.deleteMemory('ws-1', 'mem-1');

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM agent_memory');
      expect(sql).toContain('WHERE id = $1 AND workspace_id = $2');
      expect(params).toEqual(['mem-1', 'ws-1']);
      expect(affected).toBe(1);
    });

    it('다른 워크스페이스의 id 면 affected=0 (워크스페이스 교차 차단 — AGM-13)', async () => {
      mockDataSource.query.mockResolvedValue([[], 0]); // RETURNING 빈 → 미삭제.
      const affected = await service.deleteMemory('ws-2', 'mem-of-ws-1');
      expect(affected).toBe(0);
    });

    it('TypeORM DELETE 의 [rows, count] 튜플에서 rows 길이를 affected 로 쓴다 (튜플 length=2 오인 방지)', async () => {
      // 부재 id: RETURNING 빈 rows + count 0 → affected 0 (튜플 자체 length 2 가
      // 아님). 이 계약이 깨지면 부재 삭제가 204 로 새어 NotFound 가 안 난다.
      mockDataSource.query.mockResolvedValue([[], 0]);
      expect(await service.deleteMemory('ws-1', 'absent')).toBe(0);
    });
  });

  describe('clearScope (spec §6, AGM-13)', () => {
    it('workspace_id + scope_key 격리로 scope 전체 DELETE, 삭제 수 반환', async () => {
      mockDataSource.query.mockResolvedValue([[{ id: 'a' }, { id: 'b' }], 2]);
      const deleted = await service.clearScope('ws-1', 'cust-1');

      const [sql, params] = mockDataSource.query.mock.calls[0];
      expect(sql).toContain('DELETE FROM agent_memory');
      expect(sql).toContain('WHERE workspace_id = $1 AND scope_key = $2');
      expect(params).toEqual(['ws-1', 'cust-1']);
      expect(deleted).toBe(2);
    });

    it('대상이 0건이면 affected 0 을 반환한다 (정상, 멱등)', async () => {
      mockDataSource.query.mockResolvedValue([[], 0]); // RETURNING 빈 → 0건 삭제.
      const deleted = await service.clearScope('ws-1', 'empty-scope');
      expect(deleted).toBe(0);
    });
  });
});
