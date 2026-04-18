import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useT, type TFunction } from "@/lib/i18n";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

function operatorOptions(t: TFunction) {
  return [
    { value: "eq", label: t("nodeConfigs.logic.opEquals") },
    { value: "neq", label: t("nodeConfigs.logic.opNotEquals") },
    { value: "gt", label: t("nodeConfigs.logic.opGreater") },
    { value: "gte", label: t("nodeConfigs.logic.opGreaterEqual") },
    { value: "lt", label: t("nodeConfigs.logic.opLess") },
    { value: "lte", label: t("nodeConfigs.logic.opLessEqual") },
    { value: "contains", label: t("nodeConfigs.logic.opContains") },
    { value: "not_contains", label: t("nodeConfigs.logic.opNotContains") },
    { value: "starts_with", label: t("nodeConfigs.logic.opStartsWith") },
    { value: "ends_with", label: t("nodeConfigs.logic.opEndsWith") },
    { value: "is_empty", label: t("nodeConfigs.logic.opEmpty") },
    { value: "is_not_empty", label: t("nodeConfigs.logic.opNotEmpty") },
    { value: "regex", label: t("nodeConfigs.logic.opRegex") },
    { value: "is_null", label: t("nodeConfigs.logic.opNull") },
  ];
}

// ===== If/Else =====
export function IfElseConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const conditions = (config.conditions as Array<{ field: string; operator: string; value: string }>) ?? [
    { field: "", operator: "eq", value: "" },
  ];
  const combineMode = (config.combineMode as string) ?? "and";

  const updateCondition = (i: number, key: string, val: string) => {
    const updated = conditions.map((c, idx) =>
      idx === i ? { ...c, [key]: val } : c,
    );
    onChange({ ...config, conditions: updated });
  };

  const addCondition = () =>
    onChange({ ...config, conditions: [...conditions, { field: "", operator: "eq", value: "" }] });

  const removeCondition = (i: number) =>
    onChange({ ...config, conditions: conditions.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.logic.combineMode")}
        value={combineMode}
        onChange={(v) => onChange({ ...config, combineMode: v })}
        options={[
          { value: "and", label: t("nodeConfigs.logic.combineAnd") },
          { value: "or", label: t("nodeConfigs.logic.combineOr") },
        ]}
      />
      <SectionTitle>{t("nodeConfigs.logic.conditions")}</SectionTitle>
      {conditions.map((cond, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.logic.conditionLabel", { index: i + 1 })}
            </span>
            {conditions.length > 1 && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCondition(i)}>
                <X size={10} />
              </Button>
            )}
          </div>
          <ExpressionInput
            bare
            label=""
            value={cond.field}
            onChange={(v) => updateCondition(i, "field", v)}
            placeholder={t("nodeConfigs.logic.fieldPlaceholderExample")}
          />
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, "operator", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            {operatorOptions(t).map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <ExpressionInput
            bare
            label=""
            value={cond.value}
            onChange={(v) => updateCondition(i, "value", v)}
            placeholder={t("nodeConfigs.logic.caseValue")}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.logic.addCondition")}
      </Button>
    </div>
  );
}

// ===== Switch =====
export function SwitchConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const mode = (config.mode as string) ?? "value";
  const switchValue = (config.switchValue as string) ?? "";
  const cases =
    (config.cases as Array<{
      id: string;
      label: string;
      value: string;
      valueType?: string;
    }>) ?? [];

  const addCase = () =>
    onChange({
      ...config,
      hasDefault: true,
      cases: [
        ...cases,
        { id: crypto.randomUUID(), label: `Case ${cases.length + 1}`, value: "", valueType: "string" },
      ],
    });

  const removeCase = (i: number) =>
    onChange({ ...config, cases: cases.filter((_, idx) => idx !== i) });

  const updateCase = (i: number, key: string, val: string) => {
    const updated = cases.map((c, idx) => (idx === i ? { ...c, [key]: val } : c));
    onChange({ ...config, cases: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.logic.mode")}
        value={mode}
        onChange={(v) => onChange({ ...config, mode: v })}
        options={[
          { value: "value", label: t("nodeConfigs.logic.modeValueMatch") },
          { value: "expression", label: t("nodeConfigs.logic.modeExpression") },
        ]}
      />
      <ExpressionInput
        label={t("nodeConfigs.logic.switchValue")}
        value={switchValue}
        onChange={(v) => onChange({ ...config, switchValue: v })}
        placeholder={t("nodeConfigs.logic.switchPlaceholder")}
        hint={t("nodeConfigs.logic.switchHint")}
      />
      <SectionTitle>{t("nodeConfigs.logic.cases")}</SectionTitle>
      {cases.map((c, i) => (
        <div key={c.id} className="flex gap-1">
          <Input
            value={c.label}
            onChange={(e) => updateCase(i, "label", e.target.value)}
            placeholder={t("nodeConfigs.logic.caseLabel")}
            className="h-7 flex-1 text-xs"
          />
          <div className="flex-1">
            <ExpressionInput
              bare
              label=""
              value={c.value}
              onChange={(v) => updateCase(i, "value", v)}
              placeholder={t("nodeConfigs.logic.caseValue")}
            />
          </div>
          <select
            value={c.valueType ?? "string"}
            onChange={(e) => updateCase(i, "valueType", e.target.value)}
            className="h-7 w-[72px] shrink-0 rounded-md border border-[hsl(var(--input))] bg-transparent px-1 text-[10px]"
          >
            <option value="string">{t("nodeConfigs.logic.typeString")}</option>
            <option value="number">{t("nodeConfigs.logic.typeNumber")}</option>
            <option value="boolean">{t("nodeConfigs.logic.typeBoolean")}</option>
          </select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCase(i)}>
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCase}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.logic.addCase")}
      </Button>
      <div className="flex items-center gap-1 rounded border border-dashed border-[hsl(var(--border))] px-2 py-1.5">
        <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.logic.defaultHeader")}
        </span>
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.logic.defaultHint")}
        </span>
      </div>
    </div>
  );
}

// ===== Loop =====
export function LoopConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.logic.iterationCount")}
        value={config.count == null ? "" : String(config.count)}
        onChange={(v) => onChange({ ...config, count: v })}
        placeholder={t("nodeConfigs.logic.iterationCountPlaceholder")}
        hint={t("nodeConfigs.logic.iterationCountHint")}
      />
      <NumberField
        label={t("nodeConfigs.logic.maxIterations")}
        value={(config.maxIterations as number) ?? 1000}
        onChange={(v) => onChange({ ...config, maxIterations: v })}
        min={1}
        max={100000}
        hint={t("nodeConfigs.logic.maxIterationsHint")}
      />
      <ExpressionInput
        label={t("nodeConfigs.logic.breakCondition")}
        value={
          typeof config.breakCondition === "string" ? config.breakCondition : ""
        }
        onChange={(v) => onChange({ ...config, breakCondition: v })}
        placeholder={t("nodeConfigs.logic.breakConditionPlaceholder")}
        hint={t("nodeConfigs.logic.breakConditionHint")}
      />
    </div>
  );
}

// ===== Variable Declaration =====
export function VariableDeclarationConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const variables = (config.variables as Array<{ name: string; type: string; defaultValue: string }>) ?? [];

  const addVariable = () =>
    onChange({ ...config, variables: [...variables, { name: "", type: "string", defaultValue: "" }] });

  const removeVariable = (i: number) =>
    onChange({ ...config, variables: variables.filter((_, idx) => idx !== i) });

  const updateVariable = (i: number, key: string, val: string) => {
    const updated = variables.map((v, idx) => (idx === i ? { ...v, [key]: val } : v));
    onChange({ ...config, variables: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{t("nodeConfigs.logic.variables")}</SectionTitle>
      {variables.map((v, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.logic.variableLabel", { index: i + 1 })}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeVariable(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={v.name}
            onChange={(e) => updateVariable(i, "name", e.target.value)}
            placeholder={t("nodeConfigs.logic.variableNamePlaceholder")}
            className="h-7 text-xs"
          />
          <select
            value={v.type}
            onChange={(e) => updateVariable(i, "type", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="string">{t("nodeConfigs.logic.typeString")}</option>
            <option value="number">{t("nodeConfigs.logic.typeNumber")}</option>
            <option value="boolean">{t("nodeConfigs.logic.typeBoolean")}</option>
            <option value="array">{t("nodeConfigs.logic.typeArray")}</option>
            <option value="object">{t("nodeConfigs.logic.typeObject")}</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={v.defaultValue}
            onChange={(val) => updateVariable(i, "defaultValue", val)}
            placeholder={t("nodeConfigs.logic.variableDefaultPlaceholder")}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addVariable}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.logic.addVariable")}
      </Button>
    </div>
  );
}

// ===== Variable Modification =====
export function VariableModificationConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const modifications = (config.modifications as Array<{ variable: string; operation: string; value: string }>) ?? [];

  const addMod = () =>
    onChange({ ...config, modifications: [...modifications, { variable: "", operation: "set", value: "" }] });

  const removeMod = (i: number) =>
    onChange({ ...config, modifications: modifications.filter((_, idx) => idx !== i) });

  const updateMod = (i: number, key: string, val: string) => {
    const updated = modifications.map((m, idx) => (idx === i ? { ...m, [key]: val } : m));
    onChange({ ...config, modifications: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{t("nodeConfigs.logic.modifications")}</SectionTitle>
      {modifications.map((m, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.logic.modificationLabel", { index: i + 1 })}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeMod(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={m.variable}
            onChange={(e) => updateMod(i, "variable", e.target.value)}
            placeholder={t("nodeConfigs.logic.varNamePlaceholder")}
            className="h-7 text-xs"
          />
          <select
            value={m.operation}
            onChange={(e) => updateMod(i, "operation", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="set">{t("nodeConfigs.logic.opSet")}</option>
            <option value="increment">{t("nodeConfigs.logic.opIncrement")}</option>
            <option value="decrement">{t("nodeConfigs.logic.opDecrement")}</option>
            <option value="append">{t("nodeConfigs.logic.opAppend")}</option>
            <option value="push">{t("nodeConfigs.logic.opPush")}</option>
            <option value="pop">{t("nodeConfigs.logic.opPop")}</option>
            <option value="set_field">{t("nodeConfigs.logic.opSetField")}</option>
            <option value="delete_field">{t("nodeConfigs.logic.opDeleteField")}</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={m.value}
            onChange={(v) => updateMod(i, "value", v)}
            placeholder={t("nodeConfigs.logic.opValuePlaceholder")}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addMod}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.logic.addModification")}
      </Button>
    </div>
  );
}

// ===== Split =====
export function SplitConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.logic.fieldPath")}
        value={(config.fieldPath as string) ?? ""}
        onChange={(v) => onChange({ ...config, fieldPath: v })}
        placeholder={t("nodeConfigs.logic.fieldPathPlaceholderItems")}
        hint={t("nodeConfigs.logic.fieldPathHintItems")}
      />
    </div>
  );
}

// ===== Map =====
export function MapConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.logic.inputField")}
        value={(config.inputField as string) ?? ""}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder={t("nodeConfigs.logic.fieldPathPlaceholderItems")}
        hint={t("nodeConfigs.logic.inputFieldHintMap")}
      />
      <SelectField
        label={t("nodeConfigs.logic.errorPolicy")}
        value={(config.errorPolicy as string) ?? "stop"}
        onChange={(v) => onChange({ ...config, errorPolicy: v })}
        options={[
          { value: "stop", label: t("nodeConfigs.logic.errStop") },
          { value: "skip", label: t("nodeConfigs.logic.errSkip") },
          { value: "continue", label: t("nodeConfigs.logic.errContinue") },
        ]}
      />
    </div>
  );
}

// ===== ForEach =====
export function ForEachConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.logic.arrayField")}
        value={(config.arrayField as string) ?? ""}
        onChange={(v) => onChange({ ...config, arrayField: v })}
        placeholder={t("nodeConfigs.logic.fieldPathPlaceholderItems")}
        hint={t("nodeConfigs.logic.arrayFieldHintIterate")}
      />
      <SelectField
        label={t("nodeConfigs.logic.errorPolicy")}
        value={(config.errorPolicy as string) ?? "stop"}
        onChange={(v) => onChange({ ...config, errorPolicy: v })}
        options={[
          { value: "stop", label: t("nodeConfigs.logic.errStop") },
          { value: "skip", label: t("nodeConfigs.logic.errSkip") },
          { value: "continue", label: t("nodeConfigs.logic.errContinue") },
        ]}
      />
      <CheckboxField
        label={t("nodeConfigs.logic.collectAsArray")}
        checked={(config.collectResults as boolean) ?? true}
        onChange={(v) => onChange({ ...config, collectResults: v })}
      />
    </div>
  );
}

// ===== Filter =====
export function FilterConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const inputField = (config.inputField as string) ?? "";
  const combineMode = (config.combineMode as string) ?? "and";
  const conditions = (config.conditions as Array<{ field: string; operator: string; value: string }>) ?? [
    { field: "", operator: "eq", value: "" },
  ];
  const strictComparison = (config.strictComparison as boolean) ?? false;

  const updateCondition = (i: number, key: string, val: string) => {
    const updated = conditions.map((c, idx) =>
      idx === i ? { ...c, [key]: val } : c,
    );
    onChange({ ...config, conditions: updated });
  };

  const addCondition = () =>
    onChange({ ...config, conditions: [...conditions, { field: "", operator: "eq", value: "" }] });

  const removeCondition = (i: number) =>
    onChange({ ...config, conditions: conditions.filter((_, idx) => idx !== i) });

  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.logic.arrayField")}
        value={inputField}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder={t("nodeConfigs.logic.fieldPathPlaceholderItems")}
        hint={t("nodeConfigs.logic.arrayFieldHintFilter")}
      />
      <SelectField
        label={t("nodeConfigs.logic.combineMode")}
        value={combineMode}
        onChange={(v) => onChange({ ...config, combineMode: v })}
        options={[
          { value: "and", label: t("nodeConfigs.logic.combineAnd") },
          { value: "or", label: t("nodeConfigs.logic.combineOr") },
        ]}
      />
      <SectionTitle>{t("nodeConfigs.logic.conditions")}</SectionTitle>
      {conditions.map((cond, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.logic.conditionLabel", { index: i + 1 })}
            </span>
            {conditions.length > 1 && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCondition(i)}>
                <X size={10} />
              </Button>
            )}
          </div>
          <Input
            value={cond.field}
            onChange={(e) => updateCondition(i, "field", e.target.value)}
            placeholder={t("nodeConfigs.logic.fieldPathExample")}
            className="h-7 text-xs"
          />
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, "operator", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            {operatorOptions(t).map((op) => (
              <option key={op.value} value={op.value}>
                {op.label}
              </option>
            ))}
          </select>
          <ExpressionInput
            bare
            label=""
            value={cond.value}
            onChange={(v) => updateCondition(i, "value", v)}
            placeholder={t("nodeConfigs.logic.caseValue")}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.logic.addCondition")}
      </Button>
      <CheckboxField
        label={t("nodeConfigs.logic.strictCompare")}
        checked={strictComparison}
        onChange={(v) => onChange({ ...config, strictComparison: v })}
      />
    </div>
  );
}

// ===== Parallel =====
export function ParallelConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <NumberField
        label={t("nodeConfigs.logic.branchCount")}
        value={(config.branchCount as number) ?? 2}
        onChange={(v) => onChange({ ...config, branchCount: v })}
        min={2}
        max={16}
        hint={t("nodeConfigs.logic.branchCountHint")}
      />
      <NumberField
        label={t("nodeConfigs.logic.maxConcurrency")}
        value={(config.maxConcurrency as number) ?? 0}
        onChange={(v) => onChange({ ...config, maxConcurrency: v })}
        min={0}
        max={16}
        hint={t("nodeConfigs.logic.maxConcurrencyHint")}
      />
      <CheckboxField
        label={t("nodeConfigs.logic.waitAll")}
        checked={(config.waitAll as boolean) ?? true}
        onChange={(v) => onChange({ ...config, waitAll: v })}
      />
      {(config.waitAll as boolean) === false && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.logic.waitAllHint")}
        </p>
      )}
    </div>
  );
}

// ===== Merge =====
export function MergeConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.logic.strategy")}
        value={(config.strategy as string) ?? "wait_all"}
        onChange={(v) => onChange({ ...config, strategy: v })}
        options={[
          { value: "wait_all", label: t("nodeConfigs.logic.stratWaitAll") },
          { value: "first", label: t("nodeConfigs.logic.stratFirst") },
          { value: "append", label: t("nodeConfigs.logic.stratAppend") },
        ]}
      />
      <SelectField
        label={t("nodeConfigs.logic.outputFormat")}
        value={(config.outputFormat as string) ?? "array"}
        onChange={(v) => onChange({ ...config, outputFormat: v })}
        options={[
          { value: "array", label: t("nodeConfigs.logic.fmtArray") },
          { value: "merge_object", label: t("nodeConfigs.logic.fmtMergeObject") },
          { value: "indexed", label: t("nodeConfigs.logic.fmtIndexedObject") },
        ]}
      />
      <NumberField
        label={t("nodeConfigs.flow.timeoutSeconds")}
        value={(config.timeout as number) ?? 300}
        onChange={(v) => onChange({ ...config, timeout: v })}
        min={0}
        hint={t("nodeConfigs.flow.zeroNoTimeout")}
      />
    </div>
  );
}
