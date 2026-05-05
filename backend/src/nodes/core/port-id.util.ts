/**
 * Stable dynamic-port id helpers shared by:
 *   - node handlers (e.g. text-classifier, switch) that route by index → port id
 *   - workflow-assistant resolver that publishes runtime ports to the LLM
 *
 * Both layers must agree on the id every entry produces, otherwise edges and
 * router decisions diverge (silent breakage). The regex mirrors the schema
 * constraint (`switch.caseDefSchema.id`, `categoryDefSchema.id`) so that
 * defense-in-depth holds even when input bypasses Zod (DB seed, migration,
 * direct service call).
 *
 * Frontend has a sibling `frontend/src/lib/node-definitions/resolve-dynamic-ports.ts`
 * that intentionally inlines the same rule — keep all three call sites in sync.
 */

/** Slug allowed for any user/LLM-supplied dynamic-port id (a-zA-Z0-9_-, ≤ 64). */
export const PORT_ID_SLUG_REGEX = /^[a-zA-Z0-9_-]{1,64}$/;

/**
 * Returns `id` (after `trim()`) if it is a valid slug; otherwise `fallback`.
 *
 * Why we re-validate here even though Zod already enforces the regex on
 * insert: the resolver and handlers are sometimes hit with raw config from
 * legacy workflows, scripts, or imports that did not pass through the schema.
 * A bad id silently becoming the routing key is much harder to debug than
 * just falling through to the index-based slot.
 */
export function resolveStablePortId(id: unknown, fallback: string): string {
  if (typeof id !== 'string') return fallback;
  const trimmed = id.trim();
  if (trimmed.length === 0) return fallback;
  if (!PORT_ID_SLUG_REGEX.test(trimmed)) return fallback;
  return trimmed;
}
