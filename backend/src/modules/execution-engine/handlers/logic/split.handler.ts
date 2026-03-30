import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface SplitConfig {
  fieldPath: string;
  keepOtherFields?: boolean;
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
    const { fieldPath, keepOtherFields = false } = config as unknown as SplitConfig;

    const arrayValue = getNestedValue(input, fieldPath);

    if (!Array.isArray(arrayValue)) {
      return [];
    }

    if (!keepOtherFields) {
      return arrayValue;
    }

    const parentFields = this.getFieldsExcluding(input, fieldPath);
    return arrayValue.map((item) => ({
      ...parentFields,
      ...(typeof item === 'object' && item !== null ? item : { value: item }),
    }));
  }

  private getFieldsExcluding(
    input: unknown,
    excludePath: string,
  ): Record<string, unknown> {
    if (typeof input !== 'object' || input === null) {
      return {};
    }

    const result: Record<string, unknown> = {};
    const topLevelKey = excludePath.split('.')[0];

    for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
      if (key !== topLevelKey) {
        result[key] = value;
      }
    }

    return result;
  }
}
