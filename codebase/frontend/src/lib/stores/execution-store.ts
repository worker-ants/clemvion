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
  | "cancelled"
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
   * Internal cache of `Date.parse(startedAt)` computed once on ingest — **not
   * for display** (display must go through `@/lib/utils/date`, see AGENTS.md);
   * used only as the numeric comparison key by `selectSortedNodeResults` so
   * the timeline sort never re-parses the ISO string per comparison.
   * `undefined` when `startedAt` is absent.
   */
  startedAtEpoch?: number;
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
  /**
   * `true` for a client-side optimistic `user` bubble that `sendMessage`
   * (use-execution-interaction-commands) appends the instant the user hits
   * send — before the authoritative `execution.user_message` echo arrives.
   *
   * The echo handler (`appendOptimisticUserMessage`) reconciles this item —
   * stamping its server `receivedAt` and clearing this flag — instead of
   * appending a *second* bubble. Without it the local bubble (client
   * timestamp) and the WS echo (server `receivedAt`) coexist as two identical
   * user messages throughout the "AI 응답 대기" window, collapsing back to one
   * only when the turn-end `ai_message` snapshot REPLACE arrives — the
   * reported "한 메시지가 둘로 보이다 합쳐짐" bug.
   *
   * Absent on authoritative `ai_message` snapshots (`messagesToConversationItems`
   * never sets it), so it self-clears on REPLACE. An echo with no matching
   * local optimistic bubble (channel inbound / observer client) still appends
   * normally (spec/conventions/conversation-thread.md §9.7,
   * spec/5-system/6-websocket-protocol.md §4.4).
   */
  optimisticPending?: boolean;
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
  /**
   * Arrival-ordered (NOT sorted). The chronological timeline order is derived
   * on read via `selectSortedNodeResults`. Keeping arrival order stable means
   * array indices never shift, so the derived index Maps below stay valid
   * without rebuilds on every event.
   */
  nodeResults: NodeResult[];
  /**
   * Derived lookup indices kept in sync with `nodeResults` on every mutation
   * (append/update/clear). They live on state to mirror the existing
   * `nodeStatuses` Map pattern but are not meant to be React-subscribed —
   * consumers read them through `findNodeResult`. SoT for the predicate
   * semantics: use-execution-events.ts 4 `.find()` sites + addNodeResult
   * fallback.
   */
  /** nodeExecutionId → index into `nodeResults`. */
  nodeResultIndexByExecId: Map<string, number>;
  /** nodeId → index of the most recently appended row for that nodeId
   *  (replaces addNodeResult's reverse "most recent row" scan). */
  lastIndexByNodeId: Map<string, number>;
  /** nodeId → index of the FIRST row appended WITHOUT a nodeExecutionId
   *  (preserves the `.find()` first-match semantics of the 4 event sites'
   *  `!r.nodeExecutionId && r.nodeId === nodeId` predicate). A row dropped
   *  from here once it acquires a nodeExecutionId via update. */
  firstNoExecIdIndexByNodeId: Map<string, number>;
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

  /**
   * Run Results 드로어 본문의 펼침/접힘 상태 (spec/3-workflow-editor/3-execution.md
   * §10.12 — Ctrl+Shift+R 토글 대상). 드로어 자체는 `status !== 'idle'` 일 때만
   * 렌더되며, 이 플래그는 그 안에서 본문(타임라인/상세)을 보이거나 헤더 바만 남길지
   * 제어한다. 실행 라이프사이클과 무관한 UI 상태라 `reset`/`startExecution` 의 CLEAR
   * 묶음 대상이 아니다 — 워크플로를 이동/재실행해도 직전 펼침 상태를 유지한다(의도).
   *
   * 단, `panelHeight`/`timelineWidth`(드로어 컴포넌트의 로컬 state + localStorage 지속)
   * 와 달리 **세션 한정 메모리 상태**다 — 새로고침 시 기본값 `true` 로 돌아간다. 토글은
   * 한 편집 세션 안의 일시적 선호이므로 persist 비대상으로 둔다(영속 필요 시 별도 결정).
   */
  drawerExpanded: boolean;

  startExecution: (executionId: string) => void;
  /**
   * §7 인-에디터 실행 히스토리 — 과거 실행을 캔버스 오버레이 + Run Results
   * 드로어로 적재하기 위한 reset. `startExecution` 과 동일하게 per-execution
   * 상태(노드 결과/상태 맵·대화 스냅샷·입력 affordance)를 비우되, ① `status`
   * 는 호출자가 `applyExecutionSnapshot` 으로 실제 terminal/waiting 상태를
   * 채울 때까지의 transient 값(`'running'`)이고, ② `startedAt` 은 (지금이
   * 아니라) 과거 실행의 실제 시작 시각을 보존한다. `executionId` 를 세팅하므로
   * 드로어의 Re-run(§10.14 = §7.3 "이 입력으로 다시 실행")·상세 조회가 동작한다.
   */
  startHistoryView: (executionId: string, startedAt: string | null) => void;
  updateNodeStatus: (nodeId: string, info: NodeStatusInfo) => void;
  addNodeResult: (result: NodeResult) => void;
  /**
   * O(1) replacement for the 4 `useExecutionStore.getState().nodeResults.find(...)`
   * sites in use-execution-events.ts. Predicate is identical: when
   * `nodeExecutionId` is present, match the row with that exec id; otherwise
   * return the FIRST row appended without a nodeExecutionId for `nodeId`
   * (matching the old `.find(r => !r.nodeExecutionId && r.nodeId === nodeId)`).
   */
  findNodeResult: (
    nodeExecutionId: string | undefined,
    nodeId: string,
  ) => NodeResult | undefined;
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
   * Append an optimistic `user` ConversationItem for the `execution.user_message`
   * live signal (spec/5-system/6-websocket-protocol.md §4.4 / Conversation Thread
   * §9.7), surfacing the user utterance(q) before the AI response(a) is generated.
   * Dedups by `receivedAt` (stored on `timestamp`) so WS re-emit / re-subscribe
   * doesn't double-append. The authoritative `ai_message` snapshot
   * (`setConversationMessages` REPLACE) reconciles this bubble afterward.
   *
   * Reconcile branch: if a client-side `optimisticPending` bubble (appended by
   * `sendMessage` the instant the user hits send) exists with matching `content`,
   * this action stamps the server `receivedAt` and clears the flag **instead of
   * appending a second bubble**. Without this branch the local bubble and the WS
   * echo coexist as duplicates until `ai_message` REPLACE collapses them —
   * the "한 메시지가 둘로 보이다 합쳐짐" regression fixed in this commit.
   */
  appendOptimisticUserMessage: (args: {
    content: string;
    receivedAt: string;
  }) => void;
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
  /** §10.12 — 드로어 본문 펼침 상태 설정/토글 (Ctrl+Shift+R + 헤더 셰브론 공유). */
  setDrawerExpanded: (value: boolean) => void;
  toggleDrawerExpanded: () => void;
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

