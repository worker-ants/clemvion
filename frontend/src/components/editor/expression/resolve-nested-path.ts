/**
 * Utilities for resolving nested dot-paths in sample data objects.
 * Used by expression autocomplete to provide deep field suggestions.
 */

/** Maximum nesting depth for path traversal; prevents runaway on deeply nested or cyclic-like data */
const MAX_DEPTH = 10;

/** Matches "key[n]" bracket notation in path segments (single numeric index only) */
const BRACKET_SEGMENT_RE = /^([^[]+)\[(\d+)\]$/;

/** Matches "[n]" standalone index segment */
const INDEX_SEGMENT_RE = /^\[(\d+)\]$/;

/** Returns a human-readable type string for a value */
export function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

/**
 * Parse a dot-path string into segments, handling bracket notation for arrays.
 * Only supports single numeric bracket per segment (e.g., `items[0]`).
 * Nested brackets (`items[0][1]`) or string-key brackets are not supported.
 *
 * "body.items[0].name" → ["body", "items", "[0]", "name"]
 */
export function parsePath(dotPath: string): string[] {
  if (!dotPath) return [];

  const segments: string[] = [];
  const raw = dotPath.split(".");

  for (const part of raw) {
    if (!part) continue;
    const bracketMatch = part.match(BRACKET_SEGMENT_RE);
    if (bracketMatch) {
      segments.push(bracketMatch[1]);
      segments.push(`[${bracketMatch[2]}]`);
    } else {
      segments.push(part);
    }
  }

  return segments;
}

/**
 * Resolve a dot-path against a sample object and return the value at that path.
 * Returns null if the path cannot be resolved (missing keys, primitives, depth exceeded).
 * Note: falsy values like 0, false, "" are returned as-is (only missing/undefined → null).
 */
export function resolveNestedValue(
  sample: Record<string, unknown>,
  dotPath: string,
): unknown {
  if (!dotPath) return sample;

  const segments = parsePath(dotPath);
  if (segments.length > MAX_DEPTH) return null;

  let current: unknown = sample;

  for (const segment of segments) {
    if (current === null || current === undefined) return null;

    // Array index access: [n]
    const indexMatch = segment.match(INDEX_SEGMENT_RE);
    if (indexMatch) {
      if (!Array.isArray(current)) return null;
      const idx = parseInt(indexMatch[1], 10);
      current = (current as unknown[])[idx];
      continue;
    }

    // Object key access
    if (typeof current !== "object" || Array.isArray(current)) return null;
    current = (current as Record<string, unknown>)[segment];
  }

  return current ?? null;
}

/**
 * Get the child keys (with types) at a given dot-path in the sample object.
 * - If the value is an object, returns its keys.
 * - If the value is an array of objects, returns the first element's keys.
 * - Otherwise returns an empty array.
 */
export function getNestedKeys(
  sample: Record<string, unknown>,
  dotPath: string,
): Array<{ key: string; type: string }> {
  const value = resolveNestedValue(sample, dotPath);
  if (value === null || value === undefined) return [];

  // Object → return its keys
  if (typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj).map((key) => ({
      key,
      type: getValueType(obj[key]),
    }));
  }

  // Array → return first element's keys if it's an object
  if (Array.isArray(value) && value.length > 0) {
    const first = value[0];
    if (first && typeof first === "object" && !Array.isArray(first)) {
      const obj = first as Record<string, unknown>;
      return Object.keys(obj).map((key) => ({
        key,
        type: getValueType(obj[key]),
      }));
    }
  }

  return [];
}

/**
 * Split a field path into parentPath and leafPrefix at the last dot.
 * "submittedData.usef" → { parentPath: "submittedData", leafPrefix: "usef" }
 * "stat"               → { parentPath: "", leafPrefix: "stat" }
 * "body."              → { parentPath: "body", leafPrefix: "" }
 * "items[0].name"      → { parentPath: "items[0]", leafPrefix: "name" }
 */
export function splitPathAndLeaf(fullPath: string): {
  parentPath: string;
  leafPrefix: string;
} {
  const lastDot = fullPath.lastIndexOf(".");
  if (lastDot === -1) return { parentPath: "", leafPrefix: fullPath };
  return {
    parentPath: fullPath.slice(0, lastDot),
    leafPrefix: fullPath.slice(lastDot + 1),
  };
}
