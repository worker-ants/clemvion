import { describe, it, expect, beforeEach, vi } from "vitest";

vi.mock("@/lib/api/node-definitions", () => ({
  nodeDefinitionsApi: {
    list: vi.fn(),
  },
}));

import { nodeDefinitionsApi } from "@/lib/api/node-definitions";
import {
  useNodeDefinitionsStore,
  getCategories,
  getCategoryColor,
  getNodesByCategory,
} from "../node-definitions-store";
import type { NodeDefinitionResponse } from "@/lib/node-definitions/types";

const listMock = nodeDefinitionsApi.list as ReturnType<typeof vi.fn>;

function fakeDef(type: string, category: string): NodeDefinitionResponse {
  return {
    metadata: {
      type,
      category: category as never,
      label: type,
      description: "",
      icon: "Box",
      color: "#000",
    },
    ports: { inputs: [], outputs: [] },
    configSchema: {},
    defaultConfig: {},
  };
}

describe("node-definitions-store", () => {
  beforeEach(() => {
    useNodeDefinitionsStore.setState({
      status: "idle",
      error: null,
      definitions: {},
      order: [],
      categories: [],
    });
    listMock.mockReset();
  });

  it("parses { definitions, categories } payload wrapped by TransformInterceptor", async () => {
    listMock.mockResolvedValue({
      data: {
        data: {
          definitions: [fakeDef("if_else", "logic"), fakeDef("ai_agent", "ai")],
          categories: [
            { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
            { id: "ai", label: "AI", icon: "Sparkles", color: "#10B981", order: 3 },
          ],
        },
      },
    });
    await useNodeDefinitionsStore.getState().load();
    const state = useNodeDefinitionsStore.getState();
    expect(state.status).toBe("ready");
    expect(state.order).toEqual(["if_else", "ai_agent"]);
    expect(state.categories.map((c) => c.id)).toEqual(["logic", "ai"]);
  });

  it("parses unwrapped { definitions, categories } payload", async () => {
    listMock.mockResolvedValue({
      data: {
        definitions: [fakeDef("loop", "logic")],
        categories: [
          { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
        ],
      },
    });
    await useNodeDefinitionsStore.getState().load();
    expect(useNodeDefinitionsStore.getState().categories).toHaveLength(1);
  });

  it("stays backward compatible with legacy array payloads (no categories)", async () => {
    listMock.mockResolvedValue({
      data: [fakeDef("if_else", "logic")],
    });
    await useNodeDefinitionsStore.getState().load();
    const state = useNodeDefinitionsStore.getState();
    expect(state.order).toEqual(["if_else"]);
    expect(state.categories).toEqual([]);
  });

  it("sets status=error and rethrows on load failure", async () => {
    listMock.mockRejectedValue(new Error("network down"));
    await expect(
      useNodeDefinitionsStore.getState().load(),
    ).rejects.toThrow("network down");
    expect(useNodeDefinitionsStore.getState().status).toBe("error");
  });

  it("getCategoryColor returns color from store and falls back to gray when unknown", () => {
    useNodeDefinitionsStore.setState({
      categories: [
        { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
      ],
    });
    expect(getCategoryColor("logic")).toBe("#3B82F6");
    expect(getCategoryColor("unknown")).toBe("#6B7280");
  });

  it("getCategories and getNodesByCategory use latest store state", () => {
    useNodeDefinitionsStore.setState({
      status: "ready",
      error: null,
      order: ["a", "b"],
      definitions: {
        a: {
          type: "a",
          category: "logic",
          label: "A",
          description: "",
          icon: "Box",
          color: "#000",
          inputs: [],
          outputs: [],
          defaultConfig: {},
          configSchema: {},
        },
        b: {
          type: "b",
          category: "ai",
          label: "B",
          description: "",
          icon: "Box",
          color: "#000",
          inputs: [],
          outputs: [],
          defaultConfig: {},
          configSchema: {},
        },
      },
      categories: [
        { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
        { id: "ai", label: "AI", icon: "Sparkles", color: "#10B981", order: 3 },
      ],
    });
    expect(getCategories().map((c) => c.id)).toEqual(["logic", "ai"]);
    expect(getNodesByCategory("logic").map((n) => n.type)).toEqual(["a"]);
    expect(getNodesByCategory("ai").map((n) => n.type)).toEqual(["b"]);
  });
});
