"use client";

import { useCallback } from "react";
import { toast } from "sonner";
import { getWsClient } from "./ws-client";
import type { WsClient } from "./ws-client";
import { useExecutionStore } from "../stores/execution-store";

/**
 * Sentinel buttonId recognised by the engine's button-interaction handler as
 * "proceed without picking a concrete button" — used for link-only buttons
 * where the user explicitly presses the Continue affordance.
 */
export const CONTINUE_BUTTON_ID = "__continue__";

interface InteractionAck {
  success: boolean;
  error?: string;
}

/**
 * Emit a command and listen for its ack event exactly once. The gateway
 * replies with `{ event, data: { success, error? } }` — NestJS surfaces this
 * to the client as `socket.on(event, data)`, not as a Socket.IO ack callback,
 * so we attach a one-shot listener.
 *
 * Each interaction command is gated by the user (one in-flight at a time —
 * the UI disables further input until the AI response arrives), so a single
 * one-shot ack listener is enough to match the latest emit.
 */
function emitWithAck(
  ws: WsClient,
  event: string,
  data: unknown,
  ackEvent: string,
  onFailure: (error: string) => void,
): void {
  ws.once(ackEvent, (...args: unknown[]) => {
    const response = args[0] as InteractionAck | undefined;
    if (response && response.success === false) {
      onFailure(response.error ?? "Unknown error");
    }
  });
  ws.emit(event, data);
}

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
      emitWithAck(
        getWsClient(),
        "execution.submit_form",
        { executionId, formData },
        "execution.form_submitted",
        (error) => toast.error(error),
      );
    },
    [executionId],
  );

  const clickButton = useCallback(
    (buttonId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.click_button",
        { executionId, buttonId },
        "execution.click_button.ack",
        (error) => toast.error(error),
      );
    },
    [executionId],
  );

  const clickContinue = useCallback(() => {
    if (!executionId) return;
    emitWithAck(
      getWsClient(),
      "execution.click_button",
      { executionId, buttonId: CONTINUE_BUTTON_ID },
      "execution.click_button.ack",
      (error) => toast.error(error),
    );
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
      emitWithAck(
        getWsClient(),
        "execution.submit_message",
        { executionId, nodeId, message },
        "execution.submit_message.ack",
        (error) => {
          // Server rejected the message (oversize / no pending continuation /
          // not authorised). Release the "AI is responding" indicator so the
          // user can retry instead of staring at a frozen spinner.
          setWaitingAiResponse(false);
          toast.error(error);
        },
      );
    },
    [executionId, addConversationMessage, setWaitingAiResponse],
  );

  const endConversation = useCallback(
    (nodeId: string) => {
      if (!executionId) return;
      emitWithAck(
        getWsClient(),
        "execution.end_conversation",
        { executionId, nodeId },
        "execution.end_conversation.ack",
        (error) => toast.error(error),
      );
    },
    [executionId],
  );

  return { submitForm, clickButton, clickContinue, sendMessage, endConversation };
}
