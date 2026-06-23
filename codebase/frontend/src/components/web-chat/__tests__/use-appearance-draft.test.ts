import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useAppearanceDraft, DEFAULT_DRAFT } from "../use-appearance-draft";

beforeEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe("useAppearanceDraft", () => {
  it("서버 appearance 가 있으면 그 값으로 시드한다(localStorage·기본값보다 우선)", () => {
    window.localStorage.setItem(
      "clemvion:web-chat:appearance:t-1",
      JSON.stringify({ headerTitle: "from-local" }),
    );
    const { result } = renderHook(() =>
      useAppearanceDraft("t-1", { headerTitle: "from-server", primaryColor: "#112233" }),
    );
    expect(result.current.draft.headerTitle).toBe("from-server");
    expect(result.current.draft.primaryColor).toBe("#112233");
    expect(result.current.isDirty).toBe(false);
  });

  it("서버 appearance 가 없으면 localStorage → 기본값 순으로 시드한다", () => {
    const { result: noLocal } = renderHook(() => useAppearanceDraft("t-empty", undefined));
    expect(noLocal.current.draft).toEqual(DEFAULT_DRAFT);

    window.localStorage.setItem(
      "clemvion:web-chat:appearance:t-2",
      JSON.stringify({ headerTitle: "cached" }),
    );
    const { result } = renderHook(() => useAppearanceDraft("t-2", undefined));
    expect(result.current.draft.headerTitle).toBe("cached");
  });

  it("오염된 enum/색상 값은 sanitize 된다", () => {
    const { result } = renderHook(() =>
      useAppearanceDraft("t-3", {
        primaryColor: "not-a-color" as string,
        position: "top" as never,
        locale: "fr" as never,
      }),
    );
    expect(result.current.draft.primaryColor).toBe(DEFAULT_DRAFT.primaryColor);
    expect(result.current.draft.position).toBe("bottom-right");
    expect(result.current.draft.locale).toBe("ko");
  });

  it("patch 하면 isDirty=true, markSaved 후 false", () => {
    const { result } = renderHook(() => useAppearanceDraft("t-4", { headerTitle: "A" }));
    expect(result.current.isDirty).toBe(false);

    act(() => result.current.setDraft({ headerTitle: "B" }));
    expect(result.current.draft.headerTitle).toBe("B");
    expect(result.current.isDirty).toBe(true);

    act(() => result.current.markSaved());
    expect(result.current.isDirty).toBe(false);
  });
});
