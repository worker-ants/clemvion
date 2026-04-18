import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../../../nodes/core/node-handler.interface.js';
import { getNestedValue } from '../../../../nodes/core/nested-value.util.js';

const VALID_VALUE_TYPES = new Set(['string', 'number', 'boolean']);
type CaseValueType = 'string' | 'number' | 'boolean';

interface SwitchCase {
  id: string;
  label?: string;
  value: unknown;
  valueType?: CaseValueType;
}

interface SwitchConfig {
  switchValue: unknown;
  cases: SwitchCase[];
  hasDefault?: boolean;
}

export class SwitchHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { switchValue, cases, hasDefault } =
      config as unknown as SwitchConfig;

    if (
      switchValue === undefined ||
      switchValue === null ||
      (typeof switchValue === 'string' && switchValue.trim() === '')
    ) {
      errors.push('switchValue is required');
    }

    if (!cases || !Array.isArray(cases) || cases.length === 0) {
      errors.push('cases must be a non-empty array');
    } else {
      const seenIds = new Set<string>();
      for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        if (!c.id || typeof c.id !== 'string') {
          errors.push(`cases[${i}].id is required and must be a string`);
        } else if (seenIds.has(c.id)) {
          errors.push(`cases[${i}].id '${c.id}' is duplicated`);
        } else {
          seenIds.add(c.id);
        }
        if (c.valueType !== undefined && !VALID_VALUE_TYPES.has(c.valueType)) {
          errors.push(
            `cases[${i}].valueType must be one of: string, number, boolean`,
          );
        }
      }
    }

    if (
      hasDefault !== undefined &&
      hasDefault !== null &&
      typeof hasDefault !== 'boolean'
    ) {
      errors.push('hasDefault must be a boolean');
    }

    return { valid: errors.length === 0, errors };
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { switchValue, cases, hasDefault } =
      config as unknown as SwitchConfig;

    const actualValue =
      typeof switchValue === 'string'
        ? getNestedValue(input, switchValue)
        : switchValue;

    const expression =
      typeof switchValue === 'string' ? switchValue : undefined;

    const matchedCase = cases.find(
      (c) => this.coerceCaseValue(c.value, c.valueType) === actualValue,
    );

    if (matchedCase) {
      return {
        config: { switchValue, cases },
        output: input,
        meta: { expression, value: actualValue, matchedCase: matchedCase.id },
        port: matchedCase.id,
      };
    }

    if (hasDefault !== false) {
      return {
        config: { switchValue, cases },
        output: input,
        meta: { expression, value: actualValue, matchedCase: 'default' },
        port: 'default',
      };
    }

    throw new Error('No matching case found and no default case configured');
  }

  private coerceCaseValue(value: unknown, valueType?: CaseValueType): unknown {
    if (valueType === undefined || valueType === 'string') {
      return value;
    }
    if (typeof value !== 'string') {
      return value;
    }
    if (valueType === 'number') {
      const n = Number(value);
      return Number.isNaN(n) ? value : n;
    }
    if (valueType === 'boolean') {
      if (value === 'true') return true;
      if (value === 'false') return false;
      return value;
    }
    return value;
  }
}
