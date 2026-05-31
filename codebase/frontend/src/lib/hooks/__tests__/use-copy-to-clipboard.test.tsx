import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
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

// 테스트가 `navigator.clipboard` 를 전역 변조하므로, 원래 descriptor 를 보관해
// afterEach 에서 복구한다 — 다른 파일/케이스로의 누수 방지.
const ORIGINAL_CLIPBOARD = Object.getOwnPropertyDescriptor(
  navigator,
  "clipboard",
);

function setClipboard(value: unknown): void {
  Object.defineProperty(navigator, "clipboard", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  setClipboard({ writeText });
});

afterEach(() => {
  if (ORIGINAL_CLIPBOARD) {
    Object.defineProperty(navigator, "clipboard", ORIGINAL_CLIPBOARD);
  } else {
    // jsdom 기본 환경에 clipboard 가 없던 경우 — 추가한 속성을 제거.
    Reflect.deleteProperty(navigator as object, "clipboard");
  }
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

  it("shows the error toast and resolves false when navigator.clipboard is absent", async () => {
    setClipboard(undefined);
    const { result } = renderHook(() => useCopyToClipboard());

    const ok = await result.current("hello", {
      success: "Copied",
      error: "Failed",
    });

    expect(toastError).toHaveBeenCalledWith("Failed");
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(ok).toBe(false);
  });
});
