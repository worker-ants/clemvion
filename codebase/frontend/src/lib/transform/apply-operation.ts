import dayjs from "dayjs";
import type {
  ArrayFilterCondition,
  ConditionOperator,
  DateUnit,
  TransformOperation,
} from "@/types/transform";
import { DATE_UNITS } from "@/types/transform";

// Prototype pollution 방지: 이 키들로의 get/set/delete를 전부 차단한다.
const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);

// ReDoS 방지: 사용자 입력을 정규식으로 컴파일할 때 길이 상한을 둔다.
const MAX_REGEX_LENGTH = 200;

function safeCompileRegex(pattern: string, flags = ""): RegExp | null {
  if (pattern.length > MAX_REGEX_LENGTH) return null;
  try {
    return new RegExp(pattern, flags);
  } catch {
    return null;
  }
}

function parsePath(path: string): string[] {
  const normalized = path.replace(/\[(\w+)\]/g, ".$1");
  return normalized.split(".").filter((k) => k.length > 0);
}

function getNested(obj: unknown, path: string): unknown {
  if (obj === null || obj === undefined) return undefined;
  const keys = parsePath(path);
  let current: unknown = obj;
  for (const key of keys) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    if (BLOCKED_KEYS.has(key)) return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

function hasNested(obj: unknown, path: string): boolean {
  if (obj === null || obj === undefined) return false;
  const keys = parsePath(path);
  if (keys.length === 0) return false;
  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) return false;
    if (current === null || current === undefined) return false;
    if (typeof current !== "object") return false;
    current = (current as Record<string, unknown>)[key];
  }
  const last = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(last)) return false;
  if (current === null || current === undefined) return false;
  if (typeof current !== "object") return false;
  if (Array.isArray(current)) {
    const idx = Number(last);
    return Number.isInteger(idx) && idx >= 0 && idx < current.length;
  }
  return last in (current as Record<string, unknown>);
}

function setNested(
  obj: Record<string, unknown>,
  path: string,
  value: unknown,
): void {
  const keys = parsePath(path);
  if (keys.length === 0) return;
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) return;
    if (
      current[key] === undefined ||
      current[key] === null ||
      typeof current[key] !== "object"
    ) {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  const last = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(last)) return;
  current[last] = value;
}

function delNested(obj: unknown, path: string): void {
  if (obj === null || obj === undefined || typeof obj !== "object") return;
  const keys = parsePath(path);
  if (keys.length === 0) return;
  let current: unknown = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (BLOCKED_KEYS.has(key)) return;
    if (current === null || current === undefined) return;
    if (typeof current !== "object") return;
    current = (current as Record<string, unknown>)[key];
  }
  if (current === null || current === undefined) return;
  if (typeof current !== "object") return;
  const last = keys[keys.length - 1];
  if (BLOCKED_KEYS.has(last)) return;
  if (Array.isArray(current)) {
    const idx = Number(last);
    if (Number.isInteger(idx) && idx >= 0 && idx < current.length) {
      current.splice(idx, 1);
    }
    return;
  }
  delete (current as Record<string, unknown>)[last];
}

