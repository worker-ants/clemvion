/**
 * The execution engine emits node handler results in one of two shapes:
 *
 *   **New** (post-migration): `{ config, output, meta?, port?, status? }`
 *   **Legacy**: a flat object (e.g. `{ rows, rowCount, ... }` or a bare array)
 *
 * This helper normalises both into a single view so the UI can always render
 * the "actual produced value" separately from config echo / observability
 * metadata.
 */

export interface UnwrappedNodeOutput {
  /** The primary produced value that downstream nodes / users care about. */
  output: unknown;
  /** Echoed resolved config (may be null for legacy handlers). */
  config: Record<string, unknown> | null;
  /** Observability metadata (durationMs, statusCode, tokensUsed, etc.). */
  meta: Record<string, unknown> | null;
  /** Port selector (`success`/`error`/case ids). */
  port: string | null;
  /** Engine directive (`waiting_for_input`, `requires_integration`, etc.). */
  status: string | null;
  /** True when the raw value already followed the new `{ config, output }` shape. */
  isStructured: boolean;
}

export function unwrapNodeOutput(raw: unknown): UnwrappedNodeOutput {
  if (
    raw !== null &&
    typeof raw === "object" &&
    !Array.isArray(raw) &&
    "config" in raw &&
    "output" in raw
  ) {
    const obj = raw as Record<string, unknown>;
    return {
      output: obj.output,
      config: toRecord(obj.config),
      meta: toRecord(obj.meta),
      port: typeof obj.port === "string" ? obj.port : null,
      status: typeof obj.status === "string" ? obj.status : null,
      isStructured: true,
    };
  }

  // Legacy: the raw value IS the output. Extract status/port if present.
  const status =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).status
      : undefined;
  const port =
    raw !== null && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>).port
      : undefined;

  return {
    output: raw,
    config: null,
    meta: null,
    port: typeof port === "string" ? port : null,
    status: typeof status === "string" ? status : null,
    isStructured: false,
  };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}
