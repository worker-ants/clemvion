import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const { emitMock, onceMock, toastErrorMock } = vi.hoisted(() => ({
  emitMock: vi.fn(),
  onceMock: vi.fn(),
  toastErrorMock: vi.fn(),
}));

vi.mock("../ws-client", () => ({
  getWsClient: () => ({
    emit: emitMock,
    once: onceMock,
  }),
}));

vi.mock("sonner", () => ({
  toast: {
    error: toastErrorMock,
  },
}));

import { useExecutionInteractionCommands } from "../use-execution-interaction-commands";
import { useExecutionStore } from "../../stores/execution-store";

describe("useExecutionInteractionCommands", () => {
  beforeEach(() => {
    emitMock.mockReset();
    onceMock.mockReset();
    toastErrorMock.mockReset();
    useExecutionStore.getState().reset();
  });

  it("submitForm emits execution.submit_form with formData", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    expect(emitMock).toHaveBeenCalledWith("execution.submit_form", {
      executionId: "exec-1",
      formData: { name: "John" },
    });
  });

  // spec/4-nodes/6-presentation/0-common.md §Rationale (form submission wire
  // format wrap) — submitForm 도 sendMessage 와 동일한 optimistic UI 패턴
  // (presentation_user 임시 turn + AI 응답 대기 스피너). 사용자 보고
  // "form submit 후 0 frame visual feedback" 회귀 차단.
  it("submitForm appends presentation_user item to conversation store + sets waitingAiResponse", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({
        inquiryType: "주문 문의",
        contact: "010-1234-5678",
        message: "샘플상품 3 가격 문의합니다.",
      });
    });
    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(1);
    expect(state.conversationMessages[0]).toMatchObject({
      type: "presentation",
      presentation: {
        interactionType: "form_submitted",
        data: {
          inquiryType: "주문 문의",
          contact: "010-1234-5678",
          message: "샘플상품 3 가격 문의합니다.",
        },
      },
      turnIndex: 1,
    });
    expect(state.isWaitingAiResponse).toBe(true);
  });

  it("submitForm uses waitingNodeId's label/type for the optimistic item", () => {
    useExecutionStore.getState().addNodeResult({
      nodeId: "ai-1",
      nodeLabel: "AI Agent",
      nodeType: "ai_agent",
      nodeCategory: "ai",
      status: "waiting_for_input" as never,
      outputData: null,
    });
    useExecutionStore.getState().pauseForForm("ai-1", {
      fields: [{ name: "qty", type: "number" }],
    });

    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ qty: 3 });
    });
    const item = useExecutionStore.getState().conversationMessages[0];
    expect(item.presentation?.nodeLabel).toBe("AI Agent");
    expect(item.presentation?.nodeType).toBe("ai_agent");
  });

  it("submitForm — WS ack 실패 시 isWaitingAiResponse 해제 + toast", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);

    // once handler 호출 → 실패 응답
    const onceCall = onceMock.mock.calls.find(
      ([event]) => event === "execution.form_submitted",
    );
    expect(onceCall).toBeDefined();
    const ackHandler = onceCall![1] as (resp: unknown) => void;
    act(() => {
      ackHandler({ success: false, error: "form rejected" });
    });
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith("form rejected");
    // optimistic presentation_user 는 유지 (재시도 안내 차원)
    expect(
      useExecutionStore.getState().conversationMessages,
    ).toHaveLength(1);
  });

  it("submitForm — ack success 시 waiting 인디케이터 유지 (다음 ai_message 가 해제)", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    const onceCall = onceMock.mock.calls.find(
      ([event]) => event === "execution.form_submitted",
    );
    const ackHandler = onceCall![1] as (resp: unknown) => void;
    act(() => {
      ackHandler({ success: true });
    });
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  it("clickButton emits execution.click_button with buttonId", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.clickButton("btn-a");
    });
    expect(emitMock).toHaveBeenCalledWith("execution.click_button", {
      executionId: "exec-1",
      buttonId: "btn-a",
    });
  });

  it("clickContinue emits __continue__ sentinel", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.clickContinue();
    });
    expect(emitMock).toHaveBeenCalledWith("execution.click_button", {
      executionId: "exec-1",
      buttonId: "__continue__",
    });
  });

  it("sendMessage appends user item to conversation store and emits event", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.sendMessage("node-1", "Hello");
    });
    const state = useExecutionStore.getState();
    expect(state.conversationMessages).toHaveLength(1);
    expect(state.conversationMessages[0]).toMatchObject({
      type: "user",
      content: "Hello",
      turnIndex: 1,
    });
    expect(state.isWaitingAiResponse).toBe(true);
    expect(emitMock).toHaveBeenCalledWith("execution.submit_message", {
      executionId: "exec-1",
      nodeId: "node-1",
      message: "Hello",
    });
  });

  it("sendMessage increments turnIndex across successive user messages", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.sendMessage("node-1", "First");
    });
    // Simulate an AI assistant response arriving between turns so the count
    // mirrors a real multi-turn conversation.
    act(() => {
      useExecutionStore.getState().addConversationMessage({
        type: "assistant",
        content: "Hi",
        turnIndex: 1,
      });
      result.current.sendMessage("node-1", "Second");
    });
    const userTurns = useExecutionStore
      .getState()
      .conversationMessages.filter((m) => m.type === "user")
      .map((m) => m.turnIndex);
    expect(userTurns).toEqual([1, 2]);
  });

  it("endConversation emits execution.end_conversation", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.endConversation("node-1");
    });
    expect(emitMock).toHaveBeenCalledWith("execution.end_conversation", {
      executionId: "exec-1",
      nodeId: "node-1",
    });
  });

  it("sendMessage releases isWaitingAiResponse and toasts on ack failure", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.sendMessage("node-1", "Hello");
    });
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
    // Replay the ack listener with a failure payload (gateway returns this
    // when continueAiConversation throws — e.g. no pending continuation).
    expect(onceMock).toHaveBeenCalledWith(
      "execution.submit_message.ack",
      expect.any(Function),
    );
    const ackHandler = onceMock.mock.calls[0][1] as (
      ...args: unknown[]
    ) => void;
    act(() => {
      ackHandler({
        success: false,
        error: "No pending continuation for execution: exec-1",
      });
    });
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(false);
    expect(toastErrorMock).toHaveBeenCalledWith(
      "No pending continuation for execution: exec-1",
    );
  });

  it("sendMessage keeps waiting state when ack reports success", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.sendMessage("node-1", "Hello");
    });
    const ackHandler = onceMock.mock.calls[0][1] as (
      ...args: unknown[]
    ) => void;
    act(() => {
      ackHandler({ success: true });
    });
    // Successful ack does not clear the waiting flag — the AI_MESSAGE event
    // (handled elsewhere) is what resolves the conversation turn.
    expect(useExecutionStore.getState().isWaitingAiResponse).toBe(true);
    expect(toastErrorMock).not.toHaveBeenCalled();
  });

  // I#7 (SUMMARY) — submitForm 중복 호출 시 once listener 등록 검증
  it("submitForm 중복 호출 시 each call 에서 once listener 등록 (중복 submit 방어)", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ a: 1 });
      result.current.submitForm({ b: 2 });
    });
    // 각 submitForm 마다 once listener 를 execution.form_submitted 에 등록해야 함.
    const onceRegistrations = onceMock.mock.calls.filter(
      ([event]) => event === "execution.form_submitted",
    );
    expect(onceRegistrations).toHaveLength(2);
  });

  // I#8 (SUMMARY) — presentation 혼합 시 turnIndex 검증
  it("submitForm 과 sendMessage 혼합 시 turnIndex 가 user+presentation 기준으로 증가", () => {
    // 순서: submitForm(1) → presentation(1), sendMessage → user(1), submitForm(2) → presentation(3)
    // submitForm 의 turnIndex 는 conversationMessages 에서 user+presentation 을 카운트.
    // sendMessage 의 turnIndex 는 user 만 카운트.
    // submitForm(1) 시점: user+presentation=0 → turnIndex=1
    // sendMessage 시점: user=0 → turnIndex=1
    // submitForm(2) 시점: messages=[pres(1), user(1)] → user+presentation=2 → turnIndex=3
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ x: 1 });
      result.current.sendMessage("node-1", "hello");
      result.current.submitForm({ x: 2 });
    });
    const msgs = useExecutionStore.getState().conversationMessages;
    const presentations = msgs.filter((m) => m.type === "presentation");
    const users = msgs.filter((m) => m.type === "user");
    // presentation[0]: submitForm(1) 시점 user+presentation=0 → turnIndex=1
    expect(presentations[0].turnIndex).toBe(1);
    // presentation[1]: submitForm(2) 시점 user+presentation=2 → turnIndex=3
    expect(presentations[1].turnIndex).toBe(3);
    // user[0]: sendMessage 시점 user=0 → turnIndex=1
    expect(users[0].turnIndex).toBe(1);
  });

  // I#9 (SUMMARY) — Unknown error fallback toast 검증
  it("submitForm ack — error 필드 없이 success:false 오면 'Unknown error' fallback toast", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands("exec-1"),
    );
    act(() => {
      result.current.submitForm({ name: "John" });
    });
    const onceCall = onceMock.mock.calls.find(
      ([event]) => event === "execution.form_submitted",
    );
    expect(onceCall).toBeDefined();
    const ackHandler = onceCall![1] as (resp: unknown) => void;
    act(() => {
      // error 필드 없이 success:false — emitWithAck 의 `error ?? "Unknown error"` fallback
      ackHandler({ success: false });
    });
    expect(toastErrorMock).toHaveBeenCalledWith("Unknown error");
  });

  it("no-ops when executionId is null", () => {
    const { result } = renderHook(() =>
      useExecutionInteractionCommands(null),
    );
    act(() => {
      result.current.submitForm({});
      result.current.clickButton("a");
      result.current.clickContinue();
      result.current.sendMessage("n", "m");
      result.current.endConversation("n");
    });
    expect(emitMock).not.toHaveBeenCalled();
  });
});
