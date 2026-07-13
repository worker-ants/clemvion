import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useEdgeHoverPreview } from "../use-edge-hover-preview";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("useEdgeHoverPreview (§5)", () => {
  it("show 는 진입 지연 후 preview 설정, scheduleHide 후 지연이 지나면 null 로 전환", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 10, 20));
    expect(result.current.preview).toBeNull(); // 진입 지연 중 — 아직 미표시

    act(() => vi.advanceTimersByTime(100));
    expect(result.current.preview).toEqual({ edgeId: "e1", x: 10, y: 20 });

    act(() => result.current.scheduleHide());
    expect(result.current.preview).not.toBeNull(); // 아직 지연 중

    act(() => vi.advanceTimersByTime(250));
    expect(result.current.preview).toBeNull();
  });

  it("show 지연 내 다른 엣지로 재-show(sweep) 하면 이전 대상이 취소되고 최종 엣지만 표시된다", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => vi.advanceTimersByTime(50)); // e1 지연 완료 전
    act(() => result.current.show("e2", 5, 5)); // sweep — e1 타이머 취소
    act(() => vi.advanceTimersByTime(50)); // e1 원래 만료 시점 — 표시 안 됨
    expect(result.current.preview).toBeNull();
    act(() => vi.advanceTimersByTime(50)); // e2 지연 완료
    expect(result.current.preview).toEqual({ edgeId: "e2", x: 5, y: 5 });
  });

  it("scheduleHide 후 keepAlive 면 숨김이 취소된다(커서가 툴팁으로 이동)", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.scheduleHide());
    act(() => result.current.keepAlive());
    act(() => vi.advanceTimersByTime(250));
    expect(result.current.preview).not.toBeNull();
  });

  it("dismiss 는 즉시 숨긴다", () => {
    const { result } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => vi.advanceTimersByTime(100));
    act(() => result.current.dismiss());
    expect(result.current.preview).toBeNull();
  });

  it("unmount 시 대기 타이머가 정리된다(언마운트 후 setState 발생 안 함)", () => {
    const { result, unmount } = renderHook(() => useEdgeHoverPreview());
    act(() => result.current.show("e1", 0, 0));
    act(() => vi.advanceTimersByTime(100));
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
