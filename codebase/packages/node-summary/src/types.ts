/**
 * Single source of truth for "what does this node config look wrong?"
 *
 * Both the frontend canvas badge (⚠️ on a node card) and the backend
 * `handler.validate()` / assistant `NODE_CONFIG_WARNINGS` review consume
 * these definitions through the shared {@link evaluateWarnings} evaluator,
 * so the two surfaces cannot drift.
 */

/**
 * Severity of a warning result.
 *
 *  - `blocking`: the assistant's `WORKFLOW_REVIEW_REQUIRED` gate refuses
 *    `finish` until the user (or the assistant in a follow-up edit round)
 *    fixes the underlying config. Frontend renders ⚠️.
 *  - `advisory`: the canvas may surface a hint, but `finish` is not blocked.
 *    Use this for soft suggestions ("most flows attach an error edge here")
 *    that don't represent a runtime defect.
 */
export type WarningSeverity = 'blocking' | 'advisory';

/**
 * One declarative rule that decides whether a node config has a warning.
 *
 * The rule is authored once on the backend node component
 * (`<node>.schema.ts`) and shipped to the frontend through
 * `GET /nodes/definitions`. Both runtimes evaluate it with
 * {@link evaluateWarnings}, so the warning fired on the canvas badge is
 * exactly the warning fired by `handler.validate()`.
 *
 * ## `when` grammar
 *
 * The `when` field is a single mini-DSL expression evaluated against the
 * node config object (the config is the **root** of path resolution — write
 * `mode`, not `config.mode`). Supported forms, combined freely with `&&`
 * and `||` (left-to-right, no parens):
 *
 *  - `!path`             — path is null / undefined / "" / [] / 0 / false
 *  - `path`              — path is truthy
 *  - `path == value`     — string comparison after JSON-stringify
 *  - `path != value`     — opposite
 *  - `path > N`          — numeric comparison; non-numeric → false
 *  - `path < N`, `>=`, `<=`
 *  - `length(path) > N`  — array / string length comparison; missing path → 0
 *  - `length(path) == N` — etc.
 *  - `path.length > N`   — same as `length(path) > N` (legacy form)
 *
 * Anything more expressive (cross-field business rules, regex, recursion)
 * belongs in the same node component's `validateConfig?: (config) => string[]`
 * imperative escape hatch — see the `WarningRule` field on the metadata.
 *
 * Whitespace around operators is optional. RHS values are unquoted strings
 * (numbers parsed when needed); use `path == ""` to check empty string.
 */
export interface WarningRule {
  /**
   * Stable id for diagnostics and tests. Conventionally
   * `<nodeType>:<short-kebab-summary>`, e.g.
   * `carousel:dynamic-mode-needs-title-field`.
   */
  id: string;
  /** Mini-DSL expression — see grammar above. */
  when: string;
  /**
   * Korean message shown to the end user. Surfaces verbatim in two places:
   *  - canvas badge tooltip
   *  - assistant `WORKFLOW_REVIEW_REQUIRED` checklist `details`
   */
  message: string;
  /** Default `blocking`. */
  severity?: WarningSeverity;
}

/**
 * Result of evaluating one rule against a config. The frontend renders
 * `message` (prefixed with ⚠) on the badge; the backend pushes `message`
 * into the `configWarnings: string[]` array attached to the
 * `add_node` / `update_node` tool result.
 */
export interface EvaluatedWarning {
  id: string;
  message: string;
  severity: WarningSeverity;
}

/**
 * Display-only template for the small one-line summary text under the
 * node label on the canvas. Independent from {@link WarningRule}: a node
 * can have no template (uses the legacy default) or both (template renders
 * normally; warnings are layered on top).
 *
 * `warnWhen` / `warnMessage` are kept for backward compatibility with the
 * older single-warning shape; new code should put warnings in
 * {@link WarningRule}[] instead.
 */
export interface SummaryTemplateSpec {
  /** `{{path|filter:arg}}` style template — same grammar as the legacy interpreter. */
  template: string;
  /** Legacy single-warning predicate (same grammar as `WarningRule.when`). */
  warnWhen?: string;
  /** Legacy single-warning message; falls back to rendering `template` when omitted. */
  warnMessage?: string;
}

/** A node config object. `unknown` because each node type has its own shape. */
export type NodeConfig = Record<string, unknown>;
