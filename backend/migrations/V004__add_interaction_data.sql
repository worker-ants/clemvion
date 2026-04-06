-- Add interaction_data column to node_execution table
-- Stores user interaction records: form submissions, button clicks, etc.
ALTER TABLE node_execution ADD COLUMN interaction_data JSONB NULL;