function evaluateCondition(
  item: unknown,
  condition: ArrayFilterCondition,
): boolean {
  const fieldValue = getNested(item, condition.field);
  const compareValue = condition.value;
  const op: ConditionOperator = condition.operator;
  switch (op) {
    case "eq":
      return fieldValue == compareValue;
    case "neq":
      return fieldValue != compareValue;
    case "gt":
      return Number(fieldValue) > Number(compareValue);
    case "gte":
      return Number(fieldValue) >= Number(compareValue);
    case "lt":
      return Number(fieldValue) < Number(compareValue);
    case "lte":
      return Number(fieldValue) <= Number(compareValue);
    case "contains":
      return typeof fieldValue === "string" &&
        typeof compareValue === "string"
        ? fieldValue.includes(compareValue)
        : false;
    case "not_contains":
      return typeof fieldValue === "string" &&
        typeof compareValue === "string"
        ? !fieldValue.includes(compareValue)
        : false;
    case "starts_with":
      return typeof fieldValue === "string" &&
        typeof compareValue === "string"
        ? fieldValue.startsWith(compareValue)
        : false;
    case "ends_with":
      return typeof fieldValue === "string" &&
        typeof compareValue === "string"
        ? fieldValue.endsWith(compareValue)
        : false;
    case "is_empty":
      return (
        fieldValue === "" ||
        fieldValue === null ||
        fieldValue === undefined ||
        (Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case "is_not_empty":
      return (
        fieldValue !== "" &&
        fieldValue !== null &&
        fieldValue !== undefined &&
        !(Array.isArray(fieldValue) && fieldValue.length === 0)
      );
    case "regex": {
      if (typeof compareValue !== "string") return false;
      const re = safeCompileRegex(compareValue);
      if (!re) return false;
      return re.test(
        typeof fieldValue === "string"
          ? fieldValue
          : String(fieldValue as string | number | boolean),
      );
    }
    case "is_null":
      return fieldValue === null || fieldValue === undefined;
    case "is_type": {
      if (typeof compareValue !== "string") return false;
      if (compareValue === "array") return Array.isArray(fieldValue);
      if (compareValue === "null")
        return fieldValue === null || fieldValue === undefined;
      return typeof fieldValue === compareValue;
    }
    default:
      return false;
  }
}

export function applyOperation(
  input: Record<string, unknown>,
  op: TransformOperation,
): Record<string, unknown> {
  const data = structuredClone(input);
  switch (op.type) {
    case "rename_field": {
      if (hasNested(data, op.from)) {
        const v = getNested(data, op.from);
        setNested(data, op.to, v);
        delNested(data, op.from);
      }
      return data;
    }
    case "remove_field":
      delNested(data, op.field);
      return data;
    case "set_field":
      setNested(data, op.field, op.value);
      return data;
    case "type_convert": {
      if (!hasNested(data, op.field)) return data;
      const value = getNested(data, op.field);
      switch (op.targetType) {
        case "string":
          setNested(data, op.field, String(value));
          break;
        case "number":
          setNested(data, op.field, Number(value));
          break;
        case "boolean":
          setNested(data, op.field, Boolean(value));
          break;
        case "array":
          if (Array.isArray(value)) return data;
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (Array.isArray(parsed)) setNested(data, op.field, parsed);
            } catch {
              // keep original
            }
          }
          break;
        case "object":
          if (
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value)
          )
            return data;
          if (typeof value === "string") {
            try {
              const parsed = JSON.parse(value);
              if (
                parsed !== null &&
                typeof parsed === "object" &&
                !Array.isArray(parsed)
              )
                setNested(data, op.field, parsed);
            } catch {
              // keep original
            }
          }
          break;
      }
      return data;
    }
    case "string_op": {
      if (!hasNested(data, op.field)) return data;
      const raw = getNested(data, op.field);
      const args = (op.args ?? {}) as Record<string, unknown>;
      let value: unknown = raw;
      switch (op.operation) {
        case "trim":
          value = String(raw).trim();
          break;
        case "uppercase":
          value = String(raw).toUpperCase();
          break;
        case "lowercase":
          value = String(raw).toLowerCase();
          break;
        case "replace": {
          const search = args.search as string;
          const replacement = args.replacement as string;
          if (typeof search !== "string" || typeof replacement !== "string")
            break;
          const str = String(raw);
          const all = args.all !== false;
          if (args.regex) {
            const re = safeCompileRegex(search, all ? "g" : "");
            if (re) value = str.replace(re, replacement);
          } else {
            value = all
              ? str.replaceAll(search, replacement)
              : str.replace(search, replacement);
          }
          break;
        }
        case "split": {
          const sep = args.separator as string;
          if (typeof sep !== "string") break;
          value = String(raw).split(sep);
          break;
        }
        case "join": {
          if (!Array.isArray(raw)) break;
          value = raw.join((args.separator as string) ?? ",");
          break;
        }
      }
      setNested(data, op.field, value);
      return data;
    }
    case "math_op": {
      if (!hasNested(data, op.field)) return data;
      let value = Number(getNested(data, op.field));
      const operand = op.operand ?? 0;
      switch (op.operation) {
        case "add":
          value += operand;
          break;
        case "subtract":
          value -= operand;
          break;
        case "multiply":
          value *= operand;
          break;
        case "divide":
          if (operand !== 0) value /= operand;
          break;
        case "round":
          value = Math.round(value);
          break;
        case "ceil":
          value = Math.ceil(value);
          break;
        case "floor":
          value = Math.floor(value);
          break;
      }
      setNested(data, op.field, value);
      return data;
    }
    case "date_op": {
      if (!hasNested(data, op.field)) return data;
      const raw = getNested(data, op.field);
      const d = dayjs(raw as string | number | Date);
      if (!d.isValid()) return data;
      const args = (op.args ?? {}) as Record<string, unknown>;
      switch (op.operation) {
        case "format": {
          const pattern = args.pattern as string;
          if (!pattern) return data;
          setNested(data, op.field, d.format(pattern));
          break;
        }
        case "add":
        case "subtract": {
          const amount = args.amount as number;
          const unit = args.unit as DateUnit;
          if (
            typeof amount !== "number" ||
            !unit ||
            !DATE_UNITS.includes(unit)
          )
            return data;
          const result =
            op.operation === "add"
              ? d.add(amount, unit)
              : d.subtract(amount, unit);
          setNested(data, op.field, result.toISOString());
          break;
        }
        case "diff": {
          const compareField = args.compareField as string;
          const unit = args.unit as DateUnit;
          if (!compareField || !unit || !DATE_UNITS.includes(unit)) return data;
          const other = dayjs(
            getNested(data, compareField) as string | number | Date,
          );
          if (!other.isValid()) return data;
          setNested(data, op.field, d.diff(other, unit));
          break;
        }
      }
      return data;
    }
    case "array_filter": {
      const arr = getNested(data, op.field);
      if (!Array.isArray(arr)) return data;
      setNested(
        data,
        op.field,
        arr.filter((item) => evaluateCondition(item, op.condition)),
      );
      return data;
    }
    case "array_sort": {
      const arr = getNested(data, op.field);
      if (!Array.isArray(arr)) return data;
      const sortBy = op.sortBy;
      const sorted = [...arr].sort((a, b) => {
        const av = sortBy ? getNested(a, sortBy) : a;
        const bv = sortBy ? getNested(b, sortBy) : b;
        if (typeof av === "number" && typeof bv === "number") return av - bv;
        const as = av === null || av === undefined ? "" : String(av);
        const bs = bv === null || bv === undefined ? "" : String(bv);
        return as.localeCompare(bs);
      });
      if (op.order === "desc") sorted.reverse();
      setNested(data, op.field, sorted);
      return data;
    }
    case "object_pick": {
      if (!op.field) {
        const picked: Record<string, unknown> = {};
        for (const key of op.keys) if (key in data) picked[key] = data[key];
        return picked;
      }
      const target = getNested(data, op.field);
      if (
        target === null ||
        typeof target !== "object" ||
        Array.isArray(target)
      )
        return data;
      const src = target as Record<string, unknown>;
      const picked: Record<string, unknown> = {};
      for (const key of op.keys) if (key in src) picked[key] = src[key];
      setNested(data, op.field, picked);
      return data;
    }
    case "object_omit": {
      const omitKey = (obj: Record<string, unknown>, k: string) => {
        if (BLOCKED_KEYS.has(k)) return;
        delete obj[k];
      };
      if (!op.field) {
        for (const key of op.keys) omitKey(data, key);
        return data;
      }
      const target = getNested(data, op.field);
      if (
        target === null ||
        typeof target !== "object" ||
        Array.isArray(target)
      )
        return data;
      const src = { ...(target as Record<string, unknown>) };
      for (const key of op.keys) omitKey(src, key);
      setNested(data, op.field, src);
      return data;
    }
  }
}

export function applyOperations(
  input: Record<string, unknown>,
  ops: TransformOperation[],
): Array<{ op: TransformOperation; result: Record<string, unknown> }> {
  const steps: Array<{
    op: TransformOperation;
    result: Record<string, unknown>;
  }> = [];
  let current = structuredClone(input);
  for (const op of ops) {
    current = applyOperation(current, op);
    steps.push({ op, result: current });
  }
  return steps;
}
