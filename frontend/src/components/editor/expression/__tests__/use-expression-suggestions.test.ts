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
    variables: [],
    functionNames: [],
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
});
