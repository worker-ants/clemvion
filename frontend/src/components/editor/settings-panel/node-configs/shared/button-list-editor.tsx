"use client";

import { SelectField } from "../shared";
import { ExpressionInput } from "@/components/editor/expression";
import { Button } from "@/components/ui/button";
import { Plus, X, GripVertical } from "lucide-react";

export interface ButtonDef {
  id: string;
  label: string;
  type: "link" | "port";
  url?: string;
  style?: "primary" | "secondary" | "outline" | "danger";
}

/** Reusable button list editor with manual up/down reordering. */
export function ButtonListEditor({
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
