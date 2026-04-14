"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWsClient } from "./ws-client";
import {
  useExecutionStore,
  NodeExecutionStatus,
} from "../stores/execution-store";
import { getAccessToken } from "../api/client";
import { executionsApi, NodeExecutionData } from "../api/executions";
import { getNodeDefinition } from "../node-definitions";

interface UseExecutionEventsOptions {
  executionId: string | null;
}

interface UseExecutionEventsReturn {
  isConnected: boolean;
}

const POLL_INTERVAL_MS = 2000;
const POLL_INTERVAL_WAITING_MS = 2000; // Same interval when waiting for user input

function mapNodeStatus(
  status: NodeExecutionData["status"],
): NodeExecutionStatus {
  switch (status) {
    case "running":
      return "running";
    case "completed":
      return "completed";
    case "failed":
      return "failed";
    case "skipped":
      return "skipped";
    case "waiting_for_input":
      return "waiting_for_input";
    default:
      return "pending";
  }
}

function getCategoryForType(nodeType: string): string {
  return getNodeDefinition(nodeType)?.category ?? "unknown";
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Accept only well-formed UUIDs. Timeline IDs (`nodeExecutionId`,
 * `parentNodeExecutionId`) flow directly into React keys and selection
 * state; a malformed/over-long value from an upstream bug or a malicious
 * payload would otherwise be persisted verbatim.
 */
function sanitizeUuid(v: unknown): string | undefined {
  return typeof v === "string" && UUID_REGEX.test(v) ? v : undefined;
}

// Higher priority = more terminal. Prevents stale WS events from overwriting.
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0,
  running: 1,
  waiting_for_input: 2,
  completed: 3,
  failed: 3,
  skipped: 3,
};

function shouldUpdateStatus(
  current: NodeExecutionStatus | undefined,
  incoming: NodeExecutionStatus,
): boolean {
  if (!current) return true;
  return (STATUS_PRIORITY[incoming] ?? 0) >= (STATUS_PRIORITY[current] ?? 0);
}

