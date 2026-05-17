-- V001: Initial schema - 19 tables for Phase 1
-- Based on spec/1-data-model.md

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. User
-- ============================================================
CREATE TABLE "user" (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255),
    name VARCHAR(100) NOT NULL,
    avatar_url VARCHAR(500),
    locale VARCHAR(10) NOT NULL DEFAULT 'ko',
    theme VARCHAR(10) NOT NULL DEFAULT 'light' CHECK (theme IN ('light', 'dark')),
    two_factor_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    two_factor_secret VARCHAR(255),
    email_verified BOOLEAN NOT NULL DEFAULT FALSE,
    email_verify_token VARCHAR(255),
    email_verify_expires_at TIMESTAMPTZ,
    password_reset_token VARCHAR(255),
    password_reset_expires_at TIMESTAMPTZ,
    login_attempts INTEGER NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    oauth_provider VARCHAR(50),
    oauth_provider_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Workspace
-- ============================================================
CREATE TABLE workspace (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'team')),
    owner_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    slug VARCHAR(100) NOT NULL UNIQUE,
    settings JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 3. WorkspaceMember
-- ============================================================
CREATE TABLE workspace_member (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (role IN ('owner', 'admin', 'editor', 'viewer')),
    invited_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    joined_at TIMESTAMPTZ,
    UNIQUE (workspace_id, user_id)
);

-- ============================================================
-- 4. Folder
-- ============================================================
CREATE TABLE folder (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    parent_id UUID REFERENCES folder(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workspace_id, parent_id, name)
);

-- ============================================================
-- 5. Workflow
-- ============================================================
CREATE TABLE workflow (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    tags TEXT[] NOT NULL DEFAULT '{}',
    folder_id UUID REFERENCES folder(id) ON DELETE SET NULL,
    settings JSONB NOT NULL DEFAULT '{}',
    current_version INTEGER NOT NULL DEFAULT 1,
    created_by UUID NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 6. Node
-- ============================================================
CREATE TYPE node_category AS ENUM ('logic', 'flow', 'ai', 'integration', 'data', 'presentation');

CREATE TABLE node (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    category node_category NOT NULL,
    label VARCHAR(255) NOT NULL,
    position_x DOUBLE PRECISION NOT NULL DEFAULT 0,
    position_y DOUBLE PRECISION NOT NULL DEFAULT 0,
    config JSONB NOT NULL DEFAULT '{}',
    is_disabled BOOLEAN NOT NULL DEFAULT FALSE,
    description TEXT,
    container_id UUID REFERENCES node(id) ON DELETE SET NULL,
    tool_owner_id UUID REFERENCES node(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- container_id and tool_owner_id cannot both be set
    CONSTRAINT chk_node_placement CHECK (
        NOT (container_id IS NOT NULL AND tool_owner_id IS NOT NULL)
    )
);

-- ============================================================
-- 7. Edge
-- ============================================================
CREATE TYPE edge_type AS ENUM ('data', 'error');

CREATE TABLE edge (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    source_node_id UUID NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    source_port VARCHAR(100) NOT NULL DEFAULT 'out',
    target_node_id UUID NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    target_port VARCHAR(100) NOT NULL DEFAULT 'in',
    type edge_type NOT NULL DEFAULT 'data',
    condition JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    -- No self-loop
    CONSTRAINT chk_no_self_loop CHECK (source_node_id != target_node_id),
    -- No duplicate connections
    UNIQUE (source_node_id, source_port, target_node_id, target_port)
);

-- ============================================================
-- 8. Trigger
-- ============================================================
CREATE TABLE trigger (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('webhook', 'schedule', 'manual')),
    name VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    config JSONB NOT NULL DEFAULT '{}',
    endpoint_path VARCHAR(255),
    auth_config_id UUID,
    last_triggered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. Schedule
-- ============================================================
CREATE TABLE schedule (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    trigger_id UUID NOT NULL REFERENCES trigger(id) ON DELETE CASCADE,
    cron_expression VARCHAR(100) NOT NULL,
    timezone VARCHAR(100) NOT NULL DEFAULT 'Asia/Seoul',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ,
    last_run_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 10. Integration
-- ============================================================
CREATE TABLE integration (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    auth_type VARCHAR(20) NOT NULL CHECK (auth_type IN ('oauth2', 'api_key', 'bearer_token')),
    credentials JSONB NOT NULL DEFAULT '{}',
    scope VARCHAR(20) NOT NULL DEFAULT 'personal' CHECK (scope IN ('personal', 'organization')),
    status VARCHAR(20) NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'expired', 'error')),
    token_expires_at TIMESTAMPTZ,
    created_by UUID NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 11. AuthConfig
-- ============================================================
CREATE TABLE auth_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(20) NOT NULL CHECK (type IN ('api_key', 'bearer_token', 'basic_auth')),
    config JSONB NOT NULL DEFAULT '{}',
    ip_whitelist TEXT[],
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from trigger to auth_config (after auth_config table exists)
ALTER TABLE trigger ADD CONSTRAINT fk_trigger_auth_config
    FOREIGN KEY (auth_config_id) REFERENCES auth_config(id) ON DELETE SET NULL;

-- ============================================================
-- 12. Execution
-- ============================================================
CREATE TABLE execution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    trigger_id UUID REFERENCES trigger(id) ON DELETE SET NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'cancelled', 'waiting_for_input')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    input_data JSONB,
    output_data JSONB,
    error JSONB,
    executed_by UUID REFERENCES "user"(id),
    execution_path UUID[] NOT NULL DEFAULT '{}'
);

