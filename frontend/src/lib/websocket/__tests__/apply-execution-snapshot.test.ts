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
      conversationMessages: [],
      selectedConversationItemIndex: null,
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

  // ai_conversation 재진입 hydration — multi-turn AI Agent 가 waiting 인 상태에서
  // 사용자가 다른 페이지로 이동했다가 돌아왔을 때, WS 이벤트가 도착하기 전 REST
  // 스냅샷만으로도 store.conversationMessages 가 채워져야 빈 채팅 화면 회귀가
  // 발생하지 않는다. WS 경로(`use-execution-events.ts:handleWaitingForInput`)
  // 와 동등한 hydration 을 REST 경로에도 갖춘다.
  it("ai_conversation waiting REST 스냅샷 — 빈 store 일 때 outputData.output.result.messages 로 hydrate", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-ai-1",
            executionId: "exec-1",
            nodeId: "ai-agent-node",
            nodeType: "ai_agent",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { mode: "multi_turn", model: "gpt-4o", maxTurns: 10 },
              output: {
                result: {
                  messages: [
                    { role: "user", content: "안녕" },
                    { role: "assistant", content: "안녕하세요! 무엇을 도와드릴까요?" },
                    { role: "user", content: "오늘 날씨 알려줘" },
                    { role: "assistant", content: "현재 위치 기준으로 맑음입니다." },
                  ],
                  message: "현재 위치 기준으로 맑음입니다.",
                  turnCount: 2,
                  maxTurns: 10,
                },
              },
              status: "waiting_for_input",
              meta: { interactionType: "ai_conversation" },
            },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.waitingNodeId).toBe("ai-agent-node");
    expect(state.conversationMessages).toHaveLength(4);
    expect(state.conversationMessages[0]).toMatchObject({
      type: "user",
      content: "안녕",
      turnIndex: 1,
    });
    expect(state.conversationMessages[3]).toMatchObject({
      type: "assistant",
      content: "현재 위치 기준으로 맑음입니다.",
      turnIndex: 2,
    });
  });

  it("ai_conversation waiting REST 스냅샷 — store 가 이미 메시지를 갖고 있으면 덮어쓰지 않음 (재발신 보호)", () => {
    // WS 이벤트가 먼저 도착해 store 를 채운 상황. 뒤이은 REST 폴링이 도착해도
    // 중복으로 다시 시드해서는 안 된다 (use-execution-events.ts:233-269 패턴).
    useExecutionStore.setState({
      conversationMessages: [
        { type: "user", content: "기존 메시지", turnIndex: 1 },
      ],
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-ai-1",
            executionId: "exec-1",
            nodeId: "ai-agent-node",
            nodeType: "ai_agent",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { mode: "multi_turn" },
              output: {
                result: {
                  messages: [
                    { role: "user", content: "재발신된 메시지" },
                    { role: "assistant", content: "응답" },
                  ],
                  message: "응답",
                  turnCount: 1,
                  maxTurns: 10,
                },
              },
              status: "waiting_for_input",
              meta: { interactionType: "ai_conversation" },
            },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(1);
    expect(state.conversationMessages[0]?.content).toBe("기존 메시지");
  });

  it("ai_conversation waiting REST 스냅샷 — meta.turnDebug 로 assistant 메시지의 model 정보가 attach 됨", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-ai-1",
            executionId: "exec-1",
            nodeId: "ai-agent-node",
            nodeType: "ai_agent",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { mode: "multi_turn", model: "gpt-4o" },
              output: {
                result: {
                  messages: [
                    { role: "user", content: "Q" },
                    { role: "assistant", content: "A" },
                  ],
                  message: "A",
                  turnCount: 1,
                  maxTurns: 10,
                },
              },
              status: "waiting_for_input",
              meta: {
                interactionType: "ai_conversation",
                turnDebug: [
                  {
                    turnIndex: 1,
                    llmCalls: [
                      {
                        requestPayload: { model: "gpt-4o", messages: [] },
                        responsePayload: {
                          model: "gpt-4o-2024-08-06",
                          usage: { inputTokens: 10, outputTokens: 5 },
                        },
                        durationMs: 420,
                      },
                    ],
                  },
                ],
              },
            },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(2);
    const assistant = state.conversationMessages[1];
    expect(assistant?.type).toBe("assistant");
    expect(assistant?.metadata?.model).toBe("gpt-4o-2024-08-06");
    expect(assistant?.metadata?.inputTokens).toBe(10);
    expect(assistant?.metadata?.outputTokens).toBe(5);
    expect(assistant?.durationMs).toBe(420);
  });

  it("ai_conversation waiting REST 스냅샷 — messages 가 비어있으면 setConversationMessages 호출 안 함", () => {
    // 첫 진입 직전 (messages 가 아직 빈 배열) 인 케이스. 빈 배열로 시드하면
    // 이후 도착하는 WS ai_message 이벤트가 정상 append 되지만, 빈 배열로 set
    // 자체는 의미가 없다 — 그러나 setConversationMessages 가 호출되면
    // selectedConversationItemIndex 가 reset 될 수 있으니 보호한다.
    useExecutionStore.setState({
      selectedConversationItemIndex: 3,
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-ai-1",
            executionId: "exec-1",
            nodeId: "ai-agent-node",
            nodeType: "ai_agent",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: { mode: "multi_turn" },
              output: {
                result: {
                  messages: [],
                  message: "",
                  turnCount: 0,
                  maxTurns: 10,
                },
              },
              status: "waiting_for_input",
              meta: { interactionType: "ai_conversation" },
            },
          },
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.conversationMessages).toEqual([]);
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
