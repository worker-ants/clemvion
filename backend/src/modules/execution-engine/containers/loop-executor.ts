import { Injectable } from '@nestjs/common';
import { ExecutionContext } from '../../../nodes/core/node-handler.interface';

const DEFAULT_MAX_ITERATIONS = 1000;

export interface LoopConfig {
  count: number;
  breakCondition?: (context: ExecutionContext) => boolean;
  maxIterations?: number;
}

export interface LoopIterationResult {
  index: number;
  output: unknown;
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
   * @returns Array of iteration results
   */
  async execute(
    config: LoopConfig,
    context: ExecutionContext,
    executeBody: (
      input: unknown,
      context: ExecutionContext,
    ) => Promise<unknown>,
  ): Promise<LoopIterationResult[]> {
    const maxIterations = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;
    const count = config.count;

    if (count > maxIterations) {
      throw new Error(
        `MAX_ITERATIONS_EXCEEDED: Loop count ${count} exceeds maximum ${maxIterations}`,
      );
    }

    const results: LoopIterationResult[] = [];
    let previousOutput: unknown = undefined;

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

        // Check break condition
        if (config.breakCondition && config.breakCondition(context)) {
          break;
        }
      }
    } finally {
      context.loopContext = prevLoopContext;
    }

    return results;
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
