-- V022: 차원별 partial HNSW 인덱스 (cosine distance, vector_cosine_ops)
-- requires pgvector >= 0.5 (HNSW)
--
-- untyped vector 컬럼에는 HNSW 를 직접 붙일 수 없으므로 cast 표현식 +
-- 차원 조건의 partial index 로 우회. 검색 SQL 도 동일한 cast/조건을 사용해야 인덱스를 탄다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 본 파일은
-- 동봉된 V022__embedding_partial_hnsw_indexes.conf (executeInTransaction=false)
-- 와 함께 비-트랜잭션 모드로 실행한다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_1536
  ON document_chunk USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1536;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_3072
  ON document_chunk USING hnsw ((embedding::vector(3072)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 3072;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_768
  ON document_chunk USING hnsw ((embedding::vector(768)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 768;

-- 새 차원 모델 도입 시 동일 패턴의 partial 인덱스를 추가하는 신규 마이그레이션 작성.
