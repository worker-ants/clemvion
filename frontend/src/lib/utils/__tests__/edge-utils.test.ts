import { describe, it, expect, beforeAll } from "vitest";
import {
  resolvePortType,
  getEdgeColor,
  buildEdgeData,
  getConnectedEdgeIds,
  enrichEdgesWithPortData,
  PORT_TYPE_COLORS,
} from "../edge-utils";
import type { Node, Edge } from "@xyflow/react";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

beforeAll(() => {
  const make = (
    type: string,
    extras: Partial<NodeDefinition>,
  ): NodeDefinition => ({
    type,
    category: "logic",
    label: type,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
    ...extras,
  });
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    order: ["loop", "map", "foreach", "http_request"],
    definitions: {
      loop: make("loop", { isContainer: true }),
      map: make("map", { isContainer: true }),
      foreach: make("foreach", { isContainer: true }),
      http_request: make("http_request", {
        category: "integration",
        outputs: [
          { id: "success", label: "Success", type: "data" },
          { id: "error", label: "Error", type: "error" },
        ],
      }),
    },
  });
});

describe("resolvePortType", () => {
  it("returns 'error' for error sourceHandle", () => {
    expect(resolvePortType("error", "http_request")).toBe("error");
  });

  it("returns 'container' for body sourceHandle", () => {
    expect(resolvePortType("body", "loop")).toBe("container");
  });

  it("returns 'system' for AI agent system ports", () => {
    expect(resolvePortType("out", "ai_agent")).toBe("system");
    expect(resolvePortType("user_ended", "ai_agent")).toBe("system");
    expect(resolvePortType("max_turns", "ai_agent")).toBe("system");
  });

  it("returns 'data' for AI agent custom condition ports", () => {
    expect(resolvePortType("some_condition_id", "ai_agent")).toBe("data");
  });

  it("returns 'system' for container done port", () => {
    expect(resolvePortType("done", "loop")).toBe("system");
    expect(resolvePortType("done", "map")).toBe("system");
    expect(resolvePortType("done", "foreach")).toBe("system");
  });

  it("returns 'data' for regular data ports", () => {
    expect(resolvePortType("out", "manual_trigger")).toBe("data");
    expect(resolvePortType("out", "variable_declaration")).toBe("data");
    expect(resolvePortType("true", "if_else")).toBe("data");
    expect(resolvePortType("false", "if_else")).toBe("data");
  });

  it("returns 'data' for null/undefined sourceHandle", () => {
    expect(resolvePortType(null, "manual_trigger")).toBe("data");
    expect(resolvePortType(undefined, "manual_trigger")).toBe("data");
  });

  it("returns 'data' for unknown node type", () => {
    expect(resolvePortType("out", "nonexistent_type")).toBe("data");
  });

  it("returns 'data' for emit handle", () => {
    expect(resolvePortType("emit", "loop")).toBe("data");
  });
});

describe("getEdgeColor", () => {
  it("returns correct color for each port type", () => {
    expect(getEdgeColor("data")).toBe("#22c55e");
    expect(getEdgeColor("system")).toBe("#3b82f6");
    expect(getEdgeColor("error")).toBe("#ef4444");
    expect(getEdgeColor("container")).toBe("#a855f7");
  });
});

describe("buildEdgeData", () => {
  it("builds correct edge data for data port", () => {
    const data = buildEdgeData("out", "manual_trigger");
    expect(data).toEqual({
      sourcePort: "out",
      portType: "data",
      portColor: PORT_TYPE_COLORS.data,
    });
  });

  it("builds correct edge data for error port", () => {
    const data = buildEdgeData("error", "http_request");
    expect(data).toEqual({
      sourcePort: "error",
      portType: "error",
      portColor: PORT_TYPE_COLORS.error,
    });
  });

  it("builds correct edge data for container body port", () => {
    const data = buildEdgeData("body", "loop");
    expect(data).toEqual({
      sourcePort: "body",
      portType: "container",
      portColor: PORT_TYPE_COLORS.container,
    });
  });

  it("builds correct edge data for AI agent system port", () => {
    const data = buildEdgeData("user_ended", "ai_agent");
    expect(data).toEqual({
      sourcePort: "user_ended",
      portType: "system",
      portColor: PORT_TYPE_COLORS.system,
    });
  });

  it("defaults sourcePort to 'out' for null handle", () => {
    const data = buildEdgeData(null, "manual_trigger");
    expect(data.sourcePort).toBe("out");
  });
});

describe("getConnectedEdgeIds", () => {
  const edges: Edge[] = [
    { id: "e1", source: "a", target: "b" },
    { id: "e2", source: "b", target: "c" },
    { id: "e3", source: "d", target: "e" },
  ];

  it("returns edges connected to a node as source or target", () => {
    const ids = getConnectedEdgeIds("b", edges);
    expect(ids).toEqual(new Set(["e1", "e2"]));
  });

  it("returns empty set for unconnected node", () => {
    const ids = getConnectedEdgeIds("z", edges);
    expect(ids).toEqual(new Set());
  });

  it("returns single edge for leaf node", () => {
    const ids = getConnectedEdgeIds("a", edges);
    expect(ids).toEqual(new Set(["e1"]));
  });

  it("returns edge when node is both source and target (self-loop)", () => {
    const selfLoopEdges: Edge[] = [{ id: "e1", source: "a", target: "a" }];
    const ids = getConnectedEdgeIds("a", selfLoopEdges);
    expect(ids).toEqual(new Set(["e1"]));
  });
});

describe("enrichEdgesWithPortData", () => {
  it("enriches edges with port type data from nodes", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "manual_trigger" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "http_request" } },
      { id: "n3", position: { x: 400, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "out", targetHandle: "in", type: "custom" },
      { id: "e2", source: "n2", target: "n3", sourceHandle: "error", targetHandle: "in", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);

    expect((enriched[0].data as Record<string, unknown>).portType).toBe("data");
    expect((enriched[1].data as Record<string, unknown>).portType).toBe("error");
  });

  it("preserves existing edge data fields", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "manual_trigger" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "out", type: "custom", data: { existingField: "keep" } },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);

    expect((enriched[0].data as Record<string, unknown>).existingField).toBe("keep");
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("data");
  });

  it("handles AI agent system ports", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "ai_agent" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "user_ended", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("system");
  });

  it("handles container body ports", () => {
    const nodes: Node[] = [
      { id: "n1", position: { x: 0, y: 0 }, data: { type: "loop" } },
      { id: "n2", position: { x: 200, y: 0 }, data: { type: "template" } },
    ];
    const edges: Edge[] = [
      { id: "e1", source: "n1", target: "n2", sourceHandle: "body", type: "custom" },
    ];

    const enriched = enrichEdgesWithPortData(edges, nodes);
    expect((enriched[0].data as Record<string, unknown>).portType).toBe("container");
  });
});