/**
 * Numeric sort key for a result: the cached `startedAtEpoch` when present,
 * else a one-off `Date.parse(startedAt)` (defends rows produced outside
 * `addNodeResult`, e.g. a raw `setState` in tests). Returns `NaN` when there
 * is no `startedAt` at all — callers treat `NaN` as "sinks to the end".
 */
function resultEpoch(r: NodeResult): number {
  if (typeof r.startedAtEpoch === "number") return r.startedAtEpoch;
  return r.startedAt ? Date.parse(r.startedAt) : Number.NaN;
}

/**
 * Memoized chronological projection of an arrival-ordered `nodeResults` array.
 * Same `results` reference → same sorted array reference (WeakMap), so the
 * several components that read the timeline share one sort per frame instead
 * of re-sorting per render or per WS event.
 *
 * Ordering semantics preserved from the old `sortByStartedAt`:
 *  - ascending by `startedAt` epoch,
 *  - rows without a `startedAt` sink to the end (defensive),
 *  - ties keep arrival order (Array.prototype.sort is stable).
 */
const sortedCache = new WeakMap<readonly NodeResult[], NodeResult[]>();
export function selectSortedNodeResults(results: NodeResult[]): NodeResult[] {
  const cached = sortedCache.get(results);
  if (cached) return cached;
  // Decorate with arrival index so the comparator can keep ties stable even on
  // engines where sort stability might be in doubt, and so the NaN (no
  // startedAt) bucket preserves arrival order at the tail.
  const sorted = results
    .map((r, i) => ({ r, i, e: resultEpoch(r) }))
    .sort((a, b) => {
      const aNaN = Number.isNaN(a.e);
      const bNaN = Number.isNaN(b.e);
      if (aNaN && bNaN) return a.i - b.i;
      if (aNaN) return 1;
      if (bNaN) return -1;
      if (a.e !== b.e) return a.e - b.e;
      return a.i - b.i;
    })
    .map((x) => x.r);
  sortedCache.set(results, sorted);
  return sorted;
}

