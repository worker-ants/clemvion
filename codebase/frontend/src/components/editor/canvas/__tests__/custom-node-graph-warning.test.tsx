import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useEditorStore } from "@/lib/stores/editor-store";
import { useLocaleStore } from "@/lib/stores/locale-store";

// ReactFlow 의 Handle/useStore/useUpdateNodeInternals 는 실제 <ReactFlow>
// 인스턴스를 요구한다 (Provider 만으로는 알 수 없는 node id 에 대해
// updateNodeInternals 가 무한 ref 갱신 루프를 일으킴). 본 테스트의 관심사는
// graph-warning 배지뿐이므로 그 hook/컴포넌트를 가볍게 stub 한다.
vi.mock("@xyflow/react", () => ({
  Handle: () => null,
  Position: { Left: "left", Right: "right" },
  useStore: (selector: (s: { transform: number[]; nodes: unknown[] }) => unknown) =>
    selector({ transform: [0, 0, 1], nodes: [] }),
  useUpdateNodeInternals: () => () => {},
}));

import { CustomNode } from "../custom-node";

// CustomNode 의 cross-node graph-warning 배지 (parallel-p2 결정 D + E + I) —
// store 의 graphWarnings.results 중 자기 노드 id 항목을 severity 별로 렌더한다.
// SoT: spec/conventions/cross-node-warning-rules.md.

const NODE_ID = "node-1";

const nodeProps = {
  id: NODE_ID,
  type: "custom" as const,
  data: { type: "parallel", label: "Parallel", config: {}, category: "logic" },
  selected: false,
  dragging: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  zIndex: 0,
  deletable: true,
  selectable: true,
  draggable: true,
  width: 180,
  height: 80,
} as never;

function renderNode() {
  return render(
    <TooltipProvider>
      {/* @ts-expect-error — test passes the minimal NodeProps shape */}
      <CustomNode {...nodeProps} />
    </TooltipProvider>,
  );
}

function setWarnings(
  results: Array<{
    ruleId: string;
    severity: "error" | "warning";
    nodeId: string;
    message: string;
    params?: Record<string, string | number>;
  }>,
) {
  const hasError = results.some((r) => r.severity === "error");
  const hasWarning = results.some((r) => r.severity === "warning");
  useEditorStore.setState({
    graphWarnings: { results, hasError, hasWarning },
  } as never);
}

