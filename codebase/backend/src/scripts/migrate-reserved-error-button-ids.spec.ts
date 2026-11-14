import type { DataSource } from 'typeorm';
import {
  planReservedErrorButtonRenames,
  renameReservedErrorButtonIds,
  routesToErrorPortOrLegacy,
  runReservedErrorButtonMigration,
} from './migrate-reserved-error-button-ids';

describe('renameReservedErrorButtonIds', () => {
  it('전역 버튼 id `error` 를 `error_1` 로 바꾼다', () => {
    const input = {
      buttons: [
        { id: 'ok', label: 'OK', type: 'port' },
        { id: 'error', label: 'Error', type: 'port' },
      ],
    };
    const result = renameReservedErrorButtonIds(input);
    expect(result.newId).toBe('error_1');
    expect(result.locations).toEqual(['buttons[1]']);
    expect(
      (result.config.buttons as Array<{ id: string }>).map((b) => b.id),
    ).toEqual(['ok', 'error_1']);
    // 원본은 바꾸지 않는다.
    expect(input.buttons[1].id).toBe('error');
  });

  it('같은 노드에 이미 있는 번호는 건너뛴다(항목 버튼까지 본다)', () => {
    const result = renameReservedErrorButtonIds({
      buttons: [{ id: 'error', label: 'E' }],
      itemButtons: [{ id: 'error_1', label: 'A' }],
      items: [{ title: 'S', buttons: [{ id: 'error_2', label: 'B' }] }],
    });
    expect(result.newId).toBe('error_3');
  });

  it('노드 안의 `error` 버튼은 위치와 상관없이 모두 같은 새 id 를 받는다', () => {
    const result = renameReservedErrorButtonIds({
      itemButtons: [{ id: 'error', label: 'A' }],
      items: [
        { title: 'S1', buttons: [{ id: 'error', label: 'B' }] },
        { title: 'S2' },
        { title: 'S3', buttons: [{ id: 'keep', label: 'C' }] },
      ],
    });
    expect(result.newId).toBe('error_1');
    expect(result.locations).toEqual(['itemButtons[0]', 'items[0].buttons[0]']);
    const items = result.config.items as Array<{
      title: string;
      buttons?: Array<{ id: string }>;
    }>;
    expect(items[0].buttons?.[0].id).toBe('error_1');
    expect(items[1]).toEqual({ title: 'S2' });
    expect(items[2].buttons?.[0].id).toBe('keep');
    expect((result.config.itemButtons as Array<{ id: string }>)[0].id).toBe(
      'error_1',
    );
  });

  it('정확 일치만 바꾼다(`Error` · `errors` 는 그대로)', () => {
    const input = {
      buttons: [
        { id: 'Error', label: 'A' },
        { id: 'errors', label: 'B' },
      ],
    };
    const result = renameReservedErrorButtonIds(input);
    expect(result.newId).toBeNull();
    expect(result.config).toBe(input);
  });

  it('버튼이 아닌 곳의 `error` 문자열은 건드리지 않는다', () => {
    const input = {
      title: 'error',
      errorHandling: { policy: 'route_to_error_port' },
      buttons: [{ id: 'ok', label: 'error' }],
    };
    expect(renameReservedErrorButtonIds(input).config).toBe(input);
  });

  it('null 항목 · 버튼이 아닌 값이 섞여도 실패하지 않는다', () => {
    const result = renameReservedErrorButtonIds({
      buttons: [null, 'x', { id: 'error' }] as unknown[],
      items: [null, { buttons: 'nope' }],
    });
    expect(result.newId).toBe('error_1');
    expect(result.locations).toEqual(['buttons[2]']);
  });

  it('두 번 돌리면 두 번째는 바꿀 것이 없다', () => {
    const first = renameReservedErrorButtonIds({
      buttons: [{ id: 'error', label: 'E' }],
    });
    const second = renameReservedErrorButtonIds(first.config);
    expect(second.newId).toBeNull();
  });
});