export function useExecutionEvents({
  executionId,
}: UseExecutionEventsOptions): UseExecutionEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const cancelledRef = useRef(false);

  const {
    startExecution,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
    resumeFromForm,
    pauseForButtons,
    resumeFromButtons,
    pauseForConversation,
    resumeFromConversation,
    addConversationMessage,
    updateConversationConfig,
  } = useExecutionStore();

  const handleExecutionStarted = useCallback(
    (data: unknown) => {
      const payload = data as { executionId?: string };
      if (!payload.executionId) return;

      // Backward compat guard: older backends may emit execution.started
      // instead of execution.resumed when resuming from a form submission.
      // Avoid resetting nodeResults when we're just resuming.
      const { status: currentStatus } = useExecutionStore.getState();
      if (currentStatus === "waiting_for_input") {
        resumeFromForm();
        return;
      }

      startExecution(payload.executionId);
    },
    [startExecution, resumeFromForm],
  );

  const handleExecutionResumed = useCallback(() => {
    const { waitingInteractionType } = useExecutionStore.getState();
    if (waitingInteractionType === "ai_conversation") {
      resumeFromConversation();
    } else if (waitingInteractionType === "buttons") {
      resumeFromButtons();
    } else {
      resumeFromForm();
    }
  }, [resumeFromForm, resumeFromButtons, resumeFromConversation]);

  const handleExecutionCompleted = useCallback(() => {
    completeExecution();
  }, [completeExecution]);

  const handleExecutionFailed = useCallback(
    (data: unknown) => {
      const payload = data as { error?: string };
      failExecution(payload.error);
    },
    [failExecution],
  );

  const handleExecutionCancelled = useCallback(() => {
    failExecution("Execution cancelled");
  }, [failExecution]);

  const handleWaitingForInput = useCallback(
    (data: unknown) => {
      const payload = data as {
        waitingNodeId?: string;
        waitingNodeType?: string;
        nodeExecutionId?: string;
        interactionType?: "form" | "buttons" | "ai_conversation";
        nodeOutput?: unknown;
        buttonConfig?: unknown;
      };
      if (!payload.waitingNodeId) return;

      const nodeType = payload.waitingNodeType ?? "unknown";
      const nodeCategory = getCategoryForType(nodeType);

      // Update node status
      updateNodeStatus(payload.waitingNodeId, {
        status: "waiting_for_input",
      });
      // nodeOutput may be at top-level (form) or nested inside buttonConfig (buttons)
      const resolvedOutput =
        payload.nodeOutput ??
        (payload.buttonConfig as Record<string, unknown> | undefined)?.nodeOutput ??
        null;
      addNodeResult({
        // Propagate the DB row id so this update maps to the same timeline
        // entry created by NODE_STARTED — otherwise a second phantom row
        // appears when execution resumes (carousel button flow etc.).
        nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
        nodeId: payload.waitingNodeId,
        nodeLabel: payload.waitingNodeId,
        nodeType,
        nodeCategory,
        status: "waiting_for_input",
        outputData: resolvedOutput,
      });

      // Resolve interactionType from top-level or inside nodeOutput
      const nodeOutputObj = resolvedOutput as Record<string, unknown> | null;
      const interactionType =
        payload.interactionType ??
        (nodeOutputObj?.interactionType as string | undefined);

      if (interactionType === "ai_conversation") {
        const convConfig = nodeOutputObj?.conversationConfig as {
          message?: string;
          messages?: Array<{ role: string; content: string }>;
          turnCount?: number;
          maxTurns?: number;
        } | undefined;
        pauseForConversation(payload.waitingNodeId, convConfig ?? null);

        // Parse initial messages into ConversationItems
        if (convConfig?.messages) {
          const { conversationMessages } = useExecutionStore.getState();
          // Only add if no messages yet (avoid duplicates on re-emit)
          if (conversationMessages.length === 0) {
            const turnCount = convConfig.turnCount ?? 1;
            // Extract Turn 1 debug data from event payload
            const turnDebug = (payload as Record<string, unknown>).turnDebug as {
              llmCalls?: { llmCalls?: Array<{ requestPayload?: unknown; responsePayload?: unknown; durationMs?: number }> };
              metadata?: { model?: string; inputTokens?: number; outputTokens?: number };
            } | undefined;
            const llmCallEntries = turnDebug?.llmCalls?.llmCalls ?? [];

            let assistantIdx = 0;
            for (const msg of convConfig.messages) {
              if (msg.role === "user" || msg.role === "assistant") {
                const callDebug = msg.role === "assistant" ? llmCallEntries[assistantIdx++] : undefined;
                addConversationMessage({
                  type: msg.role,
                  content: msg.content,
                  turnIndex: turnCount,
                  ...(callDebug ? {
                    requestPayload: callDebug.requestPayload,
                    responsePayload: callDebug.responsePayload,
                    durationMs: callDebug.durationMs,
                    metadata: turnDebug?.metadata,
                  } : {}),
                });
              }
            }
          }
        }
      } else if (interactionType === "buttons") {
        const btnConfig =
          payload.buttonConfig ??
          nodeOutputObj?.buttonConfig;
        pauseForButtons(payload.waitingNodeId, btnConfig ?? null);
      } else {
        // Form interaction (default for backward compat).
        // New shape: `{ config: formDeclaration, output: null, status: 'waiting_for_input' }`
        // Legacy:    `{ type: 'form', formConfig: {...}, status: 'waiting_for_input' }`
        const output = nodeOutputObj as
          | { formConfig?: unknown; config?: unknown; output?: unknown }
          | null;
        const isStructured =
          output != null &&
          typeof output === "object" &&
          "config" in output &&
          "output" in output;
        const formConfig = isStructured
          ? output.config
          : (output?.formConfig ?? null);
        pauseForForm(payload.waitingNodeId, formConfig ?? null);
      }
    },
    [
      pauseForForm,
      pauseForButtons,
      pauseForConversation,
      addConversationMessage,
      updateNodeStatus,
      addNodeResult,
    ],
  );

  const handleAiMessage = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        message?: string;
        turnCount?: number;
        messages?: Array<{ role: string; content: string }>;
        metadata?: {
          model?: string;
          inputTokens?: number;
          outputTokens?: number;
          toolCalls?: number;
          ragChunks?: number;
        };
        requestPayload?: unknown;
        responsePayload?: unknown;
        llmCalls?: Array<{ requestPayload?: unknown; responsePayload?: unknown; durationMs?: number }>;
        durationMs?: number;
      };
      if (payload.message == null) return;

      const turnCount = payload.turnCount ?? 1;

      // Use llmCalls (last entry) if available, fallback to legacy fields
      const lastLlmCall = payload.llmCalls?.length
        ? payload.llmCalls[payload.llmCalls.length - 1]
        : undefined;

      addConversationMessage({
        type: "assistant",
        content: payload.message ?? "",
        turnIndex: turnCount,
        timestamp: new Date().toISOString(),
        durationMs: payload.durationMs ?? lastLlmCall?.durationMs,
        requestPayload: payload.requestPayload ?? lastLlmCall?.requestPayload,
        responsePayload: payload.responsePayload ?? lastLlmCall?.responsePayload,
        metadata: payload.metadata
          ? {
              model: payload.metadata.model,
              inputTokens: payload.metadata.inputTokens,
              outputTokens: payload.metadata.outputTokens,
              toolCalls: payload.metadata.toolCalls,
              ragChunks: payload.metadata.ragChunks,
            }
          : undefined,
      });

      updateConversationConfig(payload);
    },
    [addConversationMessage, updateConversationConfig],
  );

  const handleNodeStarted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
        timestamp?: string;
      };
      if (payload.nodeId) {
        // Guard against out-of-order events (e.g., completed arriving before started)
        const existing =
          useExecutionStore.getState().nodeStatuses.get(payload.nodeId);
        if (!shouldUpdateStatus(existing?.status, "running")) return;

        updateNodeStatus(payload.nodeId, { status: "running" });
        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId: sanitizeUuid(payload.parentNodeExecutionId),
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "running",
          outputData: null,
          startedAt: payload.timestamp ?? new Date().toISOString(),
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeCompleted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        duration?: number;
        nodeType?: string;
        nodeLabel?: string;
        output?: Record<string, unknown>;
        timestamp?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "completed",
          duration: payload.duration,
        });

        // Preserve startedAt from the matching prior entry if available.
        // Match by nodeExecutionId when present so iterations stay distinct.
        const existing = useExecutionStore.getState().nodeResults.find((r) =>
          payload.nodeExecutionId
            ? r.nodeExecutionId === payload.nodeExecutionId
            : !r.nodeExecutionId && r.nodeId === payload.nodeId,
        );

        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId:
            sanitizeUuid(payload.parentNodeExecutionId) ??
            existing?.parentNodeExecutionId,
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "completed",
          duration: payload.duration,
          outputData: payload.output ?? null,
          startedAt: existing?.startedAt,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeFailed = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        error?: string;
        nodeType?: string;
        nodeLabel?: string;
        timestamp?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "failed",
          error: payload.error,
        });

        const existing = useExecutionStore.getState().nodeResults.find((r) =>
          payload.nodeExecutionId
            ? r.nodeExecutionId === payload.nodeExecutionId
            : !r.nodeExecutionId && r.nodeId === payload.nodeId,
        );

        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId:
            sanitizeUuid(payload.parentNodeExecutionId) ??
            existing?.parentNodeExecutionId,
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "failed",
          error: payload.error,
          outputData: null,
          startedAt: existing?.startedAt,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeSkipped = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeExecutionId?: string;
        parentNodeExecutionId?: string;
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, { status: "skipped" });
        addNodeResult({
          nodeExecutionId: sanitizeUuid(payload.nodeExecutionId),
          parentNodeExecutionId: sanitizeUuid(payload.parentNodeExecutionId),
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "skipped",
          outputData: null,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  useEffect(() => {
    if (!executionId) return;

    const token = getAccessToken();
    if (!token) return;

    cancelledRef.current = false;

    const client = getWsClient();

    // Connect if not already connected
    client.connect(token);

    // Track connection state
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);

    // Bind execution events BEFORE subscribing
    client.on("execution.started", handleExecutionStarted);
    client.on("execution.resumed", handleExecutionResumed);
    client.on("execution.completed", handleExecutionCompleted);
    client.on("execution.failed", handleExecutionFailed);
    client.on("execution.cancelled", handleExecutionCancelled);
    client.on("execution.waiting_for_input", handleWaitingForInput);
    client.on("execution.ai_message", handleAiMessage);

    // Bind node events
    client.on("execution.node.started", handleNodeStarted);
    client.on("execution.node.completed", handleNodeCompleted);
    client.on("execution.node.failed", handleNodeFailed);
    client.on("execution.node.skipped", handleNodeSkipped);

    const channel = `execution:${executionId}`;

    // Poll execution status via REST API (works independently of WebSocket)
    // Returns true if execution reached a terminal state
    const pollExecutionStatus = async (): Promise<boolean> => {
      try {
        const execution = await executionsApi.getById(executionId);
        if (cancelledRef.current) return true;

        // Reconcile node-level statuses (sorted by startedAt for chronological order)
        if (execution.nodeExecutions) {
          const sorted = [...execution.nodeExecutions].sort((a, b) =>
            (a.startedAt ?? "").localeCompare(b.startedAt ?? ""),
          );
          for (const ne of sorted) {
            const nodeType = ne.node?.type ?? "unknown";
            const nodeLabel = ne.node?.label ?? ne.nodeId;

            updateNodeStatus(ne.nodeId, {
              status: mapNodeStatus(ne.status),
              duration: ne.durationMs ?? undefined,
              error: ne.error?.message,
            });

            // Add all nodes to results timeline. Pass the NodeExecution row id
            // so WS events and polling converge on the same timeline entry —
            // without this, each iteration's row appears twice (once from the
            // WS NODE_COMPLETED event, once from the polling reconciliation).
            addNodeResult({
              nodeExecutionId: ne.id,
              parentNodeExecutionId: ne.parentNodeExecutionId ?? undefined,
              nodeId: ne.nodeId,
              nodeLabel,
              nodeType,
              nodeCategory: getCategoryForType(nodeType),
              status: mapNodeStatus(ne.status),
              duration: ne.durationMs ?? undefined,
              error: ne.error?.message,
              outputData: ne.outputData,
              inputData: ne.inputData,
              startedAt: ne.startedAt,
            });
          }
        }

        // Reconcile execution-level status
        const { status: prevStatus } = useExecutionStore.getState();

        if (execution.status === "completed") {
          completeExecution();
          return true;
        } else if (execution.status === "failed") {
          failExecution(execution.error?.message);
          return true;
        } else if (execution.status === "cancelled") {
          failExecution("Execution cancelled");
          return true;
        } else if (
          execution.status === "running" &&
          prevStatus === "waiting_for_input"
        ) {
          // Execution resumed — WebSocket event may have been missed
          const { waitingInteractionType: wit } =
            useExecutionStore.getState();
          if (wit === "ai_conversation") {
            resumeFromConversation();
          } else if (wit === "buttons") {
            resumeFromButtons();
          } else {
            resumeFromForm();
          }
          return false;
        } else if (execution.status === "waiting_for_input") {
          // Skip if already in waiting state for the same node
          const { waitingNodeId: currentWaiting } =
            useExecutionStore.getState();

          // Find the waiting Form node
          const waitingNode = execution.nodeExecutions?.find(
            (ne) => ne.status === "waiting_for_input",
          );

          if (currentWaiting && currentWaiting === waitingNode?.nodeId) {
            return false; // Already waiting, skip redundant update
          }
          if (waitingNode?.outputData) {
            const raw = waitingNode.outputData as Record<string, unknown>;

            // Structured shape: `{ config, output, status, meta: { interactionType } }`
            // Legacy flat:      `{ type: 'form', formConfig, interactionType, buttonConfig, conversationConfig, ... }`
            const isStructured =
              raw != null &&
              typeof raw === "object" &&
              "config" in raw &&
              "output" in raw;

            const meta = isStructured
              ? (raw.meta as Record<string, unknown> | undefined)
              : undefined;

            const interactionType =
              (meta?.interactionType as string | undefined) ??
              (raw.interactionType as string | undefined) ??
              (raw.type === "form" ? "form" : undefined);

            if (interactionType === "ai_conversation") {
              const convConfig = isStructured
                ? (raw.config as Record<string, unknown> | undefined)
                : (raw.conversationConfig as Record<string, unknown> | undefined);
              pauseForConversation(waitingNode.nodeId, convConfig ?? null);
            } else if (interactionType === "buttons") {
              const btnConfig = isStructured
                ? (raw.config as Record<string, unknown> | undefined)
                : (raw.buttonConfig as Record<string, unknown> | undefined);
              pauseForButtons(waitingNode.nodeId, btnConfig ?? null);
            } else if (interactionType === "form") {
              const formConfig = isStructured
                ? (raw.config as Record<string, unknown> | undefined)
                : (raw.formConfig as Record<string, unknown> | undefined);
              pauseForForm(waitingNode.nodeId, formConfig ?? null);
            }
          }
          return false; // not terminal, keep polling
        }

        return false;
      } catch (err) {
        console.error("[execution-events] Poll failed:", err);
        return false;
      }
    };

    // Subscribe via WebSocket (best-effort, not required for correctness)
    const trySubscribe = async () => {
      try {
        await client.waitForConnect();
        if (!cancelledRef.current) {
          client.subscribe(channel);
        }
      } catch {
        // WebSocket connection failed — polling will handle status updates
      }
    };

    // Re-subscribe on reconnect
    const onReconnect = () => {
      if (!cancelledRef.current) {
        void trySubscribe();
      }
    };
    client.on("connect", onReconnect);

    // Start WebSocket subscription (non-blocking)
    void trySubscribe();

    // Start polling immediately — ensures status updates even without WebSocket.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const startPolling = async () => {
      if (cancelledRef.current) return;
      const isTerminal = await pollExecutionStatus();
      if (!isTerminal && !cancelledRef.current) {
        // Use slower polling when waiting for form input
        const { status: currentStatus } = useExecutionStore.getState();
        const interval =
          currentStatus === "waiting_for_input"
            ? POLL_INTERVAL_WAITING_MS
            : POLL_INTERVAL_MS;
        pollTimer = setTimeout(() => void startPolling(), interval);
      }
    };

    void startPolling();

    return () => {
      cancelledRef.current = true;
      if (pollTimer) clearTimeout(pollTimer);
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
      client.off("connect", onReconnect);
      client.off("execution.started", handleExecutionStarted);
      client.off("execution.resumed", handleExecutionResumed);
      client.off("execution.completed", handleExecutionCompleted);
      client.off("execution.failed", handleExecutionFailed);
      client.off("execution.cancelled", handleExecutionCancelled);
      client.off("execution.waiting_for_input", handleWaitingForInput);
      client.off("execution.ai_message", handleAiMessage);
      client.off("execution.node.started", handleNodeStarted);
      client.off("execution.node.completed", handleNodeCompleted);
      client.off("execution.node.failed", handleNodeFailed);
      client.off("execution.node.skipped", handleNodeSkipped);
      client.unsubscribe(channel);
      // Do NOT disconnect - singleton stays alive
    };
  }, [
    executionId,
    handleExecutionStarted,
    handleExecutionResumed,
    handleExecutionCompleted,
    handleExecutionFailed,
    handleExecutionCancelled,
    handleWaitingForInput,
    handleAiMessage,
    handleNodeStarted,
    handleNodeCompleted,
    handleNodeFailed,
    handleNodeSkipped,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
    resumeFromForm,
    pauseForButtons,
    resumeFromButtons,
    pauseForConversation,
    resumeFromConversation,
    addConversationMessage,
    updateConversationConfig,
  ]);

  return { isConnected };
}
