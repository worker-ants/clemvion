import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Node, Edge } from "@xyflow/react";

vi.mock("../../api/workflows", () => ({
  workflowsApi: {
    saveCanvas: vi.fn(),
  },
}));

import { useEditorStore } from "../editor-store";

const makeNode = (id: string, overrides?: Partial<Node>): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "action", label: `Node ${id}` },
  ...overrides,
});

const makeEdge = (source: string, target: string): Edge => ({
  id: `${source}-${target}`,
  source,
  target,
});

const initialState = {
  workflowId: null,
  workflowName: "Untitled Workflow",
  isDirty: false,
  isSaving: false,
  nodes: [] as Node[],
  edges: [] as Edge[],
  selectedNodeId: null,
  undoStack: [],
  redoStack: [],
};

describe("useEditorStore", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState);
  });

  it("has correct initial state", () => {
    const state = useEditorStore.getState();
    expect(state.workflowId).toBeNull();
    expect(state.workflowName).toBe("Untitled Workflow");
    expect(state.nodes).toEqual([]);
    expect(state.edges).toEqual([]);
    expect(state.isDirty).toBe(false);
  });

  describe("addNode", () => {
    it("adds a node and marks dirty", () => {
      const node = makeNode("1");
      useEditorStore.getState().addNode(node);

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(1);
      expect(state.nodes[0].id).toBe("1");
      expect(state.isDirty).toBe(true);
    });

    it("pushes undo snapshot before adding", () => {
      useEditorStore.getState().addNode(makeNode("1"));
      expect(useEditorStore.getState().undoStack).toHaveLength(1);
    });
  });

  describe("removeNode", () => {
    it("removes a node and its connected edges", () => {
      const nodes = [makeNode("1"), makeNode("2"), makeNode("3")];
      const edges = [makeEdge("1", "2"), makeEdge("2", "3")];
      useEditorStore.setState({ nodes, edges });

      useEditorStore.getState().removeNode("2");

      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(2);
      expect(state.nodes.find((n) => n.id === "2")).toBeUndefined();
      expect(state.edges).toHaveLength(0);
    });

    it("clears selectedNodeId if removed node was selected", () => {
      useEditorStore.setState({
        nodes: [makeNode("1")],
        edges: [],
        selectedNodeId: "1",
      });

      useEditorStore.getState().removeNode("1");
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe("selectNode", () => {
    it("sets selectedNodeId", () => {
      useEditorStore.getState().selectNode("node-1");
      expect(useEditorStore.getState().selectedNodeId).toBe("node-1");
    });

    it("clears selectedNodeId with null", () => {
      useEditorStore.getState().selectNode("node-1");
      useEditorStore.getState().selectNode(null);
      expect(useEditorStore.getState().selectedNodeId).toBeNull();
    });
  });

  describe("setWorkflow", () => {
    it("sets workflow metadata and resets stacks", () => {
      useEditorStore.setState({ undoStack: [{ nodes: [], edges: [] }] });
      const nodes = [makeNode("1")];
      const edges = [makeEdge("1", "2")];

      useEditorStore.getState().setWorkflow("wf-1", "My Workflow", nodes, edges);

      const state = useEditorStore.getState();
      expect(state.workflowId).toBe("wf-1");
      expect(state.workflowName).toBe("My Workflow");
      expect(state.nodes).toEqual(nodes);
      expect(state.edges).toEqual(edges);
      expect(state.isDirty).toBe(false);
      expect(state.undoStack).toEqual([]);
      expect(state.redoStack).toEqual([]);
    });
  });

  describe("undo/redo", () => {
    it("undo restores previous state", () => {
      useEditorStore.getState().addNode(makeNode("1"));
      useEditorStore.getState().addNode(makeNode("2"));

      expect(useEditorStore.getState().nodes).toHaveLength(2);

      useEditorStore.getState().undo();
      expect(useEditorStore.getState().nodes).toHaveLength(1);
    });

    it("redo restores undone state", () => {
      useEditorStore.getState().addNode(makeNode("1"));
      useEditorStore.getState().addNode(makeNode("2"));
      useEditorStore.getState().undo();

      expect(useEditorStore.getState().nodes).toHaveLength(1);

      useEditorStore.getState().redo();
      expect(useEditorStore.getState().nodes).toHaveLength(2);
    });

    it("undo does nothing when stack is empty", () => {
      const before = useEditorStore.getState().nodes;
      useEditorStore.getState().undo();
      expect(useEditorStore.getState().nodes).toEqual(before);
    });

    it("redo does nothing when stack is empty", () => {
      const before = useEditorStore.getState().nodes;
      useEditorStore.getState().redo();
      expect(useEditorStore.getState().nodes).toEqual(before);
    });
  });

  describe("updateNodeConfig", () => {
    it("updates config for the specified node", () => {
      useEditorStore.setState({ nodes: [makeNode("1")] });
      useEditorStore.getState().updateNodeConfig("1", { key: "value" });

      const node = useEditorStore.getState().nodes[0];
      expect(node.data.config).toEqual({ key: "value" });
      expect(useEditorStore.getState().isDirty).toBe(true);
    });
  });

  describe("applyAssistantOperation (update_node)", () => {
    // 어시스턴트가 일부 필드만 patch 해도 나머지 필드가 보존되어야 한다.
    // 백엔드 ShadowWorkflow 는 shallow merge 이므로 프론트도 동일하게 맞춘다.
    it("shallow-merges config patch, preserving untouched fields", () => {
      useEditorStore.setState({
        nodes: [
          makeNode("node-1", {
            data: {
              type: "http_request",
              label: "HTTP",
              config: {
                integrationId: "int-1",
                url: "https://api.example.com",
                timeout: 30,
              },
            },
          }),
        ],
      });

      useEditorStore.getState().applyAssistantOperation(
        "update_node",
        {
          id: "node-1",
          patch: { config: { headers: { Authorization: "Bearer x" } } },
        },
        { ok: true, id: "node-1" },
      );

      const node = useEditorStore.getState().nodes[0];
      expect(node.data.config).toEqual({
        integrationId: "int-1",
        url: "https://api.example.com",
        timeout: 30,
        headers: { Authorization: "Bearer x" },
      });
    });

    it("lets a patch overwrite a specific existing field", () => {
      useEditorStore.setState({
        nodes: [
          makeNode("node-1", {
            data: {
              type: "http_request",
              label: "HTTP",
              config: { timeout: 30, retries: 3 },
            },
          }),
        ],
      });

      useEditorStore.getState().applyAssistantOperation(
        "update_node",
        { id: "node-1", patch: { config: { timeout: 60 } } },
        { ok: true, id: "node-1" },
      );

      expect(useEditorStore.getState().nodes[0].data.config).toEqual({
        timeout: 60,
        retries: 3,
      });
    });

    it("skips the update when the result is not ok", () => {
      const original = {
        type: "http_request",
        label: "HTTP",
        config: { timeout: 30 },
      };
      useEditorStore.setState({
        nodes: [makeNode("node-1", { data: original })],
      });

      useEditorStore.getState().applyAssistantOperation(
        "update_node",
        { id: "node-1", patch: { config: { timeout: 99 } } },
        { ok: false },
      );

      expect(useEditorStore.getState().nodes[0].data.config).toEqual({
        timeout: 30,
      });
    });
  });
});
