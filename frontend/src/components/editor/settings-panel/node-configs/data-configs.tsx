"use client";

import { SelectField, TextAreaField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Transform =====
export function TransformConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const operations = (config.operations as Array<{ type: string; field: string; params: string }>) ?? [];

  const addOperation = () =>
    onChange({
      ...config,
      operations: [...operations, { type: "set_field", field: "", params: "" }],
    });

  const removeOperation = (i: number) =>
    onChange({ ...config, operations: operations.filter((_, idx) => idx !== i) });

  const updateOperation = (i: number, key: string, val: string) => {
    const updated = operations.map((o, idx) => (idx === i ? { ...o, [key]: val } : o));
    onChange({ ...config, operations: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Operations</SectionTitle>
      {operations.map((op, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Step {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeOperation(i)}>
              <X size={10} />
            </Button>
          </div>
          <select
            value={op.type}
            onChange={(e) => updateOperation(i, "type", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="rename_field">Rename Field</option>
            <option value="remove_field">Remove Field</option>
            <option value="set_field">Set Field</option>
            <option value="type_convert">Type Convert</option>
            <option value="string_op">String Operation</option>
            <option value="math_op">Math Operation</option>
            <option value="date_op">Date Operation</option>
            <option value="array_filter">Array Filter</option>
            <option value="array_sort">Array Sort</option>
            <option value="object_pick">Object Pick</option>
          </select>
          <ExpressionInput
            bare
            label=""
            value={op.field}
            onChange={(v) => updateOperation(i, "field", v)}
            placeholder="Field path (e.g. {{ $input.data }})"
          />
          <ExpressionInput
            bare
            label=""
            value={op.params}
            onChange={(v) => updateOperation(i, "params", v)}
            placeholder="Parameters or {{ expression }}"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addOperation}>
        <Plus size={12} className="mr-1" /> Add Operation
      </Button>
    </div>
  );
}

// ===== Code =====
export function CodeConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Language"
        value={(config.language as string) ?? "javascript"}
        onChange={(v) => onChange({ ...config, language: v })}
        options={[{ value: "javascript", label: "JavaScript" }]}
      />
      <TextAreaField
        label="Code"
        value={(config.code as string) ?? ""}
        onChange={(v) => onChange({ ...config, code: v })}
        placeholder={`// Access input via $input\nconst result = $input.data;\nreturn { result };`}
        mono
        rows={12}
        hint="Available: $input, $vars, $execution, $helpers"
      />
    </div>
  );
}
