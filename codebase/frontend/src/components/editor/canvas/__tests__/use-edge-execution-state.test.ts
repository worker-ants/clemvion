import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { Node, Edge } from "@xyflow/react";
import { useEdgeExecutionState } from "../use-edge-execution-state";
import {
  useExecutionStore,
  type NodeExecutionStatus,
} from "@/lib/stores/execution-store";

const node = (id: string, over?: Record<string, unknown>): Node => ({
  id,
  position: { x: 0, y: 0 },
  data: { type: "action", ...over },
});
const edge = (id: string, source: string, target: string): Edge => ({
  id,
  source,
  target,
});
const statuses = (
  entries: Record<string, NodeExecutionStatus>,
): Map<string, { status: NodeExecutionStatus }> =>
  new Map(Object.entries(entries).map(([id, status]) => [id, { status }]));

beforeEach(() => {
  useExecutionStore.setState({ status: "idle", nodeStatuses: new Map() });
});

describe("useEdgeExecutionState (§3.2)", () => {
  it("실행/비활성 상태가 없으면 원본 edges 참조를 그대로 반환한다(early bail-out)", () => {
    const edges = [edge("e1", "a", "b")];
    const nodes = [node("a"), node("b")];
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    expect(result.current).toBe(edges);
  });

  it("비활성 노드에 연결된 엣지는 data.edgeInactive=true", () => {
    const edges = [edge("e1", "a", "b")];
    const nodes = [node("a", { isDisabled: true }), node("b")];
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    expect(
      (result.current[0].data as { edgeInactive?: boolean }).edgeInactive,
    ).toBe(true);
  });

  it("실행 중 source completed + target running → className 'edge-flowing'", () => {
    useExecutionStore.setState({
      status: "running",
      nodeStatuses: statuses({ a: "completed", b: "running" }),
    });
    const edges = [edge("e1", "a", "b")];
    const nodes = [node("a"), node("b")];
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    expect(result.current[0].className).toBe("edge-flowing");
  });

  it("source·target 둘 다 completed → className 'edge-completed'", () => {
    useExecutionStore.setState({
      status: "completed",
      nodeStatuses: statuses({ a: "completed", b: "completed" }),
    });
    const edges = [edge("e1", "a", "b")];
    const nodes = [node("a"), node("b")];
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    expect(result.current[0].className).toBe("edge-completed");
  });

  it("상태 없는 엣지는 다른 엣지에 상태가 있어도 원본 객체 참조를 유지한다(per-edge bail-out)", () => {
    // 비활성 노드가 있어 early-return 은 스킵되지만, 무상태 'base' 엣지는 재계산돼도 참조 유지.
    const baseEdge = edge("base", "x", "y");
    const edges = [baseEdge, edge("dis", "a", "b")];
    const nodes = [
      node("a", { isDisabled: true }),
      node("b"),
      node("x"),
      node("y"),
    ];
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    expect(result.current.find((e) => e.id === "base")).toBe(baseEdge);
    // 비활성 엣지는 새 객체(플래그 부여)
    expect(
      (
        result.current.find((e) => e.id === "dis")?.data as {
          edgeInactive?: boolean;
        }
      ).edgeInactive,
    ).toBe(true);
  });

  it("실행 상태가 tick 으로 바뀌어도 무관한 엣지는 재렌더 간 참조를 유지한다", () => {
    // 훅의 존재 이유(재렌더 간 bail-out)를 실제 store 업데이트+rerender 로 재현.
    const baseEdge = edge("base", "x", "y");
    const activeEdge = edge("act", "a", "b");
    const edges = [baseEdge, activeEdge];
    const nodes = [node("a"), node("b"), node("x"), node("y")];
    const { result, rerender } = renderHook(() =>
      useEdgeExecutionState(edges, nodes),
    );
    expect(result.current).toBe(edges); // 초기: 상태 없음 → 원본 배열

    act(() => {
      useExecutionStore.setState({
        status: "running",
        nodeStatuses: statuses({ a: "completed", b: "running" }),
      });
    });
    rerender();

    // 무관한 'base' 엣지는 원본 객체 참조 유지(memo 보존), 활성 'act' 만 새 객체.
    expect(result.current.find((e) => e.id === "base")).toBe(baseEdge);
    expect(result.current.find((e) => e.id === "act")?.className).toBe(
      "edge-flowing",
    );
  });

  it("executing=true 인데 nodeStatuses 가 빈 Map 인 과도 상태도 안전(원본 참조)", () => {
    const edges = [edge("e1", "a", "b")];
    const nodes = [node("a"), node("b")];
    act(() => {
      useExecutionStore.setState({ status: "running", nodeStatuses: new Map() });
    });
    const { result } = renderHook(() => useEdgeExecutionState(edges, nodes));
    // 판정 결과 무상태 → per-edge bail-out → 원본 엣지/배열 참조 유지.
    expect(result.current).toBe(edges);
  });
});
