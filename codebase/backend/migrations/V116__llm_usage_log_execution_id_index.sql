-- V116: llm_usage_log (execution_id) partial — FK llm_usage_log_execution_id_fkey (ON DELETE SET NULL)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «삭제 연쇄의 FK 인덱스 다섯 (2026-09-18)»
-- 실측·전수·쓰기 비용: plan/complete/spec-draft-deletion-cascade-indexes.md
--
-- 부모 행을 지울 때 Postgres 의 FK 트리거는 지워지는 부모 행마다 자식을 한 번씩 찾는다. 이 FK 에는 선두
-- 인덱스가 없어(Postgres 는 FK 에 인덱스를 자동 생성하지 않는다) 그때마다 자식 테이블을 전부 훑었다.
-- 두 삭제 경로가 부른다 — 캔버스 저장이 노드를 뺄 때(저장마다)와 워크플로 삭제.
--
-- 800k node_execution 규모 실측 (PostgreSQL 18, V001~V111, 워밍 뒤 1회):
--   워크플로 삭제 2,225 ms → 6.96 ms · 캔버스 노드 하나 삭제 206.6 ms → 0.79 ms
--   (V112 · V113 · V115 · V116 넷을 둔 측정 — V114 는 그 뒤 더해 그 FK 만 따로 쟀다)
--
-- 실행(execution) 행이 지워질 때마다 한 번씩 찾는다 — 워크플로 삭제 한 번이 20회.
-- 800k 워크플로 삭제에서 116.9 ms → 0.39 ms. 크기 3.9 MB. partial 인 이유는 V115 와 같다.
-- 쓰기 비용은 V115 와 합쳐 쟀다(V115 헤더).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111).
DROP INDEX CONCURRENTLY IF EXISTS idx_llm_usage_log_execution_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_llm_usage_log_execution_id
  ON llm_usage_log (execution_id)
  WHERE execution_id IS NOT NULL;

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_llm_usage_log_execution_id;
