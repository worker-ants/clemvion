-- V008: Integration metadata extension + IntegrationUsageLog
-- See: spec/2-navigation/4-integration.md §13, spec/1-data-model.md §2.10, §2.10.1

-- ============================================================
-- Integration: add metadata columns
-- ============================================================
ALTER TABLE integration
    ADD COLUMN IF NOT EXISTS status_reason VARCHAR(64),
    ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_rotated_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS last_error JSONB;

-- Expand auth_type check to include new auth types declared in spec §5
ALTER TABLE integration DROP CONSTRAINT IF EXISTS integration_auth_type_check;
ALTER TABLE integration ADD CONSTRAINT integration_auth_type_check
    CHECK (auth_type IN (
        'oauth2',
        'api_key',
        'bearer_token',
        'basic',
        'connection_string',
        'smtp',
        'webhook_outbound'
    ));

-- Alias uniqueness within a workspace
-- NOTE: if duplicate (workspace_id, name) rows already exist, this migration
-- will fail. Run the following query before applying to detect conflicts:
--
--   SELECT workspace_id, name, COUNT(*)
--   FROM integration
--   GROUP BY workspace_id, name
--   HAVING COUNT(*) > 1;
--
-- Resolve duplicates (rename or delete) before proceeding.
ALTER TABLE integration
    ADD CONSTRAINT integration_workspace_name_unique UNIQUE (workspace_id, name);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_integration_workspace_status
    ON integration (workspace_id, status);
CREATE INDEX IF NOT EXISTS idx_integration_token_expires_at
    ON integration (token_expires_at)
    WHERE token_expires_at IS NOT NULL;

-- ============================================================
-- IntegrationUsageLog: per-call activity log
-- ============================================================
CREATE TABLE integration_usage_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES integration(id) ON DELETE CASCADE,
    node_execution_id UUID NOT NULL REFERENCES node_execution(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    status VARCHAR(16) NOT NULL CHECK (status IN ('success', 'failed')),
    error JSONB,
    duration_ms INTEGER NOT NULL DEFAULT 0,
    at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_usage_log_integration_at
    ON integration_usage_log (integration_id, at DESC);
CREATE INDEX idx_integration_usage_log_at
    ON integration_usage_log (at);
