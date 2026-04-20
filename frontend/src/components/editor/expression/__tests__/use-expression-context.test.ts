import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";

// Store state that tests can mutate
let editorState: Record<string, unknown> = {};
let executionState: Record<string, unknown> = {};
let nodeDefinitionsState: Record<string, unknown> = { definitions: {} };

vi.mock("@/lib/stores/editor-store", () => ({
  useEditorStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(editorState),
}));

vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(executionState),
}));

vi.mock("@/lib/stores/node-definitions-store", () => ({
  useNodeDefinitionsStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector(nodeDefinitionsState),
}));

vi.mock("@workflow/expression-engine", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@workflow/expression-engine")>();
  return {
    ...actual,
    getAllFunctionNames: () => ["length", "uppercase"],
  };
});

import { useExpressionContext } from "../use-expression-context";

function makeNode(
  id: string,
  type: string,
  label: string,
  config: Record<string, unknown> = {},
  extraData: Record<string, unknown> = {},
) {
  return { id, data: { label, type, config, ...extraData } };
}

function makeEdge(source: string, target: string) {
  return { source, target };
}

describe("useExpressionContext", () => {
  beforeEach(() => {
    editorState = { nodes: [], edges: [] };
    executionState = { nodeResults: [] };
    nodeDefinitionsState = { definitions: {} };
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
        makeNode("n2", "http_request", "HTTP Request"),
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

  describe("structured output envelope unwrapping", () => {
    // Backend persists NodeExecution.outputData as the canonical
    // { config, output, meta?, port?, status? } envelope. The autocomplete
    // layer must see the unwrapped `.output` so its suggestions match what
    // the runtime binds to $node["X"].output / $input.
    it("unwraps availableNodes outputSample/outputFields from the envelope", () => {
      editorState = {
        nodes: [
          makeNode("n1", "form", "Form_test"),
          makeNode("n2", "code", "Code"),
        ],
        edges: [makeEdge("n1", "n2")],
      };
      executionState = {
        nodeResults: [
          {
            nodeId: "n1",
            outputData: {
              config: { fields: [] },
              output: {
                interaction: { data: { useful: true } },
                submittedAt: "2026-04-20T00:00:00Z",
              },
              status: "completed",
              port: "out",
            },
          },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("n2"));
      const form = result.current.availableNodes.find(
        (n) => n.label === "Form_test",
      );
      expect(form?.outputFields).toEqual(["interaction", "submittedAt"]);
      expect(form?.outputSample).toEqual({
        interaction: { data: { useful: true } },
        submittedAt: "2026-04-20T00:00:00Z",
      });
    });

    it("unwraps inputSample when predecessor emits the envelope", () => {
      editorState = {
        nodes: [
          makeNode("n1", "http_request", "HTTP"),
          makeNode("n2", "code", "Code"),
        ],
        edges: [makeEdge("n1", "n2")],
      };
      executionState = {
        nodeResults: [
          {
            nodeId: "n1",
            outputData: {
              config: {},
              output: { status: 200, body: "ok" },
            },
          },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("n2"));
      expect(result.current.inputFields).toEqual(["status", "body"]);
      expect(result.current.inputSample).toEqual({ status: 200, body: "ok" });
    });

    it("unwraps array payload from the envelope for table dataSource preview", () => {
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
          {
            nodeId: "n2",
            outputData: {
              config: {},
              output: [
                { id: 1, value: "a" },
                { id: 2, value: "b" },
              ],
            },
          },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("t1"));
      expect(result.current.sourceItemSample).toEqual({ id: 1, value: "a" });
    });

    it("leaves non-envelope flat objects untouched (back-compat)", () => {
      // Some legacy paths may still surface a flat object. A `.output` key
      // alone (without `config`) must not be treated as the envelope.
      editorState = {
        nodes: [
          makeNode("n1", "code", "Legacy"),
          makeNode("n2", "code", "Code"),
        ],
        edges: [makeEdge("n1", "n2")],
      };
      executionState = {
        nodeResults: [
          { nodeId: "n1", outputData: { output: "raw string" } },
        ],
      };

      const { result } = renderHook(() => useExpressionContext("n2"));
      expect(result.current.inputSample).toEqual({ output: "raw string" });
    });
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
        makeNode("n1", "http_request", "HTTP Request"),
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

  it("builds availableNodes from ancestors, excluding selected node", () => {
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP"),
        makeNode("n2", "http_request", "HTTP Request"),
      ],
      edges: [makeEdge("n1", "n2")],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n2"));
    expect(result.current.availableNodes).toHaveLength(1);
    expect(result.current.availableNodes[0].label).toBe("HTTP");
    expect(result.current.availableNodes[0].resolvedKey).toBe("HTTP");
  });

  it("excludes non-ancestor nodes from availableNodes", () => {
    // n3 is NOT connected to n2 (no path). From n2 it is unreachable.
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP"),
        makeNode("n2", "http_request", "HTTP Request"),
        makeNode("n3", "code", "Unreachable"),
      ],
      edges: [makeEdge("n1", "n2")],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n2"));
    const labels = result.current.availableNodes.map((n) => n.label);
    expect(labels).toEqual(["HTTP"]);
    expect(labels).not.toContain("Unreachable");
  });

  it("keeps allNodeKeys populated with every node's resolved key", () => {
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP"),
        makeNode("n2", "http_request", "HTTP Request"),
        makeNode("n3", "code", "Unreachable"),
      ],
      edges: [makeEdge("n1", "n2")],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n2"));
    expect(result.current.allNodeKeys.has("HTTP")).toBe(true);
    expect(result.current.allNodeKeys.has("HTTP Request")).toBe(true);
    expect(result.current.allNodeKeys.has("Unreachable")).toBe(true);
  });

  it("assigns disambiguated resolvedKey for duplicate labels", () => {
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP Request"),
        makeNode("n2", "http_request", "HTTP Request"),
        makeNode("n3", "code", "Code"),
      ],
      edges: [makeEdge("n1", "n3"), makeEdge("n2", "n3")],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n3"));
    const available = result.current.availableNodes;
    expect(available).toHaveLength(2);
    expect(available[0].label).toBe("HTTP Request");
    expect(available[0].resolvedKey).toBe("HTTP Request");
    expect(available[1].label).toBe("HTTP Request");
    expect(available[1].resolvedKey).toBe("HTTP Request#2");
  });

  it("exposes stable disambiguated keys even for nodes outside the ancestor set", () => {
    // Duplicate labels exist, but only one is an ancestor — the reachable
    // node's resolvedKey must still match the globally-assigned key.
    editorState = {
      nodes: [
        makeNode("n1", "http_request", "HTTP Request"),
        makeNode("n2", "http_request", "HTTP Request"),
        makeNode("n3", "code", "Code"),
      ],
      // Only n2 (the second "HTTP Request") is connected to n3.
      edges: [makeEdge("n2", "n3")],
    };
    executionState = { nodeResults: [] };

    const { result } = renderHook(() => useExpressionContext("n3"));
    expect(result.current.availableNodes).toHaveLength(1);
    expect(result.current.availableNodes[0].id).toBe("n2");
    expect(result.current.availableNodes[0].resolvedKey).toBe("HTTP Request#2");
    expect(result.current.allNodeKeys.has("HTTP Request")).toBe(true);
    expect(result.current.allNodeKeys.has("HTTP Request#2")).toBe(true);
  });

  describe("sourceItemSample for table nodes", () => {
    it("returns false/null for non-table nodes", () => {
      editorState = {
        nodes: [makeNode("n1", "http_request", "HTTP Request")],
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

  describe("static schema attachment", () => {
    it("attaches outputSchema/configSchema to availableNodes from node definitions", () => {
      const chartOutputSchema = {
        type: "object",
        properties: { chartType: { type: "string" } },
      };
      const chartConfigSchema = {
        type: "object",
        properties: { title: { type: "string" } },
      };
      editorState = {
        nodes: [
          makeNode("c1", "chart", "Chart"),
          makeNode("n1", "http_request", "HTTP"),
        ],
        edges: [makeEdge("c1", "n1")],
      };
      executionState = { nodeResults: [] };
      nodeDefinitionsState = {
        definitions: {
          chart: {
            type: "chart",
            outputSchema: chartOutputSchema,
            configSchema: chartConfigSchema,
          },
        },
      };

      const { result } = renderHook(() => useExpressionContext("n1"));
      const chart = result.current.availableNodes.find((n) => n.label === "Chart");
      expect(chart?.outputSchema).toEqual(chartOutputSchema);
      expect(chart?.configSchema).toEqual(chartConfigSchema);
    });

    it("exposes inputSchema from predecessor node's outputSchema", () => {
      const predecessorOutputSchema = {
        type: "object",
        properties: { userId: { type: "string" } },
      };
      editorState = {
        nodes: [
          makeNode("n1", "chart", "Chart"),
          makeNode("n2", "http_request", "HTTP Request"),
        ],
        edges: [makeEdge("n1", "n2")],
      };
      executionState = { nodeResults: [] };
      nodeDefinitionsState = {
        definitions: {
          chart: { type: "chart", outputSchema: predecessorOutputSchema },
        },
      };

      const { result } = renderHook(() => useExpressionContext("n2"));
      expect(result.current.inputSchema).toEqual(predecessorOutputSchema);
    });

    // Predecessor nodes declare `outputSchema` as the envelope
    // `{ config, output, meta, port, status }`. `$input.*` should see the
    // envelope's `.output` content (mirrors the runtime resolver). Guards
    // against the Phase-2 regression where `$input.output.interaction.data`
    // hinted instead of `$input.interaction.data`.
    it("unwraps envelope-shaped predecessor outputSchema for $input", () => {
      const envelopeSchema = {
        type: "object",
        properties: {
          config: { type: "object" },
          output: {
            type: "object",
            properties: {
              interaction: {
                type: "object",
                properties: { data: { type: "object" } },
              },
              rendered: { type: "string" },
            },
          },
          meta: { type: "object" },
          port: { type: "string" },
          status: { type: "string" },
        },
      };
      editorState = {
        nodes: [
          makeNode("c1", "carousel", "Carousel"),
          makeNode("n1", "http_request", "HTTP Request"),
        ],
        edges: [makeEdge("c1", "n1")],
      };
      executionState = { nodeResults: [] };
      nodeDefinitionsState = {
        definitions: {
          carousel: { type: "carousel", outputSchema: envelopeSchema },
        },
      };

      const { result } = renderHook(() => useExpressionContext("n1"));
      // Should be the envelope's `.output` property, not the envelope root.
      expect(result.current.inputSchema).toEqual(envelopeSchema.properties.output);
      expect(result.current.inputSchema?.properties).not.toHaveProperty("config");
      expect(result.current.inputSchema?.properties).not.toHaveProperty("output");
    });
  });

  describe("containerScope", () => {
    it("returns both flags off for a top-level node", () => {
      editorState = {
        nodes: [makeNode("n1", "http_request", "HTTP")],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: false,
        hasItem: false,
      });
    });

    it("turns on hasLoop when the node is inside a loop container", () => {
      editorState = {
        nodes: [
          makeNode("loop1", "loop", "Loop"),
          makeNode("n1", "http_request", "HTTP", {}, { containerId: "loop1" }),
        ],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: true,
        hasItem: false,
      });
    });

    it("turns on hasItem when the node is inside a foreach container", () => {
      editorState = {
        nodes: [
          makeNode("fe", "foreach", "ForEach"),
          makeNode("n1", "http_request", "HTTP", {}, { containerId: "fe" }),
        ],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: false,
        hasItem: true,
      });
    });

    it("combines flags when containers are nested", () => {
      editorState = {
        nodes: [
          makeNode("fe", "foreach", "ForEach"),
          makeNode("lp", "loop", "Loop", {}, { containerId: "fe" }),
          makeNode("n1", "http_request", "HTTP", {}, { containerId: "lp" }),
        ],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: true,
        hasItem: true,
      });
    });

    it("stops at a parallel container — outer loop/foreach scopes do not leak in", () => {
      // ForEach > Parallel > Loop > node: the outer foreach's $item is
      // cleared by parallel, so the innermost loop still contributes $loop
      // but the foreach contributes nothing.
      editorState = {
        nodes: [
          makeNode("fe", "foreach", "ForEach"),
          makeNode("pa", "parallel", "Parallel", {}, { containerId: "fe" }),
          makeNode("lp", "loop", "Loop", {}, { containerId: "pa" }),
          makeNode("n1", "http_request", "HTTP", {}, { containerId: "lp" }),
        ],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: true,
        hasItem: false,
      });
    });

    it("returns both flags off when the node is directly inside a parallel branch", () => {
      editorState = {
        nodes: [
          makeNode("fe", "foreach", "ForEach"),
          makeNode("pa", "parallel", "Parallel", {}, { containerId: "fe" }),
          makeNode("n1", "http_request", "HTTP", {}, { containerId: "pa" }),
        ],
        edges: [],
      };
      const { result } = renderHook(() => useExpressionContext("n1"));
      expect(result.current.containerScope).toEqual({
        hasLoop: false,
        hasItem: false,
      });
    });

    it("reports off-scope when the selected node is the container itself", () => {
      // The loop/foreach node isn't *inside* its own body — its config is
      // evaluated at the outer level, so $loop / $item aren't available to it.
      editorState = {
        nodes: [
          makeNode("loop1", "loop", "Loop"),
          makeNode("fe1", "foreach", "ForEach"),
        ],
        edges: [],
      };
      const loopResult = renderHook(() => useExpressionContext("loop1"));
      expect(loopResult.result.current.containerScope).toEqual({
        hasLoop: false,
        hasItem: false,
      });

      const feResult = renderHook(() => useExpressionContext("fe1"));
      expect(feResult.result.current.containerScope).toEqual({
        hasLoop: false,
        hasItem: false,
      });
    });
  });
});
