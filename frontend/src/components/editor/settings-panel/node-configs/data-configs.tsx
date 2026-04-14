import { SelectField, TextAreaField } from "./shared";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

export { TransformConfig } from "./transform";

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
