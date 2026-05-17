// Body-cap helpers used by Send Email / HTTP Request (256KB cap) and
// Carousel / Table (1MB cap) when echoing evaluated runtime values on
// `NodeHandlerOutput.output`. Uniform `*Truncated: true` flag lets
// downstream nodes detect cap firing without diffing lengths.
export interface TruncatedBody {
  value: unknown;
  truncated: boolean;
}

const DEFAULT_MAX_BYTES = 256 * 1024;
// 4× the integration cap — Presentation surfaces legitimately exceed 256KB,
// but ≥1MB is a runaway-data signal rather than expected payload.
export const PRESENTATION_MAX_BYTES = 1024 * 1024;

// Cap an arbitrary body value at `maxBytes` UTF-8 bytes for inclusion on
// `NodeHandlerOutput.output`. Strings: sliced at the last complete UTF-8
// codepoint boundary. Buffers: sliced at the byte cap. Objects: returned
// as-is when the serialized form fits, otherwise the truncated JSON string.
// Cyclic / unserializable values surface as `'[Unserializable]'` with
// `truncated: false` (the helper's contract is "size cap exceeded", not
// "serialization failed"). null / undefined / primitives: pass-through.
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

// Shape-preserving array cap for Presentation node outputs (Carousel
// `items`, Table `rows`). Drops elements from the tail until the JSON-
// serialized payload fits within `maxBytes`. Unlike truncateBodyForOutput,
// always returns an array so downstream ForEach / Map / `items[i]` access
// keeps working — just with fewer entries and a `*Truncated: true` flag.
export interface TruncatedArray<T> {
  value: T[];
  truncated: boolean;
  // Element count before truncation — droppedCount = originalLength - value.length.
  originalLength: number;
}

export function truncateArrayForOutput<T>(
  arr: T[],
  maxBytes: number = PRESENTATION_MAX_BYTES,
): TruncatedArray<T> {
  if (!Array.isArray(arr) || arr.length === 0) {
    return {
      value: Array.isArray(arr) ? arr : ([] as T[]),
      truncated: false,
      originalLength: Array.isArray(arr) ? arr.length : 0,
    };
  }
  // Element-wise accumulation — O(N) total bytes scanned in the common
  // case (vs. O(N log N) re-stringifications a binary-search would need).
  // Each element is serialized once; the running total tracks the merged
  // JSON envelope — `[a,b,c]` = "[" + a + "," + b + "," + c + "]" — so we
  // add per-element commas + opening/closing bracket overhead.
  let runningBytes = 2; // '[' + ']'
  let kept = 0;
  for (let i = 0; i < arr.length; i++) {
    let serialized: string | undefined;
    try {
      serialized = JSON.stringify(arr[i]);
    } catch {
      // Cyclic / unserializable element — stop here so the kept prefix is
      // round-trippable. The caller sees `truncated: true`.
      break;
    }
    if (serialized === undefined) break;
    const elementBytes = Buffer.byteLength(serialized, 'utf8');
    // Each element after the first adds a comma separator (1 byte).
    const projected = runningBytes + elementBytes + (kept === 0 ? 0 : 1);
    if (projected > maxBytes) break;
    runningBytes = projected;
    kept = i + 1;
  }
  if (kept === arr.length) {
    return { value: arr, truncated: false, originalLength: arr.length };
  }
  return {
    value: arr.slice(0, kept),
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
