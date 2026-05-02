-- V030: 384 차원 partial HNSW 인덱스
-- (sentence-transformers all-MiniLM-L6-v2, BGE small 등)
--
-- 한 .conf 파일 = 한 CONCURRENTLY 규칙 (README §5) 에 따라 V030 은 384 만 처리하고,
-- 512 / 1024 는 V032 / V033 으로 각각 분리되었다 (이전에는 한 파일에 셋 모두 있었으나
-- Flyway 추적 세션 snapshot 으로 인한 무한 hang 이슈로 split).
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V030__embedding_hnsw_384_512_1024.conf (executeInTransaction=false) 와 함께
-- 비-트랜잭션 모드로 실행한다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_384
  ON document_chunk USING hnsw ((embedding::vector(384)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 384;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_384;
