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

export const TRANSFORM_OPERATION_TYPES: Array<{
  value: TransformOperationType;
  label: string;
  caption: string;
}> = [
  {
    value: "rename_field",
    label: "Rename Field",
    caption: "필드 이름을 다른 이름으로 변경합니다.",
  },
  {
    value: "remove_field",
    label: "Remove Field",
    caption: "지정한 필드를 제거합니다.",
  },
  {
    value: "set_field",
    label: "Set Field",
    caption: "필드 값을 설정하거나 새로 생성합니다.",
  },
  {
    value: "type_convert",
    label: "Type Convert",
    caption: "필드 값의 타입을 변환합니다.",
  },
  {
    value: "string_op",
    label: "String Operation",
    caption: "문자열을 가공합니다.",
  },
  {
    value: "math_op",
    label: "Math Operation",
    caption: "숫자 연산을 수행합니다.",
  },
  {
    value: "date_op",
    label: "Date Operation",
    caption: "날짜를 포맷·가감하거나 차이를 계산합니다.",
  },
  {
    value: "array_filter",
    label: "Array Filter",
    caption: "조건을 만족하는 요소만 남깁니다.",
  },
  {
    value: "array_sort",
    label: "Array Sort",
    caption: "배열을 정렬합니다.",
  },
  {
    value: "object_pick",
    label: "Object Pick",
    caption: "지정한 키만 남기고 나머지는 제거합니다.",
  },
  {
    value: "object_omit",
    label: "Object Omit",
    caption: "지정한 키만 제거합니다.",
  },
];

export const CONDITION_OPERATORS: Array<{
  value: ConditionOperator;
  label: string;
}> = [
  { value: "eq", label: "Equals (==)" },
  { value: "neq", label: "Not Equals (!=)" },
  { value: "gt", label: "Greater Than (>)" },
  { value: "gte", label: "Greater or Equal (>=)" },
  { value: "lt", label: "Less Than (<)" },
  { value: "lte", label: "Less or Equal (<=)" },
  { value: "contains", label: "Contains" },
  { value: "not_contains", label: "Not Contains" },
  { value: "starts_with", label: "Starts With" },
  { value: "ends_with", label: "Ends With" },
  { value: "is_empty", label: "Is Empty" },
  { value: "is_not_empty", label: "Is Not Empty" },
  { value: "regex", label: "Regex Match" },
  { value: "is_null", label: "Is Null" },
  { value: "is_type", label: "Is Type" },
];

export const DATE_UNITS: DateUnit[] = [
  "years",
  "months",
  "days",
  "hours",
  "minutes",
  "seconds",
];
