import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { LabelWithHelp } from "./shared/field-help";
import { DOCS } from "@/lib/docs/links";
import { ExpressionInput } from "@/components/editor/expression";
import { LlmConfigSelector } from "@/components/llm-config/llm-config-selector";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Text Classifier =====
export function TextClassifierConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
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
        label={t("nodeConfigs.ai.modelOverride")}
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder={t("nodeConfigs.ai.modelOverrideHint")}
      />
      <ExpressionInput
        label={t("nodeConfigs.ai.inputField")}
        value={(config.inputField as string) ?? ""}
        onChange={(v) => onChange({ ...config, inputField: v })}
        placeholder={t("nodeConfigs.ai.inputFieldDefault")}
      />
      <ExpressionInput multiline
        label={t("nodeConfigs.ai.instructions")}
        value={(config.instructions as string) ?? ""}
        onChange={(v) => onChange({ ...config, instructions: v })}
        placeholder={t("nodeConfigs.ai.classifyPlaceholder")}
        rows={3}
      />
      <CheckboxField
        label={
          <LabelWithHelp
            text={t("nodeConfigs.ai.includeConfidence")}
            help={{
              summary: t("nodeConfigs.ai.includeConfidenceHint"),
              docsHref: DOCS.nodes.ai,
            }}
          />
        }
        checked={(config.includeConfidence as boolean) ?? true}
        onChange={(v) => onChange({ ...config, includeConfidence: v })}
      />
      <CheckboxField
        label={
          <LabelWithHelp
            text={t("nodeConfigs.ai.multiLabel")}
            help={{
              summary: t("nodeConfigs.ai.multiLabelHint"),
              docsHref: DOCS.nodes.ai,
            }}
          />
        }
        checked={(config.multiLabel as boolean) ?? false}
        onChange={(v) => onChange({ ...config, multiLabel: v })}
      />
      <SectionTitle>{t("nodeConfigs.ai.categories")}</SectionTitle>
      {categories.map((cat, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.ai.categoryLabel", { index: i + 1 })}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeCategory(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={cat.name}
            onChange={(e) => updateCategory(i, "name", e.target.value)}
            placeholder={t("nodeConfigs.ai.categoryNamePlaceholder")}
            className="h-7 text-xs"
          />
          <Input
            value={cat.description}
            onChange={(e) => updateCategory(i, "description", e.target.value)}
            placeholder={t("nodeConfigs.ai.llmDescriptionPlaceholder")}
            className="h-7 text-xs"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addCategory}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.ai.addCategory")}
      </Button>
    </div>
  );
}

// ===== Information Extractor =====
export function InformationExtractorConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
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
        label={
          <LabelWithHelp
            text={t("nodeConfigs.ai.mode")}
            help={{
              summary: t("nodeConfigs.ai.modeHint"),
              docsHref: DOCS.nodes.ai,
            }}
          />
        }
        value={mode}
        onChange={(v) => onChange({ ...config, mode: v })}
        options={[
          { value: "single_turn", label: t("nodeConfigs.ai.singleTurn") },
          { value: "multi_turn", label: t("nodeConfigs.ai.multiTurn") },
        ]}
      />
      <LlmConfigSelector
        value={(config.llmConfigId as string) ?? ""}
        onChange={(v) => onChange({ ...config, llmConfigId: v })}
      />
      <ExpressionInput
        label={t("nodeConfigs.ai.modelOverride")}
        value={(config.model as string) ?? ""}
        onChange={(v) => onChange({ ...config, model: v })}
        placeholder={t("nodeConfigs.ai.modelOverrideHint")}
      />
      {mode !== "multi_turn" && (
        <ExpressionInput
          label={t("nodeConfigs.ai.inputField")}
          value={(config.inputField as string) ?? ""}
          onChange={(v) => onChange({ ...config, inputField: v })}
          placeholder={t("nodeConfigs.ai.inputFieldDefault")}
        />
      )}
      <ExpressionInput multiline
        label={t("nodeConfigs.ai.instructions")}
        value={(config.instructions as string) ?? ""}
        onChange={(v) => onChange({ ...config, instructions: v })}
        placeholder={t("nodeConfigs.ai.extractionGuidelines")}
        rows={3}
      />
      <SectionTitle>{t("nodeConfigs.ai.outputSchema")}</SectionTitle>
      {outputSchema.map((field, i) => {
        const isRequired = field.required !== false;
        return (
          <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {t("nodeConfigs.ai.fieldLabel", {
                  index: i + 1,
                  state: isRequired ? t("nodeConfigs.ai.stateRequired") : t("nodeConfigs.ai.stateOptional"),
                })}
              </span>
              <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeField(i)}>
                <X size={10} />
              </Button>
            </div>
            <Input
              value={field.name}
              onChange={(e) => updateField(i, "name", e.target.value)}
              placeholder={t("nodeConfigs.ai.fieldNamePlaceholder")}
              className="h-7 text-xs"
            />
            <select
              value={field.type}
              onChange={(e) => updateField(i, "type", e.target.value)}
              className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
            >
              <option value="string">{t("nodeConfigs.ai.typeString")}</option>
              <option value="number">{t("nodeConfigs.ai.typeNumber")}</option>
              <option value="boolean">{t("nodeConfigs.ai.typeBoolean")}</option>
              <option value="array">{t("nodeConfigs.ai.typeArray")}</option>
              <option value="object">{t("nodeConfigs.ai.typeObject")}</option>
            </select>
            <Input
              value={field.description}
              onChange={(e) => updateField(i, "description", e.target.value)}
              placeholder={t("nodeConfigs.ai.fieldDescriptionPlaceholder")}
              className="h-7 text-xs"
            />
            <CheckboxField
              label={t("nodeConfigs.ai.requiredChk")}
              checked={isRequired}
              onChange={(v) => updateField(i, "required", v)}
            />
          </div>
        );
      })}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addField}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.ai.addField")}
      </Button>
      {mode === "multi_turn" && (
        <>
          <SectionTitle>{t("nodeConfigs.ai.multiTurnSettings")}</SectionTitle>
          <NumberField
            label={
              <LabelWithHelp
                text={t("nodeConfigs.ai.maxTurns")}
                help={{
                  summary: t("nodeConfigs.ai.maxTurnsHint"),
                  docsHref: DOCS.nodes.ai,
                }}
              />
            }
            value={(config.maxTurns as number) ?? 10}
            onChange={(v) => onChange({ ...config, maxTurns: v })}
            min={0}
            hint={t("nodeConfigs.ai.unlimitedHint")}
          />
        </>
      )}
    </div>
  );
}
