-- V017: Workspace invitation tokens for unregistered users
-- See: plan/stages/04-team-workspace-ui.md (follow-up: invitation flow)
--
-- Existing addMemberByEmail() requires the user to already exist. This table
-- captures pending invitations addressed to an email so a not-yet-registered
-- person can later sign up and accept.

CREATE TABLE workspace_invitation (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL CHECK (role IN ('admin', 'editor', 'viewer')),
    -- Opaque single-use token sent in the invitation link.
    token VARCHAR(64) NOT NULL UNIQUE,
    invited_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    accepted_at TIMESTAMPTZ,
    accepted_by UUID REFERENCES "user"(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workspace_invitation_email ON workspace_invitation (email);
CREATE INDEX idx_workspace_invitation_workspace ON workspace_invitation (workspace_id);
-- Partial unique to prevent stacking unaccepted invitations for the same
-- (workspace, email). Once accepted/expired the row stays for audit but
-- doesn't block re-invitation.
CREATE UNIQUE INDEX idx_workspace_invitation_pending_unique
    ON workspace_invitation (workspace_id, email)
    WHERE accepted_at IS NULL;
