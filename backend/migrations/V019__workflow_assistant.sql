-- V019: Workflow AI Assistant — chat sessions and messages
-- See: spec/3-workflow-editor/4-ai-assistant.md, spec/1-data-model.md §2.20~2.21
--
-- Persists the Workflow AI Assistant's Clarify/Plan/Execute conversation per
-- workflow so that users can reload the editor and resume their chat. The
-- Assistant never writes workflow nodes/edges itself — those go through the
-- existing editor-store + save-canvas flow — so these tables are purely a
-- chat history surface.

CREATE TABLE workflow_assistant_session (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    workspace_id UUID NOT NULL REFERENCES workspace(id) ON DELETE CASCADE,
    workflow_id UUID NOT NULL REFERENCES workflow(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES "user"(id) ON DELETE CASCADE,
    -- Auto-derived from first user message (trimmed to 40 chars); users may edit
    -- later via PATCH.
    title VARCHAR(255),
    -- Optional explicit LLM config. NULL = use workspace default at request time.
    llm_config_id UUID REFERENCES llm_config(id) ON DELETE SET NULL,
    -- `archived` is hidden from the default session list UI.
    status VARCHAR(20) NOT NULL DEFAULT 'active'
        CHECK (status IN ('active', 'archived')),
    -- Denormalized for fast list rendering; kept in sync on message insert.
    message_count INTEGER NOT NULL DEFAULT 0,
    last_interaction_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Covers `findLatestActive(workspace, user, workflow, status='active' order by
-- last_interaction_at desc)` — the primary lookup executed on every panel open.
CREATE INDEX idx_workflow_assistant_session_wf_user_active
    ON workflow_assistant_session (workflow_id, user_id, status, last_interaction_at DESC);
-- For listing a user's recent sessions across all workflows.
CREATE INDEX idx_workflow_assistant_session_user_recent
    ON workflow_assistant_session (workspace_id, user_id, updated_at DESC);

CREATE TABLE workflow_assistant_message (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES workflow_assistant_session(id) ON DELETE CASCADE,
    -- `user` and `assistant` are what the Clarify/Plan/Execute loop produces.
    -- `tool` is accepted by the check so that future turns persisting
    -- tool_result rows don't require a follow-up migration, but current code
    -- paths do not write them (tool feedback is re-assembled from
    -- `assistant.tool_calls[].result` when rehydrating).
    role VARCHAR(20) NOT NULL
        CHECK (role IN ('user', 'assistant', 'tool')),
    -- Text body for user/assistant. tool messages may store a JSON result
    -- string instead.
    content TEXT,
    -- Assistant tool calls emitted during this turn. Each entry:
    --   { id, name, arguments, kind: 'explore'|'plan'|'edit', result, planStepId? }
    tool_calls JSONB,
    -- When role=tool, references the tool_call id this row is resolving.
    tool_call_id VARCHAR(255),
    -- Snapshot for role=assistant turns that emitted `propose_plan`.
    -- Shape: { title, summary, steps[], openQuestions[], approvedAt? }
    plan JSONB,
    -- Populated on assistant turn completion.
    usage JSONB,
    finish_reason VARCHAR(30),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_workflow_assistant_message_session_time
    ON workflow_assistant_message (session_id, created_at ASC);
