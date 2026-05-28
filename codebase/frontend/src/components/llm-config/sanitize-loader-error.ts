import axios from "axios";

interface ServerErrorBody {
  error?: { code?: string; message?: string };
}

/**
 * Converts an Axios load-models error into a user-safe message.
 *
 * The backend wraps every error as `{ error: { code, message } }`
 * (http-exception.filter). We key off the machine-readable `code` and look it
 * up in the caller-provided localized `messagesByCode` map. Unknown codes (and
 * any non-Axios error) fall back to `fallback`.
 *
 * The raw server `message` is intentionally never surfaced: provider error
 * strings can carry endpoint / upstream detail, and they are not localized
 * (review/code/2026/05/26/12_10_38 SUMMARY #10). Granularity that matters to
 * the user (missing key, bad config) is expressed through error codes instead.
 */
export function sanitizeLoaderError(
  err: unknown,
  fallback: string,
  messagesByCode?: Record<string, string>,
): string {
  if (axios.isAxiosError(err)) {
    const code = (err.response?.data as ServerErrorBody | undefined)?.error
      ?.code;
    if (code && messagesByCode && code in messagesByCode) {
      return messagesByCode[code];
    }
  }
  return fallback;
}
