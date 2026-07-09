import { describe, it, expect, vi, afterEach } from "vitest";
import {
  enrichFormOutputSchema,
  enrichInfoExtractorOutputSchema,
  enrichManualTriggerOutputSchema,
  enrichTableOutputSchema,
  enrichTransformOutputSchema,
  OUTPUT_SCHEMA_ENRICHERS,
} from "../node-output-schema-enrichers";
import type { JsonSchemaNode } from "@/lib/node-definitions/types";

// Post Stage 1 of the node-specs-improvement rollout: info_extractor emits
// `output.result.extracted.<field>` rather than `output.extracted.<field>`.
// The autocomplete enricher injects user-declared fields at the new path.
const baseSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    output: {
      type: "object",
      properties: {
        result: {
          type: "object",
          properties: {
            extracted: {
              type: "object",
              properties: {
                existingFromSchema: { type: "string" },
              },
            },
          },
        },
      },
    },
  },
};

describe("enrichInfoExtractorOutputSchema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns base schema as-is when baseSchema is undefined", () => {
    expect(enrichInfoExtractorOutputSchema(undefined, {})).toBeUndefined();
  });

  it("returns base schema as-is when config is undefined", () => {
    expect(enrichInfoExtractorOutputSchema(baseSchema, undefined)).toBe(baseSchema);
  });

  it("returns base schema as-is when outputSchema array is empty", () => {
    expect(
      enrichInfoExtractorOutputSchema(baseSchema, { outputSchema: [] }),
    ).toBe(baseSchema);
  });

  it("returns base schema when outputSchema is not an array", () => {
    expect(
      enrichInfoExtractorOutputSchema(baseSchema, { outputSchema: "not-array" }),
    ).toBe(baseSchema);
  });

  it("injects user-declared fields under output.result.extracted.properties", () => {
    const result = enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [
        { name: "orderId", type: "string", description: "Order identifier" },
        { name: "amount", type: "number" },
      ],
    });
    const extracted =
      result?.properties?.output?.properties?.result?.properties?.extracted;
    expect(extracted?.properties).toEqual({
      existingFromSchema: { type: "string" },
      orderId: { type: "string", description: "Order identifier" },
      amount: { type: "number" },
    });
  });

  it("preserves the base schema (no mutation)", () => {
    const clone: JsonSchemaNode = JSON.parse(JSON.stringify(baseSchema));
    enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [{ name: "x", type: "string" }],
    });
    expect(baseSchema).toEqual(clone);
  });

  it("falls back to 'string' for unknown/missing field types", () => {
    const result = enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [
        { name: "unknownType", type: "not-a-type" },
        { name: "noType" },
      ],
    });
    const extracted =
      result?.properties?.output?.properties?.result?.properties?.extracted;
    expect(extracted?.properties?.unknownType).toEqual({ type: "string" });
    expect(extracted?.properties?.noType).toEqual({ type: "string" });
  });

  it("skips fields with missing or non-string names", () => {
    const result = enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [
        { type: "string" },
        { name: "", type: "string" },
        { name: 123, type: "string" },
      ],
    });
    // None of the bad entries were added → base schema passed through.
    expect(result).toBe(baseSchema);
  });

  it("skips unsafe prototype keys to prevent prototype pollution", () => {
    const result = enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [
        { name: "__proto__", type: "string" },
        { name: "constructor", type: "string" },
        { name: "prototype", type: "string" },
        { name: "safeName", type: "string" },
      ],
    });
    const extracted =
      result?.properties?.output?.properties?.result?.properties?.extracted;
    expect(Object.keys(extracted?.properties ?? {})).toEqual([
      "existingFromSchema",
      "safeName",
    ]);
  });

  it("skips identifiers with special characters", () => {
    const result = enrichInfoExtractorOutputSchema(baseSchema, {
      outputSchema: [
        { name: "has space", type: "string" },
        { name: "has-dash", type: "string" },
        { name: "1startsWithDigit", type: "string" },
        { name: "valid_name", type: "string" },
      ],
    });
    const extracted =
      result?.properties?.output?.properties?.result?.properties?.extracted;
    expect(Object.keys(extracted?.properties ?? {})).toEqual([
      "existingFromSchema",
      "valid_name",
    ]);
  });

  it("warns and returns cloned schema when output.properties is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const shapeWithoutOutput: JsonSchemaNode = {
      type: "object",
      properties: { somethingElse: { type: "string" } },
    };
    const result = enrichInfoExtractorOutputSchema(shapeWithoutOutput, {
      outputSchema: [{ name: "x", type: "string" }],
    });
    // The schema is still returned (cloned) so callers can use it.
    expect(result).not.toBe(shapeWithoutOutput);
    expect(result?.properties?.somethingElse).toEqual({ type: "string" });
    expect(warn).toHaveBeenCalled();
  });

  it("creates output.result.extracted when intermediate nodes are missing", () => {
    const shape: JsonSchemaNode = {
      type: "object",
      properties: { output: { type: "object" } },
    };
    const result = enrichInfoExtractorOutputSchema(shape, {
      outputSchema: [{ name: "newField", type: "number" }],
    });
    const extracted =
      result?.properties?.output?.properties?.result?.properties?.extracted;
    expect(extracted?.properties).toEqual({ newField: { type: "number" } });
  });
});

