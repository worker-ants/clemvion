import { useMemo } from "react";
import type { ExpressionData } from "./use-expression-context";
import type { JsonSchemaNode } from "@/lib/node-definitions/types";
import {
  getNestedKeys,
  getSchemaKeys,
  splitPathAndLeaf,
} from "./resolve-nested-path";
import {
  NODE_ACCESSORS,
  ROOT_VARIABLES,
  TABLE_CONTEXT_VARIABLES,
  filterRootVariablesByScope,
} from "./expression-constants";

export type SuggestionType = "variable" | "field" | "node" | "function";

export interface Suggestion {
  label: string;
  insertText: string;
  type: SuggestionType;
  detail?: string;
  /** When true, selecting this suggestion auto-appends "." and keeps autocomplete open */
  isExpandable?: boolean;
}

/** Characters that form part of an expression token when unquoted. */
const TOKEN_CHAR_RE = /[a-zA-Z0-9_$.[\]]/;

/**
 * Determine the expression token context at the given cursor position.
 * Returns null if the cursor is not inside a {{ }} expression block.
 *
 * Walks backward from the cursor, tracking whether we're inside a `"..."`
 * string literal so that spaces inside node keys (e.g. `$node["AI Agent"]`)
 * are part of the token, while spaces outside strings act as boundaries.
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

  // A `"` at k is an unescaped boundary when it isn't preceded by `\`. The
  // guard `k > 0` makes the check explicit at the start of the string —
  // relying on `between[-1]` returning `undefined` works today but is a
  // silent-failure mode worth avoiding.
  const isUnescapedQuoteAt = (k: number): boolean =>
    between[k] === '"' && (k === 0 || between[k - 1] !== "\\");

  // Detect whether the cursor sits inside an unterminated `"..."` by scanning
  // forward and counting unescaped quotes. When odd, the tail is open.
  let cursorInsideString = false;
  for (let k = 0; k < between.length; k++) {
    if (isUnescapedQuoteAt(k)) cursorInsideString = !cursorInsideString;
  }

  // Walk backward. Inside a `"..."` region every char is part of the token;
  // outside, only TOKEN_CHAR_RE chars continue the token. The initial
  // `inString` state is taken from the forward scan so that `$node["AI A`
  // (cursor mid-string) correctly treats the space as part of the token.
  let i = between.length - 1;
  let inString = cursorInsideString;
  while (i >= 0) {
    const ch = between[i];
    if (inString) {
      if (isUnescapedQuoteAt(i)) inString = false;
      i--;
      continue;
    }
    if (ch === '"') {
      inString = true;
      i--;
      continue;
    }
    if (!TOKEN_CHAR_RE.test(ch)) break;
    i--;
  }

  const tokenStartInBetween = i + 1;
  const token = between.slice(tokenStartInBetween);
  const start = openIdx + tokenStartInBetween;
  return { token, start, end: cursorPos };
}

/**
 * Build nested field suggestions by unioning runtime sample keys with static
 * JSON schema keys. Runtime sample is preferred when both sources describe
 * the same field (live data is more accurate than the declared schema).
 */
