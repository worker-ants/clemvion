import {
  EvaluatedWarning,
  NodeConfig,
  SummaryTemplateSpec,
  WarningRule,
  WarningSeverity,
} from './types';

/**
 * Walk a dot-path into a node config and return the leaf.
 *
 * `path` is config-relative (write `mode`, not `config.mode`). Two special
 * cases match the legacy frontend interpreter so existing
 * `summaryTemplate.warnWhen` rules port without changes:
 *  - `length` segment on an array / string returns the length number.
 *  - missing intermediate object → `undefined`.
 */
function getPath(config: NodeConfig, path: string): unknown {
  const parts = path.split('.');
  let cursor: unknown = config;
  for (const part of parts) {
    if (cursor == null) return undefined;
    if (part === 'length') {
      if (Array.isArray(cursor)) return cursor.length;
      if (typeof cursor === 'string') return cursor.length;
      return undefined;
    }
    if (typeof cursor === 'object') {
      cursor = (cursor as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return cursor;
}

/**
 * Stringify a value for `==` / `!=` comparisons. Mirrors the legacy
 * frontend interpreter so rule porting stays mechanical.
 */
function stringify(value: unknown): string {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Resolve an "operand" that may be a `length(path)` call, a plain dotted
 * path, or a literal RHS value (as written in the rule expression).
 *
 * Returns the raw resolved value — the caller decides whether to coerce
 * to number / string / boolean for the operator at hand.
 */
function resolveOperand(operand: string, config: NodeConfig): unknown {
  const trimmed = operand.trim();
  const callMatch = trimmed.match(/^length\(\s*([^)]+?)\s*\)$/);
  if (callMatch) {
    const value = getPath(config, callMatch[1]);
    if (Array.isArray(value)) return value.length;
    if (typeof value === 'string') return value.length;
    return 0;
  }
  // Heuristic: numeric literal → number; otherwise dotted path lookup.
  // Bare identifiers that don't exist on the config will resolve to
  // `undefined` (truthiness false), which is the legacy behavior.
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed);
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (trimmed === 'null') return null;
  return getPath(config, trimmed);
}

/**
 * Coerce a value to a finite number for `>` / `<` / `>=` / `<=`. Anything
 * that doesn't cleanly convert returns `NaN`, which makes the comparison
 * false — same effect as "rule doesn't fire on garbage data" in the legacy
 * interpreter.
 */
function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const n = Number(value);
    return Number.isFinite(n) ? n : NaN;
  }
  return NaN;
}

/**
 * Truthiness check that matches the legacy frontend interpreter:
 * undefined / null / "" / [] / 0 / false → falsy. Other values truthy.
 */
function isTruthy(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string' && value === '') return false;
  if (Array.isArray(value) && value.length === 0) return false;
  if (typeof value === 'number' && value === 0) return false;
  if (typeof value === 'boolean' && value === false) return false;
  return true;
}

const COMPARISON_OPERATORS = ['==', '!=', '>=', '<=', '>', '<'] as const;
type ComparisonOperator = (typeof COMPARISON_OPERATORS)[number];

/**
 * Find the first comparison operator outside of any `length(...)` call.
 *
 * Naive `indexOf` would catch the `>` inside something silly like
 * `length(items)>0`, which is fine, but we do need to skip the first `(`
 * when looking for `==` / `!=` etc. so a future expression like
 * `length(items)==length(buttons)` still parses correctly. The current
 * grammar doesn't allow nested calls, so we just do a single pass that
 * tracks paren depth.
 */
function findComparison(
  expr: string,
): { op: ComparisonOperator; index: number } | null {
  let depth = 0;
  for (let i = 0; i < expr.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0) {
      for (const op of COMPARISON_OPERATORS) {
        if (expr.startsWith(op, i)) {
          return { op, index: i };
        }
      }
    }
  }
  return null;
}

/**
 * Evaluate one atom (no `&&` / `||` operators inside).
 *
 * Atoms supported, in order tried:
 *  1. `!atom`           — negation of inner atom
 *  2. comparison        — `lhs op rhs`, op ∈ COMPARISON_OPERATORS
 *  3. `length(path)`    — truthiness of length (>0 → true)
 *  4. plain `path`      — truthiness of path lookup
 *
 * No parentheses, no nesting beyond `length(...)`. That's deliberately
 * limited: anything more belongs in `validateConfig?` on the schema.
 */
function evaluateAtom(expr: string, config: NodeConfig): boolean {
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;

  if (trimmed.startsWith('!')) {
    return !evaluateAtom(trimmed.slice(1), config);
  }

  const cmp = findComparison(trimmed);
  if (cmp) {
    const rawLhs = trimmed.slice(0, cmp.index).trim();
    const rawRhs = trimmed.slice(cmp.index + cmp.op.length).trim();
    // Reject malformed expressions like "==" or " == foo" — return false so
    // schema authors get a chance to catch the typo via their schema spec
    // without breaking runtime rendering. Mirrors the legacy interpreter's
    // `eqIdx > 0` guard.
    if (rawLhs.length === 0) return false;
    const lhs = resolveOperand(rawLhs, config);
    // RHS is always a literal — equality compares against the raw string,
    // numeric ops parse it as a number. We deliberately do NOT path-resolve
    // the RHS so a rule like `mode == dynamic` works even when the config
    // has no key named "dynamic" (which would otherwise resolve to undefined
    // and fail).
    switch (cmp.op) {
      case '==':
        return stringify(lhs) === rawRhs;
      case '!=':
        return stringify(lhs) !== rawRhs;
      case '>': {
        const a = toNumber(lhs);
        const b = Number(rawRhs);
        return Number.isFinite(a) && Number.isFinite(b) && a > b;
      }
      case '<': {
        const a = toNumber(lhs);
        const b = Number(rawRhs);
        return Number.isFinite(a) && Number.isFinite(b) && a < b;
      }
      case '>=': {
        const a = toNumber(lhs);
        const b = Number(rawRhs);
        return Number.isFinite(a) && Number.isFinite(b) && a >= b;
      }
      case '<=': {
        const a = toNumber(lhs);
        const b = Number(rawRhs);
        return Number.isFinite(a) && Number.isFinite(b) && a <= b;
      }
    }
  }

  return isTruthy(resolveOperand(trimmed, config));
}

