import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

export const DEFAULT_MAX_ITERATIONS = 1000;

export type LoopExitReason = 'completed' | 'break' | 'maxIterations';

export interface LoopConfig {
  count: number;
  /**
   * Optional per-iteration predicate. Evaluated **after** each body iteration
   * runs (CONVENTIONS: spec/4-nodes/1-logic/3-loop.md §6); a `true` return
   * triggers early exit with `exitReason='break'`. Engine builds the closure
   * from `node.config.breakCondition` (a `{{ ... }}` boolean expression) so
   * `$loop.index`, `$var.*`, and `$node[...].output` see the **current**
   * iteration state.
   */
  breakCondition?: (context: ExecutionContext) => boolean;
  maxIterations?: number;
}

export interface LoopIterationResult {
  index: number;
  output: unknown;
}

export interface LoopExecutionResult {
  iterations: LoopIterationResult[];
  /**
   * How the loop terminated. `'break'` requires a configured
   * `breakCondition` that returned `true`; `'maxIterations'` is set when the
   * planned `count` happens to equal the safety cap and every iteration
   * ran. Otherwise `'completed'`.
   */
  exitReason: LoopExitReason;
}

/**
 * Execute a loop container: evaluate count, iterate, manage $loop context.
 */
@Injectable()
export class LoopExecutor {
  /**
   * Execute a loop, calling the body executor for each iteration.
   *
   * @param config - Loop configuration (count, break condition, max iterations)
   * @param context - The current execution context (will be mutated with loopContext)
   * @param executeBody - Function that executes the container body and returns leaf node outputs
   * @returns Iteration results plus the exit reason
   */
  async execute(
    config: LoopConfig,
    context: ExecutionContext,
    executeBody: (
      input: unknown,
      context: ExecutionContext,
    ) => Promise<unknown>,
  ): Promise<LoopExecutionResult> {
    const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const count = config.count;

    if (count > maxIterations) {
      throw new Error(
        `MAX_ITERATIONS_EXCEEDED: Loop count ${count} exceeds maximum ${maxIterations}`,
      );
    }

    const results: LoopIterationResult[] = [];
    let previousOutput: unknown = undefined;
    let exitReason: LoopExitReason = 'completed';

    // Save prior loopContext so nested Loop containers restore outer state
    // when they finish instead of wiping it.
    const prevLoopContext = context.loopContext;

    try {
      for (let i = 0; i < count; i++) {
        if (i >= maxIterations) {
          throw new Error(
            `MAX_ITERATIONS_EXCEEDED: Loop iteration ${i} exceeds maximum ${maxIterations}`,
          );
        }

        // Set $loop context
        context.loopContext = {
          index: i,
          count,
          isFirst: i === 0,
          isLast: i === count - 1,
        };

        const output = await executeBody(previousOutput, context);
        results.push({ index: i, output });
        previousOutput = output;

        // Check break condition (post-iteration per spec §6).
        if (config.breakCondition && config.breakCondition(context)) {
          exitReason = 'break';
          break;
        }
      }

      // If the loop ran to completion AND the planned count equals the
      // safety cap, classify as `maxIterations` so observability tools can
      // distinguish it from a natural completion.
      if (exitReason === 'completed' && results.length >= maxIterations) {
        exitReason = 'maxIterations';
      }
    } finally {
      context.loopContext = prevLoopContext;
    }

    return { iterations: results, exitReason };
  }

  /**
   * Merge leaf node outputs according to spec rules (section 3.1.2):
   * - Single leaf: output as-is
   * - Multiple leaves: keyed by nodeId
   */
  mergeLeafOutputs(leafOutputs: Record<string, unknown>): unknown {
    const keys = Object.keys(leafOutputs);
    if (keys.length === 1) {
      return leafOutputs[keys[0]];
    }
    return { ...leafOutputs };
  }
}
