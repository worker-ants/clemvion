import type { ConversationItem } from "@/lib/stores/execution-store";
import { tryParseJson } from "@/lib/utils/parse-json";

/**
 * `ConversationTurn` wire shape carried inside `EXECUTION_WAITING_FOR_INPUT`
 * payload's `conversationThread.turns`. Mirrors
 * spec/conventions/conversation-thread.md §1.2 ConversationTurn (the
 * authoritative spec) and §1.1 ConversationTurnSource for the `source` enum.
 *
 * Frontend uses this as the **1차 데이터 소스** for the conversation Preview
 * tab (spec §9.3) — emit messages (`ai_message.messages[]`) are reserved for
 * the LLM debug panels (Request / Response / LLM Usage).
 */
export type ConversationTurnSource =
  | "ai_user"
  | "ai_assistant"
  | "ai_tool"
  | "presentation_user"
  | "system"
  | "system_error";

/**
 * `data` payload shape for `source: 'system_error'` turns — the inline error
 * marker that appears in the conversation thread when an AI Agent multi-turn
 * node ends with `output.error` set.
 *
 * SoT: spec/conventions/conversation-thread.md §1.2 `data?` 행 비고.
 * `code` / `message` / `retryable` / `retryAfterSec` mirror
 * `output.error.{code, message, details.retryable, details.retryAfterSec}`
 * (the host node's `output.error` is the single source of truth).
 */
export interface SystemErrorTurnData {
  code: string;
  message: string;
  retryable: boolean;
  retryAfterSec?: number;
  nodeId: string;
  nodeLabel: string;
}

export interface ConversationTurn {
  seq: number;
  nodeId: string;
  nodeLabel: string;
  nodeType: string;
  source: ConversationTurnSource;
  text: string;
  data?: Record<string, unknown>;
  toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
  toolCallId?: string;
  timestamp?: string;
  /**
   * Optional structured interaction type carried by `presentation_user`
   * turns. Backend may eventually populate this directly from the
   * presentation node's `output.interaction.type`. When absent, the
   * frontend falls back to `inferInteractionTypeFromData` so changes to
   * how backend reports this field stay non-breaking.
   */
  interactionType?: "button_click" | "form_submitted" | "button_continue";
  /**
   * `source === 'ai_assistant'` 한정. AI Agent 가 `render_*` 표현 도구
   * (spec/4-nodes/3-ai/1-ai-agent.md §4.1) 로 emit 한 표·차트·캐러셀·템플릿·폼
   * 페이로드. top-level 독립 필드 (`data?` 와 별개).
   */
  presentations?: PresentationPayload[];
}

/**
 * spec/4-nodes/3-ai/1-ai-agent.md §7.10 — single source of truth for the
 * payload shape emitted by the `render_*` tool family.
 */
export type PresentationType =
  | "table"
  | "chart"
  | "carousel"
  | "template"
  | "form";

export interface PresentationPayloadTruncation {
  itemsTruncated?: boolean;
  rowsTruncated?: boolean;
  itemsTotalCount?: number;
  rowsTotalCount?: number;
}

export interface PresentationPayload {
  type: PresentationType;
  toolCallId: string;
  renderedAt: string;
  payload: Record<string, unknown>;
  truncation?: PresentationPayloadTruncation;
}

/**
 * Infer a `presentation_user` turn's `interaction.type` from the shape of
 * `data` (node-output §4.5):
 *   - `{ buttonId, buttonLabel, url, ... }` → `button_continue` (URL +
 *     buttonId both required so a stray `url` field in a form payload
 *     doesn't mis-classify as a link continue)
 *   - `{ buttonId, buttonLabel, ... }` → `button_click`
 *   - else (data is a flat field map, or missing) → `form_submitted`
 *
 * Used as fallback when `ConversationTurn.interactionType` is not carried
 * on the wire.
 */
export function inferInteractionTypeFromData(
  data: Record<string, unknown> | undefined,
): "button_click" | "form_submitted" | "button_continue" {
  if (!data || typeof data !== "object") return "form_submitted";
  const hasButtonId = "buttonId" in data;
  if (hasButtonId && "url" in data) return "button_continue";
  if (hasButtonId) return "button_click";
  return "form_submitted";
}