describe('routesToErrorPortOrLegacy', () => {
  it('errorHandling.policy 가 route_to_error_port 면 true', () => {
    expect(
      routesToErrorPortOrLegacy({
        errorHandling: { policy: 'route_to_error_port' },
      }),
    ).toBe(true);
    expect(
      routesToErrorPortOrLegacy({ errorHandling: { policy: 'skip_node' } }),
    ).toBe(false);
  });

  it('레거시 평면 키 error_port 도 같은 정책으로 본다', () => {
    expect(routesToErrorPortOrLegacy({ errorPolicy: 'error_port' })).toBe(true);
    expect(routesToErrorPortOrLegacy({})).toBe(false);
  });
});

describe('planReservedErrorButtonRenames', () => {
  it('버튼 노드 타입만 고른다', () => {
    const planned = planReservedErrorButtonRenames([
      {
        workflow_id: 'w1',
        id: 'n1',
        type: 'template',
        config: { buttons: [{ id: 'error', label: 'E' }] },
      },
      {
        workflow_id: 'w1',
        id: 'n2',
        type: 'switch',
        config: { buttons: [{ id: 'error', label: 'E' }] },
      },
      {
        workflow_id: 'w1',
        id: 'n3',
        type: 'chart',
        config: { buttons: [{ id: 'fine', label: 'F' }] },
      },
    ]);
    expect(planned.map((p) => p.nodeId)).toEqual(['n1']);
    expect(planned[0].newId).toBe('error_1');
    expect(planned[0].routesToErrorPort).toBe(false);
  });
});

/**
 * DataSource 의 `query` · `transaction` 만 흉내 낸다. 받은 SQL 과 인자를 기록한다.
 */
function fakeDataSource(nodeRows: unknown[], edgeCounts: unknown[]) {
  const calls: Array<{ sql: string; params: unknown[] }> = [];
  const query = jest.fn((sql: string, params: unknown[] = []) => {
    calls.push({ sql, params });
    if (sql.includes('FROM node')) return Promise.resolve(nodeRows);
    if (sql.includes('FROM edge')) return Promise.resolve(edgeCounts);
    if (sql.includes('UPDATE edge')) {
      // TypeORM postgres 드라이버는 UPDATE … RETURNING 에 [rows, affected] 를 준다.
      return Promise.resolve([[{ id: 'e1' }, { id: 'e2' }], 2]);
    }
    return Promise.resolve([]);
  });
  const transaction = jest.fn(
    async (fn: (manager: { query: typeof query }) => Promise<void>) =>
      fn({ query }),
  );
  return { ds: { query, transaction } as unknown as DataSource, calls };
}