/**
 * Index of a client-side optimistic `user` bubble (`optimisticPending`) whose
 * content matches an incoming `execution.user_message` echo — so the echo can
 * reconcile (stamp the authoritative `receivedAt`, clear the flag) instead of
 * appending a duplicate bubble. Returns -1 when none matches (channel inbound /
 * observer client has no local optimistic bubble → echo should append).
 *
 * Pure helper extracted from `appendOptimisticUserMessage` for readability and
 * direct unit testing. Matches on the pending flag + content; since a client
 * sends one message at a time, at most one such bubble normally exists. The
 * content-based match means consecutive *identical* sends absorb the first
 * pending bubble (extreme edge case; the turn-end `ai_message` REPLACE is the
 * final reconciler). SoT: spec/conventions/conversation-thread.md §9.7
 * `user_message` 행.
 */
export function findReconcilableOptimisticIdx(
  messages: ConversationItem[],
  content: string,
): number {
  return messages.findIndex(
    (i) =>
      i.type === "user" &&
      i.optimisticPending === true &&
      i.content === content,
  );
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

export const useExecutionStore = create<ExecutionState>((set, get) => ({
  executionId: null,
  status: "idle",
  nodeStatuses: new Map(),
  nodeResults: [],
  nodeResultIndexByExecId: new Map(),
  lastIndexByNodeId: new Map(),
  firstNoExecIdIndexByNodeId: new Map(),
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
  // UI 선호값 — 드로어는 기본 펼친 상태로 시작 (옛 RunResultsDrawer 로컬 useState(true) 와 동일).
  drawerExpanded: true,

  startExecution: (executionId: string) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      nodeResultIndexByExecId: new Map(),
      lastIndexByNodeId: new Map(),
      firstNoExecIdIndexByNodeId: new Map(),
      startedAt: new Date().toISOString(),
      selectedResultNodeId: null,
      // §9.7.1 — startExecution 만 두 묶음 모두 클리어
      ...CLEAR_INPUT_AFFORDANCE,
      ...CLEAR_CONVERSATION_SNAPSHOT,
    }),

  // §7 — 과거 실행 적재용 reset. startExecution 과 동일한 per-execution 클리어를
  // 수행하되 startedAt 은 과거 실행의 실제 시작 시각을 보존하고, status 는
  // applyExecutionSnapshot 이 실제 terminal/waiting 으로 덮어쓰기 전의 transient.
  // `drawerExpanded`(UI 선호)는 의도적으로 유지 — 히스토리 로드가 드로어 펼침
  // 상태를 강제로 바꾸지 않는다(사용자가 접어둔 상태면 접힌 채로 적재).
  startHistoryView: (executionId: string, startedAt: string | null) =>
    set({
      executionId,
      status: "running",
      nodeStatuses: new Map(),
      nodeResults: [],
      nodeResultIndexByExecId: new Map(),
      lastIndexByNodeId: new Map(),
      firstNoExecIdIndexByNodeId: new Map(),
      startedAt,
      selectedResultNodeId: null,
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
      //
      // Lookups are O(1) via the derived index Maps instead of a findIndex /
      // reverse scan over the whole array. `lastIndexByNodeId` reproduces the
      // old "most recent row for that nodeId" reverse scan exactly.
      // Resolve via the derived indices, but validate the candidate row still
      // matches: a raw `setState({ nodeResults })` (test seeding, or any path
      // that bypasses addNodeResult) can leave the indices stale. A mismatch
      // is treated as a miss, falling back to append — never crashing or
      // clobbering an unrelated row.
      let targetIndex = -1;
      if (result.nodeExecutionId) {
        const idx = state.nodeResultIndexByExecId.get(result.nodeExecutionId);
        if (
          idx !== undefined &&
          state.nodeResults[idx]?.nodeExecutionId === result.nodeExecutionId
        ) {
          targetIndex = idx;
        }
      } else {
        const idx = state.lastIndexByNodeId.get(result.nodeId);
        if (idx !== undefined && state.nodeResults[idx]?.nodeId === result.nodeId) {
          targetIndex = idx;
        }
      }

      // Clone the derived indices so the produced state is a fresh object graph
      // (Zustand/React reference-equality) — only touched entries mutate.
      const execIdIndex = new Map(state.nodeResultIndexByExecId);
      const lastIndex = new Map(state.lastIndexByNodeId);
      const firstNoExecIdIndex = new Map(state.firstNoExecIdIndexByNodeId);

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
        // Preserve the original per-execution id once known so later events
        // without it don't erase it.
        const mergedExecId = result.nodeExecutionId ?? prev.nodeExecutionId;
        const mergedStartedAt = result.startedAt ?? prev.startedAt;
        const merged: NodeResult = {
          ...prev,
          ...result,
          nodeLabel: mergedLabel,
          nodeExecutionId: mergedExecId,
          // Same for parentNodeExecutionId — some mid-flight events
          // (waiting_for_input) don't carry it, and losing it would
          // collapse the Sub-Workflow card back to a flat row.
          parentNodeExecutionId:
            result.parentNodeExecutionId ?? prev.parentNodeExecutionId,
          startedAt: mergedStartedAt,
          inputData: result.inputData ?? prev.inputData,
          // Recompute the cached epoch from the merged startedAt (once).
          startedAtEpoch: mergedStartedAt
            ? Date.parse(mergedStartedAt)
            : undefined,
        };
        const updated = state.nodeResults.slice();
        updated[targetIndex] = merged;

        // ── Index maintenance ────────────────────────────────────────────
        // If the row just acquired a nodeExecutionId (was appended without
        // one), migrate it out of firstNoExecIdIndexByNodeId into the exec-id
        // index so subsequent exec-id lookups resolve and no-exec-id fallback
        // no longer matches a now-identified row.
        if (mergedExecId) {
          execIdIndex.set(mergedExecId, targetIndex);
          if (
            !prev.nodeExecutionId &&
            firstNoExecIdIndex.get(prev.nodeId) === targetIndex
          ) {
            firstNoExecIdIndex.delete(prev.nodeId);
          }
        }
        // lastIndexByNodeId is unaffected: an update keeps the row at its
        // existing index, and the nodeId is unchanged.
        return {
          nodeResults: updated,
          nodeResultIndexByExecId: execIdIndex,
          lastIndexByNodeId: lastIndex,
          firstNoExecIdIndexByNodeId: firstNoExecIdIndex,
        };
      }

      // Append a brand-new row in arrival order.
      const appendedRow: NodeResult = {
        ...result,
        startedAtEpoch: result.startedAt
          ? Date.parse(result.startedAt)
          : undefined,
      };
      const updated = state.nodeResults.slice();
      const newIndex = updated.length;
      updated.push(appendedRow);

      lastIndex.set(appendedRow.nodeId, newIndex);
      if (appendedRow.nodeExecutionId) {
        execIdIndex.set(appendedRow.nodeExecutionId, newIndex);
      } else if (!firstNoExecIdIndex.has(appendedRow.nodeId)) {
        // First no-exec-id row for this nodeId — preserves `.find()` first
        // match semantics used by the 4 event sites.
        firstNoExecIdIndex.set(appendedRow.nodeId, newIndex);
      }
      return {
        nodeResults: updated,
        nodeResultIndexByExecId: execIdIndex,
        lastIndexByNodeId: lastIndex,
        firstNoExecIdIndexByNodeId: firstNoExecIdIndex,
      };
    }),

  findNodeResult: (nodeExecutionId, nodeId) => {
    const state = get();
    // Truthiness (not `!== undefined`) to match the 4 event sites' original
    // predicate `payload.nodeExecutionId ? ... : !r.nodeExecutionId && ...` —
    // an empty-string id falls through to the no-exec-id branch.
    if (nodeExecutionId) {
      const idx = state.nodeResultIndexByExecId.get(nodeExecutionId);
      const row = idx !== undefined ? state.nodeResults[idx] : undefined;
      // Validate against stale indices (raw setState seeding) before returning.
      return row?.nodeExecutionId === nodeExecutionId ? row : undefined;
    }
    const idx = state.firstNoExecIdIndexByNodeId.get(nodeId);
    const row = idx !== undefined ? state.nodeResults[idx] : undefined;
    return row && !row.nodeExecutionId && row.nodeId === nodeId
      ? row
      : undefined;
  },

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
      // spec/conventions/conversation-thread.md §9.7.1 — "render_form 제출은
      // multi-turn AI 대화 한복판의 form 입력 1건 완료이지 `waiting_for_input`
      // 해제 자체가 아니다". 따라서 `status` 는 `waiting_for_input` 유지 —
      // backend 가 form 제출 후 곧 다음 turn 의 새 waiting 으로 emit 한다.
      //
      // 옛 `status: 'running'` 설정 시 회귀 (2026-05-23 사용자 보고):
      // REST 폴링 (executionsApi.getById, 2s) 이 backend 의 transient phase
      // (`execution.status='running' + nodeExec='running'`) 를 잡으면
      // `applyExecutionSnapshot:144-167` 의 `running && prevStatus='waiting_for_input'
      // && !hasWaitingNode` 분기가 발화해 `resumeFromConversation()` 호출 →
      // `CLEAR_INPUT_AFFORDANCE` 가 `waitingNodeId / waitingInteractionType /
      // waitingConversationConfig / isWaitingAiResponse` 전부 wipe → timeline
      // 이 일시적으로 빈 채로 보였다 AI 응답 도착 시 다시 채워짐.
      //
      // status 를 'waiting_for_input' 으로 유지하면 위 분기 entry 조건 자체가
      // 깨지고 (`prevStatus === 'waiting_for_input'` 이지만 `execution.status`
      // 도 running phase 일 때 line 124-130 의 `reconcileToWaiting` 가 true
      // 가 되어 effectiveExecutionStatus='waiting_for_input' 분기 — same-node
      // early return — 으로 흐르며 store wipe 가 발생하지 않는다).
      return {
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

  appendOptimisticUserMessage: ({ content, receivedAt }) =>
    set((state) => {
      // Dedup by receivedAt — re-emit / re-subscribe must not double-append.
      // 단, receivedAt 가 빈 문자열(옛 backend 호환 fallback)이면 dedup 키가
      // 없는 셈이라 같은 빈 키의 *다른* 발화가 무음 drop 되지 않도록 append 한다
      // (드문 중복 < 메시지 손실). 권위 출처 ai_message REPLACE 가 reconcile.
      if (receivedAt) {
        const exists = state.conversationMessages.some(
          (i) => i.type === "user" && i.timestamp === receivedAt,
        );
        if (exists) return {};
      }
      // Reconcile with the client-side optimistic bubble that `sendMessage`
      // appended on send (`optimisticPending`). Its dedup key is a *client*
      // timestamp, so the `receivedAt` check above never catches it — without
      // this branch the local bubble and this server echo coexist as two
      // identical user messages until the turn-end `ai_message` REPLACE
      // collapses them (the "한 메시지가 둘로 보이다 합쳐짐" bug). When matched,
      // stamp the authoritative `receivedAt` (so a re-emit is caught above) and
      // clear the flag — append nothing. Match logic + trade-off:
      // findReconcilableOptimisticIdx.
      const optimisticPendingIdx = findReconcilableOptimisticIdx(
        state.conversationMessages,
        content,
      );
      if (optimisticPendingIdx !== -1) {
        const next = state.conversationMessages.map((i, idx) =>
          idx === optimisticPendingIdx
            ? {
                ...i,
                // spread 불변 패턴 — `delete` 대신 `undefined` 할당으로
                // React/Zustand 의 reference equality 를 유지하면서 flag 해제.
                optimisticPending: undefined,
                timestamp: receivedAt || i.timestamp,
              }
            : i,
        );
        return { conversationMessages: next, isWaitingAiResponse: true };
      }
      // turnIndex best-effort: the count of live (non-injected) user turns so
      // far. The subsequent authoritative `ai_message` REPLACE recomputes all
      // indices, so precision here only affects the brief optimistic window.
      const liveUserTurns = state.conversationMessages.filter(
        (i) => i.type === "user" && !i.isInjected,
      ).length;
      const item: ConversationItem = {
        type: "user",
        content,
        turnIndex: liveUserTurns,
        timestamp: receivedAt,
      };
      return {
        conversationMessages: [...state.conversationMessages, item],
        // The user just spoke — an AI response is now pending.
        isWaitingAiResponse: true,
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

  setDrawerExpanded: (value: boolean) => set({ drawerExpanded: value }),
  toggleDrawerExpanded: () =>
    set((state) => ({ drawerExpanded: !state.drawerExpanded })),

  reset: () =>
    set({
      executionId: null,
      status: "idle",
      nodeStatuses: new Map(),
      nodeResults: [],
      nodeResultIndexByExecId: new Map(),
      lastIndexByNodeId: new Map(),
      firstNoExecIdIndexByNodeId: new Map(),
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
