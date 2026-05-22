/**
 * Conditional input constraint validator — shared between the cafe24 node
 * handler (`cafe24.handler.ts`) and the MCP tool provider
 * (`cafe24-mcp-tool-provider.ts`). Both call this immediately after the
 * `requiredFields` (AND) check; violations throw / surface as
 * `CAFE24_MISSING_FIELDS` to reuse the existing error code (avoids forcing
 * client/UI to learn a new code).
 *
 * Spec: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미"
 * + §6 step 8 (runtime validation entry).
 */

import type {
  Cafe24FieldConstraint,
  Cafe24OperationMetadata,
} from './types.js';

/** A value is "absent" if undefined, null, or empty string — same rule as `requiredFields` check. */
function isAbsent(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * Validate every constraint declared on `operation.constraints`. Returns
 * `null` on full satisfaction; otherwise a single human-readable message
 * describing the first violation. The first-only return is intentional —
 * the AI Agent / canvas user fixes one issue at a time, and concatenating
 * messages clutters the LLM context.
 */
export function validateCafe24Constraints(
  operation: Cafe24OperationMetadata,
  fields: Record<string, unknown>,
): string | null {
  if (!operation.constraints || operation.constraints.length === 0) {
    return null;
  }
  for (const c of operation.constraints) {
    const msg = checkOne(c, fields);
    if (msg) return msg;
  }
  return null;
}

function checkOne(
  c: Cafe24FieldConstraint,
  fields: Record<string, unknown>,
): string | null {
  if (c.kind === 'oneOf') {
    const anyPresent = c.fields.some((f) => !isAbsent(fields[f]));
    if (!anyPresent) {
      return `constraint violated: oneOf [${c.fields.join(', ')}] requires at least one of these fields to be provided`;
    }
    return null;
  }
  if (c.kind === 'allOrNone') {
    const present = c.fields.filter((f) => !isAbsent(fields[f]));
    if (present.length > 0 && present.length < c.fields.length) {
      const missing = c.fields.filter((f) => isAbsent(fields[f]));
      return `constraint violated: allOrNone [${c.fields.join(', ')}] — provided [${present.join(', ')}] but missing [${missing.join(', ')}] (all or none required)`;
    }
    return null;
  }
  // implies
  if (!isAbsent(fields[c.if])) {
    const missing = c.then.filter((f) => isAbsent(fields[f]));
    if (missing.length > 0) {
      return `constraint violated: implies — when "${c.if}" is provided, [${c.then.join(', ')}] are required (missing: [${missing.join(', ')}])`;
    }
  }
  return null;
}
