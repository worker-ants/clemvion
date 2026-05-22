/**
 * Conditional input constraint validator — shared between the cafe24 node
 * handler (`cafe24.handler.ts`) and the MCP tool provider
 * (`cafe24-mcp-tool-provider.ts`). Both call this immediately after the
 * `requiredFields` (AND) check; violations surface as `CAFE24_MISSING_FIELDS`
 * to reuse the existing error code (avoids forcing client/UI to learn a new
 * one — see `CAFE24_MISSING_FIELDS_CODE` export).
 *
 * Spec: `spec/conventions/cafe24-api-metadata.md` §2 "constraints 의 의미"
 * + §6 step 5 (조건부 제약 확인 entry).
 */

import type {
  Cafe24FieldConstraint,
  Cafe24OperationMetadata,
} from './types.js';

/**
 * Shared error code constant. Handler and MCP both surface constraint
 * violations under this code so the existing client/UI mapping ("missing
 * required field(s)") covers both the AND-only `requiredFields` violation
 * and the conditional `constraints?` violations.
 */
export const CAFE24_MISSING_FIELDS_CODE = 'CAFE24_MISSING_FIELDS' as const;

/**
 * A value is "absent" if undefined, null, or empty string — same rule as
 * the `requiredFields` check. Note that `0`, `false`, and `[]` are
 * intentionally **present**: cafe24 query parameters can legitimately use
 * the number `0` (e.g. `display_group=0`) and the boolean `false`, so
 * truthy/falsy semantics would falsely flag them as missing.
 */
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

/**
 * Validate one constraint. Returns null when satisfied or non-applicable
 * (e.g. `implies` whose `if` field is absent — no obligation on `then`).
 *
 * `allOrNone` semantics: zero present **and** all-present both pass;
 * partial presence (some fields populated, some absent) is the violation.
 */
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
  if (c.kind === 'implies') {
    if (!isAbsent(fields[c.if])) {
      const missing = c.then.filter((f) => isAbsent(fields[f]));
      if (missing.length > 0) {
        return `constraint violated: implies — when "${c.if}" is provided, [${c.then.join(', ')}] are required (missing: [${missing.join(', ')}])`;
      }
    }
    return null;
  }
  // Exhaustive check — adding a fourth `kind` to `Cafe24FieldConstraint`
  // makes this branch reachable with a TypeScript compile error pointing
  // back here, plus a runtime fallback if the type narrowing is bypassed.
  const _exhaustive: never = c;
  throw new Error(
    `Unknown Cafe24FieldConstraint kind: ${JSON.stringify(_exhaustive)}`,
  );
}
