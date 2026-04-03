"use client";

import { useMemo } from "react";
import type { ExpressionData } from "./use-expression-context";
import { getNestedKeys, splitPathAndLeaf } from "./resolve-nested-path";

export type SuggestionType = "variable" | "field" | "node" | "function";

export interface Suggestion {
  label: string;
  insertText: string;
  type: SuggestionType;
  detail?: string;
  /** When true, selecting this suggestion auto-appends "." and keeps autocomplete open */
  isExpandable?: boolean;
}

/** Top-level $ variables shown when entering an expression */
const ROOT_VARIABLES: Suggestion[] = [
  { label: "$input", insertText: "$input", type: "variable", detail: "Previous node output" },
  { label: "$node", insertText: '$node["', type: "variable", detail: "Specific node output" },
  { label: "$var", insertText: "$var", type: "variable", detail: "Workflow variables" },
  { label: "$execution", insertText: "$execution", type: "variable", detail: "Execution context" },
  { label: "$now", insertText: "$now", type: "variable", detail: "Current timestamp" },
  { label: "$today", insertText: "$today", type: "variable", detail: "Current date" },
  { label: "$loop", insertText: "$loop", type: "variable", detail: "Loop context" },
  { label: "$item", insertText: "$item", type: "variable", detail: "ForEach current item" },
  { label: "$itemIndex", insertText: "$itemIndex", type: "variable", detail: "ForEach index" },
];

/**
 * Determine the expression token context at the given cursor position.
 * Returns null if the cursor is not inside a {{ }} expression block.
 */
function getExpressionToken(
  value: string,
  cursorPos: number,
): { token: string; start: number; end: number } | null {
  // Scan backwards to find opening {{
  let openIdx = -1;
  for (let i = cursorPos - 1; i >= 0; i--) {
    if (i > 0 && value[i] === "}" && value[i - 1] === "}") return null; // already closed
    if (i > 0 && value[i] === "{" && value[i - 1] === "{") {
      openIdx = i + 1; // position right after {{
      break;
    }
  }
  if (openIdx === -1) return null;

  // Check no closing }} before cursor
  const between = value.substring(openIdx, cursorPos);
  if (between.includes("}}")) return null;

  // Extract the token from the last meaningful boundary
  const tokenMatch = between.match(/([a-zA-Z0-9_$."[\]]*?)$/);
  if (!tokenMatch) return { token: "", start: cursorPos, end: cursorPos };

  const token = tokenMatch[1];
  const start = cursorPos - token.length;
  return { token, start, end: cursorPos };
}

/** Build nested field suggestions from a sample object at the given field path */
function buildNestedSuggestions(
  sample: Record<string, unknown>,
  fieldPrefix: string,
): { suggestions: Suggestion[]; leafLength: number } {
  const { parentPath, leafPrefix } = splitPathAndLeaf(fieldPrefix);

  const nestedKeys = parentPath
    ? getNestedKeys(sample, parentPath)
    : Object.keys(sample).map((key) => {
        const val = sample[key];
        const type =
          val === null
            ? "null"
            : Array.isArray(val)
              ? "array"
              : typeof val;
        return { key, type };
      });

  const suggestions = nestedKeys
    .filter((f) => f.key.toLowerCase().startsWith(leafPrefix.toLowerCase()))
    .map((f) => ({
      label: f.key,
      insertText: f.key,
      type: "field" as const,
      detail: f.type,
      isExpandable: f.type === "object" || f.type === "array",
    }));

  return { suggestions, leafLength: leafPrefix.length };
}

/**
 * Compute expression suggestions based on cursor position and expression data.
 */
export function useExpressionSuggestions(
  value: string,
  cursorPos: number,
  expressionData: ExpressionData,
): { suggestions: Suggestion[]; tokenStart: number; tokenEnd: number } {
  return useMemo(() => {
    const empty = { suggestions: [], tokenStart: 0, tokenEnd: 0 };
    const ctx = getExpressionToken(value, cursorPos);
    if (!ctx) return empty;

    const { token, end } = ctx;
    const trimmedToken = token.trimStart();

    // $node["..."].output. → field suggestions for that node (supports nested paths)
    const nodeOutputMatch = trimmedToken.match(
      /\$node\["([^"]+)"\]\.output\.(.*)$/,
    );
    if (nodeOutputMatch) {
      const nodeLabel = nodeOutputMatch[1];
      const fieldPrefix = nodeOutputMatch[2];
      const node = expressionData.availableNodes.find(
        (n) => n.label === nodeLabel,
      );
      if (node) {
        const { suggestions, leafLength } = buildNestedSuggestions(
          node.outputSample,
          fieldPrefix,
        );
        return {
          suggestions,
          tokenStart: end - leafLength,
          tokenEnd: end,
        };
      }
    }

    // $node[" → node label suggestions
    const nodeSelectMatch = trimmedToken.match(/\$node\["([^"]*)$/);
    if (nodeSelectMatch) {
      const prefix = nodeSelectMatch[1];
      const suggestions = expressionData.availableNodes
        .filter((n) =>
          n.label.toLowerCase().startsWith(prefix.toLowerCase()),
        )
        .map((n) => ({
          label: n.label,
          insertText: `${n.label}"].output`,
          type: "node" as const,
          detail: n.type,
        }));
      return {
        suggestions,
        tokenStart: end - prefix.length,
        tokenEnd: end,
      };
    }

    // $input. → input field suggestions (supports nested paths)
    if (trimmedToken.startsWith("$input.")) {
      const fieldPrefix = trimmedToken.slice(7);
      const { suggestions, leafLength } = buildNestedSuggestions(
        expressionData.inputSample,
        fieldPrefix,
      );
      return {
        suggestions,
        tokenStart: end - leafLength,
        tokenEnd: end,
      };
    }

    // $var. → variable suggestions
    if (trimmedToken.startsWith("$var.")) {
      const varPrefix = trimmedToken.slice(5);
      const suggestions = expressionData.variables
        .filter((v) =>
          v.name.toLowerCase().startsWith(varPrefix.toLowerCase()),
        )
        .map((v) => ({
          label: v.name,
          insertText: v.name,
          type: "variable" as const,
          detail: v.type,
        }));
      return {
        suggestions,
        tokenStart: end - varPrefix.length,
        tokenEnd: end,
      };
    }

    // At expression start or after operator — show root variables + functions
    const filterPrefix = trimmedToken.replace(/^.*[+\-*/%=!<>&|?,:([\s]/, "");
    const rootSuggestions = ROOT_VARIABLES.filter((s) =>
      s.label.toLowerCase().startsWith(filterPrefix.toLowerCase()),
    );
    const fnSuggestions = expressionData.functionNames
      .filter((f) => f.toLowerCase().startsWith(filterPrefix.toLowerCase()))
      .slice(0, 10)
      .map((f) => ({
        label: `${f}()`,
        insertText: `${f}(`,
        type: "function" as const,
      }));

    return {
      suggestions: [...rootSuggestions, ...fnSuggestions],
      tokenStart: end - filterPrefix.length,
      tokenEnd: end,
    };
  }, [value, cursorPos, expressionData]);
}
