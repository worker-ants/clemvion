import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { randomUUID } from 'crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';
import request from 'supertest';

import { createDbClient, uniqueEmail, uniqueName } from './helpers/db';
import { registerAndLogin, createTeamWorkspace } from './helpers/auth';

/**
 * e2e: Merge 노드의 기본 설정이 실행 전 검증을 지나는지(NERV Task `CLE-T-AGDM92` · `CLE-T-HSHW71`).
 * 근거: [Merge 노드](CLE-NODE-MERGE) 의 REQ-MERGE-016 (dormant 필드는 blocking 경고).
 *
 * 스키마 기본값이 `timeout: 300` 이던 때는 새 노드(`GET /api/nodes/definitions` 의 `defaultConfig`)와
 * 가져온 노드(`applyConfigDefaults`)가 그 값을 그대로 받았다. 값이 0 보다 크면 dormant 경고가
 * blocking 으로 평가되어 엔진이 `INVALID_NODE_CONFIG` 로 실행을 멈췄다. 단위 테스트는 레지스트리의
 * 기본값 경로까지만 보므로 저장 · 실행 · 엔진 검증을 실제로 밟는다.
 *
 * V148 은 이미 저장된 `timeout: 300` 만 0 으로 바꾼다. Flyway 는 빈 테이블에 적용하므로 대상 행이
 * 없다. 그래서 한 트랜잭션 안에 임시 스키마의 `node` 사본을 만들고 파일 그대로 실행한 뒤 ROLLBACK 한다
 * (선례: `trigger-endpoint-path-dedupe.e2e-spec.ts`).
 */

const BASE_URL = process.env.E2E_BASE_URL ?? 'http://backend-e2e:3011';
const TERMINAL = ['completed', 'failed', 'cancelled'];

const V148_SQL = readFileSync(
  join(
    __dirname,
    '..',
    'migrations',
    'V148__merge_node_timeout_default_zero.sql',
  ),
  'utf8',
);

