import { useState } from "react";
import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, ChevronDown, ChevronRight, GripVertical } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Shared Buttons Config =====

interface ButtonDef {
  id: string;
  label: string;
  type: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

/** Reusable button list editor. Used by both global ButtonsConfig and per-item ItemButtonsConfig. */
function ButtonListEditor({
  buttons,
  onChange,
  maxButtons = 10,
}: {
  buttons: ButtonDef[];
  onChange: (buttons: ButtonDef[]) => void;
  maxButtons?: number;
}) {
  const addButton = () => {
    if (buttons.length >= maxButtons) return;
    onChange([
      ...buttons,
      { id: crypto.randomUUID(), label: "", type: "port", style: "secondary" },
    ]);
  };

  const removeButton = (i: number) =>
    onChange(buttons.filter((_, idx) => idx !== i));

  const updateButton = (i: number, key: string, val: string) => {
    const updated = buttons.map((btn, idx) => {
      if (idx !== i) return btn;
      const next = { ...btn, [key]: val };
      if (key === "type" && val === "port") {
        delete next.url;
      }
      return next;
    });
    onChange(updated);
  };

  const moveButton = (from: number, to: number) => {
    if (to < 0 || to >= buttons.length) return;
    const updated = [...buttons];
    const [moved] = updated.splice(from, 1);
    updated.splice(to, 0, moved);
    onChange(updated);
  };

  return (
    <div className="flex flex-col gap-2">
      {buttons.map((btn, i) => (
        <div
          key={btn.id}
          className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button
                type="button"
                className="cursor-grab text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
                title="Move up"
                onClick={() => moveButton(i, i - 1)}
                disabled={i === 0}
              >
                <GripVertical size={10} />
              </button>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                Button {i + 1}
              </span>
            </div>
            <div className="flex gap-0.5">
              {i > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-[10px]"
                  onClick={() => moveButton(i, i - 1)}
                  title="Move up"
                >
                  ↑
                </Button>
              )}
              {i < buttons.length - 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-[10px]"
                  onClick={() => moveButton(i, i + 1)}
                  title="Move down"
                >
                  ↓
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-5 w-5"
                onClick={() => removeButton(i)}
              >
                <X size={10} />
              </Button>
            </div>
          </div>
          <ExpressionInput
            label="Label"
            value={btn.label}
            onChange={(v) => updateButton(i, "label", v)}
            placeholder="Button label"
          />
          <SelectField
            label="Type"
            value={btn.type}
            onChange={(v) => updateButton(i, "type", v)}
            options={[
              { value: "port", label: "Port (route execution)" },
              { value: "link", label: "Link (open URL)" },
            ]}
          />
          {btn.type === "link" && (
            <ExpressionInput
              label="URL"
              value={btn.url ?? ""}
              onChange={(v) => updateButton(i, "url", v)}
              placeholder="https://... or {{ expression }}"
            />
          )}
          <SelectField
            label="Style"
            value={btn.style ?? "secondary"}
            onChange={(v) => updateButton(i, "style", v)}
            options={[
              { value: "primary", label: "Primary" },
              { value: "secondary", label: "Secondary" },
              { value: "outline", label: "Outline" },
              { value: "danger", label: "Danger" },
            ]}
          />
        </div>
      ))}

      {buttons.length < maxButtons && (
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={addButton}
        >
          <Plus size={12} className="mr-1" /> Add Button
        </Button>
      )}
    </div>
  );
}

function ButtonsConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
          Buttons
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

// ===== Carousel =====
let carouselItemId = 0;

interface CarouselItem {
  id: number;
  title: string;
  description: string;
  image: string;
  buttons?: ButtonDef[];
}

function ItemButtonsConfig({
  buttons,
  onChange,
}: {
  buttons: ButtonDef[];
  onChange: (buttons: ButtonDef[]) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="mt-1">
      <button
        type="button"
        className="flex items-center gap-1 text-[10px] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--foreground))]"
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        Item Buttons ({buttons.length})
      </button>
      {expanded && (
        <div className="mt-1 pl-2 border-l border-[hsl(var(--border))]">
          <ButtonListEditor
            buttons={buttons}
            onChange={onChange}
            maxButtons={4}
          />
        </div>
      )}
    </div>
  );
}

export function CarouselConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const mode = (config.mode as string) ?? "dynamic";
  const items = (config.items as CarouselItem[]) ?? [];

