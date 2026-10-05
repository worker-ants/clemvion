import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: 워크스페이스 · 워크플로우 범위 참조 열일곱을 DB 의 복합 FK 가 막는다(V134~V147, NERV Task `CLE-T-QTRRE6`).
 * 근거: [데이터 모델 개요 「워크스페이스 범위 참조를 복합 FK 로도 막는다」](CLE-PLAT-DATA#워크스페이스-범위-참조를-복합-fk-로도-막는다-2026-10-05)
 *
 * 저장 시점 검사(`assertReferenceInScope` 등)가 첫 방어선이고 이 파일은 그 뒤의 DB 층만 본다. 서비스를 거치지 않는
 * SQL 쓰기로 교차 참조를 시도하고, 부모를 지워 삭제 동작이 그대로인지 본다. 픽스처는 한 트랜잭션 안에서 만들고
 * ROLLBACK 해 공유 e2e DB 에 남기지 않는다.
 */

type SeedKey = keyof ReturnType<typeof ids>;

interface ScopedFk {
  child: string;
  column: string;
  parent: string;
  /** 자식과 부모가 함께 가진 범위 컬럼 */
  scope: 'workspace_id' | 'workflow_id';
  name: string;
  onDelete: 'CASCADE' | 'SET NULL';
  /** 교차 쓰기를 해 볼 자식 행(`seed()` 의 키) */
  row: SeedKey;
  /** 그 행이 가리킬 부모 행(`seed()` 의 키). A 의 것이면 같은 범위, B 의 것이면 교차다 */
  target: SeedKey;
}

const SCOPED_FKS: readonly ScopedFk[] = [
  {
    child: 'trigger',
    column: 'workflow_id',
    parent: 'workflow',
    scope: 'workspace_id',
    name: 'fk_trigger_workflow_id',
    onDelete: 'CASCADE',
    row: 'trigger',
    target: 'workflow',
  },
  {
    child: 'trigger',
    column: 'auth_config_id',
    parent: 'auth_config',
    scope: 'workspace_id',
    name: 'fk_trigger_auth_config_id',
    onDelete: 'SET NULL',
    row: 'trigger',
    target: 'authConfig',
  },
  {
    child: 'schedule',
    column: 'trigger_id',
    parent: 'trigger',
    scope: 'workspace_id',
    name: 'fk_schedule_trigger_id',
    onDelete: 'CASCADE',
    row: 'schedule',
    target: 'trigger',
  },
  {
    child: 'alert_rule',
    column: 'workflow_id',
    parent: 'workflow',
    scope: 'workspace_id',
    name: 'fk_alert_rule_workflow_id',
    onDelete: 'CASCADE',
    row: 'alertRule',
    target: 'workflow',
  },
  {
    child: 'workflow',
    column: 'folder_id',
    parent: 'folder',
    scope: 'workspace_id',
    name: 'fk_workflow_folder_id',
    onDelete: 'SET NULL',
    row: 'workflow',
    target: 'folder',
  },
  {
    child: 'folder',
    column: 'parent_id',
    parent: 'folder',
    scope: 'workspace_id',
    name: 'fk_folder_parent_id',
    onDelete: 'CASCADE',
    row: 'childFolder',
    target: 'folder',
  },
  {
    child: 'workflow_assistant_session',
    column: 'workflow_id',
    parent: 'workflow',
    scope: 'workspace_id',
    name: 'fk_workflow_assistant_session_workflow_id',
    onDelete: 'CASCADE',
    row: 'session',
    target: 'workflow',
  },
  {
    child: 'workflow_assistant_session',
    column: 'llm_config_id',
    parent: 'model_config',
    scope: 'workspace_id',
    name: 'fk_workflow_assistant_session_llm_config_id',
    onDelete: 'SET NULL',
    row: 'session',
    target: 'modelConfig',
  },
  {
    child: 'knowledge_base',
    column: 'embedding_model_config_id',
    parent: 'model_config',
    scope: 'workspace_id',
    name: 'fk_knowledge_base_embedding_model_config_id',
    onDelete: 'SET NULL',
    row: 'knowledgeBase',
    target: 'modelConfig',
  },
  {
    child: 'knowledge_base',
    column: 'extraction_llm_config_id',
    parent: 'model_config',
    scope: 'workspace_id',
    name: 'fk_knowledge_base_extraction_llm_config_id',
    onDelete: 'SET NULL',
    row: 'knowledgeBase',
    target: 'modelConfig',
  },
  {
    child: 'knowledge_base',
    column: 'rerank_config_id',
    parent: 'model_config',
    scope: 'workspace_id',
    name: 'fk_knowledge_base_rerank_config_id',
    onDelete: 'SET NULL',
    row: 'knowledgeBase',
    target: 'modelConfig',
  },
  {
    child: 'knowledge_base',
    column: 'rerank_llm_config_id',
    parent: 'model_config',
    scope: 'workspace_id',
    name: 'fk_knowledge_base_rerank_llm_config_id',
    onDelete: 'SET NULL',
    row: 'knowledgeBase',
    target: 'modelConfig',
  },
  {
    child: 'workflow_test_dataset',
    column: 'workflow_id',
    parent: 'workflow',
    scope: 'workspace_id',
    name: 'fk_workflow_test_dataset_workflow_id',
    onDelete: 'CASCADE',
    row: 'dataset',
    target: 'workflow',
  },
  {
    child: 'node',
    column: 'container_id',
    parent: 'node',
    scope: 'workflow_id',
    name: 'fk_node_container_id',
    onDelete: 'SET NULL',
    row: 'node',
    target: 'container',
  },
  {
    child: 'node',
    column: 'tool_owner_id',
    parent: 'node',
    scope: 'workflow_id',
    name: 'fk_node_tool_owner_id',
    onDelete: 'SET NULL',
    row: 'tool',
    target: 'container',
  },
  {
    child: 'edge',
    column: 'source_node_id',
    parent: 'node',
    scope: 'workflow_id',
    name: 'fk_edge_source_node_id',
    onDelete: 'CASCADE',
    row: 'edge',
    target: 'container',
  },
  {
    child: 'edge',
    column: 'target_node_id',
    parent: 'node',
    scope: 'workflow_id',
    name: 'fk_edge_target_node_id',
    onDelete: 'CASCADE',
    row: 'edge',
    // 끝점 둘을 모두 B 로 옮겨도 B 의 연결선(container → node)과 겹치지 않게 다른 노드를 가리킨다(연결선 UNIQUE)
    target: 'tool',
  },
];

const PARENT_UNIQUES: ReadonlyArray<{
  table: string;
  name: string;
  scope: ScopedFk['scope'];
}> = [
  {
    table: 'workflow',
    name: 'uq_workflow_id_workspace_id',
    scope: 'workspace_id',
  },
  {
    table: 'auth_config',
    name: 'uq_auth_config_id_workspace_id',
    scope: 'workspace_id',
  },
  { table: 'folder', name: 'uq_folder_id_workspace_id', scope: 'workspace_id' },
  {
    table: 'model_config',
    name: 'uq_model_config_id_workspace_id',
    scope: 'workspace_id',
  },
  {
    table: 'trigger',
    name: 'uq_trigger_id_workspace_id',
    scope: 'workspace_id',
  },
  { table: 'node', name: 'uq_node_id_workflow_id', scope: 'workflow_id' },
];

const V134_SQL = readFileSync(
  join(__dirname, '..', 'migrations', 'V134__composite_fk_scope_precheck.sql'),
  'utf8',
);

/** 워크스페이스 A · B 에 같은 모양의 행을 하나씩 둔다. 키 끝 자리가 a · b 다. */
function ids(suffix: 'a' | 'b') {
  const id = (prefix: string) =>
    `${prefix}-0000-4000-8000-00000000000${suffix}`;
  return {
    workspace: id('c1000000'),
    workflow: id('c2000000'),
    folder: id('c3000000'),
    childFolder: id('c3100000'),
    authConfig: id('c4000000'),
    modelConfig: id('c5000000'),
    trigger: id('c6000000'),
    schedule: id('c7000000'),
    alertRule: id('c8000000'),
    session: id('c9000000'),
    knowledgeBase: id('ca000000'),
    dataset: id('cb000000'),
    node: id('cc000000'),
    container: id('cc100000'),
    tool: id('cc200000'),
    edge: id('cd000000'),
    edge2: id('cd100000'),
  };
}
const A = ids('a');
const B = ids('b');
const USER = 'c0000000-0000-4000-8000-000000000001';

describe('워크스페이스 · 워크플로우 범위 참조의 복합 FK (e2e)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  /** 한 문장을 SAVEPOINT 로 감싸 돌리고 실패했으면 그 오류를 돌려준다. 성공하면 `null`. */
  async function attempt(
    sql: string,
    params: unknown[] = [],
  ): Promise<{ code?: string; constraint?: string; message?: string } | null> {
    await db.query('SAVEPOINT probe_attempt');
    try {
      await db.query(sql, params);
      await db.query('RELEASE SAVEPOINT probe_attempt');
      return null;
    } catch (err) {
      await db.query('ROLLBACK TO SAVEPOINT probe_attempt');
      return err as { code?: string; constraint?: string; message?: string };
    }
  }

  /** 워크스페이스 A · B 에 열일곱 참조의 부모와 자식을 같은 범위로 만든다. 호출자가 트랜잭션을 연다. */
  async function seed(): Promise<void> {
    await db.query(
      `INSERT INTO "user" (id, email, name) VALUES ($1, 'composite-fk@e2e.test', 'composite-fk')`,
      [USER],
    );
    for (const [key, w] of [
      ['a', A],
      ['b', B],
    ] as const) {
      await db.query(
        `INSERT INTO workspace (id, name, owner_id, slug, type) VALUES ($1, $2, $3, $4, 'team')`,
        [w.workspace, `composite-fk-${key}`, USER, `composite-fk-${key}`],
      );
      await db.query(
        `INSERT INTO folder (id, workspace_id, name) VALUES ($1, $2, 'parent')`,
        [w.folder, w.workspace],
      );
      await db.query(
        `INSERT INTO folder (id, workspace_id, name, parent_id) VALUES ($1, $2, 'child', $3)`,
        [w.childFolder, w.workspace, w.folder],
      );
      await db.query(
        `INSERT INTO workflow (id, workspace_id, name, created_by, folder_id) VALUES ($1, $2, 'wf', $3, $4)`,
        [w.workflow, w.workspace, USER, w.folder],
      );
      await db.query(
        `INSERT INTO auth_config (id, workspace_id, name, type) VALUES ($1, $2, 'auth', 'api_key')`,
        [w.authConfig, w.workspace],
      );
      await db.query(
        `INSERT INTO model_config (id, workspace_id, provider, name, default_model) VALUES ($1, $2, 'openai', 'model', 'gpt')`,
        [w.modelConfig, w.workspace],
      );
      await db.query(
        `INSERT INTO trigger (id, workspace_id, workflow_id, type, name, auth_config_id) VALUES ($1, $2, $3, 'manual', 'trg', $4)`,
        [w.trigger, w.workspace, w.workflow, w.authConfig],
      );
      await db.query(
        `INSERT INTO schedule (id, workspace_id, trigger_id, cron_expression) VALUES ($1, $2, $3, '0 * * * *')`,
        [w.schedule, w.workspace, w.trigger],
      );
      await db.query(
        `INSERT INTO alert_rule (id, workspace_id, workflow_id, type, threshold) VALUES ($1, $2, $3, 'failure_rate', 1)`,
        [w.alertRule, w.workspace, w.workflow],
      );
      await db.query(
        `INSERT INTO workflow_assistant_session (id, workspace_id, workflow_id, user_id, llm_config_id) VALUES ($1, $2, $3, $4, $5)`,
        [w.session, w.workspace, w.workflow, USER, w.modelConfig],
      );
      await db.query(
        `INSERT INTO knowledge_base (id, workspace_id, name, embedding_model_config_id, extraction_llm_config_id, rerank_config_id, rerank_llm_config_id)
         VALUES ($1, $2, 'kb', $3, $3, $3, $3)`,
        [w.knowledgeBase, w.workspace, w.modelConfig],
      );
      await db.query(
        // 이름이 같으면 B 로 옮기는 쓰기가 FK 보다 먼저 (workflow_id, owner_id, name) UNIQUE 에 걸린다
        `INSERT INTO workflow_test_dataset (id, workflow_id, owner_id, workspace_id, name) VALUES ($1, $2, $3, $4, $5)`,
        [w.dataset, w.workflow, USER, w.workspace, `ds-${key}`],
      );
      await db.query(
        `INSERT INTO node (id, workflow_id, type, category, label) VALUES ($1, $3, 'loop', 'flow', 'container'), ($2, $3, 'manual_trigger', 'trigger', 'start')`,
        [w.container, w.node, w.workflow],
      );
      await db.query(`UPDATE node SET container_id = $1 WHERE id = $2`, [
        w.container,
        w.node,
      ]);
      // 노드 배치 CHECK(chk_node_placement)가 컨테이너와 도구 소유를 한 행에 함께 두지 못하게 해서 도구 노드를 따로 둔다
      await db.query(
        `INSERT INTO node (id, workflow_id, type, category, label, tool_owner_id) VALUES ($1, $2, 'http_request', 'integration', 'tool', $3)`,
        [w.tool, w.workflow, w.container],
      );
      await db.query(
        `INSERT INTO edge (id, workflow_id, source_node_id, target_node_id) VALUES ($1, $2, $3, $4), ($5, $2, $4, $6)`,
        [w.edge, w.workflow, w.container, w.node, w.edge2, w.tool],
      );
    }
  }

  /** A 쪽 자식 행의 참조 컬럼을 `owner` 워크스페이스의 부모로 바꾸는 문장. B 면 교차, A 면 같은 범위다. */
  function pointAt(fk: ScopedFk, owner: typeof A): [string, unknown[]] {
    return [
      `UPDATE ${fk.child} SET ${fk.column} = $1 WHERE id = $2`,
      [owner[fk.target], A[fk.row]],
    ];
  }

  it('부모 여섯에 (id, 범위 컬럼) UNIQUE 제약이 유효한 인덱스로 있다', async () => {
    const { rows } = await db.query<{
      conname: string;
      tbl: string;
      cols: string[];
      valid: boolean;
    }>(
      `SELECT c.conname, c.conrelid::regclass::text AS tbl,
              ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, ord)
                      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.ord) AS cols,
              i.indisvalid AS valid
         FROM pg_constraint c JOIN pg_index i ON i.indexrelid = c.conindid
        WHERE c.contype = 'u' AND c.conname = ANY($1)`,
      [PARENT_UNIQUES.map((u) => u.name)],
    );
    expect(
      [...rows].sort((x, y) => x.conname.localeCompare(y.conname)),
    ).toEqual(
      [...PARENT_UNIQUES]
        .sort((x, y) => x.name.localeCompare(y.name))
        .map((u) => ({
          conname: u.name,
          tbl: u.table,
          cols: ['id', u.scope],
          valid: true,
        })),
    );
  });

  it('열일곱 참조마다 복합 FK 하나만 있고 컬럼 · 참조 · 삭제 동작 · SET NULL 컬럼 · 검증 여부가 맞다', async () => {
    const { rows } = await db.query<{
      conname: string;
      child: string;
      parent: string;
      cols: string[];
      refcols: string[];
      del: string;
      setnull: string[];
      validated: boolean;
    }>(
      `SELECT c.conname, c.conrelid::regclass::text AS child, c.confrelid::regclass::text AS parent,
              ARRAY(SELECT a.attname::text FROM unnest(c.conkey) WITH ORDINALITY k(n, ord)
                      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n ORDER BY k.ord) AS cols,
              ARRAY(SELECT a.attname::text FROM unnest(c.confkey) WITH ORDINALITY k(n, ord)
                      JOIN pg_attribute a ON a.attrelid = c.confrelid AND a.attnum = k.n ORDER BY k.ord) AS refcols,
              c.confdeltype AS del,
              ARRAY(SELECT a.attname::text FROM unnest(coalesce(c.confdelsetcols, '{}'::int2[])) k(n)
                      JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.n) AS setnull,
              c.convalidated AS validated
         FROM pg_constraint c
        WHERE c.contype = 'f' AND c.conrelid::regclass::text = ANY($1)`,
      [[...new Set(SCOPED_FKS.map((f) => f.child))]],
    );
    for (const fk of SCOPED_FKS) {
      // 옛 단일 컬럼 FK 가 남아 있지 않다: 그 컬럼으로 시작하는 FK 가 정확히 하나다
      const onColumn = rows.filter(
        (r) => r.child === fk.child && r.cols[0] === fk.column,
      );
      expect({ fk: fk.name, found: onColumn.map((r) => r.conname) }).toEqual({
        fk: fk.name,
        found: [fk.name],
      });
      expect(onColumn[0]).toEqual({
        conname: fk.name,
        child: fk.child,
        parent: fk.parent,
        cols: [fk.column, fk.scope],
        refcols: ['id', fk.scope],
        del: fk.onDelete === 'CASCADE' ? 'c' : 'n',
        // SET NULL 은 참조 컬럼만 비운다. 범위 컬럼은 NOT NULL 이라 둘 다 비우면 삭제가 실패한다
        setnull: fk.onDelete === 'SET NULL' ? [fk.column] : [],
        validated: true,
      });
    }
  });

  it('교차 참조 쓰기는 23503 과 그 제약 이름으로 막히고 같은 범위로 되돌리는 쓰기는 통과한다', async () => {
    await db.query('BEGIN');
    try {
      await seed();
      const results: Array<{ fk: string; cross: unknown; same: unknown }> = [];
      for (const fk of SCOPED_FKS) {
        const cross = await attempt(...pointAt(fk, B));
        const same = await attempt(...pointAt(fk, A));
        results.push({
          fk: fk.name,
          cross: cross && { code: cross.code, constraint: cross.constraint },
          same: same && { code: same.code, message: same.message },
        });
      }
      expect(results).toEqual(
        SCOPED_FKS.map((fk) => ({
          fk: fk.name,
          cross: { code: '23503', constraint: fk.name },
          same: null,
        })),
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('부모를 지우면 SET NULL 은 참조 컬럼만 비우고 범위 컬럼을 남기며 CASCADE 는 자식을 지운다', async () => {
    await db.query('BEGIN');
    try {
      await seed();
      const gone = async (table: string, id: string) =>
        (await db.query(`SELECT 1 FROM ${table} WHERE id = $1`, [id]))
          .rowCount === 0;

      // SET NULL — 워크스페이스 A 의 인증 설정 · 모델 설정 · 폴더 · 컨테이너 노드
      await db.query('DELETE FROM auth_config WHERE id = $1', [A.authConfig]);
      await db.query('DELETE FROM model_config WHERE id = $1', [A.modelConfig]);
      await db.query('DELETE FROM folder WHERE id = $1', [A.folder]);
      await db.query('DELETE FROM node WHERE id = $1', [A.container]);
      const setNull = {
        trigger: (
          await db.query(
            'SELECT workspace_id, auth_config_id FROM trigger WHERE id = $1',
            [A.trigger],
          )
        ).rows,
        session: (
          await db.query(
            'SELECT workspace_id, llm_config_id FROM workflow_assistant_session WHERE id = $1',
            [A.session],
          )
        ).rows,
        knowledgeBase: (
          await db.query(
            `SELECT workspace_id, embedding_model_config_id, extraction_llm_config_id, rerank_config_id, rerank_llm_config_id
               FROM knowledge_base WHERE id = $1`,
            [A.knowledgeBase],
          )
        ).rows,
        workflow: (
          await db.query(
            'SELECT workspace_id, folder_id FROM workflow WHERE id = $1',
            [A.workflow],
          )
        ).rows,
        nodes: (
          await db.query(
            'SELECT id, workflow_id, container_id, tool_owner_id FROM node WHERE id = ANY($1) ORDER BY id',
            [[A.node, A.tool]],
          )
        ).rows,
      };
      expect(setNull).toEqual({
        trigger: [{ workspace_id: A.workspace, auth_config_id: null }],
        session: [{ workspace_id: A.workspace, llm_config_id: null }],
        knowledgeBase: [
          {
            workspace_id: A.workspace,
            embedding_model_config_id: null,
            extraction_llm_config_id: null,
            rerank_config_id: null,
            rerank_llm_config_id: null,
          },
        ],
        workflow: [{ workspace_id: A.workspace, folder_id: null }],
        nodes: [
          {
            id: A.node,
            workflow_id: A.workflow,
            container_id: null,
            tool_owner_id: null,
          },
          {
            id: A.tool,
            workflow_id: A.workflow,
            container_id: null,
            tool_owner_id: null,
          },
        ],
      });

      // CASCADE — FK 마다 그 부모만 지우고 바로 확인해 다른 연쇄와 섞이지 않게 한다
      const cascaded: Record<string, boolean> = {};
      // 위 SET NULL 단계의 A.folder · A.container 삭제가 낸 연쇄
      cascaded.fk_folder_parent_id = await gone('folder', A.childFolder);
      cascaded.fk_edge_source_node_id = await gone('edge', A.edge);
      await db.query('DELETE FROM node WHERE id = $1', [B.tool]);
      cascaded.fk_edge_target_node_id = await gone('edge', B.edge2);
      await db.query('DELETE FROM trigger WHERE id = $1', [A.trigger]);
      cascaded.fk_schedule_trigger_id = await gone('schedule', A.schedule);
      // 트리거를 지우지 않은 워크스페이스 B 에서 워크플로우의 연쇄를 본다
      await db.query('DELETE FROM workflow WHERE id = $1', [B.workflow]);
      cascaded.fk_trigger_workflow_id = await gone('trigger', B.trigger);
      cascaded.fk_alert_rule_workflow_id = await gone(
        'alert_rule',
        B.alertRule,
      );
      cascaded.fk_workflow_assistant_session_workflow_id = await gone(
        'workflow_assistant_session',
        B.session,
      );
      cascaded.fk_workflow_test_dataset_workflow_id = await gone(
        'workflow_test_dataset',
        B.dataset,
      );
      expect(cascaded).toEqual(
        Object.fromEntries(
          SCOPED_FKS.filter((fk) => fk.onDelete === 'CASCADE').map((fk) => [
            fk.name,
            true,
          ]),
        ),
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('V134 사전 점검은 교차 행이 없으면 통과하고 있으면 열일곱 참조마다 행 수와 행 id 를 알리며 멈춘다', async () => {
    await db.query('BEGIN');
    try {
      await seed();
      // 이 DB 에 교차 행이 없다는 전제를 먼저 확인한다. 실패하면 다른 e2e 가 커밋한 교차 행이 남은 것이다
      // (복제 모드로 교차 트리거를 만드는 stored-cross-workspace-workflow-refs 의 정리 실패 등)
      expect((await attempt(V134_SQL))?.message ?? null).toBeNull();

      // FK 가 있는 지금은 교차 행을 만들 수 없다. 복제 모드는 FK 트리거를 끄므로 이 트랜잭션에서만 켜서 옛 데이터를 흉내 낸다
      await db.query('SET LOCAL session_replication_role = replica');
      for (const fk of SCOPED_FKS) await db.query(...pointAt(fk, B));
      await db.query('SET LOCAL session_replication_role = origin');

      const err = await attempt(V134_SQL);
      expect(err?.code).toBe('P0001');
      const reported = (err?.message ?? '')
        .split('\n')
        .slice(1)
        .map((line) => line.trim())
        .sort();
      expect(reported).toEqual(
        SCOPED_FKS.map(
          (fk) =>
            `${fk.child}.${fk.column} -> ${fk.parent}(${fk.scope}): 1 row(s), e.g. ${A[fk.row]}`,
        ).sort(),
      );
    } finally {
      await db.query('ROLLBACK');
    }
  });

  it('V134 는 PostgreSQL 15 미만이면 스키마를 바꾸기 전에 멈춘다', async () => {
    // e2e 서버는 15 이상이라 기준값을 올려 그 분기를 돌린다
    const raised = V134_SQL.replace(
      'min_server_version CONSTANT int := 150000;',
      'min_server_version CONSTANT int := 99990000;',
    );
    expect(raised).not.toBe(V134_SQL);
    await db.query('BEGIN');
    try {
      const err = await attempt(raised);
      expect(err?.code).toBe('P0001');
      expect(err?.message).toContain('PostgreSQL 15 or later is required');
    } finally {
      await db.query('ROLLBACK');
    }
  });
});
