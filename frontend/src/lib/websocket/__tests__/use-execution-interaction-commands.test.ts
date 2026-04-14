import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";

const emitMock = vi.fn();

vi.mock("../ws-client", () => ({
  getWsClient: () => ({
    emit: emitMock,
  }),
}));

import { useExecutionInteractionCommands } from "../use-execution-interaction-commands";
import { useExecutionStore } from "../../stores/execution-store";

describe("useExecutionInteractionCommands", () => {
  beforeEach(() => {
    emitMock.mockReset();
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
