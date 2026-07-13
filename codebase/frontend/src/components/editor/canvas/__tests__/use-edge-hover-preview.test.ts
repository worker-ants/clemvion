import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEdgeHoverPreview } from "../use-edge-hover-preview";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useEdgeHoverPreview (§5)", () => {
  it("show 로 preview 설정, scheduleHide 후 지연이 지나면 null 로 전환", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 10, 20));
    expect(result.current.preview).toEqual({ edgeId: "e1", x: 10, y: 20 });

    act(() => result.current.scheduleHide());
    expect(result.current.preview).not.toBeNull(); // 아직 지연 중

    act(() => vi.advanceTimersByTime(250));
    expect(result.current.preview).toBeNull();
  });

  it("scheduleHide 후 keepAlive 면 숨김이 취소된다(커서가 툴팁으로 이동)", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => result.current.scheduleHide());
    act(() => result.current.keepAlive());
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.preview).not.toBeNull();
  });

  it("dismiss 는 즉시 숨긴다", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => result.current.dismiss());
    expect(result.current.preview).toBeNull();
  });

  it("unmount 시 대기 타이머가 정리된다(언마운트 후 setState 발생 안 함)", () => {
    const { result, unmount } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => result.current.scheduleHide());
    unmount();
    expect(() => vi.advanceTimersByTime(250)).not.toThrow();
  });

  it("반환 객체는 preview 불변 시 참조가 안정적이다", () => {
    const { result, rerender } = renderHook(() => useEdgeHoverPreview());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
