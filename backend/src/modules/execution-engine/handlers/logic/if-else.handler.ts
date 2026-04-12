import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface Condition {
  field: string;
  operator: string;
  value: unknown;
}

interface IfElseConfig {
  conditions: Condition[];
  combineMode: 'and' | 'or';
}

const VALID_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'is_null',
] as const;

export class IfElseHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { conditions, combineMode } = config as unknown as IfElseConfig;

    if (!conditions || !Array.isArray(conditions)) {
      errors.push('conditions must be a non-empty array');
    } else {
      if (conditions.length === 0) {
        errors.push('conditions must be a non-empty array');
      }
      for (let i = 0; i < conditions.length; i++) {
        const cond = conditions[i];
        if (!cond.field || typeof cond.field !== 'string') {
          errors.push(
            `conditions[${i}].field is required and must be a string`,
          );
        }
        if (
          !cond.operator ||
          !VALID_OPERATORS.includes(
            cond.operator as (typeof VALID_OPERATORS)[number],
          )
        ) {
          errors.push(
            `conditions[${i}].operator must be one of: ${VALID_OPERATORS.join(', ')}`,
          );
        }
      }
    }

    if (combineMode && combineMode !== 'and' && combineMode !== 'or') {
      errors.push('combineMode must be "and" or "or"');
    }

    return { valid: errors.length === 0, errors };
  }

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { conditions, combineMode = 'and' } =
      config as unknown as IfElseConfig;

    const results = conditions.map((cond) =>
      this.evaluateCondition(input, cond),
    );

    const passed =
      combineMode === 'and' ? results.every(Boolean) : results.some(Boolean);

    return {
      config: { conditions, combineMode },
      output: input,
      port: passed ? 'true' : 'false',
    };
  }

  private evaluateCondition(input: unknown, condition: Condition): boolean {
    const fieldValue = getNestedValue(input, condition.field);
    const compareValue = condition.value;

    switch (condition.operator) {
      case 'eq':
        return fieldValue === compareValue;
      case 'neq':
        return fieldValue !== compareValue;
      case 'gt':
        return Number(fieldValue) > Number(compareValue);
      case 'gte':
        return Number(fieldValue) >= Number(compareValue);
      case 'lt':
        return Number(fieldValue) < Number(compareValue);
      case 'lte':
        return Number(fieldValue) <= Number(compareValue);
      case 'contains':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.includes(compareValue)
          : false;
      case 'not_contains':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? !fieldValue.includes(compareValue)
          : true;
      case 'starts_with':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.startsWith(compareValue)
          : false;
      case 'ends_with':
        return typeof fieldValue === 'string' &&
          typeof compareValue === 'string'
          ? fieldValue.endsWith(compareValue)
          : false;
      case 'is_empty':
        return (
          fieldValue === '' ||
          fieldValue === null ||
          fieldValue === undefined ||
          (Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'is_not_empty':
        return (
          fieldValue !== '' &&
          fieldValue !== null &&
          fieldValue !== undefined &&
          !(Array.isArray(fieldValue) && fieldValue.length === 0)
        );
      case 'is_null':
        return fieldValue === null || fieldValue === undefined;
      default:
        return false;
    }
  }
}
