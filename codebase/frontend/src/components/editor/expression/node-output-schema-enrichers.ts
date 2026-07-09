/**
 * Per-node-type enrichers that extend the static backend `outputSchema` with
 * fields derived from each node instance's `config`. Used by the expression
 * autocomplete to hint user-declared properties (e.g. Information Extractor's
 * configurable output fields) even when the node has never executed.
 *
 * These enrichers are a frontend-only concern: the returned schema augments
 * autocomplete suggestions, it is not part of runtime validation.
 *
 * Shared skeleton: all enrichers (1) short-circuit to the base schema when
 * there is nothing to project, (2) clone the base before mutating, (3) project
 * `config`-declared names into a nested location. Four of them merge into the
 * existing `output` node via {@link enrichByProjecting}; Transform is the
 * exception — it REPLACES `output` wholesale. New node types plug in by adding
 * one entry to {@link OUTPUT_SCHEMA_ENRICHERS} at the bottom.
 */

import type { JsonSchemaNode } from "@/lib/node-definitions/types";

/**
 * Shared identity guard for node config type enums whose values are already
 * JSON-schema types — Information Extractor's `OutputField.type` and Manual
 * Trigger's param `type` both declare exactly `string|number|boolean|object|
 * array`. Anything outside the enum falls back to `string`. (Form fields have
 * their own non-identity map — `date`/`file`/`select` etc. — see below.)
 */
const JSON_SCHEMA_IDENTITY_TYPE_MAP: Record<string, string> = {
  string: "string",
  number: "number",
  boolean: "boolean",
  object: "object",
  array: "array",
};

/**
 * Matches the Form node's `config.fields[].type` enum (form.schema.ts).
 * `date` and `file` are upstream-only UI types; at runtime they arrive as
 * strings, so we surface a plain `string` hint for both. `checkbox` renders
 * as a boolean; `select`/`radio` values are typically string identifiers.
 */
const FORM_FIELD_TYPE_MAP: Record<string, string> = {
  text: "string",
  email: "string",
  textarea: "string",
  number: "number",
  checkbox: "boolean",
  select: "string",
  radio: "string",
  date: "string",
  file: "string",
};

/** Safe object property name — rejects `__proto__`, `constructor`, `prototype`, etc. */
const SAFE_IDENTIFIER_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

function isSafeFieldName(name: unknown): name is string {
  if (typeof name !== "string" || name.length === 0) return false;
  if (UNSAFE_KEYS.has(name)) return false;
  return SAFE_IDENTIFIER_RE.test(name);
}

/** Deep-clone a schema before mutating (structuredClone with a JSON fallback). */
function cloneSchema(schema: JsonSchemaNode): JsonSchemaNode {
  return typeof structuredClone === "function"
    ? structuredClone(schema)
    : (JSON.parse(JSON.stringify(schema)) as JsonSchemaNode);
}

/**
 * Walk each config item through `extractOne`, collecting `name → schema` pairs
 * into a null-prototype object (prototype-pollution safe). `extractOne` returns
 * `null` to skip an item (unsafe/absent name, expression-valued key, etc.).
 */
function collectProps(
  items: unknown[],
  extractOne: (
    item: Record<string, unknown>,
  ) => { name: string; schema: JsonSchemaNode } | null,
): Record<string, JsonSchemaNode> {
  const props: Record<string, JsonSchemaNode> = Object.create(null);
  for (const item of items) {
    const r = extractOne((item ?? {}) as Record<string, unknown>);
    if (r) props[r.name] = r.schema;
  }
  return props;
}

/**
 * Get-or-create an object-typed child at `parent.properties[key]`, preserving
 * an existing node (used for intermediate wrapper nodes like `result` /
 * `interaction`). Ensures `.properties` exists and returns the child.
 */
function getOrCreateObjectChild(
  parent: JsonSchemaNode,
  key: string,
): JsonSchemaNode {
  if (!parent.properties) parent.properties = {};
  const existing = parent.properties[key];
  const node: JsonSchemaNode =
    existing && typeof existing === "object"
      ? existing
      : { type: "object", properties: {} };
  if (!node.properties) node.properties = {};
  parent.properties[key] = node;
  return node;
}

/**
 * Replace the leaf `parent.properties[key]` with an object node whose
 * `properties` are the existing leaf props merged with `userProps`. Matches the
 * per-enricher leaf assignment (the base leaf is an open record, so its other
 * fields are intentionally dropped).
 */
function mergeLeafProps(
  parent: JsonSchemaNode,
  key: string,
  userProps: Record<string, JsonSchemaNode>,
): void {
  if (!parent.properties) parent.properties = {};
  const existing = parent.properties[key];
  const existingProps =
    existing && typeof existing === "object" && existing.properties
      ? existing.properties
      : {};
  parent.properties[key] = {
    type: "object",
    properties: { ...existingProps, ...userProps },
  };
}

