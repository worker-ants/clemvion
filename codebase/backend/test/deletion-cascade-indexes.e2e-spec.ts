import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { Client } from 'pg';

import { createDbClient } from './helpers/db';

/**
 * e2e: FK 인덱스(V112~V130 · V133)가 **유효하게** 있다.
 *
 * 부모 행 삭제의 FK 트리거는 지워지는 부모 행마다 자식을 한 번씩 찾는다. 아래 FK 는 쓸 인덱스가 없어
 * (선두가 다르거나, KB 를 아는 복합 인덱스뿐이거나, 조건이 다른 부분 인덱스뿐이라) 자식 테이블을 훑었다 — 세 묶음이다:
 *
 * - V112~V116 · 캔버스 저장의 노드 삭제(저장마다)와 워크플로 삭제 — 800k 규모에서 워크플로 삭제 2,225 ms ·
 *   노드 하나 삭제 206.6 ms. 근거·실측: `plan/complete/spec-draft-deletion-cascade-indexes.md`.
 * - V117~V120 · 그래프 RAG 의 재임베딩 · 문서 삭제 · 엔티티 삭제 · KB 삭제 — 800k 청크 규모에서 KB 하나 삭제
 *   129,941 ms. 근거·실측: `plan/complete/spec-draft-graph-fk-indexes.md`.
 * - V121~V130 · 남은 FK 31개의 처분 중 인덱스를 둔 열 — 워크스페이스 1만 규모에서 캔버스 저장의 노드 하나 삭제
 *   29.1 ms · 워크플로 삭제 306.8 ms · 워크스페이스 삭제 3,161 ms. 그중 다섯(V126~V130)은 FK 보다 **목록 조회**가
 *   이유다(그 컬럼으로 찾는 조회가 쓸 인덱스 없이 요청마다 돌았다). 근거·실측: `plan/complete/spec-draft-fk-remaining-dispositions.md`.
 * - V133 · 새 테이블 `webhook_endpoint_reservation` 의 FK — 처음부터 인덱스와 함께 만든다(위 원칙을 새 FK 에 적용).
 *   근거: `plan/complete/spec-draft-webhook-endpoint-reservation.md`.
 *
 * **`indisvalid` 까지 본다** — `CREATE INDEX CONCURRENTLY` 가 실패하면 이름만 점유한 invalid 인덱스가 남고,
 * 존재만 보는 단언은 그것을 초록으로 통과시킨다. 정의는 선두 컬럼과 부분 조건까지 대조한다 — 선두가 다르면
 * FK 트리거가 쓰지 못하고, nullable 컬럼의 부분 인덱스는 부분 조건이 빠지면 NULL 행까지 담는다.
 *
 * SoT: `spec/1-data-model.md` §3 · `## Rationale` «삭제 연쇄의 FK 인덱스 다섯» · «그래프 RAG 삭제 연쇄의 FK 인덱스 넷» ·
 * «쓸 인덱스가 없는 FK 서른하나의 처분».
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
  // V121~V125 — 호출 수 · 자식 크기가 사용자 데이터로 자라는 FK
  {
    name: 'idx_edge_target_node_id',
    def: /ON public\.edge USING btree \(target_node_id\)$/,
  },
  {
    name: 'idx_llm_usage_log_llm_config_id',
    def: /ON public\.llm_usage_log USING btree \(llm_config_id\) WHERE \(llm_config_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_workflow_folder_id',
    def: /ON public\.workflow USING btree \(folder_id\) WHERE \(folder_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_folder_parent_id',
    def: /ON public\.folder USING btree \(parent_id\) WHERE \(parent_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_workflow_assistant_session_llm_config_id',
    def: /ON public\.workflow_assistant_session USING btree \(llm_config_id\) WHERE \(llm_config_id IS NOT NULL\)$/,
  },
  // V126~V130 — 그 컬럼으로 찾는 목록 조회(FK 조회도 같은 인덱스를 쓴다)
  {
    name: 'idx_trigger_auth_config_id',
    def: /ON public\.trigger USING btree \(auth_config_id\) WHERE \(auth_config_id IS NOT NULL\)$/,
  },
  {
    name: 'idx_auth_config_workspace_id',
    def: /ON public\.auth_config USING btree \(workspace_id\)$/,
  },
  {
    name: 'idx_knowledge_base_workspace_id',
    def: /ON public\.knowledge_base USING btree \(workspace_id\)$/,
  },
  {
    name: 'idx_workspace_member_user_id',
    def: /ON public\.workspace_member USING btree \(user_id\)$/,
  },
  {
    // 기존 (workspace_id, kind) WHERE is_default = true UNIQUE 와 구분된다 — 이쪽은 조건이 없어야 목록 · FK 조회가 쓴다.
    name: 'idx_model_config_workspace_kind',
    def: /ON public\.model_config USING btree \(workspace_id, kind\)$/,
  },
  // V133 — 새 테이블의 FK. 워크스페이스 삭제의 `SET NULL` 이 예약을 훑지 않게(주인 없는 예약은 다시 찾을 일이 없어 partial)
  {
    name: 'idx_webhook_endpoint_reservation_workspace_id',
    def: /ON public\.webhook_endpoint_reservation USING btree \(workspace_id\) WHERE \(workspace_id IS NOT NULL\)$/,
  },
];

describe('FK 인덱스 (e2e, V112~V130 · V133)', () => {
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
