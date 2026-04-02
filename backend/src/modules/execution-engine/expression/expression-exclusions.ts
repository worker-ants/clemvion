/**
 * Config keys that should NOT be expression-resolved, per handler type.
 *
 * - code: Raw JavaScript — uses its own runtime ($input, $vars, $execution)
 * - template: Has its own {{ }} parser for input data interpolation (Phase 2 migration planned)
 */
export const EXPRESSION_EXCLUSIONS: Record<string, Set<string>> = {
  code: new Set(['code']),
  template: new Set(['template']),
};
