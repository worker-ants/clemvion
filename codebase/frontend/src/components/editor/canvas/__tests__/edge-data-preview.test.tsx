import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Edge } from "@xyflow/react";
import { EdgeDataPreviewTooltip } from "../edge-data-preview";
import { useExecutionStore } from "@/lib/stores/execution-store";

const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

const seedResult = (nodeId: string, output: unknown) => {
  useExecutionStore.setState({
    nodeResults: [
      {
        nodeId,
        nodeLabel: nodeId,
        nodeType: "action",
        nodeCategory: "logic",
        status: "completed",
        outputData: { config: null, output },
      },
    ],
    lastIndexByNodeId: new Map([[nodeId, 0]]),
  });
};

beforeEach(() => {
  useExecutionStore.setState({ nodeResults: [], lastIndexByNodeId: new Map() });
});
afterEach(() => cleanup());

const noop = () => {};

describe("EdgeDataPreviewTooltip (§4/§5)", () => {
  it("source 노드 실행 결과가 없으면 아무것도 렌더하지 않는다", () => {
    render(
      <EdgeDataPreviewTooltip
        edgeId="e1"
        x={0}
        y={0}
        edges={edges}
        onKeepAlive={noop}
        onDismiss={noop}
        onOpenModal={noop}
      />,
    );
    expect(screen.queryByRole("tooltip")).toBeNull();
  });

  it("실행 데이터가 있으면 축약 미리보기 툴팁을 렌더한다", () => {
    seedResult("a", { userId: 123, items: [1, 2, 3] });
    render(
      <EdgeDataPreviewTooltip
        edgeId="e1"
        x={0}
        y={0}
        edges={edges}
        onKeepAlive={noop}
        onDismiss={noop}
        onOpenModal={noop}
      />,
    );
    const tip = screen.getByRole("tooltip");
    expect(tip.textContent).toContain('"userId": 123');
    expect(tip.textContent).toContain('"items": "[3 items]"'); // 축약
  });

  it("'전체 데이터 보기' 클릭 시 onOpenModal 을 edgeId 로 호출한다", () => {
    seedResult("a", { x: 1 });
    const onOpenModal = vi.fn();
    render(
      <EdgeDataPreviewTooltip
        edgeId="e1"
        x={0}
        y={0}
        edges={edges}
        onKeepAlive={noop}
        onDismiss={noop}
        onOpenModal={onOpenModal}
      />,
    );
    fireEvent.click(screen.getByRole("button"));
    expect(onOpenModal).toHaveBeenCalledWith("e1");
  });
});
