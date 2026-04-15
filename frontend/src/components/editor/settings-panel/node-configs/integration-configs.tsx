import { SelectField, NumberField, CheckboxField, KeyValueEditor } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { IntegrationSelector } from "./integration-selector";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== HTTP Request =====
export function HttpRequestConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const headers = (config.headers as Array<{ key: string; value: string }>) ?? [];
  const queryParams = (config.queryParams as Array<{ key: string; value: string }>) ?? [];
  const authentication = (config.authentication as string) ?? "none";

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Method"
        value={(config.method as string) ?? "GET"}
        onChange={(v) => onChange({ ...config, method: v })}
        options={[
          { value: "GET", label: "GET" },
          { value: "POST", label: "POST" },
          { value: "PUT", label: "PUT" },
          { value: "PATCH", label: "PATCH" },
          { value: "DELETE", label: "DELETE" },
          { value: "HEAD", label: "HEAD" },
          { value: "OPTIONS", label: "OPTIONS" },
        ]}
      />
      <ExpressionInput
        label="URL"
        value={(config.url as string) ?? ""}
        onChange={(v) => onChange({ ...config, url: v })}
        placeholder="https://api.example.com/endpoint"
        hint="Supports expressions: {{ $input.url }}"
      />
      <SelectField
        label="Authentication"
        value={authentication}
        onChange={(v) =>
          onChange({
            ...config,
            authentication: v,
            integrationId: v === "integration" ? config.integrationId : undefined,
          })
        }
        options={[
          { value: "none", label: "None" },
          { value: "integration", label: "Integration" },
          { value: "custom", label: "Custom" },
        ]}
      />
      {authentication === "integration" && (
        <IntegrationSelector
          label="Integration"
          value={(config.integrationId as string) ?? ""}
          onChange={(v) => onChange({ ...config, integrationId: v })}
          serviceTypes={["http"]}
          serviceDisplayName="HTTP"
        />
      )}
      <KeyValueEditor
        label="Headers"
        items={headers}
        onChange={(items) => onChange({ ...config, headers: items })}
        keyPlaceholder="Header name"
        valuePlaceholder="Header value"
        expressionValues
      />
      <KeyValueEditor
        label="Query Parameters"
        items={queryParams}
        onChange={(items) => onChange({ ...config, queryParams: items })}
        keyPlaceholder="Param name"
        valuePlaceholder="Param value"
        expressionValues
      />
      <SelectField
        label="Body Type"
        value={(config.bodyType as string) ?? "json"}
        onChange={(v) => onChange({ ...config, bodyType: v })}
        options={[
          { value: "json", label: "JSON" },
          { value: "form-data", label: "Form Data" },
          { value: "x-www-form-urlencoded", label: "URL Encoded" },
          { value: "raw", label: "Raw" },
        ]}
      />
      <ExpressionInput
        label="Body"
        value={(config.body as string) ?? ""}
        onChange={(v) => onChange({ ...config, body: v })}
        placeholder='{"key": "value"}'
        mono
        multiline
        rows={5}
      />
      <SelectField
        label="Response Type"
        value={(config.responseType as string) ?? "json"}
        onChange={(v) => onChange({ ...config, responseType: v })}
        options={[
          { value: "json", label: "JSON" },
          { value: "text", label: "Text" },
          { value: "binary", label: "Binary" },
        ]}
      />
      <NumberField
        label="Timeout (ms)"
        value={(config.timeout as number) ?? 30000}
        onChange={(v) => onChange({ ...config, timeout: v })}
        min={1000}
        max={300000}
      />
      <CheckboxField
        label="Follow Redirects"
        checked={(config.followRedirects as boolean) ?? true}
        onChange={(v) => onChange({ ...config, followRedirects: v })}
      />
    </div>
  );
}

// ===== Database Query =====
export function DatabaseQueryConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <IntegrationSelector
        label="Integration"
        value={(config.integrationId as string) ?? ""}
        onChange={(v) => onChange({ ...config, integrationId: v })}
        serviceTypes={["database"]}
        serviceDisplayName="Database"
      />
      <SelectField
        label="Query Type"
        value={(config.queryType as string) ?? "select"}
        onChange={(v) => onChange({ ...config, queryType: v })}
        options={[
          { value: "select", label: "SELECT" },
          { value: "insert", label: "INSERT" },
          { value: "update", label: "UPDATE" },
          { value: "delete", label: "DELETE" },
          { value: "raw", label: "Raw SQL" },
        ]}
      />
      <ExpressionInput
        label="Query"
        value={(config.query as string) ?? ""}
        onChange={(v) => onChange({ ...config, query: v })}
        placeholder="SELECT * FROM users WHERE id = $1"
        mono
        multiline
        rows={5}
        hint="Use $1, $2, ... for parameters"
      />
      <ExpressionInput
        label="Parameters"
        value={(config.parameters as string) ?? ""}
        onChange={(v) => onChange({ ...config, parameters: v })}
        placeholder='["value1", "value2"]'
        mono
        multiline
        rows={2}
        hint="JSON array of parameter values"
      />
    </div>
  );
}

// ===== Send Email =====
export function SendEmailConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <IntegrationSelector
        label="Integration"
        value={(config.integrationId as string) ?? ""}
        onChange={(v) => onChange({ ...config, integrationId: v })}
        serviceTypes={["email"]}
        serviceDisplayName="Email"
      />
      <ExpressionInput
        label="To"
        value={(config.to as string) ?? ""}
        onChange={(v) => onChange({ ...config, to: v })}
        placeholder="recipient@example.com, other@example.com"
        hint="Comma-separated addresses, or an expression that resolves to a string or array"
      />
      <ExpressionInput
        label="CC"
        value={(config.cc as string) ?? ""}
        onChange={(v) => onChange({ ...config, cc: v })}
        placeholder="cc@example.com"
        hint="Optional. Same format as To."
      />
      <ExpressionInput
        label="Subject"
        value={(config.subject as string) ?? ""}
        onChange={(v) => onChange({ ...config, subject: v })}
        placeholder="Email subject"
      />
      <SelectField
        label="Body Type"
        value={(config.bodyType as string) ?? "html"}
        onChange={(v) => onChange({ ...config, bodyType: v })}
        options={[
          { value: "html", label: "HTML" },
          { value: "text", label: "Plain Text" },
        ]}
      />
      <ExpressionInput multiline
        label="Body"
        value={(config.body as string) ?? ""}
        onChange={(v) => onChange({ ...config, body: v })}
        placeholder="Email content..."
        rows={6}
      />
    </div>
  );
}
