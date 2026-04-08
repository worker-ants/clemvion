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

export type WaitingInteractionType = "form" | "buttons" | "ai_conversation";

export interface ConversationItem {
  type: "user" | "assistant" | "tool";
  content: string;
  toolArgs?: unknown;
  toolResult?: unknown;
  toolStatus?: "success" | "error";
  turnIndex: number;
  /** Timestamp when the message was sent/received */
  timestamp?: string;
  /** Duration in ms (for assistant: LLM latency) */
  durationMs?: number;
  /** Raw request payload sent to LLM (assistant items only) */
  requestPayload?: unknown;
  /** Raw response payload from LLM (assistant items only) */
  responsePayload?: unknown;
  metadata?: {
    model?: string;
    inputTokens?: number;
    outputTokens?: number;
    toolCalls?: number;
    ragChunks?: number;
  };
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

  /** Interaction type discriminator */
  waitingInteractionType: WaitingInteractionType | null;
  /** Button config when waiting for button interaction */
  waitingButtonConfig: unknown;

  /** AI conversation state */
  waitingConversationConfig: unknown;
  conversationMessages: ConversationItem[];
  isWaitingAiResponse: boolean;

  /** Selected node in result timeline */
  selectedResultNodeId: string | null;
  /** Selected conversation item index (within the conversation) */
  selectedConversationItemIndex: number | null;

  startExecution: (executionId: string) => void;
  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) => void;
  addNodeResult: (result: NodeResult) => void;
  completeExecution: () => void;
  failExecution: (error?: string) => void;
  pauseForForm: (nodeId: string, formConfig: unknown) => void;
  resumeFromForm: () => void;
  pauseForButtons: (nodeId: string, buttonConfig: unknown) => void;
  resumeFromButtons: () => void;
  pauseForConversation: (nodeId: string, config: unknown) => void;
  resumeFromConversation: () => void;
  addConversationMessage: (item: ConversationItem) => void;
  updateConversationConfig: (config: unknown) => void;
  setWaitingAiResponse: (value: boolean) => void;
  selectResultNode: (nodeId: string | null) => void;
  selectConversationItem: (index: number | null) => void;
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

const CLEAR_WAITING = {
  waitingNodeId: null,
  waitingFormConfig: null,
  waitingInteractionType: null as WaitingInteractionType | null,
  waitingButtonConfig: null,
  waitingConversationConfig: null,
  conversationMessages: [] as ConversationItem[],
  isWaitingAiResponse: false,
  selectedConversationItemIndex: null,
};

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
  waitingConversationConfig: null,
  conversationMessages: [],
  isWaitingAiResponse: false,
  selectedResultNodeId: null,
  selectedConversationItemIndex: null,

  startExecution: (executionId: string) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: new Date().toISOString(),
      selectedResultNodeId: null,
      ...CLEAR_WAITING,
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

  completeExecution: () => set({ status: "completed", ...CLEAR_WAITING }),

  failExecution: (error?: string) =>
    set((state) => {
      if (error && state.executionId) {
        const updated = new Map(state.nodeStatuses);
        updated.set("__execution__", {
          status: "failed",
          error,
        });
        return {
          status: "failed" as ExecutionStatus,
          nodeStatuses: updated,
          ...CLEAR_WAITING,
        };
      }
      return { status: "failed" as ExecutionStatus, ...CLEAR_WAITING };
    }),

  pauseForForm: (nodeId: string, formConfig: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: formConfig,
      waitingInteractionType: "form",
      waitingButtonConfig: null,
      waitingConversationConfig: null,
    }),

  resumeFromForm: () => set({ status: "running", ...CLEAR_WAITING }),

  pauseForButtons: (nodeId: string, buttonConfig: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: null,
      waitingInteractionType: "buttons",
      waitingButtonConfig: buttonConfig,
      waitingConversationConfig: null,
    }),

  resumeFromButtons: () => set({ status: "running", ...CLEAR_WAITING }),

  pauseForConversation: (nodeId: string, config: unknown) =>
    set({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: null,
      waitingInteractionType: "ai_conversation",
      waitingButtonConfig: null,
      waitingConversationConfig: config,
      isWaitingAiResponse: false,
    }),

  resumeFromConversation: () => set({ status: "running", ...CLEAR_WAITING }),

  addConversationMessage: (item: ConversationItem) =>
    set((state) => ({
      conversationMessages: [...state.conversationMessages, item],
    })),

  updateConversationConfig: (config: unknown) =>
    set((state) => {
      // Merge with existing config to preserve maxTurns, turnTimeout etc.
      const existing = state.waitingConversationConfig as Record<string, unknown> | null;
      const incoming = config as Record<string, unknown> | null;
      return {
        waitingConversationConfig: existing && incoming
          ? { ...existing, ...incoming }
          : incoming ?? existing,
        isWaitingAiResponse: false,
      };
    }),

  setWaitingAiResponse: (value: boolean) =>
    set({ isWaitingAiResponse: value }),

  selectResultNode: (nodeId: string | null) =>
    set({ selectedResultNodeId: nodeId, selectedConversationItemIndex: null }),

  selectConversationItem: (index: number | null) =>
    set({ selectedConversationItemIndex: index }),

  reset: () =>
    set({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      nodeResults: [],
      startedAt: null,
      selectedResultNodeId: null,
      ...CLEAR_WAITING,
    }),
}));
