-- LLM Config: enforce a single `is_default = true` row per workspace.
--
-- Runtime (create/update/setDefault) already wraps the default-swap in a
-- transaction, but that only prevents races between requests served by the
-- same Node process. A partial unique index ensures the invariant even under
-- concurrent DB writers (multiple app pods, background jobs, hotfix scripts).
--
-- Prerequisite — confirm no existing duplicates before running:
--
--   SELECT workspace_id, COUNT(*)
--   FROM llm_config
--   WHERE is_default = true
--   GROUP BY workspace_id
--   HAVING COUNT(*) > 1;
--
-- If the query returns rows, resolve them manually (pick the intended
-- default, set others to false) before applying the index.

-- Run outside a transaction so the CONCURRENTLY option can take effect on
-- live tables without blocking writes. psql: `\i` at top level works; inside
-- migration tooling, use a runner that supports non-transactional statements.

CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS llm_config_workspace_default_unique
  ON llm_config (workspace_id)
  WHERE is_default = true;

-- ROLLBACK (if the index needs to be removed):
--
--   DROP INDEX CONCURRENTLY IF EXISTS llm_config_workspace_default_unique;
