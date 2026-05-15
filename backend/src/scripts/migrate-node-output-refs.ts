/**
 * Workflow expression migration script — Phase 3 preparation.
 *
 * Rewrites `$node["<Label>"].output.<field>` references to
 * `$node["<Label>"].config.<field>` for fields that moved from the legacy
 * flat handler output into the new `config` slot. See
 * `plan/node-output-shape-proposal.md` for the field mapping.
 *
 * Usage (run from repo root OR backend/ — `backend/.env` is auto-loaded):
 *
 *   # dry-run — prints diff, no DB write
 *   npx ts-node backend/src/scripts/migrate-node-output-refs.ts --dry-run
 *
 *   # apply — requires workspace/user ids for the audit_log row
 *   npx ts-node backend/src/scripts/migrate-node-output-refs.ts --apply \
 *     --workspace-id <uuid> --user-id <uuid>
 *
 * Inline env override (skips `.env`):
 *   DB_PASSWORD=… npx ts-node backend/src/scripts/migrate-node-output-refs.ts --apply …
 *
 * The script walks every workflow's nodes, scans the JSONB `config` field
 * for expression strings, and applies a set of per-node-type rewrites.
 * Each substitution is logged and, when `--apply` is set, persisted in a
 * transaction along with an audit row in the `audit_log` table.
 */

import * as path from 'path';
import * as dotenv from 'dotenv';
import { DataSource } from 'typeorm';

// Load `backend/.env` relative to this script so the CLI works from any
// CWD (repo root, backend/, CI runner). `dotenv.config` does NOT override
// values already present in process.env, so CI / Docker env injection and
// inline `DB_PASSWORD=… npx ts-node …` overrides keep working.
{
  const envPath = path.resolve(__dirname, '..', '..', '.env');
  const result = dotenv.config({ path: envPath });
  if (result.error && require.main === module) {
    console.warn(
      `[migrate-node-output-refs] .env not loaded at ${envPath} (${result.error.message}) — relying on process.env only.`,
    );
  }
}

const DRY_RUN =
  process.argv.includes('--dry-run') || !process.argv.includes('--apply');

/** Parse a `--flag=value` or `--flag value` pair from argv. */
function parseCliFlag(name: string): string | undefined {
  const eqIdx = process.argv.findIndex((a) => a.startsWith(`${name}=`));
  if (eqIdx >= 0) return process.argv[eqIdx].split('=', 2)[1];
  const flagIdx = process.argv.indexOf(name);
  if (flagIdx >= 0 && flagIdx < process.argv.length - 1) {
    return process.argv[flagIdx + 1];
  }
  return undefined;
}

const CLI_WORKSPACE_ID = parseCliFlag('--workspace-id');
const CLI_USER_ID = parseCliFlag('--user-id');

/**
 * For each node type, list the config fields that used to live at the root
 * of the handler output and now live under `config`. Expressions referencing
 * these via `$node["X"].output.<field>` must be rewritten to
 * `$node["X"].config.<field>` since the handler no longer echoes them at
 * `output`.
 */
export const RELOCATED_FIELDS: Record<string, readonly string[]> = {
  send_email: ['integrationId', 'to', 'cc', 'subject', 'bodyType'],
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
  // `categories` is NOT here — the runtime matched categories live on
  // `output.result.categories` (see RESULT_FIELDS.text_classifier), while
  // the author-declared schema stays on `config.categories` and is
  // addressed directly by existing workflow authors.
  text_classifier: ['inputField'],
  information_extractor: ['schema', 'maxCollectionRetries'],
  template: ['outputFormat', 'format'],
  // Presentation literal config fields — Stage 3 (Principle 1.1).
  form: ['title', 'submitLabel', 'fields'],
  carousel: [
    'layout',
    'titleField',
    'descriptionField',
    'imageField',
    // static carousel items literal — dynamic carousel's resolved items
    // stay at output.items and should NOT be rewritten. The script only
    // has access to the node type, not the mode; however, if the expression
    // targets `items` on a carousel that's in dynamic mode, the rewrite is
    // wrong. Operators must review carousel hits manually via the audit log.
  ],
  chart: ['chartType', 'title', 'xAxis', 'yAxis'],
  table: ['columns', 'pageSize', 'sortBy', 'sortOrder'],
};

