-- V029: KB 임베딩에 사용할 LLMConfig 를 워크스페이스 default 가 아닌 임의 config 로
-- 선택할 수 있도록 컬럼 추가. NULL 이면 ws default 로 폴백 (기존 KB 호환).
ALTER TABLE knowledge_base
  ADD COLUMN embedding_llm_config_id UUID NULL,
  ADD CONSTRAINT fk_kb_embedding_llm_config FOREIGN KEY (embedding_llm_config_id)
    REFERENCES llm_config(id) ON DELETE SET NULL;

-- DOWN:
-- ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS fk_kb_embedding_llm_config;
-- ALTER TABLE knowledge_base DROP COLUMN IF EXISTS embedding_llm_config_id;