/**
 * Split a string by an operator, but only at the top level (not inside
 * `length(...)`). Mirrors {@link findComparison}'s paren-depth scanner.
 */
function splitTopLevel(expr: string, sep: string): string[] {
  const out: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i <= expr.length - sep.length; i++) {
    const ch = expr[i];
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    else if (depth === 0 && expr.startsWith(sep, i)) {
      out.push(expr.slice(start, i));
      start = i + sep.length;
      i += sep.length - 1;
    }
  }
  out.push(expr.slice(start));
  return out;
}

/**
 * Evaluate a `when` expression against a node config.
 *
 * Combinators (left-to-right, no precedence other than "all `&&` bind
 * before `||`" via the natural split order):
 *   `||` separates OR branches
 *   `&&` separates AND branches inside each OR branch
 *
 * Returns `false` (rule does NOT fire) on any malformed input — the canvas
 * must keep rendering even when a schema author typos a rule, and review
 * shouldn't block on it either. Use a unit test on the schema to catch
 * authoring errors at build time, not at runtime.
 */
export function evaluateWhen(expr: string, config: NodeConfig): boolean {
  if (typeof expr !== 'string') return false;
  const trimmed = expr.trim();
  if (trimmed.length === 0) return false;

  try {
    const orBranches = splitTopLevel(trimmed, '||');
    return orBranches.some((orBranch) => {
      const andBranches = splitTopLevel(orBranch, '&&');
      return andBranches.every((atom) => evaluateAtom(atom, config));
    });
  } catch {
    return false;
  }
}

/**
 * Run every rule in `rules` against `config` and return the ones that fire.
 *
 * Order is preserved (authors get to control display priority by order).
 * Default severity is `blocking` — the strict choice catches the more
 * common authoring intent ("if I'm writing a rule it's because the user
 * shouldn't ship without fixing it"); explicit `severity: 'advisory'`
 * opts out.
 */
export function evaluateWarnings(
  config: NodeConfig | undefined | null,
  rules: readonly WarningRule[] | undefined,
): EvaluatedWarning[] {
  if (!rules || rules.length === 0) return [];
  const cfg = (config ?? {}) as NodeConfig;
  const out: EvaluatedWarning[] = [];
  for (const rule of rules) {
    if (evaluateWhen(rule.when, cfg)) {
      out.push({
        id: rule.id,
        message: rule.message,
        severity: (rule.severity ?? 'blocking') as WarningSeverity,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Summary template rendering — ported from the legacy frontend interpreter
// so the same package owns both surfaces. Template rendering is purely for
// display; it does NOT decide whether a node has a warning. That role
// belongs to evaluateWarnings + WarningRule[].
// ---------------------------------------------------------------------------

function applyFilter(value: unknown, filter: string): unknown {
  const [name, rawArg] = filter.split(':', 2);
  const arg = rawArg ?? '';
  switch (name) {
    case 'upper':
      return typeof value === 'string' ? value.toUpperCase() : value;
    case 'lower':
      return typeof value === 'string' ? value.toLowerCase() : value;
    case 'default':
      if (value === undefined || value === null || value === '') return arg;
      return value;
    default:
      return value;
  }
}

/** `{{ path | filter:arg | filter2 }}` style template renderer. */
export function renderTemplate(template: string, config: NodeConfig): string {
  return template.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, expr: string) => {
    const [path, ...filters] = expr.split('|').map((s) => s.trim());
    let value: unknown = getPath(config, path);
    for (const filter of filters) {
      value = applyFilter(value, filter);
    }
    return stringify(value);
  });
}

export interface RenderedSummary {
  text: string;
  isWarning: boolean;
}

/**
 * Render a {@link SummaryTemplateSpec} into the `{ text, isWarning }` shape
 * the canvas card consumes. Returns `null` for missing spec so callers can
 * fall back to a per-type default.
 *
 * `WarningRule[]` (the SSOT) is layered on top by the frontend
 * `getConfigSummary` helper — this function only handles the legacy
 * single-warning template field.
 */
export function renderSummaryTemplate(
  spec: SummaryTemplateSpec | string | undefined | null,
  config: NodeConfig,
): RenderedSummary | null {
  if (spec == null) return null;
  if (typeof spec === 'string') {
    return { text: renderTemplate(spec, config), isWarning: false };
  }
  if (spec.warnWhen && evaluateWhen(spec.warnWhen, config)) {
    const message = spec.warnMessage ?? renderTemplate(spec.template, config);
    return { text: `⚠ ${message}`, isWarning: true };
  }
  return { text: renderTemplate(spec.template, config), isWarning: false };
}
