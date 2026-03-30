"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createWsClient, WsClient } from "./ws-client";
import {
  useExecutionStore,
  NodeExecutionStatus,
} from "../stores/execution-store";
import { getAccessToken } from "../api/client";

interface UseExecutionEventsOptions {
  executionId: string | null;
}

interface UseExecutionEventsReturn {
  isConnected: boolean;
}

export function useExecutionEvents({
  executionId,
}: UseExecutionEventsOptions): UseExecutionEventsReturn {
  const [isConnected, setIsConnected] = useState(false);
  const clientRef = useRef<WsClient | null>(null);

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

    const client = createWsClient();
    clientRef.current = client;

    client.connect(token);

    // Track connection state
    const onConnect = () => setIsConnected(true);
    const onDisconnect = () => setIsConnected(false);

    client.on("connect", onConnect);
    client.on("disconnect", onDisconnect);

    // Subscribe to execution channel
    // Small delay to ensure connection is ready
    const subscribeTimer = setTimeout(() => {
      client.subscribe(`execution:${executionId}`);
    }, 100);

    // Bind execution events
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

    return () => {
      clearTimeout(subscribeTimer);
      client.off("connect", onConnect);
      client.off("disconnect", onDisconnect);
      client.off("execution.started", handleExecutionStarted);
      client.off("execution.completed", handleExecutionCompleted);
      client.off("execution.failed", handleExecutionFailed);
      client.off("execution.cancelled", handleExecutionCancelled);
      client.off("execution.node.started", nodeStarted);
      client.off("execution.node.completed", nodeCompleted);
      client.off("execution.node.failed", nodeFailed);
      client.off("execution.node.skipped", nodeSkipped);
      client.unsubscribe(`execution:${executionId}`);
      client.disconnect();
      clientRef.current = null;
    };
  }, [
    executionId,
    handleExecutionStarted,
    handleExecutionCompleted,
    handleExecutionFailed,
    handleExecutionCancelled,
    handleNodeEvent,
  ]);

  return { isConnected };
}
