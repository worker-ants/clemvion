import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface ForEachConfig {
  arrayField: string;
  errorPolicy: 'stop' | 'skip' | 'continue';
  collectResults: boolean;
}

export class ForEachHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { arrayField, errorPolicy } = config as unknown as ForEachConfig;

    if (!arrayField || typeof arrayField !== 'string') {
      errors.push('arrayField is required and must be a string');
    }

    if (
      errorPolicy !== undefined &&
      !['stop', 'skip', 'continue'].includes(errorPolicy)
    ) {
      errors.push('errorPolicy must be one of: stop, skip, continue');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { arrayField } = config as unknown as ForEachConfig;

    const array = getNestedValue(input, arrayField);
    const items = Array.isArray(array) ? array : [];

    return { arrayField, items };
  }
}
