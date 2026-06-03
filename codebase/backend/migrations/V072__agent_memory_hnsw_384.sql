-- V072: agent_memory 384 차원 partial HNSW 인덱스 (cosine distance)
-- requires pgvector >= 0.5 (HNSW)
--
-- DocumentChunk 의 차원별 partial HNSW 정책 (V030, SUPPORTED_EMBEDDING_DIMS) 을 그대로 미러.
-- untyped vector 컬럼에는 HNSW 를 직접 부착할 수 없으므로 cast 표현식 + 차원 조건의
-- partial index 로 우회한다. 회수 SQL (AgentMemoryService) 도 동일한 cast/조건을 써야 인덱스를 탄다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V072__agent_memory_hnsw_384.conf (executeInTransaction=false) 와 함께 비-트랜잭션 모드로 실행.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_mem_emb_hnsw_384
  ON agent_memory USING hnsw ((embedding::vector(384)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 384;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_mem_emb_hnsw_384;
