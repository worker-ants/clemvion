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

  // Carousel disabled stuck (Phase 3) — backend `findById` 가 Execution +
  // NodeExecution 을 별도 SELECT 로 읽어 race window 에서 inconsistent
  // snapshot (`Execution.status='running'` + `NodeExecution.status=
  // 'waiting_for_input'`) 이 도착할 수 있다. 그 경우 local state (이전 WS
  // waiting_for_input 이벤트로 set) 가 실제 backend 와 일치하므로 resume
  // 분기를 skip 해야 한다 — 그렇지 않으면 buttons UI 가 wipe 되어 disabled
  // stuck 회귀.
  it("inconsistent snapshot (status=running + NodeExecution=waiting_for_input) 시 waiting state 보존", () => {
    // 1) 먼저 WS waiting_for_input 이 set 한 것과 동일한 store 상태 시뮬레이션.
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "carousel-node",
      waitingInteractionType: "buttons",
      waitingButtonConfig: { buttons: [{ id: "btn", type: "port" }] },
    });

    // 2) Inconsistent snapshot 이 뒤늦게 도착 (race: snapshot's findById ran
    //    before engine's WAITING transaction committed for Execution row).
    applyExecutionSnapshot(
      createExec({
        status: "running", // ← stale (실제 backend 는 waiting_for_input)
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "waiting_for_input", // ← inconsistency: 한쪽은 running, 한쪽은 waiting
            startedAt: "2026-04-01T00:00:00Z",
            outputData: { config: {}, output: null, status: "waiting_for_input" },
          },
        ],
      }),
    );

    // 3) Local waiting state 가 보존돼야 한다 — wipe 시 Carousel 버튼 disabled
    //    stuck 회귀 (이 테스트가 그 회귀를 차단).
    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
  });

  it("legitimate resume (모든 노드 완료, prevStatus=waiting) 은 resumeFromButtons 로 진입", () => {
    // WS 단절 중 backend 에서 button 클릭이 이미 처리돼 resume 한 상태.
    // snapshot 도착 시 모든 노드 completed/running 이고 waiting NodeExecution
    // 이 없으므로 정상적으로 resume 처리되어야 한다.
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "carousel-node",
      waitingInteractionType: "buttons",
    });

    applyExecutionSnapshot(
      createExec({
        status: "running",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "completed", // ← 진짜 완료된 상태
            startedAt: "2026-04-01T00:00:00Z",
            durationMs: 100,
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().status).toBe("running");
    expect(useExecutionStore.getState().waitingNodeId).toBeNull();
    expect(useExecutionStore.getState().waitingInteractionType).toBeNull();
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

  // Inconsistent snapshot 양방향 reconciliation (Phase 1).
  // 이전 31209d37 의 단방향 defense 는 prevStatus='waiting_for_input' 일 때만
  // resume 차단. prevStatus='running' / 'pending' 에서 첫 snapshot 이
  // inconsistent (exec.running + node.waiting) 로 도착하면 waiting UI 가
  // hydration 되지 않아 'Running' 으로 stuck — 본 테스트가 reconciliation
  // 으로 정상 hydration 됨을 검증.
  it("inconsistent snapshot (prevStatus=running) 은 reconcile 로 waiting 진입", () => {
    useExecutionStore.setState({
      executionId: "exec-1",
      status: "running",
      waitingNodeId: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
    });

    applyExecutionSnapshot(
      createExec({
        status: "running", // stale: 실제 backend 는 waiting
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { items: [{ title: "Slide 1" }] },
              output: {},
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
          },
        ],
      }),
    );

    // reconcile 결과 — store.status 가 waiting 으로 격상되고 waiting hydration 됨.
    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
  });

  it("inconsistent snapshot (prevStatus=idle, 첫 진입) 도 reconcile 로 waiting 진입", () => {
    useExecutionStore.setState({
      executionId: null,
      status: "idle",
      waitingNodeId: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
    });

    applyExecutionSnapshot(
      createExec({
        status: "running", // stale
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: {},
              output: {},
              status: "waiting_for_input",
              meta: { interactionType: "buttons" },
            },
          },
        ],
      }),
    );

    // 'running + idle' 분기로 빠지지 않고 메인 waiting 분기에서 hydration.
    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
  });

  it("terminal status (completed) 는 reconcile 안 함 — node 가 stale 이라도", () => {
    useExecutionStore.setState({ status: "running" });

    applyExecutionSnapshot(
      createExec({
        status: "completed", // terminal
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            // 비정상 stale (terminal 후엔 waiting 일 수 없음)
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
          },
        ],
      }),
    );

    // terminal 은 reconcile 무시 — completeExecution 진입.
    expect(useExecutionStore.getState().status).toBe("completed");
    expect(useExecutionStore.getState().waitingNodeId).toBeNull();
  });
});
