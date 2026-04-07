import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Store state that tests can mutate
let editorState: Record<string, unknown> = {};
let executionState: Record<string, unknown> = {};

vi.mock("@/lib/stores/editor-store", () => ({
  useEditorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(editorState),
}));

vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(executionState),
}));

vi.mock("@workflow/expression-engine", () => ({
  getAllFunctionNames: () => ["length", "uppercase"],
}));

import { useExpressionContext } from "../use-expression-context";

function makeNode(
  id: string,
  type: string,
  label: string,
  config: Record<string, unknown> = {},
) {
  return { id, data: { label, type, config } };
}

function makeEdge(source: string, target: string) {
  return { source, target };
}

describe("useExpressionContext", () => {
  beforeEach(() => {
    editorState = { nodes: [], edges: [] };
    executionState = { nodeResults: [] };
  });

  it("returns empty data when no nodes exist", () => {
    const { result } = renderHook(() => useExpressionContext(null));
    expect(result.current.inputFields).toEqual([]);
    expect(result.current.inputSample).toEqual({});
    expect(result.current.availableNodes).toEqual([]);
    expect(result.current.variables).toEqual([]);
    expect(result.current.isTableContext).toBe(false);
    expect(result.current.sourceItemSample).toBeNull();
  });

  it("extracts inputSample from predecessor node", () => {
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP"),
        makeNode("n2", "slack", "Slack"),
      ],
      edges: [makeEdge("n1", "n2")],
    };
    executionState = {
      nodeResults: [
        { nodeId: "n1", outputData: { status: 200, body: "ok" } },
      ],
    };

    const { result } = renderHook(() => useExpressionContext("n2"));
    expect(result.current.inputFields).toEqual(["status", "body"]);
    expect(result.current.inputSample).toEqual({ status: 200, body: "ok" });
  });

  it("extracts variables from variable_declaration nodes", () => {
    editorState = {
      nodes: [
        makeNode("v1", "variable_declaration", "Vars", {
          variables: [
            { name: "counter", type: "number" },
            { name: "token", type: "string" },
          ],
        }),
        makeNode("n1", "slack", "Slack"),
      ],
      edges: [],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n1"));
    expect(result.current.variables).toEqual([
      { name: "counter", type: "number" },
      { name: "token", type: "string" },
    ]);
  });

  it("builds availableNodes excluding selected node", () => {
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP"),
        makeNode("n2", "slack", "Slack"),
      ],
      edges: [],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n2"));
    expect(result.current.availableNodes).toHaveLength(1);
    expect(result.current.availableNodes[0].label).toBe("HTTP");
  });

  describe("sourceItemSample for table nodes", () => {
    it("returns false/null for non-table nodes", () => {
      editorState = {
        nodes: [makeNode("n1", "slack", "Slack")],
        edges: [],
      };
      executionState = { nodeResults: [] };

      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.isTableContext).toBe(false);
      expect(result.current.sourceItemSample).toBeNull();
    });

    it("sets isTableContext true for dynamic table node even without execution results", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("t1", "table", "Table"),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = { nodeResults: [] };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.isTableContext).toBe(true);
      expect(result.current.sourceItemSample).toBeNull();
    });

    it("extracts sourceItemSample from predecessor output array", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("t1", "table", "Table"),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = {
        nodeResults: [
          {
            nodeId: "n1",
            outputData: [
              { first: "John", last: "Doe" },
              { first: "Jane", last: "Smith" },
            ],
          },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.sourceItemSample).toEqual({
        first: "John",
        last: "Doe",
      });
    });

    it("extracts sourceItemSample from predecessor output object", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("t1", "table", "Table"),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = {
        nodeResults: [
          { nodeId: "n1", outputData: { name: "Alice", age: 30 } },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.sourceItemSample).toEqual({ name: "Alice", age: 30 });
    });

    it("resolves sourceItemSample from dataSource $node reference", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("n2", "code", "DataProvider"),
          makeNode("t1", "table", "Table", {
            mode: "dynamic",
            dataSource: '{{ $node["DataProvider"].output }}',
          }),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = {
        nodeResults: [
          { nodeId: "n1", outputData: { irrelevant: true } },
          {
            nodeId: "n2",
            outputData: [
              { id: 1, value: "a" },
              { id: 2, value: "b" },
            ],
          },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.sourceItemSample).toEqual({ id: 1, value: "a" });
    });

    it("returns isTableContext false for table node in static mode", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("t1", "table", "Table", { mode: "static" }),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = {
        nodeResults: [
          { nodeId: "n1", outputData: [{ id: 1 }] },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.isTableContext).toBe(false);
      expect(result.current.sourceItemSample).toBeNull();
    });

    it("returns null when no execution results available", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("t1", "table", "Table"),
        ],
        edges: [makeEdge("n1", "t1")],
      };
      executionState = { nodeResults: [] };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.sourceItemSample).toBeNull();
    });
  });
});
