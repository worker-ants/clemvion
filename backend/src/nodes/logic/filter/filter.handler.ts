import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import { resolveFieldValue } from '../../core/nested-value.util.js';
import {
  Condition,
  compileRegexCache,
  evaluateCondition,
} from '../_shared/condition-eval.util.js';
import { filterNodeMetadata } from './filter.schema.js';

interface FilterConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is used.
  inputField: unknown;
  conditions: Condition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

export class FilterHandler implements NodeHandler {
  metadata = filterNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers inputField,
    // conditions empty / per-condition field+operator. The combineMode enum
    // guard stays handler-side because zod's enum default narrows it; we
    // keep the explicit reject so direct callers still fail loudly.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    const { combineMode } = config as unknown as FilterConfig;
    if (combineMode && combineMode !== 'and' && combineMode !== 'or') {
      errors.push('combineMode must be "and" or "or"');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    _context: ExecutionContext,
  ): Promise<unknown> {
    const {
      inputField,
      conditions,
      combineMode = 'and',
      strictComparison = false,
    } = config as unknown as FilterConfig;

    const array = resolveFieldValue(input, inputField);

    if (!Array.isArray(array)) {
      throw new Error('Filter inputField does not resolve to an array');
    }

    const compiledRegexes = compileRegexCache(conditions);

    const match: unknown[] = [];
    const unmatched: unknown[] = [];

    for (const item of array) {
      const passed =
        combineMode === 'or'
          ? conditions.some((cond, i) =>
              evaluateCondition(
                item,
                cond,
                strictComparison,
                compiledRegexes.get(i),
              ),
            )
          : conditions.every((cond, i) =>
              evaluateCondition(
                item,
                cond,
                strictComparison,
                compiledRegexes.get(i),
              ),
            );

      if (passed) {
        match.push(item);
      } else {
        unmatched.push(item);
      }
    }

    return Promise.resolve({
      config: { inputField, conditions, combineMode, strictComparison },
      output: { match, unmatched },
    });
  }
}
