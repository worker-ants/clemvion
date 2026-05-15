-- Background 모니터링 API 의 backgroundRunId 조회를 위한 부분 expression 인덱스.
--
-- 옛 흐름: backgroundRunId 는 NodeExecution.outputData JSONB 의
--          meta.backgroundRunId 안에만 저장. 모니터링 API 가 이 키로
--          단일 row 를 찾으려면 전체 outputData 풀스캔 위험.
-- 새 흐름: 부분 expression B-tree 인덱스 — Background 노드의
--          NodeExecution (meta.backgroundRunId IS NOT NULL) 행만 인덱싱.
--          UUID v4 의 고유성 + 부분 인덱스로 인덱스 크기 최소.
--
-- 부분 조건 `WHERE output_data #>> '{meta,backgroundRunId}' IS NOT NULL`:
--   - Background 노드의 NodeExecution 만 매칭 — 다른 노드 무관
--   - 옛 row 의 outputData 가 평가 후 형태라도 backgroundRunId 가 없으면
--     인덱스에서 자동 제외 — 운영 데이터 충돌 없음
--
-- CONCURRENTLY: 운영 테이블 쓰기 락 회피. 동봉 .conf 의
-- executeInTransaction=false 필수.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_background_run_id
  ON node_execution ((output_data #>> '{meta,backgroundRunId}'))
  WHERE output_data #>> '{meta,backgroundRunId}' IS NOT NULL;
