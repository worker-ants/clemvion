-- Sub-workflow execution: parent-child relationship and recursion depth tracking
ALTER TABLE execution ADD COLUMN parent_execution_id UUID REFERENCES execution(id) ON DELETE SET NULL;
ALTER TABLE execution ADD COLUMN recursion_depth INTEGER NOT NULL DEFAULT 0;
CREATE INDEX idx_execution_parent ON execution(parent_execution_id);
