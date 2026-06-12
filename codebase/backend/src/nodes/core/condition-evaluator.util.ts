import safeRegex from 'safe-regex';
import { getNestedValue } from './nested-value.util.js';

/**
 * Supported comparison operators.
 *
 * Single source of truth: the runtime list and the TypeScript union are
 * derived from the same `as const` array so adding a new operator only
 * requires editing this array (+ the `switch` branch in
 * {@link evaluateResolvedCondition}).
 *
 * Used by: if_else, switch (expression mode), filter, transform.array_filter.
 * `logic/_shared/condition-eval.util.ts` re-exports these symbols to keep
 * Filter / Transform on the legacy positional signature without duplicating
 * operator semantics.
 */
export const CONDITION_OPERATORS = [
  'eq',
  'neq',
  'gt',
  'gte',
  'lt',
  'lte',
  'contains',
  'not_contains',
  'starts_with',
  'ends_with',
  'is_empty',
  'is_not_empty',
  'is_null',
  'regex',
  'is_type',
] as const;

export type ConditionOperator = (typeof CONDITION_OPERATORS)[number];

/**
 * Cap on user-authored regex pattern length to mitigate ReDoS exposure.
 * Mirrored by {@link compileRegexCache} / {@link compileUserRegex}.
 *
 * 200자 기준은 기존 노드(transform/filter/switch/if-else) 규약을 계승한다. 길이 상한
 * 단독으로는 ReDoS 를 막지 못하므로(200자 이내 `(a+)+$` 가능) `safe-regex` 가 1차 방어이고,
 * 길이 상한은 AST 분석 비용·잔여 위험을 줄이는 2차 방어다 (04 M-3).
 */
export const MAX_REGEX_LENGTH = 200;

/**
 * 04 M-3 — 사용자 regex 컴파일 거부 사유.
 * - `too-long`: {@link MAX_REGEX_LENGTH} 초과.
 * - `unsafe`: ReDoS 취약 패턴(`safe-regex` 검출 — 예 `(a+)+$`). 길이가 200 이내여도
 *   지수 백트래킹으로 worker 를 무기한 점유할 수 있어 컴파일/실행을 거부한다.
 * - `invalid`: 문법 오류로 `new RegExp` 가 throw.
 */
export type RegexRejectReason = 'too-long' | 'unsafe' | 'invalid';

/** {@link compileUserRegex} 결과 — 성공 시 `regex`, 거부 시 `reason`. */
export type RegexCompileResult =
  | { regex: RegExp; reason?: undefined }
  | { regex: null; reason: RegexRejectReason };

/**
 * 04 M-3 — 사용자 입력 regex 를 **안전하게** 컴파일한다. 길이 상한만으로는 ReDoS 를
 * 막지 못하므로(200자 이내 `(a+)+$` 가 지수 시간), `safe-regex` 휴리스틱으로 위험
 * 패턴을 컴파일 전에 거부한다. 세 평가 사이트(condition-evaluator/filter/transform)의
 * 단일 chokepoint — 새 regex 사용처는 본 함수를 거쳐야 한다.
 *
 * @param source 사용자 regex 패턴 문자열.
 * @param flags `new RegExp` 플래그(기본 `''`).
 * @returns 성공 시 `{ regex }`, 거부 시 `{ regex: null, reason }`.
 */
export function compileUserRegex(
  source: string,
  flags = '',
): RegexCompileResult {
  if (source.length > MAX_REGEX_LENGTH) {
    return { regex: null, reason: 'too-long' };
  }
  // 문법 검사를 safe-regex 보다 먼저 — 컴파일은 실행이 아니라 비용/위험이 없고,
  // 이래야 문법 오류는 'invalid', 문법은 맞지만 위험한 패턴만 'unsafe' 로 정확히
  // 분류된다(safe-regex 는 파싱 불가 입력에 false 를 주므로 순서가 바뀌면 'invalid'
  // 가 'unsafe' 로 오분류된다).
  let regex: RegExp;
  try {
    regex = new RegExp(source, flags);
  } catch {
    return { regex: null, reason: 'invalid' };
  }
  // safe-regex 는 안전하면 true 반환 — 위험(지수 백트래킹 가능) 패턴은 거부한다.
  // 휴리스틱(주로 star height)이라 alternation-overlap(`(a|a)*`) 같은 일부 ReDoS 는
  // 통과할 수 있음(티켓 M-3 옵션 B 의 알려진 한계 — 길이 상한이 2차 방어).
  // safe-regex 내부(regexp-tree) 가 던질 경우 보수적으로 unsafe 처리(fail-closed).
  let safe: boolean;
  try {
    safe = safeRegex(source);
  } catch {
    return { regex: null, reason: 'unsafe' };
  }
  if (!safe) {
    return { regex: null, reason: 'unsafe' };
  }
  return { regex };
}

/**
 * Detector for inline `{{ ... }}` expressions in authored strings. Filter
 * relies on this to decide whether a value is a dot-path or an expression
 * to resolve per-item.
 */
