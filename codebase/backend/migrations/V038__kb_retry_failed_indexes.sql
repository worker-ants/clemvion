-- V038: KB 재시도/실패 추적용 인덱스를 CONCURRENTLY 생성
-- V037 의 컬럼·enum 변경과 분리해 무중단 배포를 보장한다.
--
-- 인덱스 종류:
--   1) idx_document_kb_embedding_status — (knowledge_base_id, embedding_status) — 실패 문서 일괄 조회 가속
--   2) idx_document_embedding_stuck     — embedding_last_attempted_at WHERE embedding_status='processing' (partial)
--                                          stuck 회수 부팅 쿼리 (테이블 풀스캔 방지)
--   3) idx_document_graph_stuck         — graph_last_attempted_at WHERE graph_extraction_status='processing' (partial)
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 밖에서만 동작하므로 conf 의 executeInTransaction=false 가 필수.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_kb_embedding_status
  ON document(knowledge_base_id, embedding_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_embedding_stuck
  ON document(embedding_last_attempted_at)
  WHERE embedding_status = 'processing';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_graph_stuck
  ON document(graph_last_attempted_at)
  WHERE graph_extraction_status = 'processing';
