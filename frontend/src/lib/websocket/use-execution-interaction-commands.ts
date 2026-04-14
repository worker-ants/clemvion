"use client";

import { useCallback } from "react";
import { getWsClient } from "./ws-client";
import { useExecutionStore } from "../stores/execution-store";

/**
 * Sentinel buttonId recognised by the engine's button-interaction handler as
 * "proceed without picking a concrete button" — used when a button-waiting
 * node hits its timeout and the timeoutAction is `continue`.
 */
export const CONTINUE_BUTTON_ID = "__continue__";

export interface ExecutionInteractionCommands {
  /** Submit a form waiting node's filled values and resume the execution. */
  submitForm: (formData: Record<string, unknown>) => void;
  /** Click a specific port-type button in a waiting buttons node. */
  clickButton: (buttonId: string) => void;
  /** Bypass a buttons-waiting node using the `__continue__` sentinel. */
  clickContinue: () => void;
  /** Append a user message and emit it to a live AI conversation node. */
  sendMessage: (nodeId: string, message: string) => void;
  /** Gracefully terminate a live AI conversation node. */
  endConversation: (nodeId: string) => void;
}

/**
 * Wraps WebSocket commands used to resume a `waiting_for_input` execution.
 * Also updates the conversation store for AI chat so the user's own message
 * appears immediately, mirroring how the editor's run-results drawer behaves.
 */
export function useExecutionInteractionCommands(
  executionId: string | null,
): ExecutionInteractionCommands {
  const addConversationMessage = useExecutionStore(
    (s) => s.addConversationMessage,
  );
  const setWaitingAiResponse = useExecutionStore((s) => s.setWaitingAiResponse);

  const submitForm = useCallback(
    (formData: Record<string, unknown>) => {
      if (!executionId) return;
      getWsClient().emit("execution.submit_form", { executionId, formData });
    },
    [executionId],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      getWsClient().emit("execution.click_button", { executionId, buttonId });
    },
    [executionId],
  );

  const clickContinue = useCallback(() => {
    if (!executionId) return;
    getWsClient().emit("execution.click_button", {
      executionId,
      buttonId: CONTINUE_BUTTON_ID,
    });
  }, [executionId]);

  const sendMessage = useCallback(
    (nodeId: string, message: string) => {
      if (!executionId) return;
      const { conversationMessages } = useExecutionStore.getState();
      addConversationMessage({
        type: "user",
        content: message,
        turnIndex:
          conversationMessages.filter((m) => m.type === "user").length + 1,
        timestamp: new Date().toISOString(),
      });
      setWaitingAiResponse(true);
      getWsClient().emit("execution.submit_message", {
        executionId,
        nodeId,
        message,
      });
    },
    [executionId, addConversationMessage, setWaitingAiResponse],
  );

  const endConversation = useCallback(
    (nodeId: string) => {
      if (!executionId) return;
      getWsClient().emit("execution.end_conversation", {
        executionId,
        nodeId,
      });
    },
    [executionId],
  );

  return { submitForm, clickButton, clickContinue, sendMessage, endConversation };
}
