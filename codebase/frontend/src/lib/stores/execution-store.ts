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
  /**
   * When present, this node ran inside an inline Sub-Workflow invocation and
   * the value is the `nodeExecutionId` of the invoking Sub-Workflow (`workflow`
   * node) row. Used by the run-results timeline to group children under a
   * Sub-Workflow card.
   */
  parentNodeExecutionId?: string;
}

/**
 * spec/5-system/6-websocket-protocol.md §4.4 의 `interactionType` 4값.
 * `ai_form_render` 는 AI Agent multi-turn 이 `render_form` 도구를 호출해
 * 사용자 form 제출을 대기 중일 때 emit 된다 — `submit_form` 명령으로
 * 응답해야 한다 (spec/4-nodes/3-ai/1-ai-agent.md §6.1.d.ii).
 */
export type WaitingInteractionType =
  | "form"
  | "buttons"
  | "ai_conversation"
  | "ai_form_render";

export interface ToolCallInfo {
  name: string;
  arguments?: string;
}

import type {
  PresentationPayload,
  SystemErrorTurnData,
} from "@/lib/conversation/conversation-utils";

/**
 * Discriminator for a conversation timeline item. Mirrors
 * `ConversationTurnSource` (spec/conventions/conversation-thread.md §1.1) but
 * folded into the existing 3 `user`/`assistant`/`tool` ConversationItem shapes
 * for AI-Agent-owned items, plus two extra kinds for thread context that
 * isn't an AI turn:
 *
 * - `"presentation"` — a `presentation_user` turn (Form/Carousel/Template
 *   click / form submit / link continue). Rendered as a grey system card
 *   (spec §9.1) with structured metadata from `presentation` field, not a
 *   chat bubble.
 * - `"system"` — a `system` turn (workflow-level manual push; v1 has no
 *   automatic push but the UI shape is reserved so we don't need a follow-up
 *   migration when v2 ships).
 *
 * @todo Remove the "reserved" qualifier on `"system"` once v2 ships automatic
 *   push for it (see spec conversation-thread §1.1 "예약, v1 자동 누적 없음").
 */
