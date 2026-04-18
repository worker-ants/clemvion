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
import { useT } from "@/lib/i18n";

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
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fromPath")}</FieldLabel>
      <PathInput
        value={op.from}
        onChange={(v) => onChange({ ...op, from: v })}
        placeholder={t("nodeConfigs.transform.fromPathPlaceholder")}
      />
      <FieldLabel>{t("nodeConfigs.transform.toPath")}</FieldLabel>
      <Input
        value={op.to}
        onChange={(e) => onChange({ ...op, to: e.target.value })}
        placeholder={t("nodeConfigs.transform.toPathPlaceholder")}
        className="h-7 text-xs"
      />
    </>
  );
}

export function RemoveFieldFields({
  op,
  onChange,
}: OpPropsOf<"remove_field">) {
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
    </>
  );
}

export function SetFieldFields({ op, onChange }: OpPropsOf<"set_field">) {
  const t = useT();
  const stringValue =
    typeof op.value === "string" ? op.value : JSON.stringify(op.value ?? "");
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.valueExpression")}</FieldLabel>
      <ExpressionInput
        bare
        label=""
        value={stringValue}
        onChange={(v) => onChange({ ...op, value: v })}
        placeholder={t("nodeConfigs.transform.valueExpressionPlaceholder")}
      />
    </>
  );
}

export function TypeConvertFields({
  op,
  onChange,
}: OpPropsOf<"type_convert">) {
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.targetType")}</FieldLabel>
      <MiniSelect<ConvertType>
        value={op.targetType}
        onChange={(v) => onChange({ ...op, targetType: v })}
        options={[
          { value: "string", label: t("nodeConfigs.transform.castString") },
          { value: "number", label: t("nodeConfigs.transform.castNumber") },
          { value: "boolean", label: t("nodeConfigs.transform.castBoolean") },
          { value: "array", label: t("nodeConfigs.transform.castArray") },
          { value: "object", label: t("nodeConfigs.transform.castObject") },
        ]}
      />
    </>
  );
}

export function StringOpFields({ op, onChange }: OpPropsOf<"string_op">) {
  const t = useT();
  const args = (op.args ?? {}) as Record<string, unknown>;

  const setArgs = (patch: Record<string, unknown>) =>
    onChange({ ...op, args: { ...args, ...patch } });

  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.operation")}</FieldLabel>
      <MiniSelect<StringOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v, args: {} })}
        options={[
          { value: "trim", label: t("nodeConfigs.transform.strTrim") },
          { value: "uppercase", label: t("nodeConfigs.transform.strUppercase") },
          { value: "lowercase", label: t("nodeConfigs.transform.strLowercase") },
          { value: "replace", label: t("nodeConfigs.transform.strReplace") },
          { value: "split", label: t("nodeConfigs.transform.strSplit") },
          { value: "join", label: t("nodeConfigs.transform.strJoin") },
        ]}
      />
      {op.operation === "replace" && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.searchPlaceholder")}</FieldLabel>
          <Input
            value={(args.search as string) ?? ""}
            onChange={(e) => setArgs({ search: e.target.value })}
            className="h-7 text-xs"
          />
          <FieldLabel>{t("nodeConfigs.transform.replacementPlaceholder")}</FieldLabel>
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
            {t("nodeConfigs.transform.replaceAll")}
          </label>
          <label className="flex items-center gap-1 text-[10px]">
            <input
              type="checkbox"
              checked={args.regex === true}
              onChange={(e) => setArgs({ regex: e.target.checked })}
            />
            {t("nodeConfigs.transform.regexPattern")}
          </label>
        </>
      )}
      {(op.operation === "split" || op.operation === "join") && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.separator")}</FieldLabel>
          <Input
            value={(args.separator as string) ?? ""}
            onChange={(e) => setArgs({ separator: e.target.value })}
            placeholder={
              op.operation === "split"
                ? t("nodeConfigs.transform.separatorCommaHint")
                : t("nodeConfigs.transform.separatorDashHint")
            }
            className="h-7 text-xs"
          />
        </>
      )}
    </>
  );
}

