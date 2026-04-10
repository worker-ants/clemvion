import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== If/Else =====
export function IfElseConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Combine Mode"
        value={combineMode}
        onChange={(v) => onChange({ ...config, combineMode: v })}
        options={[
          { value: "and", label: "AND (all conditions)" },
          { value: "or", label: "OR (any condition)" },
        ]}
      />
      <SectionTitle>Conditions</SectionTitle>
      {conditions.map((cond, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Condition {i + 1}</span>
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
            placeholder="Field (e.g. {{ $input.status }})"
          />
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, "operator", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="eq">Equals (==)</option>
            <option value="neq">Not Equals (!=)</option>
            <option value="gt">Greater Than (&gt;)</option>
            <option value="gte">Greater or Equal (&gt;=)</option>
            <option value="lt">Less Than (&lt;)</option>
            <option value="lte">Less or Equal (&lt;=)</option>
            <option value="contains">Contains</option>
            <option value="not_contains">Not Contains</option>
            <option value="starts_with">Starts With</option>
            <option value="ends_with">Ends With</option>
            <option value="is_empty">Is Empty</option>
            <option value="is_not_empty">Is Not Empty</option>
            <option value="regex">Regex Match</option>
            <option value="is_null">Is Null</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={cond.value}
            onChange={(v) => updateCondition(i, "value", v)}
            placeholder="Value or {{ expression }}"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
        <Plus size={12} className="mr-1" /> Add Condition
      </Button>
    </div>
  );
}

// ===== Switch =====
export function SwitchConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Mode"
        value={mode}
        onChange={(v) => onChange({ ...config, mode: v })}
        options={[
          { value: "value", label: "Value Match" },
          { value: "expression", label: "Expression" },
        ]}
      />
      <ExpressionInput
        label="Switch Value"
        value={switchValue}
        onChange={(v) => onChange({ ...config, switchValue: v })}
        placeholder="{{ $input.field }}"
        hint="Expression to evaluate"
      />
      <SectionTitle>Cases</SectionTitle>
      {cases.map((c, i) => (
        <div key={c.id} className="flex gap-1">
          <Input
            value={c.label}
            onChange={(e) => updateCase(i, "label", e.target.value)}
            placeholder="Label"
            className="h-7 flex-1 text-xs"
          />
          <div className="flex-1">
            <ExpressionInput
              bare
              label=""
              value={c.value}
              onChange={(v) => updateCase(i, "value", v)}
              placeholder="Value or {{ expression }}"
            />
          </div>
          <select
            value={c.valueType ?? "string"}
            onChange={(e) => updateCase(i, "valueType", e.target.value)}
            className="h-7 w-[72px] shrink-0 rounded-md border border-[hsl(var(--input))] bg-transparent px-1 text-[10px]"
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
          </select>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeCase(i)}>
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCase}>
        <Plus size={12} className="mr-1" /> Add Case
      </Button>
      {/* Default case — fixed, non-removable */}
      <div className="flex items-center gap-1 rounded border border-dashed border-[hsl(var(--border))] px-2 py-1.5">
        <span className="text-[10px] font-medium text-[hsl(var(--muted-foreground))]">Default</span>
        <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">no match fallback</span>
      </div>
    </div>
  );
}

// ===== Loop =====
export function LoopConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Iteration Count"
        value={(config.count as string) ?? ""}
        onChange={(v) => onChange({ ...config, count: v })}
        placeholder="10 or {{ $input.count }}"
        hint="Number of iterations or expression"
      />
      <NumberField
        label="Max Iterations"
        value={(config.maxIterations as number) ?? 1000}
        onChange={(v) => onChange({ ...config, maxIterations: v })}
        min={1}
        max={100000}
        hint="Safety limit to prevent infinite loops"
      />
      <ExpressionInput
        label="Break Condition"
        value={(config.breakCondition as string) ?? ""}
        onChange={(v) => onChange({ ...config, breakCondition: v })}
        placeholder="Optional: {{ $loop.result > 100 }}"
        hint="Expression to exit early (optional)"
      />
    </div>
  );
}

