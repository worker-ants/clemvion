import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

vi.mock("../../canvas/node-icon", () => ({
  NodeIcon: ({ name }: { name: string }) => <span data-testid="node-icon">{name}</span>,
}));

const { addNodeFromPaletteMock } = vi.hoisted(() => ({
  addNodeFromPaletteMock: vi.fn(),
}));
vi.mock("@/lib/stores/palette-canvas-bridge", () => ({
  addNodeFromPalette: addNodeFromPaletteMock,
  registerPaletteCanvasBridge: vi.fn(),
}));

import { NodePalette } from "../node-palette";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import { useLocaleStore } from "@/lib/stores/locale-store";
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
  addNodeFromPaletteMock.mockClear();
  useLocaleStore.setState({ locale: "en" });
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

// PaletteItem 노드도 role=button(§4.2 클릭 추가) 이라, 카테고리 헤더는 testid 로 질의한다.
const categoryHeaders = () => screen.getAllByTestId("palette-category-header");
const categoryHeaderByText = (text: string) =>
  categoryHeaders().find((h) => (h.textContent ?? "").includes(text));

describe("NodePalette", () => {
  it("renders all category headers from the store in order", () => {
    render(<NodePalette />);
    const labels = categoryHeaders().map((h) => h.textContent ?? "");
    expect(labels[0]).toContain("Trigger");
    expect(labels[1]).toContain("Logic");
    expect(labels[2]).toContain("AI");
  });

  it("applies each category's color as a bullet background", () => {
    render(<NodePalette />);
    const triggerHeader = categoryHeaderByText("Trigger")!;
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
    const aiHeader = categoryHeaderByText("AI")!;
    expect(screen.getByText("AI Agent")).toBeInTheDocument();
    await user.click(aiHeader);
    expect(screen.queryByText("AI Agent")).not.toBeInTheDocument();
  });

  it("hides categories whose filtered node count is zero", async () => {
    const user = userEvent.setup();
    render(<NodePalette />);
    const search = screen.getByPlaceholderText("Search nodes...");
    await user.type(search, "manual");
    expect(categoryHeaderByText("Logic")).toBeUndefined();
    expect(categoryHeaderByText("Trigger")).toBeTruthy();
  });

  it("omits categories not present in the store (no hardcoded list)", () => {
    useNodeDefinitionsStore.setState({
      categories: [
        { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
      ],
    });
    render(<NodePalette />);
    expect(categoryHeaderByText("Trigger")).toBeUndefined();
    const logicHeader = categoryHeaderByText("Logic")!;
    expect(within(logicHeader).getByText("Logic")).toBeInTheDocument();
  });

  it("collapses the whole palette to an icon rail and reopens it (§4.2)", async () => {
    const user = userEvent.setup();
    render(<NodePalette />);
    // 접기 → 카테고리 헤더가 사라지고 펼치기 버튼만 남는다.
    await user.click(screen.getByLabelText("Collapse palette"));
    expect(screen.queryAllByTestId("palette-category-header")).toHaveLength(0);
    // 다시 펼치기.
    await user.click(screen.getByLabelText("Expand palette"));
    expect(categoryHeaders().length).toBeGreaterThan(0);
  });

  it("clicking a palette item adds the node via the canvas bridge (§4.2)", async () => {
    const user = userEvent.setup();
    render(<NodePalette />);
    await user.click(screen.getByText("If/Else"));
    expect(addNodeFromPaletteMock).toHaveBeenCalledWith("if_else");
  });
});
