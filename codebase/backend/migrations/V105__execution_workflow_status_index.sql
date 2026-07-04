-- V105: execution (workflow_id, status) 복합 인덱스 — PR2b admission gate hot-path.
--
-- admitExecutionOrDefer 는 매 admission 마다 workspace/workflow 별
-- COUNT(status='running') 을 센다(spec §8). 기존 인덱스는 idx_execution_status(status)
-- 단일 컬럼과 idx_execution_workflow_started(workflow_id, started_at) 뿐이라
-- (workflow_id, status) 조합 카운트에 최적이 아니다(ai-review database WARNING).
-- workflow-cap COUNT(WHERE workflow_id=? AND status='running') 를 직접 커버하고,
-- workspace-cap COUNT(JOIN workflow ... WHERE status='running') 의 execution 측
-- 스캔도 개선한다.
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 밖 실행이라 동봉 .conf 가
-- executeInTransaction=false 를 지정한다. IF NOT EXISTS 로 재실행 idempotent.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_execution_workflow_status
  ON execution (workflow_id, status);
