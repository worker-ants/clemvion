-- V033: 1024 차원 partial HNSW 인덱스
-- (text-embedding-3-small dimensions:1024, BGE 다국어, Cohere embed-multilingual-v3, voyage-3)
--
-- V030 split — README §5 의 "한 .conf = 한 CONCURRENTLY" 규칙에 따라 분리.
-- V030 이 이미 적용된 환경은 마이그 적용 전 `flyway repair` 필요 (V030 checksum 변경됨).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_1024
  ON document_chunk USING hnsw ((embedding::vector(1024)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1024;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_1024;
