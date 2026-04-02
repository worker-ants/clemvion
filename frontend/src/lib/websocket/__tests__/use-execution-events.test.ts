import { describe, it, expect, beforeEach, vi, type Mock } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useExecutionEvents } from "../use-execution-events";
import { useExecutionStore } from "../../stores/execution-store";

// Mock ws-client
const mockClient = {
  connect: vi.fn(),
  disconnect: vi.fn(),
  subscribe: vi.fn(),
  unsubscribe: vi.fn(),
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  isConnected: vi.fn(() => true),
  getSocket: vi.fn(),
  waitForConnect: vi.fn(() => Promise.resolve()),
};

vi.mock("../ws-client", () => ({
  getWsClient: () => mockClient,
  createWsClient: () => mockClient,
}));

// Mock API client
vi.mock("../../api/client", () => ({
  getAccessToken: () => "test-token",
}));

// Mock executions API
const mockGetById = vi.fn();
vi.mock("../../api/executions", () => ({
  executionsApi: {
    getById: (...args: unknown[]) => mockGetById(...args),
  },
}));

function createMockExecution(overrides: Record<string, unknown> = {}) {
  return {
    id: "exec-1",
    workflowId: "wf-1",
    status: "running",
    error: null,
    nodeExecutions: [],
    inputData: {},
    outputData: null,
    startedAt: "2026-04-01T00:00:00Z",
    finishedAt: null,
    durationMs: null,
    ...overrides,
  };
}

