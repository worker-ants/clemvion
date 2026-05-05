import {
  evaluate,
  ExpressionContext as EngineContext,
} from '@workflow/expression-engine';
import {
  NodeHandler,
  ValidationResult,
  ExecutionContext,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  getNestedValue,
  resolveFieldValue,
} from '../../core/nested-value.util.js';
import {
  Condition,
  MAX_REGEX_LENGTH,
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

const EXPRESSION_PATTERN = /\{\{/;

export class FilterHandler implements NodeHandler {
  metadata = filterNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers inputField,
    // conditions empty / per-condition operator + non-string field.
    // The combineMode enum guard stays handler-side because zod's enum
    // default narrows it; we keep the explicit reject so direct callers
    // still fail loudly.
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
    context: ExecutionContext,
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

    const baseCtx = (context.expressionContext ?? {}) as EngineContext;

    // Per-pattern regex cache. Patterns can be expressions resolving to
    // different strings per item, so we lazily compile and memoize by the
    // resolved string. `null` marks invalid/oversized patterns so we don't
    // retry compilation each iteration.
    const regexCache = new Map<string, RegExp | null>();
    const getRegex = (pattern: unknown): RegExp | undefined => {
      if (typeof pattern !== 'string') return undefined;
      if (pattern.length > MAX_REGEX_LENGTH) return undefined;
      const cached = regexCache.get(pattern);
      if (cached !== undefined) return cached ?? undefined;
      try {
        const r = new RegExp(pattern);
        regexCache.set(pattern, r);
        return r;
      } catch {
        regexCache.set(pattern, null);
        return undefined;
      }
    };

    const match: unknown[] = [];
    const unmatched: unknown[] = [];

    const items = array as unknown[];
    for (let index = 0; index < items.length; index++) {
      const item: unknown = items[index];

      // Per-item expression context (spec/4-nodes/1-logic-nodes.md §8 line
      // 405): bind `$item` / `$itemIndex` so condition expressions resolve
      // against the current array element.
      const itemCtx: EngineContext = {
        ...baseCtx,
        $item: item,
        $itemIndex: index,
      };

      const evalOne = (cond: Condition): boolean => {
        // Compute fieldValue per spec rules:
        //  - empty / "$item" sentinel → the item itself (scalar arrays).
        //  - inline expression `{{ ... }}` → evaluated value (per-item ctx).
        //  - plain string → dot-path lookup on the item.
        //  - non-string (already-resolved upstream) → use as-is.
        const fieldValue = this.computeFieldValue(cond.field, item, itemCtx);
        const resolvedValue = this.resolveIfExpression(cond.value, itemCtx);
        const regex =
          cond.operator === 'regex' ? getRegex(resolvedValue) : undefined;
        // Pass fieldValue as the `item` argument with `field: ''` so the
        // sentinel branch in evaluateCondition surfaces it directly without
        // an extra path lookup.
        const stub: Condition = {
          field: '',
          operator: cond.operator,
          value: resolvedValue,
        };
        return evaluateCondition(fieldValue, stub, strictComparison, regex);
      };

      const passed =
        combineMode === 'or'
          ? conditions.some(evalOne)
          : conditions.every(evalOne);

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

  private computeFieldValue(
    field: unknown,
    item: unknown,
    ctx: EngineContext,
  ): unknown {
    if (field === '' || field === '$item') return item;
    if (typeof field === 'string' && EXPRESSION_PATTERN.test(field)) {
      return this.resolveIfExpression(field, ctx);
    }
    if (typeof field === 'string') {
      return getNestedValue(item, field);
    }
    return field;
  }

  private resolveIfExpression(value: unknown, ctx: EngineContext): unknown {
    if (typeof value !== 'string') return value;
    if (!EXPRESSION_PATTERN.test(value)) return value;
    try {
      return evaluate(value, ctx);
    } catch {
      // Per-item evaluation failure → null (mirrors TableHandler precedent);
      // the item naturally falls through to `unmatched` via the comparison
      // operators rather than crashing the whole filter.
      return null;
    }
  }
}
