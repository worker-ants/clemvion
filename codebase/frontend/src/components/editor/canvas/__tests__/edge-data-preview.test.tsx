import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import type { Edge } from "@xyflow/react";
import { EdgeDataPreviewTooltip, EdgeDataModal } from "../edge-data-preview";
import { useExecutionStore } from "@/lib/stores/execution-store";

const edges: Edge[] = [{ id: "e1", source: "a", target: "b" }];

const seedResult = (
  nodeId: string,
  output: unknown,
  status: "completed" | "running" | "failed" = "completed",
) => {
  useExecutionStore.setState({
    nodeResults: [
      {
        nodeId,
        nodeLabel: nodeId,
        nodeType: "action",
        nodeCategory: "logic",
        status,
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

  it("실행 상태가 completed 가 아니어도(running) 출력이 있으면 미리보기를 렌더한다", () => {
    seedResult("a", { partial: true }, "running");
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
    expect(screen.getByRole("tooltip").textContent).toContain('"partial": true');
  });

  it("실행 상태가 failed 여도 출력이 있으면 미리보기를 렌더한다(status 무관)", () => {
    seedResult("a", { errorContext: "boom" }, "failed");
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
    expect(screen.getByRole("tooltip").textContent).toContain(
      '"errorContext": "boom"',
    );
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

  // onMouseEnter/onMouseLeave 는 시그니처가 동일(`() => void`)해 서로 바꿔 배선해도 tsc 가
  // 통과한다 — 동작 테스트만 오배선을 잡는다(툴팁 위 hover=keepAlive, 이탈=dismiss).
  it("툴팁 hover 진입은 onKeepAlive, 이탈은 onDismiss 로 배선된다", () => {
    seedResult("a", { x: 1 });
    const onKeepAlive = vi.fn();
    const onDismiss = vi.fn();
    render(
      <EdgeDataPreviewTooltip
        edgeId="e1"
        x={0}
        y={0}
        edges={edges}
        onKeepAlive={onKeepAlive}
        onDismiss={onDismiss}
        onOpenModal={noop}
      />,
    );
    const tip = screen.getByRole("tooltip");
    fireEvent.mouseEnter(tip);
    expect(onKeepAlive).toHaveBeenCalledTimes(1);
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.mouseLeave(tip);
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});

describe("EdgeDataModal (§5)", () => {
  it("edgeId 가 null 이면 Dialog 를 렌더하지 않는다", () => {
    render(<EdgeDataModal edgeId={null} edges={edges} onClose={noop} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("source 출력이 null 이면 리터럴 'null' 이 아닌 '데이터 없음' 문구를 보여준다", () => {
    seedResult("a", null); // output: null — 직전 라운드 `data == null` 수정 회귀 가드
    render(<EdgeDataModal edgeId="e1" edges={edges} onClose={noop} />);
    const dialog = screen.getByRole("dialog");
    expect(dialog.textContent).toContain("표시할 데이터가 없어요.");
    // JsonContent(`<pre>`)로 리터럴 "null" 이 렌더되지 않아야 한다.
    expect(dialog.querySelector("pre")).toBeNull();
  });

  it("정상 데이터는 JsonContent 로 축약 없이 전체를 렌더한다", () => {
    seedResult("a", { hello: "world", items: [1, 2, 3] });
    render(<EdgeDataModal edgeId="e1" edges={edges} onClose={noop} />);
    const pre = screen.getByRole("dialog").querySelector("pre");
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('"hello": "world"');
    // 축약 없이 전개 — 축약 마커(`[3 items]`) 부재 + 배열 원소 전부 존재를 명시적으로 단언.
    expect(pre?.textContent).not.toContain("[3 items]");
    expect(pre?.textContent).toContain("1");
    expect(pre?.textContent).toContain("2");
    expect(pre?.textContent).toContain("3");
  });

  it("닫기(X) 클릭 시 onClose 를 호출한다", () => {
    seedResult("a", { x: 1 });
    const onClose = vi.fn();
    render(<EdgeDataModal edgeId="e1" edges={edges} onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
