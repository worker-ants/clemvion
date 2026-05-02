-- V027: relation 테이블의 (kb_id, head_entity_id, tail_entity_id) 복합 인덱스
-- review/2026-05-02_16-11-51 INFO-19 반영. graph 시각화 / 검색이 head/tail 동시 필터링할 때
-- 풀스캔을 방지한다.
--
-- 기존 idx_relation_kb_head 와 idx_relation_kb_tail 은 그대로 유지 (단방향 traversal 에 사용).
-- 신규 인덱스는 두 컬럼을 동시에 평가하는 시각화·통계 쿼리(WHERE head IN (...) AND tail IN (...))
-- 의 plan 을 단축한다.

CREATE INDEX IF NOT EXISTS idx_relation_kb_head_tail
  ON relation (knowledge_base_id, head_entity_id, tail_entity_id);

-- DOWN: DROP INDEX IF EXISTS idx_relation_kb_head_tail;
