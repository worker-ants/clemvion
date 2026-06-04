-- V080: agent_memory TTL 만료 컬럼 (AI Agent persistent 메모리 시간 기반 만료)
--
-- spec SoT: spec/5-system/17-agent-memory.md §4 (회수/forgetting — TTL), AGM-10
--
-- 기존 forgetting (scope 당 최신 N=1000 FIFO/LRU evict, V073) 에 더해 시간 기반
-- 만료 옵션을 추가한다. 노드 config `memoryTtlDays` 가 set 되면 저장 시점에
-- expires_at = now() + ttlDays 가 채워진다. NULL = 무만료 (디폴트, 기존 동작 보존).
--
-- 회수 SQL 은 (expires_at IS NULL OR expires_at > now()) 필터를, evict 는 만료 row
-- 삭제 (expires_at < now()) 를 추가한다 — AgentMemoryService recall/evict 참조.
--
-- partial index: 만료가 설정된 row 만 (expires_at IS NOT NULL) 색인해 evict 의
-- 만료 스캔을 가속한다. 무만료 row 가 다수인 일반 케이스에서 인덱스 크기를 최소화.

-- append-only 신규 nullable 컬럼 추가 — 기존 row 위배 0건 (NULL 디폴트), 락 영향 미미.
ALTER TABLE agent_memory ADD COLUMN expires_at TIMESTAMPTZ NULL;

-- 만료가 설정된 row 만 부분 색인 (evict 만료 스캔 가속, 무만료 row 제외로 인덱스 경량).
CREATE INDEX idx_agent_memory_expires_at ON agent_memory(expires_at)
  WHERE expires_at IS NOT NULL;

-- DOWN: (DESTRUCTIVE — 데이터 손실 동반)
-- DROP INDEX IF EXISTS idx_agent_memory_expires_at;
-- ALTER TABLE agent_memory DROP COLUMN IF EXISTS expires_at;
