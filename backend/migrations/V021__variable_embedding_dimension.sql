-- V021: 가변 차원 임베딩 지원 + 차원별 partial HNSW 인덱스
-- requires pgvector >= 0.5 (HNSW)
-- spec/5-system/8-embedding-pipeline.md §5.3 ("embedding 컬럼은 가변 차원을 지원해야 한다") 실현

-- 1) document_chunk.embedding 을 untyped vector 로 완화하여 KB 별로 다른 차원의 모델 허용
ALTER TABLE document_chunk ALTER COLUMN embedding TYPE vector;

-- 2) KB 별 임베딩 차원을 명시적으로 추적 (첫 임베딩 시 EmbeddingService 가 자동으로 채움)
ALTER TABLE knowledge_base ADD COLUMN embedding_dimension INTEGER;

-- 3) embedding_model default 를 신규 표준으로 통일 (서비스 default 와 동기화)
ALTER TABLE knowledge_base ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-3-small';

-- 4) 차원별 partial HNSW 인덱스 (cosine distance, vector_cosine_ops)
--    untyped vector 컬럼에는 HNSW 를 직접 붙일 수 없으므로
--    cast 표현식 + 차원 조건의 partial index 로 우회한다.
--    검색 SQL 도 동일한 cast/조건을 사용해야 인덱스를 탄다.
CREATE INDEX idx_chunk_emb_hnsw_1536
  ON document_chunk USING hnsw ((embedding::vector(1536)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 1536;

CREATE INDEX idx_chunk_emb_hnsw_3072
  ON document_chunk USING hnsw ((embedding::vector(3072)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 3072;

CREATE INDEX idx_chunk_emb_hnsw_768
  ON document_chunk USING hnsw ((embedding::vector(768)) vector_cosine_ops)
  WHERE vector_dims(embedding) = 768;

-- 새 차원 모델 도입 시: 동일 패턴의 partial 인덱스를 추가하는 신규 마이그레이션 작성.
-- 운영 데이터 규모가 커지면 후속 마이그레이션에서 CREATE INDEX CONCURRENTLY 로 재구축 검토.