// Form node writes `output.interaction.data.<userField>` on submit. The
// enricher projects config.fields[].name into the static schema so
// `$node["Form"].output.interaction.data.<field>` autocompletes pre-run.
const formBaseSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    output: {
      type: "object",
      properties: {
        interaction: {
          type: "object",
          properties: {
            data: { type: "object", properties: {} },
          },
        },
      },
    },
  },
};

describe("enrichFormOutputSchema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when baseSchema is undefined", () => {
    expect(enrichFormOutputSchema(undefined, {})).toBeUndefined();
  });

  it("returns base schema unchanged when fields is empty or missing", () => {
    expect(enrichFormOutputSchema(formBaseSchema, undefined)).toBe(
      formBaseSchema,
    );
    expect(enrichFormOutputSchema(formBaseSchema, { fields: [] })).toBe(
      formBaseSchema,
    );
    expect(
      enrichFormOutputSchema(formBaseSchema, { fields: "not-array" }),
    ).toBe(formBaseSchema);
  });

  it("injects user fields under output.interaction.data with type mapping", () => {
    const result = enrichFormOutputSchema(formBaseSchema, {
      fields: [
        { name: "email", type: "email", label: "Email address" },
        { name: "age", type: "number" },
        { name: "agreed", type: "checkbox" },
        { name: "note", type: "textarea" },
      ],
    });
    const data =
      result?.properties?.output?.properties?.interaction?.properties?.data;
    expect(data?.properties).toEqual({
      email: { type: "string", description: "Email address" },
      age: { type: "number" },
      agreed: { type: "boolean" },
      note: { type: "string" },
    });
  });

  it("falls back to 'string' for unknown form field types", () => {
    const result = enrichFormOutputSchema(formBaseSchema, {
      fields: [{ name: "mystery", type: "not-a-type" }],
    });
    const data =
      result?.properties?.output?.properties?.interaction?.properties?.data;
    expect(data?.properties?.mystery).toEqual({ type: "string" });
  });

  it("skips unsafe prototype keys and invalid identifiers", () => {
    const result = enrichFormOutputSchema(formBaseSchema, {
      fields: [
        { name: "__proto__", type: "text" },
        { name: "has space", type: "text" },
        { name: "1bad", type: "text" },
        { name: "good_name", type: "text" },
      ],
    });
    const data =
      result?.properties?.output?.properties?.interaction?.properties?.data;
    expect(Object.keys(data?.properties ?? {})).toEqual(["good_name"]);
  });

  it("does not mutate the base schema", () => {
    const clone: JsonSchemaNode = JSON.parse(JSON.stringify(formBaseSchema));
    enrichFormOutputSchema(formBaseSchema, {
      fields: [{ name: "x", type: "text" }],
    });
    expect(formBaseSchema).toEqual(clone);
  });

  it("warns and returns cloned schema when output.properties is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const shape: JsonSchemaNode = {
      type: "object",
      properties: { other: { type: "string" } },
    };
    const result = enrichFormOutputSchema(shape, {
      fields: [{ name: "x", type: "text" }],
    });
    expect(result).not.toBe(shape);
    expect(warn).toHaveBeenCalled();
  });

  it("creates output.interaction.data when intermediate nodes are missing", () => {
    const shape: JsonSchemaNode = {
      type: "object",
      properties: { output: { type: "object" } },
    };
    const result = enrichFormOutputSchema(shape, {
      fields: [{ name: "newField", type: "text" }],
    });
    const data =
      result?.properties?.output?.properties?.interaction?.properties?.data;
    expect(data?.properties).toEqual({ newField: { type: "string" } });
  });
});

// Table node's output.rows[].<field> is populated from config.columns[].field
// at execute time. The enricher projects those field names into rows[].items
// so autocomplete hints work pre-run.
const tableBaseSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    output: {
      type: "object",
      properties: {
        rows: {
          type: "array",
          items: { type: "object", properties: {} },
        },
      },
    },
  },
};

