-- V009: OAuth preview store + integration expiry dispatch deduplication
-- See: spec/2-navigation/4-integration.md §10 (OAuth callback), §11 (Expiry scanner)

-- ============================================================
-- oauth_preview: holds short-lived OAuth state/tokens before
-- the user persists the integration (mode='new').
-- ============================================================
CREATE TABLE integration_oauth_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(64) NOT NULL UNIQUE,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    provider VARCHAR(32) NOT NULL,
    service_type VARCHAR(50) NOT NULL,
    mode VARCHAR(32) NOT NULL CHECK (mode IN ('new', 'reauthorize', 'request_scopes')),
    integration_id UUID REFERENCES integration(id) ON DELETE CASCADE,
    requested_scopes TEXT[] NOT NULL DEFAULT '{}',
    integration_name VARCHAR(255),
    scope VARCHAR(20),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_oauth_state_expires ON integration_oauth_state (expires_at);

-- After a successful token exchange, tokens are cached here (mode='new')
-- until the user calls POST /api/integrations with the preview_token.
CREATE TABLE integration_oauth_preview (
    preview_token VARCHAR(64) PRIMARY KEY,
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    service_type VARCHAR(50) NOT NULL,
    credentials JSONB NOT NULL,
    token_expires_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_integration_oauth_preview_expires ON integration_oauth_preview (expires_at);

-- ============================================================
-- integration_expiry_dispatch: de-duplicates expiry notifications
-- at each threshold (7d, 3d, 0d).
-- ============================================================
CREATE TABLE integration_expiry_dispatch (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    integration_id UUID NOT NULL REFERENCES integration(id) ON DELETE CASCADE,
    threshold VARCHAR(16) NOT NULL CHECK (threshold IN ('7d', '3d', '0d')),
    token_expires_at TIMESTAMPTZ NOT NULL,
    dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (integration_id, threshold, token_expires_at)
);
