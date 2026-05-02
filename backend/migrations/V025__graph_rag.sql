-- V025: Graph RAG 도입 — KB 컬럼 확장 + entity/relation/chunk_entity 테이블
-- spec/5-system/10-graph-rag.md §2 의 데이터 모델 실현.

-- 1) knowledge_base 컬럼 확장
ALTER TABLE knowledge_base
  ADD COLUMN rag_mode TEXT NOT NULL DEFAULT 'vector',
  ADD COLUMN extraction_llm_config_id UUID NULL,
  ADD COLUMN max_hops INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN vector_seed_top_k INTEGER NOT NULL DEFAULT 5,
  ADD COLUMN expanded_chunk_limit INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN entity_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN relation_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN reextract_status TEXT NOT NULL DEFAULT 'idle';

ALTER TABLE knowledge_base
  ADD CONSTRAINT chk_kb_rag_mode CHECK (rag_mode IN ('vector', 'graph')),
  ADD CONSTRAINT chk_kb_max_hops CHECK (max_hops BETWEEN 1 AND 2),
  ADD CONSTRAINT chk_kb_reextract_status CHECK (reextract_status IN ('idle', 'in_progress')),
  ADD CONSTRAINT fk_kb_extraction_llm_config FOREIGN KEY (extraction_llm_config_id)
    REFERENCES llm_config(id) ON DELETE SET NULL;

-- 2) document.graph_extraction_status — graph 모드 KB 의 추출 진행 상태
ALTER TABLE document
  ADD COLUMN graph_extraction_status TEXT NOT NULL DEFAULT 'pending';
ALTER TABLE document
  ADD CONSTRAINT chk_doc_graph_extraction_status
    CHECK (graph_extraction_status IN ('pending', 'processing', 'completed', 'error'));

-- 3) entity — KB 단위로 dedup 되는 의미 단위
CREATE TABLE entity (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                 -- 정규화 이름 (소문자·trim)
  display_name TEXT NOT NULL,         -- 사용자 표시용 원형
  type TEXT NOT NULL,                 -- person/organization/concept/location/event/other
  description TEXT,
  mention_count INTEGER NOT NULL DEFAULT 0,
  last_seen_chunk_id UUID REFERENCES document_chunk(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_entity_type CHECK (type IN ('person', 'organization', 'concept', 'location', 'event', 'other')),
  CONSTRAINT uq_entity_kb_name_type UNIQUE (knowledge_base_id, name, type)
);
CREATE INDEX idx_entity_kb_type ON entity(knowledge_base_id, type);
CREATE INDEX idx_entity_kb_mention ON entity(knowledge_base_id, mention_count DESC);

-- 4) relation — entity 사이의 방향성 관계
CREATE TABLE relation (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
  head_entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  tail_entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  predicate TEXT NOT NULL,
  evidence_chunk_id UUID REFERENCES document_chunk(id) ON DELETE SET NULL,
  weight INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_relation_kb_head_pred_tail UNIQUE (knowledge_base_id, head_entity_id, predicate, tail_entity_id)
);
CREATE INDEX idx_relation_kb_head ON relation(knowledge_base_id, head_entity_id);
CREATE INDEX idx_relation_kb_tail ON relation(knowledge_base_id, tail_entity_id);

-- 5) chunk_entity — 청크가 언급한 entity 매핑 (Hybrid 검색 expansion 단계에서 사용)
CREATE TABLE chunk_entity (
  chunk_id UUID NOT NULL REFERENCES document_chunk(id) ON DELETE CASCADE,
  entity_id UUID NOT NULL REFERENCES entity(id) ON DELETE CASCADE,
  mention_text TEXT,
  PRIMARY KEY (chunk_id, entity_id)
);
CREATE INDEX idx_chunk_entity_entity ON chunk_entity(entity_id);