describe("enrichTableOutputSchema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when baseSchema is undefined", () => {
    expect(enrichTableOutputSchema(undefined, {})).toBeUndefined();
  });

  it("returns base schema unchanged when columns is empty or missing", () => {
    expect(enrichTableOutputSchema(tableBaseSchema, undefined)).toBe(
      tableBaseSchema,
    );
    expect(enrichTableOutputSchema(tableBaseSchema, { columns: [] })).toBe(
      tableBaseSchema,
    );
  });

  it("projects column fields into rows.items.properties with labels as descriptions", () => {
    const result = enrichTableOutputSchema(tableBaseSchema, {
      columns: [
        { field: "name", label: "Name" },
        { field: "status" },
      ],
    });
    const items = result?.properties?.output?.properties?.rows?.items;
    expect(items?.properties).toEqual({
      name: { description: "Name" },
      status: {},
    });
  });

  it("skips expression-valued column fields", () => {
    const result = enrichTableOutputSchema(tableBaseSchema, {
      columns: [
        { field: "{{ $sourceItem.x }}", label: "Expr" },
        { field: "plainField", label: "Plain" },
      ],
    });
    const items = result?.properties?.output?.properties?.rows?.items;
    expect(Object.keys(items?.properties ?? {})).toEqual(["plainField"]);
  });

  it("skips unsafe prototype keys and malformed identifiers", () => {
    const result = enrichTableOutputSchema(tableBaseSchema, {
      columns: [
        { field: "__proto__" },
        { field: "has space" },
        { field: "safe_name" },
      ],
    });
    const items = result?.properties?.output?.properties?.rows?.items;
    expect(Object.keys(items?.properties ?? {})).toEqual(["safe_name"]);
  });

  it("does not mutate the base schema", () => {
    const clone: JsonSchemaNode = JSON.parse(JSON.stringify(tableBaseSchema));
    enrichTableOutputSchema(tableBaseSchema, {
      columns: [{ field: "x", label: "X" }],
    });
    expect(tableBaseSchema).toEqual(clone);
  });
});

// Transform mutates input per operation sequence. Only top-level keys
// explicitly created (set_field) or renamed (rename_field.to) are projected.
const transformBaseSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    output: {}, // z.unknown() → no properties
  },
};

describe("enrichTransformOutputSchema", () => {
  it("returns undefined when baseSchema is undefined", () => {
    expect(enrichTransformOutputSchema(undefined, {})).toBeUndefined();
  });

  it("returns base schema unchanged when operations is empty or missing", () => {
    expect(enrichTransformOutputSchema(transformBaseSchema, undefined)).toBe(
      transformBaseSchema,
    );
    expect(
      enrichTransformOutputSchema(transformBaseSchema, { operations: [] }),
    ).toBe(transformBaseSchema);
  });

  it("projects set_field and rename_field target names into output", () => {
    const result = enrichTransformOutputSchema(transformBaseSchema, {
      operations: [
        { type: "set_field", field: "total", value: 42 },
        { type: "rename_field", from: "old", to: "newName" },
        { type: "remove_field", field: "tmp" },
      ],
    });
    expect(result?.properties?.output?.properties).toEqual({
      total: {},
      newName: {},
    });
  });

  it("skips nested paths (dot-containing field / to)", () => {
    const result = enrichTransformOutputSchema(transformBaseSchema, {
      operations: [
        { type: "set_field", field: "user.name", value: "x" },
        { type: "rename_field", from: "a", to: "parent.child" },
      ],
    });
    expect(result).toBe(transformBaseSchema); // nothing projected → base returned
  });

  it("skips unsafe identifiers", () => {
    const result = enrichTransformOutputSchema(transformBaseSchema, {
      operations: [
        { type: "set_field", field: "__proto__", value: "x" },
        { type: "set_field", field: "has space", value: "x" },
        { type: "set_field", field: "good", value: "x" },
      ],
    });
    expect(Object.keys(result?.properties?.output?.properties ?? {})).toEqual([
      "good",
    ]);
  });

  it("does not mutate the base schema", () => {
    const clone: JsonSchemaNode = JSON.parse(
      JSON.stringify(transformBaseSchema),
    );
    enrichTransformOutputSchema(transformBaseSchema, {
      operations: [{ type: "set_field", field: "x", value: 1 }],
    });
    expect(transformBaseSchema).toEqual(clone);
  });
});

// Manual Trigger resolves each declared parameter into `output.parameters.<name>`
// (name-keyed object), while `config.parameters` stays the raw definition array.
// The enricher projects config.parameters[].name into output.parameters so
// `$node["Manual Trigger"].output.parameters.<name>` autocompletes pre-run.
// Base shape mirrors the backend manualTriggerOutputSchema: output.parameters is
// an open record (no `properties`) until enriched.
const manualTriggerBaseSchema: JsonSchemaNode = {
  type: "object",
  properties: {
    config: {
      type: "object",
      properties: { parameters: { type: "array" } },
    },
    output: {
      type: "object",
      properties: {
        parameters: { type: "object" },
      },
    },
  },
};

