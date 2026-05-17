import { FieldGroup, SelectField, NumberField, CheckboxField, KeyValueEditor } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { IntegrationSelector } from "./integration-selector";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";
import { useT } from "@/lib/i18n";
import { getNodeDefinition } from "@/lib/node-definitions";
import type {
  Cafe24NodeExtras,
  Cafe24OperationField,
  Cafe24PlannedOperation,
  Cafe24SupportedOperation,
} from "@/lib/node-definitions/types";

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
// Resource keys mirror Cafe24 Admin API resource names and double as
// translation keys under `nodeConfigs.integration.cafe24Resources.*`.
// Backend `Cafe24Resource` enum (`codebase/backend/src/nodes/integration/cafe24/metadata/types.ts`)
// and the catalog at `spec/conventions/cafe24-api-catalog/` must stay in sync
// with this list; `catalog-sync.spec.ts` guards the backend side.
const CAFE24_RESOURCE_KEYS = [
  "store",
  "product",
  "order",
  "customer",
  "community",
  "design",
  "promotion",
  "application",
  "category",
  "collection",
  "supply",
  "shipping",
  "salesreport",
  "personal",
  "privacy",
  "mileage",
  "notification",
  "translation",
] as const;
type Cafe24ResourceKey = (typeof CAFE24_RESOURCE_KEYS)[number];

/**
 * Read the cafe24 node definition's `extras` payload — supplied by the
 * backend through `GET /nodes/definitions` (see
 * `codebase/backend/src/nodes/integration/cafe24/metadata/public-meta.ts`). Returns
 * `null` when definitions haven't loaded yet (initial editor mount) or when
 * the node ships without extras (older backend). In both cases the form
 * degrades gracefully — Operation select shows a "definitions loading"
 * placeholder and Fields editor falls back to free-form text.
 */
function readCafe24Extras(): Cafe24NodeExtras | null {
  const def = getNodeDefinition("cafe24");
  const extras = def?.extras;
  if (!extras || typeof extras !== "object") return null;
  // The extras payload is shipped as Record<string, unknown> on
  // NodeDefinition (the typed surface is intentionally opaque per
  // `NodeDefinitionResponse.extras` JSDoc) — narrow here using a few
  // structural checks so callers can rely on the typed shape.
  const e = extras as Partial<Cafe24NodeExtras>;
  if (
    !e.operationsByResource ||
    !e.plannedByResource ||
    typeof e.operationsByResource !== "object" ||
    typeof e.plannedByResource !== "object"
  ) {
    return null;
  }
  return e as Cafe24NodeExtras;
}

/**
 * Convert the persisted `config.fields` shape (or any unknown input) to the
 * `{key, value}[]` form the editor renders. Accepts:
 *
 * - object → entries; `null`/`undefined` values become `""`.
 * - array of `{key, value}` → coerced to strings.
 * - anything else (including `null`, primitives) → empty list.
 *
 * Exported so the conversion can be exercised directly by unit tests.
 */
function readFieldValues(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (v === undefined || v === null) {
      out[k] = "";
    } else if (typeof v === "object") {
      out[k] = JSON.stringify(v);
    } else {
      out[k] = String(v);
    }
  }
  return out;
}

function pruneFieldsToOperation(
  values: Record<string, string>,
  op: Cafe24SupportedOperation | undefined,
): Record<string, string> {
  if (!op) return values;
  const known = new Set(op.fields.map((f) => f.name));
  const next: Record<string, string> = {};
  for (const [k, v] of Object.entries(values)) {
    if (known.has(k)) next[k] = v;
  }
  return next;
}

function findSupportedOperation(
  extras: Cafe24NodeExtras | null,
  resource: string,
  operation: string,
): Cafe24SupportedOperation | undefined {
  if (!extras || !resource || !operation) return undefined;
  const list = extras.operationsByResource[resource] as
    | Cafe24SupportedOperation[]
    | undefined;
  return list?.find((op) => op.id === operation);
}

