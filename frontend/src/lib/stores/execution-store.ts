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
  /**
   * Unique key per execution row in the backend (NodeExecution.id). When a
   * body node runs N times inside a Loop/ForEach/Map, each iteration gets
   * its own NodeExecution row and therefore its own NodeResult — keyed by
   * this id so iterations don't collapse into a single timeline entry.
   *
   * Optional for backwards compatibility with events that don't carry it
   * (e.g. legacy WS payloads, REST polling fallbacks). When absent, the
   * store falls back to keying by `nodeId` and overwrites in place.
   */
  nodeExecutionId?: string;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  nodeCategory: string;
  status: NodeExecutionStatus;
  duration?: number;
  error?: string;
  outputData: unknown;
  inputData?: unknown;
  /** ISO timestamp when this node started executing (for chronological sorting) */
  startedAt?: string;
}

export type WaitingInteractionType = "form" | "buttons" | "ai_conversation";

export interface ToolCallInfo {
  name: string;
  arguments?: string;
}

export interface ConversationItem {
  type: "user" | "assistant" | "tool";
  content: string;
  /** Tool calls made by the assistant in this message (function calling) */
  assistantToolCalls?: ToolCallInfo[];
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
/**
 * Find the most recently started result for a given nodeId and return the id
 * used by the timeline (per-iteration `nodeExecutionId` when present, else
 * the logical `nodeId`). Used when the engine signals a pause so the
 * currently selected row in the timeline matches the waiting node — without
 * this, highlight + preview go out of sync whenever the body chain has more
 * than one iteration.
 */
function latestResultIdForNode(
  results: NodeResult[],
  nodeId: string,
): string {
  const candidates = results.filter((r) => r.nodeId === nodeId);
  if (candidates.length === 0) return nodeId;
  const latest = candidates.reduce((best, r) =>
    (r.startedAt ?? "") > (best.startedAt ?? "") ? r : best,
  );
  return latest.nodeExecutionId ?? nodeId;
}

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
      // Prefer the per-execution-row id (backend NodeExecution.id) so iterations
      // of the same body node remain distinct entries.
      //
      // When the incoming event does NOT carry a nodeExecutionId (legacy
      // payloads, REST polling reconciliation, mid-flight waiting events),
      // fall back to updating the **most recent row for that nodeId** so we
      // don't strand the existing iteration entry and create a phantom
      // duplicate. The old strict "only rows without nodeExecutionId" match
      // caused the Carousel-after-button-click ghost row.
      let targetIndex = -1;
      if (result.nodeExecutionId) {
        targetIndex = state.nodeResults.findIndex(
          (r) => r.nodeExecutionId === result.nodeExecutionId,
        );
      } else {
        for (let i = state.nodeResults.length - 1; i >= 0; i--) {
          if (state.nodeResults[i].nodeId === result.nodeId) {
            targetIndex = i;
            break;
          }
        }
      }

      if (targetIndex >= 0) {
        const prev = state.nodeResults[targetIndex];
        const updated = state.nodeResults.map((r, idx) =>
          idx === targetIndex
            ? {
                ...r,
                ...result,
                // Preserve the original per-execution id once known so later
                // events without it don't erase it.
                nodeExecutionId: result.nodeExecutionId ?? r.nodeExecutionId,
                startedAt: result.startedAt ?? prev.startedAt,
                inputData: result.inputData ?? prev.inputData,
              }
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
    set((state) => ({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: formConfig,
      waitingInteractionType: "form",
      waitingButtonConfig: null,
      waitingConversationConfig: null,
      // Prefer the per-iteration id so the timeline highlights the exact row
      // that's waiting — falling back to nodeId for events that don't carry
      // a NodeExecution id.
      selectedResultNodeId: latestResultIdForNode(state.nodeResults, nodeId),
    })),

  resumeFromForm: () => set({ status: "running", ...CLEAR_WAITING }),

  pauseForButtons: (nodeId: string, buttonConfig: unknown) =>
    set((state) => ({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: null,
      waitingInteractionType: "buttons",
      waitingButtonConfig: buttonConfig,
      waitingConversationConfig: null,
      selectedResultNodeId: latestResultIdForNode(state.nodeResults, nodeId),
    })),

  resumeFromButtons: () => set({ status: "running", ...CLEAR_WAITING }),

  pauseForConversation: (nodeId: string, config: unknown) =>
    set((state) => ({
      status: "waiting_for_input",
      waitingNodeId: nodeId,
      waitingFormConfig: null,
      waitingInteractionType: "ai_conversation",
      waitingButtonConfig: null,
      waitingConversationConfig: config,
      isWaitingAiResponse: false,
      selectedResultNodeId: latestResultIdForNode(state.nodeResults, nodeId),
    })),

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