function buildNestedSuggestions(
  sample: Record<string, unknown>,
  fieldPrefix: string,
  schema?: JsonSchemaNode,
): { suggestions: Suggestion[]; leafLength: number } {
  const { parentPath, leafPrefix } = splitPathAndLeaf(fieldPrefix);

  const sampleKeys = parentPath
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

  const schemaKeys = getSchemaKeys(schema, parentPath);

  const merged = new Map<string, { key: string; type: string }>();
  for (const f of schemaKeys) merged.set(f.key, f);
  for (const f of sampleKeys) merged.set(f.key, f);

  const suggestions = Array.from(merged.values())
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

    // $node["..."].(output|config).<path> → field suggestions for that accessor
    const nodeAccessorDrillMatch = trimmedToken.match(
      /\$node\["([^"]+)"\]\.(output|config)\.(.*)$/,
    );
    if (nodeAccessorDrillMatch) {
      const nodeKey = nodeAccessorDrillMatch[1];
      const accessor = nodeAccessorDrillMatch[2] as "output" | "config";
      const fieldPrefix = nodeAccessorDrillMatch[3];
      const node = expressionData.availableNodes.find(
        (n) => n.resolvedKey === nodeKey,
      );
      if (node) {
        const sample = accessor === "output" ? node.outputSample : {};
        // Each node's schemas are declared as the canonical envelope shape
        // `{ config, output, meta, port, status }` — but `$node["X"].output.*`
        // / `.config.*` references the *content* of that accessor, not the
        // envelope root. Descend one level so schema-based suggestions align
        // with the runtime sample (which Phase 1 already unwraps in
        // use-expression-context).
        const envelopeSchema =
          accessor === "output" ? node.outputSchema : node.configSchema;
        const schema =
          (envelopeSchema?.properties?.[accessor] as JsonSchemaNode | undefined) ??
          envelopeSchema;
        const { suggestions, leafLength } = buildNestedSuggestions(
          sample,
          fieldPrefix,
          schema,
        );
        return {
          suggestions,
          tokenStart: end - leafLength,
          tokenEnd: end,
        };
      }
    }

    // $node["..."].<prefix> (first accessor) → node accessor hints (output/config/meta/port/status)
    const nodeAccessorMatch = trimmedToken.match(
      /\$node\["([^"]+)"\]\.([a-zA-Z_]*)$/,
    );
    if (nodeAccessorMatch) {
      const accessorPrefix = nodeAccessorMatch[2];
      const suggestions = NODE_ACCESSORS.filter((a) =>
        a.label.toLowerCase().startsWith(accessorPrefix.toLowerCase()),
      );
      return {
        suggestions,
        tokenStart: end - accessorPrefix.length,
        tokenEnd: end,
      };
    }

    // $node[" → node label suggestions
    const nodeSelectMatch = trimmedToken.match(/\$node\["([^"]*)$/);
    if (nodeSelectMatch) {
      const prefix = nodeSelectMatch[1];
      const suggestions = expressionData.availableNodes
        .filter((n) =>
          n.resolvedKey.toLowerCase().startsWith(prefix.toLowerCase()),
        )
        .map((n) => {
          // Escape special characters in keys to prevent expression syntax breakage
          const escaped = n.resolvedKey.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          return {
            label: n.resolvedKey,
            insertText: `${escaped}"]`,
            type: "node" as const,
            detail: n.type,
            // handleSelect auto-appends "." so the next keystroke opens the accessor hint
            isExpandable: true,
          };
        });
      return {
        suggestions,
        tokenStart: end - prefix.length,
        tokenEnd: end,
      };
    }

    // $input. → input field suggestions (supports nested paths, static schema fallback)
    if (trimmedToken.startsWith("$input.")) {
      const fieldPrefix = trimmedToken.slice(7);
      const { suggestions, leafLength } = buildNestedSuggestions(
        expressionData.inputSample,
        fieldPrefix,
        expressionData.inputSchema,
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

    // $sourceItem. → source item field suggestions (table nodes only)
    if (trimmedToken.startsWith("$sourceItem.") && expressionData.sourceItemSample) {
      const fieldPrefix = trimmedToken.slice(12);
      const { suggestions, leafLength } = buildNestedSuggestions(
        expressionData.sourceItemSample,
        fieldPrefix,
      );
      return {
        suggestions,
        tokenStart: end - leafLength,
        tokenEnd: end,
      };
    }

    // $dataSource. → data source array item field suggestions (table nodes only, same shape as $sourceItem)
    if (trimmedToken.startsWith("$dataSource.") && expressionData.sourceItemSample) {
      const fieldPrefix = trimmedToken.slice(12);
      const { suggestions, leafLength } = buildNestedSuggestions(
        expressionData.sourceItemSample,
        fieldPrefix,
      );
      return {
        suggestions,
        tokenStart: end - leafLength,
        tokenEnd: end,
      };
    }

    // At expression start or after operator — show root variables + functions
    const filterPrefix = trimmedToken.replace(/^.*[+\-*/%=!<>&|?,:([\s]/, "");

    // Drop container-only scope variables when the selected node is not
    // inside the container that would produce them. Metadata lives on each
    // ROOT_VARIABLES entry (`scopeKey`) so this stays in one place.
    const scopedRoots = filterRootVariablesByScope(
      ROOT_VARIABLES,
      expressionData.containerScope,
    );

    // Add table context variables ($sourceItem, $sourceItemIndex, $dataSource) when in a table node
    const contextualRoots = expressionData.isTableContext
      ? [...scopedRoots, ...TABLE_CONTEXT_VARIABLES]
      : scopedRoots;

    const rootSuggestions = contextualRoots.filter((s) =>
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