export function MathOpFields({ op, onChange }: OpPropsOf<"math_op">) {
  const t = useT();
  const needsOperand =
    op.operation === "add" ||
    op.operation === "subtract" ||
    op.operation === "multiply" ||
    op.operation === "divide";
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.mathOp")}</FieldLabel>
      <MiniSelect<MathOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v })}
        options={[
          { value: "add", label: t("nodeConfigs.transform.mathAdd") },
          { value: "subtract", label: t("nodeConfigs.transform.mathSubtract") },
          { value: "multiply", label: t("nodeConfigs.transform.mathMultiply") },
          { value: "divide", label: t("nodeConfigs.transform.mathDivide") },
          { value: "round", label: t("nodeConfigs.transform.mathRound") },
          { value: "ceil", label: t("nodeConfigs.transform.mathCeil") },
          { value: "floor", label: t("nodeConfigs.transform.mathFloor") },
        ]}
      />
      {needsOperand && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.operand")}</FieldLabel>
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
  const t = useT();
  const args = (op.args ?? {}) as Record<string, unknown>;
  const setArgs = (patch: Record<string, unknown>) =>
    onChange({ ...op, args: { ...args, ...patch } });

  const unitOptions = DATE_UNITS.map((u) => ({ value: u, label: u }));

  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.fieldPath")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.dateOp")}</FieldLabel>
      <MiniSelect<DateOpKind>
        value={op.operation}
        onChange={(v) => onChange({ ...op, operation: v, args: {} })}
        options={[
          { value: "format", label: t("nodeConfigs.transform.dateFormat") },
          { value: "add", label: t("nodeConfigs.transform.dateAdd") },
          { value: "subtract", label: t("nodeConfigs.transform.dateSubtract") },
          { value: "diff", label: t("nodeConfigs.transform.dateDiff") },
        ]}
      />
      {op.operation === "format" && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.patternDayjs")}</FieldLabel>
          <Input
            value={(args.pattern as string) ?? ""}
            onChange={(e) => setArgs({ pattern: e.target.value })}
            placeholder={t("nodeConfigs.transform.patternPlaceholder")}
            className="h-7 text-xs"
          />
        </>
      )}
      {(op.operation === "add" || op.operation === "subtract") && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.amount")}</FieldLabel>
          <Input
            type="number"
            value={(args.amount as number) ?? 0}
            onChange={(e) => setArgs({ amount: Number(e.target.value) })}
            className="h-7 text-xs"
          />
          <FieldLabel>{t("nodeConfigs.transform.unit")}</FieldLabel>
          <MiniSelect<DateUnit>
            value={(args.unit as DateUnit) ?? "days"}
            onChange={(v) => setArgs({ unit: v })}
            options={unitOptions}
          />
        </>
      )}
      {op.operation === "diff" && (
        <>
          <FieldLabel>{t("nodeConfigs.transform.compareField")}</FieldLabel>
          <PathInput
            value={(args.compareField as string) ?? ""}
            onChange={(v) => setArgs({ compareField: v })}
          />
          <FieldLabel>{t("nodeConfigs.transform.unit")}</FieldLabel>
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
  const t = useT();
  const updateCondition = (patch: Partial<ArrayFilterCondition>) =>
    onChange({ ...op, condition: { ...op.condition, ...patch } });

  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.arrayField")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
        placeholder={t("nodeConfigs.transform.arrayFieldPlaceholder")}
      />
      <FieldLabel>{t("nodeConfigs.transform.conditionField")}</FieldLabel>
      <Input
        value={op.condition.field}
        onChange={(e) => updateCondition({ field: e.target.value })}
        placeholder={t("nodeConfigs.transform.conditionFieldPlaceholder")}
        className="h-7 text-xs"
      />
      <FieldLabel>{t("nodeConfigs.transform.operator")}</FieldLabel>
      <MiniSelect<ConditionOperator>
        value={op.condition.operator}
        onChange={(v) => updateCondition({ operator: v })}
        options={CONDITION_OPERATORS}
      />
      <FieldLabel>{t("nodeConfigs.transform.valueLabel")}</FieldLabel>
      <ExpressionInput
        bare
        label=""
        value={
          typeof op.condition.value === "string"
            ? op.condition.value
            : String(op.condition.value ?? "")
        }
        onChange={(v) => updateCondition({ value: v })}
        placeholder={t("nodeConfigs.transform.valueExprPlaceholder")}
      />
    </>
  );
}

export function ArraySortFields({ op, onChange }: OpPropsOf<"array_sort">) {
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.arrayField")}</FieldLabel>
      <PathInput
        value={op.field}
        onChange={(v) => onChange({ ...op, field: v })}
      />
      <FieldLabel>{t("nodeConfigs.transform.sortBy")}</FieldLabel>
      <Input
        value={op.sortBy ?? ""}
        onChange={(e) =>
          onChange({ ...op, sortBy: e.target.value || undefined })
        }
        placeholder={t("nodeConfigs.transform.sortByPlaceholder")}
        className="h-7 text-xs"
      />
      <FieldLabel>{t("nodeConfigs.transform.order")}</FieldLabel>
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
            {ord === "asc"
              ? t("nodeConfigs.transform.orderAsc")
              : t("nodeConfigs.transform.orderDesc")}
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
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.targetObjectPath")}</FieldLabel>
      <PathInput
        value={op.field ?? ""}
        onChange={(v) => onChange({ ...op, field: v || undefined })}
      />
      <FieldLabel>{t("nodeConfigs.transform.keysLabel")}</FieldLabel>
      <ChipInput
        values={op.keys}
        onChange={(keys) => onChange({ ...op, keys })}
        placeholder={t("nodeConfigs.transform.keysNamePlaceholder")}
      />
    </>
  );
}

export function ObjectOmitFields({
  op,
  onChange,
}: OpPropsOf<"object_omit">) {
  const t = useT();
  return (
    <>
      <FieldLabel>{t("nodeConfigs.transform.targetObjectPath")}</FieldLabel>
      <PathInput
        value={op.field ?? ""}
        onChange={(v) => onChange({ ...op, field: v || undefined })}
      />
      <FieldLabel>{t("nodeConfigs.transform.keysLabel")}</FieldLabel>
      <ChipInput
        values={op.keys}
        onChange={(keys) => onChange({ ...op, keys })}
        placeholder={t("nodeConfigs.transform.keysPasswordPlaceholder")}
      />
    </>
  );
}
