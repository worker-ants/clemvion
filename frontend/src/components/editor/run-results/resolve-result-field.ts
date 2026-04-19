/**
 * Helper for reading LLM-category node output fields that migrated from the
 * legacy top-level path (`output.<field>`) to the CONVENTIONS §8 path
 * (`output.result.<field>`). Centralising the dual-path lookup means the
 * legacy branch has exactly one call site to delete once the migration
 * script has been applied across all environments.
 *
 * Kept separate from `output-shape.ts` so it can be tree-shaken out of
 * bundles that don't render LLM node previews.
 */
export function resolveResultField<T = unknown>(
  output: unknown,
  key: string,
): T | undefined {
  if (!output || typeof output !== "object") return undefined;
  const outputRec = output as Record<string, unknown>;
  const resultBag = outputRec.result;
  if (
    resultBag &&
    typeof resultBag === "object" &&
    !Array.isArray(resultBag) &&
    key in (resultBag as Record<string, unknown>)
  ) {
    return (resultBag as Record<string, unknown>)[key] as T | undefined;
  }
  if (key in outputRec) {
    return outputRec[key] as T | undefined;
  }
  return undefined;
}
