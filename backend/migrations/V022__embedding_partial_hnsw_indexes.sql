-- V022: 768 차원 partial HNSW 인덱스 (cosine distance, vector_cosine_ops)
-- requires pgvector >= 0.5 (HNSW)
--
-- untyped vector 컬럼에는 HNSW 를 직접 붙일 수 없으므로 cast 표현식 +
-- 차원 조건의 partial index 로 우회. 검색 SQL 도 동일한 cast/조건을 사용해야 인덱스를 탄다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 본 파일은
-- 동봉된 V022__embedding_partial_hnsw_indexes.conf (executeInTransaction=false)
-- 와 함께 비-트랜잭션 모드로 실행한다.
--
-- 한 .conf 파일 = 한 CONCURRENTLY 규칙 (README §5) 에 따라 차원별로 분리된 마이그레이션:
--   - V022 (이 파일): 768 (Google text-embedding-004)
--   - V031: 1536 (OpenAI text-embedding-3-small, ada-002)
--   - V023: 3072 halfvec (OpenAI text-embedding-3-large)
--   - V030: 384, V032: 512, V033: 1024 (sentence-transformers / BGE / Cohere 등)

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_768
  ON document_chunk USING hnsw ((embedding::vector(768)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 768;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_768;