describe("enrichManualTriggerOutputSchema", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns undefined when baseSchema is undefined", () => {
    expect(enrichManualTriggerOutputSchema(undefined, {})).toBeUndefined();
  });

  it("returns base schema unchanged when parameters is empty or missing", () => {
    expect(enrichManualTriggerOutputSchema(manualTriggerBaseSchema, undefined)).toBe(
      manualTriggerBaseSchema,
    );
    expect(
      enrichManualTriggerOutputSchema(manualTriggerBaseSchema, { parameters: [] }),
    ).toBe(manualTriggerBaseSchema);
    expect(
      enrichManualTriggerOutputSchema(manualTriggerBaseSchema, {
        parameters: "not-array",
      }),
    ).toBe(manualTriggerBaseSchema);
  });

  it("injects declared params under output.parameters with type mapping", () => {
    const result = enrichManualTriggerOutputSchema(manualTriggerBaseSchema, {
      parameters: [
        { name: "region", type: "string", defaultValue: "인천", description: "지역" },
        { name: "count", type: "number" },
        { name: "verbose", type: "boolean" },
        { name: "payload", type: "object" },
        { name: "items", type: "array" },
      ],
    });
    const params = result?.properties?.output?.properties?.parameters;
    expect(params?.properties).toEqual({
      region: { type: "string", description: "지역" },
      count: { type: "number" },
      verbose: { type: "boolean" },
      payload: { type: "object" },
      items: { type: "array" },
    });
  });

  it("falls back to 'string' for missing or unknown param types", () => {
    const result = enrichManualTriggerOutputSchema(manualTriggerBaseSchema, {
      parameters: [
        { name: "noType" },
        { name: "weird", type: "not-a-type" },
      ],
    });
    const params = result?.properties?.output?.properties?.parameters;
    expect(params?.properties?.noType).toEqual({ type: "string" });
    expect(params?.properties?.weird).toEqual({ type: "string" });
  });

  it("skips unsafe prototype keys and invalid identifiers", () => {
    const result = enrichManualTriggerOutputSchema(manualTriggerBaseSchema, {
      parameters: [
        { name: "__proto__", type: "string" },
        { name: "has space", type: "string" },
        { name: "1bad", type: "string" },
        { name: "good_name", type: "string" },
      ],
    });
    const params = result?.properties?.output?.properties?.parameters;
    expect(Object.keys(params?.properties ?? {})).toEqual(["good_name"]);
  });

  it("does not mutate the base schema", () => {
    const clone: JsonSchemaNode = JSON.parse(
      JSON.stringify(manualTriggerBaseSchema),
    );
    enrichManualTriggerOutputSchema(manualTriggerBaseSchema, {
      parameters: [{ name: "region", type: "string" }],
    });
    expect(manualTriggerBaseSchema).toEqual(clone);
  });

  it("warns and returns cloned schema when output property is missing", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const shape: JsonSchemaNode = {
      type: "object",
      properties: { other: { type: "string" } },
    };
    const result = enrichManualTriggerOutputSchema(shape, {
      parameters: [{ name: "region", type: "string" }],
    });
    expect(result).not.toBe(shape);
    expect(warn).toHaveBeenCalled();
  });

  it("creates output.parameters.properties when it is an open record", () => {
    const shape: JsonSchemaNode = {
      type: "object",
      properties: { output: { type: "object" } },
    };
    const result = enrichManualTriggerOutputSchema(shape, {
      parameters: [{ name: "region", type: "string", defaultValue: "인천" }],
    });
    const params = result?.properties?.output?.properties?.parameters;
    expect(params?.properties).toEqual({ region: { type: "string" } });
  });
});

// The registry is the single dispatch point for use-expression-context's two
// enrichment sites; guard that every enricher is wired in exactly once so a new
// node type can't be added to one site and missed at the other.
describe("OUTPUT_SCHEMA_ENRICHERS registry", () => {
  it("maps each node type to its enricher function", () => {
    expect(OUTPUT_SCHEMA_ENRICHERS).toEqual({
      information_extractor: enrichInfoExtractorOutputSchema,
      form: enrichFormOutputSchema,
      table: enrichTableOutputSchema,
      transform: enrichTransformOutputSchema,
      manual_trigger: enrichManualTriggerOutputSchema,
    });
  });

  it("returns undefined for an unregistered node type (no dispatch)", () => {
    expect(OUTPUT_SCHEMA_ENRICHERS["http_request"]).toBeUndefined();
  });
});
