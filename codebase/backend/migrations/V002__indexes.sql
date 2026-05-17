-- V002: Indexes based on spec/1-data-model.md section 3

-- Workflow indexes
CREATE INDEX idx_workflow_workspace_active ON workflow (workspace_id, is_active);
CREATE INDEX idx_workflow_workspace_name ON workflow (workspace_id, name);

-- Node indexes
CREATE INDEX idx_node_workflow ON node (workflow_id);
CREATE INDEX idx_node_container ON node (container_id) WHERE container_id IS NOT NULL;
CREATE INDEX idx_node_tool_owner ON node (tool_owner_id) WHERE tool_owner_id IS NOT NULL;

-- Edge indexes
CREATE INDEX idx_edge_workflow ON edge (workflow_id);
CREATE INDEX idx_edge_workflow_type ON edge (workflow_id, type);
CREATE INDEX idx_edge_source_node ON edge (source_node_id);

-- Execution indexes
CREATE INDEX idx_execution_workflow_started ON execution (workflow_id, started_at DESC);
CREATE INDEX idx_execution_status ON execution (status);

-- NodeExecution indexes
CREATE INDEX idx_node_execution_execution ON node_execution (execution_id);

-- Trigger indexes
CREATE INDEX idx_trigger_workspace_type ON trigger (workspace_id, type);
CREATE UNIQUE INDEX idx_trigger_workspace_endpoint ON trigger (workspace_id, endpoint_path)
    WHERE endpoint_path IS NOT NULL;

-- Schedule indexes
CREATE INDEX idx_schedule_next_run ON schedule (next_run_at, is_active) WHERE is_active = TRUE;

-- AuditLog indexes
CREATE INDEX idx_audit_log_workspace_created ON audit_log (workspace_id, created_at DESC);

-- Integration indexes
CREATE INDEX idx_integration_workspace_service ON integration (workspace_id, service_type);

-- Folder indexes
CREATE INDEX idx_folder_workspace_parent ON folder (workspace_id, parent_id);

-- Notification indexes
CREATE INDEX idx_notification_user_read_created ON notification (user_id, is_read, created_at DESC);
CREATE INDEX idx_notification_workspace_created ON notification (workspace_id, created_at DESC);

-- RefreshToken indexes
CREATE INDEX idx_refresh_token_user ON refresh_token (user_id);
CREATE INDEX idx_refresh_token_family ON refresh_token (family_id);
