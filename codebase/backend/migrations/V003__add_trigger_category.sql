-- flyway:nonTransactional
-- Add 'trigger' value to node_category enum for Manual Trigger start node
ALTER TYPE node_category ADD VALUE IF NOT EXISTS 'trigger' BEFORE 'logic';
