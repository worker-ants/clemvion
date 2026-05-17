/**
 * Mask sensitive values before they land in `meta.*` fields of run logs.
 *
 * Used by Variable Modification's opt-in `recordValues` flag (and reusable
 * for any future Logic node that wants to surface variable snapshots). The
 * default policy is conservative — when in doubt, mask — because run logs
 * are persisted, often visible to operators who didn't author the workflow,
 * and may be exfiltrated through observability pipelines.
 *
 * Three categories of mask:
 *   1. **Secret-named**: variables whose name matches a credential pattern
 *      (`password`, `token`, `apiKey`, `secret`, `auth`, ...) collapse to
 *      `'***'` regardless of the actual value type.
 *   2. **Oversized**: object / array values whose JSON encoding exceeds
 *      `MAX_INLINE_BYTES` collapse to `'[truncated:N bytes]'` so a single
 *      large variable doesn't bloat the run log.
 *   3. **Pass-through**: small primitives and bounded collections survive
 *      verbatim (after a structuredClone-style deep copy so later mutations
 *      don't reflect in the recorded snapshot).
 */

const SECRET_NAME_PATTERN =
  /(password|passwd|pwd|secret|token|apikey|api_key|authorization|auth_?token|bearer|credential|private_?key|client_?secret|refresh_?token)/i;

const MAX_INLINE_BYTES = 4096;

const MASK_SECRET = '***';

/**
 * Check whether a variable name looks like a credential / secret. Used to
 * collapse the value to `'***'` regardless of type.
 *
 * Conservative — false positives (`tokenCount`, `auth_state`) are
 * acceptable because the alternative (leaking a real secret) is far worse.
 * Workflow authors who need raw values can disable `recordValues` entirely.
 */
export function isSecretName(name: string): boolean {
  return SECRET_NAME_PATTERN.test(name);
}

/**
 * Render `value` for inclusion in `meta.*` fields, applying the masking
 * policy described in the module docstring.
 *
 * @param name - The variable name; if it matches the secret pattern the
 *   value collapses to `'***'`.
 * @param value - The variable value at snapshot time. Primitives pass
 *   through; objects / arrays are JSON-truncated when oversized; functions
 *   / symbols collapse to a placeholder.
 */
export function maskValueForLog(name: string, value: unknown): unknown {
  if (isSecretName(name)) return MASK_SECRET;
  return maskValue(value);
}

function maskValue(value: unknown): unknown {
  if (value === null || value === undefined) return value;

  const type = typeof value;
  if (type === 'string' || type === 'number' || type === 'boolean') {
    return value;
  }

  if (type === 'function' || type === 'symbol') {
    return `[unsupported:${type}]`;
  }

  // object / array
  let serialized: string;
  try {
    serialized = JSON.stringify(value);
  } catch {
    return '[unserialisable]';
  }

  if (serialized.length > MAX_INLINE_BYTES) {
    return `[truncated:${serialized.length} bytes]`;
  }

  // Deep clone via JSON round-trip so subsequent mutations to the live
  // variable don't reflect in the recorded snapshot.
  try {
    return JSON.parse(serialized);
  } catch {
    return '[unserialisable]';
  }
}
