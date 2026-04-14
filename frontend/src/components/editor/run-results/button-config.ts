/**
 * Shared runtime guards for button-interaction payloads that arrive over the
 * WebSocket / REST boundary. The engine persists `buttonConfig` verbatim on
 * `NodeExecution.outputData`, so we must not trust its shape at render time.
 */

export interface ButtonDef {
  id: string;
  label: string;
  type: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

export interface ButtonConfig {
  buttons: ButtonDef[];
}

function isSafeButtonUrl(url: unknown): url is string {
  if (typeof url !== "string") return false;
  try {
    const p = new URL(url).protocol;
    return p === "http:" || p === "https:";
  } catch {
    return false;
  }
}

function parseButtonDef(value: unknown): ButtonDef | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || typeof v.label !== "string") return null;
  if (v.type !== "link" && v.type !== "port") return null;
  // A link button with a missing/unsafe URL would otherwise slip into
  // `window.open()` and enable `javascript:` XSS — drop those entries.
  if (v.type === "link" && !isSafeButtonUrl(v.url)) return null;
  const style =
    v.style === "primary" ||
    v.style === "secondary" ||
    v.style === "outline" ||
    v.style === "danger"
      ? v.style
      : undefined;
  return {
    id: v.id,
    label: v.label,
    type: v.type,
    url: typeof v.url === "string" ? v.url : undefined,
    style,
  };
}

/**
 * Runtime-validate a waiting node's `buttonConfig`. Returns `null` when the
 * payload is malformed or contains no usable buttons so the caller can skip
 * rendering rather than passing untrusted data to `window.open`.
 */
export function parseButtonConfig(value: unknown): ButtonConfig | null {
  if (!value || typeof value !== "object") return null;
  const v = value as Record<string, unknown>;
  const rawButtons = Array.isArray(v.buttons) ? v.buttons : [];
  const buttons = rawButtons
    .map(parseButtonDef)
    .filter((b): b is ButtonDef => b !== null);
  if (buttons.length === 0) return null;
  return { buttons };
}

/** Safe wrapper for `window.open` that blocks non-http(s) schemes. */
export function openExternalLink(url: string): void {
  if (!isSafeButtonUrl(url)) return;
  window.open(url, "_blank", "noopener,noreferrer");
}
