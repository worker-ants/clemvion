-- V011: Schedule trigger input parameter values
-- See: spec/1-data-model.md §2.9, spec/4-nodes/7-trigger-nodes.md §2

ALTER TABLE schedule
    ADD COLUMN IF NOT EXISTS parameter_values JSONB NOT NULL DEFAULT '{}';
