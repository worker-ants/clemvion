import { describe, it, expect } from "vitest";
import {
  parsePath,
  resolveNestedValue,
  getNestedKeys,
  getSchemaKeys,
  getValueType,
  splitPathAndLeaf,
} from "../resolve-nested-path";
import type { JsonSchemaNode } from "@/lib/node-definitions/types";

describe("getValueType", () => {
  it("returns correct types", () => {
    expect(getValueType(null)).toBe("null");
    expect(getValueType(undefined)).toBe("undefined");
    expect(getValueType("hello")).toBe("string");
    expect(getValueType(42)).toBe("number");
    expect(getValueType(true)).toBe("boolean");
    expect(getValueType({})).toBe("object");
    expect(getValueType([])).toBe("array");
  });
});

describe("parsePath", () => {
  it("returns empty array for empty string", () => {
    expect(parsePath("")).toEqual([]);
  });

  it("splits simple dot path", () => {
    expect(parsePath("body.data")).toEqual(["body", "data"]);
  });

  it("handles bracket notation", () => {
    expect(parsePath("items[0].name")).toEqual(["items", "[0]", "name"]);
  });

  it("handles single segment", () => {
    expect(parsePath("name")).toEqual(["name"]);
  });

  it("handles multiple bracket accesses", () => {
    expect(parsePath("data[0].items[1].value")).toEqual([
      "data",
      "[0]",
      "items",
      "[1]",
      "value",
    ]);
  });
});

describe("resolveNestedValue", () => {
  const sample = {
    body: {
      data: {
        users: [
          { name: "Alice", age: 30 },
          { name: "Bob", age: 25 },
        ],
        count: 2,
      },
      status: "ok",
    },
    items: [
      { id: 1, label: "first" },
      { id: 2, label: "second" },
    ],
    name: "test",
    empty: {},
    nullVal: null,
    count: 0,
    flag: false,
    emptyStr: "",
  };

  it("returns entire sample for empty path", () => {
    expect(resolveNestedValue(sample, "")).toBe(sample);
  });

  it("resolves single level", () => {
    expect(resolveNestedValue(sample, "name")).toBe("test");
  });

  it("resolves nested object", () => {
    expect(resolveNestedValue(sample, "body.data")).toEqual({
      users: [
        { name: "Alice", age: 30 },
        { name: "Bob", age: 25 },
      ],
      count: 2,
    });
  });

  it("resolves deeply nested value", () => {
    expect(resolveNestedValue(sample, "body.data.count")).toBe(2);
  });

  it("resolves array index", () => {
    expect(resolveNestedValue(sample, "items[0]")).toEqual({
      id: 1,
      label: "first",
    });
  });

  it("resolves array index then field", () => {
    expect(resolveNestedValue(sample, "items[0].label")).toBe("first");
  });

  it("resolves nested array", () => {
    expect(resolveNestedValue(sample, "body.data.users[1].name")).toBe("Bob");
  });

  it("returns null for non-existent key", () => {
    expect(resolveNestedValue(sample, "nonexistent")).toBeNull();
  });

  it("returns null for non-existent nested key", () => {
    expect(resolveNestedValue(sample, "body.nonexistent.deep")).toBeNull();
  });

  it("returns null for null value in path", () => {
    expect(resolveNestedValue(sample, "nullVal.something")).toBeNull();
  });

  it("returns null for primitive in path", () => {
    expect(resolveNestedValue(sample, "name.something")).toBeNull();
  });

  it("returns null for out-of-bounds array index", () => {
    expect(resolveNestedValue(sample, "items[99]")).toBeNull();
  });

  it("returns null for array index on non-array", () => {
    expect(resolveNestedValue(sample, "body[0]")).toBeNull();
  });

  it("preserves falsy value 0", () => {
    expect(resolveNestedValue(sample, "count")).toBe(0);
  });

  it("preserves falsy value false", () => {
    expect(resolveNestedValue(sample, "flag")).toBe(false);
  });

  it("preserves falsy value empty string", () => {
    expect(resolveNestedValue(sample, "emptyStr")).toBe("");
  });

  it("returns null for path exceeding MAX_DEPTH", () => {
    // Build a 11-level deep path which exceeds MAX_DEPTH=10
    const deepPath = Array.from({ length: 11 }, (_, i) => `l${i}`).join(".");
    expect(resolveNestedValue(sample, deepPath)).toBeNull();
  });
});

describe("getNestedKeys", () => {
  const sample = {
    body: {
      data: { status: 200, message: "ok" },
      headers: { contentType: "json" },
    },
    items: [
      { id: 1, name: "first", meta: { tag: "a" } },
      { id: 2, name: "second", meta: { tag: "b" } },
    ],
    name: "test",
    count: 42,
    empty: {},
    primitiveArray: [1, 2, 3],
    nullVal: null,
  };

  it("returns top-level keys for empty path", () => {
    const keys = getNestedKeys(sample, "");
    expect(keys.map((k) => k.key)).toEqual([
      "body",
      "items",
      "name",
      "count",
      "empty",
      "primitiveArray",
      "nullVal",
    ]);
  });

  it("returns types for top-level keys", () => {
    const keys = getNestedKeys(sample, "");
    const bodyKey = keys.find((k) => k.key === "body");
    expect(bodyKey?.type).toBe("object");
    const itemsKey = keys.find((k) => k.key === "items");
    expect(itemsKey?.type).toBe("array");
    const nameKey = keys.find((k) => k.key === "name");
    expect(nameKey?.type).toBe("string");
  });

  it("returns nested object keys", () => {
    const keys = getNestedKeys(sample, "body");
    expect(keys.map((k) => k.key)).toEqual(["data", "headers"]);
  });

  it("returns deeply nested keys", () => {
    const keys = getNestedKeys(sample, "body.data");
    expect(keys.map((k) => k.key)).toEqual(["status", "message"]);
  });

  it("returns first array element keys for array path", () => {
    const keys = getNestedKeys(sample, "items");
    expect(keys.map((k) => k.key)).toEqual(["id", "name", "meta"]);
  });

  it("returns nested keys within array element", () => {
    const keys = getNestedKeys(sample, "items[0].meta");
    expect(keys.map((k) => k.key)).toEqual(["tag"]);
  });

  it("returns empty for primitive value", () => {
    expect(getNestedKeys(sample, "name")).toEqual([]);
  });

  it("returns empty for null value", () => {
    expect(getNestedKeys(sample, "nullVal")).toEqual([]);
  });

  it("returns empty for non-existent path", () => {
    expect(getNestedKeys(sample, "nonexistent")).toEqual([]);
  });

  it("returns empty for empty object", () => {
    expect(getNestedKeys(sample, "empty")).toEqual([]);
  });

  it("returns empty for primitive array", () => {
    expect(getNestedKeys(sample, "primitiveArray")).toEqual([]);
  });
});

