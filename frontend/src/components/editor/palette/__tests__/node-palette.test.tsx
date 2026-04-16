import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../canvas/node-icon", () => ({
  NodeIcon: ({ name }: { name: string }) => <span data-testid="node-icon">{name}</span>,
}));

import { NodePalette } from "../node-palette";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

function makeNode(type: string, category: NodeDefinition["category"], label: string): NodeDefinition {
  return {
    type,
    category,
    label,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [],
    outputs: [],
    defaultConfig: {},
    configSchema: {},
  };
}

beforeEach(() => {
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    categories: [
      { id: "trigger", label: "Trigger", icon: "Zap", color: "#F59E0B", order: 0 },
      { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
      { id: "ai", label: "AI", icon: "Sparkles", color: "#10B981", order: 3 },
    ],
    order: ["manual_trigger", "if_else", "ai_agent"],
    definitions: {
      manual_trigger: makeNode("manual_trigger", "trigger", "Manual Trigger"),
      if_else: makeNode("if_else", "logic", "If/Else"),
      ai_agent: makeNode("ai_agent", "ai", "AI Agent"),
    },
  });
});

describe("NodePalette", () => {
  it("renders all category headers from the store in order", () => {
    render(<NodePalette />);
    const headers = screen.getAllByRole("button");
    const labels = headers.map((h) => h.textContent ?? "");
    expect(labels[0]).toContain("Trigger");
    expect(labels[1]).toContain("Logic");
    expect(labels[2]).toContain("AI");
  });

  it("applies each category's color as a bullet background", () => {
    render(<NodePalette />);
    const triggerHeader = screen.getByRole("button", { name: /Trigger/ });
    const bullet = triggerHeader.querySelector("span.h-2.w-2");
    expect(bullet).toBeTruthy();
    expect((bullet as HTMLElement).style.backgroundColor).toBe("rgb(245, 158, 11)");
  });

  it("lists nodes under their category", () => {
    render(<NodePalette />);
    expect(screen.getByText("Manual Trigger")).toBeInTheDocument();
    expect(screen.getByText("If/Else")).toBeInTheDocument();
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
  });

  it("collapses a category when its header is clicked", async () => {
    const user = userEvent.setup();
    render(<NodePalette />);
    const aiHeader = screen.getByRole("button", { name: /AI/ });
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    await user.click(aiHeader);
    expect(screen.queryByText("AI Agent")).not.toBeInTheDocument();
  });

  it("hides categories whose filtered node count is zero", async () => {
    const user = userEvent.setup();
    render(<NodePalette />);
    const search = screen.getByPlaceholderText("Search nodes...");
    await user.type(search, "manual");
    expect(screen.queryByRole("button", { name: /Logic/ })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Trigger/ })).toBeInTheDocument();
  });

  it("omits categories not present in the store (no hardcoded list)", () => {
    useNodeDefinitionsStore.setState({
      categories: [
        { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
      ],
    });
    render(<NodePalette />);
    expect(screen.queryByRole("button", { name: /Trigger/ })).not.toBeInTheDocument();
    const logicHeader = screen.getByRole("button", { name: /Logic/ });
    expect(within(logicHeader).getByText("Logic")).toBeInTheDocument();
  });
});
