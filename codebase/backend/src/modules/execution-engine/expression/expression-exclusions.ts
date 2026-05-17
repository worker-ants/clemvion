/**
 * Config keys that should NOT be expression-resolved, per handler type.
 *
 * - code: Raw JavaScript — uses its own runtime ($input, $vars, $execution)
 */
export const EXPRESSION_EXCLUSIONS: Record<string, Set<string>> = {
  code: new Set(['code']),
  // columns expressions are evaluated per-item inside TableHandler
  table: new Set(['columns']),
  // conditions contain field paths relative to each array item, not expressions
  filter: new Set(['conditions']),
  // breakCondition re-evaluates per iteration (sees current $loop / $var /
  // $node[...]). Pre-resolving at dispatch time would lock it to i=0 (and
  // throw because $loop is undefined before the first iteration runs).
  loop: new Set(['breakCondition']),
};