/**
 * Shared skeleton for enrichers that MERGE projected props into a nested
 * location under the existing `output` node (info_extractor / form / table /
 * manual_trigger). Handles the empty-source short-circuit, the safe clone, and
 * the missing-`output` dev-warn fallback; the caller supplies the source
 * extraction (`buildUserProps`) and the final `attach`.
 *
 * Transform is intentionally NOT routed through here — it replaces `output`
 * wholesale rather than merging into it.
 */
function enrichByProjecting(
  baseSchema: JsonSchemaNode | undefined,
  rawItems: unknown,
  buildUserProps: (items: unknown[]) => Record<string, JsonSchemaNode>,
  attach: (
    outputNode: JsonSchemaNode,
    userProps: Record<string, JsonSchemaNode>,
  ) => void,
  warnLabel: string,
): JsonSchemaNode | undefined {
  if (!baseSchema) return baseSchema;
  if (!Array.isArray(rawItems) || rawItems.length === 0) return baseSchema;

  const userProps = buildUserProps(rawItems);
  if (Object.keys(userProps).length === 0) return baseSchema;

  const cloned = cloneSchema(baseSchema);
  const outputNode = cloned.properties?.output;
  if (!outputNode || typeof outputNode !== "object") {
    // The backend schema shape changed; autocomplete can't enrich without the
    // expected nesting. Warn so the mismatch is visible in dev builds.
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[expression-autocomplete] ${warnLabel} outputSchema missing \`output\` property; dynamic field hints skipped.`,
      );
    }
    return cloned;
  }
  if (!outputNode.properties) outputNode.properties = {};
  attach(outputNode, userProps);
  return cloned;
}

/**
 * Information Extractor declares user-configured output fields inside each
 * node instance's `config.outputSchema`. Project those names into the static
 * outputSchema so autocomplete can hint `.output.result.extracted.<name>`
 * even before the node has executed. Tolerant fall-through (undefined base,
 * empty fields, missing `output`) feeds UX hints only.
 */
export function enrichInfoExtractorOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  return enrichByProjecting(
    baseSchema,
    config?.outputSchema,
    (items) =>
      collectProps(items, (f) => {
        if (!isSafeFieldName(f?.name)) return null;
        const declaredType = typeof f.type === "string" ? f.type : undefined;
        return {
          name: f.name,
          schema: {
            type: JSON_SCHEMA_IDENTITY_TYPE_MAP[declaredType ?? "string"] ?? "string",
            ...(typeof f.description === "string" && f.description
              ? { description: f.description }
              : {}),
          },
        };
      }),
    (outputNode, userProps) => {
      const result = getOrCreateObjectChild(outputNode, "result");
      mergeLeafProps(result, "extracted", userProps);
    },
    "Information Extractor",
  );
}

/**
 * Form node fills `output.interaction.data` at submission time with each
 * user-declared field's submitted value. Project `config.fields[].name` into
 * the static outputSchema so `.output.interaction.data.<field>` autocompletes
 * before the form is ever filled.
 */
export function enrichFormOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  return enrichByProjecting(
    baseSchema,
    config?.fields,
    (items) =>
      collectProps(items, (f) => {
        if (!isSafeFieldName(f?.name)) return null;
        const declaredType = typeof f.type === "string" ? f.type : undefined;
        return {
          name: f.name,
          schema: {
            type: FORM_FIELD_TYPE_MAP[declaredType ?? "text"] ?? "string",
            ...(typeof f.label === "string" && f.label
              ? { description: f.label }
              : {}),
          },
        };
      }),
    (outputNode, userProps) => {
      const interaction = getOrCreateObjectChild(outputNode, "interaction");
      mergeLeafProps(interaction, "data", userProps);
    },
    "Form",
  );
}

/**
 * Table node populates `output.rows[i].<field>` from `config.columns[].field`
 * at execute time. Project each column's `field` (when it's a plain
 * identifier, not an expression) into `rows.items` so
 * `$node["Table"].output.rows[...].<field>` autocompletes pre-run.
 *
 * Expression-valued `field` entries (containing `{{ ... }}`) are skipped —
 * their runtime key isn't derivable from config alone. Labels are noted as
 * descriptions. (Attaches to `rows.items` — array items, not a keyed property —
 * so it does not use the shared `mergeLeafProps`.)
 */
