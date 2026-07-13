import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Connection, Edge } from "@xyflow/react";
import { useEdgeReconnect } from "../use-edge-reconnect";

const edge: Edge = { id: "e1", source: "a", target: "b" };
const conn: Connection = {
  source: "a",
  sourceHandle: "out",
  target: "c",
  targetHandle: "in",
};
const evt = () => ({}) as MouseEvent;

describe("useEdgeReconnect (§1.3)", () => {
  it("유효 재연결이면 reconnect 를 호출하고 삭제하지 않는다", () => {
    const reconnect = vi.fn();
    const deleteEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, deleteEdge));

    result.current.onReconnectStart();
    result.current.onReconnect(edge, conn);
    result.current.onReconnectEnd(evt(), edge);

    expect(reconnect).toHaveBeenCalledWith(edge, conn);
    expect(deleteEdge).not.toHaveBeenCalled();
  });

  it("빈 영역 드롭(재연결 없이 end)이면 엣지를 삭제한다 — detach", () => {
    const reconnect = vi.fn();
    const deleteEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, deleteEdge));

    result.current.onReconnectStart();
    result.current.onReconnectEnd(evt(), edge);

    expect(deleteEdge).toHaveBeenCalledWith("e1");
    expect(reconnect).not.toHaveBeenCalled();
  });

  it("start 없이 end 만 오면 삭제하지 않는다 (기본 성공 상태, 방어적)", () => {
    const reconnect = vi.fn();
    const deleteEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, deleteEdge));

    result.current.onReconnectEnd(evt(), edge);

    expect(deleteEdge).not.toHaveBeenCalled();
  });

  it("직전 제스처의 성공 플래그가 다음 제스처로 이월되지 않는다", () => {
    const reconnect = vi.fn();
    const deleteEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, deleteEdge));

    // 1st: 성공 재연결
    result.current.onReconnectStart();
    result.current.onReconnect(edge, conn);
    result.current.onReconnectEnd(evt(), edge);
    // 2nd: detach (start 후 재연결 없음) — 1st 성공이 이월되면 삭제되지 않는 회귀
    result.current.onReconnectStart();
    result.current.onReconnectEnd(evt(), { id: "e2", source: "x", target: "y" });

    expect(deleteEdge).toHaveBeenCalledTimes(1);
    expect(deleteEdge).toHaveBeenCalledWith("e2");
  });
});
