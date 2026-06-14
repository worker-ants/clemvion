-- V095: node_execution 활성 상태 조회용 partial 복합 인덱스 (execution_id, status).
--
-- 핫 경로: 실행 엔진이 한 execution 의 활성 NodeExecution 을 status 로 좁혀 조회/전이한다.
--   - resolveWaitingNodeExecutionId (rehydration 1차 키 — WAITING_FOR_INPUT 조회)
--   - (execution_id, status='running') 조회·UPDATE (재개/마감 경로)
-- 기존 인덱스는 (execution_id) 단일뿐이라(데이터모델 §3) status 는 post-filter 로 처리됐다.
--
-- partial 범위 `WHERE status IN ('waiting_for_input','running')`:
--   - 실측 술어와 정확히 일치 — 활성(미종결) 행만 인덱싱.
--   - completed/failed/cancelled/skipped(대다수) 비포함 → 인덱스 크기 최소,
--     write amplification 은 활성 전이 행에만 발생.
--   - completed 계열 조회(rehydration DISTINCT ON 등)는 V034 가 이미 커버 — full 복합
--     인덱스의 추가 효용이 없어 partial 을 택했다 (refactor 05-database C-3).
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V095__node_execution_exec_status_active_index.conf (executeInTransaction=false) 와
-- 함께 비-트랜잭션 모드로 실행한다 (운영 테이블 무중단 — 쓰기 락 회피).
-- 실패 시 INVALID 인덱스가 잔존할 수 있다 → DROP INDEX 후 재시도 (DOWN 참조).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_node_execution_exec_status_active
  ON node_execution (execution_id, status)
  WHERE status IN ('waiting_for_input', 'running');

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_node_execution_exec_status_active;