export function enrichTableOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  return enrichByProjecting(
    baseSchema,
    config?.columns,
    (items) =>
      collectProps(items, (c) => {
        const fieldName = typeof c?.field === "string" ? c.field : undefined;
        if (!fieldName) return null;
        if (fieldName.includes("{{")) return null; // expression — unknowable key
        if (!isSafeFieldName(fieldName)) return null;
        return {
          name: fieldName,
          schema:
            typeof c.label === "string" && c.label
              ? { description: c.label }
              : {},
        };
      }),
    (outputNode, userProps) => {
      const existingRows = outputNode.properties!.rows;
      const rowsNode: JsonSchemaNode =
        existingRows && typeof existingRows === "object"
          ? existingRows
          : { type: "array" };
      const existingItems =
        rowsNode.items && typeof rowsNode.items === "object"
          ? rowsNode.items
          : ({ type: "object", properties: {} } as JsonSchemaNode);
      const existingRowProps =
        existingItems.properties && typeof existingItems.properties === "object"
          ? existingItems.properties
          : {};
      rowsNode.items = {
        type: "object",
        properties: { ...existingRowProps, ...userProps },
      };
      outputNode.properties!.rows = rowsNode;
    },
    "Table",
  );
}

/**
 * Transform node mutates the input in place — its output shape is the input
 * plus whatever `config.operations` explicitly create (`set_field`) or rename
 * (`rename_field` → `to`). Surface those top-level targets so
 * `$node["Transform"].output.<name>` autocompletes pre-run.
 *
 * Nested paths ("user.name") are skipped: projecting only the top segment would
 * over-claim. Unlike the other enrichers this REPLACES `output` (declared as
 * `z.unknown()` in the base schema) rather than merging into it, so it does not
 * use {@link enrichByProjecting}.
 */
export function enrichTransformOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  if (!baseSchema) return baseSchema;
  const operations = config?.operations;
  if (!Array.isArray(operations) || operations.length === 0) return baseSchema;

  const userProps = collectProps(operations, (op) => {
    const type = typeof op?.type === "string" ? op.type : undefined;
    if (type === "set_field" && typeof op.field === "string") {
      if (op.field.includes(".") || !isSafeFieldName(op.field)) return null;
      return { name: op.field, schema: {} };
    }
    if (type === "rename_field" && typeof op.to === "string") {
      if (op.to.includes(".") || !isSafeFieldName(op.to)) return null;
      return { name: op.to, schema: {} };
    }
    return null;
  });
  if (Object.keys(userProps).length === 0) return baseSchema;

  const cloned = cloneSchema(baseSchema);
  const outputNode: JsonSchemaNode = {
    type: "object",
    properties: { ...userProps },
  };
  if (!cloned.properties) cloned.properties = {};
  cloned.properties.output = outputNode;
  return cloned;
}

/**
 * Manual Trigger resolves each declared parameter into `output.parameters.<name>`
 * (the name-keyed runtime object), while `config.parameters` stays the raw
 * definition *array* — same name, orthogonal shape (manual-trigger spec §4/§5.1,
 * CONVENTIONS Principle 1.1). The base outputSchema declares `output.parameters`
 * as an open record (`z.record`), so param names aren't hinted. Project
 * `config.parameters[].name` into `output.parameters.<name>` so
 * `$node["Manual Trigger"].output.parameters.<name>` — and, for a direct
 * successor, `$input.parameters.<name>` and its `$params.<name>` shortcut —
 * autocompletes pre-run, steering users to the resolved values instead of the
 * array-shaped `config.parameters.<name>`, which never resolves by name. (The
 * `$params.` drill in use-expression-suggestions reads this same enriched
 * `inputSchema.parameters` for the direct successor.)
 */
export function enrichManualTriggerOutputSchema(
  baseSchema: JsonSchemaNode | undefined,
  config: Record<string, unknown> | undefined,
): JsonSchemaNode | undefined {
  return enrichByProjecting(
    baseSchema,
    config?.parameters,
    (items) =>
      collectProps(items, (p) => {
        if (!isSafeFieldName(p?.name)) return null;
        const declaredType = typeof p.type === "string" ? p.type : undefined;
        return {
          name: p.name,
          schema: {
            type: JSON_SCHEMA_IDENTITY_TYPE_MAP[declaredType ?? "string"] ?? "string",
            ...(typeof p.description === "string" && p.description
              ? { description: p.description }
              : {}),
          },
        };
      }),
    (outputNode, userProps) => {
      mergeLeafProps(outputNode, "parameters", userProps);
    },
    "Manual Trigger",
  );
}

/**
 * Registry mapping node `type` → its outputSchema enricher. Consumers
 * (`use-expression-context`) dispatch through this single table instead of a
 * per-call-site `if/else` chain, so a new node type is wired in exactly once.
 */
export const OUTPUT_SCHEMA_ENRICHERS: Record<
  string,
  (
    baseSchema: JsonSchemaNode | undefined,
    config: Record<string, unknown> | undefined,
  ) => JsonSchemaNode | undefined
> = {
  information_extractor: enrichInfoExtractorOutputSchema,
  form: enrichFormOutputSchema,
  table: enrichTableOutputSchema,
  transform: enrichTransformOutputSchema,
  manual_trigger: enrichManualTriggerOutputSchema,
};
