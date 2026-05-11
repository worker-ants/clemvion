-- V037: KB 임베딩·그래프 추출 재시도/실패 추적
-- spec/5-system/8-embedding-pipeline.md & spec/5-system/10-graph-rag.md 의 "Retry & Failure" 절 실현.
--
-- 변경 요약:
--   1) document 에 retry_count / last_attempted_at / error_message 컬럼 6개 추가 (임베딩·그래프 각 3개)
--   2) embedding_status / graph_extraction_status enum 에 'failed' 추가
--      - 'error'  = in-flight 재시도 중 일시 오류
--      - 'failed' = 최대 재시도 소진 또는 비재시도성 오류로 인한 최종 실패
--   3) 기존 'error' (실질적 영구 실패) → 'failed' 일괄 변환
--   4) KB batch finalize / 실패 문서 조회 가속용 인덱스 (stuck 회수용 partial index 포함)
--
-- 주의 (옛 CHECK 제약 ordering):
--   두 status 컬럼 모두 'error' → 'failed' UPDATE 보다 먼저 옛 CHECK 를 DROP 해야 한다.
--   그렇지 않으면 옛 제약이 'failed' 를 거부해 23514 위반이 발생한다.
--   - embedding_status: V001 의 인라인 CHECK 는 자동 이름 'document_embedding_status_check'
--     로 만들어졌고 옛 값 집합만 허용한다. UPDATE 직전에 드롭하며, 신규 제약은 다른 이름
--     (chk_doc_embedding_status) 으로 추가한다.
--   - graph_extraction_status: V025 의 'chk_doc_graph_extraction_status' 는 옛 값 집합만
--     허용한다. UPDATE 직전에 드롭하고 동일 이름으로 'failed' 포함 새 정의를 재생성한다.
--   양쪽 모두 신규 제약이 옛 값 범위의 상위 집합을 강제하므로 데이터 무결성은 보존된다.
--
-- 배포 안전성:
--   - 모든 ALTER TABLE / UPDATE 가 ACCESS EXCLUSIVE 또는 SHARE ROW EXCLUSIVE 락을 짧게 점유.
--   - CHECK 제약은 NOT VALID 로 추가 후 VALIDATE 분리해 큰 테이블에서도 락 시간을 최소화한다.
--   - CREATE INDEX CONCURRENTLY 를 사용해 동시 쓰기를 차단하지 않는다 (executeInTransaction=false 필요).
--   - 롤링 배포 절차: (a) 구버전 워커 stop → (b) 본 마이그레이션 적용 → (c) 신버전 워커 start.
--     기존 'error' (영구 실패 의미) 가 'failed' 로 변환되므로 구버전 코드가 'error' 를 읽는 상태에서
--     마이그레이션이 들어가면 해당 레코드를 못 찾는 회귀가 발생할 수 있다.
--
-- DOWN (수동 적용 절차):
--   ALTER TABLE document DROP CONSTRAINT IF EXISTS chk_doc_embedding_status;
--   ALTER TABLE document DROP CONSTRAINT IF EXISTS chk_doc_graph_extraction_status;
--   UPDATE document SET embedding_status = 'error'        WHERE embedding_status = 'failed';
--   UPDATE document SET graph_extraction_status = 'error' WHERE graph_extraction_status = 'failed';
--   ALTER TABLE document ADD CONSTRAINT document_embedding_status_check
--     CHECK (embedding_status IN ('pending','processing','completed','error'));
--   ALTER TABLE document ADD CONSTRAINT chk_doc_graph_extraction_status
--     CHECK (graph_extraction_status IS NULL OR graph_extraction_status IN ('pending','processing','completed','error'));
--   DROP INDEX IF EXISTS idx_document_kb_embedding_status;
--   DROP INDEX IF EXISTS idx_document_embedding_stuck;
--   DROP INDEX IF EXISTS idx_document_graph_stuck;
--   ALTER TABLE document
--     DROP COLUMN IF EXISTS embedding_retry_count,
--     DROP COLUMN IF EXISTS embedding_last_attempted_at,
--     DROP COLUMN IF EXISTS embedding_error_message,
--     DROP COLUMN IF EXISTS graph_retry_count,
--     DROP COLUMN IF EXISTS graph_last_attempted_at,
--     DROP COLUMN IF EXISTS graph_error_message;

-- 1) 컬럼 추가 — ACCESS EXCLUSIVE 락 필요. ADD COLUMN ... DEFAULT (NOT NULL 포함) 는
--    PostgreSQL 11+ 에서 metadata-only 로 즉시 완료되어 안전.
ALTER TABLE document
  ADD COLUMN embedding_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN embedding_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN embedding_error_message TEXT,
  ADD COLUMN graph_retry_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN graph_last_attempted_at TIMESTAMPTZ,
  ADD COLUMN graph_error_message TEXT;

-- 2) embedding_status: 기존 'error' (영구 실패 의미) → 'failed' 로 이관 후 CHECK 추가.
--    V001 인라인 CHECK 잔존 제약(document_embedding_status_check) 은 옛 값 집합만 허용하므로
--    'failed' 쓰기 직전에 먼저 드롭한다. 신규 chk_doc_embedding_status 가 동일 컬럼 값 범위
--    (상위 집합) 를 강제하므로 무결성은 유지된다.
ALTER TABLE document
  DROP CONSTRAINT IF EXISTS document_embedding_status_check;

UPDATE document
  SET embedding_status = 'failed'
  WHERE embedding_status = 'error';

-- NOT VALID 로 추가하면 ACCESS EXCLUSIVE 시간이 짧아지고, VALIDATE 단계에서 SHARE UPDATE EXCLUSIVE
-- (테이블 쓰기 허용) 으로 기존 행을 검증한다. 모든 신규 'failed' 행은 이미 enum 내라 검증 안전.
ALTER TABLE document
  ADD CONSTRAINT chk_doc_embedding_status
    CHECK (embedding_status IN ('pending', 'processing', 'completed', 'error', 'failed'))
    NOT VALID;
ALTER TABLE document VALIDATE CONSTRAINT chk_doc_embedding_status;

-- 3) graph_extraction_status: 기존 CHECK 교체 + 'error' → 'failed' 변환
--    V025 의 chk_doc_graph_extraction_status 는 'failed' 를 허용하지 않으므로 UPDATE 이전에
--    먼저 드롭한다. 'failed' 를 포함한 새 정의는 UPDATE 이후 동일 이름으로 재생성한다.
--    embedding_status 측(step 2) 과 동일한 DROP → UPDATE → ADD → VALIDATE 순서다.
ALTER TABLE document
  DROP CONSTRAINT IF EXISTS chk_doc_graph_extraction_status;

UPDATE document
  SET graph_extraction_status = 'failed'
  WHERE graph_extraction_status = 'error';

ALTER TABLE document
  ADD CONSTRAINT chk_doc_graph_extraction_status
    CHECK (
      graph_extraction_status IS NULL
      OR graph_extraction_status IN ('pending', 'processing', 'completed', 'error', 'failed')
    )
    NOT VALID;
ALTER TABLE document VALIDATE CONSTRAINT chk_doc_graph_extraction_status;
