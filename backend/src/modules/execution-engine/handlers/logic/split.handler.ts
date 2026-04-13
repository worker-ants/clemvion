import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface SplitConfig {
  fieldPath: string;
}

interface SplitItem {
  index: number;
  value: unknown;
}

export class SplitHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { fieldPath } = config as unknown as SplitConfig;

    if (!fieldPath || typeof fieldPath !== 'string') {
      errors.push('fieldPath is required and must be a string');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { fieldPath } = config as unknown as SplitConfig;
    const baseConfig = { fieldPath };

    const arrayValue = getNestedValue(input, fieldPath);

    if (!Array.isArray(arrayValue)) {
      return { config: baseConfig, output: [] as SplitItem[] };
    }

    const output: SplitItem[] = arrayValue.map((value, index) => ({
      index,
      value,
    }));

    return { config: baseConfig, output };
  }
}