describe("splitPathAndLeaf", () => {
  it("splits at last dot", () => {
    expect(splitPathAndLeaf("body.data.status")).toEqual({
      parentPath: "body.data",
      leafPrefix: "status",
    });
  });

  it("handles single segment", () => {
    expect(splitPathAndLeaf("name")).toEqual({
      parentPath: "",
      leafPrefix: "name",
    });
  });

  it("handles one dot", () => {
    expect(splitPathAndLeaf("body.data")).toEqual({
      parentPath: "body",
      leafPrefix: "data",
    });
  });

  it("handles empty leaf", () => {
    expect(splitPathAndLeaf("body.")).toEqual({
      parentPath: "body",
      leafPrefix: "",
    });
  });

  it("handles empty string", () => {
    expect(splitPathAndLeaf("")).toEqual({
      parentPath: "",
      leafPrefix: "",
    });
  });

  it("handles bracket notation in path", () => {
    expect(splitPathAndLeaf("items[0].name")).toEqual({
      parentPath: "items[0]",
      leafPrefix: "name",
    });
  });
});

describe("getSchemaKeys", () => {
  it("returns [] for undefined schema", () => {
    expect(getSchemaKeys(undefined, "")).toEqual([]);
  });

  it("returns top-level properties with types for root path", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        id: { type: "number" },
        name: { type: "string" },
        tags: { type: "array", items: { type: "string" } },
      },
    };
    expect(getSchemaKeys(schema, "")).toEqual([
      { key: "id", type: "number" },
      { key: "name", type: "string" },
      { key: "tags", type: "array" },
    ]);
  });

  it("descends through nested object path", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        body: {
          type: "object",
          properties: {
            data: {
              type: "object",
              properties: {
                status: { type: "number" },
                message: { type: "string" },
              },
            },
          },
        },
      },
    };
    expect(getSchemaKeys(schema, "body.data")).toEqual([
      { key: "status", type: "number" },
      { key: "message", type: "string" },
    ]);
  });

  it("unwraps array items to expose their object keys", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "number" },
              label: { type: "string" },
            },
          },
        },
      },
    };
    // items has object items → keys of the item object surface
    expect(getSchemaKeys(schema, "items")).toEqual([
      { key: "id", type: "number" },
      { key: "label", type: "string" },
    ]);
  });

  it("walks into items on bracket index segments", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        items: {
          type: "array",
          items: {
            type: "object",
            properties: { name: { type: "string" } },
          },
        },
      },
    };
    expect(getSchemaKeys(schema, "items[0]")).toEqual([
      { key: "name", type: "string" },
    ]);
  });

  it("returns [] when the path doesn't resolve", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: { known: { type: "string" } },
    };
    expect(getSchemaKeys(schema, "unknown.path")).toEqual([]);
  });

  it("returns [] on primitive leaf (no properties to hint)", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: { name: { type: "string" } },
    };
    expect(getSchemaKeys(schema, "name")).toEqual([]);
  });

  it("handles array-typed property values", () => {
    // JSON Schema allows `type: ["string", "null"]` — the helper picks the
    // first entry for type display. Only leaf children that are objects
    // produce keys, so this schema should yield nothing deeper.
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        value: { type: ["string", "null"] },
      },
    };
    expect(getSchemaKeys(schema, "")).toEqual([
      { key: "value", type: "string" },
    ]);
  });

  it("returns [] when path exceeds MAX_DEPTH (10 segments)", () => {
    // Build a schema nested 12 levels deep and verify the guard rejects it.
    let schema: JsonSchemaNode = { type: "string" };
    const parts: string[] = [];
    for (let i = 0; i < 12; i++) {
      const key = `l${i}`;
      parts.unshift(key);
      schema = { type: "object", properties: { [key]: schema } };
    }
    expect(getSchemaKeys(schema, parts.join("."))).toEqual([]);
  });

  it("falls back to 'unknown' when schema declares no type and no properties", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        anything: {},
      },
    };
    expect(getSchemaKeys(schema, "")).toEqual([
      { key: "anything", type: "unknown" },
    ]);
  });

  it("infers 'object' when a child has properties but no explicit type", () => {
    const schema: JsonSchemaNode = {
      type: "object",
      properties: {
        nested: {
          properties: { leaf: { type: "string" } },
        },
      },
    };
    expect(getSchemaKeys(schema, "")).toEqual([
      { key: "nested", type: "object" },
    ]);
  });
});
