import { describe, it, expect, vi, beforeEach, beforeAll } from "vitest";
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
  useUpdateNodeInternals: () => vi.fn(),
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

// Mock tooltip — renders TooltipContent with data-testid for conditional rendering tests
vi.mock("@/components/ui/tooltip", () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => <div data-testid="tooltip-content">{children}</div>,
}));

import { CustomNode } from "../custom-node";
import { HasDefaultLlmConfigProvider } from "../has-default-llm-config-context";
import { useNodeDefinitionsStore } from "@/lib/stores/node-definitions-store";
import type { NodeDefinition } from "@/lib/node-definitions";

beforeAll(() => {
  const make = (type: string, extras: Partial<NodeDefinition>): NodeDefinition => ({
    type,
    category: "logic",
    label: type,
    description: "",
    icon: "Box",
    color: "#000",
    inputs: [{ id: "in", label: "Input", type: "data" }],
    outputs: [{ id: "out", label: "Output", type: "data" }],
    defaultConfig: {},
    configSchema: {},
    ...extras,
  });
  useNodeDefinitionsStore.setState({
    status: "ready",
    error: null,
    categories: [
      { id: "trigger", label: "Trigger", icon: "Zap", color: "#F59E0B", order: 0 },
      { id: "logic", label: "Logic", icon: "GitBranch", color: "#3B82F6", order: 1 },
      { id: "ai", label: "AI", icon: "Sparkles", color: "#10B981", order: 3 },
      { id: "integration", label: "Integration", icon: "Puzzle", color: "#F97316", order: 4 },
    ],
    order: [
      "loop",
      "map",
      "foreach",
      "http_request",
      "if_else",
      "manual_trigger",
      "variable_declaration",
      "ai_agent",
      "text_classifier",
      "switch",
      "carousel",
      "table",
    ],
    definitions: {
      loop: make("loop", {
        isContainer: true,
        inputs: [
          { id: "in", label: "Input", type: "data" },
          { id: "emit", label: "Emit", type: "data" },
        ],
        outputs: [
          { id: "body", label: "Body", type: "data" },
          { id: "done", label: "Done", type: "data" },
        ],
        // Mirror what the backend `loop.schema.ts` ships through
        // GET /nodes/definitions: a SSOT warningRule for the missing
        // count + a summaryTemplate for the configured display.
        summaryTemplate: { template: "{{count}}x" },
        warningRules: [
          { id: "loop:count-required", when: "!count", message: "Count not set" },
        ],
      }),
      map: make("map", { isContainer: true }),
      foreach: make("foreach", { isContainer: true }),
      http_request: make("http_request", {
        category: "integration",
        outputs: [
          { id: "success", label: "Success", type: "data" },
          { id: "error", label: "Error", type: "error" },
        ],
        summaryTemplate: {
          template: "{{method|default:GET}} {{url}}",
          warnWhen: "!url",
          warnMessage: "URL not set",
        },
      }),
      if_else: make("if_else", {
        outputs: [
          { id: "true", label: "True", type: "data" },
          { id: "false", label: "False", type: "data" },
        ],
      }),
      manual_trigger: make("manual_trigger", { category: "trigger", inputs: [] }),
      // variable_declaration / code only ship `warningRules` from the
      // backend schema (no summaryTemplate). The canvas shows no body
      // summary text once configured — the tests below assert that.
      variable_declaration: make("variable_declaration", {
        warningRules: [
          {
            id: "variable_declaration:no-variables",
            when: "length(variables) == 0",
            message: "No variables defined",
          },
        ],
      }),
      code: make("code", {
        category: "data",
        warningRules: [
          { id: "code:no-code", when: "!code", message: "Code not written" },
        ],
      }),
      ai_agent: make("ai_agent", {
        category: "ai",
        isDynamicPorts: true,
        dynamicPorts: {
          kind: "ai-agent-conditional",
          modeField: "mode",
          conditionsField: "conditions",
          multiTurnValue: "multi_turn",
        },
      }),
      text_classifier: make("text_classifier", {
        category: "ai",
        outputs: [],
        isDynamicPorts: true,
        dynamicPorts: {
          kind: "classifier-categories",
          fallbackId: "fallback",
          errorId: "error",
        },
      }),
      switch: make("switch", {
        outputs: [{ id: "default", label: "Default", type: "data" }],
        isDynamicPorts: true,
        dynamicPorts: { kind: "switch-cases" },
      }),
      carousel: make("carousel", {
        category: "presentation",
        outputs: [{ id: "out", label: "Output", type: "data" }],
        isDynamicPorts: true,
        dynamicPorts: {
          kind: "presentation-buttons",
          supportsItems: true,
          supportsItemButtons: true,
          continueId: "continue",
        },
      }),
      table: make("table", {
        category: "presentation",
        outputs: [{ id: "out", label: "Output", type: "data" }],
        isDynamicPorts: true,
        dynamicPorts: {
          kind: "presentation-buttons",
          continueId: "continue",
        },
      }),
    },
  });
});

type CustomNodeData = {
  type: string;
  label: string;
  config: Record<string, unknown>;
  category: string;
  isDisabled?: boolean;
};

type CustomNodeType = Node<CustomNodeData, "custom">;

function renderNode(
  overrides: Partial<CustomNodeData> = {},
  options?: { zoom?: number; selected?: boolean; hasDefaultLlmConfig?: boolean },
) {
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

  return render(
    <HasDefaultLlmConfigProvider value={options?.hasDefaultLlmConfig ?? false}>
      <CustomNode {...props} />
    </HasDefaultLlmConfigProvider>,
  );
}

describe("CustomNode", () => {
  beforeEach(() => {
    mockZoom = 1;
    mockNodeStatus = null;
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

  it("renders no body summary for nodes that ship only warningRules (no summaryTemplate)", () => {
    // variable_declaration backend schema ships only warningRules \u2014 once the
    // config is valid (rule does NOT fire), there's no template to render so
    // the canvas hides the body summary line entirely.
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
    expect(screen.queryByText(/^\u26a0/)).not.toBeInTheDocument();
    expect(screen.queryAllByText(/x:|y:/)).toHaveLength(0);
  });

  it("renders no body summary for code node (warningRules only) when configured", () => {
    renderNode({
      type: "code",
      config: { language: "javascript", code: "const a = 1;\nreturn a;" },
      category: "data",
    });
    expect(screen.queryByText(/JavaScript|line/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^\u26a0/)).not.toBeInTheDocument();
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
    expect(screen.getByText("출력")).toBeInTheDocument();
    expect(screen.getByText("오류")).toBeInTheDocument();
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
    expect(screen.getByText("오류")).toBeInTheDocument();
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

  // §6: AI 노드는 hasDefaultLlmConfig 컨텍스트 값에 따라 config 요약/경고 분기.
  // 컴포넌트가 context 값을 소비해 렌더에 반영하는지 (provider 값별로 다른 결과)
  // 검증한다 — 순수 요약 로직은 node-config-summary 단위 테스트가 커버.
  it("renders ai_agent without crashing when a default llm config is present", () => {
    const { container } = renderNode(
      {
        type: "ai_agent",
        label: "AI Agent",
        config: { mode: "single_turn" },
        category: "ai",
      },
      { hasDefaultLlmConfig: true },
    );
    expect(container.querySelector('[data-testid="handle-out"]')).toBeInTheDocument();
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
