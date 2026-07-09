import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import { SectionTitle } from "./shared";
import { useT } from "@/lib/i18n";
import type { TriggerParameterDefinition } from "@/lib/api/triggers";

type Config = Record<string, unknown>;
type OnChange = (c: Config) => void;

// Mirror of the backend identifier rule (resolve-trigger-parameters.ts). A name
// that fails this is rejected by the save-time gate (validateManualTrigger), so
// flag it inline here to give immediate feedback instead of a save-time 400.
const PARAM_NAME_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;

export function ManualTriggerConfig({
  config,
  onChange,
}: {
  config: Config;
  onChange: OnChange;
}) {
  const t = useT();
  const parameters = (config.parameters as TriggerParameterDefinition[]) ?? [];

  const nameCounts = parameters.reduce<Record<string, number>>((acc, p) => {
    if (p.name) acc[p.name] = (acc[p.name] ?? 0) + 1;
    return acc;
  }, {});

  const nameError = (p: TriggerParameterDefinition): string | null => {
    if (!p.name) return t("nodeConfigs.trigger.errorNameRequired");
    if (!PARAM_NAME_RE.test(p.name))
      return t("nodeConfigs.trigger.errorNameInvalid");
    if ((nameCounts[p.name] ?? 0) > 1)
      return t("nodeConfigs.trigger.errorNameDuplicate");
    return null;
  };

  const addParameter = () =>
    onChange({
      ...config,
      parameters: [
        ...parameters,
        { name: "", type: "string", required: false, defaultValue: "", description: "" },
      ],
    });

  const removeParameter = (i: number) =>
    onChange({
      ...config,
      parameters: parameters.filter((_, idx) => idx !== i),
    });

  const updateParameter = (
    i: number,
    key: keyof TriggerParameterDefinition,
    val: unknown,
  ) => {
    const updated = parameters.map((p, idx) =>
      idx === i ? { ...p, [key]: val } : p,
    );
    onChange({ ...config, parameters: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>{t("nodeConfigs.trigger.inputParameters")}</SectionTitle>
      <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.trigger.inputParametersHint")}
      </span>
      {parameters.map((p, i) => {
        const nameErr = nameError(p);
        return (
          <div
            key={i}
            className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2"
          >
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {t("nodeConfigs.trigger.parameterLabel", { index: i + 1 })}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeParameter(i)}
                aria-label={t("nodeConfigs.trigger.removeParameterAria", { index: i + 1 })}
              >
                <X size={10} />
              </Button>
            </div>
            <Input
              value={p.name}
              onChange={(e) => updateParameter(i, "name", e.target.value)}
              placeholder={t("nodeConfigs.trigger.parameterNamePlaceholder")}
              aria-invalid={nameErr !== null}
              className={cn(
                "h-7 text-xs",
                nameErr && "border-red-500 focus-visible:ring-red-500",
              )}
            />
            {nameErr && (
              <span className="text-[10px] text-red-500">{nameErr}</span>
            )}
          <select
            value={p.type}
            onChange={(e) =>
              updateParameter(i, "type", e.target.value as TriggerParameterDefinition["type"])
            }
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="string">{t("nodeConfigs.trigger.typeString")}</option>
            <option value="number">{t("nodeConfigs.trigger.typeNumber")}</option>
            <option value="boolean">{t("nodeConfigs.trigger.typeBoolean")}</option>
            <option value="array">{t("nodeConfigs.trigger.typeArray")}</option>
            <option value="object">{t("nodeConfigs.trigger.typeObject")}</option>
          </select>
          <label className="flex items-center gap-2 text-[11px]">
            <input
              type="checkbox"
              checked={p.required === true}
              onChange={(e) => updateParameter(i, "required", e.target.checked)}
              className="h-3 w-3 rounded border-[hsl(var(--input))]"
            />
            {t("nodeConfigs.trigger.requiredChk")}
          </label>
          {p.required !== true && (
            <Input
              value={String(p.defaultValue ?? "")}
              onChange={(e) => updateParameter(i, "defaultValue", e.target.value)}
              placeholder={t("nodeConfigs.trigger.defaultValuePlaceholder")}
              className="h-7 text-xs"
            />
          )}
          <Input
            value={p.description ?? ""}
            onChange={(e) => updateParameter(i, "description", e.target.value)}
            placeholder={t("nodeConfigs.trigger.descriptionPlaceholder")}
            className="h-7 text-xs"
          />
          </div>
        );
      })}
      <Button
        variant="outline"
        size="sm"
        className="h-7 text-xs"
        onClick={addParameter}
      >
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.trigger.addParameter")}
      </Button>
    </div>
  );
}