describe('runReservedErrorButtonMigration', () => {
  const rows = [
    {
      workflow_id: 'w1',
      id: 'n1',
      type: 'carousel',
      config: {
        errorHandling: { policy: 'route_to_error_port' },
        buttons: [{ id: 'error', label: 'E', type: 'port' }],
      },
    },
  ];

  it('dry-run 은 계획만 찍고 쓰지 않는다', async () => {
    const { ds, calls } = fakeDataSource(rows, [
      { source_node_id: 'n1', n: 2 },
    ]);
    const lines: string[] = [];
    const result = await runReservedErrorButtonMigration(
      ds,
      { dryRun: true },
      (l) => lines.push(l),
    );
    expect(result).toEqual({ nodesUpdated: 0, edgesUpdated: 0 });
    expect(calls.some((c) => c.sql.includes('UPDATE'))).toBe(false);
    expect(lines.join('\n')).toContain('node=n1 (carousel) buttons[0]');
    expect(lines.join('\n')).toContain('id="error_1", edges=2');
    // 정책이 route_to_error_port 이고 error 연결선이 있으면 경고한다.
    expect(lines.some((l) => l.includes('[WARN] node=n1'))).toBe(true);
  });

  it('apply 는 노드 config · 연결선 · audit_log 를 한 트랜잭션으로 쓴다', async () => {
    const { ds, calls } = fakeDataSource(rows, [
      { source_node_id: 'n1', n: 2 },
    ]);
    const result = await runReservedErrorButtonMigration(
      ds,
      { dryRun: false, workspaceId: 'ws', userId: 'u' },
      () => undefined,
    );
    expect(result).toEqual({ nodesUpdated: 1, edgesUpdated: 2 });
    expect(
      (ds as unknown as { transaction: jest.Mock }).transaction,
    ).toHaveBeenCalledTimes(1);

    const nodeUpdate = calls.find((c) => c.sql.includes('UPDATE node'));
    const saved = JSON.parse(nodeUpdate?.params[0] as string) as {
      buttons: Array<{ id: string }>;
    };
    expect(saved.buttons[0].id).toBe('error_1');
    expect(nodeUpdate?.params[1]).toBe('n1');

    const edgeUpdate = calls.find((c) => c.sql.includes('UPDATE edge'));
    expect(edgeUpdate?.params).toEqual(['error_1', 'n1', 'error']);

    const audit = calls.find((c) => c.sql.includes('INSERT INTO audit_log'));
    expect(audit?.params.slice(0, 2)).toEqual(['ws', 'u']);
    expect(JSON.parse(audit?.params[2] as string)).toMatchObject({
      nodesUpdated: 1,
      edgesPlanned: 2,
      edgesUpdated: 2,
    });
  });

  it('apply 는 여러 노드를 노드별 새 id 로 바꾸고 audit_log 는 한 번만 남긴다', async () => {
    const multi = [
      ...rows,
      {
        workflow_id: 'w1',
        id: 'n2',
        type: 'carousel',
        config: { buttons: [{ id: 'error', label: 'E2' }] },
      },
    ];
    const { ds, calls } = fakeDataSource(multi, [
      { source_node_id: 'n1', n: 2 },
      { source_node_id: 'n2', n: 1 },
    ]);
    await runReservedErrorButtonMigration(
      ds,
      { dryRun: false, workspaceId: 'ws', userId: 'u' },
      () => undefined,
    );
    const nodeUpdates = calls.filter((c) => c.sql.includes('UPDATE node'));
    const edgeUpdates = calls.filter((c) => c.sql.includes('UPDATE edge'));
    expect(nodeUpdates.map((c) => c.params[1])).toEqual(['n1', 'n2']);
    expect(edgeUpdates.map((c) => c.params)).toEqual([
      ['error_1', 'n1', 'error'],
      ['error_1', 'n2', 'error'],
    ]);
    expect(
      calls.filter((c) => c.sql.includes('INSERT INTO audit_log')),
    ).toHaveLength(1);
  });

  it('트랜잭션 중간에 실패하면 audit_log 를 남기지 않고 오류를 그대로 던진다', async () => {
    const { ds, calls } = fakeDataSource(rows, [
      { source_node_id: 'n1', n: 2 },
    ]);
    const tx = (ds as unknown as { transaction: jest.Mock }).transaction;
    tx.mockImplementationOnce(
      async (fn: (m: { query: jest.Mock }) => Promise<void>) =>
        fn({
          query: jest.fn(async (sql: string) => {
            calls.push({ sql, params: [] });
            if (sql.includes('UPDATE edge'))
              throw new Error('edge update failed');
            return [];
          }),
        }),
    );
    await expect(
      runReservedErrorButtonMigration(
        ds,
        { dryRun: false, workspaceId: 'ws', userId: 'u' },
        () => undefined,
      ),
    ).rejects.toThrow('edge update failed');
    expect(calls.some((c) => c.sql.includes('INSERT INTO audit_log'))).toBe(
      false,
    );
  });

  it('apply 에 workspace/user id 가 없으면 아무것도 읽기 전에 거부한다', async () => {
    const { ds, calls } = fakeDataSource(rows, []);
    await expect(
      runReservedErrorButtonMigration(ds, { dryRun: false }, () => undefined),
    ).rejects.toThrow('--apply requires --workspace-id');
    expect(calls).toHaveLength(0);
  });

  it('대상이 없으면 쓰지 않고 audit_log 도 남기지 않는다', async () => {
    const { ds, calls } = fakeDataSource([], []);
    const result = await runReservedErrorButtonMigration(
      ds,
      { dryRun: false, workspaceId: 'ws', userId: 'u' },
      () => undefined,
    );
    expect(result).toEqual({ nodesUpdated: 0, edgesUpdated: 0 });
    expect(calls.map((c) => c.sql).join()).not.toMatch(/UPDATE|INSERT/);
  });
});