/**
 * spec/conventions/conversation-thread.md §9.5 compatibility strip — older
 * persisted data may carry inline marker pairs like
 * `[user-input]label[/user-input]` injected by legacy Template/Form handler
 * code. The marker has been formally banned by §1.6; new emit/storage paths
 * must not produce it. The renderer strips opening and closing tags only
 * (label content is preserved) so the visible body stays clean for both
 * live conversationThread snapshots and historical `output.messages`.
 *
 * **replace-only**: the `/g` flag on this regex would corrupt `lastIndex`
 * across `exec`/`test` calls on the same instance; only use it with
 * `String.prototype.replace`.
 */
const USER_INPUT_MARKER_RE = /\[\/?user-input\]/g;

/**
 * @param s — input string. `undefined` and `""` both return `""`.
 * @returns the input with all `[user-input]` and `[/user-input]` tags
 *   removed. Inner label content is preserved.
 */
export function stripInlineMarkers(s: string | undefined): string {
  if (!s) return "";
  return s.replace(USER_INPUT_MARKER_RE, "");
}

/**
 * spec/conventions/conversation-thread.md §9.8 — content blank 동치성.
 * Assistant 메시지 본문이 시각적으로 비어있는지 판정하는 **단일 결정 함수**.
 *
 * LLM provider 가 tool_use 블록 사이에 빈 text 블록 (`" "`, `"\n"`) 을 같이
 * emit 하면 `result.content` 가 truthy 공백문자가 되는데, ReactMarkdown 으로
 * 렌더하면 사용자 눈에는 빈 버블처럼 보인다. 본 함수는 다음 4가지를 모두
 * 동치 (blank) 로 처리해 LLM provider 마다 다른 빈 content 표현을 흡수한다:
 *
 *   - `null`
 *   - `undefined`
 *   - `""` (빈 문자열)
 *   - `" "`, `"\n"`, `"   \t\n"` 등 whitespace-only 문자열
 *
 * 본 판정의 사용처 (spec §9.8):
 *   1. 그룹 분류 (§9.6): `ai_assistant` 가 tool-call group parent 인지 결정
 *   2. 헤더 라벨 (SelectedItemDetail): "Tool Call" vs "AI Response"
 *   3. placeholder (timeline bubble): `(empty)` 표시 여부
 *
 * Spec 의 "단일 결정 함수" 요구에 따라 본 모듈에서 export 한 단일 정의만
 * UI / 변환 함수가 import 해 사용한다 (다중 정의 금지).
 */
export function isAssistantContentBlank(content: unknown): boolean {
  return typeof content !== "string" || content.trim() === "";
}

/**
 * Convert a `ConversationThread.turns` snapshot (the 1차 데이터 소스 for
 * conversation Preview per spec §9.3) into the inspector's `ConversationItem`
 * timeline shape. Each source maps to a single render kind that
 * `ConversationInspector` already knows how to draw:
 *
 *   - `ai_user` → `{ type: "user" }` chat bubble
 *   - `ai_assistant` → `{ type: "assistant" }` chat bubble
 *   - `ai_tool` → `{ type: "tool" }` tool-call row
 *   - `presentation_user` → `{ type: "presentation" }` grey system card with
 *     structured `presentation` metadata (nodeLabel + interaction kind + data)
 *   - `system` → `{ type: "system" }` centered note row
 *
 * `turnIndex` is allocated only to `ai_user` / `ai_assistant` / `ai_tool`
 * items so debug lookups (`debugByTurn`) keep working; `presentation` and
 * `system` items carry `turnIndex: 0` because they don't participate in
 * AI-Agent turn counting (spec §1.1 — turn counter advances on ai_user only).
 */
