import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { NodeProps, Node } from "@xyflow/react";

// Mock @xyflow/react
let mockZoom = 1;
vi.mock("@xyflow/react", () => ({
  Handle: ({ id }: { id: string }) => <div data-testid={`handle-${id}`} />,
  Position: { Left: "left", Right: "right" },
  // The container view conditionally renders <NodeResizer /> when selected.
  // Tests render unselected by default, but we still need an exported stub so
  // the import doesn't crash the module evaluation.
  NodeResizer: () => null,
  useStore: (selector: (s: { transform: number[]; nodes: Array<{ id: string; data: { label?: string } }> }) => unknown) =>
    selector({ transform: [0, 0, mockZoom], nodes: [] }),
}));

// Mock execution store — supports per-test overrides via mockNodeStatus
let mockNodeStatus: { status: string } | null = null;
vi.mock("@/lib/stores/execution-store", () => ({
  useExecutionStore: (selector: (s: { nodeStatuses: Map<string, { status: string }> }) => unknown) => {
    const map = new Map<string, { status: string }>();
    if (mockNodeStatus) map.set("node-1", mockNodeStatus);
    return selector({ nodeStatuses: map });
  },
}));

// Mock node icon
vi.mock("../node-icon", () => ({
  NodeIcon: ({ name }: { name: string }) => <span data-testid="node-icon">{name}</span>,
}));

// Mock react-query — useQuery returns empty data by default; override via mockLlmConfigs
let mockLlmConfigs: Array<{ id: string; isDefault: boolean }> = [];
vi.mock("@tanstack/react-query", () => ({
  useQuery: () => ({ data: mockLlmConfigs }),
}));

// Mock tooltip — renders TooltipContent with data-testid for conditional rendering tests
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

import { CustomNode } from "../custom-node";

type CustomNodeData = {
  type: string;
  label: string;
  config: Record<string, unknown>;
  category: string;
  isDisabled?: boolean;
};

type CustomNodeType = Node<CustomNodeData, "custom">;

function renderNode(overrides: Partial<CustomNodeData> = {}, options?: { zoom?: number; selected?: boolean }) {
  mockZoom = options?.zoom ?? 1;
  const defaultData: CustomNodeData = {
    type: "http_request",
    label: "Fetch User",
    config: { method: "GET", url: "https://api.example.com" },
    category: "integration",
    ...overrides,
  };

  const props = {
    id: "node-1",
    data: defaultData,
    selected: options?.selected ?? false,
    type: "custom",
    isConnectable: true,
    zIndex: 0,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
    dragging: false,
    deletable: true,
    selectable: true,
    parentId: undefined,
    sourcePosition: undefined,
    targetPosition: undefined,
    dragHandle: undefined,
    width: 180,
    height: 80,
  } as NodeProps<CustomNodeType>;

  return render(<CustomNode {...props} />);
}