export interface ConversationItem {
  type:
    | "user"
    | "assistant"
    | "tool"
    | "presentation"
    | "system"
    | "system_error";
  content: string;
  /**
   * Structured payload for `type: "system_error"` items — the inline error
   * marker that appears in the conversation thread when an AI Agent multi-turn
   * node ends with `output.error` set.
   *
   * SoT: spec/conventions/conversation-thread.md §1.2 `data?` 행 비고 +
   * §9.1 매핑표. `code` / `message` / `retryable` / `retryAfterSec` 는
   * `output.error.{code, message, details.retryable, details.retryAfterSec}`
   * 의 1:1 snapshot.
   */
  systemError?: SystemErrorTurnData;
  /**
   * Structured metadata for `type: "presentation"` items, snapshotted from
   * `ConversationTurn.{nodeLabel, nodeType, data}` and the originating
   * `interaction.type`. Lets the renderer compose the chip header and body
   * without parsing `content` (spec/conventions/conversation-thread.md §9.1).
   */
  presentation?: {
    nodeLabel: string;
    nodeType: string;
    interactionType: "button_click" | "form_submitted" | "button_continue";
    data?: Record<string, unknown>;
  };
  /** Tool calls made by the assistant in this message (function calling) */
  assistantToolCalls?: ToolCallInfo[];
  /**
   * `type === 'assistant'` 한정 — AI Agent 가 `render_*` 도구
   * (spec/4-nodes/3-ai/1-ai-agent.md §4.1) 로 emit 한 페이로드. chat UI 가
   * `content` (텍스트 응답) 아래에 inline 으로 렌더한다.
   */
  presentations?: PresentationPayload[];
  toolArgs?: unknown;
  toolResult?: unknown;
  /**
   * `pending` is used live while the provider is executing; turns into
   * `success` / `error` once the result is known. History rebuilds from
   * `meta.turnDebug[].toolCalls` so completed runs only ever see
   * success/error.
   */
  toolStatus?: "pending" | "success" | "error";
  /** Matches assistant.toolCalls[].id and the tool message's toolCallId.
   * Used by live event handlers to upsert/patch the right item. */
  toolCallId?: string;
  /** Human-readable error message when toolStatus is 'error'. */
  error?: string;
  turnIndex: number;
  /**
   * `true` when this item was produced by `ConversationThread` injection
   * (an upstream node's turn prepended to messages) rather than processed
   * live by the current AI node. Mirrors the WebSocket payload's
   * `messages[].source === 'injected'` (spec/5-system/6-websocket-protocol.md
   * §4.4.6).
   *
   * Optional because older persisted data may omit the marker — treat
   * undefined the same as `false` (i.e. live). Used by the debugging
   * timeline to skip injected user messages when computing turn indices,
   * and by UI to render an "injected context" chip.
   */
  isInjected?: boolean;
  /** Timestamp when the message was sent/received */
  timestamp?: string;
  /** Duration in ms (for assistant: LLM latency, for tool: provider exec time) */
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
  /**
   * AI Agent `render_form` 활성 form 제출 후의 별도 resume action.
   *
   * spec/conventions/conversation-thread.md §9.7.1 + §9.9 Inv-7 — 일반
   * `resumeFromForm` 가 `CLEAR_INPUT_AFFORDANCE` 로 affordance 전체를
   * 클리어해 multi-turn 컨텍스트까지 날려버려 timeline 깜빡임 회귀가 났다.
   * 본 action 은 `waitingConversationConfig.pendingFormToolCall` 만
   * nested null patch 로 클리어하고 `waitingNodeId` /
   * `waitingInteractionType: 'ai_form_render'` / 그 외 conversation config /
   * `isWaitingAiResponse: true` 는 모두 보존한다.
   */
  resumeFromAiRenderForm: () => void;
  addConversationMessage: (item: ConversationItem) => void;
  /**
   * Replace the entire conversation message list. Used when an authoritative
   * snapshot arrives (e.g. `execution.ai_message` payload's `messages` array)
   * so live + history representations stay in sync — including tool items
   * that aren't surfaced via `addConversationMessage`.
   */
  setConversationMessages: (items: ConversationItem[]) => void;
  /**
   * Append a tool ConversationItem if no item with the same `toolCallId`
   * exists; otherwise no-op. Used by `tool_call_started` to render the
   * pending state without duplicating across reconnects/snapshots.
   * When `item.toolCallId` is undefined, falls back to a plain append
   * without dedup — the caller must accept potential duplicates.
   */
  upsertToolItem: (item: ConversationItem) => void;
  /**
   * Patch the tool ConversationItem matching `toolCallId`. No-op if no
   * matching item is found (the snapshot path will recreate it later).
   */
  updateToolItem: (toolCallId: string, patch: Partial<ConversationItem>) => void;
  /**
   * Flip every pending tool item to `error`. Called when the execution or
   * the AI Agent node terminates without sending matching
   * `tool_call_completed` events (e.g. backend crash mid-call) so the
   * timeline doesn't keep an infinite spinner.
   */
  flushPendingToolItemsAsError: (reason: string) => void;
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

/**
 * Lifecycle 별 store reset 정책 — SoT:
 * spec/conventions/conversation-thread.md §9.7.1 + §9.9 Inv-6.
 *
 * `CLEAR_WAITING` 단일 묶음을 두 개로 분리:
 * - `CLEAR_INPUT_AFFORDANCE`: 입력 대기 UI 상태만 (waitingNodeId 등)
 * - `CLEAR_CONVERSATION_SNAPSHOT`: conversationMessages 만
 *
 * `completeExecution` / `failExecution` / `resumeFrom*` 은 INPUT_AFFORDANCE
 * 만 적용해 대화를 보존한다 (Inv-6). `startExecution` 만 두 묶음 모두 적용.
 *
 * 2026-05-23 사용자 보고 — Gemini 429 quota 시 multi-turn 대화 전체 소실
 * 회귀 차단.
 */
const CLEAR_INPUT_AFFORDANCE = {
  waitingNodeId: null,
  waitingFormConfig: null,
  waitingInteractionType: null as WaitingInteractionType | null,
  waitingButtonConfig: null,
  waitingConversationConfig: null,
  isWaitingAiResponse: false,
  selectedConversationItemIndex: null,
};

const CLEAR_CONVERSATION_SNAPSHOT = {
  conversationMessages: [] as ConversationItem[],
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
      // §9.7.1 — startExecution 만 두 묶음 모두 클리어
      ...CLEAR_INPUT_AFFORDANCE,
      ...CLEAR_CONVERSATION_SNAPSHOT,
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
        // Preserve the previously-known label when the incoming event only
        // carries the node id (the legacy waiting_for_input payload uses the
        // id as a placeholder when the backend didn't include a label).
        const incomingLabelIsPlaceholder =
          result.nodeLabel === result.nodeId && !!prev.nodeLabel;
        const mergedLabel = incomingLabelIsPlaceholder
          ? prev.nodeLabel
          : result.nodeLabel;
        const updated = state.nodeResults.map((r, idx) =>
          idx === targetIndex
            ? {
                ...r,
                ...result,
                nodeLabel: mergedLabel,
                // Preserve the original per-execution id once known so later
                // events without it don't erase it.
                nodeExecutionId: result.nodeExecutionId ?? r.nodeExecutionId,
                // Same for parentNodeExecutionId — some mid-flight events
                // (waiting_for_input) don't carry it, and losing it would
                // collapse the Sub-Workflow card back to a flat row.
                parentNodeExecutionId:
                  result.parentNodeExecutionId ?? r.parentNodeExecutionId,
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

  // §9.7.1 — completeExecution 은 입력 affordance 만 클리어, conversation 은 보존
  completeExecution: () =>
    set({ status: "completed", ...CLEAR_INPUT_AFFORDANCE }),

  // §9.7.1 + §9.9 Inv-6 — failExecution 은 입력 affordance 만 클리어, conversation 은 보존
  // (2026-05-23 사용자 보고 — Gemini 429 quota 시 대화 전체 소실 회귀 차단)
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
          ...CLEAR_INPUT_AFFORDANCE,
        };
      }
      return {
        status: "failed" as ExecutionStatus,
        ...CLEAR_INPUT_AFFORDANCE,
      };
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

  resumeFromForm: () => set({ status: "running", ...CLEAR_INPUT_AFFORDANCE }),

  // spec/conventions/conversation-thread.md §9.7.1 + §9.9 Inv-7 — AI Agent
  // render_form 활성 form 제출 직후 호출. multi-turn 컨텍스트 (waitingNodeId /
  // waitingInteractionType: 'ai_form_render' / 그 외 conversation config /
  // isWaitingAiResponse: true) 는 모두 보존하고, conversationConfig 안의
  // `pendingFormToolCall` 만 nested null patch 로 클리어한다. 옛 `resumeFromForm`
  // 호출이 `CLEAR_INPUT_AFFORDANCE` 로 affordance 전체를 날려 ConversationInspector
  // 가 live → completed 분기로 떨어지면서 server-side waiting 상태에서
  // preview = null 로 깜빡이던 회귀 차단.
  resumeFromAiRenderForm: () =>
    set((state) => {
      const conv = state.waitingConversationConfig;
      // Shallow spread — conv 의 top-level 필드만 복사되고 중첩 객체는
      // reference 를 공유한다. conv 하위 필드는 immutable-by-convention
      // (Zustand 패턴) 이므로 현재는 충분; 향후 deep mutation 이 필요하면
      // structuredClone 으로 교체.
      const nextConv =
        conv && typeof conv === "object"
          ? { ...(conv as Record<string, unknown>), pendingFormToolCall: null }
          : conv;
      return {
        status: "running",
        waitingConversationConfig: nextConv,
      };
    }),

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

  resumeFromButtons: () =>
    set({ status: "running", ...CLEAR_INPUT_AFFORDANCE }),

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

  resumeFromConversation: () =>
    set({ status: "running", ...CLEAR_INPUT_AFFORDANCE }),

  addConversationMessage: (item: ConversationItem) =>
    set((state) => ({
      conversationMessages: [...state.conversationMessages, item],
    })),

  setConversationMessages: (items: ConversationItem[]) =>
    set((state) => {
      const idx = state.selectedConversationItemIndex;
      // Preserve the user's selection when the new array is at least as long;
      // otherwise drop it so the inspector falls back to the node-level view.
      const nextIndex =
        idx != null && idx >= 0 && idx < items.length ? idx : null;
      return {
        conversationMessages: items,
        selectedConversationItemIndex: nextIndex,
      };
    }),

  upsertToolItem: (item: ConversationItem) =>
    set((state) => {
      if (!item.toolCallId) {
        // Without an id we can't dedup, so fall back to plain append.
        return { conversationMessages: [...state.conversationMessages, item] };
      }
      const exists = state.conversationMessages.some(
        (i) => i.toolCallId === item.toolCallId,
      );
      if (exists) return {};
      return { conversationMessages: [...state.conversationMessages, item] };
    }),

  updateToolItem: (toolCallId: string, patch: Partial<ConversationItem>) =>
    set((state) => {
      let touched = false;
      const next = state.conversationMessages.map((i) => {
        if (i.toolCallId === toolCallId) {
          touched = true;
          return { ...i, ...patch };
        }
        return i;
      });
      if (!touched) return {};
      return { conversationMessages: next };
    }),

  flushPendingToolItemsAsError: (reason: string) =>
    set((state) => {
      let touched = false;
      const next = state.conversationMessages.map((i) => {
        if (i.type === "tool" && i.toolStatus === "pending") {
          touched = true;
          return { ...i, toolStatus: "error" as const, error: reason };
        }
        return i;
      });
      if (!touched) return {};
      return { conversationMessages: next };
    }),

  updateConversationConfig: (config: unknown) =>
    set((state) => {
      // Merge with existing config to preserve maxTurns etc.
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
      // reset 은 idle 복귀 — 두 묶음 모두 클리어 (startExecution 과 동일 정책)
      ...CLEAR_INPUT_AFFORDANCE,
      ...CLEAR_CONVERSATION_SNAPSHOT,
    }),
}));

/**
 * `waitingInteractionType === 'ai_form_render'` 인 경우 활성 form 의 toolCallId
 * 를 반환하는 파생 selector. 단일 정의를 유지하여 shape 변경 시 한 곳만 수정하면 된다.
 *
 * `page.tsx` 와 `run-results-drawer.tsx` 두 곳에서 동일 로직이 중복되던 것을
 * 통일 (spec/conventions/conversation-thread.md §9.7.1 단일 진실 원칙).
 *
 * 사용 예: `useExecutionStore(selectPendingFormToolCallId)`
 */
export function selectPendingFormToolCallId(
  state: Pick<
    ReturnType<typeof useExecutionStore.getState>,
    "waitingInteractionType" | "waitingConversationConfig"
  >,
): string | null {
  if (state.waitingInteractionType !== "ai_form_render") return null;
  return (
    (
      state.waitingConversationConfig as
        | { pendingFormToolCall?: { toolCallId?: string } | null }
        | null
    )?.pendingFormToolCall?.toolCallId ?? null
  );
}
