/**
 * Builds a map of node IDs to disambiguated keys for use in $node expressions.
 *
 * When all labels are unique, each node maps to its label directly.
 * When duplicate labels exist, subsequent occurrences receive a `#N` suffix
 * (e.g., "HTTP Request", "HTTP Request#2", "HTTP Request#3") based on
 * insertion order (typically topological/execution order).
 *
 * @param entries - Array of { id, label } in desired ordering (e.g., execution order)
 * @returns Map from nodeId to resolvedKey
 */
export function buildDisambiguatedKeys(
  entries: Array<{ id: string; label: string }>,
): Map<string, string> {
  const labelCounts = new Map<string, number>();
  for (const entry of entries) {
    labelCounts.set(entry.label, (labelCounts.get(entry.label) ?? 0) + 1);
  }

  const labelIndices = new Map<string, number>();
  const result = new Map<string, string>();

  for (const entry of entries) {
    const count = labelCounts.get(entry.label)!;
    if (count === 1) {
      result.set(entry.id, entry.label);
    } else {
      const idx = (labelIndices.get(entry.label) ?? 0) + 1;
      labelIndices.set(entry.label, idx);
      result.set(entry.id, idx === 1 ? entry.label : `${entry.label}#${idx}`);
    }
  }

  return result;
}