describe("CustomNode cross-node graph-warning badge", () => {
  beforeEach(() => {
    cleanup();
    useEditorStore.setState({
      graphWarnings: { results: [], hasError: false, hasWarning: false },
    } as never);
  });

  it("renders the error badge when a result with this node's id has severity error", () => {
    setWarnings([
      {
        ruleId: "parallel:nested-depth-exceeded",
        severity: "error",
        nodeId: NODE_ID,
        message: "depth exceeded",
      },
    ]);
    renderNode();
    const badge = screen.getByTestId("graph-warning-badge");
    expect(badge).toBeInTheDocument();
    expect(badge).toHaveAttribute("data-severity", "error");
    expect(badge).toHaveAttribute("aria-label", "graph error");
  });

  it("renders the warning badge when the only result for this node is a warning", () => {
    setWarnings([
      {
        ruleId: "parallel:nested-concurrency-cap",
        severity: "warning",
        nodeId: NODE_ID,
        message: "concurrency cap",
      },
    ]);
    renderNode();
    const badge = screen.getByTestId("graph-warning-badge");
    expect(badge).toHaveAttribute("data-severity", "warning");
    expect(badge).toHaveAttribute("aria-label", "graph warning");
  });

  it("error takes precedence over warning for the same node", () => {
    setWarnings([
      {
        ruleId: "parallel:nested-concurrency-cap",
        severity: "warning",
        nodeId: NODE_ID,
        message: "concurrency cap",
      },
      {
        ruleId: "parallel:nested-depth-exceeded",
        severity: "error",
        nodeId: NODE_ID,
        message: "depth exceeded",
      },
    ]);
    renderNode();
    expect(screen.getByTestId("graph-warning-badge")).toHaveAttribute(
      "data-severity",
      "error",
    );
  });

  it("renders nothing when no result targets this node", () => {
    setWarnings([
      {
        ruleId: "parallel:nested-depth-exceeded",
        severity: "error",
        nodeId: "other-node",
        message: "depth exceeded",
      },
    ]);
    renderNode();
    expect(screen.queryByTestId("graph-warning-badge")).not.toBeInTheDocument();
  });

  // SUMMARY#3 — translateGraphWarning 경유 렌더 경로: ko/en 로케일 + params 유무 조합.
  // 배지 렌더 여부 + severity 를 검증하고, 메시지 보간은 backend-labels.test.ts 의
  // 직접 단위 테스트가 담당한다 (TooltipContent 는 hover 없이 DOM 에 없음).
  describe("translateGraphWarning render path (i18n Principle 3-C)", () => {
    afterEach(() => {
      useLocaleStore.setState({ locale: "ko" });
    });

    it("ko 로케일 + params: error 배지가 렌더되고 severity=error", () => {
      useLocaleStore.setState({ locale: "ko" });
      setWarnings([
        {
          ruleId: "parallel:nested-depth-exceeded",
          severity: "error",
          nodeId: NODE_ID,
          message: 'Parallel "Outer" has nested "Middle" which has "Inner".',
          params: { node: "Outer", child: "Middle", grand: "Inner" },
        },
      ]);
      renderNode();
      const badge = screen.getByTestId("graph-warning-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-severity", "error");
      expect(badge).toHaveAttribute("aria-label", "graph error");
    });

    it("en 로케일 + params: 영문 fallback — 동일 배지 렌더, severity=error", () => {
      useLocaleStore.setState({ locale: "en" });
      setWarnings([
        {
          ruleId: "parallel:nested-depth-exceeded",
          severity: "error",
          nodeId: NODE_ID,
          message: 'Parallel "Outer" has nested "Middle" which has "Inner".',
          params: { node: "Outer", child: "Middle", grand: "Inner" },
        },
      ]);
      renderNode();
      const badge = screen.getByTestId("graph-warning-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-severity", "error");
    });

    it("params 없음 + unknown ruleId: warning 배지 렌더 (fallback 경로)", () => {
      useLocaleStore.setState({ locale: "ko" });
      setWarnings([
        {
          ruleId: "unknown:rule-id",
          severity: "warning",
          nodeId: NODE_ID,
          message: "unknown rule message",
        },
      ]);
      renderNode();
      const badge = screen.getByTestId("graph-warning-badge");
      expect(badge).toBeInTheDocument();
      expect(badge).toHaveAttribute("data-severity", "warning");
      expect(badge).toHaveAttribute("aria-label", "graph warning");
    });

    it("ko + params 결과와 en + params 결과 모두 배지를 렌더 (로케일 무관 badge 존재)", () => {
      // ko
      useLocaleStore.setState({ locale: "ko" });
      setWarnings([
        {
          ruleId: "parallel:nested-concurrency-cap",
          severity: "warning",
          nodeId: NODE_ID,
          message: "Concurrency cap exceeded.",
          params: { node: "Outer", child: "Inner", outerEffective: 4, innerEffective: 4, product: 16, cap: 12 },
        },
      ]);
      const { unmount } = renderNode();
      expect(screen.getByTestId("graph-warning-badge")).toHaveAttribute("data-severity", "warning");
      unmount();
      cleanup();

      // en
      useLocaleStore.setState({ locale: "en" });
      setWarnings([
        {
          ruleId: "parallel:nested-concurrency-cap",
          severity: "warning",
          nodeId: NODE_ID,
          message: "Concurrency cap exceeded.",
          params: { node: "Outer", child: "Inner", outerEffective: 4, innerEffective: 4, product: 16, cap: 12 },
        },
      ]);
      renderNode();
      expect(screen.getByTestId("graph-warning-badge")).toHaveAttribute("data-severity", "warning");
    });
  });
});
