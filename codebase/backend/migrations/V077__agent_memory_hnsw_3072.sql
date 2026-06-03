-- V077: agent_memory 3072 차원용 halfvec partial HNSW 인덱스 (OpenAI text-embedding-3-large)
-- requires pgvector >= 0.7 (halfvec)
--
-- DocumentChunk 의 3072 정책 (V023) 미러: vector 타입 HNSW 차원 제한(≤ 2000) 때문에 3072 는
-- fp16 halfvec 으로 cast 해야 인덱스 부착이 가능하다. 회수 SQL 도 동일한 cast 표현식
-- (`embedding::halfvec(3072)`) 과 차원 조건을 사용해야 본 인덱스를 탄다.
-- CONCURRENTLY 는 트랜잭션 외부 실행 — 동봉 .conf (executeInTransaction=false) 와 함께 실행.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_mem_emb_hnsw_3072_halfvec
  ON agent_memory USING hnsw ((embedding::halfvec(3072)) halfvec_cosine_ops)
  WHERE vector_dims(embedding) = 3072;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_mem_emb_hnsw_3072_halfvec;
