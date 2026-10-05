-- V147: V141~V146 의 복합 FK 열일곱을 기존 행에 대해 검증한다
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- `VALIDATE CONSTRAINT` 는 자식에 SHARE UPDATE EXCLUSIVE, 부모에 ROW SHARE 만 잡고 기존 행을 훑는다. 쓰기를 막지 않는다
-- (migrations/README.md §1). 범위가 어긋난 행이 있으면 여기서 실패하고 PostgreSQL 이 첫 위반의 키를 알린다. V134 가 같은 조건을
-- 먼저 보므로 실패한다면 V134 뒤에 저장 시점 검사를 빠뜨린 쓰기가 끼어든 경우다. 그때는 V141~V146 의 NOT VALID 제약이 이미 새
-- 쓰기를 막고 있으니 행을 고친 뒤 `repair` → `migrate` 로 이 파일만 다시 돈다. 한 트랜잭션이라 실패하면 앞선 검증도 되돌아가지만
-- 검증은 다시 돌려도 결과가 같다.
ALTER TABLE trigger VALIDATE CONSTRAINT fk_trigger_workflow_id;
ALTER TABLE trigger VALIDATE CONSTRAINT fk_trigger_auth_config_id;
ALTER TABLE schedule VALIDATE CONSTRAINT fk_schedule_trigger_id;
ALTER TABLE alert_rule VALIDATE CONSTRAINT fk_alert_rule_workflow_id;
ALTER TABLE workflow VALIDATE CONSTRAINT fk_workflow_folder_id;
ALTER TABLE folder VALIDATE CONSTRAINT fk_folder_parent_id;
ALTER TABLE workflow_assistant_session VALIDATE CONSTRAINT fk_workflow_assistant_session_workflow_id;
ALTER TABLE workflow_assistant_session VALIDATE CONSTRAINT fk_workflow_assistant_session_llm_config_id;
ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_knowledge_base_embedding_model_config_id;
ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_knowledge_base_extraction_llm_config_id;
ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_knowledge_base_rerank_config_id;
ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_knowledge_base_rerank_llm_config_id;
ALTER TABLE workflow_test_dataset VALIDATE CONSTRAINT fk_workflow_test_dataset_workflow_id;
ALTER TABLE node VALIDATE CONSTRAINT fk_node_container_id;
ALTER TABLE node VALIDATE CONSTRAINT fk_node_tool_owner_id;
ALTER TABLE edge VALIDATE CONSTRAINT fk_edge_source_node_id;
ALTER TABLE edge VALIDATE CONSTRAINT fk_edge_target_node_id;

-- DOWN: 없음(검증 표시만 바뀐다). 되돌리려면 V141~V146 DOWN.
