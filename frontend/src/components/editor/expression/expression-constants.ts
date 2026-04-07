"use client";

import type { Suggestion } from "./use-expression-suggestions";

/** Canonical list of top-level $ variables shown in autocomplete and variable picker */
export const ROOT_VARIABLES: Suggestion[] = [
  { label: "$input", insertText: "$input", type: "variable", detail: "Previous node output" },
  { label: "$node", insertText: '$node["', type: "variable", detail: "Specific node output" },
  { label: "$var", insertText: "$var", type: "variable", detail: "Workflow variables" },
  { label: "$execution", insertText: "$execution", type: "variable", detail: "Execution context" },
  { label: "$now", insertText: "$now", type: "variable", detail: "Current timestamp" },
  { label: "$today", insertText: "$today", type: "variable", detail: "Current date" },
  { label: "$loop", insertText: "$loop", type: "variable", detail: "Loop context" },
  { label: "$item", insertText: "$item", type: "variable", detail: "ForEach current item" },
  { label: "$itemIndex", insertText: "$itemIndex", type: "variable", detail: "ForEach index" },
  { label: "$trigger", insertText: "$trigger", type: "variable", detail: "Trigger data" },
  { label: "$env", insertText: "$env", type: "variable", detail: "Environment variables" },
];

/** Table node-specific context variables */
export const TABLE_CONTEXT_VARIABLES: Suggestion[] = [
  { label: "$sourceItem", insertText: "$sourceItem", type: "variable", detail: "Table row item" },
  { label: "$sourceItemIndex", insertText: "$sourceItemIndex", type: "variable", detail: "Table row index" },
  { label: "$dataSource", insertText: "$dataSource", type: "variable", detail: "Table data source array" },
];

/** Built-in variables for variable picker (excludes $input, $node, $var which have their own sections) */
export const BUILT_IN_PICKER_VARIABLES = ROOT_VARIABLES
  .filter((v) => !["$input", "$node", "$var"].includes(v.label))
  .map((v) => ({ label: v.label, insert: v.insertText, detail: v.detail ?? "" }));
