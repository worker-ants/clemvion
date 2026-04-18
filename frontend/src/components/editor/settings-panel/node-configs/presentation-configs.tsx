import { useState } from "react";
import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown, ChevronRight } from "lucide-react";
import { ButtonListEditor, type ButtonDef } from "./shared/button-list-editor";
import { useT } from "@/lib/i18n";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

function ButtonsConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const [expanded, setExpanded] = useState(true);
  const buttons = (config.buttons as ButtonDef[]) ?? [];

  return (
    <div className="border-t border-[hsl(var(--border))] pt-2 mt-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {t("nodeConfigs.presentation.buttons")}
        </span>
        {buttons.length > 0 && (
          <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
            {buttons.length}
          </span>
        )}
      </button>

      {expanded && (
        <div className="mt-2 flex flex-col gap-2">
          <ButtonListEditor
            buttons={buttons}
            onChange={(updated) => onChange({ ...config, buttons: updated })}
          />
        </div>
      )}
    </div>
  );
}

// ===== Table =====
interface TableRow {
  id: string;
  [key: string]: unknown;
}

export function TableConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const mode = (config.mode as string) ?? "dynamic";
  const columns = (config.columns as Array<{ field: string; label: string; sortable: boolean }>) ?? [];
  const rows = (config.rows as TableRow[]) ?? [];

  const handleModeChange = (v: string) => {
    const { rows: _rows, dataSource, ...rest } = config;
    void _rows; void dataSource;
    if (v === "static") {
      onChange({ ...rest, mode: v, rows: rows.length ? rows : [] });
    } else {
      onChange({ ...rest, mode: v });
    }
  };

  const addColumn = () => {
    const newField = `col${columns.length}`;
    const newColumns = [...columns, { field: newField, label: "", sortable: false }];
    const updatedRows = mode === "static"
      ? rows.map((r) => ({ ...r, [newField]: "" }))
      : rows;
    onChange({ ...config, columns: newColumns, rows: updatedRows });
  };

  const removeColumn = (i: number) => {
    const removedField = columns[i]?.field;
    const newColumns = columns.filter((_, idx) => idx !== i);
    const updatedRows = mode === "static" && removedField
      ? rows.map((r) => {
          const { [removedField]: _, ...rest } = r;
          void _;
          return rest as TableRow;
        })
      : rows;
    onChange({ ...config, columns: newColumns, rows: updatedRows });
  };

  const updateColumn = (i: number, key: string, val: string | boolean) => {
    const updated = columns.map((c, idx) => (idx === i ? { ...c, [key]: val } : c));
    onChange({ ...config, columns: updated });
  };

  const addRow = () => {
    const newRow: TableRow = { id: crypto.randomUUID() };
    for (const col of columns) {
      newRow[col.field] = "";
    }
    onChange({ ...config, rows: [...rows, newRow] });
  };

  const removeRow = (i: number) =>
    onChange({ ...config, rows: rows.filter((_, idx) => idx !== i) });

  const updateRowCell = (rowIdx: number, field: string, val: string) => {
    const updated = rows.map((r, idx) => (idx === rowIdx ? { ...r, [field]: val } : r));
    onChange({ ...config, rows: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.presentation.mode")}
        value={mode}
        onChange={handleModeChange}
        options={[
          { value: "dynamic", label: t("nodeConfigs.presentation.modeDynamic") },
          { value: "static", label: t("nodeConfigs.presentation.modeStatic") },
        ]}
      />

      {mode === "dynamic" && (
        <ExpressionInput
          label={t("nodeConfigs.presentation.dataSource")}
          value={(config.dataSource as string) ?? ""}
          onChange={(v) => onChange({ ...config, dataSource: v || undefined })}
          placeholder={t("nodeConfigs.presentation.dataSourcePlaceholder")}
          hint={t("nodeConfigs.presentation.dataSourceHint")}
        />
      )}

      <SectionTitle>{t("nodeConfigs.presentation.columns")}</SectionTitle>
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.presentation.columnLabel", { index: i + 1 })}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeColumn(i)}>
              <X size={10} />
            </Button>
          </div>
          {mode === "dynamic" && (
            <ExpressionInput
              label={t("nodeConfigs.presentation.field")}
              value={col.field}
              onChange={(v) => updateColumn(i, "field", v)}
              placeholder={t("nodeConfigs.presentation.fieldPath")}
            />
          )}
          <ExpressionInput
            label={t("nodeConfigs.presentation.label")}
            value={col.label}
            onChange={(v) => updateColumn(i, "label", v)}
            placeholder={t("nodeConfigs.presentation.columnHeader")}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addColumn}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.presentation.addColumn")}
      </Button>

      {mode === "static" && (
        <>
          <SectionTitle>{t("nodeConfigs.presentation.rows")}</SectionTitle>
          {rows.map((row, ri) => (
            <div key={row.id ?? ri} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                  {t("nodeConfigs.presentation.rowLabel", { index: ri + 1 })}
                </span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeRow(ri)}>
                  <X size={10} />
                </Button>
              </div>
              {columns.map((col) => (
                <ExpressionInput
                  key={col.field}
                  label={col.label || col.field}
                  value={String(row[col.field] ?? "")}
                  onChange={(v) => updateRowCell(ri, col.field, v)}
                  placeholder={t("nodeConfigs.presentation.rowValuePlaceholder", {
                    col: col.label || col.field,
                  })}
                />
              ))}
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
            <Plus size={12} className="mr-1" /> {t("nodeConfigs.presentation.addRow")}
          </Button>
        </>
      )}

      <CheckboxField
        label={t("nodeConfigs.presentation.enablePagination")}
        checked={(config.pagination as boolean) ?? true}
        onChange={(v) => onChange({ ...config, pagination: v })}
      />
      {(config.pagination as boolean) !== false && (
        <NumberField
          label={t("nodeConfigs.presentation.pageSize")}
          value={(config.pageSize as number) ?? 20}
          onChange={(v) => onChange({ ...config, pageSize: v })}
          min={1}
          max={100}
        />
      )}
      <ExpressionInput
        label={t("nodeConfigs.presentation.defaultSortColumn")}
        value={(config.sortBy as string) ?? ""}
        onChange={(v) => onChange({ ...config, sortBy: v })}
        placeholder={t("nodeConfigs.presentation.defaultSortHint")}
      />
      <SelectField
        label={t("nodeConfigs.presentation.sortOrder")}
        value={(config.sortOrder as string) ?? "asc"}
        onChange={(v) => onChange({ ...config, sortOrder: v })}
        options={[
          { value: "asc", label: t("nodeConfigs.presentation.sortAsc") },
          { value: "desc", label: t("nodeConfigs.presentation.sortDesc") },
        ]}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

// ===== Chart =====
export function ChartConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const xAxis = (config.xAxis as { field?: string; label?: string } | undefined) ?? {};
  const yAxis =
    (config.yAxis as { field?: string; label?: string; aggregation?: string } | undefined) ?? {};
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label={t("nodeConfigs.presentation.chartType")}
        value={(config.chartType as string) ?? "bar"}
        onChange={(v) => onChange({ ...config, chartType: v })}
        options={[
          { value: "bar", label: t("nodeConfigs.presentation.chartBar") },
          { value: "line", label: t("nodeConfigs.presentation.chartLine") },
          { value: "pie", label: t("nodeConfigs.presentation.chartPie") },
          { value: "donut", label: t("nodeConfigs.presentation.chartDonut") },
          { value: "area", label: t("nodeConfigs.presentation.chartArea") },
        ]}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.dataSource")}
        value={(config.dataSource as string) ?? ""}
        onChange={(v) => onChange({ ...config, dataSource: v })}
        placeholder="{{$var.items}}"
        hint={t("nodeConfigs.presentation.chartDataHint")}
      />
      <SectionTitle>{t("nodeConfigs.presentation.xAxis")}</SectionTitle>
      <ExpressionInput
        label={t("nodeConfigs.presentation.field")}
        value={xAxis.field ?? ""}
        onChange={(v) => onChange({ ...config, xAxis: { ...xAxis, field: v } })}
        placeholder={t("nodeConfigs.presentation.xFieldPlaceholder")}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.label")}
        value={xAxis.label ?? ""}
        onChange={(v) => onChange({ ...config, xAxis: { ...xAxis, label: v } })}
        placeholder={t("nodeConfigs.presentation.xLabelPlaceholder")}
      />
      <SectionTitle>{t("nodeConfigs.presentation.yAxis")}</SectionTitle>
      <ExpressionInput
        label={t("nodeConfigs.presentation.field")}
        value={yAxis.field ?? ""}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, field: v } })}
        placeholder={t("nodeConfigs.presentation.yFieldPlaceholder")}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.label")}
        value={yAxis.label ?? ""}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, label: v } })}
        placeholder={t("nodeConfigs.presentation.yLabelPlaceholder")}
      />
      <SelectField
        label={t("nodeConfigs.presentation.aggregation")}
        value={yAxis.aggregation ?? "sum"}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, aggregation: v } })}
        options={[
          { value: "sum", label: t("nodeConfigs.presentation.aggSum") },
          { value: "count", label: t("nodeConfigs.presentation.aggCount") },
          { value: "avg", label: t("nodeConfigs.presentation.aggAverage") },
          { value: "min", label: t("nodeConfigs.presentation.aggMin") },
          { value: "max", label: t("nodeConfigs.presentation.aggMax") },
        ]}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.groupBy")}
        value={(config.groupBy as string) ?? ""}
        onChange={(v) => onChange({ ...config, groupBy: v })}
        placeholder={t("nodeConfigs.presentation.groupByHint")}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.title")}
        value={(config.title as string) ?? ""}
        onChange={(v) => onChange({ ...config, title: v })}
        placeholder={t("nodeConfigs.presentation.chartTitle")}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

