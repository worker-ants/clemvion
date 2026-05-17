import { SelectField, TextAreaField } from "./shared";
import { useT } from "@/lib/i18n";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

export { TransformConfig } from "./transform";

// ===== Code =====
export function CodeConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.data.language")}
        value={(config.language as string) ?? "javascript"}
        onChange={(v) => onChange({ ...config, language: v })}
        options={[{ value: "javascript", label: t("nodeConfigs.data.languageJs") }]}
      />
      <TextAreaField
        label={t("nodeConfigs.data.code")}
        value={(config.code as string) ?? ""}
        onChange={(v) => onChange({ ...config, code: v })}
        placeholder={t("nodeConfigs.data.codePlaceholder")}
        mono
        rows={12}
        hint={t("nodeConfigs.data.codeHint")}
      />
    </div>
  );
}
