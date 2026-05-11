-- V039: V001 시대의 인라인 CHECK 잔존 제약 제거
--
-- 배경:
--   V001__initial_schema.sql 의 document.embedding_status 컬럼은 인라인 CHECK 로 정의되어
--   PostgreSQL 이 자동으로 'document_embedding_status_check' 라는 이름을 부여했다.
--   V037 은 새 제약 'chk_doc_embedding_status' (값에 'failed' 포함) 를 추가했지만 옛 제약을
--   드롭하지 않아, 'error' → 'failed' UPDATE 가 옛 제약에 막힌다.
--   - 'error' 행이 있는 환경: V037 자체가 23514 위반으로 실패한다.
--   - 'error' 행이 없는 환경: V037 은 통과하나 옛 제약이 살아있어 향후 'failed' 쓰기가 막힌다.
--
-- 본 마이그레이션은 옛 제약을 안전하게 제거한다. 새 제약 'chk_doc_embedding_status' 가
--   동일한 값 범위의 상위 집합을 이미 강제하므로 데이터 무결성이 약화되지 않는다.
--
-- 재시도 안전성:
--   IF EXISTS 로 idempotent. V037 이 성공한 환경 / 실패해서 V037 재시도 전인 환경 모두에서
--   동일하게 동작한다.

ALTER TABLE document
  DROP CONSTRAINT IF EXISTS document_embedding_status_check;
