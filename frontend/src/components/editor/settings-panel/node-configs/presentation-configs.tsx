"use client";

import { SelectField, NumberField, CheckboxField, SectionTitle } from "./shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X } from "lucide-react";

type Config = Record<string, unknown>;
type OnChange = (config: Config) => void;

// ===== Carousel =====
let carouselItemId = 0;

interface CarouselItem {
  id: number;
  title: string;
  description: string;
  image: string;
}

export function CarouselConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const mode = (config.mode as string) ?? "dynamic";
  const items = (config.items as CarouselItem[]) ?? [];

  const handleModeChange = (v: string) => {
    const { items: _items, titleField, descriptionField, imageField, maxItems, ...rest } = config;
    void _items; void titleField; void descriptionField; void imageField; void maxItems;
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

  const updateItem = (i: number, key: string, val: string) => {
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
              <ExpressionInput
                label="Description"
                value={item.description}
                onChange={(v) => updateItem(i, "description", v)}
                placeholder="Slide description (optional)"
              />
              <ExpressionInput
                label="Image URL"
                value={item.image}
                onChange={(v) => updateItem(i, "image", v)}
                placeholder="https://... (optional)"
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
    </div>
  );
}

// ===== Table =====
export function TableConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  const columns = (config.columns as Array<{ field: string; label: string; sortable: boolean }>) ?? [];

  const addColumn = () =>
    onChange({ ...config, columns: [...columns, { field: "", label: "", sortable: false }] });

  const removeColumn = (i: number) =>
    onChange({ ...config, columns: columns.filter((_, idx) => idx !== i) });

  const updateColumn = (i: number, key: string, val: string | boolean) => {
    const updated = columns.map((c, idx) => (idx === i ? { ...c, [key]: val } : c));
    onChange({ ...config, columns: updated });
  };

  return (
    <div className="flex flex-col gap-3">
      <SectionTitle>Columns</SectionTitle>
      {columns.map((col, i) => (
        <div key={i} className="flex gap-1">
          <Input
            value={col.field}
            onChange={(e) => updateColumn(i, "field", e.target.value)}
            placeholder="Field path"
            className="h-7 flex-1 text-xs"
          />
          <Input
            value={col.label}
            onChange={(e) => updateColumn(i, "label", e.target.value)}
            placeholder="Header"
            className="h-7 flex-1 text-xs"
          />
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => removeColumn(i)}>
            <X size={12} />
          </Button>
        </div>
      ))}
      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={addColumn}>
        <Plus size={12} className="mr-1" /> Add Column
      </Button>
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
    </div>
  );
}

// ===== Chart =====
export function ChartConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
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
        label="Data Field"
        value={(config.dataField as string) ?? ""}
        onChange={(v) => onChange({ ...config, dataField: v })}
        placeholder="data"
        hint="Array field containing chart data"
      />
      <SectionTitle>X Axis</SectionTitle>
      <ExpressionInput
        label="Field"
        value={(config.xAxisField as string) ?? ""}
        onChange={(v) => onChange({ ...config, xAxisField: v })}
        placeholder="x field path"
      />
      <ExpressionInput
        label="Label"
        value={(config.xAxisLabel as string) ?? ""}
        onChange={(v) => onChange({ ...config, xAxisLabel: v })}
        placeholder="X axis label"
      />
      <SectionTitle>Y Axis</SectionTitle>
      <ExpressionInput
        label="Field"
        value={(config.yAxisField as string) ?? ""}
        onChange={(v) => onChange({ ...config, yAxisField: v })}
        placeholder="y field path"
      />
      <ExpressionInput
        label="Label"
        value={(config.yAxisLabel as string) ?? ""}
        onChange={(v) => onChange({ ...config, yAxisLabel: v })}
        placeholder="Y axis label"
      />
      <SelectField
        label="Aggregation"
        value={(config.yAxisAggregation as string) ?? "sum"}
        onChange={(v) => onChange({ ...config, yAxisAggregation: v })}
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
      <NumberField
        label="Timeout (seconds)"
        value={(config.timeout as number) ?? 0}
        onChange={(v) => onChange({ ...config, timeout: v })}
        min={0}
        hint="0 = no timeout"
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
    </div>
  );
}

// ===== PDF =====
export function PdfConfig({ config, onChange }: { config: Config; onChange: OnChange }) {
  return (
    <div className="flex flex-col gap-3">
      <ExpressionInput multiline
        label="Template"
        value={(config.template as string) ?? ""}
        onChange={(v) => onChange({ ...config, template: v })}
        placeholder="<html><body>{{content}}</body></html>"
        mono
        rows={8}
        hint="HTML template with Handlebars syntax"
      />
      <SelectField
        label="Page Size"
        value={(config.pageSize as string) ?? "A4"}
        onChange={(v) => onChange({ ...config, pageSize: v })}
        options={[
          { value: "A4", label: "A4" },
          { value: "Letter", label: "Letter" },
          { value: "A3", label: "A3" },
        ]}
      />
      <SelectField
        label="Orientation"
        value={(config.orientation as string) ?? "portrait"}
        onChange={(v) => onChange({ ...config, orientation: v })}
        options={[
          { value: "portrait", label: "Portrait" },
          { value: "landscape", label: "Landscape" },
        ]}
      />
      <ExpressionInput
        label="File Name"
        value={(config.fileName as string) ?? "document.pdf"}
        onChange={(v) => onChange({ ...config, fileName: v })}
        hint="Supports expressions"
      />
    </div>
  );
}
