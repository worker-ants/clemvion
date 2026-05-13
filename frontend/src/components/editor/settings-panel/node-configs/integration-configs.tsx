import { FieldGroup, SelectField, NumberField, CheckboxField, KeyValueEditor } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { IntegrationSelector } from "./integration-selector";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

function coerceRecipients(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === "string");
  }
  if (typeof value === "string") {
    return value.split(",").map((s) => s.trim()).filter(Boolean);
  }
  return [];
}

function RecipientList({
  label,
  value,
  onChange,
  placeholder,
  hint,
}: {
  label: string;
  value: unknown;
  onChange: (next: string[]) => void;
  placeholder?: string;
  hint?: string;
}) {
  const t = useT();
  const items = coerceRecipients(value);
  const itemLabel = t("nodeConfigs.integration.recipientItemLabel");
  const itemLabelLower = t("nodeConfigs.integration.recipientItemLabelLower");

  const update = (idx: number, next: string) =>
    onChange(items.map((v, i) => (i === idx ? next : v)));
  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));
  const add = () => onChange([...items, ""]);

  return (
    <FieldGroup label={label} hint={hint}>
      <div className="flex flex-col gap-2">
        {items.map((item, i) => (
          <div key={`recipient-${i}`} className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <ExpressionInput
                bare
                label=""
                value={item}
                onChange={(v) => update(i, v)}
                placeholder={placeholder}
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 shrink-0"
              onClick={() => remove(i)}
              aria-label={t("nodeConfigs.autoForm.removeItemAria", { label: itemLabel })}
            >
              <X size={12} />
            </Button>
          </div>
        ))}
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs self-start"
          onClick={add}
        >
          <Plus size={12} className="mr-1" />
          {t("nodeConfigs.autoForm.addItem", { label: itemLabelLower })}
        </Button>
      </div>
    </FieldGroup>
  );
}

// ===== HTTP Request =====
export function HttpRequestConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const headers = (config.headers as Array<{ key: string; value: string }>) ?? [];
  const queryParams = (config.queryParams as Array<{ key: string; value: string }>) ?? [];
  const authentication = (config.authentication as string) ?? "none";

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.integration.method")}
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
        label={t("nodeConfigs.integration.url")}
        value={(config.url as string) ?? ""}
        onChange={(v) => onChange({ ...config, url: v })}
        placeholder={t("nodeConfigs.integration.urlPlaceholder")}
        hint={t("nodeConfigs.integration.urlHint")}
      />
      <SelectField
        label={t("nodeConfigs.integration.authentication")}
        value={authentication}
        onChange={(v) =>
          onChange({
            ...config,
            authentication: v,
            integrationId: v === "integration" ? config.integrationId : undefined,
          })
        }
        options={[
          { value: "none", label: t("nodeConfigs.integration.authNone") },
          { value: "integration", label: t("nodeConfigs.integration.authIntegration") },
          { value: "custom", label: t("nodeConfigs.integration.authCustom") },
        ]}
      />
      {authentication === "integration" && (
        <IntegrationSelector
          label={t("nodeConfigs.integration.integrationLabel")}
          value={(config.integrationId as string) ?? ""}
          onChange={(v) => onChange({ ...config, integrationId: v })}
          serviceTypes={["http"]}
          serviceDisplayName={t("nodeConfigs.integration.httpLabel")}
        />
      )}
      <KeyValueEditor
        label={t("nodeConfigs.integration.headers")}
        items={headers}
        onChange={(items) => onChange({ ...config, headers: items })}
        keyPlaceholder={t("nodeConfigs.integration.headerName")}
        valuePlaceholder={t("nodeConfigs.integration.headerValue")}
        expressionValues
      />
      <KeyValueEditor
        label={t("nodeConfigs.integration.queryParams")}
        items={queryParams}
        onChange={(items) => onChange({ ...config, queryParams: items })}
        keyPlaceholder={t("nodeConfigs.integration.paramName")}
        valuePlaceholder={t("nodeConfigs.integration.paramValue")}
        expressionValues
      />
      <SelectField
        label={t("nodeConfigs.integration.bodyType")}
        value={(config.bodyType as string) ?? "json"}
        onChange={(v) => onChange({ ...config, bodyType: v })}
        options={[
          { value: "json", label: t("nodeConfigs.integration.bodyJson") },
          { value: "form-data", label: t("nodeConfigs.integration.bodyFormData") },
          { value: "x-www-form-urlencoded", label: t("nodeConfigs.integration.bodyUrlEncoded") },
          { value: "raw", label: t("nodeConfigs.integration.bodyRaw") },
        ]}
      />
      <ExpressionInput
        label={t("nodeConfigs.integration.body")}
        value={(config.body as string) ?? ""}
        onChange={(v) => onChange({ ...config, body: v })}
        placeholder={t("nodeConfigs.integration.bodyPlaceholder")}
        mono
        multiline
        rows={5}
      />
      <SelectField
        label={t("nodeConfigs.integration.responseType")}
        value={(config.responseType as string) ?? "json"}
        onChange={(v) => onChange({ ...config, responseType: v })}
        options={[
          { value: "json", label: t("nodeConfigs.integration.respJson") },
          { value: "text", label: t("nodeConfigs.integration.respText") },
          { value: "binary", label: t("nodeConfigs.integration.respBinary") },
        ]}
      />
      <NumberField
        label={t("nodeConfigs.integration.timeoutMs")}
        value={(config.timeout as number) ?? 30000}
        onChange={(v) => onChange({ ...config, timeout: v })}
        min={1000}
        max={300000}
      />
      <CheckboxField
        label={t("nodeConfigs.integration.followRedirects")}
        checked={(config.followRedirects as boolean) ?? true}
        onChange={(v) => onChange({ ...config, followRedirects: v })}
      />
    </div>
  );
}

