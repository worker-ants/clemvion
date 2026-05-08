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
  EXPRESSION_PATTERN,
  MAX_REGEX_LENGTH,
  evaluateResolvedCondition,
} from '../_shared/condition-eval.util.js';
import { filterNodeMetadata } from './filter.schema.js';

interface AuthoredCondition {
  // Authored value is always a string (dot-path or `{{ … }}` expression) at
  // config time. Per-item resolution may produce any type, but that resolved
  // value is held only inside the handler — the shared `Condition` type used
  // by other consumers (transform.array_filter) keeps `field: string`.
  field?: string;
  operator: Condition['operator'];
  value: unknown;
}

interface FilterConfig {
  // Either a dot-path string applied to `$input` (e.g. `"items"`) OR the
  // resolved value itself when an inline expression like `{{ $var.a }}` is used.
  inputField: unknown;
  conditions: AuthoredCondition[];
  combineMode: 'and' | 'or';
  strictComparison?: boolean;
}

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
      if (regexCache.has(pattern)) {
        // `null` marks a previously-failed compile so we don't retry it.
        return regexCache.get(pattern) ?? undefined;
      }
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

      const evalOne = (cond: AuthoredCondition): boolean => {
        // Compute fieldValue per spec rules:
        //  - undefined / empty / "$item" sentinel → the item itself
        //    (covers scalar arrays and missing-field shorthand).
        //  - inline expression `{{ … }}` → evaluated value (per-item ctx).
        //  - plain string → dot-path lookup on the item.
        const fieldValue = this.computeFieldValue(cond.field, item, itemCtx);
        const resolvedValue = this.resolveIfExpression(cond.value, itemCtx);
        const regex =
          cond.operator === 'regex' ? getRegex(resolvedValue) : undefined;
        return evaluateResolvedCondition(
          fieldValue,
          cond.operator,
          resolvedValue,
          strictComparison,
          regex,
        );
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

    // CONVENTIONS Principle 7 — config echoes raw inputField / conditions
    // (per-condition `field` and `value` may be `{{ ... }}` templates). The
    // per-item evaluation above uses the resolved values; only the echo
    // changes to raw.
    const rawConfig = (context.rawConfig ?? config) as unknown as FilterConfig;
    return Promise.resolve({
      config: {
        inputField: rawConfig.inputField,
        conditions: rawConfig.conditions,
        combineMode: rawConfig.combineMode ?? 'and',
        strictComparison: rawConfig.strictComparison ?? false,
      },
      output: { match, unmatched },
    });
  }

  private computeFieldValue(
    field: string | undefined,
    item: unknown,
    ctx: EngineContext,
  ): unknown {
    // Item-self sentinel: missing/empty/"$item" all map to the item itself,
    // unblocking scalar array filtering (e.g. `[1, 2, 3]`) where there is
    // no nested path to address.
    if (field === undefined || field === '' || field === '$item') return item;
    if (EXPRESSION_PATTERN.test(field)) {
      return this.resolveIfExpression(field, ctx);
    }
    return getNestedValue(item, field);
  }

  private resolveIfExpression(value: unknown, ctx: EngineContext): unknown {
    if (typeof value !== 'string') return value;
    if (!EXPRESSION_PATTERN.test(value)) return value;
    try {
      return evaluate(value, ctx);
    } catch {
      // Per-item evaluation failure → undefined. Numeric comparators coerce
      // it to NaN (always false) and `is_null` correctly reports "missing",
      // mirroring the way `getNestedValue` returns undefined for absent
      // paths. Returning `null` here would cause `Number(null) === 0` and
      // silently match `gt`/`lt` against zero-anchored thresholds.
      return undefined;
    }
  }
}