function findPlannedOperation(
  extras: Cafe24NodeExtras | null,
  resource: string,
  operation: string,
): Cafe24PlannedOperation | undefined {
  if (!extras || !resource || !operation) return undefined;
  const list = extras.plannedByResource[resource] as
    | Cafe24PlannedOperation[]
    | undefined;
  return list?.find((op) => op.id === operation);
}

/**
 * One field row inside the dynamic Fields form. The value editor is always
 * an `ExpressionInput` so `{{ $input.x }}` expressions remain supported
 * everywhere (decided 2026-05-16). `enum` / `boolean` / `default` are
 * surfaced as hint text rather than specialised widgets so the
 * expression-input experience stays uniform.
 */
function Cafe24FieldRow({
  field,
  value,
  onChange,
  t,
}: {
  field: Cafe24OperationField;
  value: string;
  onChange: (next: string) => void;
  t: ReturnType<typeof useT>;
}) {
  const hintBits: string[] = [];
  if (field.description) hintBits.push(field.description);
  if (field.type === "enum" && field.enum && field.enum.length > 0) {
    hintBits.push(
      t("nodeConfigs.integration.cafe24FieldsEnumHint", {
        values: field.enum.join(" / "),
      }),
    );
  } else if (field.type === "boolean") {
    hintBits.push(t("nodeConfigs.integration.cafe24FieldsBooleanHint"));
  }
  if (field.default !== undefined) {
    hintBits.push(
      t("nodeConfigs.integration.cafe24FieldsDefaultHint", {
        value: String(field.default),
      }),
    );
  }
  return (
    <FieldGroup
      label={field.name}
      hint={hintBits.join(" · ") || undefined}
      required={field.required}
    >
      <ExpressionInput bare label="" value={value} onChange={onChange} />
    </FieldGroup>
  );
}

