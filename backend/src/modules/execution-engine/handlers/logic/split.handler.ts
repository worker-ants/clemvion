import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../../../nodes/core/node-handler.interface.js';
import { resolveFieldValue } from './nested-value.util.js';

interface SplitConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is
  // used.
  fieldPath: unknown;
}

interface SplitItem {
  index: number;
  value: unknown;
}

export class SplitHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { fieldPath } = config as unknown as SplitConfig;

    if (fieldPath === undefined || fieldPath === null || fieldPath === '') {
      errors.push('fieldPath is required');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { fieldPath } = config as unknown as SplitConfig;
    const baseConfig = { fieldPath };

    const arrayValue = resolveFieldValue(input, fieldPath);

    if (!Array.isArray(arrayValue)) {
      return Promise.resolve({ config: baseConfig, output: [] as SplitItem[] });
    }

    const output: SplitItem[] = (arrayValue as unknown[]).map(
      (value, index) => ({
        index,
        value,
      }),
    );

    return Promise.resolve({ config: baseConfig, output });
  }
}
