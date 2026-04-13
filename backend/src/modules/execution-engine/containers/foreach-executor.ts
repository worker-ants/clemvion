import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../handlers/node-handler.interface';

export type ForEachErrorPolicy = 'stop' | 'skip' | 'continue';

export interface ForEachConfig {
  array: unknown[];
  errorPolicy?: ForEachErrorPolicy;
  collectResults?: boolean;
}

export interface SkippedResult {
  _skipped: true;
  error: { code: string; message: string };
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
   * @returns Array of results maintaining index positions
   */
  async execute(
    config: ForEachConfig,
    context: ExecutionContext,
    executeBody: (item: unknown, context: ExecutionContext) => Promise<unknown>,
  ): Promise<unknown[]> {
    const { array, errorPolicy = 'stop', collectResults = true } = config;
    const results: unknown[] = [];

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
            results.push(output);
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
              if (collectResults) {
                const skipped: SkippedResult = {
                  _skipped: true,
                  error: { code: errorCode, message: errorMessage },
                };
                results.push(skipped);
              }
              break;

            case 'continue':
              if (collectResults) {
                const skipped: SkippedResult = {
                  _skipped: true,
                  error: { code: errorCode, message: errorMessage },
                };
                results.push(skipped);
              }
              break;
          }
        }
      }
    } finally {
      context.itemContext = prevItemContext;
    }

    return results;
  }
}
