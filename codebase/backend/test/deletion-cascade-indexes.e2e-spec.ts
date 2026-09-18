import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: 삭제 연쇄의 FK 인덱스(V112~V120)가 **유효하게** 있다.
 *
 * 부모 행 삭제의 FK 트리거는 지워지는 부모 행마다 자식을 한 번씩 찾는다. 아래 FK 는 선두 인덱스가 없어
 * (또는 KB 를 아는 복합 인덱스만 있어) 부모 행마다 자식 테이블을 훑었다 — 두 묶음이다:
 *
 * - V112~V116 · 캔버스 저장의 노드 삭제(저장마다)와 워크플로 삭제 — 800k 규모에서 워크플로 삭제 2,225 ms ·
 *   노드 하나 삭제 206.6 ms. 근거·실측: `plan/complete/spec-draft-deletion-cascade-indexes.md`.
 * - V117~V120 · 그래프 RAG 의 재임베딩 · 문서 삭제 · 엔티티 삭제 · KB 삭제 — 800k 청크 규모에서 KB 하나 삭제
 *   129,941 ms. 근거·실측: `plan/complete/spec-draft-graph-fk-indexes.md`.
 *
 * **`indisvalid` 까지 본다** — `CREATE INDEX CONCURRENTLY` 가 실패하면 이름만 점유한 invalid 인덱스가 남고,
 * 존재만 보는 단언은 그것을 초록으로 통과시킨다. 정의는 선두 컬럼과 부분 조건까지 대조한다 — 선두가 다르면
 * FK 트리거가 쓰지 못하고, nullable 컬럼의 부분 인덱스는 부분 조건이 빠지면 NULL 행까지 담는다.
 *
 * SoT: `spec/1-data-model.md` §3 · `## Rationale` «삭제 연쇄의 FK 인덱스 다섯» · «그래프 RAG 삭제 연쇄의 FK 인덱스 넷».
 */
const EXPECTED: ReadonlyArray<{ name: string; def: RegExp }> = [
  // V112~V116 — 노드 · 워크플로 삭제 연쇄
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
  // V117~V120 — 그래프 RAG 청크 · 엔티티 삭제 연쇄
  {
    name: 'idx_entity_last_seen_chunk_id',
    def: /ON public\.entity USING btree \(last_seen_chunk_id\) WHERE \(last_seen_chunk_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_relation_evidence_chunk_id',
    def: /ON public\.relation USING btree \(evidence_chunk_id\) WHERE \(evidence_chunk_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_relation_head_entity_id',
    def: /ON public\.relation USING btree \(head_entity_id\)$/,
  },
  {
    name: 'idx_relation_tail_entity_id',
    def: /ON public\.relation USING btree \(tail_entity_id\)$/,
  },
];

describe('삭제 연쇄의 FK 인덱스 (e2e, V112~V120)', () => {
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
