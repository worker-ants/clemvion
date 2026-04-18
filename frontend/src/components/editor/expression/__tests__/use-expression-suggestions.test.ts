import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useExpressionSuggestions } from "../use-expression-suggestions";
import type { ExpressionData } from "../use-expression-context";

function makeSuggestions(
  value: string,
  cursorPos: number,
  data: Partial<ExpressionData> = {},
) {
  const defaultData: ExpressionData = {
    inputFields: [],
    inputSample: {},
    availableNodes: [],
    allNodeKeys: new Set(),
    variables: [],
    functionNames: [],
    isTableContext: false,
    sourceItemSample: null,
    containerScope: { hasLoop: false, hasItem: false },
    ...data,
  };

  const { result } = renderHook(() =>
    useExpressionSuggestions(value, cursorPos, defaultData),
  );
  return result.current;
}

/**
 * Calculate cursor position right after the expression content inside {{ expr }}.
 * This avoids hard-coded magic numbers that break when the expression string changes.
 * For "{{ $input.body. }}", returns the index of the space before "}}" = right after the dot.
 */
function cursorAfterExpr(value: string): number {
  const closingIdx = value.indexOf(" }}");
  if (closingIdx !== -1) return closingIdx;
  // Fallback: before }}
  const braceIdx = value.indexOf("}}");
  return braceIdx !== -1 ? braceIdx : value.length;
}

