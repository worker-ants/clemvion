"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { JsonSchemaNode, UiHint } from "@/lib/node-definitions";
import { isFieldRequired, isFieldVisible } from "./visibility";
import { humanize, pickWidget, applyClearFields } from "./utils";
import {
  TextWidget,
  NumberWidget,
  CheckboxWidget,
  SelectWidget,
  FieldArrayWidget,
  UnsupportedWidget,
  type WidgetProps,
} from "./widgets";
// Importing the registry here (even though we don't reference it directly)
// ensures `registerWidgets` is called before any field tries to render.
import "./widget-registry";
import { SectionTitle } from "../node-configs/shared";
import { useT, useLocale } from "@/lib/i18n";
import {
  translateBackendGroup,
  translateBackendLabel,
} from "@/lib/i18n/backend-labels";

type SchemaFormProps = {
  schema: JsonSchemaNode;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
};

const PRIMITIVES = {
  Text: TextWidget,
  Number: NumberWidget,
  Checkbox: CheckboxWidget,
  Select: SelectWidget,
  FieldArray: FieldArrayWidget,
  Unsupported: UnsupportedWidget,
};

type FieldEntry = {
  key: string;
  schema: JsonSchemaNode;
  ui: UiHint | undefined;
  order: number;
};

type FieldGroup = {
  name: string | null;
  collapsible: boolean;
  entries: FieldEntry[];
};

/**
 * Group consecutive entries by `ui.group`. Ungrouped fields get `name: null`.
 *
 * Defense-in-depth: if a schema accidentally interleaves two non-consecutive
 * fields of the same named group (typically a backend `order` collision —
 * e.g. `order: 40` reused across two groups so sort separates them), merge
 * the later occurrence into the earlier one rather than emitting two
 * `FieldGroup` records with the same `name`. The render path uses
 * `group.name` as a React key, so duplicate names would otherwise throw
 * the "two children with the same key" warning. `null` (ungrouped) is kept
 * positional — multiple null buckets are valid layout breaks.
 */
function groupEntries(entries: FieldEntry[]): FieldGroup[] {
  const groups: FieldGroup[] = [];
  const groupIndexByName = new Map<string, number>();
  for (const entry of entries) {
    const groupName = entry.ui?.group ?? null;
    const collapsible = entry.ui?.collapsible ?? false;
    const last = groups[groups.length - 1];
    if (last && last.name === groupName) {
      last.entries.push(entry);
      if (collapsible) last.collapsible = true;
      continue;
    }
    if (groupName !== null) {
      const earlierIdx = groupIndexByName.get(groupName);
      if (earlierIdx !== undefined) {
        const earlier = groups[earlierIdx];
        earlier.entries.push(entry);
        if (collapsible) earlier.collapsible = true;
        continue;
      }
    }
    groups.push({ name: groupName, collapsible, entries: [entry] });
    if (groupName !== null) {
      groupIndexByName.set(groupName, groups.length - 1);
    }
  }
  return groups;
}

/** Count visible, non-empty values in a group (for collapsible count badge). */
function countGroupValues(
  entries: FieldEntry[],
  value: Record<string, unknown>,
): number {
  return entries.reduce((n, e) => {
    if (e.ui?.hidden) return n;
    if (!isFieldVisible(e.ui, value)) return n;
    const v = value[e.key];
    if (v == null || v === "" || v === false) return n;
    if (Array.isArray(v) && v.length === 0) return n;
    return n + 1;
  }, 0);
}

function CollapsibleSection({
  name,
  count,
  children,
}: {
  name: string;
  count: number;
  children: React.ReactNode;
}) {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className="border-t border-[hsl(var(--border))] pt-2 mt-2">
      <button
        type="button"
        className="flex w-full items-center gap-1.5 text-left"
        onClick={() => setExpanded((prev) => !prev)}
      >
        {expanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[hsl(var(--muted-foreground))]">
          {name}
        </span>
        {count > 0 && (
          <span className="ml-auto text-[10px] text-[hsl(var(--muted-foreground))]">
            {count}
          </span>
        )}
      </button>
      {expanded && <div className="mt-2 flex flex-col gap-3">{children}</div>}
    </div>
  );
}

export function SchemaForm({ schema, value, onChange }: SchemaFormProps) {
  const t = useT();
  const locale = useLocale();
  const entries = useMemo<FieldEntry[]>(() => {
    const props = schema.properties ?? {};
    const list: FieldEntry[] = Object.entries(props).map(([key, field], idx) => {
      const ui = (field.ui as UiHint | undefined) ?? undefined;
      return {
        key,
        schema: field,
        ui,
        order: ui?.order ?? idx,
      };
    });
    list.sort((a, b) => a.order - b.order);
    return list;
  }, [schema]);

  const groups = useMemo(() => groupEntries(entries), [entries]);

  if (entries.length === 0) {
    return (
      <p className="text-[11px] text-[hsl(var(--muted-foreground))]">
        {t("nodeConfigs.autoForm.noFields")}
      </p>
    );
  }

  const update = (key: string, next: unknown, ui?: UiHint) => {
    const updated = applyClearFields({ ...value, [key]: next }, ui?.clearFields);
    onChange(updated);
  };

  // Patch several sibling fields in one commit (selectors co-writing derived
  // fields). `clearFields` still applies, keyed off the widget's own field.
  const updateFields = (patch: Record<string, unknown>, ui?: UiHint) => {
    onChange(applyClearFields({ ...value, ...patch }, ui?.clearFields));
  };

  const renderField = ({ key, schema: fieldSchema, ui }: FieldEntry) => {
    if (ui?.hidden) return null;
    if (!isFieldVisible(ui, value)) return null;
    const Widget = pickWidget<WidgetProps>(fieldSchema, ui, PRIMITIVES);
    const label = translateBackendLabel(ui?.label, locale) ?? humanize(key);
    const required = isFieldRequired(ui, key, schema.required, value);
    return (
      <Widget
        key={key}
        schema={fieldSchema}
        ui={ui}
        label={label}
        value={value[key]}
        onChange={(v) => update(key, v, ui)}
        onChangeFields={(patch) => updateFields(patch, ui)}
        required={required}
      />
    );
  };

  return (
    <div className="flex flex-col gap-3">
      {groups.map((group, gi) => {
        const visibleFields = group.entries.filter(
          (e) => !e.ui?.hidden && isFieldVisible(e.ui, value),
        );
        if (visibleFields.length === 0) return null;

        if (group.collapsible && group.name) {
          const count = countGroupValues(group.entries, value);
          const translatedName =
            translateBackendGroup(group.name, locale) ?? group.name;
          return (
            <CollapsibleSection
              key={group.name}
              name={translatedName}
              count={count}
            >
              {visibleFields.map(renderField)}
            </CollapsibleSection>
          );
        }

        const translatedName = group.name
          ? translateBackendGroup(group.name, locale) ?? group.name
          : null;
        return (
          <div key={group.name ?? `_ungrouped_${gi}`} className="flex flex-col gap-3">
            {translatedName && <SectionTitle>{translatedName}</SectionTitle>}
            {visibleFields.map(renderField)}
          </div>
        );
      })}
    </div>
  );
}

// Exported for unit testing
export { groupEntries, countGroupValues };
