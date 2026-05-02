-- V031: 1536 차원 partial HNSW 인덱스 (OpenAI text-embedding-3-small / ada-002)
-- requires pgvector >= 0.5 (HNSW)
--
-- 원래 V022 안에 768 / 1536 두 statement 가 함께 있었으나, executeInTransaction=false
-- 파일에 CREATE INDEX CONCURRENTLY 가 둘 이상이면 Flyway 추적 세션 snapshot 으로 인해
-- 두 번째 statement 부터 무한 hang 하는 이슈 (README §5) 가 있어 차원당 하나 파일로 split.
--
-- 빈 테이블이거나 1536 차원 청크가 없는 환경에서는 instant. V022 가 이미 적용된 환경에서는
-- IF NOT EXISTS 로 no-op (이전 V022 가 1536 인덱스도 만들었으므로). split 으로 V022 의 checksum 이
-- 바뀌었으니 운영 환경은 마이그 적용 전 `flyway repair` 가 필요하다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V031__embedding_hnsw_1536.conf (executeInTransaction=false) 와 함께 실행.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_1536
  ON document_chunk USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1536;

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_chunk_emb_hnsw_1536;
