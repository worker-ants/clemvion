import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat.js';
import {
  ExecutionContext,
  NodeHandler,
  NodeHandlerOutput,
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
  ): Promise<NodeHandlerOutput> {
    const operations = config.operations as TransformOperation[];
    let data = structuredClone(input) as Record<string, unknown>;

    // CONVENTIONS Principle 2 — meta는 실행 메트릭. 각 operation이 실제 변형을
    // 일으켰는지(applied) vs silent no-op 처리됐는지(skipped) 추적한다.
    let operationsApplied = 0;
    let operationsSkipped = 0;

    for (const op of operations) {
      const result = this.applyOperation(data, op);
      data = result.data;
      if (result.applied) operationsApplied++;
      else operationsSkipped++;
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
      meta: {
        operationsApplied,
        operationsSkipped,
      },
    });
  }

  private applyOperation(
    data: Record<string, unknown>,
    op: TransformOperation,
  ): { data: Record<string, unknown>; applied: boolean } {
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
        return { data, applied: false };
    }
  }

  private renameField(
    data: Record<string, unknown>,
    op: { from: string; to: string },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.from)) return { data, applied: false };
    const value = getNestedValue(data, op.from);
    setNestedValue(data, op.to, value);
    delNestedValue(data, op.from);
    return { data, applied: true };
  }

  private removeField(
    data: Record<string, unknown>,
    op: { field: string },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.field)) return { data, applied: false };
    delNestedValue(data, op.field);
    return { data, applied: true };
  }

  private setField(
    data: Record<string, unknown>,
    op: { field: string; value: unknown },
  ): { data: Record<string, unknown>; applied: boolean } {
    setNestedValue(data, op.field, op.value);
    // setNestedValue가 prototype pollution 차단으로 무시한 경우에도 applied로
    // 카운트한다 — 사용자가 의도한 변형 시도이고, no-op 분류는 "필드/타입 부재"
    // 케이스에 한정한다 (Principle 2 — 실행 메트릭으로서의 의미 보존).
    return { data, applied: true };
  }

  private typeConvert(
    data: Record<string, unknown>,
    op: { field: string; targetType: string },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.field)) return { data, applied: false };
    const value = getNestedValue(data, op.field);

    switch (op.targetType) {
      case 'string':
        setNestedValue(data, op.field, String(value));
        return { data, applied: true };
      case 'number':
        setNestedValue(data, op.field, Number(value));
        return { data, applied: true };
      case 'boolean':
        setNestedValue(data, op.field, Boolean(value));
        return { data, applied: true };
      case 'array': {
        if (Array.isArray(value)) return { data, applied: false };
        if (typeof value === 'string') {
          try {
            const parsed: unknown = JSON.parse(value);
            if (Array.isArray(parsed)) {
              setNestedValue(data, op.field, parsed);
              return { data, applied: true };
            }
          } catch {
            // keep original
          }
        }
        return { data, applied: false };
      }
      case 'object': {
        if (
          value !== null &&
          typeof value === 'object' &&
          !Array.isArray(value)
        )
          return { data, applied: false };
        if (typeof value === 'string') {
          try {
            const parsed: unknown = JSON.parse(value);
            if (
              parsed !== null &&
              typeof parsed === 'object' &&
              !Array.isArray(parsed)
            ) {
              setNestedValue(data, op.field, parsed);
              return { data, applied: true };
            }
          } catch {
            // keep original
          }
        }
        return { data, applied: false };
      }
    }

    return { data, applied: false };
  }

  private stringOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; args?: unknown },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.field)) return { data, applied: false };

    const raw = getNestedValue(data, op.field);
    let value: unknown = raw;
    let applied = false;

    switch (op.operation) {
      case 'trim':
        value = String(raw).trim();
        applied = true;
        break;
      case 'uppercase':
        value = String(raw).toUpperCase();
        applied = true;
        break;
      case 'lowercase':
        value = String(raw).toLowerCase();
        applied = true;
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
          if (re) {
            value = str.replace(re, args.replacement);
            applied = true;
          }
        } else {
          value = all
            ? str.replaceAll(args.search, args.replacement)
            : str.replace(args.search, args.replacement);
          applied = true;
        }
        break;
      }
      case 'split': {
        const args = op.args as { separator: string } | undefined;
        if (!args || typeof args.separator !== 'string') break;
        value = String(raw).split(args.separator);
        applied = true;
        break;
      }
      case 'join': {
        if (!Array.isArray(raw)) break;
        const args = op.args as { separator: string } | undefined;
        const sep = args?.separator ?? ',';
        value = raw.join(sep);
        applied = true;
        break;
      }
    }

    if (applied) setNestedValue(data, op.field, value);
    return { data, applied };
  }

  private mathOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; operand?: number },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.field)) return { data, applied: false };

    let value = Number(getNestedValue(data, op.field));
    const operand = op.operand ?? 0;
    let applied = false;

    switch (op.operation) {
      case 'add':
        value = value + operand;
        applied = true;
        break;
      case 'subtract':
        value = value - operand;
        applied = true;
        break;
      case 'multiply':
        value = value * operand;
        applied = true;
        break;
      case 'divide':
        if (operand !== 0) {
          value = value / operand;
          applied = true;
        }
        break;
      case 'round':
        value = Math.round(value);
        applied = true;
        break;
      case 'ceil':
        value = Math.ceil(value);
        applied = true;
        break;
      case 'floor':
        value = Math.floor(value);
        applied = true;
        break;
    }

    if (applied) setNestedValue(data, op.field, value);
    return { data, applied };
  }

  private dateOp(
    data: Record<string, unknown>,
    op: { field: string; operation: string; args?: unknown },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!hasNestedValue(data, op.field)) return { data, applied: false };

    const raw = getNestedValue(data, op.field);
    const d = dayjs(raw as string | number | Date);
    if (!d.isValid()) return { data, applied: false };

    switch (op.operation) {
      case 'format': {
        const args = op.args as { pattern?: string } | undefined;
        if (!args?.pattern) return { data, applied: false };
        setNestedValue(data, op.field, d.format(args.pattern));
        return { data, applied: true };
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
          return { data, applied: false };
        const result =
          op.operation === 'add'
            ? d.add(args.amount, args.unit)
            : d.subtract(args.amount, args.unit);
        setNestedValue(data, op.field, result.toISOString());
        return { data, applied: true };
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
          return { data, applied: false };
        const compare = dayjs(
          getNestedValue(data, args.compareField) as string | number | Date,
        );
        if (!compare.isValid()) return { data, applied: false };
        setNestedValue(data, op.field, d.diff(compare, args.unit));
        return { data, applied: true };
      }
    }

    return { data, applied: false };
  }

  private arrayFilter(
    data: Record<string, unknown>,
    op: { field: string; condition: Condition },
  ): { data: Record<string, unknown>; applied: boolean } {
    const arr = getNestedValue(data, op.field);
    if (!Array.isArray(arr)) return { data, applied: false };

    const compiled = compileRegexCache([op.condition]);
    const filtered = arr.filter((item) =>
      evaluateCondition(item, op.condition, false, compiled.get(0)),
    );
    setNestedValue(data, op.field, filtered);
    return { data, applied: true };
  }

  private arraySort(
    data: Record<string, unknown>,
    op: { field: string; sortBy?: string; order: 'asc' | 'desc' },
  ): { data: Record<string, unknown>; applied: boolean } {
    const arr = getNestedValue(data, op.field);
    if (!Array.isArray(arr)) return { data, applied: false };

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
    return { data, applied: true };
  }

  private objectPick(
    data: Record<string, unknown>,
    op: { field?: string; keys: string[] },
  ): { data: Record<string, unknown>; applied: boolean } {
    if (!op.field) {
      const picked: Record<string, unknown> = {};
      for (const key of op.keys) {
        if (key in data) picked[key] = data[key];
      }
      return { data: picked, applied: true };
    }

    const target = getNestedValue(data, op.field);
    if (target === null || typeof target !== 'object' || Array.isArray(target))
      return { data, applied: false };

    const src = target as Record<string, unknown>;
    const picked: Record<string, unknown> = {};
    for (const key of op.keys) {
      if (key in src) picked[key] = src[key];
    }
    setNestedValue(data, op.field, picked);
    return { data, applied: true };
  }

  private objectOmit(
    data: Record<string, unknown>,
    op: { field?: string; keys: string[] },
  ): { data: Record<string, unknown>; applied: boolean } {
    const omitKey = (obj: Record<string, unknown>, k: string) => {
      if (BLOCKED_OBJECT_KEYS.has(k)) return;
      delete obj[k];
    };

    if (!op.field) {
      for (const key of op.keys) omitKey(data, key);
      return { data, applied: true };
    }

    const target = getNestedValue(data, op.field);
    if (target === null || typeof target !== 'object' || Array.isArray(target))
      return { data, applied: false };

    const src = { ...(target as Record<string, unknown>) };
    for (const key of op.keys) omitKey(src, key);
    setNestedValue(data, op.field, src);
    return { data, applied: true };
  }
}