export function threadTurnsToConversationItems(
  turns: ConversationTurn[],
): ConversationItem[] {
  if (!Array.isArray(turns) || turns.length === 0) return [];
  const items: ConversationItem[] = [];
  // spec/conventions/conversation-thread.md §1.1 — turn counter advances on
  // `ai_user` source only (presentation_user / system do not contribute).
  // ai_assistant / ai_tool inherit the current counter. Edge case: a thread
  // that starts with ai_assistant before any ai_user (transient mid-execution
  // snapshot) gets turnIndex 1 as a non-zero floor so renderer key paths
  // (`${item.type}-${item.turnIndex}`) stay stable.
  let turnIndex = 0;
  for (const turn of turns) {
    switch (turn.source) {
      case "ai_user": {
        turnIndex++;
        items.push({
          type: "user",
          content: stripInlineMarkers(turn.text),
          turnIndex,
          timestamp: turn.timestamp,
        });
        break;
      }
      case "ai_assistant": {
        const effectiveTurnIndex = turnIndex || 1;
        items.push({
          type: "assistant",
          content: stripInlineMarkers(turn.text),
          turnIndex: effectiveTurnIndex,
          assistantToolCalls: turn.toolCalls?.length
            ? turn.toolCalls.map((tc) => ({
                name: tc.name ?? "",
                arguments: tc.arguments,
              }))
            : undefined,
          // spec/4-nodes/3-ai/1-ai-agent.md §7.10 — render_* display-only
          // payloads ride along with the assistant turn so the chat UI can
          // inline-render tables/charts/carousels/templates next to the
          // assistant's text response.
          presentations:
            turn.presentations && turn.presentations.length > 0
              ? turn.presentations
              : undefined,
          timestamp: turn.timestamp,
        });
        break;
      }
      case "ai_tool": {
        const effectiveTurnIndex = turnIndex || 1;
        items.push({
          type: "tool",
          // For tool turns the `text` is usually the tool result body; the
          // toolCallId is the link back to the assistant call that named it.
          // We leave `content` to the renderer (which looks up the tool name
          // from the previous assistant call when available).
          content: turn.text || "",
          turnIndex: effectiveTurnIndex,
          toolCallId: turn.toolCallId,
          toolResult: tryParseJson(turn.text ?? ""),
          timestamp: turn.timestamp,
        });
        break;
      }
      case "presentation_user": {
        // Prefer the wire-level field when backend ships it; otherwise infer
        // from `data` shape (node-output §4.5).
        const interactionType =
          turn.interactionType ?? inferInteractionTypeFromData(turn.data);
        items.push({
          type: "presentation",
          content: stripInlineMarkers(turn.text),
          turnIndex: 0,
          presentation: {
            nodeLabel: turn.nodeLabel,
            nodeType: turn.nodeType,
            interactionType,
            data: turn.data,
          },
          timestamp: turn.timestamp,
        });
        break;
      }
      case "system": {
        items.push({
          type: "system",
          content: stripInlineMarkers(turn.text),
          turnIndex: 0,
          timestamp: turn.timestamp,
        });
        break;
      }
      case "system_error": {
        // spec/conventions/conversation-thread.md §9.1 + §9.6 — inline error
        // turn rendered as ❌ centered red line with retry action. Not absorbed
        // into tool-call groups (§9.6 rule: system_error stays unclaim).
        // §9.8 isAssistantContentBlank evaluation does not apply.
        const errorData = turn.data as Partial<SystemErrorTurnData> | undefined;
        items.push({
          type: "system_error",
          content: errorData?.message ?? turn.text ?? "",
          turnIndex: 0,
          systemError: errorData
            ? {
                code: errorData.code ?? "UNKNOWN_ERROR",
                message: errorData.message ?? turn.text ?? "",
                retryable: errorData.retryable ?? false,
                retryAfterSec: errorData.retryAfterSec,
                nodeId: errorData.nodeId ?? turn.nodeId,
                nodeLabel: errorData.nodeLabel ?? turn.nodeLabel,
              }
            : {
                code: "UNKNOWN_ERROR",
                message: turn.text ?? "",
                retryable: false,
                nodeId: turn.nodeId,
                nodeLabel: turn.nodeLabel,
              },
          timestamp: turn.timestamp,
        });
        break;
      }
      default: {
        // Unknown source (forward-compat: backend ships a value the frontend
        // hasn't been updated for yet). Skip silently and warn — soft
        // exhaustive check, no runtime crash.
        const _exhaustive: never = turn.source;
        if (typeof console !== "undefined") {
          console.warn(
            "[threadTurnsToConversationItems] unknown ConversationTurnSource:",
            _exhaustive,
          );
        }
      }
    }
  }
  return items;
}

