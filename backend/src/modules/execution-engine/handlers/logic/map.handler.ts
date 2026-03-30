import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface FieldMapping {
  targetField: string;
  sourceField: string;
}

interface MapConfig {
  inputField: string;
  mapping: FieldMapping[];
}

export class MapHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { inputField, mapping } = config as unknown as MapConfig;

    if (!inputField || typeof inputField !== 'string') {
      errors.push('inputField is required and must be a string');
    }

    if (!mapping || !Array.isArray(mapping)) {
      errors.push('mapping must be an array');
    } else {
      if (mapping.length === 0) {
        errors.push('mapping must not be empty');
      }
      for (let i = 0; i < mapping.length; i++) {
        const m = mapping[i];
        if (!m.targetField || typeof m.targetField !== 'string') {
          errors.push(
            `mapping[${i}].targetField is required and must be a string`,
          );
        }
        if (!m.sourceField || typeof m.sourceField !== 'string') {
          errors.push(
            `mapping[${i}].sourceField is required and must be a string`,
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { inputField, mapping } = config as unknown as MapConfig;

    const array = getNestedValue(input, inputField);

    if (!Array.isArray(array)) {
      return [];
    }

    return array.map((item) => {
      const result: Record<string, unknown> = {};

      for (const m of mapping) {
        result[m.targetField] = getNestedValue(item, m.sourceField);
      }

      return result;
    });
  }
}
