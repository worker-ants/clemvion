-- V141: 범위 참조 열일곱의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID). 기존 행 검증은 V142.
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 저장 시점 검사(「참조의 소속」)를 빠뜨린 쓰기 경로가 다른 워크스페이스 · 다른 워크플로우의 행을 가리키지 못하게 DB 가 한 번 더
-- 막는다. 자식 `(참조, 범위)` 가 부모 `(id, 범위)` 를 가리킨다. 범위는 워크스페이스 참조가 `workspace_id`, 노드 구조 참조와 연결선
-- 끝점이 `workflow_id` 다. 위반(SQLSTATE 23503)은 저장 시점 검사가 먼저 막지 못한 서버 결함이라 전역 예외 필터가 500 으로 낸다.
--
-- 삭제 동작은 바꾸지 않는다. SET NULL 은 `ON DELETE SET NULL (참조 컬럼)` 으로 참조 컬럼만 비운다. 자식의 범위 컬럼은 NOT NULL
-- 이라 컬럼 목록 없이 쓰면 부모 삭제가 실패한다. 이 문법은 PostgreSQL 15 부터다. `ON UPDATE` 는 지금처럼 NO ACTION 이다. 부모 ·
-- 자식의 범위 컬럼을 바꾸는 쓰기 경로는 없다.
--
-- 옛 이름 → 새 이름(`fk_<자식 테이블>_<참조 컬럼>`), 삭제 동작:
--   trigger_workflow_id_fkey                      → fk_trigger_workflow_id                       CASCADE
--   fk_trigger_auth_config                        → fk_trigger_auth_config_id                    SET NULL
--   schedule_trigger_id_fkey                      → fk_schedule_trigger_id                       CASCADE
--   alert_rule_workflow_id_fkey                   → fk_alert_rule_workflow_id                    CASCADE
--   workflow_folder_id_fkey                       → fk_workflow_folder_id                        SET NULL
--   folder_parent_id_fkey                         → fk_folder_parent_id                          CASCADE
--   workflow_assistant_session_workflow_id_fkey   → fk_workflow_assistant_session_workflow_id    CASCADE
--   workflow_assistant_session_llm_config_id_fkey → fk_workflow_assistant_session_llm_config_id  SET NULL
--   fk_kb_embedding_model_config                  → fk_knowledge_base_embedding_model_config_id  SET NULL
--   fk_kb_extraction_llm_config                   → fk_knowledge_base_extraction_llm_config_id   SET NULL
--   fk_kb_rerank_config                           → fk_knowledge_base_rerank_config_id           SET NULL
--   fk_kb_rerank_llm_config                       → fk_knowledge_base_rerank_llm_config_id       SET NULL
--   workflow_test_dataset_workflow_id_fkey        → fk_workflow_test_dataset_workflow_id         CASCADE
--   node_container_id_fkey                        → fk_node_container_id                         SET NULL
--   node_tool_owner_id_fkey                       → fk_node_tool_owner_id                        SET NULL
--   edge_source_node_id_fkey                      → fk_edge_source_node_id                       CASCADE
--   edge_target_node_id_fkey                      → fk_edge_target_node_id                       CASCADE
--
-- 옛 FK 는 `IF EXISTS` 없이 지운다. 운영 DB 의 이름이 e2e 와 다르면 조용히 단일 FK 를 남기는 대신 여기서 실패한다.
--
-- 잠금: 한 트랜잭션이 부모 UNIQUE 를 붙이고(부모 ACCESS EXCLUSIVE) 자식마다 FK 를 바꾼다(자식 · 부모 ACCESS EXCLUSIVE). NOT VALID 라
-- 기존 행을 읽지 않아 잡는 시간은 카탈로그 갱신뿐이다. `SET LOCAL lock_timeout` 으로 잠금을 3초 안에 못 얻으면 이 파일 전체가
-- 실패하고 아무것도 바뀌지 않는다(트래픽이 적을 때 다시 돈다). LOCAL 이라 다음 파일(V142)에 남지 않는다.
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V135~V140 이 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE workflow ADD CONSTRAINT uq_workflow_id_workspace_id UNIQUE USING INDEX uq_workflow_id_workspace_id;
ALTER TABLE auth_config ADD CONSTRAINT uq_auth_config_id_workspace_id UNIQUE USING INDEX uq_auth_config_id_workspace_id;
ALTER TABLE folder ADD CONSTRAINT uq_folder_id_workspace_id UNIQUE USING INDEX uq_folder_id_workspace_id;
ALTER TABLE model_config ADD CONSTRAINT uq_model_config_id_workspace_id UNIQUE USING INDEX uq_model_config_id_workspace_id;
ALTER TABLE trigger ADD CONSTRAINT uq_trigger_id_workspace_id UNIQUE USING INDEX uq_trigger_id_workspace_id;
ALTER TABLE node ADD CONSTRAINT uq_node_id_workflow_id UNIQUE USING INDEX uq_node_id_workflow_id;