// ===== Variable Declaration =====
export function VariableDeclarationConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
      <SectionTitle>Variables</SectionTitle>
      {variables.map((v, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Variable {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeVariable(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={v.name}
            onChange={(e) => updateVariable(i, "name", e.target.value)}
            placeholder="Variable name"
            className="h-7 text-xs"
          />
          <select
            value={v.type}
            onChange={(e) => updateVariable(i, "type", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="string">String</option>
            <option value="number">Number</option>
            <option value="boolean">Boolean</option>
            <option value="array">Array</option>
            <option value="object">Object</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={v.defaultValue}
            onChange={(val) => updateVariable(i, "defaultValue", val)}
            placeholder="Default value or {{ expression }}"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addVariable}>
        <Plus size={12} className="mr-1" /> Add Variable
      </Button>
    </div>
  );
}

// ===== Variable Modification =====
export function VariableModificationConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
      <SectionTitle>Modifications</SectionTitle>
      {modifications.map((m, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">#{i + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeMod(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={m.variable}
            onChange={(e) => updateMod(i, "variable", e.target.value)}
            placeholder="Variable name"
            className="h-7 text-xs"
          />
          <select
            value={m.operation}
            onChange={(e) => updateMod(i, "operation", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="set">Set</option>
            <option value="increment">Increment</option>
            <option value="decrement">Decrement</option>
            <option value="append">Append</option>
            <option value="push">Push</option>
            <option value="pop">Pop</option>
            <option value="set_field">Set Field</option>
            <option value="delete_field">Delete Field</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={m.value}
            onChange={(v) => updateMod(i, "value", v)}
            placeholder="Value or {{ expression }}"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addMod}>
        <Plus size={12} className="mr-1" /> Add Modification
      </Button>
    </div>
  );
}

// ===== Split =====
export function SplitConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Field Path"
        value={(config.fieldPath as string) ?? ""}
        onChange={(v) => onChange({ ...config, fieldPath: v })}
        placeholder="{{ $input.items }}"
        hint="Array field to split into individual items"
      />
      <CheckboxField
        label="Keep other fields"
        checked={(config.keepOtherFields as boolean) ?? false}
        onChange={(v) => onChange({ ...config, keepOtherFields: v })}
      />
    </div>
  );
}

// ===== Map =====
export function MapConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const mapping = (config.mapping as Array<{ targetField: string; expression: string }>) ?? [];

  const addMapping = () =>
    onChange({ ...config, mapping: [...mapping, { targetField: "", expression: "" }] });

  const removeMapping = (i: number) =>
    onChange({ ...config, mapping: mapping.filter((_, idx) => idx !== i) });

  const updateMapping = (i: number, key: string, val: string) => {
    const updated = mapping.map((m, idx) => (idx === i ? { ...m, [key]: val } : m));
    onChange({ ...config, mapping: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Input Field"
        value={(config.inputField as string) ?? ""}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder="{{ $input.items }}"
        hint="Array field to transform"
      />
      <ExpressionInput
        label="Output Field"
        value={(config.outputField as string) ?? ""}
        onChange={(v) => onChange({ ...config, outputField: v })}
        placeholder="result"
      />
      <SectionTitle>Mapping Rules</SectionTitle>
      {mapping.map((m, i) => (
        <div key={i} className="flex gap-1">
          <Input
            value={m.targetField}
            onChange={(e) => updateMapping(i, "targetField", e.target.value)}
            placeholder="Target field"
            className="h-7 flex-1 text-xs"
          />
          <div className="flex-1">
            <ExpressionInput
              bare
              label=""
              value={m.expression}
              onChange={(v) => updateMapping(i, "expression", v)}
              placeholder="{{ $item.field }}"
            />
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeMapping(i)}>
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addMapping}>
        <Plus size={12} className="mr-1" /> Add Mapping
      </Button>
    </div>
  );
}

// ===== ForEach =====
export function ForEachConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Array Field"
        value={(config.arrayField as string) ?? ""}
        onChange={(v) => onChange({ ...config, arrayField: v })}
        placeholder="{{ $input.items }}"
        hint="Array to iterate over"
      />
      <SelectField
        label="Error Policy"
        value={(config.errorPolicy as string) ?? "stop"}
        onChange={(v) => onChange({ ...config, errorPolicy: v })}
        options={[
          { value: "stop", label: "Stop on Error" },
          { value: "skip", label: "Skip Item" },
          { value: "continue", label: "Continue" },
        ]}
      />
      <CheckboxField
        label="Collect results as array"
        checked={(config.collectResults as boolean) ?? true}
        onChange={(v) => onChange({ ...config, collectResults: v })}
      />
    </div>
  );
}

// ===== Filter =====
export function FilterConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Array Field"
        value={inputField}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder="{{ $input.items }}"
        hint="Array to filter"
      />
      <SelectField
        label="Combine Mode"
        value={combineMode}
        onChange={(v) => onChange({ ...config, combineMode: v })}
        options={[
          { value: "and", label: "AND (all conditions)" },
          { value: "or", label: "OR (any condition)" },
        ]}
      />
      <SectionTitle>Conditions</SectionTitle>
      {conditions.map((cond, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Condition {i + 1}</span>
            {conditions.length > 1 && (
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCondition(i)}>
                <X size={10} />
              </Button>
            )}
          </div>
          <Input
            value={cond.field}
            onChange={(e) => updateCondition(i, "field", e.target.value)}
            placeholder="Field path (e.g. status, user.age)"
            className="h-7 text-xs"
          />
          <select
            value={cond.operator}
            onChange={(e) => updateCondition(i, "operator", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="eq">Equals (==)</option>
            <option value="neq">Not Equals (!=)</option>
            <option value="gt">Greater Than (&gt;)</option>
            <option value="gte">Greater or Equal (&gt;=)</option>
            <option value="lt">Less Than (&lt;)</option>
            <option value="lte">Less or Equal (&lt;=)</option>
            <option value="contains">Contains</option>
            <option value="not_contains">Not Contains</option>
            <option value="starts_with">Starts With</option>
            <option value="ends_with">Ends With</option>
            <option value="is_empty">Is Empty</option>
            <option value="is_not_empty">Is Not Empty</option>
            <option value="regex">Regex Match</option>
            <option value="is_null">Is Null</option>
            <option value="is_type">Is Type</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={cond.value}
            onChange={(v) => updateCondition(i, "value", v)}
            placeholder="Value or {{ expression }}"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCondition}>
        <Plus size={12} className="mr-1" /> Add Condition
      </Button>
      <CheckboxField
        label="Strict type comparison (===)"
        checked={strictComparison}
        onChange={(v) => onChange({ ...config, strictComparison: v })}
      />
    </div>
  );
}

// ===== Merge =====
export function MergeConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Strategy"
        value={(config.strategy as string) ?? "wait_all"}
        onChange={(v) => onChange({ ...config, strategy: v })}
        options={[
          { value: "wait_all", label: "Wait for All" },
          { value: "first", label: "First Arrived" },
          { value: "append", label: "Append" },
        ]}
      />
      <SelectField
        label="Output Format"
        value={(config.outputFormat as string) ?? "array"}
        onChange={(v) => onChange({ ...config, outputFormat: v })}
        options={[
          { value: "array", label: "Array" },
          { value: "merge_object", label: "Merge Object" },
          { value: "indexed", label: "Indexed Object" },
        ]}
      />
      <NumberField
        label="Timeout (seconds)"
        value={(config.timeout as number) ?? 300}
        onChange={(v) => onChange({ ...config, timeout: v })}
        min={1}
      />
    </div>
  );
}
