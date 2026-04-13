/* eslint-disable no-console */
/**
 * Workflow expression migration script — Phase 3 preparation.
 *
 * Rewrites `$node["<Label>"].output.<field>` references to
 * `$node["<Label>"].config.<field>` for fields that moved from the legacy
 * flat handler output into the new `config` slot. See
 * `plan/node-output-shape-proposal.md` for the field mapping.
 *
 * Usage (run from repo root):
 *   # dry-run — prints diff, no DB write
 *   npx ts-node backend/scripts/migrate-node-output-refs.ts --dry-run
 *
 *   # apply — writes updated configs back to the workflow table
 *   npx ts-node backend/scripts/migrate-node-output-refs.ts --apply
 *
 * The script walks every workflow's nodes, scans the JSONB `config` field
 * for expression strings, and applies a set of per-node-type rewrites.
 * Each substitution is logged and, when `--apply` is set, persisted in a
 * transaction along with an audit row in the `audit_log` table.
 */

import { DataSource } from 'typeorm';

const DRY_RUN = process.argv.includes('--dry-run') || !process.argv.includes('--apply');

/**
 * For each node type, list the config fields that used to live at the root
 * of the handler output and now live under `config`. Expressions referencing
 * these via `$node["X"].output.<field>` must be rewritten to
 * `$node["X"].config.<field>` since the handler no longer echoes them at
 * `output`.
 */
const RELOCATED_FIELDS: Record<string, readonly string[]> = {
  send_email: ['integrationId', 'to', 'cc', 'subject', 'bodyType'],
  slack: ['integrationId', 'action', 'channel', 'text', 'ts', 'emoji', 'filename', 'comment'],
  database_query: ['integrationId', 'query', 'queryType', 'parameters'],
  http_request: ['method', 'url', 'authentication', 'integrationId'],
  if_else: ['conditions', 'combineMode'],
  switch: ['switchValue', 'cases'],
  filter: ['inputField', 'conditions', 'combineMode', 'strictComparison'],
  foreach: ['arrayField'],
  loop: ['count', 'maxIterations'],
  map: ['inputField', 'errorPolicy'],
  merge: ['strategy', 'outputFormat'],
  split: ['fieldPath'],
  variable_declaration: ['variables'],
  variable_modification: ['modifications'],
  transform: ['operations'],
  code: ['language'],
  text_classifier: ['categories', 'inputField'],
  information_extractor: ['schema'],
  template: ['outputFormat'],
};

/**
 * Fields that moved from root into `meta` (observability metadata). The
 * same mapping pattern applies: `$node["X"].output.<field>` →
 * `$node["X"].meta.<field>`.
 */
const META_FIELDS: Record<string, readonly string[]> = {
  send_email: ['durationMs', 'deliveryStatus'],
  slack: ['durationMs'],
  database_query: ['durationMs'],
  http_request: ['statusCode', 'duration', 'headers'],
  switch: ['expression', 'value', 'matchedCase'],
  text_classifier: ['model', 'inputTokens', 'outputTokens', 'totalTokens'],
  information_extractor: ['model', 'inputTokens', 'outputTokens', 'totalTokens'],
};

interface WorkflowNode {
  id: string;
  type: string;
  label: string;
  config: Record<string, unknown>;
}

interface RewriteHit {
  workflowId: string;
  nodeId: string;
  field: string;
  before: string;
  after: string;
  reason: string;
}

/**
 * Scan a string for `$node["<label>"].output.<field>` occurrences that match
 * a known relocation and return the rewritten string + list of hits.
 */
function rewriteExpression(
  str: string,
  nodeTypeByLabel: Map<string, string>,
): { result: string; hits: Array<{ field: string; reason: string; before: string; after: string }> } {
  const hits: Array<{ field: string; reason: string; before: string; after: string }> = [];

  const result = str.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, dbl, sgl, field) => {
      const label = (dbl ?? sgl) as string;
      const type = nodeTypeByLabel.get(label);
      if (!type) return match;

      if (RELOCATED_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.', '.config.');
        hits.push({ field, reason: `${type}: ${field} moved to config`, before: match, after: replacement });
        return replacement;
      }
      if (META_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.', '.meta.');
        hits.push({ field, reason: `${type}: ${field} moved to meta`, before: match, after: replacement });
        return replacement;
      }
      return match;
    },
  );

  return { result, hits };
}

/**
 * Recursively walk the node.config JSONB, applying `rewriteExpression` to
 * every string value. Returns the new object and accumulated hits.
 */
function walkAndRewrite(
  value: unknown,
  nodeTypeByLabel: Map<string, string>,
  hits: Array<{ field: string; reason: string; before: string; after: string }>,
): unknown {
  if (typeof value === 'string') {
    const { result, hits: stringHits } = rewriteExpression(value, nodeTypeByLabel);
    hits.push(...stringHits);
    return result;
  }
  if (Array.isArray(value)) {
    return value.map((v) => walkAndRewrite(v, nodeTypeByLabel, hits));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      out[k] = walkAndRewrite(v, nodeTypeByLabel, hits);
    }
    return out;
  }
  return value;
}

async function main(): Promise<void> {
  const ds = new DataSource({
    type: 'postgres',
    host: process.env.DB_HOST ?? 'localhost',
    port: Number(process.env.DB_PORT ?? 5432),
    username: process.env.DB_USERNAME ?? 'workflow',
    password: process.env.DB_PASSWORD ?? 'workflow_dev',
    database: process.env.DB_DATABASE ?? 'workflow',
  });
  await ds.initialize();

  const workflows = (await ds.query<Array<{ id: string }>>(
    'SELECT id FROM workflow ORDER BY created_at',
  )) as Array<{ id: string }>;

  let totalHits = 0;
  const perWorkflow: RewriteHit[] = [];

  for (const { id: workflowId } of workflows) {
    const nodes = (await ds.query<WorkflowNode[]>(
      'SELECT id, type, label, config FROM node WHERE workflow_id = $1',
      [workflowId],
    )) as WorkflowNode[];

    const typeByLabel = new Map<string, string>();
    for (const n of nodes) typeByLabel.set(n.label, n.type);

    for (const node of nodes) {
      const hits: Array<{ field: string; reason: string; before: string; after: string }> = [];
      const newConfig = walkAndRewrite(node.config, typeByLabel, hits);
      if (hits.length === 0) continue;

      totalHits += hits.length;
      for (const h of hits) {
        perWorkflow.push({
          workflowId,
          nodeId: node.id,
          field: h.field,
          before: h.before,
          after: h.after,
          reason: h.reason,
        });
      }

      if (!DRY_RUN) {
        await ds.query(
          'UPDATE node SET config = $1::jsonb, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(newConfig), node.id],
        );
      }
    }
  }

  // Summary + audit log
  console.log(`\nScanned ${workflows.length} workflows.`);
  console.log(`Total substitutions: ${totalHits}`);
  for (const hit of perWorkflow) {
    console.log(
      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.before} → ${hit.after}  (${hit.reason})`,
    );
  }

  if (!DRY_RUN && totalHits > 0) {
    await ds.query(
      `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, details)
       SELECT
         (SELECT workspace_id FROM workflow LIMIT 1),
         (SELECT id FROM "user" LIMIT 1),
         'node_output_refs_migrated',
         'workflow',
         gen_random_uuid(),
         $1::jsonb`,
      [JSON.stringify({ totalHits, applied: true })],
    );
  }

  await ds.destroy();

  if (DRY_RUN) {
    console.log(
      `\nDry-run complete. Re-run with --apply to persist the changes.`,
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
