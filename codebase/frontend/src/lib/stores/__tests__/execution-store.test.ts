import { describe, it, expect, beforeEach } from "vitest";
import { useExecutionStore } from "../execution-store";
import type { NodeResult, NodeStatusInfo } from "../execution-store";

function makeResult(overrides: Partial<NodeResult> = {}): NodeResult {
  return {
    nodeId: "n1",
    nodeLabel: "Node 1",
    nodeType: "action",
    nodeCategory: "logic",
    status: "completed",
    outputData: null,
    ...overrides,
  };
}

const initialState = {
  executionId: null,
  status: "idle" as const,
  nodeStatuses: new Map(),
  nodeResults: [],
  startedAt: null,
  waitingNodeId: null,
  waitingFormConfig: null,
  selectedResultNodeId: null,
  conversationMessages: [],
  selectedConversationItemIndex: null,
};

describe("useExecutionStore", () => {
  beforeEach(() => {
    useExecutionStore.setState(initialState);
  });

  it("has correct initial state", () => {
    const state = useExecutionStore.getState();
    expect(state.executionId).toBeNull();
    expect(state.status).toBe("idle");
    expect(state.nodeStatuses.size).toBe(0);
    expect(state.nodeResults).toEqual([]);
    expect(state.startedAt).toBeNull();
    expect(state.waitingNodeId).toBeNull();
    expect(state.waitingFormConfig).toBeNull();
    expect(state.selectedResultNodeId).toBeNull();
  });

  describe("startExecution", () => {
    it("sets executionId, status, and startedAt", () => {
      useExecutionStore.getState().startExecution("exec-1");

      const state = useExecutionStore.getState();
      expect(state.executionId).toBe("exec-1");
      expect(state.status).toBe("running");
      expect(state.startedAt).toBeTruthy();
      expect(state.nodeStatuses.size).toBe(0);
      expect(state.nodeResults).toEqual([]);
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
      expect(state.selectedResultNodeId).toBeNull();
    });

    it("resets previous results when starting new execution", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ outputData: { foo: "bar" } }));
      expect(useExecutionStore.getState().nodeResults).toHaveLength(1);

      useExecutionStore.getState().startExecution("exec-2");
      expect(useExecutionStore.getState().nodeResults).toEqual([]);
    });

    // spec/conventions/conversation-thread.md §9.7.1 — startExecution 은 conversation
    // snapshot 묶음까지 클리어한다 (completeExecution / failExecution 과 다른 정책)
    it("clears conversationMessages on new execution (only lifecycle that resets it)", () => {
      useExecutionStore.getState().setConversationMessages([
        { type: "user", content: "previous run", turnIndex: 1 },
      ]);
      expect(useExecutionStore.getState().conversationMessages).toHaveLength(1);

      useExecutionStore.getState().startExecution("exec-2");
      expect(useExecutionStore.getState().conversationMessages).toEqual([]);
    });
  });

  describe("updateNodeStatus", () => {
    it("sets status for a node", () => {
      const info: NodeStatusInfo = { status: "running" };
      useExecutionStore.getState().updateNodeStatus("node-1", info);

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")).toEqual(info);
    });

    it("updates existing node status", () => {
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "running" });
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "completed", duration: 150 });

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")?.status).toBe("completed");
      expect(statuses.get("node-1")?.duration).toBe(150);
    });

    it("tracks multiple nodes independently", () => {
      useExecutionStore.getState().updateNodeStatus("node-1", { status: "completed" });
      useExecutionStore.getState().updateNodeStatus("node-2", { status: "running" });

      const statuses = useExecutionStore.getState().nodeStatuses;
      expect(statuses.get("node-1")?.status).toBe("completed");
      expect(statuses.get("node-2")?.status).toBe("running");
    });
  });

  describe("addNodeResult", () => {
    it("adds a result to the list", () => {
      const result = makeResult({ outputData: { data: "test" } });
      useExecutionStore.getState().addNodeResult(result);

      expect(useExecutionStore.getState().nodeResults).toHaveLength(1);
      expect(useExecutionStore.getState().nodeResults[0]).toEqual(result);
    });

    it("appends multiple results", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeLabel: "A" }));
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n2", nodeLabel: "B" }));

      expect(useExecutionStore.getState().nodeResults).toHaveLength(2);
    });

    it("updates existing result for same nodeId instead of duplicating", () => {
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeType: "table", outputData: { v: 1 } }));
      useExecutionStore.getState().addNodeResult(makeResult({ nodeId: "n1", nodeType: "table", outputData: { v: 2 } }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].outputData).toEqual({ v: 2 });
    });

    it("preserves inputData when merging with a result that lacks it", () => {
      // First result from polling includes inputData
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        outputData: { v: 1 },
        inputData: { key: "value" },
      }));

      // Second result from WS event lacks inputData
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        outputData: { v: 2 },
      }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results).toHaveLength(1);
      expect(results[0].outputData).toEqual({ v: 2 });
      expect(results[0].inputData).toEqual({ key: "value" });
    });

    it("updates inputData when new result provides it", () => {
      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        inputData: { old: true },
      }));

      useExecutionStore.getState().addNodeResult(makeResult({
        nodeId: "n1",
        inputData: { new: true },
      }));

      const results = useExecutionStore.getState().nodeResults;
      expect(results[0].inputData).toEqual({ new: true });
    });

    it("preserves parentNodeExecutionId when a later update omits it", () => {
      // NODE_STARTED carries the parent link; later NODE_COMPLETED / waiting
      // events may omit it. Collapsing the link back to undefined would pop
      // the node out of its Sub-Workflow card.
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "child-1",
          nodeId: "n1",
          parentNodeExecutionId: "workflow-node-1",
        }),
      );
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "child-1",
          nodeId: "n1",
          status: "completed",
        }),
      );
      const results = useExecutionStore.getState().nodeResults;
      expect(results[0].parentNodeExecutionId).toBe("workflow-node-1");
    });

    it("overwrites parentNodeExecutionId when a newer event provides one", () => {
      useExecutionStore.getState().addNodeResult(
        makeResult({ nodeExecutionId: "child-1", nodeId: "n1" }),
      );
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "child-1",
          nodeId: "n1",
          parentNodeExecutionId: "workflow-node-1",
        }),
      );
      const results = useExecutionStore.getState().nodeResults;
      expect(results[0].parentNodeExecutionId).toBe("workflow-node-1");
    });

    // Timeline-ordering 회귀 (워크플로 첫 노드의 NODE_STARTED 가 ws subscribe
    // 완료 전 emit 되어 손실되고, 사용자 입력 대기 중 EXECUTION_WAITING_FOR_INPUT
    // 이 첫 도달 이벤트가 되는 race window 시나리오. 이전에는 startedAt 이
    // undefined 인 row 가 timeline 마지막으로 정렬됐다).
    it("ranks waiting-only result with startedAt before later-arriving rows", () => {
      // 카테고리 선택 (첫 노드) — NODE_STARTED 놓침, waiting payload 가 첫 이벤트.
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "n1-ne",
          nodeId: "n1",
          status: "waiting_for_input",
          startedAt: "2026-05-08T15:28:53.487Z",
        }),
      );
      // 사용자 클릭 후 도달한 후속 노드들.
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "n2-ne",
          nodeId: "n2",
          startedAt: "2026-05-08T15:28:54.834Z",
        }),
      );
      useExecutionStore.getState().addNodeResult(
        makeResult({
          nodeExecutionId: "n3-ne",
          nodeId: "n3",
          startedAt: "2026-05-08T15:28:55.615Z",
        }),
      );
      const ids = useExecutionStore
        .getState()
        .nodeResults.map((r) => r.nodeId);
      expect(ids).toEqual(["n1", "n2", "n3"]);
    });

    it("waiting-only result without startedAt sinks to the timeline end (defensive sort)", () => {
      // backend startedAt 동봉 누락 시나리오 (구버전 호환). undefined startedAt
      // 은 sortByStartedAt 정의상 마지막으로. 본 PR fix 가 적용된 backend 는
      // 항상 startedAt 을 동봉하므로 production 에서는 발생하지 않으나
      // store 정렬의 defensive 동작을 보장.
      useExecutionStore.getState().addNodeResult(
        makeResult({ nodeId: "n1", status: "waiting_for_input" }),
      );
      useExecutionStore.getState().addNodeResult(
        makeResult({ nodeId: "n2", startedAt: "2026-05-08T15:28:54.000Z" }),
      );
      const ids = useExecutionStore
        .getState()
        .nodeResults.map((r) => r.nodeId);
      expect(ids).toEqual(["n2", "n1"]);
    });
  });

  describe("completeExecution", () => {
    it("sets status to completed and clears waiting state", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().completeExecution();

      const state = useExecutionStore.getState();
      expect(state.status).toBe("completed");
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
    });

    // spec/conventions/conversation-thread.md §9.7.1 store reset 정책 + Inv-6
    it("preserves conversationMessages when execution completes", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForConversation("ai-node", {});
      useExecutionStore.getState().setConversationMessages([
        { type: "user", content: "hi", turnIndex: 1 },
        { type: "assistant", content: "hello", turnIndex: 1 },
      ]);
      useExecutionStore.getState().completeExecution();

      const state = useExecutionStore.getState();
      expect(state.status).toBe("completed");
      expect(state.waitingNodeId).toBeNull();
      // conversation snapshot 은 보존된다 (§9.7.1 store reset 정책)
      expect(state.conversationMessages).toHaveLength(2);
      expect(state.conversationMessages[0].content).toBe("hi");
    });
  });

  describe("failExecution", () => {
    it("sets status to failed", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().failExecution();
      expect(useExecutionStore.getState().status).toBe("failed");
    });

    it("stores error on __execution__ key when error provided with executionId", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().failExecution("Something went wrong");

      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
      expect(state.nodeStatuses.get("__execution__")).toEqual({
        status: "failed",
        error: "Something went wrong",
      });
    });

    it("clears waiting state on failure", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().failExecution("Error");

      const state = useExecutionStore.getState();
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
    });

    // spec/conventions/conversation-thread.md §9.7.1 + §9.9 Inv-6
    // 사용자 보고 (2026-05-23) — Gemini 429 quota 시 multi-turn 대화 전체 소실 회귀 방어
    it("preserves conversationMessages when execution fails (Inv-6)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForConversation("ai-node", {});
      useExecutionStore.getState().setConversationMessages([
        { type: "user", content: "환불 문의입니다", turnIndex: 1 },
        { type: "assistant", content: "주문번호를 알려주세요", turnIndex: 1 },
        { type: "user", content: "ORD-12345", turnIndex: 2 },
      ]);
      useExecutionStore.getState().failExecution("Gemini 429 quota");

      const state = useExecutionStore.getState();
      expect(state.status).toBe("failed");
      expect(state.waitingNodeId).toBeNull();
      // conversation snapshot 은 보존된다 (Inv-6: 노드/실행 실패 시 store 비워지지 않음)
      expect(state.conversationMessages).toHaveLength(3);
      expect(state.conversationMessages[2].content).toBe("ORD-12345");
    });
  });

  describe("pauseForForm / resumeFromForm", () => {
    it("transitions to waiting_for_input with form config", () => {
      useExecutionStore.getState().startExecution("exec-1");
      const formConfig = {
        fields: [{ name: "approved", type: "checkbox", label: "Approved" }],
        title: "Approval",
      };
      useExecutionStore.getState().pauseForForm("node-form", formConfig);

      const state = useExecutionStore.getState();
      expect(state.status).toBe("waiting_for_input");
      expect(state.waitingNodeId).toBe("node-form");
      expect(state.waitingFormConfig).toEqual(formConfig);
    });

    it("resumes to running state and clears waiting info", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().resumeFromForm();

      const state = useExecutionStore.getState();
      expect(state.status).toBe("running");
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
    });
  });

  // spec/conventions/conversation-thread.md §9.7.1 + §9.9 Inv-7 — AI Agent
  // render_form 활성 form 제출 후 multi-turn 컨텍스트 보존 invariant.
  describe("resumeFromAiRenderForm — multi-turn 컨텍스트 보존 (Inv-7)", () => {
    it("pendingFormToolCall 만 null patch 하고 waitingNodeId / waitingInteractionType / isWaitingAiResponse 는 보존한다", () => {
      useExecutionStore.getState().startExecution("exec-1");
      // simulate ai_form_render waiting state — 모든 pre-condition 을 setState 로
      // 직접 주입해 pauseForConversation 구현 변경에 대한 간접 의존을 제거한다
      // (W-11: waitingNodeId 도 명시적으로 set).
      useExecutionStore.setState({
        waitingNodeId: "node-ai",
        waitingInteractionType: "ai_form_render",
        waitingConversationConfig: {
          message: "...",
          pendingFormToolCall: {
            toolCallId: "call_form_1",
            formConfig: { fields: [] },
          },
        },
        isWaitingAiResponse: true,
        status: "waiting_for_input",
      });

      useExecutionStore.getState().resumeFromAiRenderForm();

      const state = useExecutionStore.getState();
      // multi-turn 컨텍스트 보존
      expect(state.waitingNodeId).toBe("node-ai");
      expect(state.waitingInteractionType).toBe("ai_form_render");
      expect(state.isWaitingAiResponse).toBe(true);
      // pendingFormToolCall 만 null
      const conv = state.waitingConversationConfig as {
        message?: string;
        pendingFormToolCall: unknown;
      };
      expect(conv.pendingFormToolCall).toBeNull();
      // 다른 conversationConfig 필드 보존
      expect(conv.message).toBe("...");
      // spec/conventions/conversation-thread.md §9.7.1 — status 는
      // 'waiting_for_input' 유지 (multi-turn 대화 한복판, AI 응답 대기 중).
      // 옛 'running' 변경은 REST 폴링의 transient phase 가 store wipe 를
      // 트리거하던 회귀의 root cause (2026-05-23 사용자 보고).
      expect(state.status).toBe("waiting_for_input");
    });

    it("waitingConversationConfig 가 null 인 경우 안전하게 no-op (status 변경 없음)", () => {
      useExecutionStore.getState().startExecution("exec-1");
      // pre-condition: waitingConversationConfig 가 null 인 (비정상이지만
      // 방어적) 상태 — set 으로 직접 진입. status 는 startExecution 의
      // 'running' 으로 들어옴.
      useExecutionStore.setState({
        waitingConversationConfig: null,
      });

      useExecutionStore.getState().resumeFromAiRenderForm();

      const state = useExecutionStore.getState();
      expect(state.waitingConversationConfig).toBeNull();
      // status 는 startExecution 이 set 한 'running' 그대로 — action 이
      // status 를 건드리지 않는다 (spec §9.7.1).
      expect(state.status).toBe("running");
    });
  });

  describe("selectResultNode", () => {
    it("selects and deselects a result node", () => {
      useExecutionStore.getState().selectResultNode("n1");
      expect(useExecutionStore.getState().selectedResultNodeId).toBe("n1");

      useExecutionStore.getState().selectResultNode(null);
      expect(useExecutionStore.getState().selectedResultNodeId).toBeNull();
    });
  });

  describe("reset", () => {
    it("resets all state to initial values including waiting state", () => {
      useExecutionStore.getState().startExecution("exec-1");
      useExecutionStore.getState().updateNodeStatus("n1", { status: "running" });
      useExecutionStore.getState().addNodeResult(makeResult());
      useExecutionStore.getState().pauseForForm("node-form", { fields: [] });
      useExecutionStore.getState().selectResultNode("n1");

      useExecutionStore.getState().reset();

      const state = useExecutionStore.getState();
      expect(state.executionId).toBeNull();
      expect(state.status).toBe("idle");
      expect(state.nodeStatuses.size).toBe(0);
      expect(state.nodeResults).toEqual([]);
      expect(state.startedAt).toBeNull();
      expect(state.waitingNodeId).toBeNull();
      expect(state.waitingFormConfig).toBeNull();
      expect(state.selectedResultNodeId).toBeNull();
    });
  });

  describe("conversation message tool actions", () => {
    it("setConversationMessages replaces the array", () => {
      useExecutionStore.getState().addConversationMessage({
        type: "user",
        content: "old",
        turnIndex: 1,
      });
      useExecutionStore.getState().setConversationMessages([
        { type: "user", content: "new1", turnIndex: 1 },
        { type: "assistant", content: "new2", turnIndex: 1 },
      ]);
      expect(useExecutionStore.getState().conversationMessages).toHaveLength(2);
      expect(
        useExecutionStore.getState().conversationMessages[0].content,
      ).toBe("new1");
    });

    it("upsertToolItem appends a new tool item when toolCallId is unseen", () => {
      useExecutionStore.getState().upsertToolItem({
        type: "tool",
        content: "kb_search",
        turnIndex: 1,
        toolCallId: "call_1",
        toolStatus: "pending",
      });
      const items = useExecutionStore.getState().conversationMessages;
      expect(items).toHaveLength(1);
      expect(items[0].toolCallId).toBe("call_1");
    });

    it("upsertToolItem is idempotent for the same toolCallId", () => {
      const item = {
        type: "tool" as const,
        content: "kb_search",
        turnIndex: 1,
        toolCallId: "call_1",
        toolStatus: "pending" as const,
      };
      useExecutionStore.getState().upsertToolItem(item);
      useExecutionStore.getState().upsertToolItem(item);
      expect(useExecutionStore.getState().conversationMessages).toHaveLength(1);
    });

    it("updateToolItem patches the matching tool item by toolCallId", () => {
      useExecutionStore.getState().upsertToolItem({
        type: "tool",
        content: "kb_search",
        turnIndex: 1,
        toolCallId: "call_1",
        toolStatus: "pending",
      });
      useExecutionStore.getState().updateToolItem("call_1", {
        toolStatus: "success",
        durationMs: 42,
        toolResult: { ok: 1 },
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

    it("updateToolItem is a no-op when no item matches the toolCallId", () => {
      useExecutionStore
        .getState()
        .addConversationMessage({ type: "user", content: "x", turnIndex: 1 });
      useExecutionStore
        .getState()
        .updateToolItem("missing", { toolStatus: "success" });
      // unchanged
      expect(useExecutionStore.getState().conversationMessages).toHaveLength(1);
      expect(
        useExecutionStore.getState().conversationMessages[0].type,
      ).toBe("user");
    });
  });
});
