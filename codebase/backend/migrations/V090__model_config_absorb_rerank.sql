-- Unified Model Management (PR1) — rerank_config → model_config(kind='rerank') 흡수
-- spec/1-data-model.md §2.16, spec/2-navigation/6-config.md Part B.6, spec/5-system/9-rag-search.md §3.3
--
-- rerank_config 행을 UUID 보존으로 model_config 에 kind='rerank' 로 복사하고,
-- knowledge_base.rerank_config_id FK 타깃을 rerank_config → model_config 로 전환한다.
-- rerank_config 테이블은 롤백 여지를 위해 V092(cleanup)까지 존치한다.
-- (rerank_llm_config_id 는 chat kind 라 V088 의 테이블 rename 에 자동 추종 — 별도 처리 불요.)

INSERT INTO model_config (
  id, workspace_id, kind, provider, name, api_key, base_url,
  default_model, default_params, dimension, is_default, created_at, updated_at
)
SELECT
  id, workspace_id, 'rerank', provider, name, api_key, base_url,
  default_model, '{}'::jsonb, NULL, is_default, created_at, updated_at
FROM rerank_config;

-- KB.rerank_config_id FK 재타깃: rerank_config → model_config.
ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS fk_kb_rerank_config;
ALTER TABLE knowledge_base
  ADD CONSTRAINT fk_kb_rerank_config
    FOREIGN KEY (rerank_config_id) REFERENCES model_config(id) ON DELETE SET NULL;

-- 검증(주석): 흡수 행 수 일치 확인 쿼리
--   SELECT (SELECT count(*) FROM rerank_config) AS src,
--          (SELECT count(*) FROM model_config WHERE kind='rerank') AS dst;  -- src = dst 여야 함

-- DOWN:
-- ALTER TABLE knowledge_base DROP CONSTRAINT IF EXISTS fk_kb_rerank_config;
-- ALTER TABLE knowledge_base
--   ADD CONSTRAINT fk_kb_rerank_config
--     FOREIGN KEY (rerank_config_id) REFERENCES rerank_config(id) ON DELETE SET NULL;
-- DELETE FROM model_config WHERE kind = 'rerank';
