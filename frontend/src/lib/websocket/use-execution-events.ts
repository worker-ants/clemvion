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
    default:
      return "pending";
  }
}

export function useExecutionEvents({
  executionId,
}: UseExecutionEventsOptions): UseExecutionEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const cancelledRef = useRef(false);

  const { startExecution, updateNodeStatus, completeExecution, failExecution } =
    useExecutionStore();

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

    // Bind node events
    const nodeStarted = handleNodeEvent("running");
    const nodeCompleted = handleNodeEvent("completed");
    const nodeFailed = handleNodeEvent("failed");
    const nodeSkipped = handleNodeEvent("skipped");

    client.on("execution.node.started", nodeStarted);
    client.on("execution.node.completed", nodeCompleted);
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
          }
        }

        // Reconcile execution-level status
        // Note: "cancelled" maps to "failed" in the UI store because the store
        // only has idle/running/completed/failed states. Cancellation is treated
        // as a terminal failure with a descriptive message.
        if (execution.status === "completed") {
          completeExecution();
          return true;
        } else if (execution.status === "failed") {
          failExecution(execution.error?.message);
          return true;
        } else if (execution.status === "cancelled") {
          failExecution("Execution cancelled");
          return true;
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
    // First poll runs right away, then repeats every POLL_INTERVAL_MS until
    // execution reaches a terminal state.
    let pollTimer: ReturnType<typeof setTimeout> | null = null;

    const startPolling = async () => {
      if (cancelledRef.current) return;
      const isTerminal = await pollExecutionStatus();
      if (!isTerminal && !cancelledRef.current) {
        pollTimer = setTimeout(() => void startPolling(), POLL_INTERVAL_MS);
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
      client.off("execution.node.started", nodeStarted);
      client.off("execution.node.completed", nodeCompleted);
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
    handleNodeEvent,
    updateNodeStatus,
    completeExecution,
    failExecution,
  ]);

  return { isConnected };
}
