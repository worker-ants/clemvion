import { describe, it, expect, beforeEach, vi } from "vitest";
import { applyExecutionSnapshot } from "../apply-execution-snapshot";
import { useExecutionStore } from "../../stores/execution-store";

vi.mock("../../node-definitions", () => ({
  getNodeDefinition: (type: string) => {
    const defs: Record<string, { category: string }> = {
      carousel: { category: "presentation" },
      form: { category: "presentation" },
      ai_agent: { category: "ai" },
      manual_trigger: { category: "trigger" },
    };
    return defs[type] ?? { category: "unknown" };
  },
}));

function createExec(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
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

describe("applyExecutionSnapshot — REST → store bridge (Carousel disabled stuck fix)", () => {
  beforeEach(() => {
    useExecutionStore.setState({
      executionId: "exec-1",
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: "2026-04-01T00:00:00Z",
      waitingNodeId: null,
      waitingFormConfig: null,
      waitingButtonConfig: null,
      waitingConversationConfig: null,
      waitingInteractionType: null,
      selectedResultNodeId: null,
    });
  });

  it("WS 미연결 시 REST 만으로 carousel buttons 분기 hydrate (가장 흔한 시나리오)", () => {
    // Backend 가 nodeExecutions[].node 를 nest 하지 않고 row 자체에 nodeType
    // 만 있는 경우. WS 가 죽었어도 page.tsx 의 useEffect 에서 직접 호출되는
    // applyExecutionSnapshot 이 store 에 hydrate 해야 한다.
    const btnConfig = {
      buttons: [
        { id: "btn_logic", type: "port", label: "Logic 노드 테스트" },
        { id: "btn_ai", type: "port", label: "AI 노드 테스트" },
      ],
    };
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel", // node 객체 누락 시 row 의 nodeType 만으로 추론
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
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
  });

  it("isCancelled callback 이 true 반환 시 store 갱신 skip", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { buttons: [] },
              output: null,
            },
          },
        ],
      }),
      () => true, // cancelled
    );

    expect(useExecutionStore.getState().waitingInteractionType).toBeNull();
    expect(useExecutionStore.getState().waitingNodeId).toBeNull();
  });

  it("undefined / null execution 은 no-op", () => {
    applyExecutionSnapshot(undefined);
    applyExecutionSnapshot(null);
    expect(useExecutionStore.getState().waitingInteractionType).toBeNull();
  });

  it("execution.status === 'completed' 시 completeExecution 호출", () => {
    applyExecutionSnapshot(createExec({ status: "completed" }));
    expect(useExecutionStore.getState().status).toBe("completed");
  });

  it("execution.status === 'failed' + error 메시지 → failExecution", () => {
    applyExecutionSnapshot(
      createExec({
        status: "failed",
        error: { message: "Test failure" },
      }),
    );
    expect(useExecutionStore.getState().status).toBe("failed");
  });

  it("동일 nodeId 의 다중 iteration row 는 모두 nodeResults 에 보존", () => {
    applyExecutionSnapshot(
      createExec({
        status: "running",
        nodeExecutions: [
          {
            id: "ne-iter-1",
            executionId: "exec-1",
            nodeId: "loop-body",
            nodeType: "test_node",
            status: "completed",
            startedAt: "2026-04-01T00:00:00Z",
            durationMs: 10,
          },
          {
            id: "ne-iter-2",
            executionId: "exec-1",
            nodeId: "loop-body",
            nodeType: "test_node",
            status: "completed",
            startedAt: "2026-04-01T00:00:01Z",
            durationMs: 12,
          },
        ],
      }),
    );

    const results = useExecutionStore.getState().nodeResults;
    expect(results).toHaveLength(2);
    expect(results.map((r) => r.nodeExecutionId)).toEqual([
      "ne-iter-1",
      "ne-iter-2",
    ]);
  });
});
