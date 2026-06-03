import type { Suggestion } from "./use-expression-suggestions";

/** Flags describing which container-provided scope variables are in scope for a given node. */
export interface ContainerScopeFlags {
  /** `loop` container ancestor provides `$loop`. */
  hasLoop: boolean;
  /** `foreach` container ancestor provides `$item` / `$itemIndex`. */
  hasItem: boolean;
}

/**
 * Extension of {@link Suggestion} with optional container-scope gating.
 * When `scopeKey` is set, consumers (autocomplete, variable picker, scope
 * validator) must hide the entry unless `containerScope[scopeKey]` is true.
 */
export interface RootVariable extends Suggestion {
  /** When set, consumers gate visibility on `containerScope[scopeKey]`. */
  scopeKey?: keyof ContainerScopeFlags;
}

/**
 * Canonical list of top-level `$` variables shown in autocomplete and the
 * variable picker. Entries with `scopeKey` are only valid inside a matching
 * container — callers filter via {@link filterRootVariablesByScope}.
 */
export const ROOT_VARIABLES: RootVariable[] = [
  { label: "$input", insertText: "$input", type: "variable", detail: "Previous node output", isExpandable: true },
  { label: "$node", insertText: '$node["', type: "variable", detail: "Specific node output", isExpandable: true },
  { label: "$var", insertText: "$var", type: "variable", detail: "Workflow variables", isExpandable: true },
  { label: "$execution", insertText: "$execution", type: "variable", detail: "Execution context", isExpandable: true },
  { label: "$thread", insertText: "$thread", type: "variable", detail: "Conversation thread (length, text, indexed access via turns[i])", isExpandable: true },
  { label: "$now", insertText: "$now", type: "variable", detail: "Current timestamp (UTC ISO 8601)" },
  { label: "$loop", insertText: "$loop", type: "variable", detail: "Loop context", isExpandable: true, scopeKey: "hasLoop" },
  { label: "$item", insertText: "$item", type: "variable", detail: "ForEach current item", isExpandable: true, scopeKey: "hasItem" },
  { label: "$itemIndex", insertText: "$itemIndex", type: "variable", detail: "ForEach index", scopeKey: "hasItem" },
  { label: "$itemIsFirst", insertText: "$itemIsFirst", type: "variable", detail: "ForEach first-item flag", scopeKey: "hasItem" },
  { label: "$itemIsLast", insertText: "$itemIsLast", type: "variable", detail: "ForEach last-item flag", scopeKey: "hasItem" },
  { label: "$trigger", insertText: "$trigger", type: "variable", detail: "Trigger data", isExpandable: true },
  { label: "$env", insertText: "$env", type: "variable", detail: "Environment variables", isExpandable: true },
];

/** Drop entries whose required container scope is not active. */
export function filterRootVariablesByScope<T extends RootVariable>(
  vars: readonly T[],
  scope: ContainerScopeFlags,
): T[] {
  return vars.filter((v) => !v.scopeKey || scope[v.scopeKey]);
}

/** Table node-specific context variables */
export const TABLE_CONTEXT_VARIABLES: Suggestion[] = [
  { label: "$sourceItem", insertText: "$sourceItem", type: "variable", detail: "Table row item", isExpandable: true },
  { label: "$sourceItemIndex", insertText: "$sourceItemIndex", type: "variable", detail: "Table row index" },
  { label: "$dataSource", insertText: "$dataSource", type: "variable", detail: "Table data source array" },
];

/**
 * Properties exposed by `$node["X"]` at runtime.
 * Matches the shape built in `expression-resolver.service.ts` (config/output/meta/port/status).
 */
export const NODE_ACCESSORS: Suggestion[] = [
  { label: "output", insertText: "output", type: "field", detail: "Node output data", isExpandable: true },
  { label: "config", insertText: "config", type: "field", detail: "Node configuration", isExpandable: true },
  { label: "meta", insertText: "meta", type: "field", detail: "Execution metadata", isExpandable: true },
  { label: "port", insertText: "port", type: "field", detail: "Emitted output port id" },
  { label: "status", insertText: "status", type: "field", detail: "Execution status" },
];

/**
 * Built-in variables for the variable picker (excludes `$input`, `$node`,
 * `$var`, which have their own picker sections). The `scopeKey` is carried
 * through so the picker can filter container-only entries the same way as
 * the autocomplete.
 */
export const BUILT_IN_PICKER_VARIABLES: Array<{
  label: string;
  insert: string;
  detail: string;
  scopeKey?: keyof ContainerScopeFlags;
}> = ROOT_VARIABLES.filter(
  (v) => !["$input", "$node", "$var"].includes(v.label),
).map((v) => ({
  label: v.label,
  insert: v.insertText,
  detail: v.detail ?? "",
  scopeKey: v.scopeKey,
}));