-- ============================================================
-- 13. NodeExecution
-- ============================================================
CREATE TABLE node_execution (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    execution_id UUID NOT NULL REFERENCES execution(id) ON DELETE CASCADE,
    node_id UUID NOT NULL REFERENCES node(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'running', 'completed', 'failed', 'skipped', 'waiting_for_input')),
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    duration_ms INTEGER,
    input_data JSONB NOT NULL DEFAULT '{}',
    output_data JSONB,
    error JSONB,
    retry_count INTEGER NOT NULL DEFAULT 0
);

-- ============================================================
-- 14. WorkflowVersion
-- ============================================================
CREATE TABLE workflow_version (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    snapshot JSONB NOT NULL,
    change_summary TEXT,
    created_by UUID NOT NULL REFERENCES "user"(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (workflow_id, version)
);

-- ============================================================
-- 15. KnowledgeBase (Phase 2, schema only)
-- ============================================================
CREATE TABLE knowledge_base (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    embedding_model VARCHAR(100) NOT NULL DEFAULT 'text-embedding-ada-002',
    chunk_size INTEGER NOT NULL DEFAULT 1000,
    chunk_overlap INTEGER NOT NULL DEFAULT 200,
    document_count INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 16. Document (Phase 2, schema only)
-- ============================================================
CREATE TABLE document (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    knowledge_base_id UUID NOT NULL REFERENCES knowledge_base(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    file_type VARCHAR(10) NOT NULL CHECK (file_type IN ('txt', 'md', 'pdf', 'csv')),
    file_url VARCHAR(500) NOT NULL,
    file_size INTEGER NOT NULL DEFAULT 0,
    embedding_status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (embedding_status IN ('pending', 'processing', 'completed', 'error')),
    chunk_count INTEGER NOT NULL DEFAULT 0,
    tags TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 17. LLMConfig (Phase 2, schema only)
-- ============================================================
CREATE TABLE llm_config (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    provider VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    api_key VARCHAR(500) NOT NULL,
    base_url VARCHAR(500),
    default_model VARCHAR(100) NOT NULL,
    default_params JSONB NOT NULL DEFAULT '{}',
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 18. AuditLog
-- ============================================================
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50) NOT NULL,
    resource_id UUID NOT NULL,
    details JSONB NOT NULL DEFAULT '{}',
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 19. Notification
-- ============================================================
CREATE TABLE notification (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id),
    type VARCHAR(50) NOT NULL
        CHECK (type IN ('execution_failed', 'background_failed', 'schedule_failed',
                        'integration_expired', 'marketplace_update', 'team_invite')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    channel VARCHAR(20) NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'both')),
    email_sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Refresh Token table (for token rotation)
-- ============================================================
CREATE TABLE refresh_token (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    token_hash VARCHAR(255) NOT NULL UNIQUE,
    family_id UUID NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Updated_at trigger function
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_user_updated_at BEFORE UPDATE ON "user" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_workspace_updated_at BEFORE UPDATE ON workspace FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_folder_updated_at BEFORE UPDATE ON folder FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_workflow_updated_at BEFORE UPDATE ON workflow FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_node_updated_at BEFORE UPDATE ON node FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_trigger_updated_at BEFORE UPDATE ON trigger FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_schedule_updated_at BEFORE UPDATE ON schedule FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_integration_updated_at BEFORE UPDATE ON integration FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_auth_config_updated_at BEFORE UPDATE ON auth_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_knowledge_base_updated_at BEFORE UPDATE ON knowledge_base FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_document_updated_at BEFORE UPDATE ON document FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER trg_llm_config_updated_at BEFORE UPDATE ON llm_config FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
