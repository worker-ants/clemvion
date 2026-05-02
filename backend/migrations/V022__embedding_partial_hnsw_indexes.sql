-- V022: 차원별 partial HNSW 인덱스 (cosine distance, vector_cosine_ops)
-- requires pgvector >= 0.5 (HNSW)
--
-- untyped vector 컬럼에는 HNSW 를 직접 붙일 수 없으므로 cast 표현식 +
-- 차원 조건의 partial index 로 우회. 검색 SQL 도 동일한 cast/조건을 사용해야 인덱스를 탄다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 본 파일은
-- 동봉된 V022__embedding_partial_hnsw_indexes.conf (executeInTransaction=false)
-- 와 함께 비-트랜잭션 모드로 실행한다.
--
-- 차원 제한:
--   pgvector 의 HNSW(그리고 IVFFlat) 는 `vector` 타입에서 최대 2000 차원까지만
--   인덱스를 만들 수 있다. 따라서 3072 차원(text-embedding-3-large) 등 2000
--   초과 모델은 본 마이그레이션에서 인덱스를 부착하지 않으며, RAG 검색은
--   partial 조건(`vector_dims = 3072`) 매칭으로 시퀀셜 스캔하게 된다.
--   향후 halfvec(pgvector >= 0.7, max 4000 차원) 도입 시 별도 마이그레이션으로
--   `(embedding::halfvec(N)) halfvec_cosine_ops` partial index 를 추가할 수 있다.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_768
  ON document_chunk USING hnsw ((embedding::vector(768)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 768;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chunk_emb_hnsw_1536
  ON document_chunk USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1536;

-- 새 차원 모델 도입 시:
--   - 차원 ≤ 2000: 동일 패턴의 partial 인덱스 추가
--   - 차원 > 2000: halfvec 또는 시퀀셜 스캔 결정
