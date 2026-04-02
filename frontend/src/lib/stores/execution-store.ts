"use client";

import { create } from "zustand";

export type ExecutionStatus =
  | "idle"
  | "running"
  | "completed"
  | "failed"
  | "waiting_for_input";

export type NodeExecutionStatus =
  | "pending"
  | "running"
  | "completed"
  | "failed"
  | "skipped"
  | "waiting_for_input";

export interface NodeStatusInfo {
  status: NodeExecutionStatus;
  duration?: number;
  error?: string;
}

export interface NodeResult {
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  outputData: unknown;
}

interface ExecutionState {
  executionId: string | null;
  status: ExecutionStatus;
  nodeStatuses: Map<string, NodeStatusInfo>;
  nodeResults: NodeResult[];
  startedAt: string | null;

  /** Form node waiting state */
  waitingNodeId: string | null;
  waitingFormConfig: unknown;

  startExecution: (executionId: string) => void;
  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) => void;
  addNodeResult: (result: NodeResult) => void;
  completeExecution: () => void;
  failExecution: (error?: string) => void;
  pauseForForm: (nodeId: string, formConfig: unknown) => void;
  resumeFromForm: () => void;
  reset: () => void;
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executionId: null,
  status: "idle",
  nodeStatuses: new Map(),
  nodeResults: [],
  startedAt: null,
  waitingNodeId: null,
  waitingFormConfig: null,

  startExecution: (executionId: string) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: new Date().toISOString(),
      waitingNodeId: null,
      waitingFormConfig: null,
    }),

  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) =>
    set((state) => {
      const updated = new Map(state.nodeStatuses);
      updated.set(nodeId, info);
      return { nodeStatuses: updated };
    }),

  addNodeResult: (result: NodeResult) =>
    set((state) => {
      // Avoid duplicate entries for the same node
      const exists = state.nodeResults.some((r) => r.nodeId === result.nodeId);
      if (exists) {
        return {
          nodeResults: state.nodeResults.map((r) =>
            r.nodeId === result.nodeId ? result : r,
          ),
        };
      }
      return { nodeResults: [...state.nodeResults, result] };
    }),

  completeExecution: () =>
    set({ status: "completed", waitingNodeId: null, waitingFormConfig: null }),

  failExecution: (error?: string) =>
    set((state) => {
      if (error && state.executionId) {
        const updated = new Map(state.nodeStatuses);
        updated.set("__execution__", {
          status: "failed",
          error,
        });
        return {
          status: "failed",
          nodeStatuses: updated,
          waitingNodeId: null,
          waitingFormConfig: null,
        };
      }
      return { status: "failed", waitingNodeId: null, waitingFormConfig: null };
    }),

  pauseForForm: (nodeId: string, formConfig: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: formConfig,
    }),

  resumeFromForm: () =>
    set({
      status: "running",
      waitingNodeId: null,
      waitingFormConfig: null,
    }),

  reset: () =>
    set({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: null,
      waitingNodeId: null,
      waitingFormConfig: null,
    }),
}));
