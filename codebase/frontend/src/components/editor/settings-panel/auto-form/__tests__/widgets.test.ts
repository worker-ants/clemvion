import { describe, it, expect } from "vitest";
import { buildNewItem } from "../widgets";
import type { JsonSchemaNode } from "@/lib/node-definitions";

// Regression coverage for the "field-array add row persists `{}`" bug:
// a native <select> shows its first option visually but never commits the
// value to form state unless the user fires onChange, so an enum field with no
// explicit `.default` was saved absent (e.g. presentationTools row `{}` →
// backend `RenderToolProvider: Skipping ... type: undefined`). buildNewItem now
// pre-fills single-select / enum fields with their first option.
describe("buildNewItem — enum/select first-option fallback", () => {
  it("pre-fills an enum field (no explicit default) with its first option", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["table", "chart", "carousel"],
          ui: { widget: "select" },
        },
      },
    };
    expect(buildNewItem(itemSchema, undefined)).toEqual({ type: "table" });
  });

  it("honors an explicit `.default` over the first-option fallback", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["table", "chart"],
          default: "chart",
        },
      },
    };
    expect(buildNewItem(itemSchema, undefined)).toEqual({ type: "chart" });
  });

  it("uses the first `ui.options` entry when options come from the UI hint", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        kind: {
          type: "string",
          ui: {
            widget: "select",
            options: [
              { value: "alpha", label: "Alpha" },
              { value: "beta", label: "Beta" },
            ],
          },
        },
      },
    };
    expect(buildNewItem(itemSchema, undefined)).toEqual({ kind: "alpha" });
  });

  it("does NOT pre-fill an array (multi-select) enum field", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        sections: {
          type: "array",
          items: { type: "string", enum: ["time", "timezone"] },
        },
      },
    };
    // multi-select "unset" ([] / absent) is meaningful — must stay absent.
    expect(buildNewItem(itemSchema, undefined)).toEqual({});
  });

  it("does NOT pre-fill a plain text field", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        description: { type: "string", ui: { widget: "text" } },
      },
    };
    expect(buildNewItem(itemSchema, undefined)).toEqual({});
  });

  it("keeps the required-id UUID behavior alongside the enum fallback", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        id: { type: "string" },
        type: { type: "string", enum: ["table", "chart"] },
      },
      required: ["id"],
    };
    const item = buildNewItem(itemSchema, undefined);
    expect(item.type).toBe("table");
    expect(typeof item.id).toBe("string");
    expect((item.id as string).length).toBeGreaterThan(0);
  });

  it("lets `ui.itemDefault` override the fallback", () => {
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        type: { type: "string", enum: ["table", "chart"] },
      },
    };
    expect(buildNewItem(itemSchema, { type: "chart" })).toEqual({
      type: "chart",
    });
  });

  it("mirrors the AI Agent presentationTools row shape (the reported bug)", () => {
    // presentationToolDefSchema: { type: enum(required), description?, defaults? }.
    // Adding a row used to yield `{}`; it must now yield `{ type: 'table' }`.
    const itemSchema: JsonSchemaNode = {
      type: "object",
      properties: {
        type: {
          type: "string",
          enum: ["table", "chart", "carousel", "template", "form"],
          ui: { label: "Type", widget: "select" },
        },
        description: { type: "string", ui: { widget: "text" } },
        defaults: { type: "object", ui: { widget: "json" } },
      },
    };
    expect(buildNewItem(itemSchema, undefined)).toEqual({ type: "table" });
  });
});
