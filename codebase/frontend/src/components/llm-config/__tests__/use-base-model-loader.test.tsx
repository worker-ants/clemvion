import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { useBaseModelLoader } from "../use-base-model-loader";
import type { ModelInfo } from "@/lib/api/llm-configs";

function wrapper({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const MODEL: ModelInfo = { id: "m1", name: "m1", type: "chat" };

describe("useBaseModelLoader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("fetches models and marks hasAttemptedLoad on load()", async () => {
    const fetchModels = vi.fn().mockResolvedValue([MODEL]);
    const { result } = renderHook(
      () =>
        useBaseModelLoader<string>({
          resetKey: "a",
          canLoad: true,
          fallbackErrorMessage: "fallback",
          captureSnapshot: () => "a",
          isSnapshotCurrent: () => true,
          fetchModels,
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => {
      expect(result.current.models).toHaveLength(1);
      expect(result.current.hasAttemptedLoad).toBe(true);
    });
  });

  it("resets models / error / hasAttemptedLoad when resetKey changes", async () => {
    const fetchModels = vi.fn().mockResolvedValue([MODEL]);
    const { result, rerender } = renderHook(
      ({ key }: { key: string }) =>
        useBaseModelLoader<string>({
          resetKey: key,
          canLoad: true,
          fallbackErrorMessage: "fallback",
          captureSnapshot: () => key,
          isSnapshotCurrent: () => true,
          fetchModels,
        }),
      { wrapper, initialProps: { key: "a" } },
    );

    act(() => result.current.load());
    await waitFor(() => expect(result.current.models).toHaveLength(1));

    rerender({ key: "b" });
    await waitFor(() => {
      expect(result.current.models).toHaveLength(0);
      expect(result.current.hasAttemptedLoad).toBe(false);
    });
  });

  it("discards a stale success (snapshot no longer current)", async () => {
    let current = "a";
    let resolve!: (v: ModelInfo[]) => void;
    const pending = new Promise<ModelInfo[]>((r) => { resolve = r; });
    const fetchModels = vi.fn().mockReturnValue(pending);
    const { result } = renderHook(
      () =>
        useBaseModelLoader<string>({
          resetKey: "static",
          canLoad: true,
          fallbackErrorMessage: "fallback",
          captureSnapshot: () => current,
          isSnapshotCurrent: (s) => s === current,
          fetchModels,
        }),
      { wrapper },
    );

    // load() captures snapshot "a"; scope then changes to "b" while in-flight.
    act(() => result.current.load());
    await waitFor(() => expect(fetchModels).toHaveBeenCalled());
    current = "b";
    act(() => resolve([MODEL]));

    // snapshot "a" !== current "b" → discarded
    await waitFor(() => expect(result.current.hasAttemptedLoad).toBe(true));
    expect(result.current.models).toHaveLength(0);
  });

  it("discards a stale error (onError snapshot guard)", async () => {
    let current = "a";
    let reject!: (e: unknown) => void;
    const pending = new Promise<ModelInfo[]>((_res, rej) => { reject = rej; });
    const fetchModels = vi.fn().mockReturnValue(pending);
    const { result } = renderHook(
      () =>
        useBaseModelLoader<string>({
          resetKey: "static",
          canLoad: true,
          fallbackErrorMessage: "fallback",
          captureSnapshot: () => current,
          isSnapshotCurrent: (s) => s === current,
          fetchModels,
        }),
      { wrapper },
    );

    act(() => result.current.load());
    await waitFor(() => expect(fetchModels).toHaveBeenCalled());
    current = "b";
    act(() =>
      reject(
        Object.assign(new Error("boom"), {
          isAxiosError: true,
          response: { data: { error: { code: "LLM_MODEL_LIST_FAILED" } } },
        }),
      ),
    );

    // stale failure for scope "a" must not set the error on current scope "b"
    await waitFor(() => expect(result.current.hasAttemptedLoad).toBe(true));
    expect(result.current.errorMessage).toBeNull();
  });

  it("passes canLoad through unchanged", () => {
    const { result } = renderHook(
      () =>
        useBaseModelLoader<string>({
          resetKey: "a",
          canLoad: false,
          fallbackErrorMessage: "fallback",
          captureSnapshot: () => "a",
          isSnapshotCurrent: () => true,
          fetchModels: vi.fn(),
        }),
      { wrapper },
    );
    expect(result.current.canLoad).toBe(false);
  });
});
