-- V005: Add document_chunk table with pgvector support
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE document_chunk (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    document_id UUID NOT NULL REFERENCES document(id) ON DELETE CASCADE,
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    chunk_index INTEGER NOT NULL,
    embedding vector(1536),
    token_count INTEGER NOT NULL DEFAULT 0,
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_document_chunk_document ON document_chunk(document_id);
CREATE INDEX idx_document_chunk_kb ON document_chunk(knowledge_base_id);
CREATE UNIQUE INDEX idx_document_chunk_unique ON document_chunk(document_id, chunk_index);

-- NOTE: Vector index (IVFFlat or HNSW) should be created after data is populated.
-- IVFFlat requires existing data to build cluster centroids properly.
-- Example: CREATE INDEX idx_document_chunk_embedding ON document_chunk USING hnsw (embedding vector_cosine_ops);