export function Cafe24Config({
  config,
  onChange,
}: {
  config: Config;
  onChange: OnChange;
}) {
  const t = useT();
  // Extras ship with `GET /nodes/definitions` (Phase 2). When they're not
  // available (definitions still loading on initial mount, or an older
  // backend that doesn't supply extras), `readCafe24Extras()` returns null
  // and we degrade gracefully — Operation select shows the planned/supported
  // catalog as soon as the store fills in.
  const extras = readCafe24Extras();

  const resource = (config.resource as string) ?? "";
  const operation = (config.operation as string) ?? "";
  const supportedOp = findSupportedOperation(extras, resource, operation);
  const plannedOp = findPlannedOperation(extras, resource, operation);
  const fieldValues = readFieldValues(config.fields);

  const pagination =
    (config.pagination as { limit?: number; offset?: number } | undefined) ?? {};

  const resourceOptions = [
    {
      value: "",
      label: t("nodeConfigs.integration.cafe24ResourceSelectPlaceholder"),
    },
    ...CAFE24_RESOURCE_KEYS.map((key: Cafe24ResourceKey) => ({
      value: key,
      label: t(`nodeConfigs.integration.cafe24Resources.${key}` as const),
    })),
  ];

  const supportedListForResource =
    (resource && extras?.operationsByResource[resource]) || [];
  const plannedListForResource =
    (resource && extras?.plannedByResource[resource]) || [];
  const plannedSuffix = t(
    "nodeConfigs.integration.cafe24OperationPlannedSuffix",
  );

  // Operation options combine supported (enabled) + planned (disabled).
  // Planned rows stay visible — but un-selectable — so users can see what's
  // coming next without trial-and-error.
  const operationOptions = !resource
    ? [
        {
          value: "",
          label: t(
            "nodeConfigs.integration.cafe24OperationSelectResourceFirst",
          ),
          disabled: true,
        },
      ]
    : [
        {
          value: "",
          label: t("nodeConfigs.integration.cafe24OperationSelectPlaceholder"),
        },
        ...supportedListForResource.map((op) => ({
          value: op.id,
          label: op.restrictedApproval
            ? `${op.label} ⚠ ${t("nodeConfigs.integration.cafe24OperationApprovalSuffix")}`
            : op.label,
        })),
        ...plannedListForResource.map((op) => ({
          value: op.id,
          label: `${op.label} ${plannedSuffix}`,
          disabled: true,
        })),
      ];

  const coverageHint =
    resource && extras
      ? t("nodeConfigs.integration.cafe24OperationCoverageHint", {
          supported: supportedListForResource.length,
          planned: plannedListForResource.length,
        })
      : undefined;

  const handleResourceChange = (next: string) => {
    // Resource change wipes the operation + fields so we never carry stale
    // state across unrelated APIs. The pagination block is conditional on
    // the next operation's `paginated` flag, so dropping `fields` is enough.
    onChange({ ...config, resource: next, operation: "", fields: {} });
  };

  const handleOperationChange = (nextOpId: string) => {
    const nextSupported = findSupportedOperation(extras, resource, nextOpId);
    const prunedFields = pruneFieldsToOperation(fieldValues, nextSupported);
    onChange({ ...config, operation: nextOpId, fields: prunedFields });
  };

  const handleFieldChange = (fieldName: string, nextValue: string) => {
    onChange({
      ...config,
      fields: { ...fieldValues, [fieldName]: nextValue },
    });
  };

  // Required-first ordering mirrors §2 of spec/4-nodes/4-integration/4-cafe24.md
  // — required must-fills surface above optional refinements.
  const requiredFields = supportedOp?.fields.filter((f) => f.required) ?? [];
  const optionalFields = supportedOp?.fields.filter((f) => !f.required) ?? [];

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
        label={t("nodeConfigs.integration.cafe24Resource")}
        value={resource}
        onChange={handleResourceChange}
        options={resourceOptions}
      />
      <SelectField
        label={t("nodeConfigs.integration.cafe24Operation")}
        value={operation}
        onChange={handleOperationChange}
        options={operationOptions}
        hint={coverageHint}
      />
      {plannedOp && (
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.integration.cafe24OperationPlannedHint")}
        </p>
      )}
      {supportedOp?.restrictedApproval && (
        <p className="text-[10px] text-amber-700 dark:text-amber-300">
          ⚠ {t("integrations.approvalRequiredTooltip")}
        </p>
      )}
      {!supportedOp && !plannedOp && operation && resource && extras && (
        <p className="text-[10px] text-amber-500">
          {t("nodeConfigs.integration.cafe24OperationUnknown")}
        </p>
      )}
      {supportedOp && (
        <>
          {requiredFields.length === 0 && optionalFields.length === 0 ? (
            <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.integration.cafe24FieldsEmpty")}
            </p>
          ) : (
            <>
              {requiredFields.length > 0 && (
                <FieldGroup
                  label={t("nodeConfigs.integration.cafe24FieldsRequired")}
                >
                  <div className="flex flex-col gap-2">
                    {requiredFields.map((f) => (
                      <Cafe24FieldRow
                        key={f.name}
                        field={f}
                        value={fieldValues[f.name] ?? ""}
                        onChange={(v) => handleFieldChange(f.name, v)}
                        t={t}
                      />
                    ))}
                  </div>
                </FieldGroup>
              )}
              {optionalFields.length > 0 && (
                <FieldGroup
                  label={t("nodeConfigs.integration.cafe24FieldsOptional")}
                >
                  <div className="flex flex-col gap-2">
                    {optionalFields.map((f) => (
                      <Cafe24FieldRow
                        key={f.name}
                        field={f}
                        value={fieldValues[f.name] ?? ""}
                        onChange={(v) => handleFieldChange(f.name, v)}
                        t={t}
                      />
                    ))}
                  </div>
                </FieldGroup>
              )}
            </>
          )}
          {supportedOp.paginated && (
            <FieldGroup
              label={t("nodeConfigs.integration.cafe24Pagination")}
              hint={t("nodeConfigs.integration.cafe24PaginationHint")}
            >
              <div className="flex gap-3">
                <NumberField
                  label={t("nodeConfigs.integration.cafe24Limit")}
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
                  label={t("nodeConfigs.integration.cafe24Offset")}
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
          )}
        </>
      )}
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
