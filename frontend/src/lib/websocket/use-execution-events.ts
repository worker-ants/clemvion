"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getWsClient } from "./ws-client";
import {
  useExecutionStore,
  NodeExecutionStatus,
} from "../stores/execution-store";
import { getAccessToken } from "../api/client";
import { executionsApi, NodeExecutionData } from "../api/executions";

interface UseExecutionEventsOptions {
  executionId: string | null;
}

interface UseExecutionEventsReturn {
  isConnected: boolean;
}

const POLL_INTERVAL_MS = 2000;
const POLL_INTERVAL_WAITING_MS = 10000; // Slower polling when waiting for form input

const PRESENTATION_TYPES = new Set([
  "carousel",
  "table",
  "chart",
  "form",
  "template",
  "pdf",
]);

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
  } = useExecutionStore();

  const handleExecutionStarted = useCallback(
    (data: unknown) => {
      const payload = data as { executionId?: string };
      if (payload.executionId) {
        startExecution(payload.executionId);
      }
    },
    [startExecution],
  );

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
        nodeOutput?: unknown;
      };
      if (payload.waitingNodeId && payload.waitingNodeType === "form") {
        const output = payload.nodeOutput as {
          formConfig?: unknown;
        } | null;
        pauseForForm(payload.waitingNodeId, output?.formConfig ?? null);
      }
    },
    [pauseForForm],
  );

  const handleNodeEvent = useCallback(
    (status: NodeExecutionStatus) => (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        duration?: number;
        error?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status,
          duration: payload.duration,
          error: payload.error,
        });
      }
    },
    [updateNodeStatus],
  );

  const handleNodeCompleted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        duration?: number;
        output?: Record<string, unknown>;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "completed",
          duration: payload.duration,
        });

        // Add presentation node results to the history
        const output = payload.output;
        if (output && typeof output === "object" && "type" in output) {
          const outputType = output.type as string;
          if (PRESENTATION_TYPES.has(outputType)) {
            addNodeResult({
              nodeId: payload.nodeId,
              nodeLabel: (output.label as string) ?? payload.nodeId,
              nodeType: outputType,
              outputData: output,
            });
          }
        }
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
    client.on("execution.completed", handleExecutionCompleted);
    client.on("execution.failed", handleExecutionFailed);
    client.on("execution.cancelled", handleExecutionCancelled);
    client.on("execution.waiting_for_input", handleWaitingForInput);

    // Bind node events
    const nodeStarted = handleNodeEvent("running");
    const nodeFailed = handleNodeEvent("failed");
    const nodeSkipped = handleNodeEvent("skipped");

    client.on("execution.node.started", nodeStarted);
    client.on("execution.node.completed", handleNodeCompleted);
    client.on("execution.node.failed", nodeFailed);
    client.on("execution.node.skipped", nodeSkipped);

    const channel = `execution:${executionId}`;

    // Poll execution status via REST API (works independently of WebSocket)
    // Returns true if execution reached a terminal state
    const pollExecutionStatus = async (): Promise<boolean> => {
      try {
        const response = await executionsApi.getById(executionId);
        if (cancelledRef.current) return true;

        const execution = response.data;

        // Reconcile node-level statuses
        if (execution.nodeExecutions) {
          for (const ne of execution.nodeExecutions) {
            updateNodeStatus(ne.nodeId, {
              status: mapNodeStatus(ne.status),
              duration: ne.durationMs ?? undefined,
              error: ne.error?.message,
            });

            // Collect presentation node results from polling
            if (
              ne.status === "completed" &&
              ne.outputData &&
              typeof ne.outputData === "object" &&
              "type" in ne.outputData
            ) {
              const outputType = ne.outputData.type as string;
              if (PRESENTATION_TYPES.has(outputType)) {
                addNodeResult({
                  nodeId: ne.nodeId,
                  nodeLabel:
                    (ne.outputData.label as string) ?? ne.nodeId,
                  nodeType: outputType,
                  outputData: ne.outputData,
                });
              }
            }
          }
        }

        // Reconcile execution-level status
        if (execution.status === "completed") {
          completeExecution();
          return true;
        } else if (execution.status === "failed") {
          failExecution(execution.error?.message);
          return true;
        } else if (execution.status === "cancelled") {
          failExecution("Execution cancelled");
          return true;
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
            const output = waitingNode.outputData as {
              type?: string;
              formConfig?: unknown;
            };
            if (output.type === "form") {
              pauseForForm(
                waitingNode.nodeId,
                output.formConfig ?? null,
              );
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
      client.off("execution.completed", handleExecutionCompleted);
      client.off("execution.failed", handleExecutionFailed);
      client.off("execution.cancelled", handleExecutionCancelled);
      client.off("execution.waiting_for_input", handleWaitingForInput);
      client.off("execution.node.started", nodeStarted);
      client.off("execution.node.completed", handleNodeCompleted);
      client.off("execution.node.failed", nodeFailed);
      client.off("execution.node.skipped", nodeSkipped);
      client.unsubscribe(channel);
      // Do NOT disconnect - singleton stays alive
    };
  }, [
    executionId,
    handleExecutionStarted,
    handleExecutionCompleted,
    handleExecutionFailed,
    handleExecutionCancelled,
    handleWaitingForInput,
    handleNodeEvent,
    handleNodeCompleted,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
  ]);

  return { isConnected };
}
