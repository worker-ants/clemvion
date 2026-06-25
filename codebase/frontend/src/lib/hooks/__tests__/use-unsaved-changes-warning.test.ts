/**
 * `useUnsavedChangesWarning` 단위 테스트 — ai-review m-3 W2.
 *  - active=false: 리스너 미등록
 *  - active=true: beforeunload 등록 + handler 가 preventDefault + returnValue=""
 *  - active true→false 전환: 리스너 제거
 *  - unmount: 리스너 제거
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { useUnsavedChangesWarning } from "../use-unsaved-changes-warning";

describe("useUnsavedChangesWarning", () => {
  let addSpy: ReturnType<typeof vi.spyOn>;
  let removeSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    addSpy = vi.spyOn(window, "addEventListener");
    removeSpy = vi.spyOn(window, "removeEventListener");
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("active=false 면 beforeunload 리스너를 등록하지 않는다", () => {
    renderHook(() => useUnsavedChangesWarning(false));
    const registered = addSpy.mock.calls.some(([e]) => e === "beforeunload");
    expect(registered).toBe(false);
  });

  it("active=true 면 리스너 등록 + handler 가 preventDefault + returnValue=''", () => {
    renderHook(() => useUnsavedChangesWarning(true));
    const call = addSpy.mock.calls.find(([e]) => e === "beforeunload");
    expect(call).toBeDefined();
    const handler = call![1] as (e: BeforeUnloadEvent) => void;
    const event = {
      preventDefault: vi.fn(),
      returnValue: undefined as unknown as string,
    } as unknown as BeforeUnloadEvent;
    handler(event);
    expect(event.preventDefault).toHaveBeenCalled();
    expect(event.returnValue).toBe("");
  });

  it("active 가 true→false 로 바뀌면 리스너를 제거한다", () => {
    const { rerender } = renderHook(
      ({ active }) => useUnsavedChangesWarning(active),
      { initialProps: { active: true } },
    );
    expect(removeSpy).not.toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
    rerender({ active: false });
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });

  it("unmount 시 리스너를 제거한다", () => {
    const { unmount } = renderHook(() => useUnsavedChangesWarning(true));
    unmount();
    expect(removeSpy).toHaveBeenCalledWith(
      "beforeunload",
      expect.any(Function),
    );
  });
});
