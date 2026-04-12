import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';

interface LoopConfig {
  count: number;
  maxIterations?: number;
}

const DEFAULT_MAX_ITERATIONS = 1000;

export class LoopHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { count, maxIterations } = config as unknown as LoopConfig;

    if (count === undefined || count === null || typeof count !== 'number') {
      errors.push('count is required and must be a number');
    } else if (count <= 0) {
      errors.push('count must be greater than 0');
    }

    const max = maxIterations ?? DEFAULT_MAX_ITERATIONS;

    if (maxIterations !== undefined && typeof maxIterations !== 'number') {
      errors.push('maxIterations must be a number');
    } else if (typeof count === 'number' && count > max) {
      errors.push(`count must be less than or equal to maxIterations (${max})`);
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { count, maxIterations } = config as unknown as LoopConfig;
    const max = maxIterations ?? DEFAULT_MAX_ITERATIONS;

    return {
      config: { count, maxIterations: max },
      output: null,
    };
  }
}
