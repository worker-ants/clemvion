"use client";

import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import type {
  ArrayFilterCondition,
  ConditionOperator,
  ConvertType,
  DateOpKind,
  DateUnit,
  MathOpKind,
  StringOpKind,
  TransformOperation,
} from "@/types/transform";
import { CONDITION_OPERATORS, DATE_UNITS } from "@/types/transform";
import { ChipInput } from "./chip-input";

type OpPropsOf<T extends TransformOperation["type"]> = {
  op: Extract<TransformOperation, { type: T }>;
  onChange: (op: Extract<TransformOperation, { type: T }>) => void;
};

function PathInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <ExpressionInput
      bare
      label=""
      value={value}
      onChange={onChange}
      placeholder={placeholder ?? "e.g. user.profile.name"}
    />
  );
}

function MiniSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
      {children}
    </span>
  );
}

export function RenameFieldFields({
  op,
  onChange,
}: OpPropsOf<"rename_field">) {
  return (
    <>
      <FieldLabel>From (source path)</FieldLabel>
      <PathInput
        value={op.from}
        onChange={(v) => onChange({ ...op, from: v })}
        placeholder="e.g. oldName"
      />
      <FieldLabel>To (target path)</FieldLabel>
      <Input
        value={op.to}
        onChange={(e) => onChange({ ...op, to: e.target.value })}
        placeholder="e.g. newName"
        className="h-7 text-xs"
      />
    </>
  );
}

export function RemoveFieldFields({
  op,
  onChange,
}: OpPropsOf<"remove_field">) {
  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
    </>
  );
}

export function SetFieldFields({ op, onChange }: OpPropsOf<"set_field">) {
  const stringValue =
    typeof op.value === "string" ? op.value : JSON.stringify(op.value ?? "");
  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Value (표현식 지원)</FieldLabel>
      <ExpressionInput
        bare
        label=""
        value={stringValue}
        onChange={(v) => onChange({ ...op, value: v })}
        placeholder="값 또는 {{ $input.x }}"
      />
    </>
  );
}

export function TypeConvertFields({
  op,
  onChange,
}: OpPropsOf<"type_convert">) {
  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Target Type</FieldLabel>
      <MiniSelect<ConvertType>
        value={op.targetType}
        onChange={(v) => onChange({ ...op, targetType: v })}
        options={[
          { value: "string", label: "string" },
          { value: "number", label: "number" },
          { value: "boolean", label: "boolean" },
          { value: "array", label: "array (JSON parse)" },
          { value: "object", label: "object (JSON parse)" },
        ]}
      />
    </>
  );
}

export function StringOpFields({ op, onChange }: OpPropsOf<"string_op">) {
  const args = (op.args ?? {}) as Record<string, unknown>;

  const setArgs = (patch: Record<string, unknown>) =>
    onChange({ ...op, args: { ...args, ...patch } });

  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Operation</FieldLabel>
      <MiniSelect<StringOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v, args: {} })}
        options={[
          { value: "trim", label: "trim" },
          { value: "uppercase", label: "uppercase" },
          { value: "lowercase", label: "lowercase" },
          { value: "replace", label: "replace" },
          { value: "split", label: "split" },
          { value: "join", label: "join" },
        ]}
      />
      {op.operation === "replace" && (
        <>
          <FieldLabel>Search</FieldLabel>
          <Input
            value={(args.search as string) ?? ""}
            onChange={(e) => setArgs({ search: e.target.value })}
            className="h-7 text-xs"
          />
          <FieldLabel>Replacement</FieldLabel>
          <Input
            value={(args.replacement as string) ?? ""}
            onChange={(e) => setArgs({ replacement: e.target.value })}
            className="h-7 text-xs"
          />
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={args.all !== false}
              onChange={(e) => setArgs({ all: e.target.checked })}
            />
            Replace all
          </label>
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={args.regex === true}
              onChange={(e) => setArgs({ regex: e.target.checked })}
            />
            Regex pattern
          </label>
        </>
      )}
      {(op.operation === "split" || op.operation === "join") && (
        <>
          <FieldLabel>Separator</FieldLabel>
          <Input
            value={(args.separator as string) ?? ""}
            onChange={(e) => setArgs({ separator: e.target.value })}
            placeholder={op.operation === "split" ? "e.g. ," : "e.g. -"}
            className="h-7 text-xs"
          />
        </>
      )}
    </>
  );
}

export function MathOpFields({ op, onChange }: OpPropsOf<"math_op">) {
  const needsOperand =
    op.operation === "add" ||
    op.operation === "subtract" ||
    op.operation === "multiply" ||
    op.operation === "divide";
  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Operation</FieldLabel>
      <MiniSelect<MathOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v })}
        options={[
          { value: "add", label: "add" },
          { value: "subtract", label: "subtract" },
          { value: "multiply", label: "multiply" },
          { value: "divide", label: "divide" },
          { value: "round", label: "round" },
          { value: "ceil", label: "ceil" },
          { value: "floor", label: "floor" },
        ]}
      />
      {needsOperand && (
        <>
          <FieldLabel>Operand</FieldLabel>
          <Input
            type="number"
            value={op.operand ?? 0}
            onChange={(e) =>
              onChange({ ...op, operand: Number(e.target.value) })
            }
            className="h-7 text-xs"
          />
        </>
      )}
    </>
  );
}

