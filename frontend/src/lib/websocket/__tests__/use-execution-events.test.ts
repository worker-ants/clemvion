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
  once: vi.fn(),
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

// Mock node-definitions
vi.mock("../../node-definitions", () => ({
  getNodeDefinition: (type: string) => {
    const defs: Record<string, { category: string }> = {
      table: { category: "presentation" },
      chart: { category: "presentation" },
      form: { category: "presentation" },
      if_else: { category: "logic" },
      http_request: { category: "integration" },
      manual_trigger: { category: "trigger" },
    };
    return defs[type] ?? { category: "unknown" };
  },
}));

vi.mock("../../api/executions", () => ({}));

/**
 * Pulls the handler the hook registered for `eventName` out of the mock
 * client's `.on` call list. Tests use this to fire simulated WS events.
 */
function getHandler(eventName: string): (data: unknown) => void {
  const onCalls = (mockClient.on as Mock).mock.calls;
  const match = onCalls.find((c: unknown[]) => c[0] === eventName);
  return match?.[1] as (data: unknown) => void;
}

/** Fire the `execution.snapshot` WS event with a full execution payload. */
function emitSnapshot(execution: Record<string, unknown>): void {
  const handler = getHandler("execution.snapshot");
  handler({ executionId: execution.id, execution });
}

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
      selectedResultNodeId: null,
    });
    mockClient.waitForConnect.mockResolvedValue(undefined);
    mockClient.isConnected.mockReturnValue(true);
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
    expect(boundEvents).toContain("execution.resumed");
    expect(boundEvents).toContain("execution.snapshot");
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

    // Verify nodeResults is updated with waiting_for_input status
    const results = useExecutionStore.getState().nodeResults;
    const formResult = results.find((r) => r.nodeId === "form-1");
    expect(formResult).toBeDefined();
    expect(formResult?.status).toBe("waiting_for_input");
    expect(formResult?.nodeType).toBe("form");

    // Verify nodeStatuses is updated
    expect(state.nodeStatuses.get("form-1")?.status).toBe("waiting_for_input");
  });

  it("does not overwrite completed status with running (event order reversal)", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const nodeCompletedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.completed",
    )?.[1] as (data: unknown) => void;
    const nodeStartedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.started",
    )?.[1] as (data: unknown) => void;

    // Completed arrives first (out of order)
    nodeCompletedHandler({
      nodeId: "node-1",
      duration: 100,
      nodeType: "http_request",
      nodeLabel: "Fetch",
      output: { status: 200 },
    });

    expect(useExecutionStore.getState().nodeStatuses.get("node-1")?.status).toBe("completed");

    // Started arrives late — should NOT overwrite completed
    nodeStartedHandler({
      nodeId: "node-1",
      nodeType: "http_request",
      nodeLabel: "Fetch",
    });

    expect(useExecutionStore.getState().nodeStatuses.get("node-1")?.status).toBe("completed");
  });

  it("adds ALL node results from node.completed WS event (not just presentation)", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const nodeCompletedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.completed",
    )?.[1] as (data: unknown) => void;

    expect(nodeCompletedHandler).toBeDefined();

    // Presentation node
    nodeCompletedHandler({
      nodeId: "table-1",
      duration: 100,
      nodeType: "table",
      nodeLabel: "My Table",
      output: { type: "table", rows: [{ a: 1 }], columns: ["a"] },
    });

    // Non-presentation node (logic)
    nodeCompletedHandler({
      nodeId: "logic-1",
      duration: 50,
      nodeType: "if_else",
      nodeLabel: "Branch",
      output: { port: "true", data: {} },
    });

    // Integration node
    nodeCompletedHandler({
      nodeId: "http-1",
      duration: 200,
      nodeType: "http_request",
      nodeLabel: "Fetch Users",
      output: { statusCode: 200, body: {} },
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(3);
    expect(results[0].nodeType).toBe("table");
    expect(results[0].nodeCategory).toBe("presentation");
    expect(results[1].nodeType).toBe("if_else");
    expect(results[1].nodeCategory).toBe("logic");
    expect(results[2].nodeType).toBe("http_request");
    expect(results[2].nodeCategory).toBe("integration");
  });

  it("adds node results from node.started WS event", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const nodeStartedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.started",
    )?.[1] as (data: unknown) => void;

    nodeStartedHandler({
      nodeId: "node-1",
      nodeType: "http_request",
      nodeLabel: "Fetch API",
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("running");
    expect(results[0].nodeType).toBe("http_request");
  });

  it("adds node results from node.failed WS event", async () => {
    useExecutionStore.getState().startExecution("exec-1");

    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const nodeFailedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.failed",
    )?.[1] as (data: unknown) => void;

    nodeFailedHandler({
      nodeId: "node-1",
      error: "Timeout",
      nodeType: "http_request",
      nodeLabel: "Fetch API",
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(1);
    expect(results[0].status).toBe("failed");
    expect(results[0].error).toBe("Timeout");
  });

  it("binds the execution.snapshot handler", () => {
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
    expect(getHandler("execution.snapshot")).toBeDefined();
  });

  it("updates store to completed when snapshot reports a completed execution", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
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
            inputData: { url: "https://example.com" },
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: "2026-04-01T00:00:00.1Z",
            node: { id: "node-1", type: "http_request", label: "Fetch" },
          },
          {
            id: "ne-2",
            executionId: "exec-1",
            nodeId: "node-2",
            status: "completed",
            durationMs: 200,
            error: null,
            inputData: { rows: [] },
            startedAt: "2026-04-01T00:00:00.1Z",
            finishedAt: "2026-04-01T00:00:00.3Z",
            node: { id: "node-2", type: "table", label: "Results" },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.status).toBe("completed");
    expect(state.nodeStatuses.get("node-1")?.status).toBe("completed");
    expect(state.nodeStatuses.get("node-1")?.duration).toBe(100);
    expect(state.nodeStatuses.get("node-2")?.status).toBe("completed");

    expect(state.nodeResults).toHaveLength(2);
    expect(state.nodeResults[0].nodeType).toBe("http_request");
    expect(state.nodeResults[0].inputData).toEqual({ url: "https://example.com" });
    expect(state.nodeResults[1].nodeType).toBe("table");
    expect(state.nodeResults[1].inputData).toEqual({ rows: [] });
  });

  it("updates store to failed when snapshot reports a failed execution", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "failed",
        error: { message: "Node C timeout" },
        nodeExecutions: [
          {
            id: "ne-2",
            executionId: "exec-1",
            nodeId: "node-2",
            status: "failed",
            durationMs: 30000,
            error: { message: "Connection timeout" },
            startedAt: "2026-04-01T00:00:00.05Z",
            finishedAt: "2026-04-01T00:00:30.05Z",
            node: { id: "node-2", type: "http_request", label: "Fetch" },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.status).toBe("failed");
    expect(state.nodeStatuses.get("node-2")?.status).toBe("failed");
    expect(state.nodeStatuses.get("node-2")?.error).toBe("Connection timeout");
  });

  it("maps a cancelled snapshot to failed", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(createMockExecution({ status: "cancelled" }));

    expect(useExecutionStore.getState().status).toBe("failed");
  });

  it("reconstructs waiting_for_input state from snapshot", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
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
            node: { id: "form-node", type: "form", label: "Approval" },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.nodeStatuses.get("form-node")?.status).toBe("waiting_for_input");
    expect(state.status).toBe("waiting_for_input");
    expect(state.waitingNodeId).toBe("form-node");
  });

  it("rehydrates structured form shape from snapshot", () => {
    const formConfig = {
      title: "입력폼",
      description: "테스트 폼이에요",
      notes: "",
      errorPolicy: "stop",
      fields: [
        { name: "useful", type: "number", label: "만족도 (1~5)", required: true },
      ],
    };
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "form-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            outputData: {
              config: formConfig,
              output: null,
              status: "waiting_for_input",
              meta: { interactionType: "form" },
            },
            node: { id: "form-node", type: "form", label: "Form" },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("form");
    expect(state.waitingNodeId).toBe("form-node");
    expect(state.waitingFormConfig).toEqual(formConfig);
  });

  it("rehydrates structured buttons shape from snapshot", () => {
    const btnConfig = {
      buttons: [{ id: "b1", label: "Yes", type: "port" }],
    };
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "btn-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            outputData: {
              config: btnConfig,
              output: null,
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
            node: { id: "btn-node", type: "table", label: "Buttons" },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
    expect(useExecutionStore.getState().waitingButtonConfig).toEqual(btnConfig);
  });

  it("rehydrates legacy flat form shape from snapshot (backward compat)", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "form-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            outputData: { type: "form", formConfig: { fields: [{ name: "x", type: "text", label: "X" }] } },
            node: { id: "form-node", type: "form", label: "Form" },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBe("form");
    expect(useExecutionStore.getState().waitingFormConfig).toEqual({
      fields: [{ name: "x", type: "text", label: "X" }],
    });
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

    // Verify execution.resumed handler is cleaned up
    const resumedOffCalls = offCalls.filter(
      (c: unknown[]) => c[0] === "execution.resumed",
    );
    expect(resumedOffCalls.length).toBe(1);
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

  it("silently ignores a snapshot with no execution payload", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const handler = getHandler("execution.snapshot");
    handler({ executionId: "exec-1" });

    // Status untouched (still "running" from startExecution)
    expect(useExecutionStore.getState().status).toBe("running");
  });

  it("promotes idle → running when snapshot reports a running execution (mid-run page entry)", () => {
    // Store starts idle — simulates opening the detail page while a
    // workflow is already executing on another tab / device.
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        id: "exec-1",
        status: "running",
        nodeExecutions: [],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.status).toBe("running");
    expect(state.executionId).toBe("exec-1");
  });

  it("does not downgrade a completed node when snapshot carries an older running row", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    // Incremental node.completed arrives first (race: snapshot is in flight
    // but the node already finished on the server).
    getHandler("execution.node.completed")({
      nodeExecutionId: "ne-1",
      nodeId: "node-1",
      duration: 120,
      nodeType: "http_request",
      nodeLabel: "Fetch",
      output: { status: 200 },
    });
    expect(
      useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
    ).toBe("completed");

    // Older snapshot showing the node still "running" must not regress the
    // completed status.
    emitSnapshot(
      createMockExecution({
        status: "running",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "node-1",
            status: "running",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            node: { id: "node-1", type: "http_request", label: "Fetch" },
          },
        ],
      }),
    );

    expect(
      useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
    ).toBe("completed");
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

    it("execution.node.started updates node status and adds to results", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.started");
      handler({ nodeId: "node-1", nodeType: "http_request", nodeLabel: "Fetch" });

      expect(
        useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
      ).toBe("running");

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("running");
    });

    it("execution.node.completed updates node status with duration and adds to results", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.completed");
      handler({ nodeId: "node-1", duration: 250, nodeType: "table", nodeLabel: "Results" });

      const nodeStatus = useExecutionStore
        .getState()
        .nodeStatuses.get("node-1");
      expect(nodeStatus?.status).toBe("completed");
      expect(nodeStatus?.duration).toBe(250);

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].nodeType).toBe("table");
    });

    it("execution.node.failed updates node status with error and adds to results", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.failed");
      handler({ nodeId: "node-1", error: "Timeout", nodeType: "http_request", nodeLabel: "Fetch" });

      const nodeStatus = useExecutionStore
        .getState()
        .nodeStatuses.get("node-1");
      expect(nodeStatus?.status).toBe("failed");
      expect(nodeStatus?.error).toBe("Timeout");

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].error).toBe("Timeout");
    });

    it("execution.node.skipped updates node status and adds to results", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.node.skipped");
      handler({ nodeId: "node-1", nodeType: "if_else", nodeLabel: "Branch" });

      expect(
        useExecutionStore.getState().nodeStatuses.get("node-1")?.status,
      ).toBe("skipped");

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe("skipped");
    });

    it("execution.resumed resumes without clearing nodeResults", () => {
      // Set up: execution is waiting for form input with existing results
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().addNodeResult({
        nodeId: "node-1",
        nodeLabel: "HTTP Request",
        nodeType: "http_request",
        nodeCategory: "integration",
        status: "completed",
        outputData: { status: 200 },
        startedAt: "2026-04-01T00:00:00Z",
      });
      useExecutionStore.getState().pauseForForm("form-1", { fields: [] });

      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.resumed");
      expect(handler).toBeDefined();
      handler({ executionId: "exec-1" });

      const state = useExecutionStore.getState();
      // Status should be running (resumed)
      expect(state.status).toBe("running");
      // Waiting state should be cleared
      expect(state.waitingNodeId).toBeNull();
      // Previous nodeResults should be preserved (NOT cleared)
      expect(state.nodeResults).toHaveLength(1);
      expect(state.nodeResults[0].nodeId).toBe("node-1");
    });

    it("execution.started does NOT reset results when status is waiting_for_input (backward compat guard)", () => {
      // Set up: execution is waiting for form with existing results
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().addNodeResult({
        nodeId: "node-1",
        nodeLabel: "HTTP Request",
        nodeType: "http_request",
        nodeCategory: "integration",
        status: "completed",
        outputData: { status: 200 },
        startedAt: "2026-04-01T00:00:00Z",
      });
      useExecutionStore.getState().addNodeResult({
        nodeId: "form-1",
        nodeLabel: "Form",
        nodeType: "form",
        nodeCategory: "presentation",
        status: "waiting_for_input",
        outputData: null,
        startedAt: "2026-04-01T00:00:01Z",
      });
      useExecutionStore.getState().pauseForForm("form-1", { fields: [] });

      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.started");
      // Simulate old backend sending execution.started on resume
      handler({ executionId: "exec-1" });

      const state = useExecutionStore.getState();
      // Should resume, NOT reset
      expect(state.status).toBe("running");
      expect(state.waitingNodeId).toBeNull();
      // All previous results preserved
      expect(state.nodeResults).toHaveLength(2);
      expect(state.nodeResults[0].nodeId).toBe("node-1");
      expect(state.nodeResults[1].nodeId).toBe("form-1");
    });

    it("execution.started DOES reset results for a fresh execution", () => {
      // Status is idle (not waiting_for_input)
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      const handler = getEventHandler("execution.started");
      handler({ executionId: "exec-1" });

      const state = useExecutionStore.getState();
      expect(state.status).toBe("running");
      expect(state.executionId).toBe("exec-1");
      expect(state.nodeResults).toHaveLength(0);
    });
  });

  describe("tool call events", () => {
    function bind() {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const onCalls = (mockClient.on as Mock).mock.calls;
      const get = (name: string) =>
        onCalls.find((c: unknown[]) => c[0] === name)?.[1] as
          | ((data: unknown) => void)
          | undefined;
      return {
        toolStarted: get("execution.tool_call_started"),
        toolCompleted: get("execution.tool_call_completed"),
        aiMessage: get("execution.ai_message"),
      };
    }

    it("registers handlers for execution.tool_call_started/completed", () => {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const bound = (mockClient.on as Mock).mock.calls.map(
        (c: unknown[]) => c[0],
      );
      expect(bound).toContain("execution.tool_call_started");
      expect(bound).toContain("execution.tool_call_completed");
    });

    it("tool_call_started appends a pending tool item", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted } = bind();
      expect(toolStarted).toBeDefined();

      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        name: "kb_search",
        arguments: '{"query":"hi"}',
      });

      const items = useExecutionStore.getState().conversationMessages;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: "tool",
        content: "kb_search",
        toolStatus: "pending",
        toolCallId: "call_1",
        turnIndex: 1,
      });
      expect(items[0].toolArgs).toEqual({ query: "hi" });
    });

    it("tool_call_started ignores duplicate toolCallId (idempotent)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted } = bind();

      const payload = {
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        name: "kb_search",
        arguments: "{}",
      };
      toolStarted!(payload);
      toolStarted!(payload);

      expect(useExecutionStore.getState().conversationMessages).toHaveLength(1);
    });

    it("tool_call_completed flips pending → success and fills result/duration", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted, toolCompleted } = bind();

      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        name: "kb_search",
        arguments: "{}",
      });
      toolCompleted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        content: '{"ok":1}',
        status: "success",
        durationMs: 42,
      });

      const item = useExecutionStore
        .getState()
        .conversationMessages.find((i) => i.toolCallId === "call_1");
      expect(item).toMatchObject({
        toolStatus: "success",
        durationMs: 42,
      });
      expect(item?.toolResult).toEqual({ ok: 1 });
    });

    it("tool_call_completed marks status='error' and stores error message", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted, toolCompleted } = bind();

      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "c1",
        name: "mcp_x",
        arguments: "{}",
      });
      toolCompleted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "c1",
        content: '{"error":"timeout"}',
        status: "error",
        error: "timeout",
        durationMs: 30000,
      });

      const item = useExecutionStore
        .getState()
        .conversationMessages.find((i) => i.toolCallId === "c1");
      expect(item).toMatchObject({
        toolStatus: "error",
        error: "timeout",
      });
    });

    it("ai_message replaces conversationMessages with full snapshot (incl. tool items)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { aiMessage } = bind();
      expect(aiMessage).toBeDefined();

      // Simulate optimistic user-side append from sendMessage
      useExecutionStore.getState().addConversationMessage({
        type: "user",
        content: "오늘 날씨",
        turnIndex: 1,
      });

      aiMessage!({
        nodeId: "agent-1",
        message: "기온 12.3도입니다.",
        turnCount: 1,
        messages: [
          { role: "user", content: "오늘 날씨" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              {
                id: "call_1",
                name: "get_weather",
                arguments: '{"city":"Seoul"}',
              },
            ],
          },
          {
            role: "tool",
            toolCallId: "call_1",
            content: '{"temperature":12.3}',
          },
          { role: "assistant", content: "기온 12.3도입니다." },
        ],
        metadata: { model: "gpt-5", inputTokens: 100, outputTokens: 50 },
      });

      const items = useExecutionStore.getState().conversationMessages;
      expect(items.map((i) => i.type)).toEqual([
        "user",
        "assistant",
        "tool",
        "assistant",
      ]);
      expect(items[2]).toMatchObject({
        type: "tool",
        content: "get_weather",
        toolCallId: "call_1",
      });
    });

    it("ai_message snapshot supersedes prior pending tool items (dedup by toolCallId)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted, aiMessage } = bind();

      // Pending tool from live event
      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        name: "get_weather",
        arguments: "{}",
      });
      expect(useExecutionStore.getState().conversationMessages).toHaveLength(1);

      // Snapshot arrives — should fully replace
      aiMessage!({
        nodeId: "agent-1",
        message: "done",
        turnCount: 1,
        messages: [
          { role: "user", content: "u" },
          {
            role: "assistant",
            content: "",
            toolCalls: [
              { id: "call_1", name: "get_weather", arguments: "{}" },
            ],
          },
          { role: "tool", toolCallId: "call_1", content: '{"ok":1}' },
          { role: "assistant", content: "done" },
        ],
      });

      const items = useExecutionStore.getState().conversationMessages;
      // No duplicate tool items — should only have the one from snapshot
      const toolItems = items.filter((i) => i.toolCallId === "call_1");
      expect(toolItems).toHaveLength(1);
    });

    it("ai_message falls back to single-assistant append when payload.messages is absent (legacy)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { aiMessage } = bind();

      aiMessage!({
        nodeId: "agent-1",
        message: "legacy reply",
        turnCount: 1,
      });

      const items = useExecutionStore.getState().conversationMessages;
      expect(items).toHaveLength(1);
      expect(items[0]).toMatchObject({
        type: "assistant",
        content: "legacy reply",
      });
    });
  });
});
