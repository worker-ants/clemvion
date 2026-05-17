-- V039: V001 시대의 인라인 CHECK 잔존 제약 제거 (V037 이 이미 성공한 환경 안전망)
--
-- 배경:
--   V001__initial_schema.sql 의 document.embedding_status 컬럼은 인라인 CHECK 로 정의되어
--   PostgreSQL 이 자동으로 'document_embedding_status_check' 라는 이름을 부여했다.
--   초기 V037 은 새 제약 'chk_doc_embedding_status' (값에 'failed' 포함) 만 추가하고
--   옛 제약은 드롭하지 않아 다음 두 가지 문제가 발생했다:
--   - 'error' 행이 있는 환경: V037 의 UPDATE 가 23514 위반으로 실패.
--   - 'error' 행이 없는 환경: V037 은 통과하나 옛 제약이 살아있어 향후 'failed' 쓰기가 막힘.
--   V037 본문은 후속 수정으로 DROP CONSTRAINT IF EXISTS 가 추가되었지만, Flyway 는
--   이미 successful 로 기록된 V037 을 재실행하지 않으므로 (`flyway repair` 로 checksum 만
--   재정렬됨) "V037 이 이미 성공한 환경" 에는 옛 제약이 여전히 남아 있다.
--   본 마이그레이션은 그 환경을 위한 안전망이다.
--
-- 무결성:
--   신규 제약 chk_doc_embedding_status 가 동일 컬럼 값 범위의 상위 집합을 이미 강제하므로
--   옛 제약을 드롭해도 데이터 무결성은 약화되지 않는다.
--
-- 재시도 안전성:
--   IF EXISTS 로 idempotent. V037 이 새로 성공한 환경(이미 옛 제약을 드롭) 에서는 no-op.

ALTER TABLE document
  DROP CONSTRAINT IF EXISTS document_embedding_status_check;
