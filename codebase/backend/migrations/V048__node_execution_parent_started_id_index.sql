-- Background 본문 모니터링 API 의 cursor 페이지네이션과 status 집계 쿼리
-- 가속을 위한 복합 인덱스 (W-5).
--
-- 옛 흐름: `parent_node_execution_id` 단일 인덱스만 존재 (NodeExecution
--          엔티티의 외래키). cursor 페이지네이션의
--          `WHERE parent_node_execution_id = ? ORDER BY started_at ASC, id ASC`
--          가 Sequential Scan + Sort 로 처리될 수 있다.
-- 새 흐름: `(parent_node_execution_id, started_at, id)` 복합 인덱스로 정렬·
--          페이지네이션 일관 가속. 본문 노드가 수십~수백개 규모에서도
--          정렬 비용 제거.
--
-- aggregateBodyStatus 의 COUNT 집계도 이 인덱스를 Index Only Scan 으로
-- 사용할 수 있다 (status 가 NULL 이 아니므로 별도 인덱스는 불필요).
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 동봉 .conf 의
-- executeInTransaction=false 필수.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_parent_started_id
  ON node_execution (parent_node_execution_id, started_at, id)
  WHERE parent_node_execution_id IS NOT NULL;
