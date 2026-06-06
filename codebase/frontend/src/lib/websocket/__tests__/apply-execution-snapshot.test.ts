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

  // ── Intra-row inconsistency (status 컬럼 vs outputData.status) ──────────────
  // Backend blocking 노드는 봉투(outputData.status='waiting_for_input')를 먼저
  // 저장하고 NodeExecution.status 컬럼은 'running' 으로 둔 뒤 waitForXxx 가 atomic
  // 전이한다. 그 사이 snapshot 은 같은 row 가 status='running' + outputData.status=
  // 'waiting_for_input'. ne.status 한 필드만 보던 기존 reconciliation 은 이 형태를
  // 놓쳐 waiting UI 를 wipe/누락했다 (turn-park 아키텍처 변경 후 재발한 회귀).
  it("intra-row inconsistent (ne.status=running + outputData.status=waiting) — prevStatus=waiting 시 waiting state 보존 (wipe 차단)", () => {
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "carousel-node",
      waitingInteractionType: "buttons",
      waitingButtonConfig: { buttons: [{ id: "btn", type: "port" }] },
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
            status: "running", // ← 컬럼은 running (pre-park window)
            startedAt: "2026-04-01T00:00:00Z",
            outputData: {
              config: {},
              output: {},
              status: "waiting_for_input", // ← 봉투만 waiting
              meta: { interactionType: "buttons" },
            },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
  });

  it("intra-row inconsistent (ne.status=running + outputData.status=waiting) — prevStatus=running 첫 진입도 reconcile 로 waiting 진입", () => {
    useExecutionStore.setState({
      executionId: "exec-1",
      status: "running",
      waitingNodeId: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
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
            status: "running",
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

    expect(useExecutionStore.getState().status).toBe("waiting_for_input");
    expect(useExecutionStore.getState().waitingNodeId).toBe("carousel-node");
    expect(useExecutionStore.getState().waitingInteractionType).toBe("buttons");
    // 노드 타임라인 배지도 waiting 으로 반영 (per-node status 매핑).
    expect(
      useExecutionStore.getState().nodeStatuses.get("carousel-node")?.status,
    ).toBe("waiting_for_input");
  });

  it("terminal(completed) row 의 stale outputData.status=waiting 는 waiting 으로 오인하지 않음", () => {
    useExecutionStore.setState({ status: "running" });

    applyExecutionSnapshot(
      createExec({
        status: "running",
        nodeExecutions: [
          {
            id: "ne-1",
            executionId: "exec-1",
            nodeId: "carousel-node",
            nodeType: "carousel",
            status: "completed", // 버튼 클릭 후 종결
            startedAt: "2026-04-01T00:00:00Z",
            durationMs: 100,
            outputData: { status: "waiting_for_input" }, // 봉투 잔존 문자열
          },
        ],
      }),
    );

    // reconcile 되지 않아야 — 종결 노드를 waiting 으로 되살리면 안 됨.
    expect(useExecutionStore.getState().status).toBe("running");
    expect(useExecutionStore.getState().waitingNodeId).toBeNull();
    expect(
      useExecutionStore.getState().nodeStatuses.get("carousel-node")?.status,
    ).toBe("completed");
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

// ─────────────────────────────────────────────────────────────────────────────
// ai_conversation 분기 — 페이지 재진입 시 store.conversationMessages 가 reset
// 된 상태에서 REST 폴링만으로도 대화 timeline 이 채워져야 한다. WS 경로
// (`use-execution-events.ts:handleWaitingForInput`) 와 동등한 hydration.
// 데이터는 backend AI Agent handler 가 `NodeExecution.outputData.output.result
// .messages` 에 영속화 (3가지 shape 모두 지원: structured / legacy nested /
// legacy flat).
// ─────────────────────────────────────────────────────────────────────────────
describe("applyExecutionSnapshot — ai_conversation REST 스냅샷 hydration", () => {
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

  function aiNodeExec(
    outputData: Record<string, unknown>,
    overrides: Partial<Record<string, unknown>> = {},
  ): Record<string, unknown> {
    return {
      id: "ne-ai-1",
      executionId: "exec-1",
      nodeId: "ai-agent-node",
      nodeType: "ai_agent",
      status: "waiting_for_input",
      startedAt: "2026-04-01T00:00:00Z",
      outputData,
      ...overrides,
    };
  }

  it("빈 store + structured envelope `{config, output:{result:{messages}}, meta}` → conversationMessages 시드 + waitingConversationConfig 매핑", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn", model: "test-model", maxTurns: 10 },
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
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.waitingNodeId).toBe("ai-agent-node");
    // handler config (mode/model/maxTurns) 와 output.result (turnCount/message)
    // 가 병합돼야 SummaryView 의 "단계 N / M" 카운터가 정상 동작한다.
    expect(state.waitingConversationConfig).toMatchObject({
      mode: "multi_turn",
      model: "test-model",
      maxTurns: 10,
      turnCount: 2,
      message: "현재 위치 기준으로 맑음입니다.",
    });
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

  it("재진입 시나리오 — 같은 waiting 노드 + 빈 conversationMessages → 영속 outputData 에서 재시드 (early return 이 안전망 차단하지 않아야 함)", () => {
    // SPA 페이지 이동 후 재진입: store 의 waitingNodeId 는 Zustand singleton
    // 으로 보존되지만 conversationMessages 는 어떤 race / clear 사유로 비어
    // 있을 수 있다. snapshot 의 영속 outputData (DB) 에는 모든 messages 가
    // 들어있으므로 안전망이 재시드해야 timeline 이 부활한다.
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "ai-agent-node",
      waitingInteractionType: "ai_conversation",
      waitingConversationConfig: { mode: "multi_turn", model: "test-model" },
      conversationMessages: [], // ← 비어있는 상태
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn", model: "test-model", maxTurns: 10 },
            output: {
              result: {
                messages: [
                  { role: "user", content: "재진입 전 메시지 1" },
                  { role: "assistant", content: "재진입 전 응답 1" },
                  { role: "user", content: "재진입 전 메시지 2" },
                  { role: "assistant", content: "재진입 전 응답 2" },
                ],
                message: "재진입 전 응답 2",
                turnCount: 2,
                maxTurns: 10,
              },
            },
            status: "waiting_for_input",
            meta: { interactionType: "ai_conversation" },
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(4);
    expect(state.conversationMessages[0]?.content).toBe("재진입 전 메시지 1");
    expect(state.conversationMessages[3]?.content).toBe("재진입 전 응답 2");
  });

  it("재진입 시나리오 — 같은 waiting 노드 + store 에 메시지 보존 → 덮어쓰지 않음", () => {
    // 정상 SPA 재진입: store 가 메시지를 유지한 채 재구독. snapshot 이 안전망
    // 재시드를 호출하지만 store 비어있지 않으므로 no-op (선택 인덱스 등 UI
    // state 보호).
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "ai-agent-node",
      waitingInteractionType: "ai_conversation",
      conversationMessages: [
        { type: "user", content: "기존 메시지 A", turnIndex: 1 },
        { type: "assistant", content: "기존 응답 A", turnIndex: 1 },
      ],
      selectedConversationItemIndex: 1,
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn" },
            output: {
              result: {
                messages: [
                  { role: "user", content: "snapshot 메시지" },
                  { role: "assistant", content: "snapshot 응답" },
                ],
                message: "snapshot 응답",
                turnCount: 1,
                maxTurns: 10,
              },
            },
            status: "waiting_for_input",
            meta: { interactionType: "ai_conversation" },
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    // 기존 메시지 보존 + 선택 인덱스 보존
    expect(state.conversationMessages).toHaveLength(2);
    expect(state.conversationMessages[0]?.content).toBe("기존 메시지 A");
    expect(state.selectedConversationItemIndex).toBe(1);
  });

  it("재진입 시나리오 — form 노드는 early return 후 conversationMessages 재시드 안 함 (AI 분기 한정 안전망)", () => {
    // ai_conversation 이외의 interactionType (form/buttons) 은 외부에서
    // conversationMessages 가 의도적으로 비어있을 수 있으므로 안전망이
    // 작동하지 않아야 한다.
    useExecutionStore.setState({
      status: "waiting_for_input",
      waitingNodeId: "form-node",
      waitingInteractionType: "form",
      conversationMessages: [],
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          {
            id: "ne-form",
            executionId: "exec-1",
            nodeId: "form-node",
            nodeType: "form",
            status: "waiting_for_input",
            startedAt: "2026-04-01T00:00:00Z",
            // 비현실적이지만 가드 검증을 위해 messages 가 들어있는 outputData
            // 를 흘려보내도 ai_conversation 가드가 작동해 시드 차단.
            outputData: {
              config: { fields: [] },
              output: { result: { messages: [{ role: "user", content: "x" }] } },
              status: "waiting_for_input",
            },
          },
        ],
      }),
    );

    expect(useExecutionStore.getState().conversationMessages).toHaveLength(0);
  });

  it("legacy nested shape `{config, output:{messages}}` (result wrapper 없음) → 시드", () => {
    // Stage-5 이전 ai_agent / 다른 ai 노드가 남긴 envelope. parseHistoryMessages
    // 가 wrapper.messages 도 처리하므로 동일 경로로 hydrate 되어야 한다.
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn" },
            output: {
              messages: [
                { role: "user", content: "Q-legacy-nested" },
                { role: "assistant", content: "A-legacy-nested" },
              ],
              message: "A-legacy-nested",
              turnCount: 1,
              maxTurns: 10,
            },
            status: "waiting_for_input",
            meta: { interactionType: "ai_conversation" },
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(2);
    expect(state.conversationMessages[0]?.content).toBe("Q-legacy-nested");
    expect(state.conversationMessages[1]?.content).toBe("A-legacy-nested");
  });

  it("legacy flat shape `{messages, ...}` (envelope wrapper 없음) → 시드", () => {
    // 매우 오래된 영속 데이터. structured envelope 도입 전 outputData 가
    // raw 평면 객체로 저장된 케이스. parseHistoryMessages 가 raw.messages
    // 를 그대로 읽고, interactionType 은 nodeType 으로 fallback 추론.
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            messages: [
              { role: "user", content: "Q-flat" },
              { role: "assistant", content: "A-flat" },
            ],
            message: "A-flat",
            turnCount: 1,
            maxTurns: 10,
            status: "waiting_for_input",
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.conversationMessages).toHaveLength(2);
    expect(state.conversationMessages[0]?.content).toBe("Q-flat");
    expect(state.conversationMessages[1]?.content).toBe("A-flat");
  });

  it("information_extractor 노드 타입도 ai_conversation 분기로 hydrate", () => {
    // inferInteractionTypeFromNodeType 가 information_extractor → ai_conversation
    // 으로 추론하므로 같은 경로로 시드되어야 한다.
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec(
            {
              config: { mode: "multi_turn" },
              output: {
                result: {
                  messages: [
                    { role: "user", content: "추출 대상" },
                    { role: "assistant", content: "추출 결과" },
                  ],
                  message: "추출 결과",
                  turnCount: 1,
                  maxTurns: 10,
                },
              },
              status: "waiting_for_input",
              // meta.interactionType 누락 → nodeType 으로 fallback 추론
            },
            { nodeType: "information_extractor", nodeId: "ie-node" },
          ),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.waitingNodeId).toBe("ie-node");
    expect(state.conversationMessages).toHaveLength(2);
  });

  it("store 가 이미 메시지를 갖고 있으면 덮어쓰지 않음 (WS 가 먼저 채운 timeline 보호)", () => {
    useExecutionStore.setState({
      conversationMessages: [
        { type: "user", content: "기존 메시지", turnIndex: 1 },
      ],
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
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
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(1);
    expect(state.conversationMessages[0]?.content).toBe("기존 메시지");
  });

  it("meta.turnDebug → assistant 메시지에 model / usage / durationMs attach", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn", model: "test-model" },
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
                      requestPayload: { model: "test-model", messages: [] },
                      responsePayload: {
                        model: "test-model-resolved",
                        usage: { inputTokens: 10, outputTokens: 5 },
                      },
                      durationMs: 420,
                    },
                  ],
                },
              ],
            },
          }),
        ],
      }),
    );

    const assistant = useExecutionStore.getState().conversationMessages[1];
    expect(assistant?.type).toBe("assistant");
    expect(assistant?.metadata?.model).toBe("test-model-resolved");
    expect(assistant?.metadata?.inputTokens).toBe(10);
    expect(assistant?.metadata?.outputTokens).toBe(5);
    expect(assistant?.durationMs).toBe(420);
  });

  it("turnDebug 복수 turn — 각 assistant 메시지가 같은 turnIndex 의 llmCalls 와 매핑", () => {
    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn", model: "test-model" },
            output: {
              result: {
                messages: [
                  { role: "user", content: "Q1" },
                  { role: "assistant", content: "A1" },
                  { role: "user", content: "Q2" },
                  { role: "assistant", content: "A2" },
                ],
                message: "A2",
                turnCount: 2,
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
                      responsePayload: { model: "test-model", usage: { inputTokens: 5, outputTokens: 3 } },
                      durationMs: 100,
                    },
                  ],
                },
                {
                  turnIndex: 2,
                  llmCalls: [
                    {
                      responsePayload: { model: "test-model", usage: { inputTokens: 8, outputTokens: 4 } },
                      durationMs: 200,
                    },
                  ],
                },
              ],
            },
          }),
        ],
      }),
    );

    const items = useExecutionStore.getState().conversationMessages;
    expect(items).toHaveLength(4);
    const turn1Assistant = items[1];
    const turn2Assistant = items[3];
    expect(turn1Assistant?.durationMs).toBe(100);
    expect(turn1Assistant?.metadata?.outputTokens).toBe(3);
    expect(turn2Assistant?.durationMs).toBe(200);
    expect(turn2Assistant?.metadata?.outputTokens).toBe(4);
  });

  it("inconsistent snapshot (status=running + ai_agent waiting) — reconcile 후 hydration", () => {
    // Phase 1 reconcile (status=running + 노드는 waiting) 분기에서도 ai_conversation
    // 메시지가 정상 시드되어야 한다. ai_agent 노드의 inconsistent snapshot 케이스.
    useExecutionStore.setState({
      status: "running",
      waitingNodeId: null,
      waitingInteractionType: null,
    });

    applyExecutionSnapshot(
      createExec({
        status: "running", // stale — 실제 backend 는 waiting
        nodeExecutions: [
          aiNodeExec({
            config: { mode: "multi_turn" },
            output: {
              result: {
                messages: [
                  { role: "user", content: "재진입 메시지" },
                  { role: "assistant", content: "응답" },
                ],
                message: "응답",
                turnCount: 1,
                maxTurns: 10,
              },
            },
            status: "waiting_for_input",
            meta: { interactionType: "ai_conversation" },
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    expect(state.status).toBe("waiting_for_input");
    expect(state.waitingInteractionType).toBe("ai_conversation");
    expect(state.conversationMessages).toHaveLength(2);
  });

  it("messages 가 비어있을 때 — store 의 selectedConversationItemIndex 가 영향받지 않음", () => {
    // setConversationMessages 는 호출 시 selectedConversationItemIndex 를 reset
    // 할 수 있다 (배열 길이로 clamp). 빈 messages 면 setConversationMessages 가
    // 아예 호출되지 않아야 한다 — 그렇지 않으면 user 의 메시지 선택이 wipe.
    useExecutionStore.setState({
      conversationMessages: [
        { type: "user", content: "기존", turnIndex: 1 },
        { type: "assistant", content: "기존 응답", turnIndex: 1 },
      ],
      selectedConversationItemIndex: 1,
    });

    applyExecutionSnapshot(
      createExec({
        status: "waiting_for_input",
        nodeExecutions: [
          aiNodeExec({
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
          }),
        ],
      }),
    );

    const state = useExecutionStore.getState();
    // store 는 이미 메시지가 있어 덮어쓰지 않음. 그리고 빈 messages 인 경우엔
    // 어차피 setConversationMessages 가 호출되지 않으므로 selectedIndex 보존.
    expect(state.conversationMessages).toHaveLength(2);
    expect(state.selectedConversationItemIndex).toBe(1);
  });
});
