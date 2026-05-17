-- Sub-workflow timeline hierarchy: track which Sub-Workflow node invocation each
-- NodeExecution belongs to, so the frontend run-results timeline can group
-- inline sub-workflow children under their parent Sub-Workflow row.
--
-- Applies to new executions only — existing node_execution rows stay NULL and
-- render flat (as they always did) in the history view.
--
-- ON DELETE SET NULL: preserve child execution history even when the parent
-- Sub-Workflow row is later deleted — losing the grouping is preferable to
-- cascading and erasing the child's output/inputs the user may still want
-- to inspect. Cycle prevention is guaranteed at the application layer by
-- the handler only stamping ids of rows that already exist (see
-- workflow.handler.ts), so there is no need for a CHECK constraint here.
ALTER TABLE node_execution
  ADD COLUMN parent_node_execution_id UUID REFERENCES node_execution(id) ON DELETE SET NULL;

-- Partial index: parent_node_execution_id is NULL for the vast majority of
-- rows (any run that never invokes a Sub-Workflow), so a full index would
-- waste storage and slow writes without improving read paths.
CREATE INDEX idx_node_execution_parent
  ON node_execution(parent_node_execution_id)
  WHERE parent_node_execution_id IS NOT NULL;

COMMENT ON COLUMN node_execution.parent_node_execution_id IS
  'NodeExecution.id of the Sub-Workflow (`workflow` type) row that invoked this node via inline execution. NULL for nodes that ran in the root workflow.';
