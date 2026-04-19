import { describe, it, expect, vi, afterEach } from "vitest";
import { enrichInfoExtractorOutputSchema } from "../node-output-schema-enrichers";
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
