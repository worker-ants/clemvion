-- V026: graph_extraction_status nullable + KB batch finalize 인덱스
-- review/2026-05-02_16-11-51 의 Critical #7 + Info #8 후속 조치.
--
-- 1) document.graph_extraction_status 를 NULLABLE 로 완화
--    vector 모드 KB 의 문서에는 'pending' 같은 상태가 의미가 없다. NULL 로 두어
--    "graph 추출 비대상" 임을 명확히 한다. graph 모드 KB 의 문서는 EmbeddingService 에서
--    명시적으로 'pending' 으로 set 한 뒤 큐잉한다.
ALTER TABLE document
  DROP CONSTRAINT IF EXISTS chk_doc_graph_extraction_status;

ALTER TABLE document
  ALTER COLUMN graph_extraction_status DROP NOT NULL,
  ALTER COLUMN graph_extraction_status DROP DEFAULT;

ALTER TABLE document
  ADD CONSTRAINT chk_doc_graph_extraction_status
    CHECK (graph_extraction_status IS NULL OR graph_extraction_status IN ('pending', 'processing', 'completed', 'error'));

-- vector 모드 KB 문서들의 graph_extraction_status 를 NULL 로 정리.
UPDATE document SET graph_extraction_status = NULL
  WHERE knowledge_base_id IN (SELECT id FROM knowledge_base WHERE rag_mode = 'vector');

-- 2) maybeFinalizeKbBatch 에서 (knowledge_base_id, graph_extraction_status) 로 카운트하는 패턴 가속.
-- 기존에는 knowledge_base_id 인덱스만 있어 large KB 에서 N×O(n) 부하.
CREATE INDEX IF NOT EXISTS idx_document_kb_graph_status
  ON document(knowledge_base_id, graph_extraction_status);