interface LlmCallEntry {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

/** Provider tool execution metadata persisted on each turnDebug entry.
 * The handler builds this in parallel with the LLM-facing tool messages
 * so the UI can render success/error/pending without parsing tool content. */
interface TurnToolCallEntry {
  toolCallId: string;
  name?: string;
  providerKey?: string;
  status: "success" | "error";
  durationMs?: number;
  error?: string;
}

interface TurnDebugEntry {
  turnIndex: number;
  /** All LLM calls in this turn (1 without tool calls, 2+ with tool calls) */
  llmCalls?: LlmCallEntry[];
  toolCalls?: TurnToolCallEntry[];
  totalDurationMs?: number;
  /** Legacy: single request/response (backward compat) */
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

/**
 * Origin marker emitted by backend per
 * spec/5-system/6-websocket-protocol.md §4.4.6. `'live'` = produced by the
 * current AI node's handler in this turn. `'injected'` = prepended by
 * ConversationThread injection (an upstream node's turn). Missing → treated
 * as `'live'` for backward compatibility with older payloads and persisted
 * `outputData.messages`.
 */
export type MessageSource = "live" | "injected";

export interface RawMessage {
  role: string;
  content?: string;
  toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
  toolCallId?: string;
  source?: MessageSource;
}

interface ToolStatusInfo {
  status: "success" | "error";
  durationMs?: number;
  error?: string;
}

interface ConvertOptions {
  debugByTurn?: Map<number, TurnDebugEntry>;
  toolStatusByCallId?: Map<string, ToolStatusInfo>;
  metaModel?: string;
}

/**
 * Convert a raw message array (chat history shape used by both live WS
 * payloads and persisted outputData) into the inspector's ConversationItem
 * shape. Tool messages are linked back to the assistant call that produced
 * them via `toolCallId`, so each tool item knows its name and arguments
 * even though the raw `role: 'tool'` message only carries the result content.
 *
 * **Note**: returned `content` for `user` and `assistant` items has
 * `[user-input]…[/user-input]` markers stripped (spec
 * conversation-thread §9.5 compat). The raw bytes are preserved on
 * `requestPayload` / `responsePayload` so LLM debug panels still see what
 * was actually sent to the model.
 */
export function messagesToConversationItems(
  messages: RawMessage[],
  options: ConvertOptions = {},
): ConversationItem[] {
  if (!Array.isArray(messages) || messages.length === 0) return [];

  const { debugByTurn, toolStatusByCallId, metaModel } = options;
  const items: ConversationItem[] = [];
  let currentTurn = 0;
  let assistantIdxInTurn = 0;
  // Track the most recent assistant tool calls so subsequent tool messages
  // can resolve their name / arguments by toolCallId.
  const callInfoByCallId = new Map<
    string,
    { name: string; arguments?: string; turnIndex: number }
  >();

  for (const msg of messages) {
    // spec/5-system/6-websocket-protocol.md §4.4.6 — `source` defaults to
    // `'live'` when absent (older backends / persisted outputData).
    const isInjected = msg.source === "injected";

    if (msg.role === "user") {
      // Only `live` user messages advance the turn counter. Injected user
      // messages (ConversationThread prepended an upstream node's turn) are
      // displayed in the timeline but must NOT shift `currentTurn`, or the
      // assistant's `turnIndex` would diverge from backend `turnCount` and
      // the debug payload lookup in `debugByTurn` would miss.
      if (!isInjected) {
        currentTurn++;
        assistantIdxInTurn = 0;
      }
      items.push({
        type: "user",
        // §9.5 compat — strip legacy `[user-input]…[/user-input]` markers from
        // the visible body. Raw payload (requestPayload/responsePayload) is
        // unaffected — debug panels still see what was actually sent to LLM.
        content: stripInlineMarkers(msg.content),
        turnIndex: currentTurn || 1,
        isInjected,
      });
      continue;
    }

    if (msg.role === "assistant") {
      // For injected assistant messages (other AI Agent's turn prepended via
      // thread injection), keep the current turn so they group with whatever
      // injected user messages preceded them. `assistantIdxInTurn` increment
      // is also skipped — the current node's `llmCalls[]` only covers live
      // assistant calls.
      const turn = currentTurn || 1;
      const debug = isInjected ? undefined : debugByTurn?.get(turn);

      let callDebug: LlmCallEntry | undefined;
      if (debug?.llmCalls && debug.llmCalls.length > 0) {
        callDebug = debug.llmCalls[assistantIdxInTurn];
      } else if (debug && assistantIdxInTurn === 0) {
        callDebug = {
          requestPayload: debug.requestPayload,
          responsePayload: debug.responsePayload,
          durationMs: debug.durationMs,
        };
      }

      const resp = callDebug?.responsePayload as
        | Record<string, unknown>
        | undefined;
      const usage = resp?.usage as Record<string, unknown> | undefined;

      const respToolCalls = resp?.toolCalls as
        | Array<{ id?: string; name?: string; arguments?: string }>
        | undefined;
      const rawToolCalls = respToolCalls ?? msg.toolCalls;
      const toolCalls = rawToolCalls?.map((tc) => ({
        name: tc.name ?? "",
        arguments: tc.arguments,
      }));

      // Remember each tool call so the next tool message can resolve its name.
      if (rawToolCalls) {
        for (const tc of rawToolCalls) {
          if (!tc.id) continue;
          callInfoByCallId.set(tc.id, {
            name: tc.name ?? "",
            arguments: tc.arguments,
            turnIndex: turn,
          });
        }
      }

      items.push({
        type: "assistant",
        content: stripInlineMarkers(msg.content),
        turnIndex: turn,
        isInjected,
        assistantToolCalls: toolCalls?.length ? toolCalls : undefined,
        requestPayload: callDebug?.requestPayload,
        responsePayload: callDebug?.responsePayload,
        durationMs: callDebug?.durationMs,
        metadata: {
          model: (resp?.model as string) ?? metaModel,
          inputTokens: (usage?.inputTokens as number) ?? undefined,
          outputTokens: (usage?.outputTokens as number) ?? undefined,
        },
      });

      // Only advance the per-turn assistant index for live calls — injected
      // assistant messages aren't backed by an entry in this node's
      // `debugByTurn` so they shouldn't claim a `llmCalls[]` slot.
      if (!isInjected) {
        assistantIdxInTurn++;
      }
      continue;
    }

    if (msg.role === "tool") {
      const callId = msg.toolCallId;
      const info = callId ? callInfoByCallId.get(callId) : undefined;
      const status = callId ? toolStatusByCallId?.get(callId) : undefined;

      const item: ConversationItem = {
        type: "tool",
        content: info?.name ?? "(unknown tool)",
        turnIndex: info?.turnIndex ?? (currentTurn || 1),
        isInjected,
        toolCallId: callId,
        toolArgs: info?.arguments ? tryParseJson(info.arguments) : undefined,
        toolResult: tryParseJson(msg.content),
      };
      if (status) {
        item.toolStatus = status.status;
        if (status.durationMs !== undefined) item.durationMs = status.durationMs;
        if (status.error !== undefined) item.error = status.error;
      }
      items.push(item);
      continue;
    }
    // system messages and unknown roles are skipped.
  }

  return items;
}

/**
 * Build a `toolCallId` → status map from `meta.turnDebug[].toolCalls`. Used
 * by parseHistoryMessages and by the live event handler so success/error
 * decoration is the same for both code paths.
 */
function toolStatusMapFromDebug(
  debugHistory: TurnDebugEntry[],
): Map<string, ToolStatusInfo> {
  const map = new Map<string, ToolStatusInfo>();
  for (const turn of debugHistory) {
    for (const tc of turn.toolCalls ?? []) {
      if (!tc.toolCallId) continue;
      map.set(tc.toolCallId, {
        status: tc.status,
        durationMs: tc.durationMs,
        error: tc.error,
      });
    }
  }
  return map;
}

/**
 * Extract a `toolCallId` → status snapshot from a list of ConversationItems.
 * Used by the WS handler so when an `ai_message` snapshot replaces the
 * timeline, in-flight `tool_call_completed` info (success / error / duration
 * / error message) survives the replacement instead of reverting to undefined.
 * Pending items are intentionally not preserved — the snapshot's
 * meta.turnDebug.toolCalls would already carry the authoritative status.
 */
export function toolStatusMapFromItems(
  items: ConversationItem[],
): Map<string, ToolStatusInfo> {
  const map = new Map<string, ToolStatusInfo>();
  for (const item of items) {
    if (item.type !== "tool" || !item.toolCallId) continue;
    if (item.toolStatus !== "success" && item.toolStatus !== "error") continue;
    map.set(item.toolCallId, {
      status: item.toolStatus,
      durationMs: item.durationMs,
      error: item.error,
    });
  }
  return map;
}

/**
 * Parse conversation messages from a completed AI Agent node's outputData.
 * Maps user / assistant / tool messages to ConversationItem format and
 * attaches per-LLM-call debug data + per-tool status from `meta.turnDebug`.
 *
 * When function calling occurs, a single turn produces multiple assistant
 * messages (one with tool calls, one with the final response) and one or
 * more tool messages between them. Each assistant message is matched to
 * the corresponding LLM call entry; each tool message is linked to the
 * assistant call that produced it via toolCallId.
 */
export function parseHistoryMessages(
  outputData: unknown,
): ConversationItem[] {
  const raw = outputData as Record<string, unknown> | null;
  // Support the current unified wrapper, the Stage-5 LLM `result` wrapper
  // (messages live at `output.result.messages`), and the legacy flat shape.
  const wrapper =
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "config" in raw &&
    "output" in raw
      ? (raw.output as Record<string, unknown> | null)
      : raw;
  const resultNode =
    wrapper && typeof wrapper === "object"
      ? (wrapper.result as Record<string, unknown> | undefined)
      : undefined;
  // Prefer the post-Stage-5 `output.result.messages`; fall back to the
  // legacy flat `output.messages`. Debug trace moved from
  // `output._turnDebugHistory` to `meta.turnDebug` — check both.
  const messagesSource =
    (resultNode?.messages as unknown[] | undefined) ??
    (wrapper?.messages as unknown[] | undefined);
  if (!messagesSource) return [];

  const messages = messagesSource as RawMessage[];

  // Build turnIndex → debug lookup from persisted history. New shape lives
  // under `meta.turnDebug`; legacy under `output._turnDebugHistory`.
  const topMeta =
    raw &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "meta" in raw
      ? (raw.meta as Record<string, unknown> | undefined)
      : undefined;
  const debugHistory = ((topMeta?.turnDebug as TurnDebugEntry[] | undefined) ??
    (wrapper?._turnDebugHistory as TurnDebugEntry[] | undefined) ??
    []) as TurnDebugEntry[];
  const debugByTurn = new Map<number, TurnDebugEntry>();
  for (const entry of debugHistory) {
    debugByTurn.set(entry.turnIndex, entry);
  }
  const toolStatusByCallId = toolStatusMapFromDebug(debugHistory);

  const meta =
    topMeta ??
    (wrapper?.metadata as Record<string, unknown> | undefined);
  const metaModel = (meta?.model as string | undefined) ?? undefined;

  const items = messagesToConversationItems(messages, {
    debugByTurn,
    toolStatusByCallId,
    metaModel,
  });

  // spec §7.10 — backend echoes accumulated render_* payloads on the final
  // multi-turn output (also single-turn `out`) under `output.result.presentations`.
  // The execution-history page only reads NodeExecution.outputData (no live
  // thread snapshot), so we re-attach the payloads to the **last assistant**
  // ConversationItem here. That makes AssistantPresentationsBlock render the
  // same inline preview the chat surface shows. When backend emits 0 payloads
  // the array is omitted from output → no-op.
  const presentations = resultNode?.presentations as
    | PresentationPayload[]
    | undefined;
  if (presentations && presentations.length > 0) {
    for (let i = items.length - 1; i >= 0; i--) {
      if (items[i].type === "assistant") {
        items[i] = { ...items[i], presentations };
        break;
      }
    }
  }

  return items;
}

/**
 * `waiting_for_input.conversationThread.turns` snapshot 을 store 에 적용할 때
 * 사라지는 **live timeline 항목** 을 보존한다. spec/conventions/conversation-
 * thread.md §1.1 — `includeToolTurns: false` (default) 이면 `ai_tool` 턴과
 * tool 호출만 있는 intermediate `ai_assistant` 턴이 thread 에 push 되지 않는다.
 * thread 가 LLM context 효율을 위해 lean 한 것은 의도된 설계이지만, 이를
 * 그대로 UI timeline 의 1차 소스로 쓰면 직전 `ai_message` snapshot 으로 그렸던
 * 🔧 tool row 와 🤖 + ToolCallBadge intermediate assistant row 가 통째로
 * 사라져 사용자가 도구 호출 사실을 잃는다 (PR #206 이후 발견된 회귀).
 *
 * 본 헬퍼는 thread 기반 신규 items 에서 누락된 다음 두 종류의 prev 항목을
 * 같은 turnIndex 의 **다음** thread item 직전 자리에 끼워넣는다:
 *
 *   1. `type: "tool"` 이고 `toolCallId` 가 thread items 의 동일 id 와
 *      겹치지 않는 항목 (실행 시간 동안 `tool_call_started`/`_completed` 가
 *      `upsertToolItem` 으로 store 에 누적시킨 row).
 *   2. `type: "assistant"` + `assistantToolCalls?.length > 0` 이고 그 안의
 *      어느 toolCall id 도 thread items 의 tool/assistant 에 등장하지 않는
 *      항목 (intermediate "🤖 + ToolCallBadge" row).
 *
 * 삽입 위치는 동일 `turnIndex` 의 첫 thread item 직전 (해당 turn 의 어떤
 * 항목도 없다면 배열 끝). orphan 들 간 상대 순서는 prev 의 순서를 유지한다.
 *
 * 비고: 신규 thread items 가 같은 toolCallId 를 이미 가지고 있으면
 * (`includeToolTurns: true` 인 워크플로) merge 는 no-op 으로 작동한다.
 */
export function mergeOrphanToolItems(
  threadItems: ConversationItem[],
  prev: ConversationItem[],
): ConversationItem[] {
  if (prev.length === 0) return threadItems;

  // Collect dedup keys from `threadItems`:
  //   - `knownToolCallIds`: toolCallIds appearing on thread tool items or on
  //     thread assistantToolCalls[].id (id is dropped by the converter for
  //     forward-compat, so this set is usually populated only from tool items).
  //   - `turnsWithIntermediateAssistant`: turnIndexes where the thread
  //     already carries an assistant with toolCalls. With `includeToolTurns:
  //     true` (spec §1.1) thread enumerates all intermediate assistants
  //     itself; merging the same turn's prev intermediate assistant would
  //     double-render the row.
  const knownToolCallIds = new Set<string>();
  const turnsWithIntermediateAssistant = new Set<number>();
  for (const it of threadItems) {
    if (it.type === "tool" && it.toolCallId) {
      knownToolCallIds.add(it.toolCallId);
      continue;
    }
    if (it.type === "assistant" && it.assistantToolCalls?.length) {
      turnsWithIntermediateAssistant.add(it.turnIndex);
      for (const tc of it.assistantToolCalls) {
        const id = (tc as { id?: string }).id;
        if (id) knownToolCallIds.add(id);
      }
    }
  }

  // Find orphans in `prev` (relative order preserved by filter).
  const orphans: ConversationItem[] = [];
  for (const it of prev) {
    if (it.type === "tool") {
      if (it.toolCallId && !knownToolCallIds.has(it.toolCallId)) {
        orphans.push(it);
      }
      continue;
    }
    if (it.type === "assistant" && it.assistantToolCalls?.length) {
      // intermediate assistant: skip when the thread itself already enumerates
      // intermediate assistants at this turnIndex (includeToolTurns: true).
      if (turnsWithIntermediateAssistant.has(it.turnIndex)) continue;
      // Heuristic: treat blank/whitespace content as the canonical
      // "tool-call only" shape. The converter drops `id` from
      // `assistantToolCalls`, so a precise toolCallId match isn't possible —
      // covering the common LLM provider behaviour (no/blank text alongside
      // tool_use) is acceptable; explicit thinking text alongside tools is
      // rare and stays on the messages-snapshot view in the debug tabs.
      const blank =
        typeof it.content !== "string" || it.content.trim() === "";
      if (blank) orphans.push(it);
    }
  }
  if (orphans.length === 0) return threadItems;

  // Insertion policy: place each orphan **right before** the first thread
  // assistant of the same `turnIndex` that looks like a "final" answer
  // (content-bearing, no toolCalls). If the turn has no final assistant yet
  // (still mid-execution), append after the last item with the same
  // turnIndex so multi-turn ordering stays stable.
  const isFinalAssistant = (it: ConversationItem) =>
    it.type === "assistant" &&
    (!it.assistantToolCalls || it.assistantToolCalls.length === 0) &&
    typeof it.content === "string" &&
    it.content.trim() !== "";
  const result: ConversationItem[] = [...threadItems];
  for (const orphan of orphans) {
    let insertAt = result.length;
    let lastSameTurnIdx = -1;
    for (let i = 0; i < result.length; i++) {
      const it = result[i];
      if (it.turnIndex !== orphan.turnIndex) continue;
      lastSameTurnIdx = i;
      if (isFinalAssistant(it)) {
        insertAt = i;
        break;
      }
    }
    if (insertAt === result.length && lastSameTurnIdx >= 0) {
      insertAt = lastSameTurnIdx + 1;
    }
    result.splice(insertAt, 0, orphan);
  }
  return result;
}

/**
 * spec/conventions/conversation-thread.md §9.6 — tool-call 그룹 분류의
 * **단일 결정 함수** (SoT). conversation Preview (`SummaryView`) 와 좌측
 * 실행 트리 timeline (`ResultTimeline`) 양 surface 가 동일 결과를 사용해
 * 시각 일관성을 유지한다 (Inv-5, §9.9).
 *
 * 본 함수는 `items` 를 순회하며 다음을 도출:
 *
 *   1. 각 **blank intermediate assistant** (parent 분류 조건 — §9.6 의 세
 *      조건) 가 자신의 `assistantToolCalls.length` 만큼 후행 unclaimed
 *      tool 인덱스를 sequence-claim.
 *   2. `claimedToolIndices`: 자식으로 흡수된 tool 인덱스 집합 — 표준 위치
 *      에서 standalone 렌더를 skip 해야 하는 대상.
 *   3. `childrenByParent`: parent 인덱스 → 자식 tool 인덱스 배열 — parent
 *      렌더 시 nested children 영역에서 표시할 tool 인덱스 순서.
 *
 * 매칭은 sequence-count 기반 — `ConversationItem.assistantToolCalls` 의
 * `id` 가 converter 에서 drop 되므로 (forward-compat) toolCallId 직접 매칭
 * 불가. 사이에 다른 assistant / user / tool 이 끼어도 unclaimed tool 을
 * 만나면 claim 한다.
 *
 * 적용 예 (spec §9.6 의 "적용 surface" 표):
 *
 *   - SummaryView: chip 형 parent + indented children container (full chat bubble)
 *   - ResultTimeline: 한 줄 parent row + 좌측 vertical line + indented child rows
 *
 * 두 surface 가 시각 form 은 달라도 본 함수의 결과 (그룹 구성·자식 수·
 * claim 결과) 는 동일하다 — Inv-5.
 */
export function groupToolCallItems(items: ConversationItem[]): {
  claimedToolIndices: Set<number>;
  childrenByParent: Map<number, number[]>;
} {
  const claimedToolIndices = new Set<number>();
  const childrenByParent = new Map<number, number[]>();
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (
      it.type !== "assistant" ||
      !it.assistantToolCalls?.length ||
      !isAssistantContentBlank(it.content)
    ) {
      continue;
    }
    const needed = it.assistantToolCalls.length;
    const children: number[] = [];
    let j = i + 1;
    while (j < items.length && children.length < needed) {
      const next = items[j];
      if (next.type === "tool" && !claimedToolIndices.has(j)) {
        children.push(j);
        claimedToolIndices.add(j);
      }
      j++;
    }
    childrenByParent.set(i, children);
  }
  return { claimedToolIndices, childrenByParent };
}
