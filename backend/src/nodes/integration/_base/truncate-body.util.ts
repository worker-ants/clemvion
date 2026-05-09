/**
 * Result envelope for body-cap helpers used by Send Email / HTTP Request when
 * echoing evaluated request bodies on `NodeHandlerOutput.output`. Keeping the
 * shape uniform across handlers lets downstream nodes detect truncation
 * deterministically (`output.bodyTruncated === true`).
 */
export interface TruncatedBody {
  value: unknown;
  truncated: boolean;
}

const DEFAULT_MAX_BYTES = 256 * 1024;
/**
 * Cap for Presentation node array fields (Carousel `items`, Table `rows`).
 * 4× the integration-handler cap because Presentation nodes are user-visible
 * surfaces — a single user-authored carousel with rich items legitimately
 * exceeds 256KB, but ≥1MB is a runaway-data signal rather than expected
 * payload. Keeps DB JSONB rows and WebSocket frames bounded.
 */
export const PRESENTATION_MAX_BYTES = 1024 * 1024;

/**
 * Cap an arbitrary body value at `maxBytes` UTF-8 bytes for inclusion on
 * `NodeHandlerOutput.output`. The cap defends downstream consumers (DB row
 * size, websocket payload, expression cache) against multi-MB request bodies
 * that workflow authors might paste verbatim into an HTTP node.
 *
 * Behaviour:
 * - `null` / `undefined` — passed through verbatim (no truncation).
 * - `string` — measured with `Buffer.byteLength(value, 'utf8')`. If the
 *   limit is exceeded, the string is sliced at the last complete UTF-8
 *   codepoint boundary so we never emit malformed sequences.
 * - `Buffer` — measured by `.length`. Sliced at the byte cap if exceeded.
 * - `object` — JSON-stringified first; if the serialization is within
 *   limits the original object is returned (preserves consumer ergonomics).
 *   Over-cap objects fall back to the truncated JSON string so the
 *   serialized snapshot remains inspectable.
 * - cyclic / unserializable objects — replaced with `'[Unserializable]'`
 *   (JSON.stringify throws). `truncated` stays `false` because the helper's
 *   contract is "size cap exceeded", not "serialization failed".
 * - other primitives — returned as-is.
 *
 * Decision recorded in `plan/in-progress/engine-raw-config-exposure.md`
 * (§결정 보강).
 */
export function truncateBodyForOutput(
  value: unknown,
  maxBytes: number = DEFAULT_MAX_BYTES,
): TruncatedBody {
  if (value === undefined || value === null) {
    return { value, truncated: false };
  }

  if (typeof value === 'string') {
    return capString(value, maxBytes);
  }

  if (Buffer.isBuffer(value)) {
    if (value.length <= maxBytes) {
      return { value, truncated: false };
    }
    return { value: value.subarray(0, maxBytes), truncated: true };
  }

  if (typeof value === 'object') {
    let serialized: string;
    try {
      serialized = JSON.stringify(value);
    } catch {
      // Cyclic or otherwise unserializable; surface a placeholder so the
      // consumer doesn't see a silently dropped field.
      return { value: '[Unserializable]', truncated: false };
    }
    if (serialized === undefined) {
      // JSON.stringify can return undefined for things like a bare function
      // — treat as unserializable.
      return { value: '[Unserializable]', truncated: false };
    }
    if (Buffer.byteLength(serialized, 'utf8') <= maxBytes) {
      return { value, truncated: false };
    }
    const capped = capString(serialized, maxBytes);
    return { value: capped.value, truncated: true };
  }

  // Numbers / booleans / bigints — return as-is (their string forms are
  // bounded; truncation isn't meaningful).
  return { value, truncated: false };
}

/**
 * Shape-preserving array cap for Presentation node outputs (Carousel `items`,
 * Table `rows`). Drops elements from the tail until the JSON-serialized
 * payload fits within `maxBytes`. Unlike {@link truncateBodyForOutput}, this
 * always returns an array so downstream programmatic access
 * (`$node["X"].output.items[i]`, ForEach/Map iteration) keeps working — just
 * with fewer entries and a `*Truncated: true` flag from the caller.
 *
 * Decided 2026-05-09: 1MB cap (b) for Presentation nodes
 * (`plan/in-progress/engine-raw-config-followups.md` Follow-up 2).
 */
export interface TruncatedArray<T> {
  value: T[];
  truncated: boolean;
  /** Element count before truncation — surfaced so downstream observers can
   * compute `droppedCount = originalLength - value.length`. */
  originalLength: number;
}

export function truncateArrayForOutput<T>(
  arr: T[],
  maxBytes: number = PRESENTATION_MAX_BYTES,
): TruncatedArray<T> {
  if (!Array.isArray(arr)) {
    return { value: [] as T[], truncated: false, originalLength: 0 };
  }
  if (arr.length === 0) {
    return { value: arr, truncated: false, originalLength: 0 };
  }
  const measure = (slice: T[]): number => {
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(slice);
    } catch {
      // Cyclic / unserializable element — treat as oversize so the binary
      // search lands on the largest still-serializable prefix.
      return Number.POSITIVE_INFINITY;
    }
    return serialized === undefined
      ? Number.POSITIVE_INFINITY
      : Buffer.byteLength(serialized, 'utf8');
  };
  if (measure(arr) <= maxBytes) {
    return { value: arr, truncated: false, originalLength: arr.length };
  }
  // Binary search the largest prefix length that fits the byte budget.
  let lo = 0;
  let hi = arr.length;
  while (lo < hi) {
    // Ceiling midpoint so the loop converges on the largest fitting prefix.
    const mid = Math.floor((lo + hi + 1) / 2);
    if (measure(arr.slice(0, mid)) <= maxBytes) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return {
    value: arr.slice(0, lo),
    truncated: true,
    originalLength: arr.length,
  };
}

function capString(input: string, maxBytes: number): TruncatedBody {
  const buf = Buffer.from(input, 'utf8');
  if (buf.length <= maxBytes) {
    return { value: input, truncated: false };
  }
  // Slice at the byte cap, then decode and re-encode to drop any partial
  // UTF-8 sequence at the boundary. `Buffer.toString('utf8')` replaces
  // partial sequences with U+FFFD; trim trailing replacement chars so the
  // final string round-trips cleanly to the original byte cap.
  const sliced = buf.subarray(0, maxBytes);
  const decoded = sliced.toString('utf8');
  const trimmed = decoded.replace(/�+$/, '');
  return { value: trimmed, truncated: true };
}