/**
 * Fields that moved from root into `meta` (observability metadata). The
 * same mapping pattern applies: `$node["X"].output.<field>` →
 * `$node["X"].meta.<field>`.
 */
export const META_FIELDS: Record<string, readonly string[]> = {
  send_email: ['durationMs', 'deliveryStatus'],
  database_query: ['durationMs'],
  http_request: ['statusCode', 'duration', 'headers'],
  switch: ['expression', 'value', 'matchedCase'],
  text_classifier: ['model', 'inputTokens', 'outputTokens', 'totalTokens'],
  information_extractor: [
    'model',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'thinkingTokens',
    'collectionRetryCount',
  ],
  // ai_agent post-Stage-5: tokens / tool call count / RAG sources move from
  // `output.metadata.*` to the top-level `meta.*`.
  ai_agent: [
    'model',
    'inputTokens',
    'outputTokens',
    'totalTokens',
    'thinkingTokens',
    'toolCalls',
    'ragSources',
  ],
};

/**
 * Fields that moved **into `output.result.*`** (LLM-category convention,
 * CONVENTIONS §8). The rewrite shape is
 * `$node["X"].output.<field>` → `$node["X"].output.result.<field>`.
 * Used for information_extractor's post-Stage-1 shape.
 */
export const RESULT_FIELDS: Record<string, readonly string[]> = {
  information_extractor: [
    'extracted',
    'messages',
    'endReason',
    'turnCount',
    'originalInput',
  ],
  // ai_agent post-Stage-5: single-turn / multi-turn / condition all surface
  // domain data under `output.result.*`.
  ai_agent: ['response', 'messages', 'endReason', 'turnCount', 'condition'],
  // text_classifier post-Stage-5: `category`/`categories`/`confidence`/
  // `originalInput` live under `output.result.*`.
  text_classifier: ['category', 'categories', 'confidence', 'originalInput'],
};

/**
 * Fields that were renamed inside `output` (same nesting, new key). Applied
 * as a final substring replacement after the structural passes above.
 */
export const RENAMED_OUTPUT_FIELDS: Record<
  string,
  ReadonlyArray<readonly [string, string]>
> = {
  // Template handler now exposes the resolved string as `rendered` (matching
  // table/carousel's runtime-rendered HTML field).
  template: [['content', 'rendered']],
  // Form submission data moved under the unified interaction envelope.
  form: [['submittedData', 'interaction.data']],
};

/**
 * Fields that were renamed inside `meta` (same nesting, new key). Applied
 * after the structural passes. The shape is `meta.<from>` → `meta.<to>` —
 * scoped per node type so unrelated nodes that happen to expose `meta.<from>`
 * keep working.
 */
export const RENAMED_META_FIELDS: Record<
  string,
  ReadonlyArray<readonly [string, string]>
