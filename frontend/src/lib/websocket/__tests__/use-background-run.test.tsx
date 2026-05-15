import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBackgroundRun } from "../use-background-run";
import * as api from "@/lib/api/executions";

// WS client mock — capture subscribe/unsubscribe/event handlers for lifecycle assertions.
const wsClientMock = {
  isConnected: vi.fn(() => true),
  connect: vi.fn(),
  waitForConnect: vi.fn(() => Promise.resolve()),
  on: vi.fn(),
  off: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
};

vi.mock("@/lib/websocket/ws-client", () => ({
  getWsClient: () => wsClientMock,
}));

vi.mock("@/lib/api/client", () => ({
  ensureFreshAccessToken: () => Promise.resolve("tok"),
  getAccessToken: () => "tok",
  apiClient: { get: vi.fn() },
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useBackgroundRun (W-20 — WS lifecycle)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    wsClientMock.isConnected.mockReturnValue(true);
  });

  it("subscribes to `background:run:<id>` channel on mount", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "completed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: "2026-05-15T05:04:50.000Z",
      durationMs: 12877,
      nodeExecutions: { data: [], nextCursor: null, hasMore: false },
      notifications: [],
    });

    renderHook(() => useBackgroundRun("exec-1", "bg-1"), { wrapper });

    await waitFor(() => {
      expect(wsClientMock.subscribe).toHaveBeenCalledWith(
        "background:run:bg-1",
      );
    });
    expect(wsClientMock.on).toHaveBeenCalledWith(
      "execution.background_run.started",
      expect.any(Function),
    );
    expect(wsClientMock.on).toHaveBeenCalledWith(
      "execution.background_run.completed",
      expect.any(Function),
    );
  });

  it("unsubscribes and removes listeners on unmount", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "completed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: null,
      durationMs: null,
      nodeExecutions: { data: [], nextCursor: null, hasMore: false },
      notifications: [],
    });

    const { unmount } = renderHook(
      () => useBackgroundRun("exec-1", "bg-1"),
      { wrapper },
    );

    await waitFor(() => {
      expect(wsClientMock.subscribe).toHaveBeenCalled();
    });

    unmount();
    expect(wsClientMock.unsubscribe).toHaveBeenCalledWith(
      "background:run:bg-1",
    );
    expect(wsClientMock.off).toHaveBeenCalledWith(
      "execution.background_run.started",
      expect.any(Function),
    );
    expect(wsClientMock.off).toHaveBeenCalledWith(
      "execution.background_run.completed",
      expect.any(Function),
    );
  });

  it("does not subscribe when backgroundRunId is null", () => {
    renderHook(() => useBackgroundRun("exec-1", null), { wrapper });
    expect(wsClientMock.subscribe).not.toHaveBeenCalled();
  });

  it("re-subscribes when backgroundRunId changes (channel rotation)", async () => {
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "completed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: null,
      durationMs: null,
      nodeExecutions: { data: [], nextCursor: null, hasMore: false },
      notifications: [],
    });

    const { rerender } = renderHook(
      ({ id }: { id: string }) => useBackgroundRun("exec-1", id),
      { wrapper, initialProps: { id: "bg-1" } },
    );

    await waitFor(() => {
      expect(wsClientMock.subscribe).toHaveBeenCalledWith(
        "background:run:bg-1",
      );
    });

    rerender({ id: "bg-2" });
    await waitFor(() => {
      expect(wsClientMock.unsubscribe).toHaveBeenCalledWith(
        "background:run:bg-1",
      );
      expect(wsClientMock.subscribe).toHaveBeenCalledWith(
        "background:run:bg-2",
      );
    });
  });

  it("calls connect when WS is not yet connected", async () => {
    wsClientMock.isConnected.mockReturnValue(false);
    vi.spyOn(api.backgroundRunsApi, "getById").mockResolvedValue({
      backgroundRunId: "bg-1",
      executionId: "exec-1",
      parentNodeExecutionId: "p-1",
      status: "completed",
      startedAt: "2026-05-15T05:04:37.123Z",
      completedAt: null,
      durationMs: null,
      nodeExecutions: { data: [], nextCursor: null, hasMore: false },
      notifications: [],
    });

    renderHook(() => useBackgroundRun("exec-1", "bg-1"), { wrapper });

    await waitFor(() => {
      expect(wsClientMock.connect).toHaveBeenCalledWith("tok");
      expect(wsClientMock.waitForConnect).toHaveBeenCalled();
    });
  });
});
