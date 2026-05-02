-- V028: graph entity / relation 검색용 pg_trgm GIN 인덱스
-- review/2026-05-02_16-11-51 W14 반영. graph-query.service 의 ILIKE '%foo%' 가 B-tree
-- 인덱스를 무효화해 풀스캔으로 동작하던 문제를 PostgreSQL pg_trgm extension + GIN
-- 인덱스로 해결한다. PostgreSQL 이 ILIKE 패턴을 GIN 인덱스에 자동 라우팅한다.

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_entity_name_trgm
  ON entity USING gin (name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_entity_display_name_trgm
  ON entity USING gin (display_name gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_relation_predicate_trgm
  ON relation USING gin (predicate gin_trgm_ops);

-- DOWN:
-- DROP INDEX IF EXISTS idx_entity_name_trgm;
-- DROP INDEX IF EXISTS idx_entity_display_name_trgm;
-- DROP INDEX IF EXISTS idx_relation_predicate_trgm;
-- pg_trgm extension 자체는 다른 인덱스가 의존할 수 있어 자동 DROP 하지 않는다.
