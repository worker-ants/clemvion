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

// Mock sonner toast — Fix D 회귀 fix 검증용. toast 호출 / dismiss 추적.
// vi.hoisted 로 vi.mock 의 hoisting 시점에서 접근 가능하도록 한다.
const { mockToast } = vi.hoisted(() => ({
  mockToast: {
    warning: vi.fn(),
    dismiss: vi.fn(),
  },
}));
vi.mock("sonner", () => ({
  toast: mockToast,
}));

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

  // Loop body 의 같은 nodeId 가 N번 실행될 때 후속 iter 의 NODE_STARTED 가
  // out-of-order guard 에 막혀 store add 가 차단되면 row 의 startedAt 이
  // 누락되어 sortByStartedAt 이 timeline 끝으로 sink 시키는 회귀 가드 (PR-B
  // hotfix #4 — Loop iter timeline 순서 회귀).
  it("preserves startedAt for every iteration of the same nodeId (Loop body)", async () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const startedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.started",
    )?.[1] as (data: unknown) => void;
    const completedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.completed",
    )?.[1] as (data: unknown) => void;

    const fire = (
      nodeExecId: string,
      startedAt: string,
      label: "iter1" | "iter2" | "iter3",
    ) => {
      startedHandler({
        nodeExecutionId: nodeExecId,
        nodeId: "loop-body",
        nodeType: "transform",
        nodeLabel: "반복 브릿지",
        startedAt,
      });
      completedHandler({
        nodeExecutionId: nodeExecId,
        nodeId: "loop-body",
        nodeType: "transform",
        nodeLabel: "반복 브릿지",
        duration: 4,
        output: { iter: label },
      });
    };

    // sanitizeUuid 가 UUID format 만 통과하므로 실제 UUID 사용.
    const ITER1 = "164fd9d1-5f54-4789-8277-4e210f1969e8";
    const ITER2 = "85f48254-e3f1-44e5-80ae-1fc3c1e990ed";
    const ITER3 = "e2606475-733b-4b92-b72e-e8e41dad9fa0";
    const DONE = "3c3390ae-5995-43d0-bd54-041a7fa0f9c9";

    fire(ITER1, "2026-05-09T00:20:38.972Z", "iter1");
    fire(ITER2, "2026-05-09T00:20:38.982Z", "iter2");
    fire(ITER3, "2026-05-09T00:20:38.990Z", "iter3");

    // done port 의 후속 노드 (다른 nodeId).
    startedHandler({
      nodeExecutionId: DONE,
      nodeId: "result-display",
      nodeType: "template",
      nodeLabel: "반복문 결과 표시",
      startedAt: "2026-05-09T00:20:38.999Z",
    });
    completedHandler({
      nodeExecutionId: DONE,
      nodeId: "result-display",
      nodeType: "template",
      nodeLabel: "반복문 결과 표시",
      duration: 4,
    });

    const results = useExecutionStore.getState().nodeResults;
    // iter 별 row 가 모두 보존되어야 한다 (총 4개: iter 1/2/3 + 결과 표시).
    expect(results).toHaveLength(4);

    // 모든 row 의 startedAt 이 set 되어 있어야 한다 — undefined 회귀 차단.
    for (const r of results) {
      expect(r.startedAt).toBeTruthy();
    }

    // sortByStartedAt 결과가 backend 의 ASC 순서를 그대로 따라야 한다.
    expect(results.map((r) => r.nodeExecutionId)).toEqual([
      ITER1,
      ITER2,
      ITER3,
      DONE,
    ]);

    // nodeStatuses 의 status 다운그레이드 차단 의도는 보존: 마지막 NODE_COMPLETED
    // 가 통과해서 "completed" 로 남아야 한다.
    expect(
      useExecutionStore.getState().nodeStatuses.get("loop-body")?.status,
    ).toBe("completed");
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

  // PR-B hotfix #6 — backend 가 NODE_COMPLETED/FAILED/SKIPPED payload 에
  // startedAt 을 동봉하도록 일관성 강화. NODE_STARTED race miss / 재연결
  // 등으로 store 에 prior row 가 없는 시나리오에서도 row 의 startedAt 이
  // 누락되지 않아 sortByStartedAt 정렬이 정상 동작.
  it("uses payload.startedAt when NODE_COMPLETED arrives without a prior NODE_STARTED row", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const completedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.completed",
    )?.[1] as (data: unknown) => void;

    completedHandler({
      nodeExecutionId: "164fd9d1-5f54-4789-8277-4e210f1969e8",
      nodeId: "node-1",
      nodeType: "transform",
      nodeLabel: "변환",
      duration: 5,
      output: { ok: true },
      startedAt: "2026-05-09T00:20:38.972Z",
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(1);
    expect(results[0].startedAt).toBe("2026-05-09T00:20:38.972Z");
  });

  it("uses payload.startedAt when NODE_FAILED arrives without a prior row (race miss)", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const onCalls = (mockClient.on as Mock).mock.calls;
    const failedHandler = onCalls.find(
      (c: unknown[]) => c[0] === "execution.node.failed",
    )?.[1] as (data: unknown) => void;

    failedHandler({
      nodeExecutionId: "85f48254-e3f1-44e5-80ae-1fc3c1e990ed",
      nodeId: "node-x",
      nodeType: "http_request",
      nodeLabel: "Fetch",
      error: "Timeout",
      startedAt: "2026-05-09T00:20:39.100Z",
    });

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(1);
    expect(results[0].startedAt).toBe("2026-05-09T00:20:39.100Z");
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

  // PR-B hotfix #3 — meta.interactionType 누락 시 nodeType 기반 fallback 으로
  // store 의 waitingInteractionType 이 정확히 hydrate 되어야 한다. 누락 시
  // page.tsx 의 isWaitingButtons=false 가 되어 Carousel Preview 탭의 버튼이
  // 콜백 없이 disabled 로 그려지는 회귀 발생.
  it("infers buttons interaction from carousel nodeType when meta.interactionType is missing", () => {
    const btnConfig = {
      buttons: [{ id: "b1", label: "Logic 노드 테스트", type: "port" }],
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
            nodeId: "carousel-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            // meta.interactionType 누락 — backend 가 빠뜨린 시나리오. envelope
            // shape 만으로는 'buttons' 분기를 알 수 없으나 nodeType==='carousel'
            // 로 fallback 하여 정확히 판정.
            outputData: {
              config: btnConfig,
              output: null,
              status: "waiting_for_input",
            },
            node: {
              id: "carousel-node",
              type: "carousel",
              label: "카테고리 선택",
            },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
    expect(useExecutionStore.getState().waitingButtonConfig).toEqual(btnConfig);
  });

  // Carousel buttons-disabled bug fix (2026-05-09) — handleSnapshot 의
  // 마지막 fallback 강화. REST `/executions/:id` 응답이 `nodeExecutions[].node`
  // 객체를 nest 하지 않거나 (TypeORM eager load 누락 / select fields 제한 등),
  // 대신 row 자체에 `nodeType` 필드만 있는 경우에도 buttons 분기 가능해야 한다.
  it("infers buttons interaction from waitingNode.nodeType when node object is missing", () => {
    const btnConfig = {
      buttons: [{ id: "b1", label: "Logic 노드 테스트", type: "port" }],
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
            nodeId: "carousel-node",
            // node 객체 누락 — REST API 가 relation 을 eager load 하지 않은
            // 시나리오. 대신 nodeType 가 row 자체에 있다 (응답 shape 변형).
            nodeType: "carousel",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            outputData: {
              config: btnConfig,
              output: null,
              status: "waiting_for_input",
            },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
    expect(useExecutionStore.getState().waitingButtonConfig).toEqual(btnConfig);
  });

  // Carousel buttons-disabled bug fix — handleWaitingForInput 의 nodeType
  // fallback. backend 가 (가설 1 의 race window 또는 향후 회귀로) WS payload 의
  // top-level `interactionType` 과 `nodeOutput.interactionType` 을 모두 누락
  // 했다고 가정. `payload.waitingNodeType: 'carousel'` 만 있어도 정확히
  // 'buttons' 분기로 흘러가야 한다.
  it("infers buttons interaction from payload.waitingNodeType when interactionType is missing", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    const handler = getHandler("execution.waiting_for_input");
    handler({
      waitingNodeId: "carousel-node",
      waitingNodeType: "carousel",
      waitingNodeLabel: "카테고리 선택",
      nodeExecutionId: "ne-1",
      startedAt: "2026-04-01T00:00:00Z",
      // interactionType / buttonConfig 모두 누락 — backend 가 payload 를
      // 빠뜨린 시나리오를 시뮬.
      nodeOutput: {
        // nodeOutput 자체에도 interactionType 명시 없음.
      },
    });

    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
  });

  // Loop body 가 같은 nodeId 의 여러 NodeExecution row (iter 1/2/3) 를
  // 가질 때 snapshot reconcile 이 nodeStatuses 가드로 후속 iter row 의
  // addNodeResult 까지 차단하던 회귀 가드 (PR-B hotfix #5 — handleNodeStarted
  // 와 같은 패턴이 snapshot 경로에도 존재).
  it("rehydrates every iteration row from snapshot (Loop body, same nodeId)", () => {
    const ITER1 = "164fd9d1-5f54-4789-8277-4e210f1969e8";
    const ITER2 = "85f48254-e3f1-44e5-80ae-1fc3c1e990ed";
    const ITER3 = "e2606475-733b-4b92-b72e-e8e41dad9fa0";
    const DONE = "3c3390ae-5995-43d0-bd54-041a7fa0f9c9";

    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "completed",
        nodeExecutions: [
          {
            id: ITER1,
            executionId: "exec-1",
            nodeId: "loop-body",
            status: "completed",
            durationMs: 4,
            error: null,
            startedAt: "2026-05-09T00:20:38.972Z",
            finishedAt: "2026-05-09T00:20:38.976Z",
            outputData: { iter: 1 },
            node: { id: "loop-body", type: "transform", label: "반복 브릿지" },
          },
          {
            id: ITER2,
            executionId: "exec-1",
            nodeId: "loop-body",
            status: "completed",
            durationMs: 3,
            error: null,
            startedAt: "2026-05-09T00:20:38.982Z",
            finishedAt: "2026-05-09T00:20:38.985Z",
            outputData: { iter: 2 },
            node: { id: "loop-body", type: "transform", label: "반복 브릿지" },
          },
          {
            id: ITER3,
            executionId: "exec-1",
            nodeId: "loop-body",
            status: "completed",
            durationMs: 3,
            error: null,
            startedAt: "2026-05-09T00:20:38.990Z",
            finishedAt: "2026-05-09T00:20:38.993Z",
            outputData: { iter: 3 },
            node: { id: "loop-body", type: "transform", label: "반복 브릿지" },
          },
          {
            id: DONE,
            executionId: "exec-1",
            nodeId: "result-display",
            status: "completed",
            durationMs: 4,
            error: null,
            startedAt: "2026-05-09T00:20:38.999Z",
            finishedAt: "2026-05-09T00:20:39.003Z",
            outputData: { final: true },
            node: { id: "result-display", type: "template", label: "결과 표시" },
          },
        ],
      }),
    );

    const results = useExecutionStore.getState().nodeResults;
    // iter 별 row 모두 보존 (총 4개) — guard 가 후속 iter 를 skip 하면 2개만 남음.
    expect(results).toHaveLength(4);

    // 모든 row 의 startedAt 정상 hydrate.
    for (const r of results) expect(r.startedAt).toBeTruthy();

    // sortByStartedAt 결과가 backend 의 ASC 순서대로.
    expect(results.map((r) => r.nodeExecutionId)).toEqual([
      ITER1,
      ITER2,
      ITER3,
      DONE,
    ]);
  });

  it("infers ai_conversation interaction from ai_agent nodeType fallback", () => {
    useExecutionStore.getState().startExecution("exec-1");
    renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

    emitSnapshot(
      createMockExecution({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "ai-node",
            status: "waiting_for_input",
            durationMs: null,
            error: null,
            startedAt: "2026-04-01T00:00:00Z",
            finishedAt: null,
            outputData: {
              config: { mode: "multi_turn" },
              output: null,
              status: "waiting_for_input",
            },
            node: { id: "ai-node", type: "ai_agent", label: "AI Agent" },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBe(
      "ai_conversation",
    );
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

    it("ai_message ignores payloads missing the messages snapshot (invariant violation)", () => {
      // spec/5-system/6-websocket-protocol.md §4.4 — backend always sends
      // a messages snapshot; payloads without one are an invariant
      // violation and are silently dropped (with a dev-only warning).
      useExecutionStore.getState().startExecution("exec-1");
      const { aiMessage } = bind();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        aiMessage!({
          nodeId: "agent-1",
          message: "legacy reply",
          turnCount: 1,
        });

        const items = useExecutionStore.getState().conversationMessages;
        expect(items).toHaveLength(0);
        // The dev-only warning is the only visible signal — assert it fires
        // and only carries non-sensitive identifiers (no raw payload).
        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy).toHaveBeenCalledWith(
          expect.stringContaining(
            "execution.ai_message without messages snapshot",
          ),
          { nodeId: "agent-1", turnCount: 1 },
        );
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("ai_message ignores payloads with messages: [] (empty snapshot)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { aiMessage } = bind();

      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
      try {
        aiMessage!({
          nodeId: "agent-1",
          message: "ignored",
          turnCount: 1,
          messages: [],
        });

        const items = useExecutionStore.getState().conversationMessages;
        expect(items).toHaveLength(0);
        expect(warnSpy).toHaveBeenCalledTimes(1);
      } finally {
        warnSpy.mockRestore();
      }
    });

    it("ai_message snapshot preserves toolStatus from prior tool_call_completed events", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted, toolCompleted, aiMessage } = bind();

      // Live: pending → success via tool_call_started/completed
      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_1",
        name: "get_weather",
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

      // Snapshot arrives without meta.turnDebug.toolCalls — toolStatus should
      // not regress to undefined.
      aiMessage!({
        nodeId: "agent-1",
        message: "done",
        turnCount: 1,
        messages: [
          { role: "user", content: "weather" },
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

      const tool = useExecutionStore
        .getState()
        .conversationMessages.find((i) => i.toolCallId === "call_1");
      expect(tool?.toolStatus).toBe("success");
      expect(tool?.durationMs).toBe(42);
    });

    it("tool_call_completed creates a synthetic item when no started arrived first (out-of-order)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolCompleted } = bind();

      toolCompleted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "out_of_order",
        content: '{"ok":1}',
        status: "success",
        durationMs: 10,
      });

      const item = useExecutionStore
        .getState()
        .conversationMessages.find((i) => i.toolCallId === "out_of_order");
      // Without this defensive upsert a dangling pending could appear later.
      expect(item).toBeDefined();
      expect(item?.toolStatus).toBe("success");
    });

    it("execution.failed flips dangling pending tool items to error", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const { toolStarted } = bind();
      toolStarted!({
        nodeId: "agent-1",
        turnIndex: 1,
        toolCallId: "call_dangling",
        name: "kb_search",
        arguments: "{}",
      });

      const failed = (mockClient.on as Mock).mock.calls.find(
        (c: unknown[]) => c[0] === "execution.failed",
      )?.[1] as ((data: unknown) => void) | undefined;
      failed?.({ error: "backend crashed" });

      // failExecution clears conversationMessages via CLEAR_WAITING, so
      // the assertion that matters is "no infinite spinner survives" —
      // i.e. the store no longer holds a pending item for this id.
      const lingering = useExecutionStore
        .getState()
        .conversationMessages.find((i) => i.toolCallId === "call_dangling");
      expect(lingering).toBeUndefined();
    });
  });

  describe("waiting_for_input — conversation seeding with tool messages", () => {
    function bindAndGetWaitingHandler() {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      return (mockClient.on as Mock).mock.calls.find(
        (c: unknown[]) => c[0] === "execution.waiting_for_input",
      )?.[1] as (data: unknown) => void;
    }

    it("seeds tool items from convConfig.messages on initial waiting payload", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const handler = bindAndGetWaitingHandler();

      handler({
        waitingNodeId: "agent-1",
        nodeOutput: {
          interactionType: "ai_conversation",
          conversationConfig: {
            turnCount: 1,
            messages: [
              { role: "user", content: "weather?" },
              {
                role: "assistant",
                content: "",
                toolCalls: [
                  { id: "c1", name: "get_weather", arguments: '{"city":"S"}' },
                ],
              },
              { role: "tool", toolCallId: "c1", content: '{"ok":1}' },
              { role: "assistant", content: "기온 12.3도" },
            ],
          },
        },
      });

      const items = useExecutionStore.getState().conversationMessages;
      expect(items.map((i) => i.type)).toEqual([
        "user",
        "assistant",
        "tool",
        "assistant",
      ]);
      const toolItem = items.find((i) => i.type === "tool");
      expect(toolItem).toMatchObject({
        toolCallId: "c1",
        content: "get_weather",
      });
    });
  });

  // Fix D 회귀 fix — snapshotReceived 기반 toast 신호.
  // 이전 isConnected 기반 toast 가 WS singleton 의 기존 연결 상태를 무시하여
  // 페이지 navigation 마다 false positive 발화. 새 신호 (handleSnapshot 이
  // 받았는지) 로 정확도 향상.
  describe("WS toast — snapshotReceived signal (Fix D 회귀)", () => {
    beforeEach(() => {
      mockToast.warning.mockClear();
      mockToast.dismiss.mockClear();
      vi.useFakeTimers();
    });
    afterEach(() => {
      vi.useRealTimers();
    });

    it("snapshot 수신 시 즉시 toast dismiss + 이후 timer 발화 안 함", async () => {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));

      // 초기 mount — snapshotReceived=false → 10초 timer 가 시작됨.
      expect(mockToast.warning).not.toHaveBeenCalled();

      // WS snapshot 도착 시뮬.
      const snapshotHandler = getHandler("execution.snapshot");
      snapshotHandler({
        executionId: "exec-1",
        execution: createMockExecution({ status: "running" }),
      });

      // dismiss 호출 (snapshotReceived → true 의 effect).
      // React state update 가 다음 microtask 에 propagate.
      await vi.runOnlyPendingTimersAsync();
      expect(mockToast.dismiss).toHaveBeenCalledWith("ws-connection-warning");

      // 이제 10초 타이머가 발화해도 toast 가 뜨지 않아야 함 (effect 가 cleanup
      // 됐기 때문에).
      vi.advanceTimersByTime(15000);
      expect(mockToast.warning).not.toHaveBeenCalled();
    });

    it("snapshot 안 도착 + 10초 경과 시 toast 발화", async () => {
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      expect(mockToast.warning).not.toHaveBeenCalled();

      // 9초 → 아직 발화 안 함.
      vi.advanceTimersByTime(9000);
      expect(mockToast.warning).not.toHaveBeenCalled();

      // 11초 → 발화.
      vi.advanceTimersByTime(2000);
      expect(mockToast.warning).toHaveBeenCalledWith(
        expect.stringContaining("실시간 업데이트"),
        expect.objectContaining({ id: "ws-connection-warning" }),
      );
    });

    it("executionId 변경 시 snapshotReceived reset → 새 timer 시작", async () => {
      const { rerender } = renderHook(
        ({ id }: { id: string }) => useExecutionEvents({ executionId: id }),
        { initialProps: { id: "exec-1" } },
      );

      // exec-1 의 snapshot 도착 → snapshotReceived=true.
      const snapshotHandler = getHandler("execution.snapshot");
      snapshotHandler({
        executionId: "exec-1",
        execution: createMockExecution({ id: "exec-1" }),
      });
      await vi.runOnlyPendingTimersAsync();
      mockToast.warning.mockClear();
      mockToast.dismiss.mockClear();

      // exec-2 로 navigate — render-time prop change reset 이 snapshotReceived
      // 를 false 로 되돌려 새 timer 시작.
      rerender({ id: "exec-2" });
      expect(mockToast.warning).not.toHaveBeenCalled();

      vi.advanceTimersByTime(11000);
      expect(mockToast.warning).toHaveBeenCalled();
    });
  });

  // spec/conventions/conversation-thread.md §9.3 — conversation Preview 의
  // 1차 데이터 소스는 conversationThread.turns snapshot.
  describe("ai_conversation waiting_for_input — conversationThread snapshot 우선", () => {
    function getWaitingHandler() {
      const onCalls = (mockClient.on as Mock).mock.calls;
      return onCalls.find(
        (c: unknown[]) => c[0] === "execution.waiting_for_input",
      )?.[1] as (data: unknown) => void;
    }

    it("conversationThread.turns 가 있으면 emit messages 대신 thread snapshot 으로 변환", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const handler = getWaitingHandler();

      handler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: {
          conversationConfig: {
            // emit messages 는 prefix 박힌 형태로 들어와도 무시되어야 한다
            messages: [{ role: "user", content: "[from Template] noise" }],
            turnCount: 1,
            maxTurns: 5,
          },
        },
        conversationThread: {
          id: "default",
          nextSeq: 2,
          turns: [
            {
              seq: 0,
              nodeId: "tpl-1",
              nodeLabel: "Template",
              nodeType: "template",
              source: "presentation_user",
              text: "clicked: AI와 대화하기",
              data: { buttonId: "open_chat", buttonLabel: "AI와 대화하기" },
            },
            {
              seq: 1,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "질문",
            },
          ],
        },
      });

      const msgs = useExecutionStore.getState().conversationMessages;
      expect(msgs).toHaveLength(2);
      expect(msgs[0].type).toBe("presentation");
      expect(msgs[0].presentation?.nodeLabel).toBe("Template");
      expect(msgs[1].type).toBe("user");
      expect(msgs[1].content).toBe("질문");
    });

    it("재emit 시 동일 snapshot 은 store 를 덮어쓰지 않는다 (idempotency)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const handler = getWaitingHandler();

      const payload = {
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: { messages: [] } },
        conversationThread: {
          id: "default",
          nextSeq: 1,
          turns: [
            {
              seq: 0,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "안녕",
            },
          ],
        },
      };

      handler(payload);
      const first = useExecutionStore.getState().conversationMessages;
      expect(first).toHaveLength(1);

      // Mid-snapshot 로컬로 추가된 in-flight live turn 을 시뮬레이션.
      useExecutionStore.getState().addConversationMessage({
        type: "assistant",
        content: "응답 중...",
        turnIndex: 1,
      });
      const accumulated = useExecutionStore.getState().conversationMessages;
      expect(accumulated).toHaveLength(2);

      // 같은 payload 재emit (WS reconnect 시뮬레이션). 동일 nextSeq 이므로
      // 누적된 live turn 을 덮어쓰지 않아야 한다.
      handler(payload);
      const after = useExecutionStore.getState().conversationMessages;
      expect(after).toHaveLength(2);
      expect(after[1].content).toBe("응답 중...");
    });

    it("새 turn 이 추가된 snapshot 이 오면 (nextSeq advance) 덮어쓴다", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const handler = getWaitingHandler();

      handler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: { messages: [] } },
        conversationThread: {
          id: "default",
          nextSeq: 1,
          turns: [
            {
              seq: 0,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "first",
            },
          ],
        },
      });

      handler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: { messages: [] } },
        conversationThread: {
          id: "default",
          nextSeq: 3,
          turns: [
            {
              seq: 0,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "first",
            },
            {
              seq: 1,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_assistant",
              text: "reply",
            },
            {
              seq: 2,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "second",
            },
          ],
        },
      });

      const msgs = useExecutionStore.getState().conversationMessages;
      expect(msgs).toHaveLength(3);
      expect(msgs[1].content).toBe("reply");
      expect(msgs[2].content).toBe("second");
    });

    // 회귀: ai_message 가 thread items 를 message-derived items 로 덮어쓴
    // 직후 후속 waiting_for_input 의 thread snapshot 이 source 분기
    // (presentation_user) 를 복원해야 한다 (spec §9.1). 기존 idempotency
    // 가드는 `conversationMessages.length` 와 비교했고 multi-turn 사이클이
    // 끝나면 length 가 마침 thread nextSeq 와 같아져 영구 skip — Template
    // click 이 plain user bubble 로 박혀버리는 회귀가 있었다.
    it("ai_message 덮어쓰기 후 후속 waiting_for_input snapshot 으로 presentation 복원", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const waitingHandler = getWaitingHandler();
      const onCalls = (mockClient.on as Mock).mock.calls;
      const aiMessageHandler = onCalls.find(
        (c: unknown[]) => c[0] === "execution.ai_message",
      )?.[1] as (data: unknown) => void;

      // 1) 초기 waiting — thread 에 Template presentation_user + AI 인사.
      waitingHandler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: { messages: [], turnCount: 0, maxTurns: 5 } },
        conversationThread: {
          id: "default",
          nextSeq: 2,
          turns: [
            {
              seq: 0,
              nodeId: "tpl-1",
              nodeLabel: "Template",
              nodeType: "template",
              source: "presentation_user",
              text: "clicked: AI와 대화하기",
              data: { buttonId: "open_chat", buttonLabel: "AI와 대화하기" },
            },
            {
              seq: 1,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_assistant",
              text: "안녕하세요",
            },
          ],
        },
      });
      expect(
        useExecutionStore.getState().conversationMessages[0].type,
      ).toBe("presentation");

      // 2) 사용자가 turn 진행 후 ai_message 도착 — emit messages 는 source 별
      //    분기를 모르므로 첫 항목이 plain user 로 박힌다.
      aiMessageHandler({
        nodeId: "ai-1",
        message: "안녕하세요. 무엇을 도와드릴까요?",
        turnCount: 1,
        messages: [
          {
            role: "user",
            content: "[from Template] clicked: AI와 대화하기",
            source: "injected",
          },
          { role: "user", content: "지금 어떤 상품이 판매중이야?" },
          {
            role: "assistant",
            content: "현재 판매중인 상품 목록입니다.",
          },
        ],
      });
      const afterAiMessage =
        useExecutionStore.getState().conversationMessages;
      // length 가 새 nextSeq 와 우연히 같아지는 시나리오 재현.
      expect(afterAiMessage).toHaveLength(3);
      expect(afterAiMessage[0].type).toBe("user");

      // 3) 후속 waiting_for_input — nextSeq 가 advance 했으므로 thread
      //    snapshot 으로 다시 적용되고 presentation 분기가 복원된다.
      waitingHandler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: { conversationConfig: { messages: [], turnCount: 1, maxTurns: 5 } },
        conversationThread: {
          id: "default",
          nextSeq: 3,
          turns: [
            {
              seq: 0,
              nodeId: "tpl-1",
              nodeLabel: "Template",
              nodeType: "template",
              source: "presentation_user",
              text: "clicked: AI와 대화하기",
              data: { buttonId: "open_chat", buttonLabel: "AI와 대화하기" },
            },
            {
              seq: 1,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_user",
              text: "지금 어떤 상품이 판매중이야?",
            },
            {
              seq: 2,
              nodeId: "ai-1",
              nodeLabel: "AI Agent",
              nodeType: "ai_agent",
              source: "ai_assistant",
              text: "현재 판매중인 상품 목록입니다.",
            },
          ],
        },
      });

      const restored = useExecutionStore.getState().conversationMessages;
      expect(restored).toHaveLength(3);
      expect(restored[0].type).toBe("presentation");
      expect(restored[0].presentation?.nodeLabel).toBe("Template");
      expect(restored[1].type).toBe("user");
      expect(restored[2].type).toBe("assistant");
    });

    it("thread snapshot 부재 시 emit messages fallback (backward compat)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      renderHook(() => useExecutionEvents({ executionId: "exec-1" }));
      const handler = getWaitingHandler();

      handler({
        waitingNodeId: "ai-1",
        waitingNodeType: "ai_agent",
        interactionType: "ai_conversation",
        nodeOutput: {
          conversationConfig: {
            messages: [{ role: "user", content: "fallback msg" }],
            turnCount: 1,
            maxTurns: 5,
          },
        },
        // conversationThread 미동봉 (옛 backend)
      });

      const msgs = useExecutionStore.getState().conversationMessages;
      expect(msgs).toHaveLength(1);
      expect(msgs[0].type).toBe("user");
      expect(msgs[0].content).toBe("fallback msg");
    });
  });
});
