/**
 * Try to parse a JSON string; return the original value on failure.
 * Used for tool_result content (typically JSON-stringified) and tool
 * arguments — both come from LLM output where malformed JSON is possible
 * and the inspector should still render the raw string instead of crashing.
 */
export function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}
