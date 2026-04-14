import type {
  TransformOperation,
  TransformOperationType,
} from "@/types/transform";

export function defaultForType(
  type: TransformOperationType,
  preserve?: Partial<TransformOperation>,
): TransformOperation {
  const preservedField =
    preserve && "field" in preserve && typeof preserve.field === "string"
      ? preserve.field
      : "";

  switch (type) {
    case "rename_field":
      return { type, from: preservedField, to: "" };
    case "remove_field":
      return { type, field: preservedField };
    case "set_field":
      return { type, field: preservedField, value: "" };
    case "type_convert":
      return { type, field: preservedField, targetType: "string" };
    case "string_op":
      return {
        type,
        field: preservedField,
        operation: "trim",
      };
    case "math_op":
      return {
        type,
        field: preservedField,
        operation: "add",
        operand: 0,
      };
    case "date_op":
      return {
        type,
        field: preservedField,
        operation: "format",
        args: { pattern: "YYYY-MM-DD" },
      };
    case "array_filter":
      return {
        type,
        field: preservedField,
        condition: { field: "", operator: "eq", value: "" },
      };
    case "array_sort":
      return {
        type,
        field: preservedField,
        order: "asc",
      };
    case "object_pick":
      return {
        type,
        field: preservedField || undefined,
        keys: [],
      };
    case "object_omit":
      return {
        type,
        field: preservedField || undefined,
        keys: [],
      };
  }
}