describe("useExecutionEvents", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    useExecutionStore.setState({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: null,
      waitingNodeId: null,
      waitingFormConfig: null,
    });
    mockClient.waitForConnect.mockResolvedValue(undefined);
    mockClient.isConnected.mockReturnValue(true);
    mockGetById.mockResolvedValue({
      data: createMockExecution(),
    });
  });

  it("does nothing when executionId is null", () => {
    renderHook(() => useExecutionEvents({ executionId: null }));
    expect(mockClient.connect).not.toHaveBeenCalled();
  });

  it("connects and subscribes when executionId is provided", async () => {
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    expect(mockClient.connect).toHaveBeenCalledWith("test-token");
    await waitFor(() => {
      expect(mockClient.subscribe).toHaveBeenCalledWith("execution:exec-1");
    });
  });

  it("binds all event handlers", () => {
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const boundEvents = (mockClient.on as Mock).mock.calls.map(
      (c: unknown[]) => c[0],
    );
    expect(boundEvents).toContain("execution.started");
    expect(boundEvents).toContain("execution.completed");
    expect(boundEvents).toContain("execution.failed");
    expect(boundEvents).toContain("execution.cancelled");
    expect(boundEvents).toContain("execution.node.started");
    expect(boundEvents).toContain("execution.node.completed");
    expect(boundEvents).toContain("execution.node.failed");
    expect(boundEvents).toContain("execution.node.skipped");
    expect(boundEvents).toContain("execution.waiting_for_input");
  });

  it("handles execution.waiting_for_input WS event", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    // Find the registered handler for waiting_for_input
    const onCalls = (mockClient.on as Mock).mock.calls;
    const waitingHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.waiting_for_input",
    )?.[1] as (data: unknown) => void;

    expect(waitingHandler).toBeDefined();

    // Simulate the event
    waitingHandler({
      waitingNodeId: "form-1",
      waitingNodeType: "form",
      nodeOutput: {
        type: "form",
        formConfig: { fields: [{ name: "name", type: "text", label: "Name" }] },
      },
    });

    const state = useExecutionStore.getState();
    expect(state.status).toBe("waiting_for_input");
    expect(state.waitingNodeId).toBe("form-1");
    expect(state.waitingFormConfig).toEqual({
      fields: [{ name: "name", type: "text", label: "Name" }],
    });
  });

  it("collects presentation node results from node.completed WS event", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    // Find the registered handler for node.completed
    const onCalls = (mockClient.on as Mock).mock.calls;
    const nodeCompletedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.completed",
    )?.[1] as (data: unknown) => void;

    expect(nodeCompletedHandler).toBeDefined();

    // Simulate a table node completing
    nodeCompletedHandler({
      nodeId: "table-1",
      duration: 100,
      output: { type: "table", rows: [{ a: 1 }], columns: ["a"] },
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(1);
    expect(results[0].nodeType).toBe("table");
    expect(results[0].nodeId).toBe("table-1");

    // Non-presentation node should NOT be collected
    nodeCompletedHandler({
      nodeId: "logic-1",
      duration: 50,
      output: { result: true },
    });

    expect(useExecutionStore.getState().nodeResults).toHaveLength(1);
  });

  it("polls execution status after subscribing", async () => {
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      expect(mockGetById).toHaveBeenCalledWith("exec-1");
    });
  });

  it("updates store to completed when poll returns completed execution", async () => {
    mockGetById.mockResolvedValue({
      data: createMockExecution({
        status: "completed",
        finishedAt: "2026-04-01T00:00:02Z",
        durationMs: 2000,
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "node-1",
            status: "completed",
            durationMs: 100,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: "2026-04-01T00:00:00.1Z",
          },
          {
            id: "ne-2",
            executionId: "exec-1",
            nodeId: "node-2",
            status: "completed",
            durationMs: 200,
            error: null,
            startedAt: "2026-04-01T00:00:00.1Z",
            finishedAt: "2026-04-01T00:00:00.3Z",
          },
        ],
      }),
    });

    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      const state = useExecutionStore.getState();
      expect(state.status).toBe("completed");
    });

    const state = useExecutionStore.getState();
    expect(state.nodeStatuses.get("node-1")?.status).toBe("completed");
    expect(state.nodeStatuses.get("node-1")?.duration).toBe(100);
    expect(state.nodeStatuses.get("node-2")?.status).toBe("completed");
  });

  it("updates store to failed when poll returns failed execution", async () => {
    mockGetById.mockResolvedValue({
      data: createMockExecution({
        status: "failed",
        error: { message: "Node C timeout" },
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "node-1",
            status: "completed",
            durationMs: 50,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: "2026-04-01T00:00:00.05Z",
          },
          {
            id: "ne-2",
            executionId: "exec-1",
            nodeId: "node-2",
            status: "failed",
            durationMs: 30000,
            error: { message: "Connection timeout" },
            startedAt: "2026-04-01T00:00:00.05Z",
            finishedAt: "2026-04-01T00:00:30.05Z",
          },
        ],
      }),
    });

    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
    });

    const state = useExecutionStore.getState();
    expect(state.nodeStatuses.get("node-2")?.status).toBe("failed");
    expect(state.nodeStatuses.get("node-2")?.error).toBe("Connection timeout");
  });

  it("handles cancelled execution from poll (maps to failed)", async () => {
    // Note: "cancelled" maps to "failed" in the UI store because the store
    // only has idle/running/completed/failed states.
    mockGetById.mockResolvedValue({
      data: createMockExecution({ status: "cancelled" }),
    });

    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
    });
  });

  it("handles waiting_for_input node status from poll", async () => {
    mockGetById.mockResolvedValue({
      data: createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "node-1",
            status: "completed",
            durationMs: 50,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: "2026-04-01T00:00:00.05Z",
          },
          {
            id: "ne-2",
            executionId: "exec-1",
            nodeId: "form-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00.05Z",
            finishedAt: null,
            outputData: { type: "form", formConfig: { fields: [] } },
          },
        ],
      }),
    });

    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      const state = useExecutionStore.getState();
      expect(state.nodeStatuses.get("form-node")?.status).toBe("waiting_for_input");
    });

    // Execution should be in waiting_for_input state
    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("form-node");
  });

  it("unsubscribes and removes handlers on cleanup without disconnecting", async () => {
    const { unmount } = renderHook(() =>
      useExecutionEvents({ executionId: "exec-1" }),
    );

    await waitFor(() => {
      expect(mockClient.subscribe).toHaveBeenCalled();
    });

    unmount();

    expect(mockClient.unsubscribe).toHaveBeenCalledWith("execution:exec-1");
    // Should NOT disconnect singleton
    expect(mockClient.disconnect).not.toHaveBeenCalled();
    // Should remove all event handlers
    expect(mockClient.off).toHaveBeenCalled();

    // Verify cleanup removes connect handlers (onConnect + onReconnect)
    const offCalls = (mockClient.off as Mock).mock.calls;
    const connectOffCalls = offCalls.filter(
      (c: unknown[]) => c[0] === "connect",
    );
    expect(connectOffCalls.length).toBe(2);
  });

  it("unsubscribes from old channel when executionId changes", async () => {
    const { rerender } = renderHook(
      ({ executionId }) => useExecutionEvents({ executionId }),
      { initialProps: { executionId: "exec-1" as string | null } },
    );

    await waitFor(() => {
      expect(mockClient.subscribe).toHaveBeenCalledWith("execution:exec-1");
    });

    rerender({ executionId: "exec-2" });

    expect(mockClient.unsubscribe).toHaveBeenCalledWith("execution:exec-1");
    await waitFor(() => {
      expect(mockClient.subscribe).toHaveBeenCalledWith("execution:exec-2");
    });
  });

  it("handles poll failure gracefully", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetById.mockRejectedValue(new Error("Network error"));

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    await waitFor(() => {
      expect(consoleSpy).toHaveBeenCalledWith(
        "[execution-events] Poll failed:",
        expect.any(Error),
      );
    });

    consoleSpy.mockRestore();
  });

  describe("WebSocket event handlers update store correctly", () => {
    function getEventHandler(eventName: string): (...args: unknown[]) => void {
      const onCalls = (mockClient.on as Mock).mock.calls;
      const match = onCalls.find((c: unknown[]) => c[0] === eventName);
      return match?.[1] as (...args: unknown[]) => void;
    }

    it("execution.started updates store", () => {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.started");
      expect(handler).toBeDefined();
      handler({ executionId: "exec-1" });

      expect(useExecutionStore.getState().executionId).toBe("exec-1");
      expect(useExecutionStore.getState().status).toBe("running");
    });

    it("execution.completed updates store", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.completed");
      handler();

      expect(useExecutionStore.getState().status).toBe("completed");
    });

    it("execution.failed updates store with error", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.failed");
      handler({ error: "Something broke" });

      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
      expect(state.nodeStatuses.get("__execution__")?.error).toBe(
        "Something broke",
      );
    });

    it("execution.cancelled updates store", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.cancelled");
      handler();

      expect(useExecutionStore.getState().status).toBe("failed");
    });

    it("execution.node.started updates node status", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.started");
      handler({ nodeId: "node-1" });

      expect(
        useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
      ).toBe("running");
    });

    it("execution.node.completed updates node status with duration", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.completed");
      handler({ nodeId: "node-1", duration: 250 });

      const nodeStatus = useExecutionStore
        .getState()
        .nodeStatuses.get("node-1");
      expect(nodeStatus?.status).toBe("completed");
      expect(nodeStatus?.duration).toBe(250);
    });

    it("execution.node.failed updates node status with error", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.failed");
      handler({ nodeId: "node-1", error: "Timeout" });

      const nodeStatus = useExecutionStore
        .getState()
        .nodeStatuses.get("node-1");
      expect(nodeStatus?.status).toBe("failed");
      expect(nodeStatus?.error).toBe("Timeout");
    });

    it("execution.node.skipped updates node status", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.skipped");
      handler({ nodeId: "node-1" });

      expect(
        useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
      ).toBe("skipped");
    });
  });
});