-- 2) 자식 FK — 자식 테이블마다 한 문장으로 옛 FK 를 지우고 복합 FK 를 더한다
ALTER TABLE trigger
  DROP CONSTRAINT trigger_workflow_id_fkey,
  DROP CONSTRAINT fk_trigger_auth_config,
  ADD CONSTRAINT fk_trigger_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT fk_trigger_auth_config_id FOREIGN KEY (auth_config_id, workspace_id)
    REFERENCES auth_config (id, workspace_id) ON DELETE SET NULL (auth_config_id) NOT VALID;

ALTER TABLE schedule
  DROP CONSTRAINT schedule_trigger_id_fkey,
  ADD CONSTRAINT fk_schedule_trigger_id FOREIGN KEY (trigger_id, workspace_id)
    REFERENCES trigger (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE alert_rule
  DROP CONSTRAINT alert_rule_workflow_id_fkey,
  ADD CONSTRAINT fk_alert_rule_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE workflow
  DROP CONSTRAINT workflow_folder_id_fkey,
  ADD CONSTRAINT fk_workflow_folder_id FOREIGN KEY (folder_id, workspace_id)
    REFERENCES folder (id, workspace_id) ON DELETE SET NULL (folder_id) NOT VALID;

ALTER TABLE folder
  DROP CONSTRAINT folder_parent_id_fkey,
  ADD CONSTRAINT fk_folder_parent_id FOREIGN KEY (parent_id, workspace_id)
    REFERENCES folder (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE workflow_assistant_session
  DROP CONSTRAINT workflow_assistant_session_workflow_id_fkey,
  DROP CONSTRAINT workflow_assistant_session_llm_config_id_fkey,
  ADD CONSTRAINT fk_workflow_assistant_session_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT fk_workflow_assistant_session_llm_config_id FOREIGN KEY (llm_config_id, workspace_id)
    REFERENCES model_config (id, workspace_id) ON DELETE SET NULL (llm_config_id) NOT VALID;

ALTER TABLE knowledge_base
  DROP CONSTRAINT fk_kb_embedding_model_config,
  DROP CONSTRAINT fk_kb_extraction_llm_config,
  DROP CONSTRAINT fk_kb_rerank_config,
  DROP CONSTRAINT fk_kb_rerank_llm_config,
  ADD CONSTRAINT fk_knowledge_base_embedding_model_config_id FOREIGN KEY (embedding_model_config_id, workspace_id)
    REFERENCES model_config (id, workspace_id) ON DELETE SET NULL (embedding_model_config_id) NOT VALID,
  ADD CONSTRAINT fk_knowledge_base_extraction_llm_config_id FOREIGN KEY (extraction_llm_config_id, workspace_id)
    REFERENCES model_config (id, workspace_id) ON DELETE SET NULL (extraction_llm_config_id) NOT VALID,
  ADD CONSTRAINT fk_knowledge_base_rerank_config_id FOREIGN KEY (rerank_config_id, workspace_id)
    REFERENCES model_config (id, workspace_id) ON DELETE SET NULL (rerank_config_id) NOT VALID,
  ADD CONSTRAINT fk_knowledge_base_rerank_llm_config_id FOREIGN KEY (rerank_llm_config_id, workspace_id)
    REFERENCES model_config (id, workspace_id) ON DELETE SET NULL (rerank_llm_config_id) NOT VALID;

ALTER TABLE workflow_test_dataset
  DROP CONSTRAINT workflow_test_dataset_workflow_id_fkey,
  ADD CONSTRAINT fk_workflow_test_dataset_workflow_id FOREIGN KEY (workflow_id, workspace_id)
    REFERENCES workflow (id, workspace_id) ON DELETE CASCADE NOT VALID;

ALTER TABLE node
  DROP CONSTRAINT node_container_id_fkey,
  DROP CONSTRAINT node_tool_owner_id_fkey,
  ADD CONSTRAINT fk_node_container_id FOREIGN KEY (container_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE SET NULL (container_id) NOT VALID,
  ADD CONSTRAINT fk_node_tool_owner_id FOREIGN KEY (tool_owner_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE SET NULL (tool_owner_id) NOT VALID;

ALTER TABLE edge
  DROP CONSTRAINT edge_source_node_id_fkey,
  DROP CONSTRAINT edge_target_node_id_fkey,
  ADD CONSTRAINT fk_edge_source_node_id FOREIGN KEY (source_node_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE CASCADE NOT VALID,
  ADD CONSTRAINT fk_edge_target_node_id FOREIGN KEY (target_node_id, workflow_id)
    REFERENCES node (id, workflow_id) ON DELETE CASCADE NOT VALID;

-- DOWN: 복합 FK 를 지우고 옛 단일 FK 를 같은 이름 · 같은 삭제 동작으로 되살린 뒤 부모 UNIQUE 제약을 지운다. 제약을 지우면
--   그 인덱스도 함께 지워지므로 V135~V140 DOWN 은 그 뒤에 아무 일도 하지 않는다.
--   ALTER TABLE edge DROP CONSTRAINT fk_edge_source_node_id, DROP CONSTRAINT fk_edge_target_node_id,
--     ADD CONSTRAINT edge_source_node_id_fkey FOREIGN KEY (source_node_id) REFERENCES node (id) ON DELETE CASCADE,
--     ADD CONSTRAINT edge_target_node_id_fkey FOREIGN KEY (target_node_id) REFERENCES node (id) ON DELETE CASCADE;
--   ALTER TABLE node DROP CONSTRAINT fk_node_container_id, DROP CONSTRAINT fk_node_tool_owner_id,
--     ADD CONSTRAINT node_container_id_fkey FOREIGN KEY (container_id) REFERENCES node (id) ON DELETE SET NULL,
--     ADD CONSTRAINT node_tool_owner_id_fkey FOREIGN KEY (tool_owner_id) REFERENCES node (id) ON DELETE SET NULL;
--   ALTER TABLE workflow_test_dataset DROP CONSTRAINT fk_workflow_test_dataset_workflow_id,
--     ADD CONSTRAINT workflow_test_dataset_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE;
--   ALTER TABLE knowledge_base DROP CONSTRAINT fk_knowledge_base_embedding_model_config_id,
--     DROP CONSTRAINT fk_knowledge_base_extraction_llm_config_id, DROP CONSTRAINT fk_knowledge_base_rerank_config_id,
--     DROP CONSTRAINT fk_knowledge_base_rerank_llm_config_id,
--     ADD CONSTRAINT fk_kb_embedding_model_config FOREIGN KEY (embedding_model_config_id) REFERENCES model_config (id) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_kb_extraction_llm_config FOREIGN KEY (extraction_llm_config_id) REFERENCES model_config (id) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_kb_rerank_config FOREIGN KEY (rerank_config_id) REFERENCES model_config (id) ON DELETE SET NULL,
--     ADD CONSTRAINT fk_kb_rerank_llm_config FOREIGN KEY (rerank_llm_config_id) REFERENCES model_config (id) ON DELETE SET NULL;
--   ALTER TABLE workflow_assistant_session DROP CONSTRAINT fk_workflow_assistant_session_workflow_id,
--     DROP CONSTRAINT fk_workflow_assistant_session_llm_config_id,
--     ADD CONSTRAINT workflow_assistant_session_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE,
--     ADD CONSTRAINT workflow_assistant_session_llm_config_id_fkey FOREIGN KEY (llm_config_id) REFERENCES model_config (id) ON DELETE SET NULL;
--   ALTER TABLE folder DROP CONSTRAINT fk_folder_parent_id,
--     ADD CONSTRAINT folder_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES folder (id) ON DELETE CASCADE;
--   ALTER TABLE workflow DROP CONSTRAINT fk_workflow_folder_id,
--     ADD CONSTRAINT workflow_folder_id_fkey FOREIGN KEY (folder_id) REFERENCES folder (id) ON DELETE SET NULL;
--   ALTER TABLE alert_rule DROP CONSTRAINT fk_alert_rule_workflow_id,
--     ADD CONSTRAINT alert_rule_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE;
--   ALTER TABLE schedule DROP CONSTRAINT fk_schedule_trigger_id,
--     ADD CONSTRAINT schedule_trigger_id_fkey FOREIGN KEY (trigger_id) REFERENCES trigger (id) ON DELETE CASCADE;
--   ALTER TABLE trigger DROP CONSTRAINT fk_trigger_workflow_id, DROP CONSTRAINT fk_trigger_auth_config_id,
--     ADD CONSTRAINT trigger_workflow_id_fkey FOREIGN KEY (workflow_id) REFERENCES workflow (id) ON DELETE CASCADE,
--     ADD CONSTRAINT fk_trigger_auth_config FOREIGN KEY (auth_config_id) REFERENCES auth_config (id) ON DELETE SET NULL;
--   ALTER TABLE node DROP CONSTRAINT uq_node_id_workflow_id;      -- 제약과 함께 인덱스도 지워진다
--   ALTER TABLE trigger DROP CONSTRAINT uq_trigger_id_workspace_id;
--   ALTER TABLE model_config DROP CONSTRAINT uq_model_config_id_workspace_id;
--   ALTER TABLE folder DROP CONSTRAINT uq_folder_id_workspace_id;
--   ALTER TABLE auth_config DROP CONSTRAINT uq_auth_config_id_workspace_id;
--   ALTER TABLE workflow DROP CONSTRAINT uq_workflow_id_workspace_id;
