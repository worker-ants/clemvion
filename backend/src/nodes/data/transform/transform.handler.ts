import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  ExecutionContext,
  NodeHandler,
  ValidationResult,
} from '../../core/node-handler.interface.js';
import { evaluateMetadataBlockingErrors } from '../../core/metadata-validation.js';
import {
  delNestedValue,
  getNestedValue,
  hasNestedValue,
  setNestedValue,
} from '../../core/nested-value.util.js';
import {
  Condition,
  compileRegexCache,
  evaluateCondition,
} from '../../logic/_shared/condition-eval.util.js';
import { transformNodeMetadata } from './transform.schema.js';

function stringifyForSort(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return JSON.stringify(value);
}

dayjs.extend(customParseFormat);

// ReDoS 방지: 사용자 입력을 정규식으로 컴파일할 때 길이 상한을 둔다.
const MAX_REGEX_LENGTH = 200;

function safeCompileRegex(pattern: string, flags = ''): RegExp | null {
  if (pattern.length > MAX_REGEX_LENGTH) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

// Prototype pollution 방지: object_omit 루트에서도 차단 키는 제외한다.
const BLOCKED_OBJECT_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

type DateUnit = 'years' | 'months' | 'days' | 'hours' | 'minutes' | 'seconds';

type TransformOperation =
  | { type: 'rename_field'; from: string; to: string }
  | { type: 'remove_field'; field: string }
  | { type: 'set_field'; field: string; value: unknown }
  | {
      type: 'type_convert';
      field: string;
      targetType: 'string' | 'number' | 'boolean' | 'array' | 'object';
    }
  | {
      type: 'string_op';
      field: string;
      operation:
        | 'trim'
        | 'uppercase'
        | 'lowercase'
        | 'replace'
        | 'split'
        | 'join';
      args?: unknown;
    }
  | {
      type: 'math_op';
      field: string;
      operation:
        | 'add'
        | 'subtract'
        | 'multiply'
        | 'divide'
        | 'round'
        | 'ceil'
        | 'floor';
      operand?: number;
    }
  | {
      type: 'date_op';
      field: string;
      operation: 'format' | 'add' | 'subtract' | 'diff';
      args?: unknown;
    }
  | { type: 'array_filter'; field: string; condition: Condition }
  | {
      type: 'array_sort';
      field: string;
      sortBy?: string;
      order: 'asc' | 'desc';
    }
  | { type: 'object_pick'; field?: string; keys: string[] }
  | { type: 'object_omit'; field?: string; keys: string[] };

// VALID_TYPES / STRING_OPS / MATH_OPS / DATE_OPS / CONVERT_TYPES were
// removed alongside the inline validate() body — those whitelists are now
// owned by transform.schema.ts (validateConfig). DATE_UNITS stays because
// the executor's `dateOp` branch still uses it at runtime.
const DATE_UNITS: DateUnit[] = [
  'years',
  'months',
  'days',
  'hours',
  'minutes',
  'seconds',
];

export class TransformHandler implements NodeHandler {
  metadata = transformNodeMetadata;

  validate(config: Record<string, unknown>): ValidationResult {
    // Schema SSOT (warningRules + validateConfig) covers operations-empty +
    // per-op type/operation/field/keys checks. Handler retains an explicit
    // "operations not an array" guard because the schema's `length(operations)`
    // returns 0 for non-arrays as well, but that warningRule's Korean
    // message is the same as for empty — both surface "no operations" to the
    // user, which is fine.
    const errors = [...evaluateMetadataBlockingErrors(this.metadata, config)];
    if (config.operations !== undefined && !Array.isArray(config.operations)) {
      errors.push('operations is required and must be an array');
    }
    return { valid: errors.length === 0, errors };
  }

  execute(
    input: unknown,
    config: Record<string, unknown>,
    context: ExecutionContext,
  ): Promise<unknown> {
    const operations = config.operations as TransformOperation[];
    let data = structuredClone(input) as Record<string, unknown>;

    for (const op of operations) {
      data = this.applyOperation(data, op);
    }

    // CONVENTIONS Principle 7 — config echoes raw operations (per-op `field`
    // / `value` / `args` may carry `{{ ... }}` templates). The runtime
    // mutations above used the evaluated `operations` from the resolved
    // `config`.
    const rawConfig = (context.rawConfig ?? config) as {
      operations?: TransformOperation[];
    };
    return Promise.resolve({
      config: { operations: rawConfig.operations ?? operations },
      output: data,
    });
  }

  private applyOperation(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): Record<string, unknown> {
    switch (op.type) {
      case 'rename_field':
        return this.renameField(data, op);
      case 'remove_field':
        return this.removeField(data, op);
      case 'set_field':
        return this.setField(data, op);
      case 'type_convert':
        return this.typeConvert(data, op);
      case 'string_op':
        return this.stringOp(data, op);
      case 'math_op':
        return this.mathOp(data, op);
      case 'date_op':
        return this.dateOp(data, op);
      case 'array_filter':
        return this.arrayFilter(data, op);
      case 'array_sort':
        return this.arraySort(data, op);
      case 'object_pick':
        return this.objectPick(data, op);
      case 'object_omit':
        return this.objectOmit(data, op);
      default:
        return data;
    }
  }

  private renameField(
    data: Record<string, unknown>,
    op: { from: string; to: string },
  ): Record<string, unknown> {
    if (!hasNestedValue(data, op.from)) return data;
    const value = getNestedValue(data, op.from);
    setNestedValue(data, op.to, value);
    delNestedValue(data, op.from);
    return data;
  }

  private removeField(
    data: Record<string, unknown>,
    op: { field: string },
  ): Record<string, unknown> {
    delNestedValue(data, op.field);
    return data;
  }

  private setField(
    data: Record<string, unknown>,
    op: { field: string; value: unknown },
  ): Record<string, unknown> {
    setNestedValue(data, op.field, op.value);
    return data;
  }

  private typeConvert(
    data: Record<string, unknown>,
    op: { field: string; targetType: string },
  ): Record<string, unknown> {
    if (!hasNestedValue(data, op.field)) return data;
    const value = getNestedValue(data, op.field);

    switch (op.targetType) {
      case 'string':
        setNestedValue(data, op.field, String(value));
        break;
      case 'number':
        setNestedValue(data, op.field, Number(value));
        break;
      case 'boolean':
        setNestedValue(data, op.field, Boolean(value));
        break;
      case 'array': {
        if (Array.isArray(value)) return data;
        if (typeof value === 'string') {
          try {
            const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed)) setNestedValue(data, op.field, parsed);
          } catch {
            // keep original
          }
        }
        break;
      }
      case 'object': {
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        )
          return data;
        if (typeof value === 'string') {
          try {
            const parsed: unknown = JSON.parse(value);
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            )
              setNestedValue(data, op.field, parsed);
          } catch {
            // keep original
          }
        }
        break;
      }
    }

    return data;
  }

  private stringOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; args?: unknown },
  ): Record<string, unknown> {
    if (!hasNestedValue(data, op.field)) return data;

    const raw = getNestedValue(data, op.field);
    let value: unknown = raw;

    switch (op.operation) {
      case 'trim':
        value = String(raw).trim();
        break;
      case 'uppercase':
        value = String(raw).toUpperCase();
        break;
      case 'lowercase':
        value = String(raw).toLowerCase();
        break;
      case 'replace': {
        const args = op.args as
          | {
              search: string;
              replacement: string;
              all?: boolean;
              regex?: boolean;
            }
          | undefined;
        if (!args) break;
        const str = String(raw);
        const all = args.all !== false;
        if (args.regex) {
          const re = safeCompileRegex(args.search, all ? 'g' : '');
          if (re) value = str.replace(re, args.replacement);
        } else {
          value = all
            ? str.replaceAll(args.search, args.replacement)
            : str.replace(args.search, args.replacement);
        }
        break;
      }
      case 'split': {
        const args = op.args as { separator: string } | undefined;
        if (!args || typeof args.separator !== 'string') break;
        value = String(raw).split(args.separator);
        break;
      }
      case 'join': {
        if (!Array.isArray(raw)) break;
        const args = op.args as { separator: string } | undefined;
        const sep = args?.separator ?? ',';
        value = raw.join(sep);
        break;
      }
    }

    setNestedValue(data, op.field, value);
    return data;
  }

  private mathOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; operand?: number },
  ): Record<string, unknown> {
    if (!hasNestedValue(data, op.field)) return data;

    let value = Number(getNestedValue(data, op.field));
    const operand = op.operand ?? 0;

    switch (op.operation) {
      case 'add':
        value = value + operand;
        break;
      case 'subtract':
        value = value - operand;
        break;
      case 'multiply':
        value = value * operand;
        break;
      case 'divide':
        if (operand !== 0) value = value / operand;
        break;
      case 'round':
        value = Math.round(value);
        break;
      case 'ceil':
        value = Math.ceil(value);
        break;
      case 'floor':
        value = Math.floor(value);
        break;
    }

    setNestedValue(data, op.field, value);
    return data;
  }

  private dateOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; args?: unknown },
  ): Record<string, unknown> {
    if (!hasNestedValue(data, op.field)) return data;

    const raw = getNestedValue(data, op.field);
    const d = dayjs(raw as string | number | Date);
    if (!d.isValid()) return data;

    switch (op.operation) {
      case 'format': {
        const args = op.args as { pattern?: string } | undefined;
        if (!args?.pattern) return data;
        setNestedValue(data, op.field, d.format(args.pattern));
        break;
      }
      case 'add':
      case 'subtract': {
        const args = op.args as
          | { amount?: number; unit?: DateUnit }
          | undefined;
        if (
          !args ||
          typeof args.amount !== 'number' ||
          !args.unit ||
          !DATE_UNITS.includes(args.unit)
        )
          return data;
        const result =
          op.operation === 'add'
            ? d.add(args.amount, args.unit)
            : d.subtract(args.amount, args.unit);
        setNestedValue(data, op.field, result.toISOString());
        break;
      }
      case 'diff': {
        const args = op.args as
          | { compareField?: string; unit?: DateUnit }
          | undefined;
        if (
          !args?.compareField ||
          !args.unit ||
          !DATE_UNITS.includes(args.unit)
        )
          return data;
        const compare = dayjs(
          getNestedValue(data, args.compareField) as string | number | Date,
        );
        if (!compare.isValid()) return data;
        setNestedValue(data, op.field, d.diff(compare, args.unit));
        break;
      }
    }

    return data;
  }

  private arrayFilter(
    data: Record<string, unknown>,
    op: { field: string; condition: Condition },
  ): Record<string, unknown> {
    const arr = getNestedValue(data, op.field);
    if (!Array.isArray(arr)) return data;

    const compiled = compileRegexCache([op.condition]);
    const filtered = arr.filter((item) =>
      evaluateCondition(item, op.condition, false, compiled.get(0)),
    );
    setNestedValue(data, op.field, filtered);
    return data;
  }

  private arraySort(
    data: Record<string, unknown>,
    op: { field: string; sortBy?: string; order: 'asc' | 'desc' },
  ): Record<string, unknown> {
    const arr = getNestedValue(data, op.field);
    if (!Array.isArray(arr)) return data;

    const sorted = [...(arr as unknown[])].sort((a, b) => {
      const av: unknown = op.sortBy ? getNestedValue(a, op.sortBy) : a;
      const bv: unknown = op.sortBy ? getNestedValue(b, op.sortBy) : b;

      if (typeof av === 'number' && typeof bv === 'number') {
        return av - bv;
      }
      const as = stringifyForSort(av);
      const bs = stringifyForSort(bv);
      return as.localeCompare(bs);
    });

    if (op.order === 'desc') sorted.reverse();
    setNestedValue(data, op.field, sorted);
    return data;
  }

  private objectPick(
    data: Record<string, unknown>,
    op: { field?: string; keys: string[] },
  ): Record<string, unknown> {
    if (!op.field) {
      const picked: Record<string, unknown> = {};
      for (const key of op.keys) {
        if (key in data) picked[key] = data[key];
      }
      return picked;
    }

    const target = getNestedValue(data, op.field);
    if (target === null || typeof target !== 'object' || Array.isArray(target))
      return data;

    const src = target as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of op.keys) {
      if (key in src) picked[key] = src[key];
    }
    setNestedValue(data, op.field, picked);
    return data;
  }

  private objectOmit(
    data: Record<string, unknown>,
    op: { field?: string; keys: string[] },
  ): Record<string, unknown> {
    const omitKey = (obj: Record<string, unknown>, k: string) => {
      if (BLOCKED_OBJECT_KEYS.has(k)) return;
      delete obj[k];
    };

    if (!op.field) {
      for (const key of op.keys) omitKey(data, key);
      return data;
    }

    const target = getNestedValue(data, op.field);
    if (target === null || typeof target !== 'object' || Array.isArray(target))
      return data;

    const src = { ...(target as Record<string, unknown>) };
    for (const key of op.keys) omitKey(src, key);
    setNestedValue(data, op.field, src);
    return data;
  }
}
