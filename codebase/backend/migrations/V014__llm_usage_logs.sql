-- V014: LLM token usage logs
-- See: plan/stages/01-llm-token-usage.md

CREATE TABLE llm_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    workflow_id UUID REFERENCES workflow(id) ON DELETE SET NULL,
    execution_id UUID REFERENCES execution(id) ON DELETE SET NULL,
    node_execution_id UUID REFERENCES node_execution(id) ON DELETE SET NULL,
    llm_config_id UUID REFERENCES llm_config(id) ON DELETE SET NULL,
    provider VARCHAR(50) NOT NULL,
    model VARCHAR(100) NOT NULL,
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    cost_usd NUMERIC(12, 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_llm_usage_log_workspace_created_at
    ON llm_usage_log (workspace_id, created_at DESC);
CREATE INDEX idx_llm_usage_log_workflow_created_at
    ON llm_usage_log (workflow_id, created_at DESC)
    WHERE workflow_id IS NOT NULL;
CREATE INDEX idx_llm_usage_log_provider_model_created_at
    ON llm_usage_log (provider, model, created_at DESC);
