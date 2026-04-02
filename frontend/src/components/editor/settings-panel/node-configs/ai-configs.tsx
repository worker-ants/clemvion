"use client";

import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== AI Agent =====
export function AiAgentConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label="Model"
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder="e.g. gpt-4, claude-3-opus"
      />
      <ExpressionInput multiline
        label="System Prompt"
        value={(config.systemPrompt as string) ?? ""}
        onChange={(v) => onChange({ ...config, systemPrompt: v })}
        placeholder="You are a helpful assistant..."
        rows={4}
        hint="Supports markdown and expressions"
      />
      <ExpressionInput multiline
        label="User Prompt"
        value={(config.userPrompt as string) ?? ""}
        onChange={(v) => onChange({ ...config, userPrompt: v })}
        placeholder="{{ $input.question }}"
        rows={3}
        hint="Expression to build the user message"
      />
      <SelectField
        label="Response Format"
        value={(config.responseFormat as string) ?? "text"}
        onChange={(v) => onChange({ ...config, responseFormat: v })}
        options={[
          { value: "text", label: "Text" },
          { value: "json", label: "JSON" },
        ]}
      />
      {(config.responseFormat as string) === "json" && (
        <ExpressionInput multiline
          label="JSON Schema"
          value={(config.jsonSchema as string) ?? ""}
          onChange={(v) => onChange({ ...config, jsonSchema: v })}
          placeholder='{"type": "object", "properties": {...}}'
          mono
          rows={4}
        />
      )}
      <SectionTitle>Advanced</SectionTitle>
      <NumberField
        label="Temperature"
        value={(config.temperature as number) ?? 0.7}
        onChange={(v) => onChange({ ...config, temperature: v })}
        min={0}
        max={2}
        hint="0 = deterministic, 2 = creative"
      />
      <NumberField
        label="Max Tokens"
        value={(config.maxTokens as number) ?? 4096}
        onChange={(v) => onChange({ ...config, maxTokens: v })}
        min={1}
      />
      <NumberField
        label="Max Tool Calls"
        value={(config.maxToolCalls as number) ?? 10}
        onChange={(v) => onChange({ ...config, maxToolCalls: v })}
        min={1}
        max={50}
      />
      <SelectField
        label="Conversation History"
        value={(config.conversationHistory as string) ?? "none"}
        onChange={(v) => onChange({ ...config, conversationHistory: v })}
        options={[
          { value: "none", label: "None" },
          { value: "last_n", label: "Last N Messages" },
          { value: "full", label: "Full History" },
        ]}
      />
      {(config.conversationHistory as string) === "last_n" && (
        <NumberField
          label="History Count"
          value={(config.historyCount as number) ?? 10}
          onChange={(v) => onChange({ ...config, historyCount: v })}
          min={1}
        />
      )}
    </div>
  );
}

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
      <ExpressionInput
        label="Model"
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder="e.g. gpt-4"
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
  const outputSchema = (config.outputSchema as Array<{ name: string; type: string; description: string; required: boolean }>) ?? [];

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
      <ExpressionInput
        label="Model"
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder="e.g. gpt-4"
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
        placeholder="Extraction guidelines..."
        rows={3}
      />
      <SectionTitle>Output Schema</SectionTitle>
      {outputSchema.map((field, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Field {i + 1}</span>
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
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addField}>
        <Plus size={12} className="mr-1" /> Add Field
      </Button>
    </div>
  );
}