> = {
  // D4 (logic-node-followups): `meta.value` was kept as a deprecated alias
  // when the canonical field was renamed to `meta.resolvedValue`. The alias
  // is now removed; rewrite any lingering references.
  switch: [['value', 'resolvedValue']],
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
 *
 * Passes:
 *  1. Double-nested legacy path `$node["X"].output.output.<f>` →
 *     `$node["X"].output.result.<f>` (information_extractor pre Stage 1).
 *  2. Double-nested legacy meta `$node["X"].output.meta.<f>` →
 *     `$node["X"].meta.<f>` (legacy port-selector shape).
 *  3. Double-nested legacy config `$node["X"].output.config.<f>` →
 *     `$node["X"].config.<f>`.
 *  4. Single-level `$node["X"].output.<f>` mappings against
 *     RELOCATED_FIELDS / META_FIELDS / RESULT_FIELDS.
 *
 * Passes 1–3 are idempotent; pass 4 is idempotent only when a field is not
 * simultaneously in RELOCATED_FIELDS and the string still references
 * `.output.<f>` (second run is a no-op since the first already rewrote).
 */
export interface RewriteHitDetail {
  field: string;
  reason: string;
  before: string;
  after: string;
}

export function rewriteExpression(
  str: string,
  nodeTypeByLabel: Map<string, string>,
): { result: string; hits: RewriteHitDetail[] } {
  const hits: RewriteHitDetail[] = [];

  // Pass 1: `$node["X"].output.output.<field>` → resolve based on node type
  //   information_extractor: move into `output.result.<field>` when the field
  //   is a known result field, into `meta.<field>` when it's a metric, else
  //   keep the inner `.output.` so the fix surfaces in the audit log.
  let current = str.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.output\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, dbl, sgl, field) => {
      const label = (dbl ?? sgl) as string;
      const type = nodeTypeByLabel.get(label);
      if (!type) return match;

      if (META_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.output.', '.meta.');
        hits.push({
          field,
          reason: `${type}: ${field} double-nested → meta`,
          before: match,
          after: replacement,
        });
        return replacement;
      }
      if (RESULT_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.output.', '.output.result.');
        hits.push({
          field,
          reason: `${type}: ${field} double-nested → output.result`,
          before: match,
          after: replacement,
        });
        return replacement;
      }
      // Unrecognised double-nested field — record an audit hit so the
      // operator notices (e.g. `_turnDebugHistory`, `_llmCalls`, `error`).
      hits.push({
        field,
        reason: `${type}: double-nested .output.output.${field} — manual review needed`,
        before: match,
        after: match,
      });
      return match;
    },
  );

  // Pass 2: `$node["X"].output.meta.<field>` → `$node["X"].meta.<field>`.
  current = current.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.meta\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, _dbl, _sgl, field) => {
      const replacement = match.replace('.output.meta.', '.meta.');
      hits.push({
        field,
        reason: `nested .output.meta.${field} → meta`,
        before: match,
        after: replacement,
      });
      return replacement;
    },
  );

  // Pass 3: `$node["X"].output.config.<field>` → `$node["X"].config.<field>`.
  current = current.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.config\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, _dbl, _sgl, field) => {
      const replacement = match.replace('.output.config.', '.config.');
      hits.push({
        field,
        reason: `nested .output.config.${field} → config`,
        before: match,
        after: replacement,
      });
      return replacement;
    },
  );

  // Pass 4: single-level `$node["X"].output.<field>`.
  current = current.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, dbl, sgl, field) => {
      // Skip if it's actually `.output.output.<f>` / `.output.meta.<f>` /
      // `.output.config.<f>` / `.output.result.<f>` — those are structural
      // sub-paths the handler now emits and must not be rewritten again.
      if (
        field === 'output' ||
        field === 'meta' ||
        field === 'config' ||
        field === 'result' ||
        field === 'error' ||
        field === 'interaction' ||
        field === 'partial'
      ) {
        return match;
      }
      const label = (dbl ?? sgl) as string;
      const type = nodeTypeByLabel.get(label);
      if (!type) return match;

      // Discriminator `output.type === 'carousel' | 'table' | ...` is dropped
      // in Stage 3 (Principle 1.1.4). Record a warning so the operator can
      // review and either remove the branch or compare against `$node["X"]`
      // presence instead.
      if (
        field === 'type' &&
        (type === 'carousel' ||
          type === 'table' ||
          type === 'chart' ||
          type === 'template' ||
          type === 'form')
      ) {
        hits.push({
          field,
          reason: `${type}: output.type discriminator dropped — manual review (Principle 1.1.4)`,
          before: match,
          after: match,
        });
        return match;
      }

      if (RELOCATED_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.', '.config.');
        hits.push({
          field,
          reason: `${type}: ${field} moved to config`,
          before: match,
          after: replacement,
        });
        return replacement;
      }
      if (META_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.', '.meta.');
        hits.push({
          field,
          reason: `${type}: ${field} moved to meta`,
          before: match,
          after: replacement,
        });
        return replacement;
      }
      if (RESULT_FIELDS[type]?.includes(field)) {
        const replacement = match.replace('.output.', '.output.result.');
        hits.push({
          field,
          reason: `${type}: ${field} moved to output.result`,
          before: match,
          after: replacement,
        });
        return replacement;
      }

      // Intra-output rename (e.g. `template.content` → `template.rendered`,
      // `form.submittedData` → `form.interaction.data`). The rename table
      // may substitute multi-segment paths (e.g. 'interaction.data'), which
      // the regex only captured as `field` — we embed the replacement
      // segment verbatim in the rewritten expression.
      const renames = RENAMED_OUTPUT_FIELDS[type];
      if (renames) {
        const rename = renames.find(([from]) => from === field);
        if (rename) {
          const [from, to] = rename;
          const replacement = match.replace(`.output.${from}`, `.output.${to}`);
          hits.push({
            field,
            reason: `${type}: output.${from} renamed to output.${to}`,
            before: match,
            after: replacement,
          });
          return replacement;
        }
      }
      return match;
    },
  );

  // Pass 4b: `$node["X"].meta.<from>` → `$node["X"].meta.<to>` per
  // RENAMED_META_FIELDS. Idempotent because the regex only fires on the
  // legacy key.
  current = current.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.meta\.([A-Za-z_][A-Za-z0-9_]*)/g,
    (match, dbl, sgl, field) => {
      const label = (dbl ?? sgl) as string;
      const type = nodeTypeByLabel.get(label);
      if (!type) return match;
      const renames = RENAMED_META_FIELDS[type];
      if (!renames) return match;
      const rename = renames.find(([from]) => from === field);
      if (!rename) return match;
      const [from, to] = rename;
      const replacement = match.replace(`.meta.${from}`, `.meta.${to}`);
      hits.push({
        field,
        reason: `${type}: meta.${from} renamed to meta.${to}`,
        before: match,
        after: replacement,
      });
      return replacement;
    },
  );

  // Pass 5: status literal transitions. Stage 3 unifies `submitted` /
  // `button_click` / `button_continue` into `resumed`, with the original
  // semantics preserved via `output.interaction.type`.
  current = current.replace(
    /\.status\s*(===|==)\s*['"](submitted|button_click|button_continue)['"]/g,
    (match, op, status) => {
      const replacement = match.replace(
        /['"](submitted|button_click|button_continue)['"]/,
        "'resumed'",
      );
      hits.push({
        field: 'status',
        reason: `status '${status}' unified to 'resumed' (Stage 3) — verify matching output.interaction.type === '${status}' branch`,
        before: match,
        after: replacement,
      });
      return replacement;
    },
  );

  // Pass 6 (audit-only): legacy error envelope fields that were removed
  // from the error-handling spec cannot be safely rewritten — the operator
  // must review and migrate manually.
  current.replace(
    /\$node\[(?:"([^"]+)"|'([^']+)')\]\.output\.error\.(nodeId|nodeType|timestamp|originalInput)\b/g,
    (match, _dbl, _sgl, field) => {
      hits.push({
        field,
        reason: `legacy output.error.${field} removed — move to output.error.details.${field === 'originalInput' ? 'originalInput' : field} or inspect NodeExecution row`,
        before: match,
        after: match,
      });
      return match;
    },
  );

  return { result: current, hits };
}

/**
 * Recursively walk the node.config JSONB, applying `rewriteExpression` to
 * every string value. Returns the new object and accumulated hits.
 */
export function walkAndRewrite(
  value: unknown,
  nodeTypeByLabel: Map<string, string>,
  hits: RewriteHitDetail[],
): unknown {
  if (typeof value === 'string') {
    const { result, hits: stringHits } = rewriteExpression(
      value,
      nodeTypeByLabel,
    );
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

  // Single JOIN query replaces the legacy N+1 per-workflow fetch —
  // one round-trip regardless of how many workflows the workspace has.
  const rows = (await ds.query<
    Array<{
      workflow_id: string;
      id: string;
      type: string;
      label: string;
      config: Record<string, unknown>;
    }>
  >(
    `SELECT w.id AS workflow_id, n.id, n.type, n.label, n.config
       FROM workflow w
       JOIN node n ON n.workflow_id = w.id
      ORDER BY w.created_at, n.id`,
  )) as Array<{
    workflow_id: string;
    id: string;
    type: string;
    label: string;
    config: Record<string, unknown>;
  }>;

  // Group rows by workflow so label→type lookup stays workflow-scoped:
  // two workflows in the same workspace may legitimately use the same
  // label for different node types.
  const nodesByWorkflow = new Map<string, WorkflowNode[]>();
  for (const row of rows) {
    const bucket = nodesByWorkflow.get(row.workflow_id) ?? [];
    bucket.push({
      id: row.id,
      type: row.type,
      label: row.label,
      config: row.config,
    });
    nodesByWorkflow.set(row.workflow_id, bucket);
  }

  let totalHits = 0;
  const perWorkflow: RewriteHit[] = [];
  // Pre-compute all rewrites in memory so the APPLY phase can run inside a
  // single transaction — partial application would leave some node.config
  // on the new expression paths while others are still on the legacy ones.
  const pendingUpdates: Array<{ nodeId: string; newConfig: unknown }> = [];

  for (const [workflowId, nodes] of nodesByWorkflow) {
    const typeByLabel = new Map<string, string>();
    for (const n of nodes) typeByLabel.set(n.label, n.type);

    for (const node of nodes) {
      const hits: RewriteHitDetail[] = [];
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
      pendingUpdates.push({ nodeId: node.id, newConfig });
    }
  }

  // Summary (always printed — dry-run users rely on the full log)
  console.log(`\nScanned ${nodesByWorkflow.size} workflows.`);
  console.log(`Total substitutions: ${totalHits}`);
  for (const hit of perWorkflow) {
    console.log(
      `  [${DRY_RUN ? 'DRY' : 'APPLY'}] wf=${hit.workflowId} node=${hit.nodeId} ${hit.before} → ${hit.after}  (${hit.reason})`,
    );
  }

  if (!DRY_RUN && pendingUpdates.length > 0) {
    if (!CLI_WORKSPACE_ID || !CLI_USER_ID) {
      throw new Error(
        '--apply requires --workspace-id <uuid> and --user-id <uuid> so the audit_log row is attributable. Re-run with both flags.',
      );
    }
    // Re-run safety: the rewriter itself is idempotent (passes 1–4 skip
    // already-migrated paths and pass 6 is audit-only), so a double
    // `--apply` will simply produce zero hits. But we still emit one
    // audit_log row per apply run so repeat runs can be traced. Tag the
    // row with a UTC timestamp so operators can see re-runs at a glance.
    await ds.transaction(async (manager) => {
      for (const update of pendingUpdates) {
        await manager.query(
          'UPDATE node SET config = $1::jsonb, updated_at = NOW() WHERE id = $2',
          [JSON.stringify(update.newConfig), update.nodeId],
        );
      }
      if (totalHits > 0) {
        await manager.query(
          `INSERT INTO audit_log (workspace_id, user_id, action, resource_type, resource_id, details)
           VALUES ($1, $2, 'node_output_refs_migrated', 'workflow', gen_random_uuid(), $3::jsonb)`,
          [
            CLI_WORKSPACE_ID,
            CLI_USER_ID,
            JSON.stringify({
              totalHits,
              applied: true,
              nodesUpdated: pendingUpdates.length,
              appliedAt: new Date().toISOString(),
            }),
          ],
        );
      }
    });
  }

  await ds.destroy();

  if (DRY_RUN) {
    console.log(
      `\nDry-run complete. Re-run with --apply to persist the changes.`,
    );
  }
}

// Only auto-run when executed as a script. Jest / unit tests that `import`
// this module to exercise `rewriteExpression` would otherwise open a DB
// connection at load time.
if (require.main === module) {
  main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
}