// ===== Database Query =====
export function DatabaseQueryConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <IntegrationSelector
        label={t("nodeConfigs.integration.integrationLabel")}
        value={(config.integrationId as string) ?? ""}
        onChange={(v) => onChange({ ...config, integrationId: v })}
        serviceTypes={["database"]}
        serviceDisplayName="Database"
      />
      <SelectField
        label={t("nodeConfigs.integration.queryType")}
        value={(config.queryType as string) ?? "select"}
        onChange={(v) => onChange({ ...config, queryType: v })}
        options={[
          { value: "select", label: t("nodeConfigs.integration.qtSelect") },
          { value: "insert", label: t("nodeConfigs.integration.qtInsert") },
          { value: "update", label: t("nodeConfigs.integration.qtUpdate") },
          { value: "delete", label: t("nodeConfigs.integration.qtDelete") },
          { value: "raw", label: t("nodeConfigs.integration.qtRaw") },
        ]}
      />
      <ExpressionInput
        label={t("nodeConfigs.integration.query")}
        value={(config.query as string) ?? ""}
        onChange={(v) => onChange({ ...config, query: v })}
        placeholder={t("nodeConfigs.integration.queryPlaceholder")}
        mono
        multiline
        rows={5}
        hint={t("nodeConfigs.integration.queryHint")}
      />
      <ExpressionInput
        label={t("nodeConfigs.integration.parameters")}
        value={(config.parameters as string) ?? ""}
        onChange={(v) => onChange({ ...config, parameters: v })}
        placeholder={t("nodeConfigs.integration.parametersPlaceholder")}
        mono
        multiline
        rows={2}
        hint={t("nodeConfigs.integration.parametersHint")}
      />
    </div>
  );
}

// ===== Cafe24 =====
const CAFE24_RESOURCES: ReadonlyArray<{ value: string; label: string }> = [
  { value: "store", label: "Store (상점)" },
  { value: "product", label: "Product (상품)" },
  { value: "order", label: "Order (주문)" },
  { value: "customer", label: "Customer (회원)" },
  { value: "community", label: "Community (게시판)" },
  { value: "design", label: "Design (디자인)" },
  { value: "promotion", label: "Promotion (프로모션)" },
  { value: "application", label: "Application (앱 관리)" },
  { value: "category", label: "Category (상품분류)" },
  { value: "collection", label: "Collection (판매분류)" },
  { value: "supply", label: "Supply (공급사)" },
  { value: "shipping", label: "Shipping (배송)" },
  { value: "salesreport", label: "Salesreport (매출통계)" },
  { value: "personal", label: "Personal (개인화)" },
  { value: "privacy", label: "Privacy (개인정보)" },
  { value: "mileage", label: "Mileage (적립금)" },
  { value: "notification", label: "Notification (알림)" },
  { value: "translation", label: "Translation (번역)" },
];

function normalizeCafe24Fields(
  raw: unknown,
): Array<{ key: string; value: string }> {
  // The handler reads `config.fields` as a flat object (Record<string,
  // unknown>), but the UI maintains a list of {key, value} pairs for
  // ergonomic editing. Accept both shapes so the panel doesn't crash on
  // its second render — the prior version would do `.map()` against the
  // object form after the first edit and throw at runtime.
  if (Array.isArray(raw)) {
    return raw
      .filter(
        (e): e is { key: string; value: string } =>
          !!e && typeof e === "object" && "key" in e && "value" in e,
      )
      .map((e) => ({ key: String(e.key), value: String(e.value ?? "") }));
  }
  if (raw && typeof raw === "object") {
    return Object.entries(raw as Record<string, unknown>).map(([k, v]) => ({
      key: k,
      value: v === undefined || v === null ? "" : String(v),
    }));
  }
  return [];
}

