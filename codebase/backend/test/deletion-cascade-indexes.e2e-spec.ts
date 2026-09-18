import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: 삭제 연쇄의 FK 인덱스 다섯(V112~V116)이 **유효하게** 있다.
 *
 * 부모 행 삭제의 FK 트리거는 지워지는 부모 행마다 자식을 한 번씩 찾는다. 이 다섯 FK 는 선두 인덱스가 없어
 * 캔버스 저장의 노드 삭제(저장마다)와 워크플로 삭제에서 자식 테이블을 행마다 전부 훑었다 — 800k 규모에서
 * 워크플로 삭제 2,225 ms · 노드 하나 삭제 206.6 ms.
 *
 * **`indisvalid` 까지 본다** — `CREATE INDEX CONCURRENTLY` 가 실패하면 이름만 점유한 invalid 인덱스가 남고,
 * 존재만 보는 단언은 그것을 초록으로 통과시킨다. 정의는 선두 컬럼과 부분 조건까지 대조한다 — 선두가 다르면
 * FK 트리거가 쓰지 못하고, `llm_usage_log` 둘은 부분 조건이 빠지면 NULL 행까지 담는다.
 *
 * 근거·실측: `plan/complete/spec-draft-deletion-cascade-indexes.md`,
 * SoT: `spec/1-data-model.md` §3 · `## Rationale` «삭제 연쇄의 FK 인덱스 다섯».
 */
const EXPECTED: ReadonlyArray<{ name: string; def: RegExp }> = [
  {
    name: 'idx_node_execution_node_id',
    def: /ON public\.node_execution USING btree \(node_id\)$/,
  },
  {
    name: 'idx_integration_usage_log_node_execution_id',
    def: /ON public\.integration_usage_log USING btree \(node_execution_id\)$/,
  },
  {
    name: 'idx_integration_usage_log_workflow_id',
    def: /ON public\.integration_usage_log USING btree \(workflow_id\)$/,
  },
  {
    name: 'idx_llm_usage_log_node_execution_id',
    def: /ON public\.llm_usage_log USING btree \(node_execution_id\) WHERE \(node_execution_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_llm_usage_log_execution_id',
    def: /ON public\.llm_usage_log USING btree \(execution_id\) WHERE \(execution_id IS NOT NULL\)$/,
  },
];

describe('삭제 연쇄의 FK 인덱스 (e2e, V112~V116)', () => {
  let db: Client;

  beforeAll(async () => {
    db = createDbClient();
    await db.connect();
  });

  afterAll(async () => {
    await db.end();
  });

  it.each(EXPECTED)(
    'schema: $name 이 유효하고 정의가 맞다',
    async ({ name, def }) => {
      const res = await db.query<{ indexdef: string; indisvalid: boolean }>(
        `SELECT i.indisvalid, pg_get_indexdef(i.indexrelid) AS indexdef
       FROM pg_index i
       JOIN pg_class c ON c.oid = i.indexrelid
       WHERE c.relname = $1`,
        [name],
      );
      expect(res.rows).toHaveLength(1);
      expect(res.rows[0].indisvalid).toBe(true);
      expect(res.rows[0].indexdef).toMatch(def);
    },
  );
});
