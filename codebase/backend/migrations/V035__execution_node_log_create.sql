-- V035: execution_node_log append-only 테이블 + 기존 execution_path 데이터 이행
--
-- WARN #2 (분산 환경 인스턴스 간 순서 비결정성) 조치 — 기존 단일 컬럼
-- `execution.execution_path` (uuid[]) 는 다중 인스턴스에서 동시 INSERT 시
-- 절대 순서를 보장하지 못한다. BIGSERIAL `id` 가 PostgreSQL sequence
-- (concurrency-safe) 로 부여되므로 (execution_id, id) 정렬이 곧 실행 순서.
--
-- 본 V035 는 신규 테이블 생성 + 데이터 이행만 수행한다 (DROP 미포함).
-- INSERT...SELECT 가 큰 운영 DB 에서 시간이 걸려도 read traffic 을 막지
-- 않도록 executeInTransaction=false 로 단계 분리 — 트랜잭션 lock 확장
-- 회피. 컬럼 DROP 은 별도 후속 배포 (V036) 에서 적용한다.
--
-- 컬럼 자체는 V036 까지 유지되며 application 코드는 컬럼을 더 이상 읽지
-- 않으므로 (V035 배포 시점에 새 코드도 함께 배포), 옛 코드와 새 코드의
-- 동시 운용 시에도 정합성 위험은 없다.

CREATE TABLE IF NOT EXISTS execution_node_log (
  id           BIGSERIAL PRIMARY KEY,
  execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE,
  node_id      UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS execution_node_log_execution_id_id_idx
  ON execution_node_log (execution_id, id);

-- 기존 array 데이터를 (execution_id, ordinal) 기준으로 INSERT.
-- ORDER BY 가 BIGSERIAL 부여 순서를 좌우하므로, 동일 execution 안에서는
-- 기존 배열 순서대로 id 가 증가한다. 컬럼이 이미 존재하지 않는 (clean
-- install) 환경도 안전하도록 information_schema 가드 사용.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_name = 'execution' AND column_name = 'execution_path'
  ) THEN
    INSERT INTO execution_node_log (execution_id, node_id)
    SELECT e.id, p.node_id
    FROM execution e, UNNEST(e.execution_path) WITH ORDINALITY AS p(node_id, ord)
    WHERE e.execution_path IS NOT NULL
      AND array_length(e.execution_path, 1) > 0
    ORDER BY e.id, p.ord;
  END IF;
END $$;
