-- V013: User-facing OAuth (Google, GitHub) sign-in / sign-up state storage.
-- See: spec/2-navigation/10-auth-flow.md §5 (OAuth 소셜 로그인)

CREATE TABLE auth_oauth_state (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    state VARCHAR(64) NOT NULL UNIQUE,
    provider VARCHAR(32) NOT NULL,
    mode VARCHAR(16) NOT NULL CHECK (mode IN ('login', 'register')),
    remember_me BOOLEAN NOT NULL DEFAULT FALSE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_auth_oauth_state_expires ON auth_oauth_state (expires_at);

-- Enforce one-user-per-(provider, providerId) binding and accelerate
-- findByOauth() lookups during OAuth sign-in.
CREATE UNIQUE INDEX idx_user_oauth_provider
    ON "user" (oauth_provider, oauth_provider_id)
    WHERE oauth_provider IS NOT NULL;