describe('Merge default config (e2e)', () => {
  let db: Client;
  let token: string;
  let workspaceId: string;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
    const owner = await registerAndLogin(BASE_URL, uniqueEmail('mergedef'), db);
    token = owner.accessToken;
    workspaceId = await createTeamWorkspace(
      BASE_URL,
      token,
      uniqueName('MERGEDEF'),
    );
  }, 60_000);

  afterAll(async () => {
    if (db) await db.end();
  });

  const auth = () => ({ Authorization: `Bearer ${token}` });

  async function poll(executionId: string): Promise<string> {
    const start = Date.now();
    let last = '';
    while (Date.now() - start < 15_000) {
      const res = await request(BASE_URL)
        .get(`/api/executions/${executionId}`)
        .set(auth())
        .set('X-Workspace-Id', workspaceId);
      if (res.status === 200) {
        last = (res.body.data as { status: string }).status;
        if (TERMINAL.includes(last)) return last;
      }
      await new Promise((r) => setTimeout(r, 200));
    }
    throw new Error(`poll timed out at status=${last}`);
  }

  async function execute(workflowId: string): Promise<string> {
    const exec = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/execute`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({});
    expect(exec.status).toBe(202);
    return exec.body.data.executionId as string;
  }

  async function readMergeExecution(
    executionId: string,
  ): Promise<{ status: string; error: unknown }> {
    const r = await db.query<{ status: string; error: unknown }>(
      `SELECT ne.status, ne.error FROM node_execution ne
         JOIN node n ON n.id = ne.node_id
         WHERE ne.execution_id = $1 AND n.type = 'merge'
         ORDER BY ne.started_at DESC LIMIT 1`,
      [executionId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0];
  }

  async function readMergeConfig(
    workflowId: string,
  ): Promise<Record<string, unknown>> {
    const r = await db.query<{ config: Record<string, unknown> }>(
      `SELECT config FROM node WHERE workflow_id = $1 AND type = 'merge'`,
      [workflowId],
    );
    expect(r.rows.length).toBe(1);
    return r.rows[0].config;
  }

  it('a Merge node saved with the palette defaultConfig runs to completion', async () => {
    const defs = await request(BASE_URL)
      .get('/api/nodes/definitions')
      .set(auth())
      .set('X-Workspace-Id', workspaceId);
    expect(defs.status).toBe(200);
    const merge = (
      defs.body.data.definitions as Array<{
        metadata: { type: string };
        defaultConfig: Record<string, unknown>;
      }>
    ).find((d) => d.metadata.type === 'merge');
    expect(merge?.defaultConfig).toMatchObject({ timeout: 0 });

    const created = await request(BASE_URL)
      .post('/api/workflows')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({ name: uniqueName('mergedef-wf') });
    expect(created.status).toBe(201);
    const workflowId = created.body.data.id as string;

    const triggerId = randomUUID();
    const mergeId = randomUUID();
    const save = await request(BASE_URL)
      .post(`/api/workflows/${workflowId}/save`)
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        nodes: [
          {
            id: triggerId,
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            id: mergeId,
            type: 'merge',
            category: 'logic',
            label: 'Merge',
            positionX: 240,
            positionY: 0,
            config: merge?.defaultConfig ?? {},
          },
        ],
        edges: [
          {
            sourceNodeId: triggerId,
            sourcePort: 'out',
            targetNodeId: mergeId,
            targetPort: 'in',
          },
        ],
      });
    expect(save.status).toBe(200);

    const executionId = await execute(workflowId);
    expect(await poll(executionId)).toBe('completed');
    expect(await readMergeExecution(executionId)).toMatchObject({
      status: 'completed',
    });
  }, 40_000);

  it('an imported Merge node without timeout gets 0 and runs to completion', async () => {
    const imported = await request(BASE_URL)
      .post('/api/workflows/import')
      .set(auth())
      .set('X-Workspace-Id', workspaceId)
      .send({
        name: uniqueName('mergedef-import'),
        nodes: [
          {
            type: 'manual_trigger',
            category: 'trigger',
            label: 'Start',
            positionX: 0,
            positionY: 0,
            config: {},
          },
          {
            type: 'merge',
            category: 'logic',
            label: 'Merge',
            positionX: 240,
            positionY: 0,
            config: { strategy: 'wait_all' },
          },
        ],
        edges: [
          {
            sourceNodeIndex: 0,
            sourcePort: 'out',
            targetNodeIndex: 1,
            targetPort: 'in',
          },
        ],
      });
    expect(imported.status).toBe(201);
    const workflowId = imported.body.data.id as string;
    expect(await readMergeConfig(workflowId)).toMatchObject({ timeout: 0 });

    const executionId = await execute(workflowId);
    expect(await poll(executionId)).toBe('completed');
    expect(await readMergeExecution(executionId)).toMatchObject({
      status: 'completed',
    });
  }, 40_000);
});

describe('V148 Merge timeout 300 → 0 (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it('바꾸는 행은 type=merge 이면서 timeout 이 300 인 행뿐이고 다른 키는 그대로다 · 다시 돌리면 0건', async () => {
    const wf = 'f1480000-0000-4000-8000-000000000001';
    const id = (n: number) => `a1480000-0000-4000-8000-00000000000${n}`;
    // [id, type, category, config]
    const rows: Array<[string, string, string, string]> = [
      [
        id(1),
        'merge',
        'logic',
        '{"strategy":"first","outputFormat":"indexed","timeout":300,"partialOnTimeout":false}',
      ],
      [id(2), 'merge', 'logic', '{"strategy":"wait_all","timeout":60}'],
      [id(3), 'merge', 'logic', '{"strategy":"wait_all","timeout":0}'],
      [id(4), 'merge', 'logic', '{"strategy":"wait_all"}'],
      [id(5), 'workflow', 'flow', '{"timeout":300}'],
    ];

    await db.query('BEGIN');
    try {
      await db.query('CREATE SCHEMA v148_probe');
      await db.query(
        'CREATE TABLE v148_probe.node (LIKE public.node INCLUDING DEFAULTS INCLUDING CONSTRAINTS)',
      );
      await db.query('SET LOCAL search_path TO v148_probe, public');
      for (const [rowId, type, category, config] of rows) {
        await db.query(
          `INSERT INTO node (id, workflow_id, type, category, label, config)
             VALUES ($1, $2, $3, $4, $3, $5::jsonb)`,
          [rowId, wf, type, category, config],
        );
      }

      const first = await db.query(V148_SQL);
      expect(first.rowCount).toBe(1);

      const after = await db.query<{
        id: string;
        config: Record<string, unknown>;
      }>('SELECT id, config FROM node ORDER BY id');
      const byId = Object.fromEntries(after.rows.map((r) => [r.id, r.config]));
      expect(byId[id(1)]).toEqual({
        strategy: 'first',
        outputFormat: 'indexed',
        timeout: 0,
        partialOnTimeout: false,
      });
      expect(byId[id(2)]).toEqual({ strategy: 'wait_all', timeout: 60 });
      expect(byId[id(3)]).toEqual({ strategy: 'wait_all', timeout: 0 });
      expect(byId[id(4)]).toEqual({ strategy: 'wait_all' });
      expect(byId[id(5)]).toEqual({ timeout: 300 });

      const second = await db.query(V148_SQL);
      expect(second.rowCount).toBe(0);
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
