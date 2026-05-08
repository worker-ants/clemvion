-- V035: execution_node_log append-only 테이블 + execution.execution_path 컬럼 제거
--
-- WARN #2 (분산 환경 인스턴스 간 순서 비결정성) 조치 — 기존 단일 컬럼
-- `execution.execution_path` (uuid[]) 는 `array_append()` 로 atomic 추가는
-- 가능하나, 다중 인스턴스에서 동시 INSERT 시 절대 순서를 보장하지 못한다.
-- BIGSERIAL `id` 가 PostgreSQL sequence (concurrency-safe) 로 부여되므로
-- (execution_id, id) 정렬이 곧 실행 순서가 된다.
--
-- 함께 적용:
--  1. CREATE TABLE + index
--  2. 기존 execution_path 데이터 이행 (UNNEST WITH ORDINALITY)
--  3. execution.execution_path 컬럼 DROP
--
-- 적용 환경: PostgreSQL.
-- executeInTransaction=true — 데이터 이행 + 컬럼 drop 을 단일 트랜잭션으로
-- 묶어 부분 적용을 차단한다. INSERT...SELECT 가 큰 테이블에서 시간이 오래
-- 걸릴 가능성이 있으면 V035a (테이블 + 이행) / V035b (컬럼 drop) 로 분리 검토.

CREATE TABLE execution_node_log (
  id           BIGSERIAL PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE,
  node_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX execution_node_log_execution_id_id_idx
  ON execution_node_log (execution_id, id);

-- 기존 array 데이터를 (execution_id, ordinal) 기준으로 INSERT.
-- ORDER BY 가 BIGSERIAL 부여 순서를 좌우하므로, 동일 execution 안에서는
-- 기존 배열 순서대로 id 가 증가한다.
INSERT INTO execution_node_log (execution_id, node_id)
SELECT e.id, p.node_id
FROM execution e, UNNEST(e.execution_path) WITH ORDINALITY AS p(node_id, ord)
WHERE e.execution_path IS NOT NULL AND array_length(e.execution_path, 1) > 0
ORDER BY e.id, p.ord;

ALTER TABLE execution DROP COLUMN execution_path;
