import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NodeSettingsPanel } from "../node-settings-panel";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * 티어2 ③ — Error Handling 패널이 엔진의 nested `errorHandling` 계약
 * (`{ policy, retryConfig?, defaultOutput? }`) 으로 저장하고, 레거시 flat
 * `errorPolicy` 를 마이그레이션하며, Retry / Use-Default-Output 입력을 노출하는지.
 */
function seedNode(config: Record<string, unknown>) {
  useEditorStore.setState({
    nodes: [
      {
        id: "n1",
        type: "default",
        position: { x: 0, y: 0 },
        data: { type: "code", label: "Code", config, category: "data" },
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
});
