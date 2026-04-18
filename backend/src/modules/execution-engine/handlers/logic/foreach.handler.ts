import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../../../nodes/core/node-handler.interface.js';
import { resolveFieldValue } from '../../../../nodes/core/nested-value.util.js';

interface ForEachConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is
  // used.
  arrayField: unknown;
  errorPolicy: 'stop' | 'skip' | 'continue';
  collectResults: boolean;
}

export class ForEachHandler implements NodeHandler {
  validate(config: Record<string, unknown>): ValidationResult {
    const errors: string[] = [];
    const { arrayField, errorPolicy } = config as unknown as ForEachConfig;

    if (arrayField === undefined || arrayField === null || arrayField === '') {
      errors.push('arrayField is required');
    }

    if (
      errorPolicy !== undefined &&
      !['stop', 'skip', 'continue'].includes(errorPolicy)
    ) {
      errors.push('errorPolicy must be one of: stop, skip, continue');
    }

    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const { arrayField } = config as unknown as ForEachConfig;

    const resolved = resolveFieldValue(input, arrayField);
    const items = Array.isArray(resolved) ? resolved : [];

    return Promise.resolve({
      config: { arrayField },
      output: items,
    });
  }
}
