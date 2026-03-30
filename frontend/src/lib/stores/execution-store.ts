"use client";

import { create } from "zustand";

export type ExecutionStatus = "idle" | "running" | "completed" | "failed";

export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped";

export interface NodeStatusInfo {
  status: NodeExecutionStatus;
  duration?: number;
  error?: string;
}

interface ExecutionState {
  executionId: string | null;
  status: ExecutionStatus;
  nodeStatuses: Map<string, NodeStatusInfo>;
  startedAt: string | null;

  startExecution: (executionId: string) => void;
  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) => void;
  completeExecution: () => void;
  failExecution: (error?: string) => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executionId: null,
  status: "idle",
  nodeStatuses: new Map(),
  startedAt: null,

  startExecution: (executionId: string) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      startedAt: new Date().toISOString(),
    }),

  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) =>
    set((state) => {
      const updated = new Map(state.nodeStatuses);
      updated.set(nodeId, info);
      return { nodeStatuses: updated };
    }),

  completeExecution: () => set({ status: "completed" }),

  failExecution: (error?: string) =>
    set((state) => {
      if (error && state.executionId) {
        const updated = new Map(state.nodeStatuses);
        // Store the overall error on a special key
        updated.set("__execution__", {
          status: "failed",
          error,
        });
        return { status: "failed", nodeStatuses: updated };
      }
      return { status: "failed" };
    }),

  reset: () =>
    set({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      startedAt: null,
    }),
}));
