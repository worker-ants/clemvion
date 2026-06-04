-- RAG 검색 후처리(리랭킹) — knowledge_base 컬럼 확장
-- spec/5-system/9-rag-search.md §3.3, spec/1-data-model.md §2.11
-- rerank_mode 기본 'off' → 기존 KB 는 현행 동작 유지(하위호환).
-- rerank_config 테이블은 V081 에서 생성된다.

ALTER TABLE knowledge_base
  ADD COLUMN rerank_mode TEXT NOT NULL DEFAULT 'off',
  ADD COLUMN rerank_config_id UUID NULL,
  ADD COLUMN rerank_candidate_k INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN rerank_score_threshold DOUBLE PRECISION NULL,
  ADD COLUMN rerank_llm_config_id UUID NULL;

ALTER TABLE knowledge_base
  ADD CONSTRAINT chk_kb_rerank_mode
    CHECK (rerank_mode IN ('off', 'cross_encoder', 'cross_encoder_llm')),
  ADD CONSTRAINT chk_kb_rerank_candidate_k
    CHECK (rerank_candidate_k BETWEEN 1 AND 200),
  ADD CONSTRAINT fk_kb_rerank_config
    FOREIGN KEY (rerank_config_id) REFERENCES rerank_config(id) ON DELETE SET NULL,
  ADD CONSTRAINT fk_kb_rerank_llm_config
    FOREIGN KEY (rerank_llm_config_id) REFERENCES llm_config(id) ON DELETE SET NULL;