  const handleModeChange = (v: string) => {
    const { items: _items, titleField, descriptionField, imageField, maxItems, source, itemButtons, ...rest } = config;
    void _items; void titleField; void descriptionField; void imageField; void maxItems; void source; void itemButtons;
    if (v === "static") {
      onChange({ ...rest, mode: v, items: items.length ? items : [] });
    } else {
      onChange({ ...rest, mode: v });
    }
  };

  const addItem = () =>
    onChange({
      ...config,
      items: [...items, { id: ++carouselItemId, title: "", description: "", image: "" }],
    });

  const removeItem = (i: number) =>
    onChange({ ...config, items: items.filter((_, idx) => idx !== i) });

  const updateItem = (i: number, key: string, val: unknown) => {
    const updated = items.map((item, idx) => (idx === i ? { ...item, [key]: val } : item));
    onChange({ ...config, items: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Mode"
        value={mode}
        onChange={handleModeChange}
        options={[
          { value: "static", label: "Static Items" },
          { value: "dynamic", label: "Dynamic (from input)" },
        ]}
      />

      {mode === "static" && (
        <>
          <SectionTitle>Items</SectionTitle>
          {items.map((item, i) => (
            <div key={item.id ?? i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Item {i + 1}</span>
                <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeItem(i)}>
                  <X size={10} />
                </Button>
              </div>
              <ExpressionInput
                label="Title"
                value={item.title}
                onChange={(v) => updateItem(i, "title", v)}
                placeholder="Slide title"
              />
              <ExpressionInput multiline
                label="Description"
                value={item.description}
                onChange={(v) => updateItem(i, "description", v)}
                placeholder="Slide description (optional)"
                rows={2}
              />
              <ExpressionInput
                label="Image URL"
                value={item.image}
                onChange={(v) => updateItem(i, "image", v)}
                placeholder="https://... (optional)"
              />
              <ItemButtonsConfig
                buttons={item.buttons ?? []}
                onChange={(btns) => updateItem(i, "buttons", btns.length > 0 ? btns : undefined)}
              />
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addItem}>
            <Plus size={12} className="mr-1" /> Add Item
          </Button>
        </>
      )}

      {mode === "dynamic" && (
        <>
          <ExpressionInput
            label="Source"
            value={(config.source as string) ?? ""}
            onChange={(v) => onChange({ ...config, source: v })}
            placeholder="{{ $input.items }}"
            hint="Expression that returns the array to display"
          />
          <ExpressionInput
            label="Title Field"
            value={(config.titleField as string) ?? ""}
            onChange={(v) => onChange({ ...config, titleField: v })}
            placeholder="title"
            hint="Field path for slide title"
          />
          <ExpressionInput
            label="Description Field"
            value={(config.descriptionField as string) ?? ""}
            onChange={(v) => onChange({ ...config, descriptionField: v })}
            placeholder="description"
          />
          <ExpressionInput
            label="Image Field"
            value={(config.imageField as string) ?? ""}
            onChange={(v) => onChange({ ...config, imageField: v })}
            placeholder="imageUrl (optional)"
          />
          <NumberField
            label="Max Items"
            value={(config.maxItems as number) ?? 10}
            onChange={(v) => onChange({ ...config, maxItems: v })}
            min={1}
            max={100}
          />
        </>
      )}

      {mode === "dynamic" && (
        <ItemButtonsConfig
          buttons={(config.itemButtons as ButtonDef[]) ?? []}
          onChange={(btns) => onChange({ ...config, itemButtons: btns.length > 0 ? btns : undefined })}
        />
      )}

      <SelectField
        label="Layout"
        value={(config.layout as string) ?? "card"}
        onChange={(v) => onChange({ ...config, layout: v })}
        options={[
          { value: "card", label: "Card" },
          { value: "image", label: "Image" },
          { value: "minimal", label: "Minimal" },
        ]}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

// ===== Table =====
interface TableRow {
  id: string;
  [key: string]: unknown;
}

export function TableConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Mode"
        value={mode}
        onChange={handleModeChange}
        options={[
          { value: "dynamic", label: "Dynamic (from data)" },
          { value: "static", label: "Static (manual)" },
        ]}
      />

      {mode === "dynamic" && (
        <ExpressionInput
          label="Data Source"
          value={(config.dataSource as string) ?? ""}
          onChange={(v) => onChange({ ...config, dataSource: v || undefined })}
          placeholder="{{ $node[&quot;Node&quot;].output }} or {{ $var.list }}"
          hint="Array data source (leave empty for previous node input)"
        />
      )}

      <SectionTitle>Columns</SectionTitle>
      {columns.map((col, i) => (
        <div key={i} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Column {i + 1}</span>
            <Button variant="ghost" size="icon" className="h-5 w-5" onClick={() => removeColumn(i)}>
              <X size={10} />
            </Button>
          </div>
          {mode === "dynamic" && (
            <ExpressionInput
              label="Field"
              value={col.field}
              onChange={(v) => updateColumn(i, "field", v)}
              placeholder="Field path"
            />
          )}
          <ExpressionInput
            label="Label"
            value={col.label}
            onChange={(v) => updateColumn(i, "label", v)}
            placeholder="Column header"
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addColumn}>
        <Plus size={12} className="mr-1" /> Add Column
      </Button>

      {mode === "static" && (
        <>
          <SectionTitle>Rows</SectionTitle>
          {rows.map((row, ri) => (
            <div key={row.id ?? ri} className="flex flex-col gap-1 rounded border border-[hsl(var(--border))] p-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[hsl(var(--muted-foreground))]">Row {ri + 1}</span>
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
                  placeholder={`Value for ${col.label || col.field}`}
                />
              ))}
            </div>
          ))}
          <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addRow}>
            <Plus size={12} className="mr-1" /> Add Row
          </Button>
        </>
      )}

      <CheckboxField
        label="Enable pagination"
        checked={(config.pagination as boolean) ?? true}
        onChange={(v) => onChange({ ...config, pagination: v })}
      />
      {(config.pagination as boolean) !== false && (
        <NumberField
          label="Page Size"
          value={(config.pageSize as number) ?? 20}
          onChange={(v) => onChange({ ...config, pageSize: v })}
          min={1}
          max={100}
        />
      )}
      <ExpressionInput
        label="Default Sort Column"
        value={(config.sortBy as string) ?? ""}
        onChange={(v) => onChange({ ...config, sortBy: v })}
        placeholder="Optional field to sort by"
      />
      <SelectField
        label="Sort Order"
        value={(config.sortOrder as string) ?? "asc"}
        onChange={(v) => onChange({ ...config, sortOrder: v })}
        options={[
          { value: "asc", label: "Ascending" },
          { value: "desc", label: "Descending" },
        ]}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

// ===== Chart =====
export function ChartConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const xAxis = (config.xAxis as { field?: string; label?: string } | undefined) ?? {};
  const yAxis =
    (config.yAxis as { field?: string; label?: string; aggregation?: string } | undefined) ?? {};
  return (
    <div className="flex flex-col gap-3">
      <SelectField
        label="Chart Type"
        value={(config.chartType as string) ?? "bar"}
        onChange={(v) => onChange({ ...config, chartType: v })}
        options={[
          { value: "bar", label: "Bar" },
          { value: "line", label: "Line" },
          { value: "pie", label: "Pie" },
          { value: "donut", label: "Donut" },
          { value: "area", label: "Area" },
        ]}
      />
      <ExpressionInput
        label="Data Source"
        value={(config.dataSource as string) ?? ""}
        onChange={(v) => onChange({ ...config, dataSource: v })}
        placeholder="{{$var.items}}"
        hint="Array expression for chart data (leave empty to use previous node output)"
      />
      <SectionTitle>X Axis</SectionTitle>
      <ExpressionInput
        label="Field"
        value={xAxis.field ?? ""}
        onChange={(v) => onChange({ ...config, xAxis: { ...xAxis, field: v } })}
        placeholder="x field path"
      />
      <ExpressionInput
        label="Label"
        value={xAxis.label ?? ""}
        onChange={(v) => onChange({ ...config, xAxis: { ...xAxis, label: v } })}
        placeholder="X axis label"
      />
      <SectionTitle>Y Axis</SectionTitle>
      <ExpressionInput
        label="Field"
        value={yAxis.field ?? ""}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, field: v } })}
        placeholder="y field path"
      />
      <ExpressionInput
        label="Label"
        value={yAxis.label ?? ""}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, label: v } })}
        placeholder="Y axis label"
      />
      <SelectField
        label="Aggregation"
        value={yAxis.aggregation ?? "sum"}
        onChange={(v) => onChange({ ...config, yAxis: { ...yAxis, aggregation: v } })}
        options={[
          { value: "sum", label: "Sum" },
          { value: "count", label: "Count" },
          { value: "avg", label: "Average" },
          { value: "min", label: "Min" },
          { value: "max", label: "Max" },
        ]}
      />
      <ExpressionInput
        label="Group By"
        value={(config.groupBy as string) ?? ""}
        onChange={(v) => onChange({ ...config, groupBy: v })}
        placeholder="Optional grouping field"
      />
      <ExpressionInput
        label="Title"
        value={(config.title as string) ?? ""}
        onChange={(v) => onChange({ ...config, title: v })}
        placeholder="Chart title"
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

