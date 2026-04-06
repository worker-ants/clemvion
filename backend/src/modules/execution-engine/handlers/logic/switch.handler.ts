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
    _context: ExecutionContext, // eslint-disable-line @typescript-eslint/no-unused-vars
  ): Promise<unknown> {
    const { switchValue, cases, hasDefault } =
      config as unknown as SwitchConfig;

    const actualValue =
      typeof switchValue === 'string'
        ? getNestedValue(input, switchValue)
        : switchValue;

    const matchedCase = cases.find((c) => c.value === actualValue);

    if (matchedCase) {
      return { port: matchedCase.id, data: input };
    }

    if (hasDefault !== false) {
      return { port: 'default', data: input };
    }

    throw new Error('No matching case found and no default case configured');
  }
}