// ===== Form =====
export function FormConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  const fields = (config.fields as Array<{ name: string; type: string; label: string; required: boolean }>) ?? [];

  const addField = () =>
    onChange({
      ...config,
      fields: [...fields, { name: "", type: "text", label: "", required: false }],
    });

  const removeField = (i: number) =>
    onChange({ ...config, fields: fields.filter((_, idx) => idx !== i) });

  const updateField = (i: number, key: string, val: string | boolean) => {
    const updated = fields.map((f, idx) => (idx === i ? { ...f, [key]: val } : f));
    onChange({ ...config, fields: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput
        label={t("nodeConfigs.presentation.title")}
        value={(config.title as string) ?? ""}
        onChange={(v) => onChange({ ...config, title: v })}
        placeholder={t("nodeConfigs.presentation.formTitle")}
      />
      <ExpressionInput multiline
        label={t("nodeConfigs.presentation.description")}
        value={(config.description as string) ?? ""}
        onChange={(v) => onChange({ ...config, description: v })}
        placeholder={t("nodeConfigs.presentation.formDescription")}
        rows={2}
      />
      <ExpressionInput
        label={t("nodeConfigs.presentation.submitLabel")}
        value={(config.submitLabel as string) ?? t("nodeConfigs.presentation.submitPlaceholder")}
        onChange={(v) => onChange({ ...config, submitLabel: v })}
      />
      <SectionTitle>{t("nodeConfigs.presentation.fields")}</SectionTitle>
      {fields.map((field, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
              {t("nodeConfigs.presentation.fieldLabel", { index: i + 1 })}
            </span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeField(i)}>
              <X size={10} />
            </Button>
          </div>
          <Input
            value={field.name}
            onChange={(e) => updateField(i, "name", e.target.value)}
            placeholder={t("nodeConfigs.presentation.fieldNamePlaceholder")}
            className="h-7 text-xs"
          />
          <Input
            value={field.label}
            onChange={(e) => updateField(i, "label", e.target.value)}
            placeholder={t("nodeConfigs.presentation.label")}
            className="h-7 text-xs"
          />
          <select
            value={field.type}
            onChange={(e) => updateField(i, "type", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="text">{t("nodeConfigs.presentation.fieldTypeText")}</option>
            <option value="number">{t("nodeConfigs.presentation.fieldTypeNumber")}</option>
            <option value="email">{t("nodeConfigs.presentation.fieldTypeEmail")}</option>
            <option value="textarea">{t("nodeConfigs.presentation.fieldTypeTextarea")}</option>
            <option value="select">{t("nodeConfigs.presentation.fieldTypeSelect")}</option>
            <option value="checkbox">{t("nodeConfigs.presentation.fieldTypeCheckbox")}</option>
            <option value="radio">{t("nodeConfigs.presentation.fieldTypeRadio")}</option>
            <option value="date">{t("nodeConfigs.presentation.fieldTypeDate")}</option>
            <option value="file">{t("nodeConfigs.presentation.fieldTypeFile")}</option>
          </select>
          <CheckboxField
            label={t("nodeConfigs.presentation.required")}
            checked={field.required ?? false}
            onChange={(v) => updateField(i, "required", v)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addField}>
        <Plus size={12} className="mr-1" /> {t("nodeConfigs.presentation.addField")}
      </Button>
    </div>
  );
}

// ===== Template =====
export function TemplateConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const t = useT();
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput multiline
        label={t("nodeConfigs.presentation.template")}
        value={(config.template as string) ?? ""}
        onChange={(v) => onChange({ ...config, template: v })}
        placeholder={t("nodeConfigs.presentation.templatePlaceholder")}
        mono
        rows={10}
        hint={t("nodeConfigs.presentation.templateHint")}
      />
      <SelectField
        label={t("nodeConfigs.presentation.outputFormat")}
        value={(config.outputFormat as string) ?? "html"}
        onChange={(v) => onChange({ ...config, outputFormat: v })}
        options={[
          { value: "html", label: t("nodeConfigs.presentation.outHtml") },
          { value: "markdown", label: t("nodeConfigs.presentation.outMarkdown") },
          { value: "text", label: t("nodeConfigs.presentation.outPlain") },
        ]}
      />
      <CheckboxField
        label={t("nodeConfigs.presentation.enableHelpers")}
        checked={(config.helpers as boolean) ?? true}
        onChange={(v) => onChange({ ...config, helpers: v })}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}
