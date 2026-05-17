export type ConditionOperator =
  | "eq"
  | "neq"
  | "gt"
  | "gte"
  | "lt"
  | "lte"
  | "contains"
  | "not_contains"
  | "starts_with"
  | "ends_with"
  | "is_empty"
  | "is_not_empty"
  | "regex"
  | "is_null"
  | "is_type";

export interface ArrayFilterCondition {
  field: string;
  operator: ConditionOperator;
  value: unknown;
}

export type DateUnit =
  | "years"
  | "months"
  | "days"
  | "hours"
  | "minutes"
  | "seconds";

export type StringOpKind =
  | "trim"
  | "uppercase"
  | "lowercase"
  | "replace"
  | "split"
  | "join";

export type MathOpKind =
  | "add"
  | "subtract"
  | "multiply"
  | "divide"
  | "round"
  | "ceil"
  | "floor";

export type DateOpKind = "format" | "add" | "subtract" | "diff";

export type ConvertType =
  | "string"
  | "number"
  | "boolean"
  | "array"
  | "object";

export type TransformOperation =
  | { type: "rename_field"; from: string; to: string }
  | { type: "remove_field"; field: string }
  | { type: "set_field"; field: string; value: unknown }
  | { type: "type_convert"; field: string; targetType: ConvertType }
  | {
      type: "string_op";
      field: string;
      operation: StringOpKind;
      args?: unknown;
    }
  | {
      type: "math_op";
      field: string;
      operation: MathOpKind;
      operand?: number;
    }
  | {
      type: "date_op";
      field: string;
      operation: DateOpKind;
      args?: unknown;
    }
  | { type: "array_filter"; field: string; condition: ArrayFilterCondition }
  | {
      type: "array_sort";
      field: string;
      sortBy?: string;
      order: "asc" | "desc";
    }
  | { type: "object_pick"; field?: string; keys: string[] }
  | { type: "object_omit"; field?: string; keys: string[] };

export type TransformOperationType = TransformOperation["type"];

// Pure value lists — display labels/captions are resolved via i18n at the
// consumer (see `nodeConfigs.transform.operationType` /
// `nodeConfigs.transform.conditionOperator` keys in `lib/i18n/dict/*.ts`).
export const TRANSFORM_OPERATION_TYPES: readonly TransformOperationType[] = [
  "rename_field",
  "remove_field",
  "set_field",
  "type_convert",
  "string_op",
  "math_op",
  "date_op",
  "array_filter",
  "array_sort",
  "object_pick",
  "object_omit",
];

export const CONDITION_OPERATORS: readonly ConditionOperator[] = [
  "eq",
  "neq",
  "gt",
  "gte",
  "lt",
  "lte",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "is_empty",
  "is_not_empty",
  "regex",
  "is_null",
  "is_type",
];

export const DATE_UNITS: DateUnit[] = [
  "years",
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
];
