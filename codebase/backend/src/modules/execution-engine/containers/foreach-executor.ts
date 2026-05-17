import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

export type ForEachErrorPolicy = 'stop' | 'skip' | 'continue';

export interface ForEachConfig {
  array: unknown[];
  errorPolicy?: ForEachErrorPolicy;
  collectResults?: boolean;
}

/**
 * Per-iteration error captured for `errorPolicy = 'skip' | 'continue'`.
 *
 * The `index` corresponds to the original input array index (preserved even
 * though `items[index]` is set to `null` placeholder rather than holding an
 * inline `_skipped` marker).
 */
export interface ForEachSkippedEntry {
  index: number;
  error: { code: string; message: string };
}

/**
 * Result returned by {@link ForEachExecutor.execute}.
 *
 * - `items[i]` — successful body emit at index `i`, or `null` placeholder when
 *   that iteration was skipped (`errorPolicy = 'skip' | 'continue'`). The array
 *   length always equals the input array length so downstream callers can
 *   correlate by index.
 * - `skipped` — separated per-iteration error records. Empty when no skips.
 * - `skippedCount` — `skipped.length`, surfaced for `meta.skippedCount`
 *   without forcing callers to walk the array.
 *
 * **Migration note (Phase 1 — D, no backwards compat)**: prior to this change
 * the executor returned `unknown[]` with inline `{ _skipped: true, error }`
 * markers mixed into the success array. Callers that need that legacy shape
 * (e.g. `map` finalises as `{ mapped, count }` with inline markers per
 * spec/4-nodes/1-logic/7-map.md §5.4) must reconstruct it from this struct.
 */
export interface ForEachExecutionResult {
  items: unknown[];
  skipped: ForEachSkippedEntry[];
  skippedCount: number;
}

/**
 * Execute a ForEach container: iterate over an array, manage $item context.
 */
@Injectable()
export class ForEachExecutor {
  /**
   * Execute the ForEach loop over items.
   *
   * @param config - ForEach configuration
   * @param context - Current execution context (will be mutated with itemContext)
   * @param executeBody - Function that executes the body for a single item
   * @returns Separated success / skip results. See {@link ForEachExecutionResult}.
   */
  async execute(
    config: ForEachConfig,
    context: ExecutionContext,
    executeBody: (item: unknown, context: ExecutionContext) => Promise<unknown>,
  ): Promise<ForEachExecutionResult> {
    const { array, errorPolicy = 'stop', collectResults = true } = config;
    const items: unknown[] = [];
    const skipped: ForEachSkippedEntry[] = [];

    // Save prior itemContext so nested ForEach containers restore outer state
    // when they finish instead of wiping it.
    const prevItemContext = context.itemContext;

    try {
      for (let i = 0; i < array.length; i++) {
        const item = array[i];

        // Set $item context
        context.itemContext = {
          item,
          index: i,
          isFirst: i === 0,
          isLast: i === array.length - 1,
        };

        try {
          const output = await executeBody(item, context);
          if (collectResults) {
            items.push(output);
          }
        } catch (error: unknown) {
          const errorMessage =
            error instanceof Error ? error.message : String(error);
          const errorCode =
            error instanceof Error ? error.name : 'UNKNOWN_ERROR';

          switch (errorPolicy) {
            case 'stop':
              throw error;

            case 'skip':
            case 'continue':
              if (collectResults) {
                // Index-preserving placeholder — `null` marks the slot so
                // `items[i]` still aligns with the input array index. Detail
                // moves to `skipped[]` (Phase 1 — D, spec §5.3).
                items.push(null);
                skipped.push({
                  index: i,
                  error: { code: errorCode, message: errorMessage },
                });
              }
              break;
          }
        }
      }
    } finally {
      context.itemContext = prevItemContext;
    }

    return { items, skipped, skippedCount: skipped.length };
  }
}
