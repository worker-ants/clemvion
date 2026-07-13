import { describe, it, expect, beforeAll, beforeEach, vi } from "vitest";
import type { Node, Edge, Connection } from "@xyflow/react";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

vi.mock("../../api/workflows", () => ({
  workflowsApi: {
    saveCanvas: vi.fn(),
  },
}));

const { toastErrorMock } = vi.hoisted(() => ({ toastErrorMock: vi.fn() }));
vi.mock("sonner", () => ({
  toast: { error: toastErrorMock, success: vi.fn() },
}));

// `@workflow/graph-warning-rules` 는 실제 평가 로직을 그대로 사용하되,
// `evaluateGraphWarningRulesForGraph` 만 per-test 로 throw 시킬 수 있도록
// spy 로 감싼다 (W14 catch 경로 회귀 가드). 평문 호출 시엔 실제 구현 위임.
const { evaluateMock } = vi.hoisted(() => ({ evaluateMock: vi.fn() }));
vi.mock("@workflow/graph-warning-rules", async () => {
  const actual = await vi.importActual<
    typeof import("@workflow/graph-warning-rules")
  >("@workflow/graph-warning-rules");
  evaluateMock.mockImplementation(actual.evaluateGraphWarningRulesForGraph);
  return {
    ...actual,
    evaluateGraphWarningRulesForGraph: (
      ...args: Parameters<typeof actual.evaluateGraphWarningRulesForGraph>
    ) => evaluateMock(...args),
  };
});

import { useEditorStore } from "../editor-store";
import { useRecentNodesStore } from "../recent-nodes-store";
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
  editorClipboard: null,
  pendingContainerDelete: null,
  undoStack: [],
  redoStack: [],
  saveCount: 0,
};

// isContainerNode 는 getNodeDefinition(type)?.isContainer 를 본다 — 컨테이너 삭제
// 테스트(§11.3)를 위해 node-definitions 스토어에 loop/foreach/map 을 컨테이너로 seed.
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
    order: ["loop", "foreach", "map", "action"],
    definitions: {
      loop: make("loop", { isContainer: true }),
      foreach: make("foreach", { isContainer: true }),
      map: make("map", { isContainer: true }),
      action: make("action", {}),
    },
  });
});

