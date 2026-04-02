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
const POLL_INTERVAL_WAITING_MS = 10000; // Slower polling when waiting for form input

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
        // Update node status and result to waiting_for_input
        updateNodeStatus(payload.waitingNodeId, {
          status: "waiting_for_input",
        });
        addNodeResult({
          nodeId: payload.waitingNodeId,
          nodeLabel: payload.waitingNodeId,
          nodeType: "form",
          nodeCategory: "presentation",
          status: "waiting_for_input",
          outputData: payload.nodeOutput ?? null,
        });
        pauseForForm(payload.waitingNodeId, output?.formConfig ?? null);
      }
    },
    [pauseForForm, updateNodeStatus, addNodeResult],
  );

  const handleNodeStarted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
      };
      if (payload.nodeId) {
        // Guard against out-of-order events (e.g., completed arriving before started)
        const existing =
          useExecutionStore.getState().nodeStatuses.get(payload.nodeId);
        if (!shouldUpdateStatus(existing?.status, "running")) return;

        updateNodeStatus(payload.nodeId, { status: "running" });
        addNodeResult({
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "running",
          outputData: null,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeCompleted = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        duration?: number;
        nodeType?: string;
        nodeLabel?: string;
        output?: Record<string, unknown>;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "completed",
          duration: payload.duration,
        });

        addNodeResult({
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "completed",
          duration: payload.duration,
          outputData: payload.output ?? null,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeFailed = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        error?: string;
        nodeType?: string;
        nodeLabel?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, {
          status: "failed",
          error: payload.error,
        });
        addNodeResult({
          nodeId: payload.nodeId,
          nodeLabel: payload.nodeLabel ?? payload.nodeId,
          nodeType: payload.nodeType ?? "unknown",
          nodeCategory: getCategoryForType(payload.nodeType ?? "unknown"),
          status: "failed",
          error: payload.error,
          outputData: null,
        });
      }
    },
    [updateNodeStatus, addNodeResult],
  );

  const handleNodeSkipped = useCallback(
    (data: unknown) => {
      const payload = data as {
        nodeId?: string;
        nodeType?: string;
        nodeLabel?: string;
      };
      if (payload.nodeId) {
        updateNodeStatus(payload.nodeId, { status: "skipped" });
        addNodeResult({
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
    client.on("execution.completed", handleExecutionCompleted);
    client.on("execution.failed", handleExecutionFailed);
    client.on("execution.cancelled", handleExecutionCancelled);
    client.on("execution.waiting_for_input", handleWaitingForInput);

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
        const response = await executionsApi.getById(executionId);
        if (cancelledRef.current) return true;

        const execution = response.data;

        // Reconcile node-level statuses
        if (execution.nodeExecutions) {
          for (const ne of execution.nodeExecutions) {
            const nodeType = ne.node?.type ?? "unknown";
            const nodeLabel = ne.node?.label ?? ne.nodeId;

            updateNodeStatus(ne.nodeId, {
              status: mapNodeStatus(ne.status),
              duration: ne.durationMs ?? undefined,
              error: ne.error?.message,
            });

            // Add all nodes to results timeline
            addNodeResult({
              nodeId: ne.nodeId,
              nodeLabel,
              nodeType,
              nodeCategory: getCategoryForType(nodeType),
              status: mapNodeStatus(ne.status),
              duration: ne.durationMs ?? undefined,
              error: ne.error?.message,
              outputData: ne.outputData,
            });
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
    handleExecutionCompleted,
    handleExecutionFailed,
    handleExecutionCancelled,
    handleWaitingForInput,
    handleNodeStarted,
    handleNodeCompleted,
    handleNodeFailed,
    handleNodeSkipped,
    updateNodeStatus,
    addNodeResult,
    completeExecution,
    failExecution,
    pauseForForm,
  ]);

  return { isConnected };
}
