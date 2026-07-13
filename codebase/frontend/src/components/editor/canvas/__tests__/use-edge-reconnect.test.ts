import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import type { Connection, Edge, FinalConnectionState, HandleType } from "@xyflow/react";
import { useEdgeReconnect } from "../use-edge-reconnect";

const edge: Edge = { id: "e1", source: "a", target: "b" };
const conn: Connection = {
  source: "a",
  sourceHandle: "out",
  target: "c",
  targetHandle: "in",
};
const evt = () => ({}) as MouseEvent;
// 드롭 위치만 관여하므로 connectionState 는 toNode 만 채운 최소 스텁을 쓴다.
const droppedOnNode = { toNode: { id: "c" } } as unknown as FinalConnectionState;
const droppedOnPane = { toNode: null } as unknown as FinalConnectionState;
const handle: HandleType = "target";

describe("useEdgeReconnect (§1.3)", () => {
  it("유효 재연결이면 reconnect 를 호출한다", () => {
    const reconnect = vi.fn();
    const removeEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, removeEdge));

    result.current.onReconnect(edge, conn);

    expect(reconnect).toHaveBeenCalledWith(edge, conn);
  });

  it("빈 캔버스(toNode=null) 드롭이면 엣지를 삭제한다 — detach", () => {
    const reconnect = vi.fn();
    const removeEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, removeEdge));

    result.current.onReconnectEnd(evt(), edge, handle, droppedOnPane);

    expect(removeEdge).toHaveBeenCalledWith("e1");
  });

  it("무효 핸들(노드 위, 예: 자기연결) 드롭이면 삭제하지 않는다 — 원상 유지", () => {
    // CRITICAL 회귀 가드: onReconnect 가 안 불렸어도(자기연결이라 isValidConnection=false)
    // toNode 가 있으면(=핸들/노드 위 드롭) detach 아님 → 엣지 유지.
    const reconnect = vi.fn();
    const removeEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, removeEdge));

    result.current.onReconnectEnd(evt(), edge, handle, droppedOnNode);

    expect(removeEdge).not.toHaveBeenCalled();
  });

  it("유효 재연결 후 end(노드 위)면 삭제하지 않는다", () => {
    const reconnect = vi.fn();
    const removeEdge = vi.fn();
    const { result } = renderHook(() => useEdgeReconnect(reconnect, removeEdge));

    result.current.onReconnect(edge, conn);
    result.current.onReconnectEnd(evt(), edge, handle, droppedOnNode);

    expect(removeEdge).not.toHaveBeenCalled();
  });
});
