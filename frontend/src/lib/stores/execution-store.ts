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
  nodeCategory: string;
  status: NodeExecutionStatus;
  duration?: number;
  error?: string;
  outputData: unknown;
  /** ISO timestamp when this node started executing (for chronological sorting) */
  startedAt?: string;
}

export type WaitingInteractionType = "form" | "buttons";

interface ExecutionState {
  executionId: string | null;
  status: ExecutionStatus;
  nodeStatuses: Map<string, NodeStatusInfo>;
  nodeResults: NodeResult[];
  startedAt: string | null;

  /** Form node waiting state */
  waitingNodeId: string | null;
  waitingFormConfig: unknown;

  /** Interaction type discriminator */
  waitingInteractionType: WaitingInteractionType | null;
  /** Button config when waiting for button interaction */
  waitingButtonConfig: unknown;

  /** Selected node in result timeline */
  selectedResultNodeId: string | null;

  startExecution: (executionId: string) => void;
  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) => void;
  addNodeResult: (result: NodeResult) => void;
  completeExecution: () => void;
  failExecution: (error?: string) => void;
  pauseForForm: (nodeId: string, formConfig: unknown) => void;
  resumeFromForm: () => void;
  pauseForButtons: (nodeId: string, buttonConfig: unknown) => void;
  resumeFromButtons: () => void;
  selectResultNode: (nodeId: string | null) => void;
  reset: () => void;
}

/** Sort node results chronologically by startedAt timestamp */
function sortByStartedAt(results: NodeResult[]): NodeResult[] {
  return [...results].sort((a, b) => {
    if (!a.startedAt && !b.startedAt) return 0;
    if (!a.startedAt) return 1;
    if (!b.startedAt) return -1;
    return new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
  });
}

export const useExecutionStore = create<ExecutionState>((set) => ({
  executionId: null,
  status: "idle",
  nodeStatuses: new Map(),
  nodeResults: [],
  startedAt: null,
  waitingNodeId: null,
  waitingFormConfig: null,
  waitingInteractionType: null,
  waitingButtonConfig: null,
  selectedResultNodeId: null,

  startExecution: (executionId: string) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: new Date().toISOString(),
      waitingNodeId: null,
      waitingFormConfig: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
      selectedResultNodeId: null,
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
        const updated = state.nodeResults.map((r) =>
          r.nodeId === result.nodeId
            ? { ...result, startedAt: result.startedAt ?? r.startedAt }
            : r,
        );
        return { nodeResults: sortByStartedAt(updated) };
      }
      const appended = [...state.nodeResults, result];
      return { nodeResults: sortByStartedAt(appended) };
    }),

  completeExecution: () =>
    set({ status: "completed", waitingNodeId: null, waitingFormConfig: null, waitingInteractionType: null, waitingButtonConfig: null }),

  failExecution: (error?: string) =>
    set((state) => {
      const clearWaiting = {
        waitingNodeId: null,
        waitingFormConfig: null,
        waitingInteractionType: null as WaitingInteractionType | null,
        waitingButtonConfig: null,
      };
      if (error && state.executionId) {
        const updated = new Map(state.nodeStatuses);
        updated.set("__execution__", {
          status: "failed",
          error,
        });
        return {
          status: "failed" as ExecutionStatus,
          nodeStatuses: updated,
          ...clearWaiting,
        };
      }
      return { status: "failed" as ExecutionStatus, ...clearWaiting };
    }),

  pauseForForm: (nodeId: string, formConfig: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: formConfig,
      waitingInteractionType: "form",
      waitingButtonConfig: null,
    }),

  resumeFromForm: () =>
    set({
      status: "running",
      waitingNodeId: null,
      waitingFormConfig: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
    }),

  pauseForButtons: (nodeId: string, buttonConfig: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: null,
      waitingInteractionType: "buttons",
      waitingButtonConfig: buttonConfig,
    }),

  resumeFromButtons: () =>
    set({
      status: "running",
      waitingNodeId: null,
      waitingFormConfig: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
    }),

  selectResultNode: (nodeId: string | null) =>
    set({ selectedResultNodeId: nodeId }),

  reset: () =>
    set({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: null,
      waitingNodeId: null,
      waitingFormConfig: null,
      waitingInteractionType: null,
      waitingButtonConfig: null,
      selectedResultNodeId: null,
    }),
}));
