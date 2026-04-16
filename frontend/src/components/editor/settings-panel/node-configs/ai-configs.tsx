import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { LlmConfigSelector } from "@/components/llm-config/llm-config-selector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// AiAgentConfig migrated to auto-form (schema-driven). See
// backend/src/nodes/ai/ai-agent/ai-agent.schema.ts for field metadata.

// ===== Text Classifier =====
export function TextClassifierConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const categories = (config.categories as Array<{ name: string; description: string }>) ?? [];

  const addCategory = () =>
    onChange({ ...config, categories: [...categories, { name: "", description: "" }] });

  const removeCategory = (i: number) =>
    onChange({ ...config, categories: categories.filter((_, idx) => idx !== i) });

  const updateCategory = (i: number, key: string, val: string) => {
    const updated = categories.map((c, idx) => (idx === i ? { ...c, [key]: val } : c));
    onChange({ ...config, categories: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <LlmConfigSelector
        value={(config.llmConfigId as string) ?? ""}
        onChange={(v) => onChange({ ...config, llmConfigId: v })}
      />
      <ExpressionInput
        label="Model Override"
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder="Leave empty for provider default"
      />
      <ExpressionInput
        label="Input Field"
        value={(config.inputField as string) ?? ""}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder="{{ $input.text }}"
      />
      <ExpressionInput multiline
        label="Instructions"
        value={(config.instructions as string) ?? ""}
        onChange={(v) => onChange({ ...config, instructions: v })}
        placeholder="Additional classification guidelines..."
        rows={3}
      />
      <CheckboxField
        label="Include confidence scores"
        checked={(config.includeConfidence as boolean) ?? true}
        onChange={(v) => onChange({ ...config, includeConfidence: v })}
      />
      <CheckboxField
        label="Multi-label Classification"
        checked={(config.multiLabel as boolean) ?? false}
        onChange={(v) => onChange({ ...config, multiLabel: v })}
      />
      <SectionTitle>Categories</SectionTitle>
      {categories.map((cat, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Category {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCategory(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={cat.name}
            onChange={(e) => updateCategory(i, "name", e.target.value)}
            placeholder="Category name"
            className="h-7 text-xs"
          />
          <Input
            value={cat.description}
            onChange={(e) => updateCategory(i, "description", e.target.value)}
            placeholder="Description for LLM"
            className="h-7 text-xs"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCategory}>
        <Plus size={12} className="mr-1" /> Add Category
      </Button>
    </div>
  );
}

// ===== Information Extractor =====
export function InformationExtractorConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const outputSchema = (config.outputSchema as Array<{ name: string; type: string; description: string; required?: boolean }>) ?? [];
  const mode = (config.mode as string) ?? "single_turn";

  const addField = () =>
    onChange({
      ...config,
      outputSchema: [...outputSchema, { name: "", type: "string", description: "", required: true }],
    });

  const removeField = (i: number) =>
    onChange({ ...config, outputSchema: outputSchema.filter((_, idx) => idx !== i) });

  const updateField = (i: number, key: string, val: string | boolean) => {
    const updated = outputSchema.map((f, idx) => (idx === i ? { ...f, [key]: val } : f));
    onChange({ ...config, outputSchema: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Mode"
        value={mode}
        onChange={(v) => onChange({ ...config, mode: v })}
        options={[
          { value: "single_turn", label: "Single Turn" },
          { value: "multi_turn", label: "Multi Turn (Conversation)" },
        ]}
      />
      <LlmConfigSelector
        value={(config.llmConfigId as string) ?? ""}
        onChange={(v) => onChange({ ...config, llmConfigId: v })}
      />
      <ExpressionInput
        label="Model Override"
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder="Leave empty for provider default"
      />
      {mode !== "multi_turn" && (
        <ExpressionInput
          label="Input Field"
          value={(config.inputField as string) ?? ""}
          onChange={(v) => onChange({ ...config, inputField: v })}
          placeholder="{{ $input.text }}"
        />
      )}
      <ExpressionInput multiline
        label="Instructions"
        value={(config.instructions as string) ?? ""}
        onChange={(v) => onChange({ ...config, instructions: v })}
        placeholder="Extraction guidelines..."
        rows={3}
      />
      <SectionTitle>Output Schema</SectionTitle>
      {outputSchema.map((field, i) => {
        const isRequired = field.required !== false;
        return (
          <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Field {i + 1} · {isRequired ? "required" : "optional"}
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeField(i)}>
                <X size={10} />
              </Button>
            </div>
            <Input
              value={field.name}
              onChange={(e) => updateField(i, "name", e.target.value)}
              placeholder="Field name"
              className="h-7 text-xs"
            />
            <select
              value={field.type}
              onChange={(e) => updateField(i, "type", e.target.value)}
              className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
            >
              <option value="string">String</option>
              <option value="number">Number</option>
              <option value="boolean">Boolean</option>
              <option value="array">Array</option>
              <option value="object">Object</option>
            </select>
            <Input
              value={field.description}
              onChange={(e) => updateField(i, "description", e.target.value)}
              placeholder="Field description"
              className="h-7 text-xs"
            />
            <CheckboxField
              label="Required"
              checked={isRequired}
              onChange={(v) => updateField(i, "required", v)}
            />
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addField}>
        <Plus size={12} className="mr-1" /> Add Field
      </Button>
      {mode === "multi_turn" && (
        <>
          <SectionTitle>Multi Turn Settings</SectionTitle>
          <NumberField
            label="Max Turns"
            value={(config.maxTurns as number) ?? 10}
            onChange={(v) => onChange({ ...config, maxTurns: v })}
            min={0}
            hint="0 = unlimited"
          />
        </>
      )}
    </div>
  );
}
