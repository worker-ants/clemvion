import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../node-handler.interface.js';
import { getNestedValue } from './nested-value.util.js';

interface SwitchCase {
  id: string;
  label?: string;
  value: unknown;
}

interface SwitchConfig {
  switchValue: string;
  cases: SwitchCase[];
  hasDefault?: boolean;
}

export class SwitchHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { switchValue, cases, hasDefault } =
      config as unknown as SwitchConfig;

    if (!switchValue || typeof switchValue !== 'string') {
      errors.push('switchValue is required and must be a string');
    }

    if (!cases || !Array.isArray(cases)) {
      errors.push('cases must be an array');
    } else {
      for (let i = 0; i < cases.length; i++) {
        const c = cases[i];
        if (!c.id || typeof c.id !== 'string') {
          errors.push(`cases[${i}].id is required and must be a string`);
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

  async execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { switchValue, cases, hasDefault } =
      config as unknown as SwitchConfig;

    const actualValue = getNestedValue(input, switchValue);

    const matchedCase = cases.find((c) => c.value === actualValue);

    if (matchedCase) {
      return { port: matchedCase.id, data: input };
    }

    if (hasDefault !== false) {
      return { port: 'default', data: input };
    }

    throw new Error(
      `No matching case found for value "${String(actualValue)}" and no default case configured`,
    );
  }
}