describe("useEditorStore", () => {
  beforeEach(() => {
    useEditorStore.setState(initialState);
    toastErrorMock.mockClear();
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

    it("records the node type as recently used (§4.1)", () => {
      // §4.1 — addNode 는 최근 사용 노드 타입 기록의 단일 choke point.
      useRecentNodesStore.setState({ recentNodeTypes: [] });
      useEditorStore
        .getState()
        .addNode(
          makeNode("1", { data: { type: "ai_agent", label: "AI" } }),
        );
      expect(useRecentNodesStore.getState().recentNodeTypes[0]).toBe("ai_agent");
    });
  });

  describe("onConnect — skipUndo (§1.2)", () => {
    // 두 non-container 노드(action) — self/duplicate/container-conflict 없이 연결 성립.
    const connectable = () =>
      useEditorStore.setState({ nodes: [makeNode("1"), makeNode("2")] });
    const connection = {
      source: "1",
      sourceHandle: "out",
      target: "2",
      targetHandle: "in",
    };

    it("opts 미지정이면 pushUndo 로 undoStack 이 1 늘어난다", () => {
      connectable();
      useEditorStore.getState().onConnect(connection);
      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.undoStack).toHaveLength(1);
    });

    it("{skipUndo:true} 면 엣지는 추가하되 undoStack 은 늘리지 않는다 (노드 생성+연결 단일 체크포인트)", () => {
      connectable();
      useEditorStore.getState().onConnect(connection, { skipUndo: true });
      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(1);
      expect(state.undoStack).toHaveLength(0);
    });
  });

  describe("onReconnect (§1.3)", () => {
    // 노드 1,2,3(action) + 엣지 1→2. 재연결 대상은 3.
    const seed = () => {
      useEditorStore.setState({
        nodes: [makeNode("1"), makeNode("2"), makeNode("3")],
        edges: [
          { id: "e1", source: "1", target: "2", sourceHandle: "out", targetHandle: "in", type: "custom" },
        ],
      });
    };
    const toNode3: Connection = {
      source: "1",
      sourceHandle: "out",
      target: "3",
      targetHandle: "in",
    };

    it("유효 재연결이면 엣지 끝점을 갱신하고 id 를 보존한다", () => {
      seed();
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "1", target: "2" } as Edge,
        toNode3,
      );
      const edges = useEditorStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].id).toBe("e1"); // shouldReplaceId:false — id 보존
      expect(edges[0].target).toBe("3");
      expect(useEditorStore.getState().undoStack).toHaveLength(1);
    });

    it("자기연결로의 재연결은 거부한다(변경 없음)", () => {
      seed();
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "1", target: "2" } as Edge,
        { source: "1", sourceHandle: "out", target: "1", targetHandle: "in" },
      );
      const edges = useEditorStore.getState().edges;
      expect(edges[0].target).toBe("2"); // 원상 유지
      expect(useEditorStore.getState().undoStack).toHaveLength(0);
      expect(toastErrorMock).not.toHaveBeenCalled(); // 자기연결은 조용히 거부
    });

    it("이미 존재하는 동일 연결로의 재연결은 중복으로 거부한다", () => {
      // 엣지 2개: e1(1→2), e2(1→3). e1 을 1→3 으로 재연결하면 e2 와 중복.
      useEditorStore.setState({
        nodes: [makeNode("1"), makeNode("2"), makeNode("3")],
        edges: [
          { id: "e1", source: "1", target: "2", sourceHandle: "out", targetHandle: "in", type: "custom" },
          { id: "e2", source: "1", target: "3", sourceHandle: "out", targetHandle: "in", type: "custom" },
        ],
      });
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "1", target: "2" } as Edge,
        toNode3,
      );
      const e1 = useEditorStore.getState().edges.find((e) => e.id === "e1");
      expect(e1?.target).toBe("2"); // 거부되어 원상 유지
      expect(useEditorStore.getState().undoStack).toHaveLength(0);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "These nodes are already connected.",
      );
    });

    it("sourceHandle 이 바뀌는 재연결이면 포트색 data 를 재계산한다", () => {
      // reconnectEdge 는 source/target/handle 만 갱신하므로, sourceHandle 이 바뀌면 stale 한
      // 포트색 data 를 onReconnect 가 buildEdgeDataForConnection 으로 재계산해야 한다.
      useEditorStore.setState({
        nodes: [makeNode("1"), makeNode("2")],
        edges: [
          {
            id: "e1", source: "1", target: "2",
            sourceHandle: "out", targetHandle: "in",
            type: "custom", data: { portType: "data" },
          },
        ],
      });
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "1", target: "2", sourceHandle: "out", targetHandle: "in" } as Edge,
        { source: "1", sourceHandle: "error", target: "2", targetHandle: "in" },
      );
      const e1 = useEditorStore.getState().edges.find((e) => e.id === "e1");
      expect(e1?.sourceHandle).toBe("error");
      // 'error' 핸들은 error 포트색으로 재계산됨(§3.1) — stale 'data' 가 아님.
      expect((e1?.data as Record<string, unknown>)?.portType).toBe("error");
    });

    it("컨테이너 소속 충돌이면 거부한다(엣지 미변경) — evaluateConnection 공용 경로", () => {
      // loopA.body → c 인데 c 가 이미 loopB 의 body child → detectContainerConflict 거부.
      // onConnect/onReconnect 이 공유하는 evaluateConnection 의 충돌 분기를 실증한다.
      useEditorStore.setState({
        nodes: [
          makeNode("la", { data: { type: "loop", label: "LoopA" } }),
          makeNode("lb", { data: { type: "loop", label: "LoopB" } }),
          makeNode("c", { data: { type: "action", label: "C", containerId: "lb" } }),
          makeNode("2"),
        ],
        edges: [
          { id: "e1", source: "la", target: "2", sourceHandle: "body", targetHandle: "in", type: "custom" },
        ],
      });
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "la", target: "2", sourceHandle: "body", targetHandle: "in" } as Edge,
        { source: "la", sourceHandle: "body", target: "c", targetHandle: "in" },
      );
      const e1 = useEditorStore.getState().edges.find((e) => e.id === "e1");
      expect(e1?.target).toBe("2"); // 거부되어 원상 유지
      expect(useEditorStore.getState().undoStack).toHaveLength(0);
      expect(toastErrorMock).toHaveBeenCalled(); // 컨테이너 충돌 메시지 toast
    });

    it("자기 자신과 동일한 연결로의 재연결은 중복으로 오판하지 않는다 (제자리 재연결)", () => {
      // 중복 검사가 재연결 중인 엣지 자신을 제외하지 않으면, 끝점을 원래 포트에 그대로
      // 놓는 "제자리 재연결" 이 자기 자신과 중복으로 거부되는 회귀가 난다.
      seed(); // e1(1→2)
      useEditorStore.getState().onReconnect(
        { id: "e1", source: "1", target: "2", sourceHandle: "out", targetHandle: "in" } as Edge,
        { source: "1", sourceHandle: "out", target: "2", targetHandle: "in" },
      );
      const edges = useEditorStore.getState().edges;
      expect(edges).toHaveLength(1);
      expect(edges[0].target).toBe("2"); // 거부되지 않고 정상 처리
      expect(useEditorStore.getState().undoStack).toHaveLength(1);
    });
  });

  describe("removeEdge (§1.3 detach)", () => {
    it("엣지를 제거하고 undo 스냅샷을 남긴다", () => {
      useEditorStore.setState({
        nodes: [makeNode("1"), makeNode("2")],
        edges: [makeEdge("1", "2")],
      });
      useEditorStore.getState().removeEdge("1-2");
      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(0);
      expect(state.undoStack).toHaveLength(1);
    });

    it("컨테이너 진입(body) 엣지 제거 시 자식의 containerId 를 재도출한다", () => {
      useEditorStore.setState({
        nodes: [
          makeNode("la", { data: { type: "loop", label: "LoopA" } }),
          makeNode("c", { data: { type: "action", label: "C", containerId: "la" } }),
        ],
        edges: [
          { id: "body1", source: "la", target: "c", sourceHandle: "body", targetHandle: "in", type: "custom" },
        ],
      });
      useEditorStore.getState().removeEdge("body1");
      const c = useEditorStore.getState().nodes.find((n) => n.id === "c");
      expect((c?.data as Record<string, unknown>)?.containerId ?? null).toBeNull();
    });

    it("{skipUndo:true} 면 엣지는 제거하되 undoStack 은 늘리지 않는다 (§4.1 분할 단일 체크포인트)", () => {
      useEditorStore.setState({
        nodes: [makeNode("1"), makeNode("2")],
        edges: [makeEdge("1", "2")],
        undoStack: [],
      });
      useEditorStore.getState().removeEdge("1-2", { skipUndo: true });
      const state = useEditorStore.getState();
      expect(state.edges).toHaveLength(0);
      expect(state.undoStack).toHaveLength(0);
    });
  });

  // §4.1 — onDrop 이 오케스트레이션하는 분할 시퀀스(노드 추가 → removeEdge(skipUndo) →
  // onConnect×2(skipUndo))를 store 레벨에서 재현해 배선 회귀를 잡는다. buildEdgeSplitPlan(순수)은
  // edge-utils.test.ts 에서 전수 커버하고, 여기선 store 합성(원자성·containerId 전파)을 검증한다.
  describe("엣지 분할 store 시퀀스 (§4.1)", () => {
    it("plain 엣지 분할: onConnect 2회 모두 성공해 최종 엣지가 A→N, N→B 두 개 (원자성 lock)", () => {
      useEditorStore.setState({
        nodes: [makeNode("A"), makeNode("B"), makeNode("N")],
        edges: [makeEdge("A", "B")],
        undoStack: [],
      });
      const s = useEditorStore.getState();
      s.removeEdge("A-B", { skipUndo: true });
      s.onConnect(
        { source: "A", sourceHandle: "out", target: "N", targetHandle: "in" },
        { skipUndo: true },
      );
      s.onConnect(
        { source: "N", sourceHandle: "out", target: "B", targetHandle: "in" },
        { skipUndo: true },
      );
      const edges = useEditorStore.getState().edges;
      expect(edges.map((e) => `${e.source}->${e.target}`).sort()).toEqual([
        "A->N",
        "N->B",
      ]);
    });

    it("Loop body 내부 체인 엣지 분할 시 새 노드가 컨테이너 containerId 를 상속한다", () => {
      useEditorStore.setState({
        nodes: [
          makeNode("L", { data: { type: "loop", label: "Loop" } }),
          makeNode("A", { data: { type: "action", label: "A", containerId: "L" } }),
          makeNode("B", { data: { type: "action", label: "B", containerId: "L" } }),
          makeNode("N", { data: { type: "action", label: "N" } }),
        ],
        edges: [
          { id: "body", source: "L", target: "A", sourceHandle: "body", targetHandle: "in", type: "custom" },
          { id: "A-B", source: "A", target: "B", sourceHandle: "out", targetHandle: "in", type: "custom" },
          { id: "emit", source: "B", target: "L", sourceHandle: "out", targetHandle: "emit", type: "custom" },
        ],
        undoStack: [],
      });
      const s = useEditorStore.getState();
      s.removeEdge("A-B", { skipUndo: true });
      s.onConnect(
        { source: "A", sourceHandle: "out", target: "N", targetHandle: "in" },
        { skipUndo: true },
      );
      s.onConnect(
        { source: "N", sourceHandle: "out", target: "B", targetHandle: "in" },
        { skipUndo: true },
      );
      const n = useEditorStore.getState().nodes.find((x) => x.id === "N");
      expect((n?.data as Record<string, unknown>)?.containerId).toBe("L");
    });

    it("삽입 후 undo() 1회로 전체 취소 + undoStack 정확히 0 (단일 체크포인트, phantom 없음)", () => {
      useEditorStore.setState({
        nodes: [makeNode("A"), makeNode("B")],
        edges: [makeEdge("A", "B")],
        undoStack: [],
      });
      const s = useEditorStore.getState();
      // buildAndAddNode(중복 pushUndo 제거 후) = addNode 의 pushUndo 1회 = 단일 체크포인트.
      s.addNode(makeNode("N"));
      s.removeEdge("A-B", { skipUndo: true });
      s.onConnect(
        { source: "A", sourceHandle: "out", target: "N", targetHandle: "in" },
        { skipUndo: true },
      );
      s.onConnect(
        { source: "N", sourceHandle: "out", target: "B", targetHandle: "in" },
        { skipUndo: true },
      );
      // 스냅샷이 정확히 1개(phantom 이중 pushUndo 없음).
      expect(useEditorStore.getState().undoStack).toHaveLength(1);
      useEditorStore.getState().undo();
      const state = useEditorStore.getState();
      expect(state.undoStack).toHaveLength(0);
      expect(state.nodes.map((n) => n.id)).toEqual(["A", "B"]); // 새 노드 제거
      expect(state.edges.map((e) => e.id)).toEqual(["A-B"]); // 원본 엣지 복원
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

  // cross-node graphWarningRules 로컬 평가 (네트워크 round-trip 제거).
  // SoT: spec/conventions/cross-node-warning-rules.md.
  describe("evaluateGraphWarningsLocal", () => {
    // Parallel 노드를 만든다. config (maxConcurrency/branchCount) 와 label 은
    // data 페이로드에 들어가야 평가 규칙이 본다.
    const parallelNode = (
      id: string,
      config?: Record<string, unknown>,
    ): Node => ({
      id,
      position: { x: 0, y: 0 },
      data: { type: "parallel", label: id, config: config ?? {} },
    });
    // branch_0 outgoing edge — parallel 분기 body 진입점.
    const branchEdge = (source: string, target: string): Edge => ({
      id: `${source}-branch_0-${target}`,
      source,
      sourceHandle: "branch_0",
      target,
    });

    beforeEach(() => {
      useEditorStore.setState({
        ...initialState,
        workflowId: "wf-1",
        graphWarnings: { results: [], hasError: false, hasWarning: false },
      } as never);
    });

    it("produces an error result for a 3-level nested Parallel graph", () => {
      // P1.body ⊃ P2 ; P2.body ⊃ P3 → depth 3 → error.
      const nodes: Node[] = [
        parallelNode("P1"),
        parallelNode("P2"),
        parallelNode("P3"),
      ];
      const edges: Edge[] = [
        branchEdge("P1", "P2"),
        branchEdge("P2", "P3"),
      ];
      useEditorStore.setState({ nodes, edges } as never);

      useEditorStore.getState().evaluateGraphWarningsLocal();

      const { results, hasError } = useEditorStore.getState().graphWarnings;
      expect(hasError).toBe(true);
      expect(
        results.some(
          (r) =>
            r.severity === "error" &&
            r.ruleId === "parallel:nested-depth-exceeded" &&
            r.nodeId === "P1",
        ),
      ).toBe(true);
    });

    it("produces an empty result (no error/warning) for a flat graph", () => {
      const nodes: Node[] = [makeNode("a"), makeNode("b")];
      const edges: Edge[] = [makeEdge("a", "b")];
      useEditorStore.setState({ nodes, edges } as never);

      useEditorStore.getState().evaluateGraphWarningsLocal();

      const { results, hasError, hasWarning } =
        useEditorStore.getState().graphWarnings;
      expect(results).toEqual([]);
      expect(hasError).toBe(false);
      expect(hasWarning).toBe(false);
    });

    it("maps node config so the concurrency-cap warning fires", () => {
      // P1 (maxConcurrency 8) ⊃ P2 (maxConcurrency 8) = 64 > cap 32 → warning.
      const nodes: Node[] = [
        parallelNode("P1", { maxConcurrency: 8 }),
        parallelNode("P2", { maxConcurrency: 8 }),
      ];
      const edges: Edge[] = [branchEdge("P1", "P2")];
      useEditorStore.setState({ nodes, edges } as never);

      useEditorStore.getState().evaluateGraphWarningsLocal();

      const { hasError, hasWarning } = useEditorStore.getState().graphWarnings;
      expect(hasError).toBe(false);
      expect(hasWarning).toBe(true);
    });

    // W14 회귀 가드 — 평가기가 throw 하면 새 그래프 상태로 결과를 덮어쓰지 않고
    // 직전 `graphWarnings` 를 보존해야 한다 (spec: "평가 실패 시 기존 결과 유지").
    it("preserves prior graphWarnings when the evaluator throws", () => {
      const prior = {
        results: [
          {
            ruleId: "parallel:nested-depth-exceeded",
            severity: "error" as const,
            nodeId: "P1",
            message: "기존 경고",
          },
        ],
        hasError: true,
        hasWarning: false,
      };
      useEditorStore.setState({
        nodes: [parallelNode("P1")],
        edges: [],
        graphWarnings: prior,
      } as never);

      evaluateMock.mockImplementationOnce(() => {
        throw new Error("boom");
      });

      // throw 가 store action 밖으로 새지 않고(catch) 직전 상태가 그대로 유지.
      expect(() =>
        useEditorStore.getState().evaluateGraphWarningsLocal(),
      ).not.toThrow();
      expect(useEditorStore.getState().graphWarnings).toEqual(prior);
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

  // §2.2 금지 연결 — 자기연결/중복 하드 차단. 사이클은 warn-not-block(배지)이라
  // 여기서 막지 않는다.
  describe("onConnect — 금지 연결 하드 차단 (§2.2)", () => {
    it("자기연결(source===target)은 엣지를 추가하지 않는다", () => {
      useEditorStore.setState({ nodes: [makeNode("a")], edges: [] });
      useEditorStore.getState().onConnect({
        source: "a",
        target: "a",
        sourceHandle: "out",
        targetHandle: "in",
      });
      expect(useEditorStore.getState().edges).toHaveLength(0);
    });

    it("동일 연결 중복은 토스트 + 엣지 미추가", () => {
      useEditorStore.setState({
        nodes: [makeNode("a"), makeNode("b")],
        edges: [
          {
            id: "a-b",
            source: "a",
            target: "b",
            sourceHandle: "out",
            targetHandle: "in",
          } as Edge,
        ],
      });
      useEditorStore.getState().onConnect({
        source: "a",
        target: "b",
        sourceHandle: "out",
        targetHandle: "in",
      });
      expect(useEditorStore.getState().edges).toHaveLength(1);
      expect(toastErrorMock).toHaveBeenCalledWith(
        "These nodes are already connected.",
      );
    });

    it("정상 연결은 엣지를 추가한다", () => {
      useEditorStore.setState({
        nodes: [makeNode("a"), makeNode("b")],
        edges: [],
      });
      useEditorStore.getState().onConnect({
        source: "a",
        target: "b",
        sourceHandle: "out",
        targetHandle: "in",
      });
      expect(useEditorStore.getState().edges).toHaveLength(1);
    });
  });

  describe("isValidConnection — 드래그 중 자기연결 커서 차단 (§2.2)", () => {
    it("자기연결은 false", () => {
      const valid = useEditorStore.getState().isValidConnection({
        source: "a",
        target: "a",
        sourceHandle: "out",
        targetHandle: "in",
      });
      expect(valid).toBe(false);
    });

    it("서로 다른 노드 간 연결은 true (중복/사이클은 여기서 막지 않음)", () => {
      const valid = useEditorStore.getState().isValidConnection({
        source: "a",
        target: "b",
        sourceHandle: "out",
        targetHandle: "in",
      });
      expect(valid).toBe(true);
    });
  });

  // §3.2/§3.3 클립보드·선택 액션
  describe("copy / paste / duplicate / select (§3.2/§3.3)", () => {
    const sel = (id: string, x = 0, y = 0): Node =>
      makeNode(id, { position: { x, y }, selected: true });

    it("copySelection: 선택 노드 + 양끝이 선택된 내부 엣지만 클립보드에 담는다", () => {
      useEditorStore.setState({
        nodes: [sel("a", 0, 0), sel("b", 100, 0), makeNode("c")],
        edges: [makeEdge("a", "b"), makeEdge("b", "c")],
      });
      useEditorStore.getState().copySelection();
      const clip = useEditorStore.getState().editorClipboard!;
      expect(clip.nodes.map((n) => n.id).sort()).toEqual(["a", "b"]);
      expect(clip.edges).toHaveLength(1); // a→b (내부), b→c 제외
      expect(clip.edges[0].source).toBe("a");
      // 클립보드 노드는 selected 해제된 스냅샷
      expect(clip.nodes.every((n) => !n.selected)).toBe(true);
    });

    it("copySelection: 선택 없으면 no-op (클립보드 null 유지)", () => {
      useEditorStore.setState({ nodes: [makeNode("a")], edges: [] });
      useEditorStore.getState().copySelection();
      expect(useEditorStore.getState().editorClipboard).toBeNull();
    });

    it("pasteClipboard: 신규 id·오프셋·유니크 라벨로 추가하고 붙여넣은 노드를 선택한다", () => {
      useEditorStore.setState({
        nodes: [sel("a", 10, 10), sel("b", 30, 10)],
        edges: [makeEdge("a", "b")],
      });
      useEditorStore.getState().copySelection();
      useEditorStore.getState().pasteClipboard();
      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(4); // 원본 2 + 붙여넣기 2
      // 원본 id 는 유지, 신규 노드는 새 id
      const newNodes = state.nodes.filter((n) => n.id !== "a" && n.id !== "b");
      expect(newNodes).toHaveLength(2);
      // 오프셋 +40,+40
      const pastedA = newNodes.find(
        (n) => (n.data as { label?: string }).label === "Node a 2",
      )!;
      expect(pastedA.position).toEqual({ x: 50, y: 50 });
      // 붙여넣은 노드 selected, 원본 deselected
      expect(newNodes.every((n) => n.selected)).toBe(true);
      expect(
        state.nodes.filter((n) => n.id === "a" || n.id === "b").every((n) => !n.selected),
      ).toBe(true);
      // 내부 엣지도 신규 id 로 재연결
      expect(state.edges).toHaveLength(2);
      expect(state.isDirty).toBe(true);
      expect(state.undoStack).toHaveLength(1);
    });

    it("pasteClipboard: anchor 지정 시 묶음 좌상단이 anchor 로 온다", () => {
      useEditorStore.setState({
        nodes: [sel("a", 100, 100), sel("b", 140, 100)],
        edges: [],
      });
      useEditorStore.getState().copySelection();
      useEditorStore.getState().pasteClipboard({ x: 0, y: 0 });
      const newNodes = useEditorStore
        .getState()
        .nodes.filter((n) => n.id !== "a" && n.id !== "b");
      const minX = Math.min(...newNodes.map((n) => n.position.x));
      const minY = Math.min(...newNodes.map((n) => n.position.y));
      expect({ x: minX, y: minY }).toEqual({ x: 0, y: 0 });
    });

    it("pasteClipboard: 클립보드 null 이면 no-op", () => {
      useEditorStore.setState({ nodes: [makeNode("a")], edges: [] });
      useEditorStore.getState().pasteClipboard();
      expect(useEditorStore.getState().nodes).toHaveLength(1);
    });

    it("duplicateSelection: 선택 노드+내부 엣지를 클립보드 없이 즉시 복제", () => {
      useEditorStore.setState({
        nodes: [sel("a"), sel("b"), makeNode("c")],
        edges: [makeEdge("a", "b")],
      });
      useEditorStore.getState().duplicateSelection();
      const state = useEditorStore.getState();
      expect(state.nodes).toHaveLength(5); // 3 + 복제 2
      expect(state.editorClipboard).toBeNull(); // 클립보드 미변경
      expect(state.undoStack).toHaveLength(1);
    });

    it("paste·duplicate 도 recent 를 기록한다 — addNode 우회 경로 (§4.1)", () => {
      // duplicateSelection: 복제한 타입 기록
      useRecentNodesStore.setState({ recentNodeTypes: [] });
      useEditorStore.setState({
        nodes: [
          makeNode("a", {
            selected: true,
            data: { type: "http_request", label: "H" },
          }),
        ],
        edges: [],
      });
      useEditorStore.getState().duplicateSelection();
      expect(useRecentNodesStore.getState().recentNodeTypes).toContain(
        "http_request",
      );

      // pasteClipboard: 붙여넣은 타입 기록
      useRecentNodesStore.setState({ recentNodeTypes: [] });
      useEditorStore.setState({
        nodes: [
          makeNode("x", {
            selected: true,
            data: { type: "code", label: "C" },
          }),
        ],
        edges: [],
      });
      useEditorStore.getState().copySelection();
      useEditorStore.getState().pasteClipboard();
      expect(useRecentNodesStore.getState().recentNodeTypes).toContain("code");
    });

    it("duplicateSelection: 동일 라벨 노드 2개 동시 복제 시 각각 유니크 라벨 부여", () => {
      // 같은 label("Dup") 을 가진 두 노드를 함께 복제 → 서로 충돌 없이 유니크화.
      useEditorStore.setState({
        nodes: [
          makeNode("a", { selected: true, data: { type: "action", label: "Dup" } }),
          makeNode("b", { selected: true, data: { type: "action", label: "Dup" } }),
        ],
        edges: [],
      });
      useEditorStore.getState().duplicateSelection();
      const state = useEditorStore.getState();
      // 복제본 2개(신규 id)의 라벨은 서로 다르고, 원본 라벨 "Dup" 과도 겹치지 않는다.
      const cloneLabels = state.nodes
        .filter((n) => n.id !== "a" && n.id !== "b")
        .map((n) => (n.data as { label?: string }).label);
      expect(cloneLabels).toHaveLength(2);
      expect(new Set(cloneLabels).size).toBe(2); // 두 복제본 라벨 서로 다름
      expect(cloneLabels).not.toContain("Dup"); // 원본과도 다름
    });

    it("selectAll / deselectAll", () => {
      useEditorStore.setState({
        nodes: [makeNode("a"), makeNode("b")],
        edges: [],
        selectedNodeId: "a",
      });
      useEditorStore.getState().selectAll();
      expect(useEditorStore.getState().nodes.every((n) => n.selected)).toBe(true);
      useEditorStore.getState().deselectAll();
      const state = useEditorStore.getState();
      expect(state.nodes.every((n) => !n.selected)).toBe(true);
      expect(state.selectedNodeId).toBeNull();
    });
  });

  // §11.3 컨테이너 삭제 확인 다이얼로그 (loop = 실제 컨테이너 타입)
  describe("container delete (§11.3)", () => {
    const container = (id: string): Node =>
      makeNode(id, { data: { type: "loop", label: `Loop ${id}` } });
    const child = (id: string, containerId: string): Node =>
      makeNode(id, { data: { type: "action", label: `Child ${id}`, containerId } });

    it("needsContainerDeleteConfirm: 자식 있는 컨테이너만 true", () => {
      useEditorStore.setState({
        nodes: [container("loop"), child("c1", "loop"), makeNode("plain")],
        edges: [],
      });
      const s = useEditorStore.getState();
      expect(s.needsContainerDeleteConfirm("loop")).toBe(true);
      expect(s.needsContainerDeleteConfirm("plain")).toBe(false);
    });

    it("needsContainerDeleteConfirm: 빈 컨테이너는 false", () => {
      useEditorStore.setState({ nodes: [container("loop")], edges: [] });
      expect(useEditorStore.getState().needsContainerDeleteConfirm("loop")).toBe(
        false,
      );
    });

    it("requestNodeDelete: 자식 있는 컨테이너면 다이얼로그를 열고 삭제하지 않는다", () => {
      useEditorStore.setState({
        nodes: [container("loop"), child("c1", "loop")],
        edges: [],
      });
      useEditorStore.getState().requestNodeDelete("loop");
      const s = useEditorStore.getState();
      expect(s.pendingContainerDelete).toEqual({
        id: "loop",
        label: "Loop loop",
        childCount: 1,
      });
      expect(s.nodes).toHaveLength(2); // 아직 미삭제
    });

    it("requestNodeDelete: 일반 노드는 즉시 삭제", () => {
      useEditorStore.setState({
        nodes: [makeNode("plain"), makeNode("keep")],
        edges: [],
      });
      useEditorStore.getState().requestNodeDelete("plain");
      const s = useEditorStore.getState();
      expect(s.nodes.map((n) => n.id)).toEqual(["keep"]);
      expect(s.pendingContainerDelete).toBeNull();
    });

    it("requestNodeDelete: 빈 컨테이너는 즉시 삭제", () => {
      useEditorStore.setState({ nodes: [container("loop")], edges: [] });
      useEditorStore.getState().requestNodeDelete("loop");
      expect(useEditorStore.getState().nodes).toHaveLength(0);
    });

    it("confirmContainerDelete('ungroup'): 컨테이너만 제거, 자식은 top-level 승격", () => {
      useEditorStore.setState({
        nodes: [container("loop"), child("c1", "loop"), child("c2", "loop")],
        edges: [],
        pendingContainerDelete: { id: "loop", label: "Loop loop", childCount: 2 },
      });
      useEditorStore.getState().confirmContainerDelete("ungroup");
      const s = useEditorStore.getState();
      expect(s.nodes.map((n) => n.id).sort()).toEqual(["c1", "c2"]);
      // 승격된 자식의 containerId 는 null
      expect(
        s.nodes.every((n) => (n.data as { containerId?: string }).containerId == null),
      ).toBe(true);
      expect(s.pendingContainerDelete).toBeNull();
    });

    it("confirmContainerDelete('deleteAll'): 컨테이너+자식 cascade 삭제", () => {
      useEditorStore.setState({
        nodes: [
          container("loop"),
          child("c1", "loop"),
          child("c2", "loop"),
          makeNode("outside"),
        ],
        edges: [makeEdge("c1", "c2"), makeEdge("outside", "c1")],
        pendingContainerDelete: { id: "loop", label: "Loop loop", childCount: 2 },
      });
      useEditorStore.getState().confirmContainerDelete("deleteAll");
      const s = useEditorStore.getState();
      expect(s.nodes.map((n) => n.id)).toEqual(["outside"]);
      // 삭제 노드에 연결된 엣지 모두 제거
      expect(s.edges).toHaveLength(0);
      expect(s.pendingContainerDelete).toBeNull();
    });

    it("confirmContainerDelete('deleteAll'): 3단 중첩 — 직접 자식만 cascade, 손자는 top-level 승격(비파괴)", () => {
      // loop → innerLoop(loop 의 자식 컨테이너) → grandchild(innerLoop 의 자식).
      // loop deleteAll 시 직접 자식(innerLoop)만 제거되고, 손자 grandchild 의 containerId
      // 는 innerLoop 를 가리켜 toRemove 에 없으므로 살아남아 top-level 로 승격된다.
      useEditorStore.setState({
        nodes: [
          container("loop"),
          makeNode("innerLoop", {
            data: { type: "loop", label: "Inner", containerId: "loop" },
          }),
          makeNode("grandchild", {
            data: { type: "action", label: "GC", containerId: "innerLoop" },
          }),
        ],
        edges: [],
        pendingContainerDelete: { id: "loop", label: "Loop loop", childCount: 1 },
      });
      useEditorStore.getState().confirmContainerDelete("deleteAll");
      const s = useEditorStore.getState();
      // loop + innerLoop 제거, grandchild 는 top-level 로 생존
      expect(s.nodes.map((n) => n.id)).toEqual(["grandchild"]);
      expect(
        (s.nodes[0].data as { containerId?: string | null }).containerId,
      ).toBeNull();
    });

    it("cancelContainerDelete: 다이얼로그만 닫고 아무것도 삭제 안 함", () => {
      useEditorStore.setState({
        nodes: [container("loop"), child("c1", "loop")],
        edges: [],
        pendingContainerDelete: { id: "loop", label: "Loop loop", childCount: 1 },
      });
      useEditorStore.getState().cancelContainerDelete();
      const s = useEditorStore.getState();
      expect(s.pendingContainerDelete).toBeNull();
      expect(s.nodes).toHaveLength(2);
    });
  });
});
