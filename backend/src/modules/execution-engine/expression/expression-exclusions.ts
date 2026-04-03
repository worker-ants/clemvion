/**
 * Config keys that should NOT be expression-resolved, per handler type.
 *
 * - code: Raw JavaScript — uses its own runtime ($input, $vars, $execution)
 */
export const EXPRESSION_EXCLUSIONS: Record<string, Set<string>> = {
  code: new Set(['code']),
  // columns expressions are evaluated per-item inside TableHandler
  table: new Set(['columns']),
};