describe("CustomNode", () => {
  beforeEach(() => {
    mockZoom = 1;
    mockNodeStatus = null;
    mockLlmConfigs = [];
  });

  // --- Summary rendering ---

  it("renders summary text when config is populated", () => {
    renderNode({
      type: "http_request",
      config: { method: "POST", url: "https://api.test.com/data" },
    });
    expect(screen.getByText("POST https://api.test.com/data")).toBeInTheDocument();
  });

  it("hides summary when zoom < 50%", () => {
    renderNode(
      { type: "http_request", config: { method: "GET", url: "https://api.test.com" } },
      { zoom: 0.3 },
    );
    expect(screen.queryByText(/GET https/)).not.toBeInTheDocument();
  });

  it("shows summary when zoom >= 50%", () => {
    renderNode(
      { type: "http_request", config: { method: "GET", url: "https://api.test.com" } },
      { zoom: 0.5 },
    );
    expect(screen.getByText("GET https://api.test.com")).toBeInTheDocument();
  });

  it("shows warning as header icon when config is missing required fields", () => {
    const { container } = renderNode({ type: "http_request", config: {} });
    const header = container.querySelector(".rounded-t-lg");
    const warningIcon = header?.querySelector('[aria-label="warning"]');
    expect(warningIcon).toBeInTheDocument();
    // Inline body warning text should not render as <p>
    const warningMatches = screen.queryAllByText(/^⚠/);
    expect(warningMatches.some((el) => el.tagName === "P")).toBe(false);
    // Tooltip exposes the specific missing field
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent.textContent).toContain("URL not set");
  });

  it("warning icon inherits header text color", () => {
    const { container } = renderNode({ type: "http_request", config: {} });
    const header = container.querySelector(".rounded-t-lg");
    const warningSpan = header?.querySelector('[aria-label="warning"]');
    expect(warningSpan?.getAttribute("class")).toContain("text-white/70");
  });

  it("applies muted color to normal summary", () => {
    renderNode({
      type: "http_request",
      config: { method: "GET", url: "https://test.com" },
    });
    const summary = screen.getByText("GET https://test.com");
    expect(summary.className).toContain("text-[hsl(var(--muted-foreground))]");
  });

  it("does not render summary for manual_trigger", () => {
    renderNode({
      type: "manual_trigger",
      label: "Start",
      config: {},
      category: "trigger",
    });
    expect(screen.queryByText(/^⚠/)).not.toBeInTheDocument();
  });

  // --- Container node summary location ---

  it("renders container node summary in header (not body)", () => {
    const { container } = renderNode({
      type: "loop",
      label: "Process",
      config: { count: "10" },
      category: "logic",
    });
    // The header is the first div child with rounded-t-lg
    const header = container.querySelector(".rounded-t-lg");
    expect(header?.textContent).toContain("10x");
  });

  it("renders container node warning as header icon (not body text)", () => {
    const { container } = renderNode({
      type: "loop",
      label: "Process",
      config: {},
      category: "logic",
    });
    const header = container.querySelector(".rounded-t-lg");
    // Warning icon is inline in the header for aria accessibility
    const warningIcon = header?.querySelector('[aria-label="warning"]');
    expect(warningIcon).toBeInTheDocument();
    // The inline <p> variant (body) should not render for container warnings
    const warningMatches = screen.queryAllByText(/^⚠/);
    expect(warningMatches.some((el) => el.tagName === "P")).toBe(false);
    // Tooltip exposes the full message with specific detail
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent.textContent).toContain("Count not set");
  });

  // --- Tooltip conditional rendering ---

  it("shows tooltip content for truncated text (> 40 chars)", () => {
    const longUrl = "https://api.very-long-domain-name.example.com/extremely/long/path";
    renderNode({
      type: "http_request",
      config: { method: "GET", url: longUrl },
    });
    const tooltipContent = screen.getByTestId("tooltip-content");
    expect(tooltipContent.textContent).toBe(`GET ${longUrl}`);
  });

  it("does not show tooltip content for short text", () => {
    renderNode({
      type: "http_request",
      config: { method: "GET", url: "https://a.io" },
    });
    expect(screen.queryByTestId("tooltip-content")).not.toBeInTheDocument();
  });

  // --- Execution status ---

  it("shows green checkmark for completed status", () => {
    mockNodeStatus = { status: "completed" };
    const { container } = renderNode();
    const checkmark = container.querySelector(".bg-green-500");
    expect(checkmark).toBeInTheDocument();
  });

  it("shows red indicator for failed status", () => {
    mockNodeStatus = { status: "failed" };
    const { container } = renderNode();
    const indicator = container.querySelector(".bg-red-500");
    expect(indicator).toBeInTheDocument();
  });

  it("applies pulse animation for running status", () => {
    mockNodeStatus = { status: "running" };
    const { container } = renderNode();
    const node = container.firstElementChild;
    expect(node?.className).toContain("animate-pulse");
    expect(node?.className).toContain("ring-blue-400");
  });

  it("applies opacity for skipped status", () => {
    mockNodeStatus = { status: "skipped" };
    const { container } = renderNode();
    const node = container.firstElementChild;
    expect(node?.className).toContain("opacity-40");
  });

  // --- Visual states ---

  it("applies opacity-50 when node is disabled", () => {
    const { container } = renderNode({ isDisabled: true });
    const node = container.firstElementChild;
    expect(node?.className).toContain("opacity-50");
  });

  it("applies ring class when node is selected", () => {
    const { container } = renderNode({}, { selected: true });
    const node = container.firstElementChild;
    expect(node?.className).toContain("ring-[hsl(var(--ring))]");
  });

  // --- Node label & other summaries ---

  it("renders node label in header", () => {
    renderNode({ label: "My Node" });
    expect(screen.getByText("My Node")).toBeInTheDocument();
  });

  it("renders variable declaration summary", () => {
    renderNode({
      type: "variable_declaration",
      config: {
        variables: [
          { name: "x", type: "number", defaultValue: "0" },
          { name: "y", type: "string", defaultValue: "" },
        ],
      },
      category: "logic",
    });
    expect(screen.getByText("x: number = 0, y: string")).toBeInTheDocument();
  });

  it("renders code summary", () => {
    renderNode({
      type: "code",
      config: { language: "javascript", code: "const a = 1;\nreturn a;" },
      category: "data",
    });
    expect(screen.getByText("JavaScript \u00b7 2 lines")).toBeInTheDocument();
  });

  // --- AI Agent dynamic ports ---

  it("renders ai_agent with out and error ports when no conditions", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: { mode: "single_turn" },
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-out"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders ai_agent with single_turn fallback when mode is not set", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: {},
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-out"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
  });

  it("renders single_turn ai_agent with condition ports", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: {
        mode: "single_turn",
        conditions: [
          { id: "cond-1", label: "Refund", prompt: "refund" },
          { id: "cond-2", label: "Escalate", prompt: "escalate" },
        ],
      },
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-out"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-cond-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-cond-2"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
    // Port labels should be shown
    expect(screen.getByText("Refund")).toBeInTheDocument();
    expect(screen.getByText("Escalate")).toBeInTheDocument();
  });

  it("renders multi_turn ai_agent with system ports when no conditions", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: { mode: "multi_turn" },
      category: "ai",
    });
    // No conditions: multi_turn shows user_ended + max_turns + error (no out)
    expect(container.querySelector('[data-testid="handle-out"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-user_ended"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-max_turns"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
    expect(screen.getByText("User Ended")).toBeInTheDocument();
    expect(screen.getByText("Max Turns")).toBeInTheDocument();
    expect(screen.getByText("Error")).toBeInTheDocument();
  });

  it("renders multi_turn ai_agent with conditions and system ports", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: {
        mode: "multi_turn",
        conditions: [{ id: "cond-1", label: "Refund", prompt: "refund" }],
      },
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-out"]')).not.toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-cond-1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-user_ended"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-max_turns"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-error"]')).toBeInTheDocument();
    expect(screen.getByText("Refund")).toBeInTheDocument();
  });

  // --- Text Classifier dynamic ports ---

  it("renders text_classifier with only fallback port when no categories", () => {
    const { container } = renderNode({
      type: "text_classifier",
      label: "Text Classifier",
      config: {},
      category: "ai",
    });
    // Single output renders as centered handle without label
    expect(container.querySelector('[data-testid="handle-fallback"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-class_0"]')).not.toBeInTheDocument();
  });

  it("renders text_classifier with category ports and fallback", () => {
    const { container } = renderNode({
      type: "text_classifier",
      label: "Text Classifier",
      config: {
        categories: [
          { name: "Billing", description: "Payment questions" },
          { name: "Technical", description: "Tech support" },
        ],
      },
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-class_0"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-class_1"]')).toBeInTheDocument();
    expect(container.querySelector('[data-testid="handle-fallback"]')).toBeInTheDocument();
    expect(screen.getByText("Billing")).toBeInTheDocument();
    expect(screen.getByText("Technical")).toBeInTheDocument();
    expect(screen.getByText("Fallback")).toBeInTheDocument();
  });

  it("renders text_classifier with fallback label for unnamed categories", () => {
    renderNode({
      type: "text_classifier",
      label: "Text Classifier",
      config: {
        categories: [{ name: "", description: "empty name" }],
      },
      category: "ai",
    });
    expect(screen.getByText("Category 1")).toBeInTheDocument();
  });

  it("filters out conditions with empty id", () => {
    const { container } = renderNode({
      type: "ai_agent",
      label: "AI Agent",
      config: {
        mode: "single_turn",
        conditions: [
          { id: "", label: "Empty", prompt: "test" },
          { id: "cond-1", label: "Valid", prompt: "test" },
        ],
      },
      category: "ai",
    });
    expect(container.querySelector('[data-testid="handle-cond-1"]')).toBeInTheDocument();
    expect(screen.getByText("Valid")).toBeInTheDocument();
  });
});
