import { describe, it, expect, beforeEach, vi } from "vitest";
import type { Node, Edge } from "@xyflow/react";

// vi.hoisted 로 mock 변수를 hoisting 안전하게 정의 (vi.mock factory 참조 허용)
const { graphWarningsMock } = vi.hoisted(() => ({
  graphWarningsMock: vi.fn(),
}));

vi.mock("../../api/workflows", () => ({
  workflowsApi: {
    saveCanvas: vi.fn(),
    graphWarnings: graphWarningsMock,
  },
}));

import { useEditorStore } from "../editor-store";
import { workflowsApi } from "../../api/workflows";

const saveCanvasMock = vi.mocked(workflowsApi.saveCanvas);

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

    it("deriveContainerAssignments W-23: 500노드 × 500엣지 시나리오에서 O(1) 조회로 빠르게 처리", () => {
      // 회귀 가드 — 옛 O(N²) 구현은 500/500 에서 4M 회 비교로 100ms+ 걸렸다.
      // Map 기반 단일 패스 emit 으로 같은 워크로드에서 10ms 미만에 수렴해야 한다.
      const N = 500;
      const nodes: Node[] = [];
      const edges: Edge[] = [];
      for (let i = 0; i < N; i++) {
        nodes.push(
          makeNode(`n${i}`, {
            data: { type: "action", label: `n${i}`, category: "data" },
          }),
        );
      }
      // 순차 체인 — chain 규칙 (rule 3) 이 fixed-point 까지 수렴해야 한다.
      for (let i = 0; i < N - 1; i++) {
        edges.push(makeEdge(`n${i}`, `n${i + 1}`));
      }

      const t0 = performance.now();
      useEditorStore
        .getState()
        .setWorkflow("wf-perf", "perf", nodes, edges);
      const elapsed = performance.now() - t0;

      // 환경별 변동을 고려해 500ms 상한 — 옛 구현은 일반적 4~10x 더 느렸다.
      // (regression 가드 목적이라 절대값 정밀도보다 cap 역할이 중요)
      expect(elapsed).toBeLessThan(500);
      expect(useEditorStore.getState().nodes).toHaveLength(N);
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

  // ED-AI-39: candidate picker 가 Confirm 시 호출하는 경로. 기존 config 를
  // 보존하며 단일 필드만 덮어쓰고, Undo 스택에 푸시된다.
  describe("updateNodeConfigField", () => {
    it("merges a single field onto existing config and pushes Undo", () => {
      useEditorStore.setState({
        nodes: [
          makeNode("node-1", {
            data: {
              type: "send_email",
              label: "Notify",
              category: "integration",
              config: { to: ["x@y.z"], subject: "Hi" },
              isDisabled: false,
              containerId: null,
            } as Node["data"],
          }),
        ],
        undoStack: [],
      });

      useEditorStore
        .getState()
        .updateNodeConfigField("node-1", "integrationId", "int-42");

      const node = useEditorStore.getState().nodes[0];
      expect((node.data as { config?: Record<string, unknown> }).config).toEqual({
        to: ["x@y.z"],
        subject: "Hi",
        integrationId: "int-42",
      });
      expect(useEditorStore.getState().isDirty).toBe(true);
      // Undo stack 에 이전 상태가 push 되어 Ctrl+Z 로 되돌릴 수 있어야 한다.
      expect(useEditorStore.getState().undoStack.length).toBe(1);
    });

    it("blocks prototype pollution keys (__proto__ / constructor / prototype)", () => {
      // review W-6: SSE 스트림을 통해 악성 fieldPath 가 들어와도 Object
      // prototype 을 건드리지 않도록 early return 해야 한다.
      useEditorStore.setState({
        nodes: [makeNode("node-1")],
      });
      useEditorStore
        .getState()
        .updateNodeConfigField("node-1", "__proto__", { polluted: true });
      useEditorStore
        .getState()
        .updateNodeConfigField("node-1", "constructor", "oops");

      const node = useEditorStore.getState().nodes[0];
      const config = (node.data as { config?: Record<string, unknown> }).config ?? {};
      expect(config).not.toHaveProperty("__proto__");
      expect(config).not.toHaveProperty("constructor");
      // 그리고 Object.prototype 이 오염되지 않았는지.
      expect(({} as { polluted?: boolean }).polluted).toBeUndefined();
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

  // SUMMARY#17 — fetchGraphWarnings 액션 테스트
  describe("fetchGraphWarnings", () => {
    beforeEach(() => {
      graphWarningsMock.mockReset();
      useEditorStore.setState({
        ...initialState,
        workflowId: "wf-1",
        graphWarnings: undefined,
      } as never);
    });

    it("early returns without API call when workflowId is null", async () => {
      useEditorStore.setState({ workflowId: null } as never);
      await useEditorStore.getState().fetchGraphWarnings();
      expect(graphWarningsMock).not.toHaveBeenCalled();
    });

    it("sets graphWarnings state on success", async () => {
      const responseBody = {
        results: [{ ruleId: "r1", severity: "error", nodeId: "n1", message: "err" }],
        hasError: true,
        hasWarning: false,
      };
      graphWarningsMock.mockResolvedValue({ data: responseBody });
      await useEditorStore.getState().fetchGraphWarnings();
      expect(useEditorStore.getState().graphWarnings).toEqual(responseBody);
    });

    it("preserves existing graphWarnings state on failure (silent warn)", async () => {
      const existing = {
        results: [],
        hasError: false,
        hasWarning: false,
      };
      useEditorStore.setState({ graphWarnings: existing } as never);
      graphWarningsMock.mockRejectedValue(new Error("network error"));
      await useEditorStore.getState().fetchGraphWarnings();
      // 실패 시 기존 결과 유지 (saveCanvas 차단을 막기 위해)
      expect(useEditorStore.getState().graphWarnings).toEqual(existing);
    });

    it("handles response.data === undefined by falling back to response itself", async () => {
      const responseBody = {
        results: [],
        hasError: false,
        hasWarning: true,
      };
      // data 없는 응답 (direct body)
      graphWarningsMock.mockResolvedValue(responseBody);
      await useEditorStore.getState().fetchGraphWarnings();
      expect(useEditorStore.getState().graphWarnings).toEqual(responseBody);
    });
  });

  describe("saveWorkflow (optimistic-clear)", () => {
    beforeEach(() => {
      saveCanvasMock.mockReset();
      useEditorStore.setState({
        workflowId: "wf-1",
        nodes: [makeNode("1")],
        edges: [],
        isDirty: true,
        isSaving: false,
        saveCount: 0,
      });
    });

    it("clears isDirty and bumps saveCount on success", async () => {
      saveCanvasMock.mockResolvedValue(undefined as never);
      const ok = await useEditorStore.getState().saveWorkflow();

      expect(ok).toBe(true);
      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(false);
      expect(state.saveCount).toBe(1);
      expect(state.isSaving).toBe(false);
      expect(saveCanvasMock).toHaveBeenCalledTimes(1);
    });

    it("restores isDirty=true when the save fails", async () => {
      saveCanvasMock.mockRejectedValue(new Error("network down"));
      const ok = await useEditorStore.getState().saveWorkflow();

      expect(ok).toBe(false);
      const state = useEditorStore.getState();
      expect(state.isDirty).toBe(true);
      expect(state.isSaving).toBe(false);
    });

    it("keeps isDirty=true when the canvas is edited during the in-flight save", async () => {
      // Defer the save resolution so we can mutate mid-flight.
      let resolveSave: () => void = () => {};
      saveCanvasMock.mockReturnValue(
        new Promise<void>((res) => {
          resolveSave = res;
        }) as never,
      );

      const savePromise = useEditorStore.getState().saveWorkflow();
      // optimistic-clear already set isDirty:false during the in-flight window
      expect(useEditorStore.getState().isDirty).toBe(false);
      // user edits mid-flight → mutator re-sets isDirty:true
      useEditorStore.getState().addNode(makeNode("2"));
      expect(useEditorStore.getState().isDirty).toBe(true);

      resolveSave();
      const ok = await savePromise;

      expect(ok).toBe(true);
      // the in-flight edit must NOT be cleared by the completing save
      expect(useEditorStore.getState().isDirty).toBe(true);
    });

    it("is a no-op (returns false) when already saving", async () => {
      useEditorStore.setState({ isSaving: true });
      const ok = await useEditorStore.getState().saveWorkflow();

      expect(ok).toBe(false);
      expect(saveCanvasMock).not.toHaveBeenCalled();
    });

    it("returns false without calling the API when workflowId is null", async () => {
      useEditorStore.setState({ workflowId: null });
      const ok = await useEditorStore.getState().saveWorkflow();

      expect(ok).toBe(false);
      expect(saveCanvasMock).not.toHaveBeenCalled();
    });
  });
});
