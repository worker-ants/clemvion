-- V086: agent_memory scope-list 정렬 인덱스 (workspace_id, scope_key, updated_at)
--
-- listScopes (admin 메모리 가시화, AGM-12 — `GET /agent-memories/scopes`) 는
-- WHERE workspace_id = $1 + GROUP BY scope_key 후 ORDER BY MAX(updated_at) DESC 로
-- scope 목록을 정렬한다. 기존 idx_agent_memory_scope (workspace_id, scope_key, created_at)
-- 는 회수·FIFO evict 용으로 created_at 만 커버해, scope 목록의 MAX(updated_at) 산출이
-- heap fetch + filesort 를 유발했다. 본 인덱스는 updated_at 을 포함해 scope 별
-- MAX(updated_at) 를 index-only scan 으로 커버한다 (회수/evict 경로의 created_at 인덱스와
-- 직교 — 둘 다 유지).
--
-- CREATE INDEX CONCURRENTLY 는 트랜잭션 안에서 실행할 수 없으므로 동봉된
-- V086__agent_memory_scope_updated_index.conf (executeInTransaction=false) 와 함께
-- 비-트랜잭션 모드로 실행한다 (대용량 테이블 무중단 배포 — 쓰기 락 회피).

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_agent_memory_scope_updated
  ON agent_memory(workspace_id, scope_key, updated_at);

-- DOWN:
-- DROP INDEX CONCURRENTLY IF EXISTS idx_agent_memory_scope_updated;
