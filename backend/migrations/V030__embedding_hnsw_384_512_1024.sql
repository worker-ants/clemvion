-- V030: 384 / 512 / 1024 차원 임베딩의 partial HNSW 인덱스.
-- 모두 ≤ 2000 차원이라 V022 와 동일한 vector(N) cast + cosine_ops 패턴.
--
-- 대표 모델 예시:
--   - 384  : sentence-transformers/all-MiniLM-L6-v2, BGE small
--   - 512  : sentence-transformers/paraphrase-multilingual-MiniLM, BGE small variants
--   - 1024 : OpenAI text-embedding-3-small (dimensions: 1024 옵션), BGE 다국어, Cohere embed-multilingual-v3, voyage-3
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V030__embedding_hnsw_384_512_1024.conf (executeInTransaction=false) 와 함께 비-트랜잭션으로 실행한다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_384
  ON document_chunk USING hnsw ((embedding::vector(384)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 384;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_512
  ON document_chunk USING hnsw ((embedding::vector(512)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 512;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_1024
  ON document_chunk USING hnsw ((embedding::vector(1024)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1024;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_384;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_512;
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_1024;
