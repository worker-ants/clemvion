import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { NodeSettingsPanel } from "../node-settings-panel";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

/**
 * Regression: node-specific config edits must commit to the store immediately
 * (and mark the workflow dirty), not sit in local state until "Save Changes".
 * Otherwise a Manual Trigger parameter + its defaultValue is silently dropped
 * on Run (saveBeforeRun only persists when isDirty and reads store config).
 */
function seedManualTrigger() {
  useEditorStore.setState({
    nodes: [
      {
        id: "trig",
        type: "default",
        position: { x: 0, y: 0 },
        data: {
          type: "manual_trigger",
          label: "Manual Trigger",
          config: {},
          category: "trigger",
        },
      },
    ] as never,
    edges: [],
    selectedNodeId: "trig",
    isDirty: false,
  });
}

function storeConfig(): Record<string, unknown> {
  const node = useEditorStore
    .getState()
    .nodes.find((n) => n.id === "trig") as unknown as {
    data: { config: Record<string, unknown> };
  };
  return node.data.config;
}

describe("NodeSettingsPanel — live config commit", () => {
  beforeEach(() => {
    useLocaleStore.setState({ locale: "en" });
    useEditorStore.setState({ nodes: [], edges: [], selectedNodeId: null, isDirty: false });
  });
  afterEach(() => {
    cleanup();
    useEditorStore.setState({ nodes: [], edges: [], selectedNodeId: null, isDirty: false });
  });

  it("commits a trigger parameter to the store and marks dirty without clicking Save Changes", () => {
    seedManualTrigger();
    render(<NodeSettingsPanel />);

    // Add a parameter and give it a name + default — no "Save Changes" click.
    fireEvent.click(screen.getByText(/Add Parameter/i));
    const nameInput = screen.getByPlaceholderText(/Parameter name/i);
    fireEvent.change(nameInput, { target: { value: "region" } });

    const params = storeConfig().parameters as Array<{ name: string }>;
    expect(params).toHaveLength(1);
    expect(params[0].name).toBe("region");
    expect(useEditorStore.getState().isDirty).toBe(true);
  });
});
