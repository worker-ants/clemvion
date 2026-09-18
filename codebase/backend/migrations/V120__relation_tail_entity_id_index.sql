-- V120: relation (tail_entity_id) — FK relation_tail_entity_id_fkey (ON DELETE CASCADE)
--
-- spec/1-data-model.md §3 인덱스 전략 · ## Rationale «그래프 RAG 삭제 연쇄의 FK 인덱스 넷 (2026-09-18)»
-- spec/5-system/10-graph-rag.md §2.3 · §2.4 인덱스
-- 실측: plan/complete/spec-draft-graph-fk-indexes.md
--
-- entity · relation 의 기존 인덱스는 전부 knowledge_base_id 가 선두라, KB 를 모르는 FK 트리거 조회에 쓰이지 않거나
-- (last_seen_chunk_id · evidence_chunk_id — 전 테이블을 훑는다) skip scan 으로 KB 값마다 건너뛰며 쓰인다
-- (head_entity_id · tail_entity_id — KB 수에 비례. head 조회 계획을 KB 100 규모에서 봤다: Index Searches: 101).
--
-- 800k 청크 / 400k 엔티티 / 800k 관계 규모 실측 (PostgreSQL 18, V001~V116, 워밍 뒤 1회):
--   KB 하나 삭제 129,941 ms → 48.1 ms · 엔티티 하나 삭제 4.25 ms → 0.38 ms (V117~V120 넷을 둔 측정)
--   재임베딩(문서 하나, 청크 40) 1,795.7 ms → 2.37 ms (V117 · V118 둘을 둔 측정 — 이 경로는 head/tail 을 부르지 않는다)
--
-- V119 의 tail 쪽. 기존 (knowledge_base_id, tail_entity_id) 도 skip scan 으로 KB 수에 비례한다.
-- 800k: KB 삭제에서 606.4 ms → 4.4 ms (1,000회) · 엔티티 하나 삭제에서 1.93 ms → 0.05 ms. 크기 19 MB.
-- 쓰기 비용은 V118 과 합쳐 쟀다(V118 헤더).
--
-- 비-트랜잭션 (executeInTransaction=false, 동봉 .conf) — CREATE/DROP INDEX CONCURRENTLY 는 transaction
-- block 안에서 실행할 수 없다. CREATE 앞의 DROP 은 앞선 실패의 invalid 잔재 정리다 — IF NOT EXISTS 는 이름만
-- 봐서, 그것 없이는 repair 뒤 재실행이 invalid 인덱스를 건너뛰어 영영 유효해지지 않는다
-- (migrations/README.md §5 «신규 추가에도 0) 을 둡니다», 선례 V111~V116).
DROP INDEX CONCURRENTLY IF EXISTS idx_relation_tail_entity_id;
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_relation_tail_entity_id
  ON relation (tail_entity_id);

-- DOWN(수동 롤백 참고 — Flyway 자동 실행 아님): DROP INDEX CONCURRENTLY IF EXISTS idx_relation_tail_entity_id;
