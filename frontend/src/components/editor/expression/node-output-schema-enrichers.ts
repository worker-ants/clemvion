/**
 * Per-node-type enrichers that extend the static backend `outputSchema` with
 * fields derived from each node instance's `config`. Used by the expression
 * autocomplete to hint user-declared properties (e.g. Information Extractor's
 * configurable output fields) even when the node has never executed.
 *
 * These enrichers are a frontend-only concern: the returned schema augments
 * autocomplete suggestions, it is not part of runtime validation.
 */

import type { JsonSchemaNode } from "@/lib/node-definitions/types";

/** Matches the OutputField.type enum declared in information-extractor schema. */
const INFO_EXTRACTOR_TYPE_MAP: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  array: "array",
  object: "object",
};

/** Safe object property name — rejects `__proto__`, `constructor`, `prototype`, etc. */
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeFieldName(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0) return false;
  if (UNSAFE_KEYS.has(name)) return false;
  return SAFE_IDENTIFIER_RE.test(name);
}

/**
 * Information Extractor declares user-configured output fields inside each
 * node instance's `config.outputSchema`. Project those names into the static
 * outputSchema so autocomplete can hint `.output.extracted.<name>` even
 * before the node has executed.
 *
 * Silent cases are intentionally tolerant because this feeds UX hints only:
 * an undefined base schema, an empty/absent fields array, or a schema that
 * doesn't expose `output.properties` all simply fall back to the base. When
 * the base schema shape prevents enrichment we log a warning so schema
 * drift between backend and frontend is noticed during development.
 */
export function enrichInfoExtractorOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  if (!baseSchema) return baseSchema;
  const fields = config?.outputSchema as
    | Array<{ name?: unknown; type?: unknown; description?: unknown }>
    | undefined;
  if (!Array.isArray(fields) || fields.length === 0) return baseSchema;

  const userProps: Record<string, JsonSchemaNode> = Object.create(null);
  for (const f of fields) {
    if (!isSafeFieldName(f?.name)) continue;
    const declaredType =
      typeof f.type === "string" ? f.type : undefined;
    userProps[f.name] = {
      type: INFO_EXTRACTOR_TYPE_MAP[declaredType ?? "string"] ?? "string",
      ...(typeof f.description === "string" && f.description
        ? { description: f.description }
        : {}),
    };
  }
  if (Object.keys(userProps).length === 0) return baseSchema;

  const cloned =
    typeof structuredClone === "function"
      ? structuredClone(baseSchema)
      : (JSON.parse(JSON.stringify(baseSchema)) as JsonSchemaNode);
  const outputNode = cloned.properties?.output;
  if (!outputNode || typeof outputNode !== "object") {
    // The backend schema shape changed; autocomplete can't enrich without
    // the expected nesting. Warn so the mismatch is visible in dev builds.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        "[expression-autocomplete] Information Extractor outputSchema missing `output` property; dynamic field hints skipped.",
      );
    }
    return cloned;
  }

  if (!outputNode.properties) outputNode.properties = {};
  const existing = outputNode.properties.extracted;
  const existingProps =
    existing && typeof existing === "object" && existing.properties
      ? existing.properties
      : {};
  outputNode.properties.extracted = {
    type: "object",
    properties: { ...existingProps, ...userProps },
  };
  return cloned;
}
