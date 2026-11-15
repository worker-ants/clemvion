import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeSettingsPanel } from "../node-settings-panel";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

/**
 * 티어2 ③ — Error Handling 패널이 엔진의 nested `errorHandling` 계약
 * (`{ policy, retryConfig?, defaultOutput? }`) 으로 저장하고, 레거시 flat
 * `errorPolicy` 를 마이그레이션하며, Retry / Use-Default-Output 입력을 노출하는지.
 */
function seedNode(
  config: Record<string, unknown>,
  node: { type: string; label: string; category: string } = {
    type: "code",
    label: "Code",
    category: "data",
  },
) {
  useEditorStore.setState({
    nodes: [
      {
        id: "n1",
        type: "default",
        position: { x: 0, y: 0 },
        data: { ...node, config },
      },
    ] as never,
    edges: [],
    selectedNodeId: "n1",
  });
}

function savedConfig(): Record<string, unknown> {
  const node = useEditorStore
    .getState()
    .nodes.find((n) => n.id === "n1") as unknown as {
    data: { config: Record<string, unknown> };
  };
  return node.data.config;
}

describe("NodeSettingsPanel — error handling", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    // Explicit store reset to isolate tests (no order-dependent leakage).
    useEditorStore.setState({ nodes: [], edges: [], selectedNodeId: null });
  });
  afterEach(() => {
    cleanup();
    useEditorStore.setState({ nodes: [], edges: [], selectedNodeId: null });
  });

  it("migrates legacy flat errorPolicy to the engine policy enum", () => {
    seedNode({ errorPolicy: "skip" });
    render(<NodeSettingsPanel />);
    const select = screen.getByDisplayValue("Skip Node") as HTMLSelectElement;
    expect(select.value).toBe("skip_node");
  });

  it("saves retry policy as nested errorHandling.retryConfig and drops legacy key", async () => {
    const user = userEvent.setup();
    seedNode({ errorPolicy: "stop" });
    render(<NodeSettingsPanel />);

    const select = screen.getByDisplayValue("Stop Workflow");
    await user.selectOptions(select, "retry");

    const maxRetries = screen.getByDisplayValue("3");
    await user.clear(maxRetries);
    await user.type(maxRetries, "5");

    await user.click(screen.getByText("Save Changes"));

    const cfg = savedConfig();
    expect(cfg.errorPolicy).toBeUndefined();
    expect(cfg.errorHandling).toEqual({
      policy: "retry",
      retryConfig: { maxRetries: 5, retryInterval: 1000, backoffMultiplier: 2 },
    });
  });

  it("blocks save on invalid default-output JSON", async () => {
    const user = userEvent.setup();
    seedNode({ errorHandling: { policy: "use_default_output" } });
    render(<NodeSettingsPanel />);

    const editor = screen.getByDisplayValue("{}");
    fireEvent.change(editor, { target: { value: "{ not json" } });
    await user.click(screen.getByText("Save Changes"));

    expect(screen.getByText("Invalid JSON")).toBeDefined();
    // config unchanged (still only the seeded policy, no parsed defaultOutput)
    expect(savedConfig().errorHandling).toEqual({ policy: "use_default_output" });
  });

  it("saves parsed default-output JSON", async () => {
    const user = userEvent.setup();
    seedNode({ errorHandling: { policy: "use_default_output" } });
    render(<NodeSettingsPanel />);

    const editor = screen.getByDisplayValue("{}");
    fireEvent.change(editor, { target: { value: '{"fallback":true}' } });
    await user.click(screen.getByText("Save Changes"));

    expect(savedConfig().errorHandling).toEqual({
      policy: "use_default_output",
      defaultOutput: { fallback: true },
    });
  });

  /**
   * 고정 `error` 포트가 없는 노드에서 정책을 「에러 포트로 라우팅」에서 다른 정책으로 바꿔
   * 저장하면 동적 에러 포트가 사라진다. 그 포트의 연결선은 저장할 때 바로 지우고, 되돌리기
   * 한 번으로 정책과 연결선이 함께 돌아온다([노드 포트와 설정 패널 「에러 처리 정책 설정」](CLE-WF-NODEPANEL#에러-처리-정책-설정)).
   */
  describe("dynamic error port edges on policy change", () => {
    const def = (
      type: string,
      outputs: NodeDefinition["outputs"],
    ): NodeDefinition => ({
      type,
      category: "data",
      label: type,
      description: "",
      icon: "Box",
      color: "#000",
      inputs: [{ id: "in", label: "In", type: "data" }],
      outputs,
      defaultConfig: {},
      configSchema: {},
    });
    let snapshot: ReturnType<typeof useNodeDefinitionsStore.getState>;
    beforeAll(() => {
      snapshot = useNodeDefinitionsStore.getState();
      useNodeDefinitionsStore.setState({
        status: "ready",
        error: null,
        order: [...snapshot.order, "code", "http_request"],
        definitions: {
          ...snapshot.definitions,
          code: def("code", [{ id: "out", label: "Out", type: "data" }]),
          http_request: def("http_request", [
            { id: "success", label: "Success", type: "data" },
            { id: "error", label: "Error", type: "error" },
          ]),
        },
      });
    });
    afterAll(() => {
      useNodeDefinitionsStore.setState(snapshot);
    });

    function seedWithEdges(
      config: Record<string, unknown>,
      node: { type: string; label: string; category: string } = {
        type: "code",
        label: "Code",
        category: "data",
      },
    ) {
      useEditorStore.setState({
        nodes: [
          {
            id: "n1",
            type: "default",
            position: { x: 0, y: 0 },
            data: { ...node, config },
          },
          {
            id: "n2",
            type: "default",
            position: { x: 0, y: 100 },
            data: { type: "code", label: "Next", category: "data", config: {} },
          },
          {
            id: "n3",
            type: "default",
            position: { x: 0, y: 200 },
            data: {
              type: "code",
              label: "Handler",
              category: "data",
              config: {},
            },
          },
        ] as never,
        edges: [
          {
            id: "e-out",
            source: "n1",
            sourceHandle: "out",
            target: "n2",
            targetHandle: "in",
          },
          {
            id: "e-err",
            source: "n1",
            sourceHandle: "error",
            target: "n3",
            targetHandle: "in",
          },
        ] as never,
        selectedNodeId: "n1",
        undoStack: [],
        redoStack: [],
      });
    }
    const edgeIds = () => useEditorStore.getState().edges.map((e) => e.id);

    it("removes the error edge when the policy leaves route_to_error_port", async () => {
      const user = userEvent.setup();
      seedWithEdges({ errorHandling: { policy: "route_to_error_port" } });
      render(<NodeSettingsPanel />);

      await user.selectOptions(
        screen.getByDisplayValue("Route to Error Port"),
        "skip_node",
      );
      await user.click(screen.getByText("Save Changes"));

      expect(edgeIds()).toEqual(["e-out"]);
      expect(savedConfig().errorHandling).toEqual({ policy: "skip_node" });
    });

    it("restores the policy and the error edge with one undo", async () => {
      const user = userEvent.setup();
      seedWithEdges({ errorHandling: { policy: "route_to_error_port" } });
      render(<NodeSettingsPanel />);

      await user.selectOptions(
        screen.getByDisplayValue("Route to Error Port"),
        "stop_workflow",
      );
      await user.click(screen.getByText("Save Changes"));
      useEditorStore.getState().undo();

      expect(edgeIds()).toEqual(["e-out", "e-err"]);
      expect(savedConfig().errorHandling).toEqual({
        policy: "route_to_error_port",
      });
    });

    it("keeps the error edge while the policy stays route_to_error_port", async () => {
      const user = userEvent.setup();
      seedWithEdges({ errorHandling: { policy: "route_to_error_port" } });
      render(<NodeSettingsPanel />);

      await user.click(screen.getByText("Save Changes"));

      expect(edgeIds()).toEqual(["e-out", "e-err"]);
    });

    it("keeps the fixed error port edge on a node that has one", async () => {
      const user = userEvent.setup();
      seedWithEdges(
        { errorHandling: { policy: "route_to_error_port" } },
        { type: "http_request", label: "HTTP", category: "integration" },
      );
      render(<NodeSettingsPanel />);

      await user.selectOptions(
        screen.getByDisplayValue("Route to Error Port"),
        "stop_workflow",
      );
      await user.click(screen.getByText("Save Changes"));

      expect(edgeIds()).toContain("e-err");
    });
  });

  /**
   * ForEach · Map · Parallel 의 `config.errorPolicy` 는 레거시 키가 아니라 현행 항목 에러 정책이다
   * (CLE-NODE-LOGIC-COMMON 항목 에러 정책). 설정 패널이 이를 노드 에러 처리 정책으로 옮기거나
   * 저장할 때 지우면 사용자가 고른 항목 정책이 사라진다.
   */
  describe("container item error policy (config.errorPolicy)", () => {
    const containers = [
      { type: "foreach", label: "ForEach", itemPolicy: "skip" },
      { type: "map", label: "Map", itemPolicy: "continue" },
      { type: "parallel", label: "Parallel", itemPolicy: "cancel-others-on-fail" },
    ];

    it.each(containers)(
      "$type: does not migrate errorPolicy into the node error policy",
      ({ type, label, itemPolicy }) => {
        seedNode({ errorPolicy: itemPolicy }, { type, label, category: "logic" });
        render(<NodeSettingsPanel />);
        expect(screen.getByDisplayValue("Stop Workflow")).toBeDefined();
        expect(screen.queryByDisplayValue("Skip Node")).toBeNull();
      },
    );

    it.each(containers)(
      "$type: keeps errorPolicy on save",
      async ({ type, label, itemPolicy }) => {
        const user = userEvent.setup();
        seedNode({ errorPolicy: itemPolicy }, { type, label, category: "logic" });
        render(<NodeSettingsPanel />);

        await user.click(screen.getByText("Save Changes"));

        const cfg = savedConfig();
        expect(cfg.errorPolicy).toBe(itemPolicy);
        expect(cfg.errorHandling).toEqual({ policy: "stop_workflow" });
      },
    );
  });
});
