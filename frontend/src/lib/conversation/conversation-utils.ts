import type { ConversationItem } from "@/lib/stores/execution-store";
import { tryParseJson } from "@/lib/utils/parse-json";

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

interface RawMessage {
  role: string;
  content?: string;
  toolCalls?: Array<{ id?: string; name?: string; arguments?: string }>;
  toolCallId?: string;
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
    if (msg.role === "user") {
      currentTurn++;
      assistantIdxInTurn = 0;
      items.push({
        type: "user",
        content: msg.content ?? "",
        turnIndex: currentTurn,
      });
      continue;
    }

    if (msg.role === "assistant") {
      const turn = currentTurn || 1;
      const debug = debugByTurn?.get(turn);

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
        content: msg.content ?? "",
        turnIndex: turn,
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

      assistantIdxInTurn++;
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

  return messagesToConversationItems(messages, {
    debugByTurn,
    toolStatusByCallId,
    metaModel,
  });
}