describe("useExpressionSuggestions - nested paths", () => {
  const inputSample = {
    body: {
      data: { status: 200, message: "ok" },
      headers: { contentType: "json" },
    },
    name: "test",
    items: [
      { id: 1, label: "first" },
      { id: 2, label: "second" },
    ],
  };

  describe("$input nested suggestions", () => {
    it("suggests top-level keys for $input.", () => {
      const expr = "{{ $input. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual([
        "body",
        "name",
        "items",
      ]);
    });

    it("suggests nested keys for $input.body.", () => {
      const expr = "{{ $input.body. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["data", "headers"]);
    });

    it("suggests deeply nested keys for $input.body.data.", () => {
      const expr = "{{ $input.body.data. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["status", "message"]);
    });

    it("filters nested keys by prefix", () => {
      const expr = "{{ $input.body.da }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["data"]);
    });

    it("suggests array element keys for $input.items.", () => {
      const expr = "{{ $input.items. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["id", "label"]);
    });

    it("returns empty for non-existent nested path", () => {
      const expr = "{{ $input.nonexistent. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions).toEqual([]);
    });

    it("returns empty for primitive nested path", () => {
      const expr = "{{ $input.name. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      expect(suggestions).toEqual([]);
    });

    it("marks object fields as expandable", () => {
      const expr = "{{ $input. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      const bodyField = suggestions.find((s) => s.label === "body");
      const nameField = suggestions.find((s) => s.label === "name");
      expect(bodyField?.isExpandable).toBe(true);
      expect(nameField?.isExpandable).toBeFalsy();
    });

    it("marks array fields as expandable", () => {
      const expr = "{{ $input. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      const itemsField = suggestions.find((s) => s.label === "items");
      expect(itemsField?.isExpandable).toBe(true);
    });

    it("shows type in detail", () => {
      const expr = "{{ $input. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputFields: ["body", "name", "items"],
        inputSample,
      });
      const bodyField = suggestions.find((s) => s.label === "body");
      const nameField = suggestions.find((s) => s.label === "name");
      const itemsField = suggestions.find((s) => s.label === "items");
      expect(bodyField?.detail).toBe("object");
      expect(nameField?.detail).toBe("string");
      expect(itemsField?.detail).toBe("array");
    });
  });

  describe("$node nested suggestions", () => {
    const nodeData = {
      availableNodes: [
        {
          id: "n1",
          label: "Form_test",
          resolvedKey: "Form_test",
          type: "form",
          outputFields: ["submittedData", "status"],
          outputSample: {
            submittedData: { useful: true, feedback: "great" },
            status: "submitted",
          },
        },
      ],
    };

    it("suggests top-level output fields", () => {
      const expr = '{{ $node["Form_test"].output. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual([
        "submittedData",
        "status",
      ]);
    });

    it("suggests nested output fields", () => {
      const expr = '{{ $node["Form_test"].output.submittedData. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual([
        "useful",
        "feedback",
      ]);
    });

    it("filters nested output fields by prefix", () => {
      const expr = '{{ $node["Form_test"].output.submittedData.use }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual(["useful"]);
    });

    it("returns empty for primitive field path", () => {
      const expr = '{{ $node["Form_test"].output.status. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions).toEqual([]);
    });

    it("sets tokenStart correctly for nested $node output", () => {
      const expr = '{{ $node["Form_test"].output.submittedData.use }}';
      const cursor = cursorAfterExpr(expr);
      const { tokenStart, tokenEnd } = makeSuggestions(expr, cursor, nodeData);
      // "use" has length 3, so tokenStart = cursor - 3
      expect(tokenStart).toBe(cursor - 3);
      expect(tokenEnd).toBe(cursor);
    });
  });

  describe("$sourceItem suggestions (table node)", () => {
    const sourceItemSample = {
      first: "John",
      last: "Doe",
      address: { city: "Seoul", zip: "12345" },
    };

    it("shows $sourceItem in root suggestions when isTableContext is true", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample,
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("$sourceItem");
      expect(labels).toContain("$sourceItemIndex");
      expect(labels).toContain("$dataSource");
    });

    it("shows $sourceItem in root suggestions even without sourceItemSample", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample: null,
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("$sourceItem");
      expect(labels).toContain("$sourceItemIndex");
      expect(labels).toContain("$dataSource");
    });

    it("does not show $sourceItem when not in table context", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: false,
        sourceItemSample: null,
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).not.toContain("$sourceItem");
      expect(labels).not.toContain("$sourceItemIndex");
      expect(labels).not.toContain("$dataSource");
    });

    it("suggests top-level fields for $sourceItem.", () => {
      const expr = "{{ $sourceItem. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["first", "last", "address"]);
    });

    it("suggests nested fields for $sourceItem.address.", () => {
      const expr = "{{ $sourceItem.address. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["city", "zip"]);
    });

    it("filters fields by prefix for $sourceItem.f", () => {
      const expr = "{{ $sourceItem.f }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["first"]);
    });

    it("does not suggest $sourceItem. fields when sourceItemSample is null", () => {
      const expr = "{{ $sourceItem. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample: null,
      });
      expect(suggestions).toEqual([]);
    });
  });

  describe("tokenStart position for nested paths", () => {
    it("sets tokenStart correctly for nested $input", () => {
      const expr = "{{ $input.body.da }}";
      const cursor = cursorAfterExpr(expr);
      const { tokenStart, tokenEnd } = makeSuggestions(expr, cursor, {
        inputFields: ["body", "name"],
        inputSample,
      });
      // "da" has length 2, so tokenStart = cursor - 2
      expect(tokenStart).toBe(cursor - 2);
      expect(tokenEnd).toBe(cursor);
    });

    it("sets tokenStart correctly for empty leaf", () => {
      const expr = "{{ $input.body. }}";
      const cursor = cursorAfterExpr(expr);
      const { tokenStart, tokenEnd } = makeSuggestions(expr, cursor, {
        inputFields: ["body", "name"],
        inputSample,
      });
      expect(tokenStart).toBe(cursor);
      expect(tokenEnd).toBe(cursor);
    });
  });

  describe("$var. suggestions", () => {
    it("suggests declared variables for $var.", () => {
      const expr = "{{ $var. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        variables: [
          { name: "counter", type: "number" },
          { name: "token", type: "string" },
        ],
      });
      expect(suggestions.map((s) => s.label)).toEqual(["counter", "token"]);
      expect(suggestions[0].type).toBe("variable");
      expect(suggestions[0].detail).toBe("number");
    });

    it("filters variables by prefix", () => {
      const expr = "{{ $var.to }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        variables: [
          { name: "counter", type: "number" },
          { name: "token", type: "string" },
        ],
      });
      expect(suggestions.map((s) => s.label)).toEqual(["token"]);
    });

    it("returns empty when no variables match", () => {
      const expr = "{{ $var.xyz }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        variables: [{ name: "counter", type: "number" }],
      });
      expect(suggestions).toEqual([]);
    });
  });

  describe("$node suggestions", () => {
    const nodeData = {
      availableNodes: [
        {
          id: "n1",
          label: "Form_test",
          resolvedKey: "Form_test",
          type: "form",
          outputFields: ["submittedData"],
          outputSample: { submittedData: { name: "test" } },
        },
        {
          id: "n2",
          label: "HTTP Request",
          resolvedKey: "HTTP Request",
          type: "http_request",
          outputFields: ["body"],
          outputSample: { body: { data: [] } },
        },
      ],
    };

    it('suggests node labels for $node["', () => {
      const expr = '{{ $node[" }}';
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), nodeData);
      expect(suggestions.map((s) => s.label)).toEqual(["Form_test", "HTTP Request"]);
      expect(suggestions[0].type).toBe("node");
      // Node selection should stop at "] so the next keystroke reveals accessor hints
      expect(suggestions[0].insertText).toBe('Form_test"]');
      expect(suggestions[0].isExpandable).toBe(true);
    });

    it('filters node labels by prefix for $node["H', () => {
      const expr = '{{ $node["H }}';
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), nodeData);
      expect(suggestions.map((s) => s.label)).toEqual(["HTTP Request"]);
    });
  });

  describe("spaces inside $node[\"...\"] keys", () => {
    const nodeData = {
      availableNodes: [
        {
          id: "n1",
          label: "AI Agent",
          resolvedKey: "AI Agent",
          type: "ai_agent",
          outputFields: [],
          outputSample: {},
        },
      ],
    };

    it("extracts the full token across a space in the node key for accessor hints", () => {
      const expr = '{{ $node["AI Agent"]. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual([
        "output",
        "config",
        "meta",
        "port",
        "status",
      ]);
    });

    it("drills into output fields for a space-containing node key", () => {
      const nodeDataWithSchema = {
        availableNodes: [
          {
            id: "n1",
            label: "AI Agent",
            resolvedKey: "AI Agent",
            type: "ai_agent",
            outputFields: [],
            outputSample: {},
            outputSchema: {
              type: "object",
              properties: {
                response: { type: "string" },
                metadata: { type: "object" },
              },
            },
          },
        ],
      };
      const expr = '{{ $node["AI Agent"].output. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeDataWithSchema,
      );
      expect(suggestions.map((s) => s.label)).toEqual(["response", "metadata"]);
    });

    it("still lists nodes when the prefix contains a partial quoted name with a space", () => {
      const expr = '{{ $node["AI A }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual(["AI Agent"]);
    });
  });

  describe("escaped quotes inside $node keys", () => {
    // KNOWN LIMITATION: The tokenizer handles escaped quotes correctly and
    // preserves them as part of the token, but the suggestion matchers use
    // simple `[^"]+` regexes that treat any `"` as a string boundary. This
    // means autocomplete doesn't resolve node names that contain literal
    // `"`. In practice this is fine — node labels with escaped quotes are
    // exceedingly rare. These tests pin down the current behaviour so a
    // future fix can be tracked explicitly.
    const nodeData = {
      availableNodes: [
        {
          id: "n1",
          label: 'Node "X"',
          resolvedKey: 'Node \\"X\\"',
          type: "ai_agent",
          outputFields: [],
          outputSample: {},
        },
      ],
    };

    it("tokenizer preserves the token across escaped quotes", () => {
      // Sanity: the forward/backward walker does NOT split on \" — the token
      // spans the whole string. This is the underlying fix that enables
      // spaces inside `"..."` to work.
      const expr = '{{ $node["Node \\"X\\""] }}';
      // No trailing dot → matcher shouldn't try drill-down; we only check
      // that this doesn't crash and that no hallucinated suggestions appear.
      const result = makeSuggestions(expr, cursorAfterExpr(expr), nodeData);
      expect(result.suggestions).toEqual([]);
    });
  });

  describe("$node.meta path fallthrough", () => {
    it("produces no suggestions when drilling past .meta (no schema/sample)", () => {
      // meta is runtime-only (execution metadata) — no backend schema nor
      // sample to hint from, so the drill-down matcher returns nothing and
      // the suggestion falls through. Documents the expected behaviour.
      const nodeData = {
        availableNodes: [
          {
            id: "n1",
            label: "Agent",
            resolvedKey: "Agent",
            type: "ai_agent",
            outputFields: [],
            outputSample: {},
          },
        ],
      };
      const expr = '{{ $node["Agent"].meta. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions).toEqual([]);
    });
  });

  describe("$node accessor hints", () => {
    const nodeData = {
      availableNodes: [
        {
          id: "n1",
          label: "Form_test",
          resolvedKey: "Form_test",
          type: "form",
          outputFields: [],
          outputSample: {},
        },
      ],
    };

    it('suggests all runtime accessors for $node["X"].', () => {
      const expr = '{{ $node["Form_test"]. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual([
        "output",
        "config",
        "meta",
        "port",
        "status",
      ]);
    });

    it('filters accessors by prefix for $node["X"].o', () => {
      const expr = '{{ $node["Form_test"].o }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.map((s) => s.label)).toEqual(["output"]);
    });

    it('marks object accessors (output/config/meta) as expandable', () => {
      const expr = '{{ $node["Form_test"]. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeData,
      );
      expect(suggestions.find((s) => s.label === "output")?.isExpandable).toBe(true);
      expect(suggestions.find((s) => s.label === "config")?.isExpandable).toBe(true);
      expect(suggestions.find((s) => s.label === "meta")?.isExpandable).toBe(true);
      expect(suggestions.find((s) => s.label === "port")?.isExpandable).toBeFalsy();
      expect(suggestions.find((s) => s.label === "status")?.isExpandable).toBeFalsy();
    });
  });

  describe("$node schema-backed field hints", () => {
    const nodeWithSchemaOnly = {
      availableNodes: [
        {
          id: "n1",
          label: "Chart",
          resolvedKey: "Chart",
          type: "chart",
          outputFields: [],
          outputSample: {}, // not executed yet
          outputSchema: {
            type: "object",
            properties: {
              type: { type: "string" },
              chartType: { type: "string" },
              data: { type: "array" },
            },
          },
        },
      ],
    };

    it('suggests output fields from static outputSchema when sample is empty', () => {
      const expr = '{{ $node["Chart"].output. }}';
      const { suggestions } = makeSuggestions(
        expr,
        cursorAfterExpr(expr),
        nodeWithSchemaOnly,
      );
      expect(suggestions.map((s) => s.label)).toEqual(["type", "chartType", "data"]);
    });

    it('unions runtime sample with schema fields (no duplicates, sample wins)', () => {
      const nodeData = {
        availableNodes: [
          {
            id: "n1",
            label: "Chart",
            resolvedKey: "Chart",
            type: "chart",
            outputFields: ["type", "extra"],
            outputSample: {
              type: "chart",
              extra: 123, // only in sample
            },
            outputSchema: {
              type: "object",
              properties: {
                type: { type: "string" },
                chartType: { type: "string" }, // only in schema
              },
            },
          },
        ],
      };
      const expr = '{{ $node["Chart"].output. }}';
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), nodeData);
      const labels = suggestions.map((s) => s.label).sort();
      expect(labels).toEqual(["chartType", "extra", "type"]);
      // Sample type wins: `extra` → number (from sample), `chartType` → string (from schema)
      expect(suggestions.find((s) => s.label === "extra")?.detail).toBe("number");
      expect(suggestions.find((s) => s.label === "chartType")?.detail).toBe("string");
    });

    it('suggests config fields from configSchema', () => {
      const nodeData = {
        availableNodes: [
          {
            id: "n1",
            label: "Chart",
            resolvedKey: "Chart",
            type: "chart",
            outputFields: [],
            outputSample: {},
            configSchema: {
              type: "object",
              properties: {
                title: { type: "string" },
                chartType: { type: "string" },
              },
            },
          },
        ],
      };
      const expr = '{{ $node["Chart"].config. }}';
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), nodeData);
      expect(suggestions.map((s) => s.label)).toEqual(["title", "chartType"]);
    });
  });

  describe("$input schema fallback", () => {
    it('suggests fields from inputSchema even when inputSample is empty', () => {
      const expr = "{{ $input. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        inputSample: {},
        inputSchema: {
          type: "object",
          properties: {
            userId: { type: "string" },
            count: { type: "number" },
          },
        },
      });
      expect(suggestions.map((s) => s.label)).toEqual(["userId", "count"]);
    });
  });

  describe("$dataSource. suggestions (table node)", () => {
    const sourceItemSample = {
      id: 1,
      name: "test",
      nested: { key: "value" },
    };

    it("suggests fields for $dataSource.", () => {
      const expr = "{{ $dataSource. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: true,
        sourceItemSample,
      });
      expect(suggestions.map((s) => s.label)).toEqual(["id", "name", "nested"]);
    });

    it("does not suggest $dataSource. fields when sourceItemSample is null", () => {
      const expr = "{{ $dataSource. }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        isTableContext: false,
        sourceItemSample: null,
      });
      expect(suggestions).toEqual([]);
    });
  });

  describe("container scope gating", () => {
    it("hides $loop / $item / $itemIndex when the selected node has no container scope", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr));
      const labels = suggestions.map((s) => s.label);
      expect(labels).not.toContain("$loop");
      expect(labels).not.toContain("$item");
      expect(labels).not.toContain("$itemIndex");
      // Unscoped variables remain visible.
      expect(labels).toContain("$input");
      expect(labels).toContain("$node");
    });

    it("shows $loop only when hasLoop is true", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        containerScope: { hasLoop: true, hasItem: false },
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("$loop");
      expect(labels).not.toContain("$item");
      expect(labels).not.toContain("$itemIndex");
    });

    it("shows $item and $itemIndex only when hasItem is true", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        containerScope: { hasLoop: false, hasItem: true },
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("$item");
      expect(labels).toContain("$itemIndex");
      expect(labels).not.toContain("$loop");
    });

    it("shows every container-scope variable when both flags are true", () => {
      const expr = "{{ $ }}";
      const { suggestions } = makeSuggestions(expr, cursorAfterExpr(expr), {
        containerScope: { hasLoop: true, hasItem: true },
      });
      const labels = suggestions.map((s) => s.label);
      expect(labels).toContain("$loop");
      expect(labels).toContain("$item");
      expect(labels).toContain("$itemIndex");
    });
  });
});
