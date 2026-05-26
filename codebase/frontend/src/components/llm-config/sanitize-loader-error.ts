import axios from "axios";

/**
 * Maximum number of characters to expose from a server error message.
 * Limits upstream stack-trace / endpoint path leakage while preserving
 * enough context for the user to identify the root cause
 * (see `review/code/2026/05/26/11_30_56` SUMMARY #10).
 */
const MAX_ERROR_MESSAGE_LENGTH = 200;

/**
 * Converts an Axios load-models error into a user-safe message:
 * - Joins array-shaped `message` payloads with commas.
 * - Truncates to MAX_ERROR_MESSAGE_LENGTH chars to limit upstream stack-trace
 *   / endpoint leakage.
 * - Falls back to the i18n fallback when the payload is empty or non-axios.
 */
export function sanitizeLoaderError(
  err: unknown,
  fallback: string,
): string {
  if (axios.isAxiosError(err)) {
    const body = err.response?.data as
      | { message?: string | string[] }
      | undefined;
    const raw = body?.message;
    const combined = Array.isArray(raw) ? raw.join(", ") : raw;
    // empty string treated as absent — use fallback
    if (combined && combined.length > 0)
      return combined.slice(0, MAX_ERROR_MESSAGE_LENGTH);
  }
  return fallback;
}
