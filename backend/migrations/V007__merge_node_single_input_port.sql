-- Merge node: consolidate multiple input ports (in_0, in_1, ...) into single 'in' port
UPDATE edge
SET target_port = 'in'
WHERE target_node_id IN (
    SELECT n.id FROM node n WHERE n.type = 'merge'
)
AND target_port LIKE 'in_%';

-- Remove obsolete inputCount from merge node configs
UPDATE node
SET config = config - 'inputCount'
WHERE type = 'merge'
AND config ? 'inputCount';
