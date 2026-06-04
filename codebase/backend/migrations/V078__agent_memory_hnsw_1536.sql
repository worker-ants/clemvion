-- V078: agent_memory 1536 차원 partial HNSW 인덱스 (OpenAI text-embedding-3-small / ada-002)
-- requires pgvector >= 0.5 (HNSW)
--
-- DocumentChunk 의 차원별 partial HNSW 정책 (V031) 미러. agent_memory 의 기본 임베딩 모델
-- text-embedding-3-small 가 1536 차원이라 가장 흔히 쓰일 차원이다. 회수 SQL 도 동일 cast/조건 사용.
-- CONCURRENTLY 는 트랜잭션 외부 실행 — 동봉 .conf (executeInTransaction=false) 와 함께 실행.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_mem_emb_hnsw_1536
  ON agent_memory USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1536;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_mem_emb_hnsw_1536;
