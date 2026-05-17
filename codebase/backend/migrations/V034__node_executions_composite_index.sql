-- V034: node_execution (execution_id, node_id, started_at DESC) 복합 인덱스
--
-- WARN #3 (DB) 조치 — execution-engine.service.ts 의 다음 3개 호출 패턴이
-- node_execution 의 (execution_id, node_id) 로 lookup 후 startedAt DESC 로
-- 정렬해 1개 row 를 가져온다 (각각 line ~1391, 1608, 1950 부근):
--   findOne({ where: { executionId, nodeId }, order: { startedAt: 'DESC' } })
-- 단일 인덱스 (execution_id) 만 있을 때는 (execution_id) 로 후보 row 를 모두
-- 가져온 뒤 sort 단계가 필요해 다수 turn 이 누적된 multi-turn 노드에서 발견
-- 문제. 복합 인덱스로 O(log N) seek 후 순방향 1개 row 만 읽도록 단축.
--
-- 적용 환경: PostgreSQL.
-- CONCURRENTLY 옵션을 사용하여 운영 트래픽을 막지 않는다.
-- IF NOT EXISTS 로 idempotent.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_exec_node_started_desc
  ON node_execution (execution_id, node_id, started_at DESC);
