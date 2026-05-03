import type { ConversationItem } from "@/lib/stores/execution-store";
import { unwrapNodeOutput } from "./output-shape";

/**
 * Canonical per-call trace surfaced in the Response / Request / LLM Usage
 * tabs (and the node-level LLM Usage aggregate). Backend handlers persist
 * this shape either as a flat `_llmCalls: LlmCallTrace[]` array (single-call
 * nodes like Text Classifier, Information Extractor single-turn) or nested
 * inside `_turnDebugHistory` (conversation nodes and AI Agent single-turn
 * with tool loops).
 */
export interface LlmCallTrace {
  turnIndex: number;
  /** Index among assistant calls within the same turn (0-based). */
  callIndexInTurn: number;
  requestPayload: unknown;
  responsePayload: unknown;
  durationMs?: number;
}

interface RawTurnDebugEntry {
  turnIndex?: number;
  llmCalls?: Array<{
    requestPayload?: unknown;
    responsePayload?: unknown;
    durationMs?: number;
  }>;
}

interface RawFlatCall {
  requestPayload?: unknown;
  responsePayload?: unknown;
  durationMs?: number;
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

/**
 * Flatten any AI node's LLM call traces into a uniform list. Handles:
 *  - `output._turnDebugHistory` (AI Agent, Info Extractor multi-turn)
 *  - top-level `_turnDebugHistory` (legacy AI Agent flat shape)
 *  - `output._llmCalls` (Text Classifier, Info Extractor single-turn)
 *
 * Live waiting sessions never ship `_turnDebugHistory` over WebSocket (the
 * engine strips it). For that case the caller can pass `fallbackMessages` —
 * per-assistant `requestPayload`/`responsePayload` already attached by the
 * WS event handler. Each matching assistant item becomes one LlmCallTrace
 * so the Response/Request/LLM Usage tabs still render.
 *
 * Returns [] when nothing is available so the tab can render a placeholder.
 */
export function extractLlmCalls(
  raw: unknown,
  fallbackMessages?: ConversationItem[],
): LlmCallTrace[] {
  const fromOutput = extractFromOutputData(raw);
  if (fromOutput.length > 0) return fromOutput;
  if (fallbackMessages && fallbackMessages.length > 0) {
    return fromConversationMessages(fallbackMessages);
  }
  return [];
}

function extractFromOutputData(raw: unknown): LlmCallTrace[] {
  if (!raw || typeof raw !== "object") return [];
  const asRecord = raw as Record<string, unknown>;

  // Legacy flat AI Agent shape has _turnDebugHistory at top level
  if (Array.isArray(asRecord._turnDebugHistory)) {
    return flattenTurnDebug(asRecord._turnDebugHistory as RawTurnDebugEntry[]);
  }

  const unwrapped = unwrapNodeOutput(raw);
  const output = toRecord(unwrapped.output);
  if (!output) return [];

  // New shape: output._turnDebugHistory
  if (Array.isArray(output._turnDebugHistory)) {
    return flattenTurnDebug(output._turnDebugHistory as RawTurnDebugEntry[]);
  }
  // Single-call shape: output._llmCalls
  if (Array.isArray(output._llmCalls)) {
    return (output._llmCalls as RawFlatCall[]).map((c, i) => ({
      turnIndex: 1,
      callIndexInTurn: i,
      requestPayload: c.requestPayload,
      responsePayload: c.responsePayload,
      durationMs: c.durationMs,
    }));
  }
  return [];
}

function fromConversationMessages(
  messages: ConversationItem[],
): LlmCallTrace[] {
  const traces: LlmCallTrace[] = [];
  for (const m of messages) {
    if (m.type !== "assistant") continue;
    if (m.requestPayload == null && m.responsePayload == null) continue;
    traces.push({
      turnIndex: m.turnIndex,
      callIndexInTurn: 0,
      requestPayload: m.requestPayload,
      responsePayload: m.responsePayload,
      durationMs: m.durationMs,
    });
  }
  return traces;
}

function flattenTurnDebug(entries: RawTurnDebugEntry[]): LlmCallTrace[] {
  const flat: LlmCallTrace[] = [];
  for (const entry of entries) {
    const turnIndex = typeof entry.turnIndex === "number" ? entry.turnIndex : 1;
    const calls = Array.isArray(entry.llmCalls) ? entry.llmCalls : [];
    calls.forEach((c, i) => {
      flat.push({
        turnIndex,
        callIndexInTurn: i,
        requestPayload: c.requestPayload,
        responsePayload: c.responsePayload,
        durationMs: c.durationMs,
      });
    });
  }
  return flat;
}

/**
 * Human-readable label for a call in a picker. Includes the turn number and,
 * when multiple calls happened in the same turn, a call index suffix so the
 * user can pinpoint a specific retry or tool-call iteration.
 */
export function labelForCall(
  call: LlmCallTrace,
  turnCounts: Map<number, number>,
): string {
  const totalCallsInTurn = turnCounts.get(call.turnIndex) ?? 1;
  const base = `Turn ${call.turnIndex}`;
  if (totalCallsInTurn <= 1) return `${base} · 응답`;
  return `${base} · 호출 ${call.callIndexInTurn + 1}/${totalCallsInTurn}`;
}

/** Map `turnIndex → count of calls in that turn`, for label disambiguation. */
export function countCallsPerTurn(
  calls: LlmCallTrace[],
): Map<number, number> {
  const map = new Map<number, number>();
  for (const c of calls) {
    map.set(c.turnIndex, (map.get(c.turnIndex) ?? 0) + 1);
  }
  return map;
}
