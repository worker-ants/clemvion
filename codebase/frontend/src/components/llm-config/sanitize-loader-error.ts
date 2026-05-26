import axios from "axios";

/**
 * Converts an Axios load-models error into a user-safe message:
 * - Joins array-shaped `message` payloads with commas.
 * - Truncates to 200 chars to limit upstream stack-trace / endpoint leakage
 *   (see `review/code/2026/05/26/11_30_56` SUMMARY #10).
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
    if (combined && combined.length > 0) return combined.slice(0, 200);
  }
  return fallback;
}
