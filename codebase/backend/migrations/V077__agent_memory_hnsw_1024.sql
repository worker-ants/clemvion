-- V077: agent_memory 1024 차원 partial HNSW 인덱스 (cosine distance)
-- requires pgvector >= 0.5 (HNSW)
--
-- DocumentChunk 의 차원별 partial HNSW 정책 (V033) 미러. 회수 SQL 도 동일 cast/조건 사용.
-- CONCURRENTLY 는 트랜잭션 외부 실행 — 동봉 .conf (executeInTransaction=false) 와 함께 실행.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_mem_emb_hnsw_1024
  ON agent_memory USING hnsw ((embedding::vector(1024)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1024;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_mem_emb_hnsw_1024;
