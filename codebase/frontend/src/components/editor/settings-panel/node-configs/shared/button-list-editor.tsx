"use client";

import { SelectField } from "../shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Button } from "@/components/ui/button";
import { Plus, X, GripVertical } from "lucide-react";
import { useT } from "@/lib/i18n";

export interface ButtonDef {
  id: string;
  label: string;
  type: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

/**
 * Reusable button list editor with manual up/down reordering.
 *
 * `maxButtons` default 5 mirrors backend `MAX_BUTTONS_PER_NODE` and
 * spec/4-nodes/6-presentation/0-common.md §1.1 "최대 버튼 수: 노드당 5개".
 * Override per-call only when the surrounding context provides additional
 * capacity (e.g., carousel itemButtons UI also stays at 5; only the visual
 * presentation combines global+item = 10 for a single item).
 */
export function ButtonListEditor({
  buttons,
  onChange,
  maxButtons = 5,
}: {
  buttons: ButtonDef[];
  onChange: (buttons: ButtonDef[]) => void;
  maxButtons?: number;
}) {
  const t = useT();
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
                title={t("nodeConfigs.buttonList.moveUp")}
                onClick={() => moveButton(i, i - 1)}
                disabled={i === 0}
              >
                <GripVertical size={10} />
              </button>
              <span className="text-[10px] text-[hsl(var(--muted-foreground))]">
                {t("nodeConfigs.buttonList.buttonLabel", { index: i + 1 })}
              </span>
            </div>
            <div className="flex gap-0.5">
              {i > 0 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-5 w-5 text-[10px]"
                  onClick={() => moveButton(i, i - 1)}
                  title={t("nodeConfigs.buttonList.moveUp")}
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
                  title={t("nodeConfigs.buttonList.moveDown")}
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
            label={t("nodeConfigs.buttonList.labelField")}
            value={btn.label}
            onChange={(v) => updateButton(i, "label", v)}
            placeholder={t("nodeConfigs.buttonList.labelPlaceholder")}
          />
          <SelectField
            label={t("nodeConfigs.buttonList.typeField")}
            value={btn.type}
            onChange={(v) => updateButton(i, "type", v)}
            options={[
              { value: "port", label: t("nodeConfigs.buttonList.typePort") },
              { value: "link", label: t("nodeConfigs.buttonList.typeLink") },
            ]}
          />
          {btn.type === "link" && (
            <ExpressionInput
              label={t("nodeConfigs.buttonList.urlField")}
              value={btn.url ?? ""}
              onChange={(v) => updateButton(i, "url", v)}
              placeholder={t("nodeConfigs.buttonList.urlPlaceholder")}
            />
          )}
          <SelectField
            label={t("nodeConfigs.buttonList.styleField")}
            value={btn.style ?? "secondary"}
            onChange={(v) => updateButton(i, "style", v)}
            options={[
              { value: "primary", label: t("nodeConfigs.buttonList.stylePrimary") },
              { value: "secondary", label: t("nodeConfigs.buttonList.styleSecondary") },
              { value: "outline", label: t("nodeConfigs.buttonList.styleOutline") },
              { value: "danger", label: t("nodeConfigs.buttonList.styleDanger") },
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
          <Plus size={12} className="mr-1" /> {t("nodeConfigs.buttonList.addButton")}
        </Button>
      )}
    </div>
  );
}
