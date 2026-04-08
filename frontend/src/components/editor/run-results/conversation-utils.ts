import type { ConversationItem } from "@/lib/stores/execution-store";

interface LlmCallEntry {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

interface TurnDebugEntry {
  turnIndex: number;
  /** All LLM calls in this turn (1 without tool calls, 2+ with tool calls) */
  llmCalls?: LlmCallEntry[];
  totalDurationMs?: number;
  /** Legacy: single request/response (backward compat) */
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

/**
 * Parse conversation messages from a completed AI Agent node's outputData.
 * Filters out system/tool messages, maps to ConversationItem format,
 * and attaches per-LLM-call debug data from _turnDebugHistory.
 *
 * When function calling occurs, a single turn produces multiple assistant messages
 * (one with tool calls, one with the final response). Each assistant message is
 * matched to the corresponding LLM call entry within the turn's llmCalls array.
 */
export function parseHistoryMessages(
  outputData: unknown,
): ConversationItem[] {
  const output = outputData as Record<string, unknown> | null;
  if (!output?.messages) return [];

  const messages = output.messages as Array<{
    role: string;
    content: string;
    toolCalls?: unknown[];
  }>;

  // Build turnIndex → debug lookup from persisted history
  const debugHistory = (output._turnDebugHistory ?? []) as TurnDebugEntry[];
  const debugByTurn = new Map<number, TurnDebugEntry>();
  for (const entry of debugHistory) {
    debugByTurn.set(entry.turnIndex, entry);
  }

  // Metadata from the final output (shared model info)
  const meta = output.metadata as Record<string, unknown> | undefined;

  // Walk through messages, tracking which turn and which LLM call within the turn
  const items: ConversationItem[] = [];
  let currentTurn = 0;
  let assistantIdxInTurn = 0; // N-th assistant message within current turn

  for (const msg of messages) {
    if (msg.role === "user") {
      currentTurn++;
      assistantIdxInTurn = 0;
      items.push({
        type: "user",
        content: msg.content,
        turnIndex: currentTurn,
      });
    } else if (msg.role === "assistant") {
      const turn = currentTurn || 1;
      const debug = debugByTurn.get(turn);

      let callDebug: LlmCallEntry | undefined;
      if (debug?.llmCalls && debug.llmCalls.length > 0) {
        // Match to the N-th LLM call in this turn
        callDebug = debug.llmCalls[assistantIdxInTurn];
      } else if (debug && assistantIdxInTurn === 0) {
        // Legacy format: single request/response per turn
        callDebug = {
          requestPayload: debug.requestPayload,
          responsePayload: debug.responsePayload,
          durationMs: debug.durationMs,
        };
      }

      // Extract token usage from the LLM response payload
      const resp = callDebug?.responsePayload as Record<string, unknown> | undefined;
      const usage = resp?.usage as Record<string, unknown> | undefined;

      // Extract tool calls from the LLM response or the message itself
      const toolCalls = (
        (resp?.toolCalls ?? msg.toolCalls) as
          | Array<{ name?: string; arguments?: string }>
          | undefined
      )?.map((tc) => ({ name: tc.name ?? "", arguments: tc.arguments }));

      items.push({
        type: "assistant",
        content: msg.content,
        turnIndex: turn,
        assistantToolCalls: toolCalls?.length ? toolCalls : undefined,
        requestPayload: callDebug?.requestPayload,
        responsePayload: callDebug?.responsePayload,
        durationMs: callDebug?.durationMs,
        metadata: {
          model: (resp?.model as string) ?? (meta?.model as string | undefined),
          inputTokens: (usage?.inputTokens as number) ?? undefined,
          outputTokens: (usage?.outputTokens as number) ?? undefined,
        },
      });

      assistantIdxInTurn++;
    }
    // Skip system and tool messages
  }

  return items;
}