// ===== Form =====
export function FormConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Title"
        value={(config.title as string) ?? ""}
        onChange={(v) => onChange({ ...config, title: v })}
        placeholder="Form title"
      />
      <ExpressionInput multiline
        label="Description"
        value={(config.description as string) ?? ""}
        onChange={(v) => onChange({ ...config, description: v })}
        placeholder="Form description (Markdown)"
        rows={2}
      />
      <ExpressionInput
        label="Submit Label"
        value={(config.submitLabel as string) ?? "Submit"}
        onChange={(v) => onChange({ ...config, submitLabel: v })}
      />
      <SectionTitle>Fields</SectionTitle>
      {fields.map((field, i) => (
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
          <Input
            value={field.label}
            onChange={(e) => updateField(i, "label", e.target.value)}
            placeholder="Label"
            className="h-7 text-xs"
          />
          <select
            value={field.type}
            onChange={(e) => updateField(i, "type", e.target.value)}
            className="h-7 rounded-md border border-[hsl(var(--input))] bg-transparent px-2 text-xs"
          >
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="email">Email</option>
            <option value="textarea">Textarea</option>
            <option value="select">Select</option>
            <option value="checkbox">Checkbox</option>
            <option value="radio">Radio</option>
            <option value="date">Date</option>
            <option value="file">File</option>
          </select>
          <CheckboxField
            label="Required"
            checked={field.required ?? false}
            onChange={(v) => updateField(i, "required", v)}
          />
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addField}>
        <Plus size={12} className="mr-1" /> Add Field
      </Button>
    </div>
  );
}

// ===== Template =====
export function TemplateConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput multiline
        label="Template"
        value={(config.template as string) ?? ""}
        onChange={(v) => onChange({ ...config, template: v })}
        placeholder="<h1>{{title}}</h1>\n<p>{{body}}</p>"
        mono
        rows={10}
        hint="Handlebars template syntax"
      />
      <SelectField
        label="Output Format"
        value={(config.outputFormat as string) ?? "html"}
        onChange={(v) => onChange({ ...config, outputFormat: v })}
        options={[
          { value: "html", label: "HTML" },
          { value: "markdown", label: "Markdown" },
          { value: "text", label: "Plain Text" },
        ]}
      />
      <CheckboxField
        label="Enable built-in helpers"
        checked={(config.helpers as boolean) ?? true}
        onChange={(v) => onChange({ ...config, helpers: v })}
      />

      <ButtonsConfig config={config} onChange={onChange} />
    </div>
  );
}

