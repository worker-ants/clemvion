-- V037: KB 임베딩·그래프 추출 재시도/실패 추적
-- spec/5-system/8-embedding-pipeline.md & spec/5-system/10-graph-rag.md 의 "Retry & Failure" 절 실현.
--
-- 변경 요약:
--   1) document 에 retry_count / last_attempted_at / error_message 컬럼 6개 추가 (임베딩·그래프 각 3개)
--   2) embedding_status / graph_extraction_status enum 에 'failed' 추가
--      - 'error'  = in-flight 재시도 중 일시 오류
--      - 'failed' = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패
--   3) 기존 'error' (실질적 영구 실패) → 'failed' 일괄 변환
--   4) KB batch finalize / 실패 문서 조회 가속용 인덱스
--
-- DOWN:
--   ALTER TABLE document DROP CONSTRAINT IF EXISTS chk_doc_embedding_status;
--   ALTER TABLE document DROP CONSTRAINT IF EXISTS chk_doc_graph_extraction_status;
--   ALTER TABLE document ADD CONSTRAINT chk_doc_graph_extraction_status
--     CHECK (graph_extraction_status IS NULL OR graph_extraction_status IN ('pending','processing','completed','error'));
--   DROP INDEX IF EXISTS idx_document_kb_embedding_status;
--   ALTER TABLE document
--     DROP COLUMN IF EXISTS embedding_retry_count,
--     DROP COLUMN IF EXISTS embedding_last_attempted_at,
--     DROP COLUMN IF EXISTS embedding_error_message,
--     DROP COLUMN IF EXISTS graph_retry_count,
--     DROP COLUMN IF EXISTS graph_last_attempted_at,
--     DROP COLUMN IF EXISTS graph_error_message;

-- 1) 컬럼 추가
ALTER TABLE document
  ADD COLUMN embedding_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN embedding_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN embedding_error_message TEXT,
  ADD COLUMN graph_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN graph_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN graph_error_message TEXT;

-- 2) embedding_status: 기존엔 CHECK 가 없어 'failed' 도입 시점에 신규 도입.
--    먼저 기존 'error' 를 'failed' 로 변환한 뒤 CHECK 추가.
UPDATE document
  SET embedding_status = 'failed'
  WHERE embedding_status = 'error';

ALTER TABLE document
  ADD CONSTRAINT chk_doc_embedding_status
    CHECK (embedding_status IN ('pending', 'processing', 'completed', 'error', 'failed'));

-- 3) graph_extraction_status: 기존 CHECK 교체 + 'error' → 'failed' 변환
UPDATE document
  SET graph_extraction_status = 'failed'
  WHERE graph_extraction_status = 'error';

ALTER TABLE document
  DROP CONSTRAINT IF EXISTS chk_doc_graph_extraction_status;

ALTER TABLE document
  ADD CONSTRAINT chk_doc_graph_extraction_status
    CHECK (
      graph_extraction_status IS NULL
      OR graph_extraction_status IN ('pending', 'processing', 'completed', 'error', 'failed')
    );

-- 4) 인덱스: 실패 문서 일괄 조회 + KB batch finalize 가속
CREATE INDEX IF NOT EXISTS idx_document_kb_embedding_status
  ON document(knowledge_base_id, embedding_status);
-- idx_document_kb_graph_status 는 V026 에서 이미 생성됨 (graph_extraction_status partial). 재사용.