export function DateOpFields({ op, onChange }: OpPropsOf<"date_op">) {
  const args = (op.args ?? {}) as Record<string, unknown>;
  const setArgs = (patch: Record<string, unknown>) =>
    onChange({ ...op, args: { ...args, ...patch } });

  const unitOptions = DATE_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <>
      <FieldLabel>Field path</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Operation</FieldLabel>
      <MiniSelect<DateOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v, args: {} })}
        options={[
          { value: "format", label: "format" },
          { value: "add", label: "add" },
          { value: "subtract", label: "subtract" },
          { value: "diff", label: "diff" },
        ]}
      />
      {op.operation === "format" && (
        <>
          <FieldLabel>Pattern (dayjs)</FieldLabel>
          <Input
            value={(args.pattern as string) ?? ""}
            onChange={(e) => setArgs({ pattern: e.target.value })}
            placeholder="e.g. YYYY-MM-DD HH:mm:ss"
            className="h-7 text-xs"
          />
        </>
      )}
      {(op.operation === "add" || op.operation === "subtract") && (
        <>
          <FieldLabel>Amount</FieldLabel>
          <Input
            type="number"
            value={(args.amount as number) ?? 0}
            onChange={(e) => setArgs({ amount: Number(e.target.value) })}
            className="h-7 text-xs"
          />
          <FieldLabel>Unit</FieldLabel>
          <MiniSelect<DateUnit>
            value={(args.unit as DateUnit) ?? "days"}
            onChange={(v) => setArgs({ unit: v })}
            options={unitOptions}
          />
        </>
      )}
      {op.operation === "diff" && (
        <>
          <FieldLabel>Compare Field</FieldLabel>
          <PathInput
            value={(args.compareField as string) ?? ""}
            onChange={(v) => setArgs({ compareField: v })}
          />
          <FieldLabel>Unit</FieldLabel>
          <MiniSelect<DateUnit>
            value={(args.unit as DateUnit) ?? "days"}
            onChange={(v) => setArgs({ unit: v })}
            options={unitOptions}
          />
        </>
      )}
    </>
  );
}

export function ArrayFilterFields({
  op,
  onChange,
}: OpPropsOf<"array_filter">) {
  const updateCondition = (patch: Partial<ArrayFilterCondition>) =>
    onChange({ ...op, condition: { ...op.condition, ...patch } });

  return (
    <>
      <FieldLabel>Array Field (path)</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
        placeholder="e.g. items"
      />
      <FieldLabel>Condition Field (요소 내 경로)</FieldLabel>
      <Input
        value={op.condition.field}
        onChange={(e) => updateCondition({ field: e.target.value })}
        placeholder="e.g. active, user.age"
        className="h-7 text-xs"
      />
      <FieldLabel>Operator</FieldLabel>
      <MiniSelect<ConditionOperator>
        value={op.condition.operator}
        onChange={(v) => updateCondition({ operator: v })}
        options={CONDITION_OPERATORS}
      />
      <FieldLabel>Value</FieldLabel>
      <ExpressionInput
        bare
        label=""
        value={
          typeof op.condition.value === "string"
            ? op.condition.value
            : String(op.condition.value ?? "")
        }
        onChange={(v) => updateCondition({ value: v })}
        placeholder="값 또는 {{ 표현식 }}"
      />
    </>
  );
}

export function ArraySortFields({ op, onChange }: OpPropsOf<"array_sort">) {
  return (
    <>
      <FieldLabel>Array Field (path)</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>Sort By (요소 내 경로, 원시값이면 비워두세요)</FieldLabel>
      <Input
        value={op.sortBy ?? ""}
        onChange={(e) =>
          onChange({ ...op, sortBy: e.target.value || undefined })
        }
        placeholder="e.g. score"
        className="h-7 text-xs"
      />
      <FieldLabel>Order</FieldLabel>
      <div className="flex gap-1">
        {(["asc", "desc"] as const).map((ord) => (
          <button
            key={ord}
            type="button"
            onClick={() => onChange({ ...op, order: ord })}
            className={
              "h-7 flex-1 rounded-md border px-2 text-xs " +
              (op.order === ord
                ? "border-[hsl(var(--primary))] bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))]"
                : "border-[hsl(var(--input))] bg-transparent")
            }
          >
            {ord.toUpperCase()}
          </button>
        ))}
      </div>
    </>
  );
}

export function ObjectPickFields({
  op,
  onChange,
}: OpPropsOf<"object_pick">) {
  return (
    <>
      <FieldLabel>Target Object Path (비워두면 루트)</FieldLabel>
      <PathInput
        value={op.field ?? ""}
        onChange={(v) => onChange({ ...op, field: v || undefined })}
      />
      <FieldLabel>Keys (Enter 또는 쉼표로 추가)</FieldLabel>
      <ChipInput
        values={op.keys}
        onChange={(keys) => onChange({ ...op, keys })}
        placeholder="e.g. name, email"
      />
    </>
  );
}

export function ObjectOmitFields({
  op,
  onChange,
}: OpPropsOf<"object_omit">) {
  return (
    <>
      <FieldLabel>Target Object Path (비워두면 루트)</FieldLabel>
      <PathInput
        value={op.field ?? ""}
        onChange={(v) => onChange({ ...op, field: v || undefined })}
      />
      <FieldLabel>Keys (Enter 또는 쉼표로 추가)</FieldLabel>
      <ChipInput
        values={op.keys}
        onChange={(keys) => onChange({ ...op, keys })}
        placeholder="e.g. password"
      />
    </>
  );
}