export function Cafe24Config({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const fields = normalizeCafe24Fields(config.fields);
  const pagination = (config.pagination as { limit?: number; offset?: number } | undefined) ?? {};

  return (
    <div className="flex flex-col gap-3">
      <IntegrationSelector
        label={t("nodeConfigs.integration.integrationLabel")}
        value={(config.integrationId as string) ?? ""}
        onChange={(v) => onChange({ ...config, integrationId: v })}
        serviceTypes={["cafe24"]}
        serviceDisplayName="Cafe24"
      />
      <SelectField
        label="Resource"
        value={(config.resource as string) ?? ""}
        onChange={(v) =>
          // Reset operation when resource changes — the previous opId is
          // unlikely to belong to the new resource's metadata.
          onChange({ ...config, resource: v, operation: "" })
        }
        options={[
          { value: "", label: "— Select resource —" },
          ...CAFE24_RESOURCES,
        ]}
      />
      <ExpressionInput
        label="Operation"
        value={(config.operation as string) ?? ""}
        onChange={(v) => onChange({ ...config, operation: v })}
        placeholder="e.g. product_list, order_get, customer_update"
        hint="Operation id from spec/conventions/cafe24-api-metadata.md (e.g. product_list, product_get, product_update, order_list, ...)"
      />
      <KeyValueEditor
        label="Fields"
        items={fields.map((f) => ({ key: f.key, value: f.value }))}
        onChange={(items) => {
          // Translate KeyValue back to a plain object so the backend
          // schema (which expects Record<string, unknown>) is happy.
          const obj: Record<string, string> = {};
          for (const it of items) {
            if (it.key) obj[it.key] = it.value;
          }
          // Persist BOTH the keyvalue list (for UI round-trip) and the
          // resolved object form. The handler reads `config.fields` as
          // an object; the UI maintains it as a list for ergonomic editing.
          onChange({ ...config, fields: obj });
        }}
        keyPlaceholder="shop_no, product_no, ..."
        valuePlaceholder="value or {{ $input.x }}"
        expressionValues
      />
      <FieldGroup label="Pagination (optional)" hint="Used when the chosen operation is paginated">
        <div className="flex gap-3">
          <NumberField
            label="Limit"
            value={pagination.limit ?? 50}
            onChange={(v) =>
              onChange({
                ...config,
                pagination: { ...pagination, limit: v },
              })
            }
            min={1}
            max={500}
          />
          <NumberField
            label="Offset"
            value={pagination.offset ?? 0}
            onChange={(v) =>
              onChange({
                ...config,
                pagination: { ...pagination, offset: v },
              })
            }
            min={0}
          />
        </div>
      </FieldGroup>
    </div>
  );
}

// ===== Send Email =====
export function SendEmailConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <IntegrationSelector
        label={t("nodeConfigs.integration.integrationLabel")}
        value={(config.integrationId as string) ?? ""}
        onChange={(v) => onChange({ ...config, integrationId: v })}
        serviceTypes={["email"]}
        serviceDisplayName="Email"
      />
      <RecipientList
        label={t("nodeConfigs.integration.to")}
        value={config.to}
        onChange={(v) => onChange({ ...config, to: v })}
        placeholder={t("nodeConfigs.integration.toPlaceholder")}
        hint={t("nodeConfigs.integration.toHint")}
      />
      <RecipientList
        label={t("nodeConfigs.integration.cc")}
        value={config.cc}
        onChange={(v) => onChange({ ...config, cc: v })}
        placeholder={t("nodeConfigs.integration.ccPlaceholder")}
        hint={t("nodeConfigs.integration.ccHint")}
      />
      <RecipientList
        label={t("nodeConfigs.integration.bcc")}
        value={config.bcc}
        onChange={(v) => onChange({ ...config, bcc: v })}
        placeholder={t("nodeConfigs.integration.bccPlaceholder")}
        hint={t("nodeConfigs.integration.bccHint")}
      />
      <ExpressionInput
        label={t("nodeConfigs.integration.subject")}
        value={(config.subject as string) ?? ""}
        onChange={(v) => onChange({ ...config, subject: v })}
        placeholder={t("nodeConfigs.integration.subjectPlaceholder")}
      />
      <SelectField
        label={t("nodeConfigs.integration.bodyType")}
        value={(config.bodyType as string) ?? "html"}
        onChange={(v) => onChange({ ...config, bodyType: v })}
        options={[
          { value: "html", label: t("nodeConfigs.integration.bodyHtml") },
          { value: "text", label: t("nodeConfigs.integration.bodyPlain") },
        ]}
      />
      <ExpressionInput multiline
        label={t("nodeConfigs.integration.body")}
        value={(config.body as string) ?? ""}
        onChange={(v) => onChange({ ...config, body: v })}
        placeholder={t("nodeConfigs.integration.emailContentPlaceholder")}
        rows={6}
      />
    </div>
  );
}
