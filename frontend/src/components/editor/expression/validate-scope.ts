/**
 * Scope-aware validation for inline expressions.
 *
 * Complements `@workflow/expression-engine` `validate()` (syntax/function
 * signatures) with semantic checks that match the runtime's actual resolution
 * rules: a node can only reference ancestor nodes, declared workflow
 * variables, and container-scope variables whose container encloses it.
 *
 * The validator uses token-level pattern matching rather than a full AST
 * walk — the editor language is small enough that regexes over `{{ ... }}`
 * blocks reliably identify `$node["..."]`, `$var.<name>`, and the root
 * `$loop` / `$item` / `$itemIndex` references without building a parse tree.
 */

export type ScopeErrorKind =
  | "unknown-node"
  | "unreachable-node"
  | "unknown-variable"
  | "out-of-scope-loop"
  | "out-of-scope-item";

export interface ScopeValidationError {
  kind: ScopeErrorKind;
  /** The offending identifier or node key, for UI display. */
  token: string;
  /** Human-readable message ready for rendering. */
  message: string;
}

export interface ScopeValidationContext {
  /** resolvedKey values of nodes the selected node can reach (ancestors). */
  availableKeys: Set<string>;
  /** resolvedKey values of every node in the workflow. */
  allNodeKeys: Set<string>;
  /** Declared `$var` names. */
  variables: Array<{ name: string; type: string }>;
  /** Flags for container-provided variables ($loop / $item / $itemIndex). */
  containerScope: { hasLoop: boolean; hasItem: boolean };
}

// Patterns are re-created per invocation below. Global (`g`) regexes share
// `lastIndex` state across calls and interfere with `.test()` / `.matchAll()`
// when multiple validators run against the same pattern, so we avoid a
// module-level cache.
const EXPR_BLOCK_PATTERN = /\{\{([\s\S]+?)\}\}/g;
// $node["<key>"]: captures the quoted key with escape-sequence support.
const NODE_REF_PATTERN = /\$node\s*\[\s*"((?:[^"\\]|\\.)*)"\s*\]/g;
// $var.<name>: captures the identifier after the dot.
const VAR_REF_PATTERN = /\$var\s*\.\s*([A-Za-z_$][A-Za-z0-9_$]*)/g;
// Root references to container-scope variables. Anchored by non-word
// boundaries so `$itemIndex` doesn't double-match as `$item`.
const LOOP_ROOT_PATTERN = /(?<![A-Za-z0-9_$])\$loop(?![A-Za-z0-9_$])/;
const ITEM_ROOT_PATTERN = /(?<![A-Za-z0-9_$])\$item(?![A-Za-z0-9_$])/;
const ITEM_INDEX_ROOT_PATTERN = /(?<![A-Za-z0-9_$])\$itemIndex(?![A-Za-z0-9_$])/;

function unescapeDoubleQuotedKey(raw: string): string {
  return raw.replace(/\\(.)/g, "$1");
}

function messageFor(kind: ScopeErrorKind, token: string): string {
  switch (kind) {
    case "unknown-node":
      return `Node "${token}" does not exist in this workflow.`;
    case "unreachable-node":
      return `Node "${token}" cannot be referenced from here — it is not an ancestor of the selected node.`;
    case "unknown-variable":
      return `Variable "$var.${token}" is not declared in this workflow.`;
    case "out-of-scope-loop":
      return `$loop is only available inside a Loop container.`;
    case "out-of-scope-item":
      return `${token} is only available inside a ForEach container.`;
  }
}

function pushUnique(
  errors: ScopeValidationError[],
  seen: Set<string>,
  err: ScopeValidationError,
): void {
  const dedupeKey = `${err.kind}:${err.token}`;
  if (seen.has(dedupeKey)) return;
  seen.add(dedupeKey);
  errors.push(err);
}

export function validateExpressionScope(
  value: string,
  context: ScopeValidationContext,
): ScopeValidationError[] {
  if (!value || value.indexOf("{{") === -1) return [];

  const errors: ScopeValidationError[] = [];
  const seen = new Set<string>();
  const declared = new Set(context.variables.map((v) => v.name));

  // Fresh regex instances per call — see EXPR_BLOCK_PATTERN note above for
  // why module-level `/g` regexes are unsafe.
  const blockRe = new RegExp(EXPR_BLOCK_PATTERN.source, EXPR_BLOCK_PATTERN.flags);
  for (const match of value.matchAll(blockRe)) {
    const block = match[1];

    const nodeRe = new RegExp(NODE_REF_PATTERN.source, NODE_REF_PATTERN.flags);
    for (const nodeMatch of block.matchAll(nodeRe)) {
      const key = unescapeDoubleQuotedKey(nodeMatch[1]);
      if (!context.allNodeKeys.has(key)) {
        pushUnique(errors, seen, {
          kind: "unknown-node",
          token: key,
          message: messageFor("unknown-node", key),
        });
      } else if (!context.availableKeys.has(key)) {
        pushUnique(errors, seen, {
          kind: "unreachable-node",
          token: key,
          message: messageFor("unreachable-node", key),
        });
      }
    }

    const varRe = new RegExp(VAR_REF_PATTERN.source, VAR_REF_PATTERN.flags);
    for (const varMatch of block.matchAll(varRe)) {
      const name = varMatch[1];
      if (!declared.has(name)) {
        pushUnique(errors, seen, {
          kind: "unknown-variable",
          token: name,
          message: messageFor("unknown-variable", name),
        });
      }
    }

    if (!context.containerScope.hasLoop && LOOP_ROOT_PATTERN.test(block)) {
      pushUnique(errors, seen, {
        kind: "out-of-scope-loop",
        token: "$loop",
        message: messageFor("out-of-scope-loop", "$loop"),
      });
    }

    if (!context.containerScope.hasItem) {
      if (ITEM_ROOT_PATTERN.test(block)) {
        pushUnique(errors, seen, {
          kind: "out-of-scope-item",
          token: "$item",
          message: messageFor("out-of-scope-item", "$item"),
        });
      }

      if (ITEM_INDEX_ROOT_PATTERN.test(block)) {
        pushUnique(errors, seen, {
          kind: "out-of-scope-item",
          token: "$itemIndex",
          message: messageFor("out-of-scope-item", "$itemIndex"),
        });
      }
    }
  }

  return errors;
}
