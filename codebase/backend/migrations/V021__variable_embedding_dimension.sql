-- V021: 가변 차원 임베딩 지원 (컬럼 변경 + KB 차원 추적)
-- spec/5-system/8-embedding-pipeline.md §5.3 ("embedding 컬럼은 가변 차원을 지원해야 한다") 실현
--
-- 인덱스(차원별 partial HNSW) 생성은 V022 에서 CREATE INDEX CONCURRENTLY 로 별도 마이그레이션
-- 하므로, 본 파일은 컬럼 타입 변경/메타데이터 컬럼 추가만 수행한다.

-- 1) V005 NOTE 의 예시 인덱스가 운영에서 수동 생성되었을 가능성에 대비해 IF EXISTS 로 정리
DROP INDEX IF EXISTS idx_document_chunk_embedding;

-- 2) document_chunk.embedding 을 untyped vector 로 완화하여 KB 별로 다른 차원의 모델 허용
ALTER TABLE document_chunk ALTER COLUMN embedding TYPE vector;

-- 3) KB 별 임베딩 차원을 명시적으로 추적 (첫 임베딩 시 EmbeddingService 가 자동으로 채움)
ALTER TABLE knowledge_base ADD COLUMN embedding_dimension INTEGER;

-- 4) embedding_model default 를 신규 표준으로 통일 (서비스 default 와 동기화)
ALTER TABLE knowledge_base ALTER COLUMN embedding_model SET DEFAULT 'text-embedding-3-small';