export const EXPRESSION_PATTERN = /\{\{/;

const VALID_TYPES = new Set([
  'string',
  'number',
  'boolean',
  'object',
  'array',
  'null',
  'undefined',
]);

/**
 * A single condition evaluated by {@link evaluateCondition}.
 *
 * Matches the `ConditionGroup` schema defined in
 * `nodes/logic/if-else/if-else.schema.ts` — reused by Switch (expression
 * mode), Filter, and Transform's array_filter.
 */
export interface Condition {
  /** Dot-path on `input` to look up the left-hand-side value. */
  field: string;
  operator: ConditionOperator;
  /** Right-hand-side value. Optional for unary operators (is_empty, is_null, ...). */
  value?: unknown;
}

export interface EvaluateOptions {
  /**
   * Use strict equality (`===` / `!==`) for `eq` / `neq` instead of loose
   * (`==` / `!=`). Per spec §3.2.1, default is loose (`false`).
   */
  strict?: boolean;
  /**
   * Pre-compiled regex for the `regex` operator. Filter passes a per-item
   * cached compile; If/Else compiles its conditions once via
   * {@link compileRegexCache} and passes the position-matched RegExp here.
   * When undefined (no pattern / invalid / unset by a caller), `regex`
   * returns `false`.
   */
  regex?: RegExp;
}

const DEFAULT_OPTIONS: EvaluateOptions = Object.freeze({});

/**
 * Evaluate a single operator against an already-resolved fieldValue.
 *
 * Filter calls this directly after its per-item expression resolution; the
 * path-driven helper {@link evaluateCondition} wraps it for callers that
 * still treat `condition.field` as a dot-path on `input`.
 */
export function evaluateResolvedCondition(
  fieldValue: unknown,
  operator: ConditionOperator,
  compareValue: unknown,
  strict: boolean,
  compiledRegex?: RegExp,
): boolean {
  switch (operator) {
    case 'eq':
      return strict ? fieldValue === compareValue : fieldValue == compareValue;
    case 'neq':
      return strict ? fieldValue !== compareValue : fieldValue != compareValue;
    case 'gt':
      return Number(fieldValue) > Number(compareValue);
    case 'gte':
      return Number(fieldValue) >= Number(compareValue);
    case 'lt':
      return Number(fieldValue) < Number(compareValue);
    case 'lte':
      return Number(fieldValue) <= Number(compareValue);
    case 'contains':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? fieldValue.includes(compareValue)
        : false;
    case 'not_contains':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? !fieldValue.includes(compareValue)
        : true;
    case 'starts_with':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? fieldValue.startsWith(compareValue)
        : false;
    case 'ends_with':
      return typeof fieldValue === 'string' && typeof compareValue === 'string'
        ? fieldValue.endsWith(compareValue)
        : false;
    case 'is_empty':
      return (
        fieldValue === '' ||
        fieldValue === null ||
        fieldValue === undefined ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'is_not_empty':
      return (
        fieldValue !== '' &&
        fieldValue !== null &&
        fieldValue !== undefined &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case 'is_null':
      return fieldValue === null || fieldValue === undefined;
    case 'regex':
      if (!compiledRegex) return false;
      return compiledRegex.test(
        typeof fieldValue === 'string' ? fieldValue : String(fieldValue),
      );
    case 'is_type': {
      if (typeof compareValue !== 'string' || !VALID_TYPES.has(compareValue))
        return false;
      if (compareValue === 'array') return Array.isArray(fieldValue);
      if (compareValue === 'null')
        return fieldValue === null || fieldValue === undefined;
      return typeof fieldValue === compareValue;
    }
    default:
      return false;
  }
}

/**
 * Evaluate a single {@link Condition} against `input` and return whether it
 * is satisfied.
 *
 * Looks up `condition.field` on `input` via {@link getNestedValue} (which
 * blocks `__proto__` / `constructor` / `prototype` paths) and applies the
 * configured operator via {@link evaluateResolvedCondition}.
 */
export function evaluateCondition(
  input: unknown,
  condition: Condition,
  options: EvaluateOptions = DEFAULT_OPTIONS,
): boolean {
  const fieldValue = getNestedValue(input, condition.field);
  return evaluateResolvedCondition(
    fieldValue,
    condition.operator,
    condition.value,
    options.strict === true,
    options.regex,
  );
}

/**
 * Compile per-condition regex patterns into a position-indexed cache.
 *
 * Filter / Transform use this to avoid re-compiling the same pattern per
 * array item. Invalid, oversized, **and ReDoS-unsafe** (04 M-3) patterns are
 * silently skipped — callers may detect them by the missing cache entry
 * (Filter surfaces them via `meta.invalidRegexPatterns`). Skipping a
 * dangerous pattern means its condition evaluates to no-match, which is the
 * same observable behaviour as a syntactically invalid pattern.
 */
export function compileRegexCache(
  conditions: Condition[],
): Map<number, RegExp> {
  const cache = new Map<number, RegExp>();
  for (let i = 0; i < conditions.length; i++) {
    const cond = conditions[i];
    if (cond.operator === 'regex' && typeof cond.value === 'string') {
      // 04 M-3 — 길이/ReDoS-안전성/문법을 단일 chokepoint 에서 검사. 거부 시 skip.
      const { regex } = compileUserRegex(cond.value);
      if (regex) cache.set(i, regex);
    }
  }
  return cache;
}
