import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const mockReplace = vi.fn();
let currentSearchParams = new URLSearchParams();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, push: vi.fn() }),
  usePathname: () => "/workflows",
  useSearchParams: () => currentSearchParams,
}));

import { usePageParam } from "../use-page-param";

describe("usePageParam", () => {
  beforeEach(() => {
    mockReplace.mockClear();
    currentSearchParams = new URLSearchParams();
  });

  it("defaults to page 1 when ?page is absent", () => {
    const { result } = renderHook(() => usePageParam());
    expect(result.current.page).toBe(1);
  });

  it("parses page from URL", () => {
    currentSearchParams = new URLSearchParams("page=4");
    const { result } = renderHook(() => usePageParam());
    expect(result.current.page).toBe(4);
  });

  it("clamps invalid page values to 1", () => {
    currentSearchParams = new URLSearchParams("page=abc");
    const { result } = renderHook(() => usePageParam());
    expect(result.current.page).toBe(1);
  });

  it("clamps negative page values to 1", () => {
    currentSearchParams = new URLSearchParams("page=-5");
    const { result } = renderHook(() => usePageParam());
    expect(result.current.page).toBe(1);
  });

  it("setPage(2) writes ?page=2 via router.replace and preserves other params", () => {
    currentSearchParams = new URLSearchParams("q=hello&filter=active");
    const { result } = renderHook(() => usePageParam());
    act(() => result.current.setPage(2));
    expect(mockReplace).toHaveBeenCalledTimes(1);
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).toContain("page=2");
    expect(url).toContain("q=hello");
    expect(url).toContain("filter=active");
  });

  it("setPage(1) removes ?page from URL (page=1 is the default)", () => {
    currentSearchParams = new URLSearchParams("page=3&q=hello");
    const { result } = renderHook(() => usePageParam());
    act(() => result.current.setPage(1));
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url).not.toContain("page=");
    expect(url).toContain("q=hello");
  });

  it("setPage uses pathname from usePathname()", () => {
    const { result } = renderHook(() => usePageParam());
    act(() => result.current.setPage(2));
    const url = mockReplace.mock.calls[0][0] as string;
    expect(url.startsWith("/workflows")).toBe(true);
  });
});
