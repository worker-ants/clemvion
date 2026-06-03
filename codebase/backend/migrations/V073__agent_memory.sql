-- V073: agent_memory 테이블 (AI Agent persistent 메모리 영속 저장소)
-- requires pgvector (vector / halfvec) — V005 / V023 와 동일 extension 재사용
--
-- spec SoT: spec/5-system/17-agent-memory.md §1 (데이터 모델) · spec/1-data-model.md §2.23
--
-- pgvector 인프라를 DocumentChunk (V005/V021) 와 동일하게 재사용하되 KnowledgeBase 와는
-- 분리된 별도 테이블이다 (회수 대상·생명주기·forgetting 정책이 다름 — spec §Rationale).
--
-- embedding 컬럼은 DocumentChunk 와 동일하게 untyped vector (가변 차원) 로 둔다 (V021
-- 정책). 차원별 partial HNSW 유사도 인덱스는 CREATE INDEX CONCURRENTLY 로 부착해야 하므로
-- 본 트랜잭션 파일에는 두지 않고 차원당 별도 마이그레이션 (V074~V079, .conf
-- executeInTransaction=false) 으로 분리한다 (README §5 — 한 파일 한 CONCURRENTLY).

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE agent_memory (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    scope_key TEXT NOT NULL,
    content TEXT NOT NULL,
    embedding vector,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 스코프별 회수·evict 조회 (workspace 격리 강제 — spec §5 / 1-data-model §3 AgentMemory).
-- created_at 을 인덱스에 포함해 forgetting FIFO/LRU evict (오래된 순) 의 ORDER BY 를 가속.
CREATE INDEX idx_agent_memory_scope ON agent_memory(workspace_id, scope_key, created_at);

-- DOWN: (DESTRUCTIVE — 데이터 손실 동반)
-- DROP TABLE IF EXISTS agent_memory;
