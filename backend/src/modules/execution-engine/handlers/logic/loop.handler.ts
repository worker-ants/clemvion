import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';

interface LoopConfig {
  count: number | string;
  maxIterations?: number | string;
}

const DEFAULT_MAX_ITERATIONS = 1000;

/**
 * Parse a numeric config value that may arrive as a raw number, a plain
 * numeric string (the UI commonly stores number inputs as strings), or an
 * unresolved expression like `{{ $input.count }}`. Returns null when the
 * value is a literal that clearly isn't a number, so validate can surface
 * the mismatch; unresolved expressions return null at validate time but are
 * resolved at execute time by the expression resolver.
 */
function parseNumeric(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (trimmed === '') return null;
    // Expression placeholders are resolved upstream — accept them without
    // validating the numeric shape.
    if (/\{\{.*\}\}/.test(trimmed)) return null;
    const n = Number(trimmed);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function looksLikeExpression(value: unknown): boolean {
  return typeof value === 'string' && /\{\{.*\}\}/.test(value.trim());
}

export class LoopHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { count, maxIterations } = config as unknown as LoopConfig;

    if (count === undefined || count === null || count === '') {
      errors.push('count is required');
    } else if (!looksLikeExpression(count)) {
      const parsed = parseNumeric(count);
      if (parsed === null) {
        errors.push('count must be a number or expression');
      } else if (parsed <= 0) {
        errors.push('count must be greater than 0');
      }
    }

    if (maxIterations !== undefined && maxIterations !== null) {
      if (!looksLikeExpression(maxIterations)) {
        const parsedMax = parseNumeric(maxIterations);
        if (parsedMax === null) {
          errors.push('maxIterations must be a number');
        } else if (
          typeof count === 'number' &&
          !looksLikeExpression(count) &&
          count > parsedMax
        ) {
          errors.push(
            `count must be less than or equal to maxIterations (${parsedMax})`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    _input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { count, maxIterations } = config as unknown as LoopConfig;
    const resolvedCount = parseNumeric(count) ?? 0;
    const resolvedMax =
      maxIterations === undefined || maxIterations === null
        ? DEFAULT_MAX_ITERATIONS
        : (parseNumeric(maxIterations) ?? DEFAULT_MAX_ITERATIONS);

    return Promise.resolve({
      config: { count: resolvedCount, maxIterations: resolvedMax },
      output: null,
    });
  }
}
