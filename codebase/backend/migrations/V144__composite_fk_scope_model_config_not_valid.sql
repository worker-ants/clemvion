-- V144: 모델 설정을 가리키는 어시스턴트 세션 · 지식 저장소 참조 다섯의 단일 FK 를 복합 FK 로 바꾼다(NOT VALID)
--
-- NERV CLE-PLAT-DATA Rationale 「워크스페이스 범위 참조를 복합 FK 로도 막는다 (2026-10-05)」, NERV Task CLE-T-QTRRE6.
--
-- 목적 · 삭제 동작 · 이름 · 잠금은 V141 머리의 «공통» 을 따른다. 기존 행 검증은 V147 이다.
--
-- 옛 이름 → 새 이름, 삭제 동작(모두 SET NULL (참조 컬럼)):
--   workflow_assistant_session_llm_config_id_fkey → fk_workflow_assistant_session_llm_config_id
--   fk_kb_embedding_model_config                  → fk_knowledge_base_embedding_model_config_id
--   fk_kb_extraction_llm_config                   → fk_knowledge_base_extraction_llm_config_id
--   fk_kb_rerank_config                           → fk_knowledge_base_rerank_config_id
--   fk_kb_rerank_llm_config                       → fk_knowledge_base_rerank_llm_config_id
SET LOCAL lock_timeout = '3s';

-- 1) 부모 UNIQUE — V138 이 만든 인덱스를 같은 이름의 제약으로 붙인다
ALTER TABLE model_config ADD CONSTRAINT uq_model_config_id_workspace_id UNIQUE USING INDEX uq_model_config_id_workspace_id;

-- 2) 자식 FK — 자식 테이블마다 한 문장으로 옛 FK 를 지우고 복합 FK 를 더한다
ALTER TABLE workflow_assistant_session
  DROP CONSTRAINT workflow_assistant_session_llm_config_id_fkey,
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

-- DOWN: 옛 FK 를 NOT VALID 로 되살리고 커밋한 뒤 따로 VALIDATE 한다. 제약을 지우면 인덱스도 지워지므로 V138 DOWN 은 할 일이 없다.
--   SET LOCAL lock_timeout = '3s';
--   ALTER TABLE knowledge_base DROP CONSTRAINT fk_knowledge_base_embedding_model_config_id,
--     DROP CONSTRAINT fk_knowledge_base_extraction_llm_config_id, DROP CONSTRAINT fk_knowledge_base_rerank_config_id,
--     DROP CONSTRAINT fk_knowledge_base_rerank_llm_config_id,
--     ADD CONSTRAINT fk_kb_embedding_model_config FOREIGN KEY (embedding_model_config_id) REFERENCES model_config (id)
--       ON DELETE SET NULL NOT VALID,
--     ADD CONSTRAINT fk_kb_extraction_llm_config FOREIGN KEY (extraction_llm_config_id) REFERENCES model_config (id)
--       ON DELETE SET NULL NOT VALID,
--     ADD CONSTRAINT fk_kb_rerank_config FOREIGN KEY (rerank_config_id) REFERENCES model_config (id) ON DELETE SET NULL NOT VALID,
--     ADD CONSTRAINT fk_kb_rerank_llm_config FOREIGN KEY (rerank_llm_config_id) REFERENCES model_config (id)
--       ON DELETE SET NULL NOT VALID;
--   ALTER TABLE workflow_assistant_session DROP CONSTRAINT fk_workflow_assistant_session_llm_config_id,
--     ADD CONSTRAINT workflow_assistant_session_llm_config_id_fkey FOREIGN KEY (llm_config_id) REFERENCES model_config (id)
--       ON DELETE SET NULL NOT VALID;
--   ALTER TABLE model_config DROP CONSTRAINT uq_model_config_id_workspace_id;
--   -- 커밋한 뒤
--   ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_kb_embedding_model_config;
--   ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_kb_extraction_llm_config;
--   ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_kb_rerank_config;
--   ALTER TABLE knowledge_base VALIDATE CONSTRAINT fk_kb_rerank_llm_config;
--   ALTER TABLE workflow_assistant_session VALIDATE CONSTRAINT workflow_assistant_session_llm_config_id_fkey;
