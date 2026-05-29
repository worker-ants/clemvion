import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => toastSuccess(...args),
    error: (...args: unknown[]) => toastError(...args),
  },
}));

import { useCopyToClipboard } from "../use-copy-to-clipboard";

const writeText = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(navigator, {
    clipboard: { writeText },
  });
});

describe("useCopyToClipboard", () => {
  it("writes the text and shows the success toast, resolving true", async () => {
    writeText.mockResolvedValueOnce(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    const ok = await result.current("hello", {
      success: "Copied",
      error: "Failed",
    });

    expect(writeText).toHaveBeenCalledWith("hello");
    expect(toastSuccess).toHaveBeenCalledWith("Copied");
    expect(toastError).not.toHaveBeenCalled();
    expect(ok).toBe(true);
  });

  it("shows the error toast and resolves false when the write rejects", async () => {
    writeText.mockRejectedValueOnce(new Error("denied"));
    const { result } = renderHook(() => useCopyToClipboard());

    const ok = await result.current("hello", {
      success: "Copied",
      error: "Failed",
    });

    expect(toastError).toHaveBeenCalledWith("Failed");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });

  it("returns a stable function reference across re-renders", () => {
    const { result, rerender } = renderHook(() => useCopyToClipboard());
    const first = result.current;
    rerender();
    expect(result.current).toBe(first);
  });
});
